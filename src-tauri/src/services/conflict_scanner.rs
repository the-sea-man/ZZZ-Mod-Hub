use crate::error::AppError;
use crate::models::{HashAnalysisResult, HashOverride, ModConflict};
use std::collections::{BTreeMap, HashMap};
use std::path::Path;

type HashOccurrenceMap = BTreeMap<(String, u32), Vec<(String, String, String)>>;

/// Extract component name from a `[TextureOverride...]` section name.
/// Examples:
/// `TextureOverrideJaneDoeHRFace` -> `Face`
/// `TextureOverrideBelleBody` -> `Body`
pub fn extract_component_name(section: &str) -> String {
    let sec_clean = section.trim_matches(&['[', ']'][..]).trim();

    // Strip TextureOverride prefix (case-insensitive)
    let remainder = if sec_clean.to_lowercase().starts_with("textureoverride") {
        &sec_clean[15..]
    } else {
        sec_clean
    }
    .trim();

    if remainder.is_empty() {
        return "General".to_string();
    }

    // Known 3DMigoto/ZZMI component keywords
    let known_components = [
        "Face", "Body", "Hair", "Head", "Dress", "Glasses", "Blend", "Position", "TexCoord",
        "Weapon", "Pants", "Jacket", "Legs", "Arms", "Shoes", "Underwear", "Skirt", "Hat", "Tail",
        "Ears", "Accessory", "Accessories", "Acc", "Outline", "Shadow", "Fx", "Effect", "Remap",
        "Tex0", "Tex1", "Tex2", "Tex3", "IB", "VB",
    ];

    let remainder_lower = remainder.to_lowercase();
    for &comp in &known_components {
        if remainder_lower.ends_with(&comp.to_lowercase()) {
            return comp.to_string();
        }
    }

    // Fallback: camelCase tokenization to extract the last capital word
    let mut words = Vec::new();
    let mut current_word = String::new();

    for c in remainder.chars() {
        if c.is_uppercase() || c == '_' || c == '-' {
            if !current_word.is_empty() {
                words.push(current_word);
                current_word = String::new();
            }
            if c != '_' && c != '-' {
                current_word.push(c);
            }
        } else {
            current_word.push(c);
        }
    }
    if !current_word.is_empty() {
        words.push(current_word);
    }

    if let Some(last_word) = words.last() {
        let trimmed_last = last_word.trim();
        if !trimmed_last.is_empty() {
            let mut chars = trimmed_last.chars();
            if let Some(first) = chars.next() {
                return format!("{}{}", first.to_uppercase(), chars.as_str());
            }
        }
    }

    "General".to_string()
}

/// Determines if a conflicting component represents fatal geometry (meshes, bones, positions)
/// as opposed to non-breaking cosmetic textures (diffuse, normalmap, lightmap, materialmap).
pub fn is_fatal_component(comp: &str) -> bool {
    let c = comp.to_lowercase();
    if c == "diffuse"
        || c == "normalmap"
        || c == "lightmap"
        || c == "materialmap"
        || c == "shadow"
        || c == "outline"
        || c == "fx"
        || c == "effect"
        || c == "general"
        || c.starts_with("tex")
    {
        return false;
    }
    true
}

