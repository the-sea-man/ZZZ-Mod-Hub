use crate::error::AppError;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tracing::{info, instrument};
use rayon::prelude::*;
use tauri::Manager;
use tokio::fs as async_fs;

use crate::models::{CategoryInfo, ModInfo};
use crate::utils::{is_mod_enabled, get_mod_display_name};

fn sanitize_path_slug(path: &str) -> String {
    let folder_name = Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "default".to_string());
    folder_name.to_lowercase().replace(' ', "_")
}

#[tauri::command]
#[instrument(skip(app))]
pub async fn scan_mods_folder(
    app: tauri::AppHandle,
    root_path: String,
    task_id: Option<String>,
) -> Result<Vec<CategoryInfo>, AppError> {
    let root_path = crate::utils::expand_path(&root_path);
    let t_id = task_id.unwrap_or_else(|| format!("scan:{}", root_path));
    let guard = crate::task_manager::register_task(&t_id, "scan");
    let cancel_token = guard.token();

    let root_clone = root_path.clone();
    let thumb_dir = app.path().app_data_dir().ok().map(|d| d.join("thumbnails"));
    let categories = tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        scan_mods_folder_sync_with_cancel(&root_clone, thumb_dir.as_deref(), Some(&cancel_token))
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))??;

    // Atomically persist to native per-tab disk cache in app_data_dir for sub-millisecond cold start hydration
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let _ = async_fs::create_dir_all(&app_data_dir).await;
        let slug = sanitize_path_slug(&root_path);
        let cache_file = app_data_dir.join(format!("library_cache_{}.json", slug));
        let tmp_file = app_data_dir.join(format!("library_cache_{}.json.tmp", slug));
        if let Ok(json_str) = serde_json::to_string(&categories) {
            if async_fs::write(&tmp_file, &json_str).await.is_ok() {
                let _ = async_fs::rename(&tmp_file, &cache_file).await;
            }
        }
    }

    // Non-destructively prewarm thumbnails in background Rayon threadpool for newly found mods
    let unheated_images: Vec<String> = categories
        .iter()
        .flat_map(|c| &c.mods)
        .filter_map(|m| {
            if m.thumbnail_url.is_none() {
                m.preview_url.clone()
            } else {
                None
            }
        })
        .collect();

    if !unheated_images.is_empty() {
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let _ = crate::thumbnail_cache::prewarm_thumbnails(unheated_images, app_handle).await;
        });
    }

    Ok(categories)
}

#[tauri::command]
#[instrument(skip(app))]
pub async fn get_cached_mods_folder(app: tauri::AppHandle, root_path: Option<String>) -> Result<Vec<CategoryInfo>, AppError> {
    let app_data_dir = app.path().app_data_dir()?;
    if let Some(ref path) = root_path {
        let expanded = crate::utils::expand_path(path);
        let slug = sanitize_path_slug(&expanded);
        let cache_file = app_data_dir.join(format!("library_cache_{}.json", slug));
        if cache_file.exists() {
            if let Ok(content) = async_fs::read_to_string(&cache_file).await {
                if let Ok(categories) = serde_json::from_str::<Vec<CategoryInfo>>(&content) {
                    return Ok(categories);
                }
            }
        }
    }

    // Fallback to generic library_cache.json if available
    let generic_cache = app_data_dir.join("library_cache.json");
    if generic_cache.exists() {
        if let Ok(content) = async_fs::read_to_string(&generic_cache).await {
            if let Ok(categories) = serde_json::from_str::<Vec<CategoryInfo>>(&content) {
                return Ok(categories);
            }
        }
    }
    Ok(Vec::new())
}

pub fn scan_mods_folder_sync(root_path: &str, thumb_dir: Option<&Path>) -> Result<Vec<CategoryInfo>, AppError> {
    scan_mods_folder_sync_with_cancel(root_path, thumb_dir, None)
}

