use crate::error::AppError;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, OnceLock, RwLock};
use crate::models::{KeybindInfo, HashTarget};

pub type HashAliasMap = std::collections::HashMap<String, Vec<HashTarget>>;
type CachedAliasEntry = (PathBuf, HashAliasMap);

/// In-memory cache for the hash alias map.
/// Keyed by canonical db file path to support users who switch databases.
/// Protected by RwLock so concurrent reads are lock-free in the hot path.
static HASH_ALIAS_CACHE: OnceLock<RwLock<Option<CachedAliasEntry>>> = OnceLock::new();

pub fn get_hash_alias_cache() -> &'static RwLock<Option<CachedAliasEntry>> {
    HASH_ALIAS_CACHE.get_or_init(|| RwLock::new(None))
}

/// Invalidates the hash alias map cache. Call this after a database sync/update.
pub fn invalidate_hash_alias_cache() {
    if let Ok(mut guard) = get_hash_alias_cache().write() {
        *guard = None;
    }
}

/// Known generic hashes shared across almost all characters in game (e.g. flat normal maps, blank textures)
pub const GENERIC_SHARED_HASHES: &[&str] = &[
    "ebac056e", // Default flat NormalMap texture shared across 56+ characters
    "d9a12c0a", // Default blank BC1_UNORM texture dumped by Catter/DBMT across multiple characters
    "c8da372a", // Common character outline texture
    "9d549887", // Common UI icon hash
    "5bbaca72", // Shared draw call trigger VB across multiple characters
    "12345678", // Common dummy/placeholder hash
    "00000000", // Null hash
    "ffffffff", // Placeholder hash
];

/// Returns true if a hash is a generic/global game asset (like the default normal map)
/// or is shared across 5 or more distinct characters in the database.
pub fn is_generic_shared_hash(hash: &str, hash_alias_map: &std::collections::HashMap<String, Vec<HashTarget>>) -> bool {
    let clean = hash.to_lowercase();
    if GENERIC_SHARED_HASHES.contains(&clean.as_str()) {
        return true;
    }
    if let Some(targets) = hash_alias_map.get(&clean) {
        let mut unique_chars = std::collections::HashSet::new();
        for t in targets {
            unique_chars.insert(&t.character_id);
        }
        if unique_chars.len() >= 5 {
            return true;
        }
    }
    false
}

/// 64-bit FNV-1a hash function for strings
pub fn fnv1a_hash(s: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// Helper to determine if a mod folder name indicates it is enabled.
pub fn is_mod_enabled(folder_name: &str) -> bool {
    !folder_name.starts_with("DISABLED ")
}

/// Helper to get the display name of a mod (strips the DISABLED prefix if present).
pub fn get_mod_display_name(folder_name: &str) -> String {
    if folder_name.starts_with("DISABLED ") {
        folder_name.strip_prefix("DISABLED ").unwrap_or(folder_name).to_string()
    } else {
        folder_name.to_string()
    }
}

/// Helper to calculate the toggled folder name.
pub fn get_toggled_folder_name(folder_name: &str, enable: bool) -> Option<String> {
    if enable {
        if folder_name.starts_with("DISABLED ") {
            Some(folder_name.strip_prefix("DISABLED ").unwrap_or(folder_name).to_string())
        } else {
            None // Already enabled
        }
    } else {
        if !folder_name.starts_with("DISABLED ") {
            Some(format!("DISABLED {}", folder_name))
        } else {
            None // Already disabled
        }
    }
}

/// Recursively removes the read-only attribute from all files and directories in `path`.
pub fn strip_readonly_recursive(path: &Path) {
    if let Ok(metadata) = path.metadata() {
        let mut permissions = metadata.permissions();
        if permissions.readonly() {
            #[allow(clippy::permissions_set_readonly_false)]
            permissions.set_readonly(false);
            let _ = fs::set_permissions(path, permissions);
        }
    }
    if path.is_dir() {
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.filter_map(Result::ok) {
                strip_readonly_recursive(&entry.path());
            }
        }
    }
}

