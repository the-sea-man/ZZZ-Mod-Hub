//! Universal In-Game Menu Engine for 3DMigoto/ZZMI.
//!
//! Generates GPU-accelerated, mouse-interactive, draggable, paginated in-game GUI menus
//! with 0ms toggle response, live state shading (100% vs 20% alpha), and zero F10 reloads.

pub mod assets;
pub mod builder;
pub mod model;
pub mod parser;

#[cfg(test)]
pub mod tests;

use crate::error::AppError;
#[allow(unused_imports)]
pub use model::TrackingTarget;
#[allow(unused_imports)]
pub use parser::{extract_variable_from_condition, get_tracking_hashes, get_tracking_targets};

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Resolves the canonical base `Mods` directory regardless of whether the caller
/// passed `.../Mods` or `.../Mods/Playable Characters`.
pub fn resolve_master_mods_dir(root_path: &Path) -> PathBuf {
    let folder_name = root_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if folder_name.eq_ignore_ascii_case("Playable Characters")
        || folder_name.eq_ignore_ascii_case("NPCs")
        || folder_name.eq_ignore_ascii_case("Bangboos")
        || folder_name.eq_ignore_ascii_case("UI")
    {
        root_path.parent().unwrap_or(root_path).to_path_buf()
    } else {
        root_path.to_path_buf()
    }
}

/// Cleans all legacy and duplicate master UI directories across `Mods` and subfolders.
fn clean_all_master_ui_dirs(base_mods_dir: &Path, root_path: &Path) -> usize {
    let mut deleted_count = 0;
    let dirs_to_clean = [
        base_mods_dir.join("zzzzzz_ZZZModManagerUI"),
        base_mods_dir.join("000_ZzzManager_UI"),
        base_mods_dir.join("Playable Characters").join("zzzzzz_ZZZModManagerUI"),
        base_mods_dir.join("Playable Characters").join("000_ZzzManager_UI"),
        root_path.join("zzzzzz_ZZZModManagerUI"),
        root_path.join("000_ZzzManager_UI"),
    ];

    for dir in &dirs_to_clean {
        if dir.exists() {
            if let Ok(entries) = fs::read_dir(dir) {
                deleted_count += entries.count();
            }
            let _ = fs::remove_dir_all(dir);
        }
    }

    deleted_count
}

/// Generates in-game HUD overlay files for all active/enabled mods.
///
/// Supports two modes:
/// - `"interactive"` (default): Direct3D 11 GPU GUI with mouse dragging, click-to-toggle, and pagination.
/// - `"classic"`: Monospace text cheat sheet using ZZMI `help.ini` text buffer.
pub fn generate_in_game_ui(
    root_path: &str,
    active_mod_paths: Option<Vec<String>>,
    hud_key: Option<String>,
    menu_mode: Option<String>,
) -> Result<String, AppError> {
    let mut generated_count = 0;
    let root_expanded = crate::utils::expand_path(root_path);
    let base_mods_dir = resolve_master_mods_dir(Path::new(&root_expanded));
    let mode = menu_mode.as_deref().unwrap_or("interactive");
    let is_interactive = mode != "classic";
    let key_str = hud_key.as_deref().unwrap_or("h");

    // 1. Clean previous UI directories so stale/orphaned INIs are never left behind
    let _ = clean_all_master_ui_dirs(&base_mods_dir, Path::new(&root_expanded));

    let master_ui_dir = base_mods_dir.join("zzzzzz_ZZZModManagerUI");
    let _ = fs::create_dir_all(&master_ui_dir);

    // 2. Install GPU Shaders and procedural UI textures
    if is_interactive {
        let assets_dir = master_ui_dir.join("assets");
        if let Err(e) = assets::ensure_ui_assets_installed(&assets_dir) {
            tracing::warn!("Failed to write UI assets to {:?}: {}", assets_dir, e);
        }
    }

    // 3. Discover INI files from enabled mods only
    let mut mod_groups: HashMap<PathBuf, Vec<PathBuf>> = HashMap::new();

    if let Some(paths) = active_mod_paths {
        for p in paths {
            let mod_path = PathBuf::from(&p);
            let folder_name = mod_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if mod_path.exists() && !folder_name.starts_with("DISABLED ") && !p.contains("\\DISABLED ") && !p.contains("/DISABLED ") {
                let mut ini_files = Vec::new();
                crate::utils::find_ini_files(&mod_path, &mut ini_files, 0, 10);
                if !ini_files.is_empty() {
                    mod_groups.insert(mod_path, ini_files);
                }
            }
        }
    } else {
        let active_mods = crate::utils::discover_active_mods(&base_mods_dir);
        for entry in active_mods {
            if !entry.ini_files.is_empty() {
                mod_groups.insert(entry.mod_path, entry.ini_files);
            }
        }
    }

    // 4. Generate UI files for each mod group
    for (mod_root, ini_files) in mod_groups {
        let relative = mod_root.strip_prefix(&base_mods_dir).unwrap_or(&mod_root);
        let components: Vec<_> = relative.components().map(|c| c.as_os_str().to_string_lossy().to_string()).collect();

        let (category_name, raw_mod_name) = match components.as_slice() {
            [sub_tab, cat, mod_n, ..] if sub_tab.eq_ignore_ascii_case("Playable Characters")
                                      || sub_tab.eq_ignore_ascii_case("NPCs")
                                      || sub_tab.eq_ignore_ascii_case("Bangboos")
                                      || sub_tab.eq_ignore_ascii_case("UI") => {
                (cat.clone(), mod_n.clone())
            }
            [cat, mod_n, ..] => (cat.clone(), mod_n.clone()),
            [mod_n] => ("Global".to_string(), mod_n.clone()),
            [] => ("Global".to_string(), "Unknown Mod".to_string()),
        };

        if let Some(menu_def) = parser::parse_mod_menu(&mod_root, &ini_files, &category_name, &raw_mod_name) {
            let txt_path = master_ui_dir.join(format!("zzzmanager_ui_{}.txt", menu_def.safe_id));
            let ini_path = master_ui_dir.join(format!("zzzmanager_ui_{}.ini", menu_def.safe_id));

            // Always write the text cheat sheet
            let _ = fs::write(&txt_path, menu_def.raw_txt_cheat_sheet.trim_end());

            // Build the appropriate INI based on selected mode
            let ini_content = if is_interactive {
                builder::build_interactive_menu_ini(&menu_def, key_str)
            } else {
                builder::build_classic_text_ini(&menu_def, key_str)
            };

            let _ = fs::write(&ini_path, ini_content);
            generated_count += 1;
        }
    }

    let mode_desc = if is_interactive { "Interactive GUI" } else { "Classic Text" };
    Ok(format!(
        "In-Game UI Enabled! Generated unified {} files for {} mod directories.",
        mode_desc, generated_count
    ))
}