pub fn scan_mods_folder_sync_with_cancel(
    root_path: &str,
    thumb_dir: Option<&Path>,
    cancel_token: Option<&Arc<AtomicBool>>,
) -> Result<Vec<CategoryInfo>, AppError> {
    let root_expanded = crate::utils::expand_path(root_path);
    info!("Scanning mods folder at: {}", root_expanded);
    let root = Path::new(&root_expanded);

    if !root.exists() || !root.is_dir() {
        // Gracefully return empty if the subfolder doesn't exist yet
        return Ok(Vec::new());
    }

    if let Some(token) = cancel_token {
        if token.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }
    }

    let entries = match fs::read_dir(root) {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()),
    };

    let cat_dirs: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .collect();

    let cancel_token_clone = cancel_token.cloned();
    let mut categories: Vec<CategoryInfo> = cat_dirs
        .into_par_iter()
        .filter_map(|path| {
            if let Some(ref token) = cancel_token_clone {
                if token.load(Ordering::Relaxed) {
                    return None;
                }
            }
            let category_name = path.file_name()?.to_string_lossy().to_string();
            let mut mods = Vec::new();

            if let Ok(mod_entries) = fs::read_dir(&path) {
                let mod_dirs: Vec<PathBuf> = mod_entries
                    .filter_map(Result::ok)
                    .map(|e| e.path())
                    .filter(|p| p.is_dir())
                    .collect();

                let mut mods_info: Vec<ModInfo> = mod_dirs
                    .into_par_iter()
                    .filter_map(|mod_path| {
                        let folder_name = mod_path.file_name()?.to_string_lossy().to_string();
                        let is_enabled = is_mod_enabled(&folder_name);
                        let display_name = get_mod_display_name(&folder_name);

                        let scan = scan_single_mod_dir(&mod_path);
                        let preview_url = scan.preview_url;
                        let meta_content = scan.meta_content;
                        let total_size_bytes = if scan.total_size_bytes > 0 {
                            Some(scan.total_size_bytes)
                        } else {
                            None
                        };

                        let mut meta = None;
                        if let Some(content) = meta_content {
                            if let Ok(mut parsed_meta) = serde_json::from_str::<crate::models::ModMeta>(&content) {
                                if parsed_meta.gb_mod_id.is_none() {
                                    if let Some(ref url) = parsed_meta.source_url {
                                        if let Some(id) = extract_gb_id_from_url(url) {
                                            parsed_meta.gb_mod_id = Some(id);
                                        }
                                    }
                                }
                                if parsed_meta.gb_mod_id.is_none() {
                                    if let Some(id) = scan.gb_id.or_else(|| find_gb_id_in_mod_folder(&mod_path)) {
                                        parsed_meta.gb_mod_id = Some(id);
                                        if parsed_meta.source_url.is_none() {
                                            parsed_meta.source_url = Some(format!("https://gamebanana.com/mods/{}", id));
                                        }
                                    }
                                }
                                meta = Some(parsed_meta);
                            }
                        } else if let Some(id) = scan.gb_id.or_else(|| find_gb_id_in_mod_folder(&mod_path)) {
                            meta = Some(crate::models::ModMeta {
                                gb_mod_id: Some(id),
                                downloaded_at: None,
                                author: None,
                                notes: None,
                                tags: None,
                                gb_last_updated: None,
                                source_url: Some(format!("https://gamebanana.com/mods/{}", id)),
                                original_file_name: None,
                            });
                        }

                        let thumbnail_url = if let (Some(ref prev), Some(td)) = (&preview_url, thumb_dir) {
                            let (thumb_path, _) = crate::thumbnail_cache::compute_thumbnail_path(td, prev);
                            if thumb_path.exists() {
                                Some(thumb_path.to_string_lossy().replace('\\', "/"))
                            } else {
                                None
                            }
                        } else {
                            None
                        };

                        Some(ModInfo {
                            name: display_name,
                            full_path: mod_path.to_string_lossy().replace('\\', "/"),
                            is_enabled,
                            preview_url,
                            thumbnail_url,
                            meta,
                            total_size_bytes,
                            has_backup: scan.has_backup,
                        })
                    })
                    .collect();

                mods_info.sort_by(|a, b| a.name.cmp(&b.name));
                mods = mods_info;
            }

            let mut character_id = None;
            let mut skin_id = None;
            let category_json_path = path.join("category.json");
            if let Ok(content) = fs::read_to_string(&category_json_path) {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(id) = parsed.get("character_id").and_then(|v| v.as_str()) {
                        character_id = Some(id.to_string());
                    }
                    if let Some(sid) = parsed.get("skin_id").and_then(|v| v.as_str()) {
                        skin_id = Some(sid.to_string());
                    }
                }
            }

            Some(CategoryInfo {
                category_name,
                character_id,
                skin_id,
                mods,
            })
        })
        .collect();

    if let Some(token) = cancel_token {
        if token.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }
    }

    categories.sort_by(|a, b| a.category_name.cmp(&b.category_name));

    Ok(categories)
}