/// Safely removes a file or directory tree on Windows, recursively stripping read-only
/// attributes and retrying with exponential backoff if a transient file lock is held.
pub fn safe_remove_dir_all(path: &Path) -> std::io::Result<()> {
    if !path.exists() {
        return Ok(());
    }
    // Fast path: direct attempt
    if fs::remove_dir_all(path).is_ok() {
        return Ok(());
    }

    // Strip read-only attributes which commonly block Windows deletions (error 5 Access Denied)
    strip_readonly_recursive(path);

    let mut attempts = 0;
    let delays = [50, 100, 250];
    loop {
        match fs::remove_dir_all(path) {
            Ok(()) => return Ok(()),
            Err(_e) if attempts < delays.len() => {
                std::thread::sleep(std::time::Duration::from_millis(delays[attempts]));
                attempts += 1;
            }
            Err(e) => return Err(e),
        }
    }
}

/// Safely renames a path with retry backoff against transient file locks (Windows Defender, Indexer).
pub fn safe_rename(from: &Path, to: &Path) -> std::io::Result<()> {
    if fs::rename(from, to).is_ok() {
        return Ok(());
    }
    let mut attempts = 0;
    let delays = [50, 100, 250];
    loop {
        match fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(_e) if attempts < delays.len() => {
                std::thread::sleep(std::time::Duration::from_millis(delays[attempts]));
                attempts += 1;
            }
            Err(e) => return Err(e),
        }
    }
}

/// Safely copies a file with retry backoff against transient file locks (Windows Defender, Indexer).
pub fn safe_copy_file(from: &Path, to: &Path) -> std::io::Result<u64> {
    if let Ok(bytes) = fs::copy(from, to) {
        return Ok(bytes);
    }
    let mut attempts = 0;
    let delays = [50, 100, 250];
    loop {
        match fs::copy(from, to) {
            Ok(bytes) => return Ok(bytes),
            Err(_e) if attempts < delays.len() => {
                std::thread::sleep(std::time::Duration::from_millis(delays[attempts]));
                attempts += 1;
            }
            Err(e) => return Err(e),
        }
    }
}


/// Helper to recursively find .ini files with a depth limit
pub fn find_ini_files(dir: &Path, out: &mut Vec<PathBuf>, depth: u8, max_depth: u8) {
    if depth > max_depth { return; }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
                let dir_upper = dir_name.to_ascii_uppercase();
                // Skip disabled directories, backup directories, and manager UI output directories (mirrors 3DMigoto exclude_recursive = DISABLED*)
                if dir_upper.starts_with("DISABLED")
                    || dir_upper.starts_with("DISABLE_")
                    || dir_name.eq_ignore_ascii_case("zzzzzz_ZZZModManagerUI")
                    || dir_name.eq_ignore_ascii_case("000_ZzzManager_UI")
                    || dir_upper.contains("BACKUP")
                {
                    continue;
                }
                find_ini_files(&path, out, depth + 1, max_depth);
            } else if path.is_file() && path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("ini")) {
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                let name_upper = name.to_ascii_uppercase();
                if !name_upper.starts_with("DISABLED")
                    && !name_upper.contains("DISABLE")
                    && !name_upper.contains("BACKUP")
                    && !name.starts_with("zzzmanager_ui_")
                {
                    out.push(path);
                }
            }
        }
    }
}

/// Represents an active (enabled) mod discovered in the directory structure.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ActiveModEntry {
    /// Category folder name (e.g. "Anby - Default Outfit", "Jane Doe", or "Global")
    pub category: String,
    /// Folder name of the mod (e.g. "Punk Outfit")
    pub folder_name: String,
    /// Full path to the mod folder
    pub mod_path: PathBuf,
    /// Discovered .ini files inside this mod (excluding UI generator and backup files)
    pub ini_files: Vec<PathBuf>,
    /// Pre-parsed AST of the .ini files (hashes, component mappings, and script warnings)
    pub parsed_inis: Vec<crate::models::ParsedIni>,
}

