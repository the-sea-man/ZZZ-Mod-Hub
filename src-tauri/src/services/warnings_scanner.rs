use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};

use crate::utils::{build_hash_alias_map, find_ini_files, read_ini_to_string, is_generic_shared_hash};

use crate::models::ModWarning;

/// Determines if a `Help = null` line in `[Present]` is a rogue every-frame reset
/// rather than a legitimate time-based or one-shot state dismissal.
pub fn is_rogue_hud_erasure(section_lines: &[String], line_idx: usize) -> bool {
    let target_line = &section_lines[line_idx];
    let l_lower = target_line.to_lowercase();
    let has_help_null = if let Some((k, v)) = l_lower.split_once('=') {
        let k_trim = k.trim();
        (k_trim.contains("help") && !k_trim.contains("helpshort")) && v.trim() == "null"
    } else {
        false
    };
    if !has_help_null {
        return false;
    }

    // Build the stack of active `if` conditions enclosing this line
    let mut condition_stack: Vec<String> = Vec::new();
    for (idx, line) in section_lines.iter().enumerate() {
        if idx == line_idx {
            break;
        }
        let trimmed = line.trim();
        let trimmed_lower = trimmed.to_lowercase();
        if trimmed_lower.starts_with("if ") || trimmed_lower.starts_with("if\t") {
            let cond = trimmed[2..].trim().to_string();
            condition_stack.push(cond);
        } else if trimmed_lower == "endif" || trimmed_lower.starts_with("endif ") {
            condition_stack.pop();
        }
    }

    // 1. If at top-level of [Present] (no enclosing `if` block), it runs unconditionally every frame -> ROGUE
    if condition_stack.is_empty() {
        return true;
    }

    // 2. Check if ANY enclosing `if` condition uses a time-based check (e.g. `time - $menuTimeout >= 1.2`, `time >= $timeout`)
    for cond in &condition_stack {
        let cond_lower = cond.to_lowercase();
        if cond_lower.contains("time") {
            return false;
        }
    }

    // 3. Check if the block toggles a state variable (e.g. `post $menuOff = 1` or `post $var = 0`) that invalidates the condition
    for cond in &condition_stack {
        let cond_lower = cond.to_lowercase();
        for block_line in section_lines {
            let bl_lower = block_line.to_lowercase();
            if (bl_lower.contains("post $") || bl_lower.starts_with('$')) && bl_lower.contains('=') {
                if let Some((var_part, _)) = bl_lower.split_once('=') {
                    let var_clean = var_part.trim().trim_start_matches("post ").trim();
                    if !var_clean.is_empty() && cond_lower.contains(var_clean) && var_clean != "$active" {
                        return false;
                    }
                }
            }
        }
    }

    // If it's `if $active == 1` or `if $active == 0` without time/state reset, it runs continuously on every frame -> ROGUE
    true
}