pub fn disable_in_game_ui(root_path: &str) -> Result<String, AppError> {
    let mut cleaned_count = 0;
    let root_expanded = crate::utils::expand_path(root_path);
    let base_mods_dir = resolve_master_mods_dir(Path::new(&root_expanded));
    let mut all_ini_files = Vec::new();
    crate::utils::find_ini_files(&base_mods_dir, &mut all_ini_files, 0, 15);

    for ini_file in &all_ini_files {
        if clean_mod_ini(ini_file).unwrap_or(false) {
            cleaned_count += 1;
        }
    }

    let deleted_count = clean_all_master_ui_dirs(&base_mods_dir, Path::new(&root_expanded));

    Ok(format!("In-Game UI Disabled! Cleaned {} legacy injections and deleted {} UI files.", cleaned_count, deleted_count))
}

pub fn clean_mod_ini_content(content: &str) -> String {
    let mut cleaned_lines = Vec::new();
    let mut inside_injection = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "; --- ZzzManagerUI Start ---" || trimmed == "; --- ZzzManagerUI Tracking Start ---" {
            inside_injection = true;
            continue;
        }
        if trimmed == "; --- ZzzManagerUI End ---" || trimmed == "; --- ZzzManagerUI Tracking End ---" || trimmed == "; --- ZzzManagerUI Modified ---" {
            inside_injection = false;
            continue;
        }
        if !inside_injection {
            if let Some(idx) = line.find("&& $active_") {
                cleaned_lines.push(line[..idx].trim_end().to_string());
            } else {
                cleaned_lines.push(line.to_string());
            }
        }
    }

    let mut final_content = String::new();
    let mut blank_count = 0;
    for line in cleaned_lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            blank_count += 1;
            if blank_count <= 2 {
                final_content.push_str(&line);
                final_content.push('\n');
            }
        } else {
            blank_count = 0;
            final_content.push_str(&line);
            final_content.push('\n');
        }
    }

    final_content.trim_end().to_string() + "\n"
}

pub fn clean_mod_ini(file_path: &Path) -> Result<bool, AppError> {
    let content = crate::utils::read_ini_to_string(file_path)?;

    if !content.contains("ZzzManagerUI") {
        return Ok(false);
    }

    let cleaned_content = clean_mod_ini_content(&content);
    if cleaned_content != content {
        fs::write(file_path, cleaned_content)?;

        if let Some(parent) = file_path.parent() {
            if let Ok(entries) = fs::read_dir(parent) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                            if name.ends_with("_ui.txt") && !name.starts_with("zzzmanager_ui_") {
                                let _ = fs::remove_file(path);
                            }
                        }
                    }
                }
            }
        }
        return Ok(true);
    }

    Ok(false)
}

/// Removes generated master UI overlay files (.ini and .txt) for a specific mod when disabled
pub fn remove_mod_ui_files(mods_root: &Path, mod_folder_name: &str) {
    let clean_name = mod_folder_name.strip_prefix("DISABLED ").unwrap_or(mod_folder_name);
    let base_mods_dir = resolve_master_mods_dir(mods_root);
    let master_ui_dir = base_mods_dir.join("zzzzzz_ZZZModManagerUI");
    if !master_ui_dir.exists() {
        return;
    }

    if let Ok(entries) = fs::read_dir(&master_ui_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name.starts_with("zzzmanager_ui_") && file_name.ends_with(".txt") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if content.contains(&format!("Mod:   {}", clean_name))
                            || content.contains(&format!("Mod:   {}", crate::utils::get_mod_display_name(clean_name)))
                        {
                            let ini_path = path.with_extension("ini");
                            let _ = fs::remove_file(&path);
                            let _ = fs::remove_file(&ini_path);
                        }
                    }
                }
            }
        }
    }
}
