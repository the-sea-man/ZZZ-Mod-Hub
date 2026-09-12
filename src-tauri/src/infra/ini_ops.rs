use crate::error::AppError;
use crate::models::{KeybindInfo, ModToggleInfo};
use crate::utils::find_ini_files;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

#[tauri::command]
pub fn get_mod_keybinds(mod_path: &str) -> Result<Vec<KeybindInfo>, AppError> {
    let mut all_keybinds = Vec::new();
    let mod_path_expanded = crate::utils::expand_path(mod_path);
    let root = Path::new(&mod_path_expanded);
    if !root.exists() || !root.is_dir() {
        return Ok(all_keybinds);
    }

    let mut ini_files = Vec::new();
    find_ini_files(root, &mut ini_files, 0, 15);

    for path in ini_files {
        let file_name = path.strip_prefix(root).unwrap_or(&path).to_string_lossy().to_string();
        if let Ok(mut binds) = crate::utils::parse_file_keybinds(&path, &file_name) {
            all_keybinds.append(&mut binds);
        }
    }
    
    Ok(all_keybinds)
}

#[tauri::command]
pub fn set_mod_keybind(mod_path: &str, ini_file: &str, section: &str, key_type: &str, old_key: &str, new_key: &str, create_backup: bool) -> Result<String, AppError> {
    let mod_path_expanded = crate::utils::expand_path(mod_path);
    let path = Path::new(&mod_path_expanded).join(ini_file);
    if !path.exists() || !path.is_file() {
        return Err("INI file not found".into());
    }

    if create_backup {
        crate::utils::backup_file(&path);
    }

    let content = fs::read_to_string(&path)?;
    let mut new_content = String::new();
    #[allow(unused_assignments)] let mut current_section = String::new();
    let mut replaced = false;

    for line in content.lines() {
        let trimmed = line.trim();
        
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            current_section = trimmed[1..trimmed.len()-1].to_string();
            new_content.push_str(line);
            new_content.push('\n');
        } else if current_section == section && !replaced {
            if let Some(parts) = trimmed.split_once('=') {
                let k = parts.0.trim().to_lowercase();
                let v = parts.1.trim();
                if k == key_type.to_lowercase() && v == old_key {
                    new_content.push_str(&format!("{} = {}\n", key_type, new_key));
                    replaced = true;
                } else {
                    new_content.push_str(line);
                    new_content.push('\n');
                }
            } else {
                new_content.push_str(line);
                new_content.push('\n');
            }
        } else {
            new_content.push_str(line);
            new_content.push('\n');
        }
    }

    if replaced {
        fs::write(&path, new_content)?;
        Ok("Keybind updated".into())
    } else {
        Err("Could not find the exact keybind to replace in that section.".into())
    }
}

#[derive(serde::Serialize)]
pub struct ModMetadata {
    pub total_size_bytes: u64,
    pub file_count: usize,
    pub last_modified: Option<u64>,
    pub ini_last_modified: Option<u64>,
    pub fingerprint: String,
    pub version_string: Option<String>,
}