/// Extract all `[TextureOverride...]` sections, `hash`, and `match_first_index` from INI string.
pub fn extract_overrides_from_ini(content: &str, rel_file_path: &str) -> Vec<HashOverride> {
    let mut overrides = Vec::new();
    let mut current_section: Option<String> = None;
    let mut current_hash: Option<String> = None;
    let mut current_first_index: u32 = 0;

    for raw_line in content.lines() {
        // Strip comments starting with ;, #, or //
        let line_without_comment = if let Some(idx) = raw_line.find([';', '#']) {
            &raw_line[..idx]
        } else if let Some(idx) = raw_line.find("//") {
            &raw_line[..idx]
        } else {
            raw_line
        };

        let trimmed = line_without_comment.trim();
        if trimmed.is_empty() {
            continue;
        }

        if trimmed.starts_with('[') {
            if let Some(closing_idx) = trimmed.rfind(']') {
                let section_name = trimmed[1..closing_idx].trim().to_string();

                // Save previous section if it contained a valid hash
                if let Some(sec) = current_section.take() {
                    if let Some(h) = current_hash.take() {
                        let comp = extract_component_name(&sec);
                        overrides.push(HashOverride {
                            file: rel_file_path.to_string(),
                            section: sec,
                            hash: h,
                            first_index: current_first_index,
                            component_name: comp,
                        });
                    }
                }

                current_first_index = 0;
                current_hash = None;

                if section_name.to_lowercase().starts_with("textureoverride") {
                    current_section = Some(section_name);
                }
            }
        } else if current_section.is_some() {
            if let Some((k, v)) = trimmed.split_once('=') {
                let key_lower = k.trim().to_lowercase();
                let val_trimmed = v.trim();

                if key_lower == "hash" {
                    let clean_val = val_trimmed
                        .strip_prefix("0x")
                        .or_else(|| val_trimmed.strip_prefix("0X"))
                        .unwrap_or(val_trimmed)
                        .to_lowercase();
                    if !clean_val.is_empty() {
                        current_hash = Some(clean_val);
                    }
                } else if key_lower == "match_first_index" || key_lower == "first_index" {
                    if let Ok(idx) = val_trimmed.parse::<u32>() {
                        current_first_index = idx;
                    }
                }
            }
        }
    }

    // Flush final section
    if let Some(sec) = current_section.take() {
        if let Some(h) = current_hash.take() {
            let comp = extract_component_name(&sec);
            overrides.push(HashOverride {
                file: rel_file_path.to_string(),
                section: sec,
                hash: h,
                first_index: current_first_index,
                component_name: comp,
            });
        }
    }

    overrides
}

/// Returns the relative mod directory path (e.g. "Playable Characters/Anby/Mod1" or "Anby/Mod1")
/// clean of any "DISABLED " or "DISABLED_" prefixes, identifying the specific mod folder.
pub fn get_mod_id(root: &Path, path: &Path, _warning_level: &str) -> String {
    let relative = match path.strip_prefix(root) {
        Ok(rel) => rel,
        Err(_) => {
            return path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "UnknownMod".to_string())
        }
    };

    let components: Vec<String> = relative
        .components()
        .map(|c| c.as_os_str().to_string_lossy().to_string())
        .collect();

    if components.is_empty() {
        return "Root".to_string();
    }

    let is_ini_file = path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("ini"));
    let dir_components = if is_ini_file && components.len() > 1 {
        &components[..components.len() - 1]
    } else {
        &components[..]
    };

    let clean_dir_components: Vec<String> = dir_components
        .iter()
        .map(|s| {
            if s.starts_with("DISABLED ") {
                s.strip_prefix("DISABLED ").unwrap_or(s).to_string()
            } else if s.starts_with("DISABLED_") {
                s.strip_prefix("DISABLED_").unwrap_or(s).to_string()
            } else {
                s.clone()
            }
        })
        .collect();

    if clean_dir_components.is_empty() {
        return "Root".to_string();
    }

    clean_dir_components.join("/")
}

/// Helper to check whether a hash is a generic shared game asset
fn is_shared_hash(clean_h: &str) -> bool {
    if let Ok(guard) = crate::utils::get_hash_alias_cache().read() {
        if let Some((_, cached_map)) = guard.as_ref() {
            return crate::utils::is_generic_shared_hash(clean_h, cached_map);
        }
    }
    crate::utils::GENERIC_SHARED_HASHES.contains(&clean_h)
}

