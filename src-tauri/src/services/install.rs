//! Mod installation, category auto-assignment, and extraction.

pub mod types;
pub mod extractor;
pub mod classifier;
pub mod tagger;

#[cfg(test)]
mod tests;

pub use types::*;
pub use extractor::*;
pub use classifier::*;
pub use tagger::*;

use crate::error::AppError;
use crate::models::{Confidence, InstallResult};
use crate::utils::{build_hash_alias_map, safe_rename, safe_remove_dir_all};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::Manager;

/// Helper to determine whether a folder name is generic and uninformative.
pub fn is_generic_mod_folder_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    let trimmed = lower.trim();
    matches!(
        trimmed,
        "mod"
            | "mods"
            | "release"
            | "releases"
            | "build"
            | "export"
            | "files"
            | "output"
            | "content"
            | "zzz"
            | "zzzmod"
    ) || (trimmed.starts_with('v')
        && trimmed[1..]
            .chars()
            .all(|c| c.is_ascii_digit() || c == '.'))
}

/// Finds the canonical mod root directory inside a staging directory, unwrapping redundant single-directory nesting.
pub fn find_mod_content_root(staging_dir: &Path) -> (std::path::PathBuf, bool) {
    let mut current = staging_dir.to_path_buf();
    let mut unwrapped = false;

    loop {
        let mut subdirs = Vec::new();
        let mut files = Vec::new();

        if let Ok(entries) = fs::read_dir(&current) {
            for entry in entries.filter_map(Result::ok) {
                let p = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                if name == ".DS_Store" || name == "Thumbs.db" {
                    continue;
                }
                if p.is_dir() {
                    subdirs.push(p);
                } else {
                    files.push(p);
                }
            }
        }

        // If this level already has mod files (.ini, .buf, .dds, .ib) or multiple subdirectories, stop here
        let has_mod_files = files.iter().any(|f| {
            let ext = f.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            ext == "ini" || ext == "buf" || ext == "dds" || ext == "ib"
        });

        if has_mod_files || subdirs.len() != 1 {
            break;
        }

        // If there's 1 subdirectory and any loose files are non-mod files (e.g. readme.txt, url, images), unwrap into it
        let only_trivial_loose_files = files.iter().all(|f| {
            let ext = f.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            ext == "txt" || ext == "md" || ext == "url" || ext == "png" || ext == "jpg"
        });

        if only_trivial_loose_files {
            current = subdirs.remove(0);
            unwrapped = true;
        } else {
            break;
        }
    }

    (current, unwrapped)
}

