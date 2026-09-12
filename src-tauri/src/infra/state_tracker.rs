use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use crate::error::AppError;

/// Path to the persisted mod state cache in the app or mod root
fn get_state_cache_file(mods_root: &Path) -> PathBuf {
    mods_root.join(".zzz_d3dx_state_cache.json")
}

/// Extracts namespace from an INI file if defined (e.g. `namespace = meili0214`)
pub fn extract_ini_namespace(ini_path: &Path) -> Option<String> {
    if let Ok(content) = crate::utils::read_ini_to_string(ini_path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with(';') || trimmed.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = trimmed.split_once('=') {
                if k.trim().eq_ignore_ascii_case("namespace") {
                    let ns = v.trim().trim_matches('"').trim().to_string();
                    if !ns.is_empty() {
                        return Some(ns);
                    }
                }
            }
        }
    }
    None
}

/// Reads the entire d3dx_user.ini into a map of SectionName -> (VarName -> Value)
pub fn read_d3dx_user_ini(d3dx_path: &Path) -> HashMap<String, HashMap<String, String>> {
    let mut sections: HashMap<String, HashMap<String, String>> = HashMap::new();
    if !d3dx_path.exists() {
        return sections;
    }

    if let Ok(content) = crate::utils::read_ini_to_string(d3dx_path) {
        let mut current_sec: Option<String> = None;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with(';') || trimmed.starts_with('#') || trimmed.is_empty() {
                continue;
            }

            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                let sec_name = trimmed[1..trimmed.len() - 1].trim().to_string();
                current_sec = Some(sec_name);
            } else if let Some(ref sec) = current_sec {
                if let Some((k, v)) = trimmed.split_once('=') {
                    let k_trim = k.trim().to_string();
                    let v_trim = v.trim().to_string();
                    sections.entry(sec.clone()).or_default().insert(k_trim, v_trim);
                }
            }
        }
    }

    sections
}

/// Writes sections back out to d3dx_user.ini
pub fn write_d3dx_user_ini(d3dx_path: &Path, sections: &HashMap<String, HashMap<String, String>>) -> Result<(), AppError> {
    let mut lines = Vec::new();

    // Sort section names for deterministic output
    let mut sorted_keys: Vec<&String> = sections.keys().collect();
    sorted_keys.sort();

    for sec in sorted_keys {
        lines.push(format!("[{}]", sec));
        if let Some(vars) = sections.get(sec) {
            let mut var_keys: Vec<&String> = vars.keys().collect();
            var_keys.sort();
            for k in var_keys {
                lines.push(format!("{} = {}", k, vars[k]));
            }
        }
        lines.push("".to_string());
    }

    let out = lines.join("\r\n");
    fs::write(d3dx_path, out)?;
    Ok(())
}

/// Reads saved mod states from .zzz_d3dx_state_cache.json
pub fn load_state_cache(mods_root: &Path) -> HashMap<String, HashMap<String, String>> {
    let cache_file = get_state_cache_file(mods_root);
    if cache_file.exists() {
        if let Ok(data) = fs::read_to_string(&cache_file) {
            if let Ok(map) = serde_json::from_str::<HashMap<String, HashMap<String, String>>>(&data) {
                return map;
            }
        }
    }
    HashMap::new()
}

/// Saves mod states to .zzz_d3dx_state_cache.json
pub fn save_state_cache(mods_root: &Path, cache: &HashMap<String, HashMap<String, String>>) {
    let cache_file = get_state_cache_file(mods_root);
    if let Ok(json) = serde_json::to_string_pretty(cache) {
        let _ = fs::write(cache_file, json);
    }
}

/// Finds the root 'Mods' directory from any nested mod path
pub fn find_mods_root(start_path: &Path) -> PathBuf {
    let mut current = start_path.to_path_buf();
    while let Some(parent) = current.parent() {
        if current.file_name().is_some_and(|n| n.to_string_lossy().eq_ignore_ascii_case("mods")) {
            return current;
        }
        if parent.join("d3d11.dll").exists() || parent.join("d3dx_user.ini").exists() || parent.join("d3dx.ini").exists() {
            return current;
        }
        current = parent.to_path_buf();
    }
    start_path.to_path_buf()
}

/// Finds the d3dx_user.ini file given a mods directory
pub fn find_d3dx_user_ini(mods_root: &Path) -> Option<PathBuf> {
    // Usually located in parent of Mods directory (ZZMI root)
    if let Some(parent) = mods_root.parent() {
        let d3dx = parent.join("d3dx_user.ini");
        if d3dx.exists() || parent.join("d3d11.dll").exists() || parent.join("d3dx.ini").exists() {
            return Some(d3dx);
        }
    }
    // Fallback: check inside mods_root or current dir
    let direct = mods_root.join("d3dx_user.ini");
    if direct.exists() {
        return Some(direct);
    }
    None
}