/// Scans hash conflicts directly from pre-discovered active mod entries (0 redundant disk crawling).
pub fn scan_conflicts_from_active_mods(
    root: &Path,
    active_mods: &[crate::utils::ActiveModEntry],
    warning_level: &str,
) -> Vec<ModConflict> {
    let mut hash_map: HashOccurrenceMap = BTreeMap::new();

    for entry in active_mods {
        let mod_id = get_mod_id(root, &entry.mod_path, warning_level);
        let category = entry.category.clone();

        for ini in &entry.parsed_inis {
            for ov in &ini.overrides {
                let clean_h = ov.hash.to_lowercase();
                if is_shared_hash(&clean_h) {
                    continue;
                }
                let key = (clean_h, ov.first_index);
                hash_map
                    .entry(key)
                    .or_default()
                    .push((mod_id.clone(), category.clone(), ov.component_name.clone()));
            }
        }
    }

    let mut conflicts = Vec::new();

    for ((hash, first_index), entries) in hash_map {
        let mut distinct_mods: Vec<String> = entries.iter().map(|(m, _, _)| m.clone()).collect();
        distinct_mods.sort();
        distinct_mods.dedup();

        if distinct_mods.len() > 1 {
            let affected_component = entries
                .iter()
                .find(|(_, _, comp)| !comp.is_empty() && comp != "General")
                .map(|(_, _, comp)| comp.clone())
                .unwrap_or_else(|| entries[0].2.clone());

            let is_fatal = is_fatal_component(&affected_component);

            // Light sensitivity: only report critical mesh/geometry collisions (IB/VB)
            if warning_level.eq_ignore_ascii_case("light") && !is_fatal {
                continue;
            }

            conflicts.push(ModConflict {
                hash,
                first_index,
                affected_component,
                conflicting_mods: distinct_mods,
                is_fatal,
            });
        }
    }

    conflicts
}

/// Core function to scan `mods_dir` for hash conflicts using single-pass active mod discovery.
pub fn scan_conflicts(mods_dir: &str, warning_level: &str) -> Result<Vec<ModConflict>, AppError> {
    let mods_dir_expanded = crate::utils::expand_path(mods_dir);
    let root = Path::new(&mods_dir_expanded);
    if !root.exists() || !root.is_dir() {
        return Ok(Vec::new());
    }

    let active_mods = crate::utils::discover_active_mods(root);
    Ok(scan_conflicts_from_active_mods(root, &active_mods, warning_level))
}

#[tauri::command]
pub async fn scan_mod_conflicts(
    mods_dir: String,
    warning_level: String,
) -> Result<Vec<ModConflict>, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        scan_conflicts(&mods_dir, &warning_level)
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}

/// Extracts hashes and scans conflicts directly from pre-discovered active mod entries (0 redundant disk crawling).
pub fn analyze_mod_hashes_from_active_mods(
    root: &Path,
    active_mods: &[crate::utils::ActiveModEntry],
    warning_level: &str,
) -> HashAnalysisResult {
    let mut hash_map: HashOccurrenceMap = BTreeMap::new();
    let mut mod_hashes: HashMap<String, Vec<HashOverride>> = HashMap::new();

    for entry in active_mods {
        let mod_id = get_mod_id(root, &entry.mod_path, warning_level);
        let category = entry.category.clone();
        let mod_full_path = entry.mod_path.to_string_lossy().replace('\\', "/");

        for ini in &entry.parsed_inis {
            for ov in &ini.overrides {
                let clean_h = ov.hash.to_lowercase();
                if is_shared_hash(&clean_h) {
                    continue;
                }
                let key = (clean_h, ov.first_index);
                hash_map
                    .entry(key)
                    .or_default()
                    .push((mod_id.clone(), category.clone(), ov.component_name.clone()));
            }

            if !ini.overrides.is_empty() {
                mod_hashes
                    .entry(mod_full_path.clone())
                    .or_default()
                    .extend(ini.overrides.clone());
            }
        }
    }

    let mut conflicts = Vec::new();

    for ((hash, first_index), entries) in hash_map {
        let mut distinct_mods: Vec<String> = entries.iter().map(|(m, _, _)| m.clone()).collect();
        distinct_mods.sort();
        distinct_mods.dedup();

        if distinct_mods.len() > 1 {
            let affected_component = entries
                .iter()
                .find(|(_, _, comp)| !comp.is_empty() && comp != "General")
                .map(|(_, _, comp)| comp.clone())
                .unwrap_or_else(|| entries[0].2.clone());

            let is_fatal = is_fatal_component(&affected_component);

            // Light sensitivity: only report critical mesh/geometry collisions (IB/VB)
            if warning_level.eq_ignore_ascii_case("light") && !is_fatal {
                continue;
            }

            conflicts.push(ModConflict {
                hash,
                first_index,
                affected_component,
                conflicting_mods: distinct_mods,
                is_fatal,
            });
        }
    }

    HashAnalysisResult {
        conflicts,
        mod_hashes,
    }
}