/// Statically analyzes an INI file for anti-patterns, rogue present loops, and unconditional keybinds.
pub fn analyze_ini_script_integrity(content: &str, file_name: &str) -> Vec<ModWarning> {
    let mut warnings = Vec::new();
    let norm_name = file_name.replace('\\', "/");
    let base_name = norm_name.rsplit('/').next().unwrap_or(&norm_name);

    // Skip internal manager-generated files
    if base_name.starts_with("zzzmanager_ui_") || base_name.starts_with("000_zzzmanager_ui_") || norm_name.contains("zzzzzz_ZZZModManagerUI") {
        return warnings;
    }

    // 1. Standalone help.ini detection (INI issue severity)
    if base_name.eq_ignore_ascii_case("help.ini") {
        warnings.push(ModWarning {
            rule_id: "standalone_help".to_string(),
            level: "ini_issue".to_string(),
            message: format!(
                "Bundled 'help.ini' found in '{}'. This legacy menu script can conflict with ZZMI's global HUD and cause in-game text to disappear. Use '⚡ Auto-Fix' to safely disable it.",
                file_name
            ),
            details: None,
        });
    }

    // Parse sections
    struct Section {
        name: String,
        lines: Vec<String>,
    }

    let mut sections: Vec<Section> = Vec::new();
    let mut current_section_name: Option<String> = None;
    let mut current_lines: Vec<String> = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(';') || trimmed.starts_with('#') || trimmed.is_empty() {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            if let Some(name) = current_section_name.take() {
                sections.push(Section {
                    name,
                    lines: std::mem::take(&mut current_lines),
                });
            }
            let sec_name = trimmed[1..trimmed.len() - 1].trim().to_string();
            current_section_name = Some(sec_name);
        } else if current_section_name.is_some() {
            current_lines.push(trimmed.to_string());
        }
    }

    if let Some(name) = current_section_name {
        sections.push(Section {
            name,
            lines: current_lines,
        });
    }

    let draw_re = regex::Regex::new(r"(?i)draw(?:indexed)?\s*=\s*(\d+)").unwrap();
    let mut file_max_draw: u32 = 0;
    for section in &sections {
        for l in &section.lines {
            if let Some(caps) = draw_re.captures(l) {
                if let Some(m) = caps.get(1) {
                    if let Ok(val) = m.as_str().parse::<u32>() {
                        if val > file_max_draw {
                            file_max_draw = val;
                        }
                    }
                }
            }
        }
    }

    // Duplicate section headers detection (INI issue severity)
    let mut seen_section_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut reported_duplicate_sections: std::collections::HashSet<String> = std::collections::HashSet::new();
    for section in &sections {
        let sec_lower = section.name.to_lowercase();
        // 3DMigoto natively supports and sequentially executes multiple [Constants] and [Present] sections
        if sec_lower == "constants" || sec_lower == "present" {
            continue;
        }
        if !seen_section_names.insert(sec_lower.clone()) && reported_duplicate_sections.insert(sec_lower) {
            warnings.push(ModWarning {
                rule_id: "duplicate_section".to_string(),
                level: "ini_issue".to_string(),
                message: format!(
                    "Duplicate section '[{}]' found in '{}'. In 3DMigoto, duplicate sections trigger runtime parsing errors and cause entries to be skipped or fail to load. Use '⚡ Auto-Fix' to remove duplicate sections.",
                    section.name, file_name
                ),
                details: None,
            });
        }
    }

    for section in &sections {
        let sec_lower = section.name.to_lowercase();

        // Missing 'ref' keyword on Resource assignments (e.g. Resource\ZZMI\... = Resource...)
        for line in &section.lines {
            let l_trim = line.trim();
            if l_trim.starts_with(';') || l_trim.starts_with('#') { continue; }
            if let Some((k, v)) = l_trim.split_once('=') {
                let k_trim = k.trim();
                let k_lower = k_trim.to_lowercase();
                let v_trim = v.trim();
                let v_lower = v_trim.to_lowercase();

                if (k_lower.starts_with("resource\\") || k_lower.starts_with("resource/"))
                    && (v_lower.starts_with("resource") && !v_lower.starts_with("ref ") && !v_lower.starts_with("ref\t"))
                {
                    warnings.push(ModWarning {
                        rule_id: "missing_resource_ref".to_string(),
                        level: "ini_issue".to_string(),
                        message: format!(
                            "Missing 'ref' keyword in '{}' (section '[{}]', line '{}'). In ZZMI, texture slot references must use 'ref' (e.g. '{} = ref {}') to bind properly in DirectX. Use '⚡ Auto-Fix' to fix this.",
                            file_name, section.name, l_trim, k_trim, v_trim
                        ),
                        details: None,
                    });
                }
            }
        }

        // Unconditional texture override after a draw call
        if sec_lower.starts_with("textureoverride") {
            let mut has_drawn = false;
            let mut condition_depth = 0;
            let mut flagged_unconditional = false;

            for line in &section.lines {
                let l_trim = line.trim();
                if l_trim.starts_with(';') || l_trim.starts_with('#') { continue; }
                let l_lower = l_trim.to_lowercase();

                if l_lower.starts_with("if ") || l_lower.starts_with("if\t") {
                    condition_depth += 1;
                } else if l_lower == "endif" || l_lower.starts_with("endif ") {
                    if condition_depth > 0 {
                        condition_depth -= 1;
                    }
                } else if l_lower.starts_with("draw ") || l_lower.starts_with("draw=") || l_lower.starts_with("drawindexed") {
                    has_drawn = true;
                } else if has_drawn && condition_depth == 0 && !flagged_unconditional
                    && (l_lower.starts_with("resource\\") || l_lower.starts_with("resource/") || l_lower.contains("settextures")) {
                        flagged_unconditional = true;
                        warnings.push(ModWarning {
                            rule_id: "unconditional_texture_override".to_string(),
                            level: "ini_issue".to_string(),
                            message: format!(
                                "Unconditional texture override in '{}' (section '[{}]'). Textures are re-assigned or SetTextures is run after a draw call outside of an 'if' condition block, which clobbers texture registers and causes texture flickering/Z-fighting in-game.",
                                file_name, section.name
                            ),
                            details: None,
                        });
                    }
            }
        }

        // 2a. Rogue HUD text manipulation in [Present] (INI issue severity)
        // Detects scripts that clear global HUD text every frame inside [Present] loops
        if sec_lower == "present" {
            for (idx, _line) in section.lines.iter().enumerate() {
                if is_rogue_hud_erasure(&section.lines, idx) {
                    warnings.push(ModWarning {
                        rule_id: "rogue_hud".to_string(),
                        level: "ini_issue".to_string(),
                        message: format!(
                            "Global HUD reset in '{}' (section '[{}]'). The script clears on-screen menu text ('Help = null') unconditionally every frame, which hides menus for other active mods. Use '⚡ Auto-Fix' to disable this line.",
                            file_name, section.name
                        ),
                        details: None,
                    });
                    break;
                }
            }
        }

        // 2b. Rogue HUD text manipulation inside CommandLists called from [Present]
        if sec_lower.starts_with("commandlist") {
            let has_help_null = section.lines.iter().any(|l| {
                let l_lower = l.to_lowercase();
                (l_lower.contains("help") && !l_lower.contains("helpshort")) && (l_lower.contains("= null") || l_lower.contains("=null"))
            });
            if has_help_null {
                let called_from_present = sections.iter().any(|s| {
                    s.name.to_lowercase() == "present" && s.lines.iter().any(|l| {
                        let l_lower = l.to_lowercase();
                        l_lower.contains(&format!("run = {}", sec_lower)) || l_lower.contains(&format!("run={}", sec_lower))
                    })
                });
                if called_from_present {
                    warnings.push(ModWarning {
                        rule_id: "rogue_hud".to_string(),
                        level: "ini_issue".to_string(),
                        message: format!(
                            "Global HUD reset in '{}' (CommandList '[{}]' called from [Present]). The script clears on-screen menu text ('Help = null') unconditionally every frame, which hides menus for other active mods. Use '⚡ Auto-Fix' to disable this line.",
                            file_name, section.name
                        ),
                        details: None,
                    });
                }
            }
        }

        // 3. Unconditional [Key...] bindings (INI issue severity)
        if sec_lower.starts_with("key") {
            let mut key_val: Option<String> = None;
            let mut condition_val: Option<String> = None;
            let mut has_action = false;

            for line in &section.lines {
                let l_lower = line.to_lowercase();
                if let Some((k, v)) = line.split_once('=') {
                    let k_trim = k.trim().to_lowercase();
                    let v_trim = v.trim();
                    if k_trim == "key" {
                        key_val = Some(v_trim.to_string());
                    } else if k_trim == "condition" {
                        condition_val = Some(v_trim.to_string());
                    } else if k_trim == "type" || k_trim == "run" || k_trim.starts_with('$') {
                        has_action = true;
                    }
                } else if l_lower.starts_with('$') && l_lower.contains('=') {
                    has_action = true;
                }
            }

            if let Some(key_str) = key_val {
                if has_action {
                    let is_unconditional = match condition_val {
                        None => true,
                        Some(ref cond) => {
                            let c_trim = cond.trim();
                            let c_lower = c_trim.to_lowercase();
                            c_trim.is_empty() || c_trim == "1 == 1" || c_trim == "1==1" || !c_lower.contains("$active")
                        }
                    };

                    if is_unconditional {
                        warnings.push(ModWarning {
                            rule_id: "unconditional_key".to_string(),
                            level: "ini_issue".to_string(),
                            message: format!(
                                "Global hotkey in '{}' (section '[{}]' on key '{}'). Missing character check ('condition = $active == 1'); pressing this key will trigger toggles even when playing as other characters.",
                                file_name, section.name, key_str
                            ),
                            details: None,
                        });
                    }
                }
            }
        }

        // 4. Missing/Empty VertexLimitRaise override_vertex_count (causes exploding polygons in-game)
        if sec_lower.contains("vertexlimitraise") {
            let content_lines: Vec<&String> = section.lines.iter()
                .filter(|l| {
                    let t = l.trim();
                    !t.is_empty() && !t.starts_with(';') && !t.starts_with('#')
                })
                .collect();

            // Sections generated by Blender GIMI exporter often contain just `hash = ...`.
            // If the section only specifies a hash and has no other properties (e.g. override_byte_stride),
            // and the mod's draw vertex count is within normal game limits (<= 25000), it is a benign no-op stub.
            let has_other_properties = content_lines.iter().any(|l| {
                let l_lower = l.to_lowercase();
                !l_lower.starts_with("hash")
            });

            let is_high_poly = file_max_draw > 25000;

            if has_other_properties || is_high_poly {
                let has_override = content_lines.iter().any(|l| {
                    let l_lower = l.to_lowercase();
                    if let Some((k, v)) = l_lower.split_once('=') {
                        k.trim() == "override_vertex_count" && !v.trim().is_empty() && v.trim() != "0"
                    } else {
                        false
                    }
                });
                if !has_override {
                    warnings.push(ModWarning {
                        rule_id: "missing_vertex_limit_override".to_string(),
                        level: "ini_issue".to_string(),
                        message: format!(
                            "Incomplete VertexLimitRaise section in '{}' (section '[{}]'). Missing 'override_vertex_count', which causes vertex buffer overflow and mesh distortion/exploding polygons in-game.",
                            file_name, section.name
                        ),
                        details: None,
                    });
                }
            }
        }
    }

    // 5. Missing / Undefined Buffer Resources (causes DirectX crash to desktop)
    let defined_resources: std::collections::HashSet<String> = sections.iter()
        .filter(|s| s.name.to_lowercase().starts_with("resource"))
        .map(|s| s.name.to_lowercase())
        .collect();

    let mut reported_missing_resources = std::collections::HashSet::new();
    for section in &sections {
        for line in &section.lines {
            let l_trim = line.trim();
            if l_trim.starts_with(';') || l_trim.starts_with('#') { continue; }
            if let Some((k, v)) = l_trim.split_once('=') {
                let k_trim = k.trim().to_lowercase();
                if k_trim == "vb0" || k_trim == "vb1" || k_trim == "vb2" || k_trim == "ib" {
                    let val_trim = v.trim().trim_start_matches("ref").trim();
                    let val_lower = val_trim.to_lowercase();
                    if !val_lower.contains('\\') && val_lower.starts_with("resource")
                        && !defined_resources.contains(&val_lower) && reported_missing_resources.insert(val_lower) {
                            warnings.push(ModWarning {
                                rule_id: "missing_resource_definition".to_string(),
                                level: "crash_risk".to_string(),
                                message: format!(
                                    "Missing resource definition '[{}]' in '{}'. The script assigns buffer '{} = {}' without defining the resource, which causes an immediate DirectX crash to desktop when the character spawns. Use '⚡ Auto-Fix' to generate the missing definition.",
                                    val_trim, file_name, k.trim(), val_trim
                                ),
                                details: None,
                            });
                        }
                }
            }
        }
    }

    warnings
}