/// Backs up a mod's persist variables before it is disabled
pub fn backup_mod_state(mods_root: &Path, mod_path: &Path, mod_folder_name: &str) {
    if let Some(d3dx_path) = find_d3dx_user_ini(mods_root) {
        let sections = read_d3dx_user_ini(&d3dx_path);
        let mut cache = load_state_cache(mods_root);

        let clean_name = mod_folder_name.strip_prefix("DISABLED ").unwrap_or(mod_folder_name);
        let clean_name_low = clean_name.to_lowercase();

        // 1. Discover all INIs, namespaces, and relative paths inside this mod
        let mut mod_inis = Vec::new();
        crate::utils::find_ini_files(mod_path, &mut mod_inis, 0, 15);
        let mut namespaces: Vec<String> = Vec::new();
        let mut ini_rel_paths: Vec<String> = Vec::new();

        for ini in &mod_inis {
            if let Some(ns) = extract_ini_namespace(ini) {
                namespaces.push(ns.to_lowercase());
            }
            if let Some(parent) = mods_root.parent() {
                if let Ok(rel) = ini.strip_prefix(parent) {
                    let rel_norm = rel.to_string_lossy().replace('/', "\\").to_lowercase();
                    ini_rel_paths.push(rel_norm);
                }
            }
        }

        let mod_cache = cache.entry(clean_name.to_string()).or_default();

        // 2. Scan all sections in d3dx_user.ini
        for (sec_name, vars) in &sections {
            let sec_low = sec_name.to_lowercase();
            if sec_low == "constants" {
                for (k, v) in vars {
                    let k_norm = k.replace('/', "\\").to_lowercase();

                    // Check namespace match: $\<namespace>\<var>
                    let mut matched = false;
                    for ns in &namespaces {
                        let prefix = format!("$\\{}\\", ns);
                        if k_norm.starts_with(&prefix) {
                            let var_part = &k_norm[prefix.len()..];
                            let clean_var = var_part.trim_start_matches('$');
                            mod_cache.insert(format!("${}", clean_var), v.clone());
                            mod_cache.insert(k.clone(), v.clone());
                            matched = true;
                            break;
                        }
                    }
                    if matched {
                        continue;
                    }

                    // Check relative INI path match: $\<rel_path>\<var>
                    for ini_rel in &ini_rel_paths {
                        let prefix = format!("$\\{}\\", ini_rel);
                        if k_norm.starts_with(&prefix) {
                            let var_part = &k_norm[prefix.len()..];
                            let clean_var = var_part.trim_start_matches('$');
                            mod_cache.insert(format!("${}", clean_var), v.clone());
                            mod_cache.insert(k.clone(), v.clone());
                            matched = true;
                            break;
                        }
                    }
                    if matched {
                        continue;
                    }

                    // Fallback check: does key contain clean mod folder name?
                    if k_norm.contains(&format!("\\{}\\", clean_name_low))
                        || k_norm.contains(&format!("/{}/", clean_name_low))
                        || k_norm.contains(&clean_name_low)
                    {
                        let var_part = k_norm.rsplit('\\').next().unwrap_or(&k_norm);
                        let clean_var = var_part.trim_start_matches('$');
                        mod_cache.insert(format!("${}", clean_var), v.clone());
                        mod_cache.insert(k.clone(), v.clone());
                    }
                }
            } else {
                // Section-based match (GIMI / legacy format)
                let norm_sec = sec_name.replace('\\', "/").to_lowercase();
                if norm_sec.contains(&format!("/{}/", clean_name_low))
                    || norm_sec.ends_with(&format!("/{}", clean_name_low))
                    || norm_sec.contains(&clean_name_low)
                {
                    for (k, v) in vars {
                        let clean_var = k.trim_start_matches('$');
                        mod_cache.insert(format!("${}", clean_var), v.clone());
                    }
                }
            }
        }

        save_state_cache(mods_root, &cache);
    }
}