pub fn analyze_mod_hashes_internal(
    mods_dir: &str,
    warning_level: &str,
) -> Result<HashAnalysisResult, AppError> {
    let mods_dir_expanded = crate::utils::expand_path(mods_dir);
    let root = Path::new(&mods_dir_expanded);
    if !root.exists() || !root.is_dir() {
        return Ok(HashAnalysisResult {
            conflicts: Vec::new(),
            mod_hashes: HashMap::new(),
        });
    }

    let active_mods = crate::utils::discover_active_mods(root);
    Ok(analyze_mod_hashes_from_active_mods(root, &active_mods, warning_level))
}

#[tauri::command]
pub async fn analyze_mod_hashes(
    mods_dir: String,
    warning_level: String,
) -> Result<HashAnalysisResult, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        analyze_mod_hashes_internal(&mods_dir, &warning_level)
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_component_name() {
        assert_eq!(extract_component_name("[TextureOverrideJaneDoeHRFace]"), "Face");
        assert_eq!(extract_component_name("TextureOverrideBelleBody"), "Body");
        assert_eq!(extract_component_name("TextureOverrideAnbyHair"), "Hair");
        assert_eq!(extract_component_name("TextureOverrideCustomOutfit"), "Outfit");
    }

    #[test]
    fn test_extract_overrides_from_ini() {
        let ini_content = r#"
[TextureOverrideJaneDoeHRFace]
hash = 9af848eb
match_first_index = 0

[TextureOverrideBelleBody]
hash = 0x12345678
match_first_index = 256
"#;
        let overrides = extract_overrides_from_ini(ini_content, "test.ini");
        assert_eq!(overrides.len(), 2);
        assert_eq!(overrides[0].hash, "9af848eb");
        assert_eq!(overrides[0].first_index, 0);
        assert_eq!(overrides[0].component_name, "Face");

        assert_eq!(overrides[1].hash, "12345678");
        assert_eq!(overrides[1].first_index, 256);
        assert_eq!(overrides[1].component_name, "Body");
    }

    #[test]
    fn test_get_mod_id_preserves_specific_mod_folder() {
        let root = Path::new("C:/Mods");
        let ini1 = Path::new("C:/Mods/Playable Characters/Anby/Mod1/mod.ini");
        let dir1 = Path::new("C:/Mods/Playable Characters/Anby/Mod1");
        let disabled_dir = Path::new("C:/Mods/Playable Characters/Anby/DISABLED Mod2");

        assert_eq!(get_mod_id(root, ini1, "light"), "Playable Characters/Anby/Mod1");
        assert_eq!(get_mod_id(root, ini1, "heavy"), "Playable Characters/Anby/Mod1");
        assert_eq!(get_mod_id(root, dir1, "heavy"), "Playable Characters/Anby/Mod1");
        assert_eq!(get_mod_id(root, disabled_dir, "heavy"), "Playable Characters/Anby/Mod2");
    }

    #[test]
    fn test_conflict_scanning_isolation() {
        use std::path::PathBuf;
        use crate::models::ParsedIni;
        use crate::utils::ActiveModEntry;

        let root = Path::new("C:/Mods");
        let mod_a = ActiveModEntry {
            category: "Anby".to_string(),
            folder_name: "ModA".to_string(),
            mod_path: PathBuf::from("C:/Mods/Anby/ModA"),
            ini_files: vec![],
            parsed_inis: vec![ParsedIni {
                path: PathBuf::from("C:/Mods/Anby/ModA/mod.ini"),
                rel_path: "mod.ini".to_string(),
                overrides: vec![HashOverride {
                    file: "mod.ini".to_string(),
                    section: "TextureOverride".to_string(),
                    hash: "9af848eb".to_string(),
                    first_index: 0,
                    component_name: "Face".to_string(),
                }],
                integrity_warnings: vec![],
            }],
        };

        let mod_b = ActiveModEntry {
            category: "Anby".to_string(),
            folder_name: "ModB".to_string(),
            mod_path: PathBuf::from("C:/Mods/Anby/ModB"),
            ini_files: vec![],
            parsed_inis: vec![ParsedIni {
                path: PathBuf::from("C:/Mods/Anby/ModB/mod.ini"),
                rel_path: "mod.ini".to_string(),
                overrides: vec![HashOverride {
                    file: "mod.ini".to_string(),
                    section: "TextureOverride".to_string(),
                    hash: "9af848eb".to_string(),
                    first_index: 0,
                    component_name: "Face".to_string(),
                }],
                integrity_warnings: vec![],
            }],
        };

        let mod_c = ActiveModEntry {
            category: "Jane".to_string(),
            folder_name: "ModC".to_string(),
            mod_path: PathBuf::from("C:/Mods/Jane/ModC"),
            ini_files: vec![],
            parsed_inis: vec![ParsedIni {
                path: PathBuf::from("C:/Mods/Jane/ModC/mod.ini"),
                rel_path: "mod.ini".to_string(),
                overrides: vec![HashOverride {
                    file: "mod.ini".to_string(),
                    section: "TextureOverride".to_string(),
                    hash: "9af848eb".to_string(),
                    first_index: 0,
                    component_name: "Face".to_string(),
                }],
                integrity_warnings: vec![],
            }],
        };

        // Intra-character conflicts: ModA & ModB in Anby both active -> must report conflict
        let intra_conflicts = scan_conflicts_from_active_mods(root, &[mod_a.clone(), mod_b.clone()], "light");
        assert_eq!(intra_conflicts.len(), 1);
        assert_eq!(intra_conflicts[0].conflicting_mods, vec!["Anby/ModA", "Anby/ModB"]);

        // 3 active mods in Anby: ModA, ModB, and ModA3 -> all 3 reported
        let mod_a3 = ActiveModEntry {
            category: "Anby".to_string(),
            folder_name: "ModA3".to_string(),
            mod_path: PathBuf::from("C:/Mods/Anby/ModA3"),
            ini_files: vec![],
            parsed_inis: vec![ParsedIni {
                path: PathBuf::from("C:/Mods/Anby/ModA3/mod.ini"),
                rel_path: "mod.ini".to_string(),
                overrides: vec![HashOverride {
                    file: "mod.ini".to_string(),
                    section: "TextureOverride".to_string(),
                    hash: "9af848eb".to_string(),
                    first_index: 0,
                    component_name: "Face".to_string(),
                }],
                integrity_warnings: vec![],
            }],
        };
        let triple_conflicts = scan_conflicts_from_active_mods(root, &[mod_a.clone(), mod_b.clone(), mod_a3.clone()], "light");
        assert_eq!(triple_conflicts.len(), 1);
        assert_eq!(triple_conflicts[0].conflicting_mods, vec!["Anby/ModA", "Anby/ModA3", "Anby/ModB"]);

        // Cross-character conflict: ModA (Anby) and ModC (Jane)
        let cross_conflicts = scan_conflicts_from_active_mods(root, &[mod_a.clone(), mod_c.clone()], "light");
        assert_eq!(cross_conflicts.len(), 1);
        assert_eq!(cross_conflicts[0].conflicting_mods, vec!["Anby/ModA", "Jane/ModC"]);
    }

    #[test]
    fn test_is_fatal_component_distinguishes_geometry_and_textures() {
        // Fatal geometry components
        assert!(is_fatal_component("Face"));
        assert!(is_fatal_component("Body"));
        assert!(is_fatal_component("Hair"));
        assert!(is_fatal_component("Head"));
        assert!(is_fatal_component("Dress"));
        assert!(is_fatal_component("IB"));
        assert!(is_fatal_component("Position"));
        assert!(is_fatal_component("Blend"));
        assert!(is_fatal_component("VB"));

        // Non-fatal cosmetic texture overrides
        assert!(!is_fatal_component("Diffuse"));
        assert!(!is_fatal_component("NormalMap"));
        assert!(!is_fatal_component("LightMap"));
        assert!(!is_fatal_component("MaterialMap"));
        assert!(!is_fatal_component("Shadow"));
        assert!(!is_fatal_component("Outline"));
        assert!(!is_fatal_component("Tex0"));
        assert!(!is_fatal_component("TexCoord"));
        assert!(!is_fatal_component("General"));
    }

    #[test]
    fn test_conflict_scanner_sensitivity_light_vs_heavy() {
        use std::path::PathBuf;
        use crate::models::ParsedIni;
        use crate::utils::ActiveModEntry;

        let root = Path::new("C:/Mods");

        // Two mods with texture-only overlap (Diffuse texture)
        let mod_tex1 = ActiveModEntry {
            category: "Anby".to_string(),
            folder_name: "RecolorA".to_string(),
            mod_path: PathBuf::from("C:/Mods/Anby/RecolorA"),
            ini_files: vec![],
            parsed_inis: vec![ParsedIni {
                path: PathBuf::from("C:/Mods/Anby/RecolorA/mod.ini"),
                rel_path: "mod.ini".to_string(),
                overrides: vec![HashOverride {
                    file: "mod.ini".to_string(),
                    section: "TextureOverrideAnbyDiffuse".to_string(),
                    hash: "55556666".to_string(),
                    first_index: 0,
                    component_name: "Diffuse".to_string(),
                }],
                integrity_warnings: vec![],
            }],
        };

        let mod_tex2 = ActiveModEntry {
            category: "Anby".to_string(),
            folder_name: "RecolorB".to_string(),
            mod_path: PathBuf::from("C:/Mods/Anby/RecolorB"),
            ini_files: vec![],
            parsed_inis: vec![ParsedIni {
                path: PathBuf::from("C:/Mods/Anby/RecolorB/mod.ini"),
                rel_path: "mod.ini".to_string(),
                overrides: vec![HashOverride {
                    file: "mod.ini".to_string(),
                    section: "TextureOverrideAnbyDiffuse".to_string(),
                    hash: "55556666".to_string(),
                    first_index: 0,
                    component_name: "Diffuse".to_string(),
                }],
                integrity_warnings: vec![],
            }],
        };

        // Light mode (Fatal only): Non-fatal texture collision should be ignored
        let light_conflicts = scan_conflicts_from_active_mods(root, &[mod_tex1.clone(), mod_tex2.clone()], "light");
        assert_eq!(light_conflicts.len(), 0, "Light mode must filter out cosmetic texture conflicts");

        // Heavy mode (Strict): All overlaps including textures must be reported
        let heavy_conflicts = scan_conflicts_from_active_mods(root, &[mod_tex1, mod_tex2], "heavy");
        assert_eq!(heavy_conflicts.len(), 1, "Heavy mode must report all hash overlaps");
        assert_eq!(heavy_conflicts[0].hash, "55556666");
        assert!(!heavy_conflicts[0].is_fatal);
    }
}