use std::collections::{HashSet, HashMap};
use crate::models::BrokenModEntry;

#[allow(dead_code)]
#[derive(Clone, Debug)]
struct MigrationDetails {
    new_hash: String,
    character: String,
    component: Option<String>,
    version_from: String,
    version_to: String,
}

#[tauri::command]
pub fn scan_broken_mods(mods_path: String, app: tauri::AppHandle) -> Result<Vec<BrokenModEntry>, AppError> {
    let mut migrations: HashMap<String, MigrationDetails> = HashMap::new();

    // 1. Load database & migrations
    let mut db_json: Option<serde_json::Value> = None;
    let mut hash_alias_map = HashMap::new();
    
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        hash_alias_map = crate::utils::build_hash_alias_map(&app_data_dir);

        let migrations_path = app_data_dir.join("hash_migrations.json");
        if let Ok(content) = fs::read_to_string(&migrations_path) {
            db_json = serde_json::from_str(&content).ok();
        } else {
            let db_path = app_data_dir.join("database.json");
            if let Ok(content) = fs::read_to_string(&db_path) {
                db_json = serde_json::from_str(&content).ok();
            }
        }
    }
    let valid_hashes: HashSet<String> = hash_alias_map.keys().cloned().collect();

    // Process migrations
    let mut migration_list: Vec<serde_json::Value> = Vec::new();
    if let Some(ref db) = db_json {
        if let Some(arr) = db.get("migrations").and_then(|v| v.as_array()) {
            migration_list = arr.clone();
        } else if let Some(m_val) = db.get("hash_migrations") {
            if let Some(arr) = m_val.get("migrations").and_then(|v| v.as_array()) {
                migration_list = arr.clone();
            } else if let Some(arr) = m_val.as_array() {
                migration_list = arr.clone();
            } else if let Some(rules_obj) = m_val.get("rules").and_then(|v| v.as_object()) {
                for (old_h, rule) in rules_obj {
                    if let Some(actions) = rule.get("actions").and_then(|v| v.as_array()) {
                        for act in actions {
                            if let Some(new_h) = act.get("new_hash").and_then(|v| v.as_str()) {
                                migration_list.push(serde_json::json!({
                                    "old_hash": old_h,
                                    "new_hash": new_h,
                                    "character": rule.get("character").unwrap_or(&serde_json::Value::Null),
                                    "description": rule.get("description").unwrap_or(&serde_json::Value::Null),
                                    "version_from": rule.get("version_from").unwrap_or(&serde_json::Value::Null),
                                    "version_to": rule.get("version_to").unwrap_or(&serde_json::Value::Null)
                                }));
                            }
                        }
                    }
                }
            }
        } else if let Some(rules_obj) = db.get("rules").and_then(|v| v.as_object()) {
            for (old_h, rule) in rules_obj {
                if let Some(actions) = rule.get("actions").and_then(|v| v.as_array()) {
                    for act in actions {
                        if let Some(new_h) = act.get("new_hash").and_then(|v| v.as_str()) {
                            migration_list.push(serde_json::json!({
                                "old_hash": old_h,
                                "new_hash": new_h,
                                "character": rule.get("character").unwrap_or(&serde_json::Value::Null),
                                "description": rule.get("description").unwrap_or(&serde_json::Value::Null),
                                "version_from": rule.get("version_from").unwrap_or(&serde_json::Value::Null),
                                "version_to": rule.get("version_to").unwrap_or(&serde_json::Value::Null)
                            }));
                        }
                    }
                }
            }
        } else if let Some(arr) = db.as_array() {
            migration_list = arr.clone();
        }
    }

    for item in migration_list {
        if let (Some(old_h), Some(new_h)) = (
            item.get("old_hash").and_then(|v| v.as_str()),
            item.get("new_hash").and_then(|v| v.as_str()),
        ) {
            let character = item.get("character").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let component = item.get("component").and_then(|v| v.as_str()).map(|s| s.to_string());
            let version_from = item.get("version_from").and_then(|v| v.as_str()).unwrap_or("?").to_string();
            let version_to = item.get("version_to").and_then(|v| v.as_str()).unwrap_or("?").to_string();

            // Store new hash without 0x safely
            let clean_old = old_h.trim().strip_prefix("0x").or_else(|| old_h.trim().strip_prefix("0X")).unwrap_or(old_h.trim()).to_lowercase();
            let clean_new = new_h.trim().strip_prefix("0x").or_else(|| new_h.trim().strip_prefix("0X")).unwrap_or(new_h.trim()).to_lowercase();

            migrations.insert(
                clean_old,
                MigrationDetails {
                    new_hash: clean_new,
                    character,
                    component,
                    version_from,
                    version_to,
                },
            );
        }
    }

    // 2. Scan enabled mods
    let mut broken_entries = Vec::new();
    let mut seen_pairs: HashSet<(String, String)> = HashSet::new();

    let root = Path::new(&mods_path);
    if !root.exists() || !root.is_dir() {
        return Ok(broken_entries);
    }

    let active_mods = crate::utils::discover_active_mods(root);

    for entry in active_mods {
        if entry.category == "UI"
            || entry.category == "Unassigned"
            || entry.category.starts_with('_')
            || entry.category.starts_with('.')
            || entry.category.contains("zzzzzz_ZZZModManagerUI")
        {
            continue;
        }

        let display_name = get_mod_display_name(&entry.folder_name);

        for ini_file in entry.ini_files {
            if let Ok(content) = crate::utils::read_ini_to_string(&ini_file) {
                let rel_path = ini_file.strip_prefix(&entry.mod_path).unwrap_or(&ini_file).to_string_lossy().to_string();
                let overrides = crate::conflict_scanner::extract_overrides_from_ini(&content, &rel_path);

                for ov in overrides {
                    let hash = ov.hash.to_lowercase();
                    if valid_hashes.contains(&hash) {
                        continue;
                    }

                    // Skip generic shared textures (flat normals, common textures)
                    if crate::utils::is_generic_shared_hash(&hash, &hash_alias_map) {
                        continue;
                    }

                    let pair = (display_name.clone(), hash.clone());
                    if seen_pairs.contains(&pair) {
                        continue;
                    }
                    seen_pairs.insert(pair);

                    if let Some(info) = migrations.get(&hash) {
                        // Tier 1: Confirmed outdated mod with known replacement hash
                        broken_entries.push(BrokenModEntry {
                            category: entry.category.clone(),
                            mod_path: display_name.clone(),
                            file: Some(ov.file.clone()),
                            hash: hash.clone(),
                            component: info.component.clone(),
                            reason: format!("Outdated mod (game version {}->{})", info.version_from, info.version_to),
                            current_hash: Some(info.new_hash.clone()),
                            version_gap: Some(format!("{} -> {}", info.version_from, info.version_to)),
                        });
                    } else {
                        // Tier 2: Unverified hash inside character folder
                        broken_entries.push(BrokenModEntry {
                            category: entry.category.clone(),
                            mod_path: display_name.clone(),
                            file: Some(ov.file.clone()),
                            hash: hash.clone(),
                            component: Some(ov.component_name.clone()),
                            reason: format!("Unverified hash for {}", entry.category),
                            current_hash: None,
                            version_gap: None,
                        });
                    }
                }
            }
        }
    }

    Ok(broken_entries)
}