/// Perform the warnings scan synchronously and return mod_path -> list of structured warning objects.
pub fn scan_warnings(mods_dir: &str, db_path: &str) -> HashMap<String, Vec<ModWarning>> {
    scan_warnings_with_cancel(mods_dir, db_path, None)
}

pub fn scan_warnings_with_cancel(
    mods_dir: &str,
    db_path: &str,
    cancel_token: Option<&std::sync::Arc<std::sync::atomic::AtomicBool>>,
) -> HashMap<String, Vec<ModWarning>> {
    let mut warnings_map: HashMap<String, Vec<ModWarning>> = HashMap::new();
    let mods_dir_expanded = crate::utils::expand_path(mods_dir);
    let root = Path::new(&mods_dir_expanded);
    if !root.exists() || !root.is_dir() {
        return warnings_map;
    }

    if let Some(token) = cancel_token {
        if token.load(std::sync::atomic::Ordering::Relaxed) {
            return warnings_map;
        }
    }

    // 1. Single unified active mod discovery pass
    let active_mods = crate::utils::discover_active_mods(root);

    // 2. Hash alias map for multi-character detection & generic shared hash filtering
    let hash_alias_map = build_hash_alias_map(Path::new(db_path));
    let fixer_db = crate::mod_fixer::load_fixer_database(Some(Path::new(db_path)));

    if let Some(token) = cancel_token {
        if token.load(std::sync::atomic::Ordering::Relaxed) {
            return warnings_map;
        }
    }

    // 3. Conflict scanning directly on active mods (0 redundant disk crawls!)
    let conflicts = crate::conflict_scanner::scan_conflicts_from_active_mods(root, &active_mods, "light");
    for conflict in conflicts {
        let conflict_msg = format!(
            "Hash Conflict: Hash {} (component '{}') conflicts with active mod(s): {}",
            conflict.hash,
            conflict.affected_component,
            conflict.conflicting_mods.join(", ")
        );

        let warn_item = ModWarning {
            rule_id: "conflict".to_string(),
            level: "conflict".to_string(),
            message: conflict_msg,
            details: None,
        };

        for mod_identifier in &conflict.conflicting_mods {
            let full_mod_path = active_mods
                .iter()
                .find(|e| {
                    let id = crate::conflict_scanner::get_mod_id(root, &e.mod_path, "heavy");
                    &id == mod_identifier
                })
                .map(|e| e.mod_path.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|| mod_identifier.clone());

            let mod_warnings = warnings_map.entry(full_mod_path).or_default();
            if !mod_warnings.contains(&warn_item) {
                mod_warnings.push(warn_item.clone());
            }
        }
    }

    // 4. Parallel analysis directly over pre-discovered active mods
    use rayon::prelude::*;
    let cancel_token_clone = cancel_token.cloned();
    let per_mod_warnings: Vec<(String, Vec<ModWarning>)> = active_mods
        .into_par_iter()
        .filter_map(|entry| {
            if let Some(ref token) = cancel_token_clone {
                if token.load(std::sync::atomic::Ordering::Relaxed) {
                    return None;
                }
            }
            let mod_path = entry.mod_path;
            let mod_path_str = mod_path.to_string_lossy().replace('\\', "/");
            let mut mod_warnings: Vec<ModWarning> = Vec::new();

            // 2.5 Outdated Game Version / Hash Fix Analysis
            let fix_analysis = crate::mod_fixer::analyze_mod_for_fixes(&mod_path, &fixer_db);
            if fix_analysis.is_fixable {
                let char_name = fix_analysis.detected_character.as_deref().unwrap_or("Character");
                let v_from = fix_analysis.detected_version_from.as_deref().unwrap_or("1.0");
                let v_to = fix_analysis.detected_version_to.as_deref().unwrap_or("3.1");
                let warn_item = ModWarning {
                    rule_id: "outdated_version".to_string(),
                    level: "outdated_version".to_string(),
                    message: format!(
                        "Outdated Game Version: Mod contains {} outdated hash(es) for {} (v{} -> v{}).",
                        fix_analysis.total_fixes, char_name, v_from, v_to
                    ),
                    details: Some(format!(
                        "Character: {}\nHashes to upgrade: {}\nBuffer remappings: {}",
                        char_name,
                        fix_analysis.hash_fixes.len(),
                        fix_analysis.buffer_fixes.len()
                    )),
                };
                if !mod_warnings.contains(&warn_item) {
                    mod_warnings.push(warn_item);
                }
            }

            let mut any_hashes_found = false;
            // CategoryName -> (CharacterId, BTreeMap<ComponentName, Vec<Hash>>)
            let mut category_map: HashMap<String, (String, std::collections::BTreeMap<String, Vec<String>>)> = HashMap::new();

            for ini in &entry.parsed_inis {
                for w in &ini.integrity_warnings {
                    if w.rule_id == "missing_resource_definition" && entry.parsed_inis.len() > 1 {
                        // Check if a sibling INI in this mod defines this resource section
                        if let Some(res_name) = w.message.split_once("Missing resource definition '[").and_then(|(_, r)| r.split_once("]'").map(|(m, _)| m)) {
                            let target_header = format!("[{}]", res_name.to_lowercase());
                            let defined_in_sibling = entry.parsed_inis.iter().any(|other_ini| {
                                if other_ini.path == ini.path {
                                    return false;
                                }
                                if let Ok(content) = crate::utils::read_ini_to_string(&other_ini.path) {
                                    content.lines().any(|l| {
                                        let trimmed = l.trim().to_lowercase();
                                        trimmed == target_header
                                    })
                                } else {
                                    false
                                }
                            });
                            if defined_in_sibling {
                                continue;
                            }
                        }
                    }

                    if !mod_warnings.contains(w) {
                        mod_warnings.push(w.clone());
                    }
                }

                for ov in &ini.overrides {
                    let clean_hash = ov.hash.to_lowercase();
                    any_hashes_found = true;

                    // Skip generic shared texture hashes (like ebac056e)
                    if is_generic_shared_hash(&clean_hash, &hash_alias_map) {
                        continue;
                    }

                    if let Some(targets) = hash_alias_map.get(&clean_hash) {
                        for target in targets {
                            let comp = target.component_name.clone().unwrap_or_else(|| {
                                if ov.component_name != "General" {
                                    ov.component_name.clone()
                                } else {
                                    "General".to_string()
                                }
                            });

                            let (_, comp_map) = category_map
                                .entry(target.category_name.clone())
                                .or_insert_with(|| (target.character_id.clone(), std::collections::BTreeMap::new()));

                            let hashes = comp_map.entry(comp).or_default();
                            if !hashes.contains(&clean_hash) {
                                hashes.push(clean_hash.clone());
                            }
                        }
                    }
                }
            }

                    if any_hashes_found && category_map.len() > 1 {
                        let is_multi_char = {
                            let mut cids = std::collections::HashSet::new();
                            for (cid, _) in category_map.values() {
                                cids.insert(cid.as_str());
                            }
                            cids.len() > 1
                        };

                        let current_category_name = entry.category.clone();
                        let has_current_category = category_map.contains_key(&current_category_name);

                        // 1. Build Compact Message (Highlighting only other/unintended targets)
                        let message = if has_current_category {
                            let other_categories: Vec<_> = category_map
                                .iter()
                                .filter(|(cat, _)| *cat != &current_category_name)
                                .collect();

                            let mut other_formatted = Vec::new();
                            for (cat, (_cid, comp_map)) in other_categories {
                                let comp_names: Vec<&str> = comp_map.keys().map(|s| s.as_str()).collect();
                                other_formatted.push(format!("{} ({})", cat, comp_names.join(", ")));
                            }
                            other_formatted.sort();

                            if is_multi_char {
                                format!("Also affects other character(s): {}", other_formatted.join("; "))
                            } else {
                                format!("Also affects other outfit(s): {}", other_formatted.join("; "))
                            }
                        } else {
                            let mut all_formatted = Vec::new();
                            for (cat, (_cid, comp_map)) in &category_map {
                                let comp_names: Vec<&str> = comp_map.keys().map(|s| s.as_str()).collect();
                                all_formatted.push(format!("{} ({})", cat, comp_names.join(", ")));
                            }
                            all_formatted.sort();

                            if is_multi_char {
                                format!("Affects multiple characters: {}", all_formatted.join("; "))
                            } else {
                                format!("Affects multiple outfits: {}", all_formatted.join("; "))
                            }
                        };

                        // 2. Build Full Expandable Breakdown (Details)
                        let mut sorted_categories: Vec<_> = category_map.into_iter().collect();
                        sorted_categories.sort_by(|a, b| {
                            let a_is_curr = a.0 == current_category_name;
                            let b_is_curr = b.0 == current_category_name;
                            match (a_is_curr, b_is_curr) {
                                (true, false) => std::cmp::Ordering::Greater, // Current category at the bottom
                                (false, true) => std::cmp::Ordering::Less,
                                _ => a.0.cmp(&b.0),
                            }
                        });

                        let mut detail_lines = Vec::new();
                        for (cat_name, (_cid, comp_map)) in sorted_categories {
                            let is_curr = cat_name == current_category_name;
                            let label = if is_curr {
                                format!("• {} (Current Folder):", cat_name)
                            } else {
                                format!("• {}:", cat_name)
                            };

                            let mut comp_parts = Vec::new();
                            for (comp_name, mut hashes) in comp_map {
                                hashes.sort();
                                comp_parts.push(format!("{} [{}]", comp_name, hashes.join(", ")));
                            }
                            detail_lines.push(format!("{} {}", label, comp_parts.join(", ")));
                        }

                        let warn_item = ModWarning {
                            rule_id: "multi_character".to_string(),
                            level: "warning".to_string(),
                            message,
                            details: Some(detail_lines.join("\n")),
                        };
                        if !mod_warnings.contains(&warn_item) {
                            mod_warnings.push(warn_item);
                        }
                    }

            if !mod_warnings.is_empty() {
                Some((mod_path_str, mod_warnings))
            } else {
                None
            }
        })
        .collect();

    if let Some(token) = cancel_token {
        if token.load(std::sync::atomic::Ordering::Relaxed) {
            return HashMap::new();
        }
    }

    for (mod_path_str, warns) in per_mod_warnings {
        let entry = warnings_map.entry(mod_path_str).or_default();
        for w in warns {
            if !entry.contains(&w) {
                entry.push(w);
            }
        }
    }

    warnings_map
}