/// Restores a mod's persist variables into d3dx_user.ini after it is enabled
pub fn restore_mod_state(mods_root: &Path, enabled_mod_path: &Path, clean_mod_name: &str) {
    let cache = load_state_cache(mods_root);
    let saved_vars = match cache.get(clean_mod_name) {
        Some(v) if !v.is_empty() => v,
        _ => return,
    };

    if let Some(d3dx_path) = find_d3dx_user_ini(mods_root) {
        let mut sections = read_d3dx_user_ini(&d3dx_path);

        // Find .ini files inside this enabled mod to construct section headers and keys
        let mut ini_files = Vec::new();
        crate::utils::find_ini_files(enabled_mod_path, &mut ini_files, 0, 15);

        let parent_opt = mods_root.parent();

        for (var_key, value) in saved_vars {
            // If the key starts with "$\", it might be an exact key backed up directly
            if var_key.starts_with("$\\") {
                let fixed_key = var_key.replace("DISABLED ", "").replace("disabled ", "");
                sections
                    .entry("Constants".to_string())
                    .or_default()
                    .insert(fixed_key, value.clone());
                continue;
            }

            let clean_var = var_key.trim_start_matches('$');

            for ini_file in &ini_files {
                let ns = extract_ini_namespace(ini_file);
                if let Some(ref namespace) = ns {
                    let key = format!("$\\{}\\{}", namespace, clean_var);
                    sections
                        .entry("Constants".to_string())
                        .or_default()
                        .insert(key, value.clone());
                }

                if let Some(parent) = parent_opt {
                    if let Ok(rel) = ini_file.strip_prefix(parent) {
                        let rel_str = rel.to_string_lossy().replace('/', "\\");
                        let rel_key = format!("$\\{}\\{}", rel_str.to_lowercase(), clean_var.to_lowercase());
                        sections
                            .entry("Constants".to_string())
                            .or_default()
                            .insert(rel_key, value.clone());

                        // Also legacy section header for GIMI compatibility
                        sections
                            .entry(rel_str)
                            .or_default()
                            .insert(format!("${}", clean_var), value.clone());
                    }
                }
            }
        }

        let _ = write_d3dx_user_ini(&d3dx_path, &sections);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_d3dx_user_ini_roundtrip() {
        let temp_dir = std::env::temp_dir().join("zzz_test_d3dx_roundtrip");
        let _ = fs::create_dir_all(&temp_dir);
        let ini_file = temp_dir.join("d3dx_user.ini");

        let content = r#"[Mods\Playable Characters\Jane\Jane.ini]
$swapvarHair = 2
$swapvarTop = 1

[Mods\NPCs\Bangboo\mod.ini]
$color = 0
"#;
        fs::write(&ini_file, content).unwrap();

        let sections = read_d3dx_user_ini(&ini_file);
        assert_eq!(sections.len(), 2);
        assert_eq!(sections.get(r"Mods\Playable Characters\Jane\Jane.ini").unwrap().get("$swapvarHair").unwrap(), "2");

        let out_file = temp_dir.join("d3dx_out.ini");
        write_d3dx_user_ini(&out_file, &sections).unwrap();

        let read_back = read_d3dx_user_ini(&out_file);
        assert_eq!(read_back, sections);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_zzmi_constants_backup_restore() {
        let temp_dir = std::env::temp_dir().join("zzz_test_zzmi_constants");
        let _ = fs::create_dir_all(&temp_dir);
        let mods_dir = temp_dir.join("Mods");
        let mod_dir = mods_dir.join("Playable Characters").join("Rina").join("RinaRose_Enhanced");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_file = mod_dir.join("Rina.ini");
        fs::write(&ini_file, "[Constants]\nglobal persist $swapvarNeck = 0\n").unwrap();

        let d3dx_file = temp_dir.join("d3dx_user.ini");
        let d3dx_content = r#"[Constants]
$\mods\playable characters\rina\rinarose_enhanced\rina.ini\swapvarneck = 3
$\other_mod\active = 1
"#;
        fs::write(&d3dx_file, d3dx_content).unwrap();

        // 1. Backup state before disabling
        backup_mod_state(&mods_dir, &mod_dir, "RinaRose_Enhanced");

        let cache = load_state_cache(&mods_dir);
        let rina_cache = cache.get("RinaRose_Enhanced").expect("Cache entry should exist");
        assert_eq!(rina_cache.get("$swapvarneck").unwrap(), "3");

        // 2. Simulate 3DMigoto removing the mod when disabled
        let wiped_d3dx = "[Constants]\n$\\other_mod\\active = 1\n";
        fs::write(&d3dx_file, wiped_d3dx).unwrap();

        // 3. Restore state after enabling
        restore_mod_state(&mods_dir, &mod_dir, "RinaRose_Enhanced");

        let restored_sections = read_d3dx_user_ini(&d3dx_file);
        let constants = restored_sections.get("Constants").expect("[Constants] should exist");
        let key_expected = r"$\mods\playable characters\rina\rinarose_enhanced\rina.ini\swapvarneck";
        assert_eq!(constants.get(key_expected).unwrap(), "3");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