pub fn extract_gb_id_from_url(url: &str) -> Option<u64> {
    if let Some(pos) = url.find("gamebanana.com/mods/") {
        let sub = &url[pos + 20..];
        let digits: String = sub.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(id) = digits.parse::<u64>() {
            return Some(id);
        }
    }
    if let Some(pos) = url.find("gamebanana.com/apiv13/Mod/") {
        let sub = &url[pos + 26..];
        let digits: String = sub.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(id) = digits.parse::<u64>() {
            return Some(id);
        }
    }
    None
}

pub fn find_gb_id_in_mod_folder(mod_path: &Path) -> Option<u64> {
    // 1. Fast path: Check folder name in memory first (0ms)
    let folder_name = mod_path.file_name().unwrap_or_default().to_string_lossy();
    for part in folder_name.split(|c: char| !c.is_ascii_digit()) {
        if part.len() >= 5 && part.len() <= 7 {
            if let Ok(id) = part.parse::<u64>() {
                if (10000..=9999999).contains(&id)
                    && (folder_name.contains(&format!("[{}]", id))
                        || folder_name.contains(&format!("({})", id))
                        || folder_name.starts_with(&format!("{}-", id))
                        || folder_name.starts_with(&format!("{}_", id))
                        || folder_name.starts_with(&format!("{} ", id)))
                    {
                        return Some(id);
                    }
            }
        }
    }

    // 2. Fallback: Check only targeted small text files (e.g. mod.ini, readme.txt) limited to 4KB
    for candidate in &["mod.ini", "readme.txt", "desktop.ini"] {
        let candidate_path = mod_path.join(candidate);
        if candidate_path.is_file() {
            if let Ok(mut file) = fs::File::open(&candidate_path) {
                use std::io::Read;
                let mut buffer = [0u8; 4096];
                if let Ok(bytes_read) = file.read(&mut buffer) {
                    if let Ok(content) = std::str::from_utf8(&buffer[..bytes_read]) {
                        if let Some(id) = extract_gb_id_from_url(content) {
                            return Some(id);
                        }
                    }
                }
            }
        }
    }

    None
}