#[tauri::command]
pub fn generate_character_folders(root_path: String, folders: Vec<GenerateFolderRequest>) -> Result<Vec<String>, AppError> {
    let root_expanded = crate::utils::expand_path(&root_path);
    let root = Path::new(&root_expanded);
    if !root.exists() {
        if let Err(e) = fs::create_dir_all(root) {
            return Err(AppError::Custom(format!("Failed to create category folder: {}", e)));
        }
    }

    let mut created = Vec::new();
    for req in folders {
        let safe_name = req.folder_name.replace(|c: char| c.is_ascii_control() || c == '/' || c == '\\' || c == ':' || c == '*' || c == '?' || c == '"' || c == '<' || c == '>' || c == '|', "_");
        let dir_path = root.join(&safe_name);
        
        if !dir_path.exists() && fs::create_dir_all(&dir_path).is_ok() {
            let json_path = dir_path.join("category.json");
            let mut map = serde_json::Map::new();
            map.insert("character_id".to_string(), serde_json::Value::String(req.character_id));
            if let Some(sid) = req.skin_id {
                map.insert("skin_id".to_string(), serde_json::Value::String(sid));
            }
            let content = serde_json::Value::Object(map);
            let _ = fs::write(&json_path, serde_json::to_string_pretty(&content).unwrap_or_default());
            created.push(safe_name);
        }
    }

    Ok(created)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn install_mods(
    app: tauri::AppHandle,
    archive_paths: Vec<String>,
    root_path: String,
    winrar_path: String,
    override_category: Option<String>,
    gb_mod_id: Option<u64>,
    author: Option<String>,
    source_url: Option<String>,
    gb_last_updated: Option<u64>,
    original_file_name: Option<String>,
) -> Result<Vec<InstallResult>, AppError> {
    let root_expanded = crate::utils::expand_path(&root_path);
    let winrar_path = crate::utils::expand_path(&winrar_path);
    let mut results = Vec::new();
    let root = Path::new(&root_expanded);

    let mut hash_alias_map = HashMap::new();
    if let Ok(app_dir) = app.path().app_data_dir() {
        hash_alias_map = build_hash_alias_map(&app_dir);
    }
    
    let staging_dir = root.join(".staging");
    if !staging_dir.exists() {
        let _ = fs::create_dir_all(&staging_dir);
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = std::process::Command::new("attrib");
        cmd.arg("+h")
            .arg(staging_dir.to_string_lossy().to_string())
            .creation_flags(CREATE_NO_WINDOW);
        let _ = cmd.output();
    }

    for archive_path_str in archive_paths {
        let archive_path = Path::new(&archive_path_str);
        if !archive_path.exists() {
            continue;
        }

        let archive_file_name = archive_path.file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
            
        let ext = archive_path.extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase();
            
        use rand::Rng;
        let temp_id: String = rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(8)
            .map(char::from)
            .map(|c| c.to_ascii_lowercase())
            .collect();
            
        let temp_extract_path = staging_dir.join(&temp_id);
        let _ = fs::create_dir_all(&temp_extract_path);

        let mut extraction_success = false;

        if ext == "zip" {
            if let Ok(file) = fs::File::open(archive_path) {
                let reader = std::io::BufReader::new(file);
                if let Ok(mut archive) = zip::ZipArchive::new(reader) {
                    let mut has_err = false;
                    for i in 0..archive.len() {
                        match archive.by_index(i) {
                            Ok(mut file) => {
                                let outpath = match file.enclosed_name() {
                                    Some(path) => temp_extract_path.join(path),
                                    None => continue,
                                };
                                if (*file.name()).ends_with('/') {
                                    let _ = fs::create_dir_all(&outpath);
                                } else {
                                    if let Some(p) = outpath.parent() {
                                        let _ = fs::create_dir_all(p);
                                    }
                                    if let Ok(outfile) = fs::File::create(&outpath) {
                                        let mut writer = std::io::BufWriter::new(outfile);
                                        let _ = std::io::copy(&mut file, &mut writer);
                                    }
                                }
                            }
                            Err(e) => {
                                let err_str = e.to_string().to_lowercase();
                                if err_str.contains("password") || err_str.contains("encrypt") {
                                    let _ = safe_remove_dir_all(&temp_extract_path);
                                    return Err(AppError::PasswordProtected(archive_file_name));
                                }
                                has_err = true;
                            }
                        }
                    }
                    if !has_err {
                        extraction_success = true;
                    }
                }
            }
        } else if ext == "rar" || ext == "7z" {
            if let Some((tool_path, tool_type)) = find_archive_tool(&winrar_path) {
                match extract_rar_or_7z(archive_path, &temp_extract_path, &tool_path, tool_type) {
                    Ok(()) => {
                        extraction_success = true;
                    }
                    Err(AppError::PasswordProtected(name)) => {
                        let _ = safe_remove_dir_all(&temp_extract_path);
                        return Err(AppError::PasswordProtected(name));
                    }
                    Err(e) => {
                        eprintln!("Extraction failed for {}: {:?}", archive_file_name, e);
                    }
                }
            } else {
                let _ = safe_remove_dir_all(&temp_extract_path);
                return Err(AppError::Custom(
                    "WinRAR or 7-Zip is required to install .rar or .7z files! Please install WinRAR or 7-Zip, or configure the path in Settings.".into(),
                ));
            }
        }
        
        if !extraction_success {
            let _ = safe_remove_dir_all(&temp_extract_path);
            continue;
        }

        // Unwrap redundant single-child nested directories (e.g. Archive/Release/Mod/Jane.ini)
        let (content_root, unwrapped) = find_mod_content_root(&temp_extract_path);

        let mut extracted_folder_name = if unwrapped {
            let folder_name = content_root
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            if is_generic_mod_folder_name(&folder_name) {
                archive_file_name.clone()
            } else {
                folder_name
            }
        } else {
            archive_file_name.clone()
        };

        // Determine mod category strictly by hash scanning
        let match_result = determine_mod_category(&content_root, &hash_alias_map)
            .or_else(|| determine_mod_category(&temp_extract_path, &hash_alias_map));

        let (mut target_category, char_id_opt, skin_id_opt) = if let Some(ref override_cat) = override_category {
            // Respect user or pre-flight modal selection unconditionally
            let (cid, sid) = if let Some(ref m) = match_result {
                (m.character_id.clone(), m.skin_id.clone())
            } else {
                (None, None)
            };
            (override_cat.clone(), cid, sid)
        } else {
            // Auto-detect character strictly from 3DMigoto hashes (no name guessing)
            match match_result {
                Some(ref m) if m.confidence >= Confidence::Medium && m.category_name != "Multi-Character" => {
                    (m.category_name.clone(), m.character_id.clone(), m.skin_id.clone())
                }
                _ => ("Unassigned".to_string(), None, None),
            }
        };

        let mut final_category_path = root.join(&target_category);
        if !final_category_path.exists() {
            let _ = fs::create_dir_all(&final_category_path);
        }

        if let (Some(cid), Some(sid)) = (char_id_opt, skin_id_opt) {
            let cat_json_path = final_category_path.join("category.json");
            if !cat_json_path.exists() && !cid.is_empty() {
                let json_data = serde_json::json!({
                    "character_id": cid,
                    "skin_id": sid
                });
                let _ = fs::write(cat_json_path, json_data.to_string());
            }
        }

        // Collision detection
        let mut is_conflict = false;
        let base_folder_name = extracted_folder_name
            .strip_prefix("DISABLED ")
            .unwrap_or(&extracted_folder_name)
            .to_string();

        if final_category_path.join(&base_folder_name).exists() 
            || final_category_path.join(format!("DISABLED {}", base_folder_name)).exists() 
        {
            is_conflict = true;
            target_category = "_Conflicts".to_string();
            final_category_path = root.join(&target_category);
            let _ = fs::create_dir_all(&final_category_path);
            
            loop {
                let rand_str: String = rand::thread_rng()
                    .sample_iter(&rand::distributions::Alphanumeric)
                    .take(6)
                    .map(char::from)
                    .map(|c| c.to_ascii_lowercase())
                    .collect();
                let candidate_name = format!("DISABLED {}_conflict_{}", base_folder_name, rand_str);
                if !final_category_path.join(&candidate_name).exists() {
                    extracted_folder_name = candidate_name;
                    break;
                }
            }
        } else {
            extracted_folder_name = base_folder_name;
        }

        let final_path = final_category_path.join(&extracted_folder_name);
        
        let source_path = content_root;
        let is_same_as_staging = source_path == temp_extract_path;
        
        let move_result = safe_rename(&source_path, &final_path);
        
        if !is_same_as_staging {
            let _ = safe_remove_dir_all(&temp_extract_path);
        }

        if move_result.is_ok() {
            let now_secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let downloaded_at = Some(now_secs.to_string());

            let auto_tags = detect_mod_auto_tags(&final_path, &target_category, false);
            let tags = if auto_tags.is_empty() { None } else { Some(auto_tags) };

            let meta = crate::models::ModMeta {
                gb_mod_id,
                downloaded_at: downloaded_at.clone(),
                author: author.clone(),
                notes: None,
                tags,
                gb_last_updated,
                source_url: source_url.clone(),
                original_file_name: original_file_name.clone(),
            };
            if let Ok(meta_json) = serde_json::to_string_pretty(&meta) {
                let _ = fs::write(final_path.join(".zmm-meta.json"), meta_json);
            }

            results.push(InstallResult {
                original_zip: archive_file_name,
                extracted_folder_name,
                category: target_category.clone(),
                full_path: final_path.to_string_lossy().to_string(),
                is_conflict,
                downloaded_at,
                gb_mod_id,
            });
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn auto_assign_mods(app: tauri::AppHandle, root_path: String) -> Result<Vec<String>, AppError> {
    let root_path = crate::utils::expand_path(&root_path);
    tauri::async_runtime::spawn_blocking(move || {
        let unassigned_path = Path::new(&root_path).join("Unassigned");
        if !unassigned_path.exists() {
            return Ok(vec![]);
        }

        let mut hash_alias_map = HashMap::new();
        if let Ok(app_dir) = app.path().app_data_dir() {
            hash_alias_map = build_hash_alias_map(&app_dir);
        }

        let mut results = Vec::new();

        let mod_entries = match fs::read_dir(&unassigned_path) {
            Ok(entries) => entries,
            Err(_) => return Ok(vec![]),
        };

        for mod_entry in mod_entries.filter_map(Result::ok) {
            let mod_path = mod_entry.path();
            if !mod_path.is_dir() {
                continue;
            }

            let folder_name = mod_entry.file_name().to_string_lossy().to_string();

            match determine_mod_category(&mod_path, &hash_alias_map) {
                Some(m) => {
                    if m.category_name == "Multi-Character" {
                        results.push(format!("Skipped '{}' (Conflict: matches multiple characters)", folder_name));
                    } else if m.confidence >= Confidence::Medium && m.category_name != "Unassigned" {
                        let cat_path = Path::new(&root_path).join(&m.category_name);
                        if let Some(ref cid) = m.character_id {
                            if !cat_path.exists() {
                                let _ = fs::create_dir_all(&cat_path);
                            }
                            let cat_json_path = cat_path.join("category.json");
                            if !cat_json_path.exists() && !cid.is_empty() {
                                let json_data = serde_json::json!({
                                    "character_id": cid,
                                    "skin_id": m.skin_id
                                });
                                let _ = fs::write(cat_json_path, json_data.to_string());
                            }
                        }

                        match crate::fs_ops::move_mod_to_category(
                            mod_path.to_string_lossy().to_string(),
                            m.category_name.clone(),
                            root_path.clone(),
                        ) {
                            Ok(_) => {
                                results.push(format!(
                                    "Moved '{}' to '{}' ({} confidence)",
                                    folder_name, m.category_name, m.confidence
                                ));
                            }
                            Err(e) => {
                                results.push(format!("Failed to move '{}': {:?}", folder_name, e));
                            }
                        }
                    }
                }
                None => {
                    // Leaves it safely in Unassigned
                }
            }
        }

        Ok(results)
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}