#[tauri::command]
pub fn start_warnings_scan(app: AppHandle, mods_dir: String, task_id: Option<String>) {
    let t_id = task_id.unwrap_or_else(|| "warnings:active".to_string());
    let _ = crate::task_manager::cancel_by_prefix_sync("warnings:");
    let guard = crate::task_manager::register_task(&t_id, "warnings");
    let cancel_token = guard.token();

    tauri::async_runtime::spawn(async move {
        let _guard = guard;
        if let Ok(app_dir) = app.path().app_data_dir() {
            let db_path = app_dir.to_string_lossy().to_string();
            let warnings_map = scan_warnings_with_cancel(&mods_dir, &db_path, Some(&cancel_token));
            if !cancel_token.load(std::sync::atomic::Ordering::Relaxed) {
                let _ = app.emit("warnings_updated", warnings_map);
            }
        }
    });
}

/// Recovers erroneously commented out [Constants] and [Present] sections caused by legacy duplicate-section rules.
pub fn recover_erroneously_commented_sections(content: &str) -> (String, bool, Vec<String>) {
    let mut restored_lines: Vec<String> = Vec::new();
    let mut changed = false;
    let mut actions = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim();

        if trimmed == "; [ZZZMODMANAGER AUTO-FIX: Commented out duplicate section header]"
            && i + 1 < lines.len() {
                let next_line = lines[i + 1].trim();
                if next_line.starts_with(';') {
                    let uncomm = next_line.trim_start_matches(';').trim();
                    if uncomm.starts_with('[') && uncomm.ends_with(']') {
                        let sec_name = uncomm[1..uncomm.len() - 1].trim().to_lowercase();
                        if sec_name == "constants" || sec_name == "present" {
                            changed = true;
                            let raw_sec_name = uncomm[1..uncomm.len() - 1].trim();
                            actions.push(format!("Restored erroneously commented-out '[{}]' section", raw_sec_name));
                            i += 1;
                            restored_lines.push(format!("[{}]", raw_sec_name));
                            i += 1;

                            while i < lines.len() {
                                let body_line = lines[i];
                                let body_trim = body_line.trim();

                                if (body_trim.starts_with('[') && body_trim.ends_with(']'))
                                    || body_trim == "; [ZZZMODMANAGER AUTO-FIX: Commented out duplicate section header]"
                                {
                                    break;
                                }
                                if body_trim.starts_with(';') {
                                    let after_semi = body_trim.trim_start_matches(';').trim();
                                    if after_semi.starts_with('[') && after_semi.ends_with(']') {
                                        break;
                                    }
                                }

                                if let Some(stripped) = body_line.strip_prefix("; ") {
                                    restored_lines.push(stripped.to_string());
                                } else if let Some(stripped) = body_line.strip_prefix(';') {
                                    restored_lines.push(stripped.to_string());
                                } else {
                                    restored_lines.push(body_line.to_string());
                                }
                                i += 1;
                            }
                            continue;
                        }
                    }
                }
            }

        restored_lines.push(line.to_string());
        i += 1;
    }

    let result = restored_lines.join("\r\n");
    (result, changed, actions)
}