/// Discovers all active (enabled) mods and their .ini files in a single unified directory pass.
/// Supports both root Mods directories (with sub-tabs like Playable Characters/) and direct category directories.
pub fn discover_active_mods(root: &Path) -> Vec<ActiveModEntry> {
    if !root.exists() || !root.is_dir() {
        return Vec::new();
    }

    let mut category_paths: Vec<(String, PathBuf)> = Vec::new();
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.filter_map(Result::ok) {
            let p = entry.path();
            if !p.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            let is_library_tab = name == "Playable Characters"
                || name == "Bangboos"
                || name == "NPCs"
                || name == "UI"
                || name == "Other"
                || name == "Weapons"
                || name == "Custom";

            if is_library_tab {
                if let Ok(sub_entries) = fs::read_dir(&p) {
                    for sub_entry in sub_entries.filter_map(Result::ok) {
                        let sub_p = sub_entry.path();
                        if sub_p.is_dir() {
                            let cat_name = sub_entry.file_name().to_string_lossy().to_string();
                            category_paths.push((cat_name, sub_p));
                        }
                    }
                }
            } else if !name.starts_with('.') && !name.starts_with('_') && !name.contains("zzzzzz_ZZZModManagerUI") {
                category_paths.push((name, p));
            }
        }
    }

    use rayon::prelude::*;
    let mut results: Vec<ActiveModEntry> = category_paths
        .into_par_iter()
        .flat_map(|(cat_name, cat_path)| {
            let mut active_mods = Vec::new();
            if let Ok(mod_entries) = fs::read_dir(&cat_path) {
                for mod_entry in mod_entries.filter_map(Result::ok) {
                    let mod_path = mod_entry.path();
                    if !mod_path.is_dir() {
                        continue;
                    }

                    let folder_name = mod_entry.file_name().to_string_lossy().to_string();
                    if folder_name.starts_with("DISABLED ") || folder_name.starts_with("DISABLE_") {
                        continue;
                    }

                    let mut ini_files = Vec::new();
                    find_ini_files(&mod_path, &mut ini_files, 0, 10);

                    if !ini_files.is_empty() {
                        let mut parsed_inis = Vec::with_capacity(ini_files.len());
                        for ini_path in &ini_files {
                            let f_name = ini_path.file_name().unwrap_or_default().to_string_lossy();
                            if f_name.starts_with("zzzmanager_ui_") || f_name.starts_with("000_zzzmanager_ui_") {
                                continue;
                            }
                            if let Ok(content) = read_ini_to_string(ini_path) {
                                let rel_path = ini_path
                                    .strip_prefix(&mod_path)
                                    .unwrap_or(ini_path)
                                    .to_string_lossy()
                                    .replace('\\', "/");
                                let overrides = crate::conflict_scanner::extract_overrides_from_ini(&content, &rel_path);
                                let integrity_warnings = crate::warnings_scanner::analyze_ini_script_integrity(&content, &rel_path);
                                parsed_inis.push(crate::models::ParsedIni {
                                    path: ini_path.clone(),
                                    rel_path,
                                    overrides,
                                    integrity_warnings,
                                });
                            }
                        }

                        active_mods.push(ActiveModEntry {
                            category: cat_name.clone(),
                            folder_name,
                            mod_path,
                            ini_files,
                            parsed_inis,
                        });
                    }
                }
            }
            active_mods
        })
        .collect();

    // Support root folders that directly contain mod .ini files
    let mut direct_inis = Vec::new();
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.filter_map(Result::ok) {
            let p = entry.path();
            if p.is_file() && p.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("ini")) {
                let name = p.file_name().unwrap_or_default().to_string_lossy();
                if !name.starts_with("DISABLED") && !name.starts_with("zzzmanager_ui_") {
                    direct_inis.push(p);
                }
            }
        }
    }
    if !direct_inis.is_empty() {
        let mut parsed_inis = Vec::with_capacity(direct_inis.len());
        for ini_path in &direct_inis {
            if let Ok(content) = read_ini_to_string(ini_path) {
                let rel_path = ini_path
                    .strip_prefix(root)
                    .unwrap_or(ini_path)
                    .to_string_lossy()
                    .replace('\\', "/");
                let overrides = crate::conflict_scanner::extract_overrides_from_ini(&content, &rel_path);
                let integrity_warnings = crate::warnings_scanner::analyze_ini_script_integrity(&content, &rel_path);
                parsed_inis.push(crate::models::ParsedIni {
                    path: ini_path.clone(),
                    rel_path,
                    overrides,
                    integrity_warnings,
                });
            }
        }
        results.push(ActiveModEntry {
            category: "Direct".to_string(),
            folder_name: root.file_name().unwrap_or_default().to_string_lossy().to_string(),
            mod_path: root.to_path_buf(),
            ini_files: direct_inis,
            parsed_inis,
        });
    }

    results
}