#[derive(Debug, Default)]
pub struct ModDirScanResult {
    pub total_size_bytes: u64,
    pub preview_url: Option<String>,
    pub meta_content: Option<String>,
    pub gb_id: Option<u64>,
    pub has_backup: bool,
}

/// Recursively scans a mod directory:
/// - Computes the accurate total size in bytes across all files and subdirectories.
/// - Finds preview images (preferring root with nested subfolder fallback).
/// - Reads .zmm-meta.json (preferring root with nested subfolder fallback).
/// - Extracts GameBanana ID from candidate files or folder name if present.
/// - Detects if any backup files (.bak / .disabled.bak) exist in the directory tree.
pub fn scan_single_mod_dir(mod_path: &Path) -> ModDirScanResult {
    let mut total_size_bytes: u64 = 0;
    let mut root_preview: Option<String> = None;
    let mut nested_preview: Option<String> = None;
    let mut root_meta: Option<String> = None;
    let mut nested_meta: Option<String> = None;
    let mut gb_id: Option<u64> = None;
    let mut has_backup = false;

    // 1. Fast path: Check folder name in memory first
    if let Some(folder_name) = mod_path.file_name().and_then(|f| f.to_str()) {
        for part in folder_name.split(|c: char| !c.is_ascii_digit()) {
            if part.len() >= 5 && part.len() <= 7 {
                if let Ok(id) = part.parse::<u64>() {
                    if (10000..=9999999).contains(&id)
                        && (folder_name.contains(&format!("[{}]", id))
                            || folder_name.contains(&format!("({})", id))
                            || folder_name.contains(&format!("- {}", id))
                            || folder_name.contains(&format!("{}-", id))
                            || folder_name.starts_with(&format!("{} -", id))
                            || folder_name.starts_with(&format!("{} ", id)))
                    {
                        gb_id = Some(id);
                        break;
                    }
                }
            }
        }
    }

    let mut stack = vec![(mod_path.to_path_buf(), 0usize)];
    let mut visited = std::collections::HashSet::new();
    visited.insert(mod_path.to_path_buf());
    const MAX_DEPTH: usize = 15;

    while let Some((current_dir, depth)) = stack.pop() {
        if let Ok(dir_iter) = fs::read_dir(&current_dir) {
            for entry in dir_iter.filter_map(Result::ok) {
                let file_type = match entry.file_type() {
                    Ok(ft) => ft,
                    Err(_) => continue,
                };

                if file_type.is_dir() {
                    if depth < MAX_DEPTH && !file_type.is_symlink() {
                        let path = entry.path();
                        if visited.insert(path.clone()) {
                            stack.push((path, depth + 1));
                        }
                    }
                } else if file_type.is_file() {
                    let fname_lossy = entry.file_name().to_string_lossy().to_string();
                    let fname_lower = fname_lossy.to_lowercase();

                    // Filter out OS metadata junk
                    if fname_lower == "thumbs.db" || fname_lower == "desktop.ini" || fname_lower == ".ds_store" {
                        continue;
                    }

                    if let Ok(meta) = entry.metadata() {
                        total_size_bytes += meta.len();
                    }

                    let is_preview = fname_lower == "preview.png"
                        || fname_lower == "preview.jpg"
                        || fname_lower == "preview.jpeg"
                        || fname_lower == "preview.webp";

                    if is_preview {
                        let path_str = entry.path().to_string_lossy().replace('\\', "/");
                        if depth == 0 {
                            if root_preview.is_none() {
                                root_preview = Some(path_str);
                            }
                        } else if nested_preview.is_none() {
                            nested_preview = Some(path_str);
                        }
                    }

                    if fname_lower == ".zmm-meta.json" {
                        if depth == 0 && root_meta.is_none() {
                            root_meta = fs::read_to_string(entry.path()).ok();
                        } else if nested_meta.is_none() {
                            nested_meta = fs::read_to_string(entry.path()).ok();
                        }
                    }

                    // Candidate GB ID text files
                    if gb_id.is_none() && (fname_lower == "mod.ini" || fname_lower == "readme.txt") {
                        if let Ok(mut file) = fs::File::open(entry.path()) {
                            use std::io::Read;
                            let mut buffer = [0u8; 4096];
                            if let Ok(bytes_read) = file.read(&mut buffer) {
                                if let Ok(content) = std::str::from_utf8(&buffer[..bytes_read]) {
                                    if let Some(id) = extract_gb_id_from_url(content) {
                                        gb_id = Some(id);
                                    }
                                }
                            }
                        }
                    }

                    if !has_backup && crate::services::mod_fixer::is_backup_file_name(&fname_lossy) {
                        has_backup = true;
                    }
                }
            }
        }
    }

    ModDirScanResult {
        total_size_bytes,
        preview_url: root_preview.or(nested_preview),
        meta_content: root_meta.or(nested_meta),
        gb_id,
        has_backup,
    }
}