/// Automatically fixes rogue/malformed script issues in a mod folder.
/// Backs up the original files with a `.disabled.bak` suffix and writes the sanitized version.
#[tauri::command]
pub fn auto_fix_mod_script(mod_path: String) -> Result<Vec<String>, crate::error::AppError> {
    let mod_path_expanded = crate::utils::expand_path(&mod_path);
    let mod_dir = Path::new(&mod_path_expanded);
    if !mod_dir.exists() || !mod_dir.is_dir() {
        return Err(crate::error::AppError::Custom(format!("Directory not found: {}", mod_path)));
    }

    let mut actions = Vec::new();
    let mod_folder_name = mod_dir.file_name().unwrap_or_default().to_string_lossy();
    let _safe_mod_id = format!("{:08x}", crate::utils::fnv1a_hash(&mod_folder_name));

    let mut ini_files = Vec::new();
    find_ini_files(mod_dir, &mut ini_files, 0, 10);

    // Pre-aggregate all defined [Resource...] sections across all INI files in this mod
    let mut all_mod_defined_resources: std::collections::HashSet<String> = std::collections::HashSet::new();
    for path in &ini_files {
        if let Ok(c) = read_ini_to_string(path) {
            for l in c.lines() {
                let t = l.trim();
                if t.starts_with('[') && t.ends_with(']') {
                    let sec = t[1..t.len() - 1].trim().to_lowercase();
                    if sec.starts_with("resource") {
                        all_mod_defined_resources.insert(sec);
                    }
                }
            }
        }
    }

    for ini_path in &ini_files {
        let file_name = ini_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        if file_name.starts_with("zzzmanager_ui_") || file_name.starts_with("000_zzzmanager_ui_") {
            continue;
        }

        let rel_path = ini_path
            .strip_prefix(mod_dir)
            .unwrap_or(ini_path)
            .to_string_lossy()
            .to_string();

        // 1. Standalone help.ini -> rename to help.ini.disabled.bak
        if file_name.eq_ignore_ascii_case("help.ini") {
            let backup_path = ini_path.with_file_name("help.ini.disabled.bak");
            let _ = fs::remove_file(&backup_path);
            if fs::rename(ini_path, &backup_path).is_ok() {
                actions.push(format!("Disabled standalone 'help.ini' (renamed to 'help.ini.disabled.bak') in '{}'", rel_path));
            }

            let txt_path = ini_path.with_file_name("help.txt");
            if txt_path.exists() {
                let txt_backup = ini_path.with_file_name("help.txt.disabled.bak");
                let _ = fs::remove_file(&txt_backup);
                let _ = fs::rename(&txt_path, &txt_backup);
            }
            continue;
        }

        // 2. Scan and sanitize INI content
        if let Ok(mut content) = read_ini_to_string(ini_path) {
            let (recovered_content, was_recovered, recovery_actions) = recover_erroneously_commented_sections(&content);
            let mut file_changed = was_recovered;
            if was_recovered {
                content = recovered_content;
                for act in recovery_actions {
                    actions.push(format!("{} in '{}'", act, rel_path));
                }
            }

            let issues = analyze_ini_script_integrity(&content, &rel_path);
            if issues.is_empty() && !file_changed {
                continue;
            }

            struct ParsedSection {
                raw_header: String,
                name: String,
                lines: Vec<String>,
            }

            let mut sections: Vec<ParsedSection> = Vec::new();
            let mut top_lines: Vec<String> = Vec::new();
            let mut current_header: Option<String> = None;
            let mut current_name: Option<String> = None;
            let mut current_lines: Vec<String> = Vec::new();

            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('[') && trimmed.ends_with(']') {
                    if let Some(header) = current_header.take() {
                        sections.push(ParsedSection {
                            raw_header: header,
                            name: current_name.unwrap_or_default(),
                            lines: std::mem::take(&mut current_lines),
                        });
                    } else {
                        top_lines = std::mem::take(&mut current_lines);
                    }
                    let sec_name = trimmed[1..trimmed.len() - 1].trim().to_string();
                    current_header = Some(line.to_string());
                    current_name = Some(sec_name);
                } else {
                    current_lines.push(line.to_string());
                }
            }

            if let Some(header) = current_header {
                sections.push(ParsedSection {
                    raw_header: header,
                    name: current_name.unwrap_or_default(),
                    lines: current_lines,
                });
            } else {
                top_lines = current_lines;
            }

            let mut fixed_keys_count = 0;
            let mut has_active_in_constants = false;
            let mut has_active_in_present = false;
            let mut constants_section_idx: Option<usize> = None;
            let mut present_section_idx: Option<usize> = None;

            static DRAW_RE: std::sync::LazyLock<regex::Regex> =
                std::sync::LazyLock::new(|| regex::Regex::new(r"(?i)draw(?:indexed)?\s*=\s*(\d+)").unwrap());
            let mut global_max_draw = 0;
            for (s_idx, section) in sections.iter().enumerate() {
                for l in &section.lines {
                    if let Some(caps) = DRAW_RE.captures(l) {
                        if let Some(m) = caps.get(1) {
                            if let Ok(val) = m.as_str().parse::<u32>() {
                                if val > global_max_draw {
                                    global_max_draw = val;
                                }
                            }
                        }
                    }
                }

                let s_lower = section.name.to_lowercase();
                if s_lower == "constants" {
                    constants_section_idx = Some(s_idx);
                    for l in &section.lines {
                        if l.to_lowercase().contains("$active") {
                            has_active_in_constants = true;
                        }
                    }
                } else if s_lower == "present" {
                    present_section_idx = Some(s_idx);
                    for l in &section.lines {
                        if l.to_lowercase().contains("$active") {
                            has_active_in_present = true;
                        }
                    }
                }
            }

            let mut seen_section_names: std::collections::HashSet<String> = std::collections::HashSet::new();

            // Process each section
            for section in &mut sections {
                let s_lower = section.name.to_lowercase();

                // 2-dup. Comment out duplicate sections (excluding [Constants] and [Present])
                if s_lower != "constants" && s_lower != "present"
                    && !seen_section_names.insert(s_lower.clone()) {
                        section.raw_header = format!("; [ZZZMODMANAGER AUTO-FIX: Commented out duplicate section header]\r\n; {}", section.raw_header);
                        for l in &mut section.lines {
                            *l = format!("; {}", l);
                        }
                        file_changed = true;
                        actions.push(format!("Commented out duplicate section '[{}]' in '{}'", section.name, rel_path));
                        continue;
                    }

                // 2-ref. Fix missing 'ref' on Resource assignments
                for line in &mut section.lines {
                    let mut replacement = None;
                    {
                        let l_trim = line.trim();
                        if !l_trim.starts_with(';') && !l_trim.starts_with('#') {
                            if let Some((k, v)) = l_trim.split_once('=') {
                                let k_trim = k.trim();
                                let k_lower = k_trim.to_lowercase();
                                let v_trim = v.trim();
                                let v_lower = v_trim.to_lowercase();
                                if (k_lower.starts_with("resource\\") || k_lower.starts_with("resource/"))
                                    && (v_lower.starts_with("resource") && !v_lower.starts_with("ref ") && !v_lower.starts_with("ref\t"))
                                {
                                    replacement = Some((k_trim.to_string(), v_trim.to_string()));
                                }
                            }
                        }
                    }
                    if let Some((k_str, v_str)) = replacement {
                        *line = format!("{} = ref {}", k_str, v_str);
                        file_changed = true;
                        actions.push(format!("Added missing 'ref' to '{}' in '{}'", k_str, rel_path));
                    }
                }

                // 2a. Fix rogue HUD erasures in [Present]
                if s_lower == "present" {
                    let present_cleaned: Vec<String> = section.lines.iter()
                        .map(|l| l.trim().to_string())
                        .filter(|l| !l.starts_with(';') && !l.starts_with('#') && !l.is_empty())
                        .collect();
                    let mut new_lines = Vec::new();
                    let mut clean_idx = 0;

                    for line in &section.lines {
                        let trimmed = line.trim();
                        if !trimmed.starts_with(';') && !trimmed.starts_with('#') && !trimmed.is_empty() {
                            if is_rogue_hud_erasure(&present_cleaned, clean_idx) {
                                new_lines.push("; [ZZZMODMANAGER AUTO-FIX: Disabled rogue HUD clearing line]".to_string());
                                new_lines.push(format!("; {}", line));
                                file_changed = true;
                            } else {
                                new_lines.push(line.clone());
                            }
                            clean_idx += 1;
                        } else {
                            new_lines.push(line.clone());
                        }
                    }
                    section.lines = new_lines;
                }

                // 2b. Fix rogue HUD erasures in CommandLists called from [Present]
                if s_lower.starts_with("commandlist") {
                    let has_help_null = section.lines.iter().any(|l| {
                        let l_lower = l.to_lowercase();
                        (l_lower.contains("help") && !l_lower.contains("helpshort")) && (l_lower.contains("= null") || l_lower.contains("=null"))
                    });
                    if has_help_null {
                        let mut new_lines = Vec::new();
                        for line in &section.lines {
                            let l_lower = line.to_lowercase();
                            if (l_lower.contains("help") && !l_lower.contains("helpshort")) && (l_lower.contains("= null") || l_lower.contains("=null")) {
                                new_lines.push("; [ZZZMODMANAGER AUTO-FIX: Disabled rogue HUD clearing line]".to_string());
                                new_lines.push(format!("; {}", line));
                                file_changed = true;
                            } else {
                                new_lines.push(line.clone());
                            }
                        }
                        section.lines = new_lines;
                    }
                }

                // 2c. Fix unconditional [Key...] sections
                if s_lower.starts_with("key") {
                    let mut has_action = false;
                    let mut condition_line_idx: Option<usize> = None;
                    let mut existing_condition: Option<String> = None;

                    for (l_idx, line) in section.lines.iter().enumerate() {
                        let trimmed = line.trim();
                        if trimmed.starts_with(';') || trimmed.starts_with('#') || trimmed.is_empty() {
                            continue;
                        }
                        let l_lower = trimmed.to_lowercase();
                        if let Some((k, v)) = trimmed.split_once('=') {
                            let k_trim = k.trim().to_lowercase();
                            let v_trim = v.trim();
                            if k_trim == "condition" {
                                condition_line_idx = Some(l_idx);
                                existing_condition = Some(v_trim.to_string());
                            } else if k_trim == "type" || k_trim == "run" || k_trim.starts_with('$') {
                                has_action = true;
                            }
                        } else if l_lower.starts_with('$') && l_lower.contains('=') {
                            has_action = true;
                        }
                    }

                    if has_action {
                        match existing_condition {
                            None => {
                                // Missing condition line: insert `condition = $active == 1` at top of section
                                section.lines.insert(0, "condition = $active == 1".to_string());
                                file_changed = true;
                                fixed_keys_count += 1;
                            }
                            Some(ref cond) => {
                                let c_lower = cond.to_lowercase();
                                if !c_lower.contains("$active") {
                                    if let Some(idx) = condition_line_idx {
                                        let c_trim = cond.trim();
                                        if c_trim.is_empty() || c_trim == "1 == 1" || c_trim == "1==1" {
                                            section.lines[idx] = "condition = $active == 1".to_string();
                                        } else {
                                            section.lines[idx] = format!("condition = $active == 1 && ({})", c_trim);
                                        }
                                        file_changed = true;
                                        fixed_keys_count += 1;
                                    }
                                }
                            }
                        }
                    }
                }

                // 2d. Fix missing/empty/zero VertexLimitRaise override_vertex_count
                if s_lower.contains("vertexlimitraise") {
                    let content_lines: Vec<&String> = section.lines.iter()
                        .filter(|l| {
                            let t = l.trim();
                            !t.is_empty() && !t.starts_with(';') && !t.starts_with('#')
                        })
                        .collect();

                    let has_other_properties = content_lines.iter().any(|l| {
                        !l.to_lowercase().starts_with("hash")
                    });

                    if has_other_properties || global_max_draw > 25000 {
                        let mut override_line_idx: Option<usize> = None;
                        let mut has_valid_override = false;

                        for (idx, l) in section.lines.iter().enumerate() {
                            let l_lower = l.to_lowercase();
                            if let Some((k, v)) = l_lower.split_once('=') {
                                if k.trim() == "override_vertex_count" {
                                    override_line_idx = Some(idx);
                                    let v_trim = v.trim();
                                    if !v_trim.is_empty() && v_trim != "0" {
                                        has_valid_override = true;
                                    }
                                    break;
                                }
                            }
                        }

                        if !has_valid_override {
                            let target_vertex_count = if global_max_draw > 0 { global_max_draw } else { 35000 };
                            if let Some(idx) = override_line_idx {
                                section.lines[idx] = format!("override_vertex_count = {}", target_vertex_count);
                            } else {
                                section.lines.push(format!("override_vertex_count = {}", target_vertex_count));
                            }
                            let has_stride = section.lines.iter().any(|l| {
                                let l_lower = l.to_lowercase();
                                l_lower.starts_with("override_byte_stride") && l_lower.contains('=')
                            });
                            if !has_stride {
                                section.lines.push("override_byte_stride = 40".to_string());
                            }
                            file_changed = true;
                            actions.push(format!("Fixed 'override_vertex_count = {}' in [{}] in '{}'", target_vertex_count, section.name, rel_path));
                        }
                    }
                }
            }

            // If we modified key conditions, ensure $active is declared in [Constants], set in TextureOverride, and reset in [Present]
            if fixed_keys_count > 0 {
                if !has_active_in_constants {
                    if let Some(c_idx) = constants_section_idx {
                        sections[c_idx].lines.insert(0, "global $active = 0".to_string());
                    } else {
                        sections.insert(0, ParsedSection {
                            raw_header: "[Constants]".to_string(),
                            name: "Constants".to_string(),
                            lines: vec!["global $active = 0".to_string()],
                        });
                    }
                }
                if !has_active_in_present {
                    if let Some(p_idx) = present_section_idx {
                        sections[p_idx].lines.push("post $active = 0".to_string());
                    } else {
                        sections.push(ParsedSection {
                            raw_header: "[Present]".to_string(),
                            name: "Present".to_string(),
                            lines: vec!["post $active = 0".to_string()],
                        });
                    }
                }

                // Ensure at least one TextureOverride sets `pre $active = 1` so the condition is satisfied when the character is rendered
                let has_active_setter = sections.iter().any(|s| {
                    let s_lower = s.name.to_lowercase();
                    s_lower.starts_with("textureoverride") && s.lines.iter().any(|l| {
                        let l_lower = l.to_lowercase();
                        l_lower.contains("$active") && (l_lower.contains("= 1") || l_lower.contains("=1"))
                    })
                });

                if !has_active_setter {
                    let target_override_idx = sections.iter().position(|s| {
                        let s_lower = s.name.to_lowercase();
                        if !s_lower.starts_with("textureoverride") {
                            return false;
                        }
                        let has_hash = s.lines.iter().any(|l| l.to_lowercase().starts_with("hash"));
                        has_hash && (s_lower.contains("body") || s_lower.contains("face") || s_lower.contains("head") || s_lower.contains("hair")) && !s_lower.contains("ib")
                    }).or_else(|| {
                        sections.iter().position(|s| {
                            let s_lower = s.name.to_lowercase();
                            if !s_lower.starts_with("textureoverride") {
                                return false;
                            }
                            let has_hash = s.lines.iter().any(|l| l.to_lowercase().starts_with("hash"));
                            has_hash && (s_lower.contains("body") || s_lower.contains("face") || s_lower.contains("head") || s_lower.contains("hair") || s_lower.contains("ib"))
                        })
                    }).or_else(|| {
                        sections.iter().position(|s| {
                            s.name.to_lowercase().starts_with("textureoverride") && s.lines.iter().any(|l| l.to_lowercase().starts_with("hash"))
                        })
                    });

                    if let Some(idx) = target_override_idx {
                        let sec_name_lower = sections[idx].name.to_lowercase();
                        let is_ib = sec_name_lower.contains("ib")
                            || sections[idx].lines.iter().any(|l| {
                                let lt = l.to_lowercase();
                                lt.starts_with("ib =") || lt.starts_with("ib=") || lt.contains("match_first_index")
                            });
                        if is_ib {
                            sections[idx].lines.push("    pre $active = 1".to_string());
                        } else {
                            sections[idx].lines.push("if DRAW_TYPE == 1".to_string());
                            sections[idx].lines.push("    pre $active = 1".to_string());
                            sections[idx].lines.push("endif".to_string());
                        }
                        actions.push(format!("Injected active character detection ('pre $active = 1') into [{}] in '{}'", sections[idx].name, rel_path));
                    }
                }

                actions.push(format!("Added active character guard ('condition = $active == 1') to {} keybind(s) in '{}'", fixed_keys_count, rel_path));
            }

            // 2e. Fix missing [Resource...] definitions if matching .buf / .ib files exist on disk
            let mut defined_res = all_mod_defined_resources.clone();
            for s in sections.iter().filter(|s| s.name.to_lowercase().starts_with("resource")) {
                defined_res.insert(s.name.to_lowercase());
            }

            let mut missing_resources_to_create = Vec::new();
            for s in &sections {
                for line in &s.lines {
                    let l_trim = line.trim();
                    if l_trim.starts_with(';') || l_trim.starts_with('#') { continue; }
                    if let Some((k, v)) = l_trim.split_once('=') {
                        let k_trim = k.trim().to_lowercase();
                        if k_trim == "vb0" || k_trim == "vb1" || k_trim == "vb2" || k_trim == "ib" {
                            let val_trim = v.trim().trim_start_matches("ref").trim();
                            let val_lower = val_trim.to_lowercase();
                            if !val_lower.contains('\\') && val_lower.starts_with("resource")
                                && !defined_res.contains(&val_lower) {
                                    defined_res.insert(val_lower.clone());
                                    missing_resources_to_create.push((k_trim, val_trim.to_string()));
                                }
                        }
                    }
                }
            }

            if !missing_resources_to_create.is_empty() {
                if let Some(parent_dir) = ini_path.parent() {
                    let disk_files: Vec<String> = fs::read_dir(parent_dir).ok().map(|rd| {
                        rd.flatten().filter_map(|e| e.file_name().into_string().ok()).collect()
                    }).unwrap_or_default();

                    for (buf_slot, res_name) in missing_resources_to_create {
                        let base_target = res_name.strip_prefix("Resource").unwrap_or(&res_name);
                        let base_lower = base_target.to_lowercase();
                        let stem_no_ib = if base_lower.ends_with("ib") {
                            base_lower.strip_suffix("ib").unwrap_or(&base_lower)
                        } else {
                            &base_lower
                        };

                        let matched_file = disk_files.iter().find(|f| {
                            let f_lower = f.to_lowercase();
                            f_lower == format!("{}.buf", base_lower)
                                || f_lower == format!("{}.ib", base_lower)
                                || f_lower == format!("{}.ib", stem_no_ib)
                                || f_lower.starts_with(&base_lower)
                                || (buf_slot == "ib" && f_lower.ends_with(".ib") && f_lower.starts_with(stem_no_ib))
                        });

                        if let Some(found_file) = matched_file {
                            let mut res_lines = Vec::new();
                            res_lines.push("type = Buffer".to_string());
                            let f_lower = found_file.to_lowercase();
                            if f_lower.ends_with(".ib") {
                                res_lines.push("format = DXGI_FORMAT_R32_UINT".to_string());
                            } else {
                                let stride = if f_lower.contains("blend") || buf_slot == "vb2" {
                                    32
                                } else if f_lower.contains("texcoord") || buf_slot == "vb1" {
                                    20
                                } else {
                                    40
                                };
                                res_lines.push(format!("stride = {}", stride));
                            }
                            res_lines.push(format!("filename = {}", found_file));

                            sections.push(ParsedSection {
                                raw_header: format!("[{}]", res_name),
                                name: res_name.clone(),
                                lines: res_lines,
                            });
                            file_changed = true;
                            actions.push(format!("Generated missing buffer resource '[{}]' (bound to '{}') in '{}'", res_name, found_file, rel_path));
                        }
                    }
                }
            }

            if file_changed {
                let mut output = top_lines.join("\r\n");
                if !output.is_empty() && !output.ends_with("\r\n") {
                    output.push_str("\r\n");
                }
                for (s_idx, s) in sections.iter().enumerate() {
                    if s_idx > 0 || !top_lines.is_empty() {
                        output.push_str("\r\n");
                    }
                    output.push_str(&s.raw_header);
                    output.push_str("\r\n");
                    for l in &s.lines {
                        output.push_str(l);
                        output.push_str("\r\n");
                    }
                }

                let backup_file_name = format!("{}.disabled.bak", file_name);
                let backup_path = ini_path.with_file_name(&backup_file_name);

                // Backup original file to .disabled.bak (only if not already backed up)
                if !backup_path.exists() {
                    let _ = fs::copy(ini_path, &backup_path);
                }

                // Write fixed version
                if fs::write(ini_path, output).is_ok() {
                    actions.push(format!("Sanitized '{}' (backed up original to '{}')", rel_path, backup_file_name));
                }
            }
        }
    }

    if actions.is_empty() {
        actions.push("No auto-fixable script issues were found in this mod.".to_string());
    } else {
        let details = actions.join("; ");
        crate::infra::logger::log_alteration(
            "script_fix",
            &mod_folder_name,
            &mod_path_expanded,
            &details,
            None,
            true,
        );
    }

    Ok(actions)
}

#[cfg(test)]
#[path = "warnings_scanner_tests.rs"]
mod tests;