/// Helper to safely backup a file before destructive operations
pub fn backup_file(file_path: &Path) {
    if let Some(file_name) = file_path.file_name() {
        let backup_name = format!("DISABLE_{}", file_name.to_string_lossy());
        let backup_path = file_path.with_file_name(backup_name);
        if !backup_path.exists() {
            let _ = fs::copy(file_path, &backup_path);
        }
    }
}

/// Helper to read an INI file correctly regardless of UTF-8 or UTF-16 encoding
pub fn read_ini_to_string(path: &Path) -> Result<String, AppError> {
    let bytes = fs::read(path)?;
    
    if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        let u16_slice: Vec<u16> = bytes[2..].as_chunks::<2>().0.iter().map(|&c| u16::from_le_bytes(c)).collect();
        return Ok(String::from_utf16_lossy(&u16_slice));
    }
    
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        let u16_slice: Vec<u16> = bytes[2..].as_chunks::<2>().0.iter().map(|&c| u16::from_be_bytes(c)).collect();
        return Ok(String::from_utf16_lossy(&u16_slice));
    }
    
    if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
        return Ok(String::from_utf8_lossy(&bytes[3..]).into_owned());
    }

    match String::from_utf8(bytes.clone()) {
        Ok(s) => Ok(s),
        Err(_) => {
            let u16_slice: Vec<u16> = bytes.as_chunks::<2>().0.iter().map(|&c| u16::from_le_bytes(c)).collect();
            Ok(String::from_utf16_lossy(&u16_slice))
        }
    }
}

/// Helper to parse 3DMigoto Keybinds from an INI string
pub fn parse_file_keybinds(path: &Path, file_name: &str) -> Result<Vec<KeybindInfo>, String> {
    let mut all_keybinds = Vec::new();
    if let Ok(content) = read_ini_to_string(path) {
        #[allow(unused_assignments)] let mut current_section = String::new();
        let mut current_bind: Option<KeybindInfo> = None;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with(';') { continue; }

            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                if let Some(mut bind) = current_bind.take() {
                    if !bind.keys.is_empty() || !bind.back_keys.is_empty() {
                        if bind.bind_type.is_empty() {
                            bind.bind_type = "toggle".to_string();
                        }
                        all_keybinds.push(bind);
                    }
                }

                current_section = trimmed[1..trimmed.len()-1].to_string();
                if current_section.to_lowercase().starts_with("key") {
                    current_bind = Some(KeybindInfo {
                        ini_file: file_name.to_string(),
                        section: current_section.clone(),
                        keys: Vec::new(),
                        back_keys: Vec::new(),
                        bind_type: String::new(),
                        condition: String::new(),
                        variables: Vec::new(),
                    });
                }
            } else if let Some(bind) = &mut current_bind {
                if let Some(parts) = trimmed.split_once('=') {
                    let key_part = parts.0.trim();
                    let val_part = parts.1.trim();
                    let lower_key = key_part.to_lowercase();
                    
                    if lower_key == "key" {
                        bind.keys.push(val_part.to_string());
                    } else if lower_key == "back" {
                        bind.back_keys.push(val_part.to_string());
                    } else if lower_key == "type" {
                        bind.bind_type = val_part.to_string();
                    } else if lower_key == "condition" {
                        bind.condition = val_part.to_string();
                    } else if key_part.starts_with('$') {
                        bind.variables.push(key_part.to_string());
                    }
                }
            }
        }
        
        if let Some(mut bind) = current_bind.take() {
            if !bind.keys.is_empty() || !bind.back_keys.is_empty() {
                if bind.bind_type.is_empty() {
                    bind.bind_type = "toggle".to_string();
                }
                all_keybinds.push(bind);
            }
        }
    }
    Ok(all_keybinds)
}