/// Recursively computes the total size in bytes of a mod directory across all its subfolders.
#[allow(dead_code)]
pub fn compute_mod_dir_size(mod_path: &Path) -> u64 {
    scan_single_mod_dir(mod_path).total_size_bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_gb_id_from_url() {
        assert_eq!(
            extract_gb_id_from_url("https://gamebanana.com/mods/602064"),
            Some(602064)
        );
        assert_eq!(
            extract_gb_id_from_url("https://gamebanana.com/mods/602064#description"),
            Some(602064)
        );
        assert_eq!(
            extract_gb_id_from_url("https://gamebanana.com/apiv13/Mod/606533/ProfilePage"),
            Some(606533)
        );
        assert_eq!(extract_gb_id_from_url("https://google.com"), None);
    }

    #[test]
    fn test_find_gb_id_in_folder_name() {
        let path = Path::new("C:/Mods/Ellen/[602064] Bakery Ellen");
        assert_eq!(find_gb_id_in_mod_folder(path), Some(602064));

        let path2 = Path::new("C:/Mods/Ellen/602064 - Bakery Ellen");
        assert_eq!(find_gb_id_in_mod_folder(path2), Some(602064));
    }

    #[test]
    fn test_compute_mod_dir_size_with_subdirectories() {
        let temp_dir = std::env::temp_dir().join("zmm_test_mod_size_dir");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        // 1. Root ini file (100 bytes)
        fs::write(temp_dir.join("mod.ini"), vec![b'a'; 100]).unwrap();

        // 2. Subfolder Texture2D (500 bytes)
        let tex_dir = temp_dir.join("Texture2D");
        fs::create_dir_all(&tex_dir).unwrap();
        fs::write(tex_dir.join("diffuse.dds"), vec![b'b'; 500]).unwrap();

        // 3. Nested subfolder Buffer/SubBuffer (1400 bytes)
        let buf_dir = temp_dir.join("Buffer").join("SubBuffer");
        fs::create_dir_all(&buf_dir).unwrap();
        fs::write(buf_dir.join("mesh.buf"), vec![b'c'; 1400]).unwrap();

        // 4. Ignored system file (desktop.ini)
        fs::write(temp_dir.join("desktop.ini"), vec![b'z'; 50]).unwrap();

        let total = compute_mod_dir_size(&temp_dir);
        assert_eq!(total, 100 + 500 + 1400);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_compute_mod_dir_size_with_nested_duplicate_folders() {
        let temp_dir = std::env::temp_dir().join("zmm_test_nested_mod_size_dir");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        // Outer folder only has readme.txt of 192 bytes
        fs::write(temp_dir.join("readme.txt"), vec![b'a'; 192]).unwrap();

        // Inner nested folder of same name has 5 MB of textures and meshes
        let inner_dir = temp_dir.join("NestedModFolder");
        fs::create_dir_all(&inner_dir).unwrap();
        fs::write(inner_dir.join("texture.dds"), vec![b'b'; 5_000_000]).unwrap();
        fs::write(inner_dir.join("preview.png"), vec![b'c'; 50_000]).unwrap();

        let scan = scan_single_mod_dir(&temp_dir);
        assert_eq!(scan.total_size_bytes, 192 + 5_000_000 + 50_000);
        assert!(scan.preview_url.is_some());
        assert!(scan.preview_url.unwrap().ends_with("preview.png"));

        let _ = fs::remove_dir_all(&temp_dir);
    }
}