#[tauri::command]
pub fn get_mod_metadata(mod_path: String) -> Result<ModMetadata, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let path = Path::new(&mod_path);
    if !path.exists() || !path.is_dir() {
        return Err("Mod directory does not exist".into());
    }

    let mut total_size_bytes = 0;
    let mut file_count = 0;
    let mut last_modified = None;
    let mut ini_last_modified = None;
    let mut version_string = None;

    let mut dirs_to_visit = vec![path.to_path_buf()];
    let mut files = vec![];

    while let Some(current_dir) = dirs_to_visit.pop() {
        if let Ok(entries) = fs::read_dir(&current_dir) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_dir() {
                        dirs_to_visit.push(entry.path());
                    } else if metadata.is_file() {
                        let file_name = entry.file_name().to_string_lossy().to_lowercase();
                        // Ignore system files that Windows/Mac auto-generate
                        if file_name == "thumbs.db" || file_name == "desktop.ini" || file_name == ".ds_store" {
                            continue;
                        }
                        files.push((entry.path(), metadata));
                    }
                }
            }
        }
    }

    // Sort files by relative path for deterministic fingerprint
    files.sort_by(|a, b| a.0.cmp(&b.0));

    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;
    let mut hasher = DefaultHasher::new();

    for (file_path, metadata) in files {
        file_count += 1;
        total_size_bytes += metadata.len();
        
        let is_ini = file_path.extension().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("ini")).unwrap_or(false);

        if let Ok(modified_time) = metadata.modified() {
            if let Ok(duration) = modified_time.duration_since(std::time::UNIX_EPOCH) {
                let secs = duration.as_secs();
                
                match last_modified {
                    None => last_modified = Some(secs),
                    Some(max_secs) => if secs > max_secs {
                        last_modified = Some(secs);
                    }
                }

                if is_ini {
                    match ini_last_modified {
                        None => ini_last_modified = Some(secs),
                        Some(max_secs) => if secs > max_secs {
                            ini_last_modified = Some(secs);
                        }
                    }
                }
            }
        }

        // Hash file relative path
        if let Ok(rel_path) = file_path.strip_prefix(path) {
            rel_path.to_string_lossy().to_string().to_lowercase().hash(&mut hasher);
        }
        
        // Hash file size
        metadata.len().hash(&mut hasher);

        // If INI, hash content and try to extract version
        if is_ini {
            if let Ok(content) = fs::read_to_string(&file_path) {
                content.hash(&mut hasher);
                
                // Try to find a version string in the INI if we haven't found one yet
                if version_string.is_none() {
                    for line in content.lines() {
                        let lower = line.to_lowercase();
                        if lower.contains("version") && (lower.starts_with(';') || lower.starts_with("//") || lower.starts_with('#')) {
                            let parts: Vec<&str> = lower.splitn(2, "version").collect();
                            if parts.len() == 2 {
                                let ver = parts[1].replace([':', '='], "").trim().to_string();
                                if !ver.is_empty() && ver.len() < 15 {
                                    version_string = Some(ver);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(ModMetadata {
        total_size_bytes,
        file_count,
        last_modified,
        ini_last_modified,
        fingerprint: format!("{:016x}", hasher.finish()),
        version_string,
    })
}

#[tauri::command]
pub fn detect_keybind_conflicts(mods_path: String) -> Result<Vec<crate::models::KeybindConflict>, AppError> {
    let mods_path = crate::utils::expand_path(&mods_path);
    let root = Path::new(&mods_path);
    if !root.exists() || !root.is_dir() {
        return Ok(Vec::new());
    }

    let mut key_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();

    if let Ok(cat_entries) = fs::read_dir(root) {
        for cat_entry in cat_entries.flatten() {
            let cat_path = cat_entry.path();
            if !cat_path.is_dir() {
                continue;
            }
            let cat_name = cat_entry.file_name().to_string_lossy().to_string();
            if cat_name.starts_with('.') || cat_name.starts_with('_') || cat_name.eq_ignore_ascii_case("staging") {
                continue;
            }

            if let Ok(mod_entries) = fs::read_dir(&cat_path) {
                for mod_entry in mod_entries.flatten() {
                    let mod_path = mod_entry.path();
                    if !mod_path.is_dir() {
                        continue;
                    }
                    let folder_name = mod_entry.file_name().to_string_lossy().to_string();
                    if !crate::utils::is_mod_enabled(&folder_name) {
                        continue;
                    }

                    let mod_display_name = crate::utils::get_mod_display_name(&folder_name);
                    let mod_path_str = mod_path.to_string_lossy().to_string();

                    if let Ok(keybinds) = get_mod_keybinds(&mod_path_str) {
                        for kb in keybinds {
                            for k in kb.keys.iter().chain(kb.back_keys.iter()) {
                                let key_trimmed = k.trim();
                                if key_trimmed.is_empty() {
                                    continue;
                                }
                                let mod_list = key_map.entry(key_trimmed.to_string()).or_default();
                                if !mod_list.contains(&mod_display_name) {
                                    mod_list.push(mod_display_name.clone());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let conflicts = key_map
        .into_iter()
        .filter(|(_, mods)| mods.len() > 1)
        .map(|(key, mods)| crate::models::KeybindConflict { key, mods })
        .collect();

    Ok(conflicts)
}

fn clean_toggle_name(var: &str) -> String {
    let clean = var.trim_start_matches('$');
    let mut words = Vec::new();
    let mut current_word = String::new();

    for ch in clean.chars() {
        if ch == '_' || ch == '-' {
            if !current_word.is_empty() {
                words.push(current_word);
                current_word = String::new();
            }
        } else if ch.is_uppercase() && !current_word.is_empty() {
            words.push(current_word);
            current_word = ch.to_string();
        } else {
            current_word.push(ch);
        }
    }
    if !current_word.is_empty() {
        words.push(current_word);
    }

    let capitalized: Vec<String> = words
        .into_iter()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect();

    if capitalized.is_empty() {
        var.to_string()
    } else {
        capitalized.join(" ")
    }
}

fn generate_toggle_labels(values: &[i32]) -> Vec<String> {
    if values == [0, 1] {
        vec!["Off".to_string(), "On".to_string()]
    } else if values == [1, 0] {
        vec!["On".to_string(), "Off".to_string()]
    } else {
        values
            .iter()
            .enumerate()
            .map(|(i, &v)| format!("Style {} ({})", i + 1, v))
            .collect()
    }
}

#[allow(clippy::too_many_arguments)]
fn resolve_current_toggle_value(
    var_low: &str,
    values: &[i32],
    constants_defaults: &HashMap<String, i32>,
    d3dx_sections: &HashMap<String, HashMap<String, String>>,
    state_cache: &HashMap<String, HashMap<String, String>>,
    clean_folder_name: &str,
    file_name: &str,
    namespace: Option<&str>,
) -> i32 {
    let norm_ini = file_name.replace('/', "\\").to_lowercase();
    let clean_folder_low = clean_folder_name.to_lowercase();

    // 1. Check d3dx_user.ini [Constants] section (ZZMI standard)
    let clean_var = var_low.trim_start_matches('$');
    let var_suffix = format!("\\{}", clean_var);

    if let Some(constants) = d3dx_sections.get("Constants").or_else(|| d3dx_sections.get("constants")) {
        // Priority 1A: If INI defines a namespace, check exact $\<ns>\<var>
        if let Some(ns) = namespace {
            let ns_key = format!("$\\{}\\{}", ns.to_lowercase(), clean_var);
            for (k, v) in constants {
                let k_low = k.replace('/', "\\").to_lowercase();
                if k_low == ns_key {
                    if let Ok(val) = v.trim().parse::<i32>() {
                        return val;
                    }
                }
            }
        }

        // Priority 1B: Path and folder matching
        for (k, v) in constants {
            let k_low = k.replace('/', "\\").to_lowercase();
            if k_low.ends_with(&var_suffix)
                && (k_low.contains(&clean_folder_low) || clean_folder_low.is_empty())
                    && (k_low.contains(&norm_ini) || norm_ini.is_empty())
                {
                    if let Ok(val) = v.trim().parse::<i32>() {
                        return val;
                    }
                }
        }
    }

    // Fallback: Check section-based d3dx_sections (GIMI / legacy)
    for (sec_name, vars) in d3dx_sections {
        let sec_low = sec_name.to_lowercase();
        if (sec_low.contains(&clean_folder_low) || clean_folder_low.is_empty())
            && sec_low.contains(&norm_ini)
        {
            for (k, v) in vars {
                if k.to_lowercase() == var_low || k.trim_start_matches('$').to_lowercase() == clean_var {
                    if let Ok(val) = v.trim().parse::<i32>() {
                        return val;
                    }
                }
            }
        }
    }

    // 2. Check state cache
    if let Some(cached_vars) = state_cache.get(clean_folder_name) {
        for (k, v) in cached_vars {
            let k_low = k.to_lowercase();
            if k_low == var_low || k_low.trim_start_matches('$') == clean_var {
                if let Ok(val) = v.trim().parse::<i32>() {
                    return val;
                }
            }
        }
    }

    // 3. Check [Constants] defaults in mod INI
    if let Some(&def) = constants_defaults.get(var_low).or_else(|| constants_defaults.get(&format!("${}", clean_var))) {
        return def;
    }

    // 4. Default to first value
    values.first().copied().unwrap_or(0)
}

#[tauri::command]
pub fn get_mod_toggles(mod_path: &str) -> Result<Vec<ModToggleInfo>, AppError> {
    let mut all_toggles = Vec::new();
    let root = Path::new(mod_path);
    if !root.exists() || !root.is_dir() {
        return Ok(all_toggles);
    }

    let mut ini_files = Vec::new();
    find_ini_files(root, &mut ini_files, 0, 15);

    let mods_root = crate::state_tracker::find_mods_root(root);
    let d3dx_sections = crate::state_tracker::find_d3dx_user_ini(&mods_root)
        .map(|p| crate::state_tracker::read_d3dx_user_ini(&p))
        .unwrap_or_default();
    let state_cache = crate::state_tracker::load_state_cache(&mods_root);
    let clean_folder_name = root.file_name().map_or("".to_string(), |n| {
        let s = n.to_string_lossy();
        s.strip_prefix("DISABLED ").unwrap_or(&s).to_string()
    });

    for path in ini_files {
        let namespace = crate::state_tracker::extract_ini_namespace(&path);
        let file_name = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();
        let content = match crate::utils::read_ini_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut constants_defaults: HashMap<String, i32> = HashMap::new();
        let mut section_map: Vec<(String, Vec<(String, String)>)> = Vec::new();
        let mut current_sec = String::new();
        let mut current_entries = Vec::new();

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with(';') || trimmed.starts_with('#') || trimmed.is_empty() {
                continue;
            }
            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                if !current_sec.is_empty() {
                    section_map.push((current_sec.clone(), std::mem::take(&mut current_entries)));
                }
                current_sec = trimmed[1..trimmed.len() - 1].trim().to_string();
            } else if let Some((k, v)) = trimmed.split_once('=') {
                current_entries.push((k.trim().to_string(), v.trim().to_string()));
            }
        }
        if !current_sec.is_empty() {
            section_map.push((current_sec, current_entries));
        }

        // 1. Scan [Constants]
        for (sec_name, entries) in &section_map {
            if sec_name.eq_ignore_ascii_case("constants") {
                for (k, v) in entries {
                    let k_low = k.to_lowercase();
                    let var_part = k_low
                        .split_whitespace()
                        .find(|p| p.starts_with('$'))
                        .unwrap_or(&k_low);
                    if var_part.starts_with('$') {
                        if let Ok(num) = v.parse::<i32>() {
                            constants_defaults.insert(var_part.to_string(), num);
                        }
                    }
                }
            }
        }

        // 2. Scan [Key...] sections
        let mut seen_vars: HashSet<String> = HashSet::new();

        for (sec_name, entries) in &section_map {
            let sec_low = sec_name.to_lowercase();
            if !sec_low.starts_with("key") {
                continue;
            }

            let key_bind = entries
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case("key"))
                .map(|(_, v)| v.clone());
            let back_bind = entries
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case("back"))
                .map(|(_, v)| v.clone());
            let bind_type = entries
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case("type"))
                .map(|(_, v)| v.clone())
                .unwrap_or_else(|| "cycle".to_string());
            let condition = entries
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case("condition"))
                .map(|(_, v)| v.clone());

            for (k, v) in entries {
                if k.starts_with('$') {
                    let var_name = k.clone();
                    let var_low = var_name.to_lowercase();
                    if seen_vars.contains(&var_low) {
                        continue;
                    }

                    let raw_values: Vec<i32> = v
                        .split(',')
                        .filter_map(|s| s.trim().parse::<i32>().ok())
                        .collect();

                    if raw_values.is_empty() {
                        continue;
                    }

                    let mut unique_values = Vec::new();
                    for val in raw_values {
                        if !unique_values.contains(&val) {
                            unique_values.push(val);
                        }
                    }

                    let cur_val = resolve_current_toggle_value(
                        &var_low,
                        &unique_values,
                        &constants_defaults,
                        &d3dx_sections,
                        &state_cache,
                        &clean_folder_name,
                        &file_name,
                        namespace.as_deref(),
                    );

                    let display_name = clean_toggle_name(&var_name);
                    let labels = generate_toggle_labels(&unique_values);

                    seen_vars.insert(var_low);
                    all_toggles.push(ModToggleInfo {
                        id: format!(
                            "{}_{}_{}",
                            file_name,
                            sec_name,
                            var_name.trim_start_matches('$')
                        ),
                        ini_file: file_name.clone(),
                        section: sec_name.clone(),
                        variable: var_name,
                        display_name,
                        key: key_bind.clone(),
                        back_key: back_bind.clone(),
                        bind_type: bind_type.clone(),
                        condition: condition.clone(),
                        current_value: cur_val,
                        values: unique_values,
                        labels,
                    });
                }
            }
        }
    }

    Ok(all_toggles)
}

#[tauri::command]
pub fn set_mod_toggle_state(
    mod_path: &str,
    ini_file: &str,
    variable: &str,
    value: i32,
    create_backup: bool,
) -> Result<(), AppError> {
    let root = Path::new(mod_path);
    if !root.exists() || !root.is_dir() {
        return Err("Mod directory not found".into());
    }

    let ini_path = root.join(ini_file);
    if !ini_path.exists() || !ini_path.is_file() {
        return Err("INI file not found".into());
    }

    let var_name = if variable.starts_with('$') {
        variable.to_string()
    } else {
        format!("${}", variable)
    };

    if create_backup {
        crate::utils::backup_file(&ini_path);
    }

    // 1. Update mod's INI file [Constants] section
    let content = crate::utils::read_ini_to_string(&ini_path)
        .map_err(|e| AppError::Custom(format!("Failed to read INI: {}", e)))?;

    let mut new_lines = Vec::new();
    let mut in_constants = false;
    let mut constants_found = false;
    let mut var_replaced = false;
    let var_lower = var_name.to_lowercase();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            let sec_name = trimmed[1..trimmed.len() - 1].trim();
            if in_constants && !var_replaced {
                new_lines.push(format!("global persist {} = {}", var_name, value));
                var_replaced = true;
            }
            in_constants = sec_name.eq_ignore_ascii_case("constants");
            if in_constants {
                constants_found = true;
            }
            new_lines.push(line.to_string());
        } else if in_constants && !var_replaced {
            if let Some((k, _)) = trimmed.split_once('=') {
                let k_trim = k.trim().to_lowercase();
                let clean_var = k_trim
                    .split_whitespace()
                    .find(|p| p.starts_with('$'))
                    .unwrap_or(&k_trim);
                if clean_var == var_lower {
                    let prefix = if k_trim.contains("global persist") {
                        "global persist "
                    } else if k_trim.contains("global") {
                        "global "
                    } else {
                        ""
                    };
                    new_lines.push(format!("{}{} = {}", prefix, var_name, value));
                    var_replaced = true;
                    continue;
                }
            }
            new_lines.push(line.to_string());
        } else {
            new_lines.push(line.to_string());
        }
    }

    if in_constants && !var_replaced {
        new_lines.push(format!("global persist {} = {}", var_name, value));
    }

    if !constants_found {
        let mut prepended = vec![
            "[Constants]".to_string(),
            format!("global persist {} = {}", var_name, value),
            "".to_string(),
        ];
        prepended.extend(new_lines);
        new_lines = prepended;
    }

    fs::write(&ini_path, new_lines.join("\r\n"))?;

    // 2. Update d3dx_user.ini and state cache
    let mods_root = crate::state_tracker::find_mods_root(root);
    let clean_folder_name = root.file_name().map_or("".to_string(), |n| {
        let s = n.to_string_lossy();
        s.strip_prefix("DISABLED ").unwrap_or(&s).to_string()
    });
    let clean_var = var_name.trim_start_matches('$');

    if let Some(d3dx_path) = crate::state_tracker::find_d3dx_user_ini(&mods_root) {
        let mut sections = crate::state_tracker::read_d3dx_user_ini(&d3dx_path);

        if let Some(parent) = mods_root.parent() {
            if let Ok(rel) = ini_path.strip_prefix(parent) {
                let rel_str = rel.to_string_lossy().replace('/', "\\");

                // A. Write standard ZZMI key: $\<rel_path>\<var> = <value>
                let rel_key = format!("$\\{}\\{}", rel_str.to_lowercase(), clean_var.to_lowercase());
                sections
                    .entry("Constants".to_string())
                    .or_default()
                    .insert(rel_key, value.to_string());

                // B. If INI defines a namespace, also write $\<ns>\<var> = <value>
                if let Some(ns) = crate::state_tracker::extract_ini_namespace(&ini_path) {
                    let ns_key = format!("$\\{}\\{}", ns.to_lowercase(), clean_var.to_lowercase());
                    sections
                        .entry("Constants".to_string())
                        .or_default()
                        .insert(ns_key, value.to_string());
                }

                // C. Also write legacy section header for GIMI compatibility
                sections
                    .entry(rel_str)
                    .or_default()
                    .insert(var_name.clone(), value.to_string());
            }
        }

        let _ = crate::state_tracker::write_d3dx_user_ini(&d3dx_path, &sections);
    }

    // 3. Update state cache
    if !clean_folder_name.is_empty() {
        let mut cache = crate::state_tracker::load_state_cache(&mods_root);
        let mod_cache = cache.entry(clean_folder_name).or_default();
        mod_cache.insert(format!("${}", clean_var), value.to_string());
        mod_cache.insert(var_name, value.to_string());
        crate::state_tracker::save_state_cache(&mods_root, &cache);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_toggle_name() {
        assert_eq!(clean_toggle_name("$swapvar"), "Swapvar");
        assert_eq!(clean_toggle_name("$swapvarHair"), "Swapvar Hair");
        assert_eq!(clean_toggle_name("$outfit_style"), "Outfit Style");
        assert_eq!(clean_toggle_name("$glasses"), "Glasses");
    }

    #[test]
    fn test_get_and_set_mod_toggles() {
        let temp_dir = std::env::temp_dir().join("zzz_test_toggles");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let ini_file = temp_dir.join("test_mod.ini");
        let ini_content = r#"[Constants]
global persist $swapvar = 0

[KeyToggle]
key = [
type = cycle
$swapvar = 0, 1, 2
"#;
        fs::write(&ini_file, ini_content).unwrap();

        let toggles = get_mod_toggles(temp_dir.to_str().unwrap()).unwrap();
        assert_eq!(toggles.len(), 1);
        assert_eq!(toggles[0].variable, "$swapvar");
        assert_eq!(toggles[0].current_value, 0);
        assert_eq!(toggles[0].values, vec![0, 1, 2]);

        // Change state to 2
        set_mod_toggle_state(
            temp_dir.to_str().unwrap(),
            "test_mod.ini",
            "$swapvar",
            2,
            false,
        )
        .unwrap();

        let updated = get_mod_toggles(temp_dir.to_str().unwrap()).unwrap();
        assert_eq!(updated[0].current_value, 2);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_get_mod_toggles_with_namespace() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_toggles_ns_{}", unique_id));
        let mod_dir = temp_dir.join("Mods").join("Jane");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_file = mod_dir.join("Jane.ini");
        let ini_content = r#"namespace = jane_custom
[Constants]
global persist $swapvar = 0

[KeyToggle]
key = [
type = cycle
$swapvar = 0, 1, 2
"#;
        fs::write(&ini_file, ini_content).unwrap();

        // Write d3dx_user.ini with namespaced key: $\jane_custom\swapvar = 2
        let d3dx_content = "[Constants]\r\n$\\jane_custom\\swapvar = 2\r\n";
        fs::write(temp_dir.join("d3dx_user.ini"), d3dx_content).unwrap();

        let toggles = get_mod_toggles(mod_dir.to_str().unwrap()).unwrap();
        assert_eq!(toggles.len(), 1);
        assert_eq!(toggles[0].current_value, 2, "Must resolve current toggle value from namespaced $\\jane_custom\\swapvar");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