/// Traverses a character database (playable_characters.json, entitiesDB.json, database.json, or characters.json)
/// and maps every lowercase 8-hex hash to the character's category name (e.g., "Jane Doe").
/// Results are cached in memory keyed by the resolved db file path. Call `invalidate_hash_alias_cache()`
/// after a database sync to force a fresh parse on the next call.
pub fn build_hash_alias_map(db_path: &Path) -> std::collections::HashMap<String, Vec<HashTarget>> {
    let file_path = if db_path.is_file() {
        db_path.to_path_buf()
    } else if db_path.is_dir() {
        let candidates = [
            "playable_characters.json",
            "entitiesDB.json",
            "database.json",
            "characters.json",
        ];
        candidates
            .iter()
            .map(|c| db_path.join(c))
            .find(|p| p.is_file())
            .unwrap_or_else(|| db_path.join("playable_characters.json"))
    } else {
        db_path.to_path_buf()
    };

    // Fast path: return cached map if the db file path hasn't changed.
    if let Ok(guard) = get_hash_alias_cache().read() {
        if let Some((cached_path, cached_map)) = guard.as_ref() {
            if cached_path == &file_path {
                return cached_map.clone();
            }
        }
    }

    let mut map: std::collections::HashMap<String, Vec<HashTarget>> = std::collections::HashMap::new();

    if !file_path.exists() {
        return map;
    }

    let content = match fs::read_to_string(&file_path) {
        Ok(c) => c,
        Err(_) => return map,
    };

    let json_val: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return map,
    };

    let extract_clean_hash = |val: &serde_json::Value| -> Option<String> {
        let s = val.as_str()?;
        let trimmed = s.trim();
        let clean = trimmed
            .strip_prefix("0x")
            .or_else(|| trimmed.strip_prefix("0X"))
            .unwrap_or(trimmed)
            .to_lowercase();
        if clean.len() == 8 && clean.chars().all(|c| c.is_ascii_hexdigit()) {
            Some(clean)
        } else {
            None
        }
    };



    let mut characters = vec![];
    if let Some(arr) = json_val.as_array() {
        characters.extend(arr);
    } else if let Some(obj) = json_val.as_object() {
        if let Some(arr) = obj.get("playable_characters").and_then(|v| v.as_array()) {
            characters.extend(arr);
        }
        if let Some(arr) = obj.get("npcs").and_then(|v| v.as_array()) {
            characters.extend(arr);
        }
        if let Some(arr) = obj.get("characters").and_then(|v| v.as_array()) {
            characters.extend(arr);
        }
        if let Some(arr) = obj.get("entities").and_then(|v| v.as_array()) {
            characters.extend(arr);
        }
    }

    for char_obj in characters {
        let character_id = char_obj.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let character_name = char_obj.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let base_skin_id = char_obj.get("base_skin_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        
        if character_id.is_empty() || character_name.is_empty() { continue; }

        if let Some(skins) = char_obj.get("skins").and_then(|v| v.as_array()) {
            for skin in skins {
                let skin_id = skin.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let skin_name = skin.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                
                if skin_id.is_empty() || skin_name.is_empty() { continue; }

                let is_base_skin = (!base_skin_id.is_empty() && skin_id == base_skin_id)
                    || skin.get("aliases").and_then(|v| v.as_array()).is_some_and(|arr| {
                        arr.iter().any(|a| a.as_str().is_some_and(|s| s.eq_ignore_ascii_case("base") || s.eq_ignore_ascii_case("default")))
                    });

                let category_name = format!("{} - {}", character_name, skin_name);
                let target = HashTarget {
                    category_name,
                    character_id: character_id.clone(),
                    skin_id: skin_id.clone(),
                    match_type: None,
                    component_name: None,
                    is_base_skin,
                };

                if let Some(components) = skin.get("components").and_then(|v| v.as_object()) {
                    for (comp_name, comp) in components {
                        if let Some(h) = extract_clean_hash(comp) {
                            let mut t = target.clone();
                            t.component_name = Some(comp_name.clone());
                            t.match_type = Some("ib".to_string());
                            map.entry(h).or_default().push(t);
                        }
                        for field in ["draw_vb", "position_vb", "blend_vb", "texcoord_vb", "ib"] {
                            if let Some(h) = comp.get(field).and_then(&extract_clean_hash) {
                                let mut t = target.clone();
                                t.component_name = Some(comp_name.clone());
                                t.match_type = Some(field.to_string());
                                map.entry(h).or_default().push(t);
                            }
                        }
                        if let Some(textures) = comp.get("textures").and_then(|v| v.as_object()) {
                            for (tex_name, tex_val) in textures {
                                if let Some(h) = extract_clean_hash(tex_val) {
                                    let mut t = target.clone();
                                    t.component_name = Some(comp_name.clone());
                                    t.match_type = Some(format!("textures.{}", tex_name));
                                    map.entry(h).or_default().push(t);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Second pass: Ingest legacy migration rules so outdated mod hashes automatically map to their target character and skin
    let mig_val = json_val
        .get("hash_migrations")
        .or_else(|| json_val.get("rules"))
        .cloned()
        .or_else(|| {
            let candidates = [
                file_path.parent().map(|p| p.join("hash_migrations.json")),
                file_path.parent().map(|p| p.join("database.json")),
            ];
            for cand in candidates.into_iter().flatten() {
                if cand.exists() && cand != file_path {
                    if let Ok(c) = fs::read_to_string(&cand) {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&c) {
                            if let Some(m) = v.get("hash_migrations").or_else(|| v.get("rules")) {
                                return Some(m.clone());
                            } else if v.is_object() && v.get("rules").is_none() && v.get("characters").is_none() {
                                return Some(v);
                            }
                        }
                    }
                }
            }
            None
        });

    if let Some(mig) = mig_val {
        let rules_map = mig.get("rules").and_then(|v| v.as_object()).or_else(|| mig.as_object());

        if let Some(rules) = rules_map {
            // Build single-hop graph
            let mut forward_graph: std::collections::HashMap<String, String> = std::collections::HashMap::new();
            for (old_h, rule_obj) in rules {
                let clean_old = old_h.to_lowercase();
                if let Some(actions) = rule_obj.get("actions").and_then(|a| a.as_array()) {
                    for action in actions {
                        if action.get("type").and_then(|t| t.as_str()) == Some("update_hash") {
                            if let Some(new_h) = action.get("new_hash").and_then(|v| v.as_str()) {
                                let clean_new = new_h.to_lowercase();
                                if clean_new.len() == 8 && clean_new.chars().all(|c| c.is_ascii_hexdigit()) {
                                    forward_graph.insert(clean_old.clone(), clean_new);
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // Resolve terminal hash for each legacy hash and propagate HashTargets
            for old_h in forward_graph.keys() {
                let mut current = old_h.clone();
                let mut hops = 0;
                while let Some(next_h) = forward_graph.get(&current) {
                    if hops > 15 || next_h == &current {
                        break;
                    }
                    current = next_h.clone();
                    hops += 1;
                }

                if let Some(targets) = map.get(&current).cloned() {
                    let entry = map.entry(old_h.clone()).or_default();
                    for t in targets {
                        if !entry.iter().any(|existing| existing.skin_id == t.skin_id && existing.character_id == t.character_id) {
                            entry.push(t);
                        }
                    }
                }
            }
        }
    }

    // Store in cache for subsequent calls.
    if let Ok(mut guard) = get_hash_alias_cache().write() {
        *guard = Some((file_path, map.clone()));
    }

    map
}

/// Expands environment variables (e.g. `%appdata%`, `%USERPROFILE%`, `%LOCALAPPDATA%`, `$HOME`, `~`)
/// in path strings and trims surrounding quotes or whitespace.
pub fn expand_path(raw: &str) -> String {
    let mut trimmed = raw.trim();
    if trimmed.len() >= 2 && trimmed.starts_with('"') && trimmed.ends_with('"') {
        trimmed = trimmed[1..trimmed.len() - 1].trim();
    }

    let mut result = trimmed.to_string();

    // Match %VAR% (Windows environment variables)
    static ENV_REGEX: LazyLock<regex::Regex> =
        LazyLock::new(|| regex::Regex::new(r"%([^%]+)%").expect("Valid regex"));

    result = ENV_REGEX
        .replace_all(&result, |caps: &regex::Captures| {
            let var_name = &caps[1];
            if let Ok(val) = std::env::var(var_name) {
                val
            } else {
                let var_name_upper = var_name.to_uppercase();
                std::env::vars()
                    .find(|(k, _)| k.to_uppercase() == var_name_upper)
                    .map(|(_, v)| v)
                    .unwrap_or_else(|| caps[0].to_string())
            }
        })
        .to_string();

    // Support ~/ or ~\ expansion
    if result.starts_with("~/") || result.starts_with("~\\") || result == "~" {
        if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            result = format!("{}{}", home, &result[1..]);
        }
    }

    result
}

#[tauri::command]
pub fn expand_env_path(path: String) -> String {
    expand_path(&path)
}

/// Automatically cleans up stale duplicate installations (e.g. leftover AppData vs Program Files binaries)
/// when running as an official installed release build.
#[cfg(all(windows, not(debug_assertions)))]
pub fn cleanup_legacy_installations() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let current_exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return,
    };

    let current_dir = match current_exe.parent() {
        Some(p) => p.to_path_buf(),
        None => return,
    };

    // Guard: Never run from a development, target, or temporary build directory
    let current_dir_str = current_dir.to_string_lossy().to_lowercase();
    if current_dir_str.contains("target\\") || current_dir_str.contains("target/") || current_dir_str.contains(".cargo") {
        return;
    }

    let user_install_dir = std::env::var("LOCALAPPDATA")
        .map(|p| PathBuf::from(p).join("ZZZ Mod Hub"))
        .ok();

    // Only perform shortcut and legacy cleanup if we are actually running from the official installation directory
    let is_official_install = user_install_dir.as_ref().map_or(false, |dir| &current_dir == dir);
    if !is_official_install {
        return;
    }

    // 1. If running from AppData\Local (currentUser), try to remove stale legacy Program Files binary if permissions allow
    if let Ok(prog_files) = std::env::var("PROGRAMFILES") {
        let machine_install_dir = PathBuf::from(&prog_files).join("ZZZ Mod Hub");
        let machine_exe = machine_install_dir.join("zzzmodmanager-tauri.exe");

        if machine_exe.exists() {
            tracing::info!("Attempting to clean up stale machine-mode installation at {:?}", machine_exe);
            let _ = std::fs::remove_file(&machine_exe);
            let _ = std::fs::remove_file(machine_install_dir.join("uninstall.exe"));
        }
    }

    // 2. Fix desktop & start menu shortcuts if they point to an old or incorrect binary
    let current_exe_str = current_exe.to_string_lossy().to_string();
    let ps_script = format!(
        r#"$target = '{}'; $sh = New-Object -ComObject WScript.Shell; @("$env:USERPROFILE\Desktop\ZZZ Mod Hub.lnk", "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\ZZZ Mod Hub.lnk") | ForEach-Object {{ if (Test-Path $_) {{ try {{ $sc = $sh.CreateShortcut($_); if ($sc.TargetPath -ne $target) {{ $sc.TargetPath = $target; $sc.WorkingDirectory = [System.IO.Path]::GetDirectoryName($target); $sc.Save() }} }} catch {{}} }} }}"#,
        current_exe_str.replace('\'', "''")
    );

    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

#[cfg(any(not(windows), debug_assertions))]
pub fn cleanup_legacy_installations() {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_build_hash_alias_map() {
        let temp_dir = std::env::temp_dir().join("zzz_test_build_hash_map");
        let _ = fs::create_dir_all(&temp_dir);
        let json_file = temp_dir.join("playable_characters.json");

        let json_content = r#"{
            "playable_characters": [
                {
                    "id": "jane",
                    "name": "Jane Doe",
                    "skins": [
                        {
                            "id": "casual",
                            "name": "Casual",
                            "components": {
                                "Body": { "draw_vb": "e9b1d6f4", "ib": "0x11223344" },
                                "Hair": { "draw_vb": "55667788" }
                            }
                        }
                    ]
                },
                {
                    "id": "anby",
                    "name": "Anby",
                    "skins": [
                        {
                            "id": "base",
                            "name": "Base",
                            "components": {
                                "Body": { "textures": { "Diffuse": "9af848eb" } }
                            }
                        }
                    ]
                }
            ]
        }"#;

        let mut f = fs::File::create(&json_file).unwrap();
        f.write_all(json_content.as_bytes()).unwrap();

        let map = build_hash_alias_map(&temp_dir);
        assert_eq!(map.get("e9b1d6f4").unwrap()[0].category_name, "Jane Doe - Casual");
        assert_eq!(map.get("11223344").unwrap()[0].category_name, "Jane Doe - Casual");
        assert_eq!(map.get("55667788").unwrap()[0].category_name, "Jane Doe - Casual");
        assert_eq!(map.get("9af848eb").unwrap()[0].category_name, "Anby - Base");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_build_hash_alias_map_with_legacy_migrations() {
        let temp_dir = std::env::temp_dir().join("zzz_test_build_hash_map_mig");
        let _ = fs::create_dir_all(&temp_dir);
        let json_file = temp_dir.join("database.json");

        let json_content = r#"{
            "playable_characters": [
                {
                    "id": "belle",
                    "name": "Belle",
                    "skins": [
                        {
                            "id": "summer_skies",
                            "name": "Summer Skies",
                            "components": {
                                "Body": { "ib": "619c5c94" }
                            }
                        }
                    ]
                }
            ],
            "hash_migrations": {
                "rules": {
                    "43ed3c22": {
                        "actions": [
                            { "type": "update_hash", "new_hash": "619c5c94" }
                        ]
                    }
                }
            }
        }"#;

        let mut f = fs::File::create(&json_file).unwrap();
        f.write_all(json_content.as_bytes()).unwrap();

        let map = build_hash_alias_map(&temp_dir);
        // Modern hash
        assert_eq!(map.get("619c5c94").unwrap()[0].category_name, "Belle - Summer Skies");
        // Legacy hash automatically mapped via migration rule!
        assert_eq!(map.get("43ed3c22").unwrap()[0].category_name, "Belle - Summer Skies");

        let _ = safe_remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_safe_remove_dir_all_and_rename() {
        let temp_dir = std::env::temp_dir().join("zzz_test_safe_fs_ops");
        let _ = fs::create_dir_all(&temp_dir);
        let sub_file = temp_dir.join("test.txt");
        fs::write(&sub_file, "content").unwrap();

        // Mark file as readonly to test readonly stripping
        let mut perms = fs::metadata(&sub_file).unwrap().permissions();
        perms.set_readonly(true);
        fs::set_permissions(&sub_file, perms).unwrap();

        // Test safe_rename on the directory
        let renamed_dir = std::env::temp_dir().join("zzz_test_safe_fs_ops_renamed");
        let _ = safe_remove_dir_all(&renamed_dir);
        assert!(safe_rename(&temp_dir, &renamed_dir).is_ok());
        assert!(!temp_dir.exists());
        assert!(renamed_dir.exists());

        // Test safe_remove_dir_all succeeds even with readonly file inside
        assert!(safe_remove_dir_all(&renamed_dir).is_ok());
        assert!(!renamed_dir.exists());
    }

    #[test]
    fn test_expand_path_contract_invariants() {
        // Invariant 1: Quoted paths are unquoted cleanly
        assert_eq!(expand_path(r#""C:\Games\ZZZ""#), r#"C:\Games\ZZZ"#);
        assert_eq!(expand_path("   \"C:\\Games\\ZZZ\"   "), r#"C:\Games\ZZZ"#);

        // Invariant 2: Normal path without env vars is idempotent
        assert_eq!(expand_path(r#"C:\Games\ZZMI\Mods"#), r#"C:\Games\ZZMI\Mods"#);

        // Invariant 3: Case-insensitive %VAR% expansion
        if let Ok(appdata) = std::env::var("APPDATA") {
            let expected = format!(r"{}\XXMI Launcher\ZZMI\Mods", appdata);
            assert_eq!(expand_path(r"%appdata%\XXMI Launcher\ZZMI\Mods"), expected);
            assert_eq!(expand_path(r"%APPDATA%\XXMI Launcher\ZZMI\Mods"), expected);
            assert_eq!(expand_path(r"%AppData%\XXMI Launcher\ZZMI\Mods"), expected);
            assert_eq!(expand_path(r#""%appdata%\XXMI Launcher\ZZMI\Mods""#), expected);
        }

        // Invariant 4: Non-existent env vars are preserved without panic or corruption
        assert_eq!(
            expand_path(r"%NON_EXISTENT_VAR_XYZ123%\subfolder"),
            r"%NON_EXISTENT_VAR_XYZ123%\subfolder"
        );

        // Invariant 5: Empty and whitespace strings handled gracefully
        assert_eq!(expand_path(""), "");
        assert_eq!(expand_path("   "), "");
    }
}

