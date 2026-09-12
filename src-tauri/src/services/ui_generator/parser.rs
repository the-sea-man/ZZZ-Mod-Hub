//! Deep INI parser for mod variables, keybinds, tracking targets, and UI controls.

use crate::ui_generator::model::{ControlType, MenuControl, MenuPage, ModMenuDefinition, TrackingTarget};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub fn fnv1a_hash(s: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

pub fn extract_variable_from_condition(condition: &str) -> String {
    let s = condition.trim();
    if let Some(dollar_idx) = s.find('$') {
        let after_dollar = &s[dollar_idx + 1..];
        let var_len = after_dollar
            .find(|c: char| !c.is_alphanumeric() && c != '_' && c != '\\')
            .unwrap_or(after_dollar.len());
        let var_name = &after_dollar[..var_len];
        return format!("${}", var_name.trim_start_matches('\\'));
    }
    String::new()
}

pub fn get_tracking_targets(ini_path: &Path, condition: &str) -> Vec<TrackingTarget> {
    let mut targets: Vec<TrackingTarget> = Vec::new();
    let tracking_var = extract_variable_from_condition(condition);
    let tracking_var_no_dollar = tracking_var.trim_start_matches('$');

    if let Ok(content) = crate::utils::read_ini_to_string(ini_path) {
        let mut sections_map: HashMap<String, Vec<String>> = HashMap::new();
        let mut current_sec_name = String::new();
        let mut current_lines = Vec::new();
        let mut texture_overrides: Vec<(String, String)> = Vec::new();

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with(';') || trimmed.starts_with('#') { continue; }

            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                if !current_sec_name.is_empty() {
                    sections_map.insert(current_sec_name.to_lowercase(), current_lines);
                    current_lines = Vec::new();
                }
                let raw_name = trimmed[1..trimmed.len()-1].trim();
                current_sec_name = raw_name.to_string();
                if current_sec_name.to_lowercase().starts_with("textureoverride") {
                    texture_overrides.push((current_sec_name.clone(), String::new()));
                }
            } else if !current_sec_name.is_empty() {
                if current_sec_name.to_lowercase().starts_with("textureoverride") {
                    if let Some((k, v)) = trimmed.split_once('=') {
                        if k.trim().to_lowercase() == "hash" {
                            if let Some(last) = texture_overrides.last_mut() {
                                last.1 = v.trim().to_string();
                            }
                        }
                    }
                }
                current_lines.push(trimmed.to_string());
            }
        }
        if !current_sec_name.is_empty() {
            sections_map.insert(current_sec_name.to_lowercase(), current_lines);
        }

        let mut mesh_fallback_targets: Vec<TrackingTarget> = Vec::new();
        let mut any_active_targets: Vec<TrackingTarget> = Vec::new();

        for (sec_name, current_hash) in texture_overrides {
            if current_hash.is_empty() { continue; }

            let mut eval_lines = Vec::new();
            let mut visited_sections = std::collections::HashSet::new();
            let mut queue = vec![sec_name.to_lowercase()];

            while let Some(target_sec) = queue.pop() {
                if !visited_sections.insert(target_sec.clone()) {
                    continue;
                }
                if let Some(lines) = sections_map.get(&target_sec) {
                    for l in lines {
                        eval_lines.push(l.clone());
                        if let Some((k, v)) = l.split_once('=') {
                            if k.trim().to_lowercase() == "run" {
                                let cmd_target = v.trim().to_lowercase();
                                let clean_cmd = cmd_target.rsplit('\\').next().unwrap_or(&cmd_target);
                                queue.push(clean_cmd.to_string());
                                queue.push(cmd_target);
                            }
                        }
                    }
                }
            }

            let mut sets_tracking_var = false;
            let mut sets_any_active = false;
            let mut is_mesh_replacement = false;

            let sec_name_lower = sec_name.to_lowercase();
            let is_ib = sec_name_lower.contains("ib")
                || eval_lines.iter().any(|l| {
                    let lt = l.to_lowercase();
                    lt.starts_with("ib =") || lt.starts_with("ib=") || lt.contains("match_first_index")
                });

            let explicitly_uses_dt1 = eval_lines.iter().any(|l| {
                let lt = l.to_lowercase();
                lt.contains("draw_type == 1") || lt.contains("draw_type==1")
            });

            // Index Buffers (DrawIndexed / DRAW_TYPE 2/4) must never be guarded with DRAW_TYPE == 1
            let has_draw_type_1 = explicitly_uses_dt1 && !is_ib;

            for line in &eval_lines {
                let l_lower = line.to_lowercase();

                if (l_lower.contains("handling = skip") || l_lower.contains("handling=skip"))
                    || (l_lower.contains("draw =") || l_lower.contains("vb0 =") || l_lower.contains("draw=") || l_lower.contains("vb0=") || l_lower.contains("drawindexed =") || l_lower.contains("drawindexed="))
                {
                    is_mesh_replacement = true;
                }

                let is_assignment = line.contains('=')
                    && !line.contains("==")
                    && !line.contains("!=")
                    && !line.starts_with("if ")
                    && !line.starts_with("elif ");

                if is_assignment {
                    if !tracking_var.is_empty() && (line.contains(&tracking_var) || (!tracking_var_no_dollar.is_empty() && line.contains(tracking_var_no_dollar))) {
                        sets_tracking_var = true;
                    }
                    if l_lower.contains("$active") || l_lower.contains("active =") || l_lower.contains("active=") {
                        sets_any_active = true;
                    }
                }
            }

            let target = TrackingTarget {
                hash: current_hash.clone(),
                has_draw_type_1,
            };

            if sets_tracking_var {
                if let Some(existing) = targets.iter_mut().find(|t| t.hash == target.hash) {
                    existing.has_draw_type_1 = existing.has_draw_type_1 && target.has_draw_type_1;
                } else {
                    targets.push(target.clone());
                }
            }
            if sets_any_active {
                if let Some(existing) = any_active_targets.iter_mut().find(|t| t.hash == target.hash) {
                    existing.has_draw_type_1 = existing.has_draw_type_1 && target.has_draw_type_1;
                } else {
                    any_active_targets.push(target.clone());
                }
            }
            if is_mesh_replacement {
                if let Some(existing) = mesh_fallback_targets.iter_mut().find(|t| t.hash == target.hash) {
                    existing.has_draw_type_1 = existing.has_draw_type_1 && target.has_draw_type_1;
                } else {
                    mesh_fallback_targets.push(target);
                }
            }
        }

        if targets.is_empty() && !any_active_targets.is_empty() {
            targets = any_active_targets;
        }
        if targets.is_empty() && !mesh_fallback_targets.is_empty() {
            targets = mesh_fallback_targets;
        }

        if targets.is_empty() {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with(';') || trimmed.starts_with('#') { continue; }
                if let Some(parts) = trimmed.split_once('=') {
                    if parts.0.trim().to_lowercase() == "hash" {
                        targets.push(TrackingTarget {
                            hash: parts.1.trim().to_string(),
                            has_draw_type_1: false,
                        });
                        break;
                    }
                }
            }
        }
    }
    targets
}

#[allow(dead_code)]
pub fn get_tracking_hashes(ini_path: &Path, condition: &str) -> Vec<String> {
    get_tracking_targets(ini_path, condition)
        .into_iter()
        .map(|t| t.hash)
        .collect()
}

// =========================================================================
// Semantic Icon & Name Cleaners
// =========================================================================

pub fn clean_control_name(section: &str) -> String {
    let mut name = section.to_string();
    if let Some(stripped) = name.strip_prefix("Key") {
        name = stripped.to_string();
    } else if let Some(stripped) = name.strip_prefix("key") {
        name = stripped.to_string();
    }

    // Split CamelCase into readable words: e.g. AltHair -> Alt Hair
    let mut result = String::new();
    let mut prev_is_lower = false;
    for c in name.chars() {
        if c.is_uppercase() && prev_is_lower {
            result.push(' ');
        }
        result.push(c);
        prev_is_lower = c.is_lowercase();
    }

    let cleaned = result.trim().replace('_', " ");
    if cleaned.is_empty() {
        "Toggle".to_string()
    } else {
        cleaned
    }
}

pub fn infer_icon_hint(name: &str, var_name: Option<&str>) -> String {
    let combined = format!("{} {}", name, var_name.unwrap_or("")).to_lowercase();
    if combined.contains("outfit") || combined.contains("dress") || combined.contains("suit") || combined.contains("costume") {
        "outfit".to_string()
    } else if combined.contains("top") || combined.contains("jacket") || combined.contains("shirt") || combined.contains("sweater") || combined.contains("coat") {
        "top".to_string()
    } else if combined.contains("bottom") || combined.contains("skirt") || combined.contains("pant") || combined.contains("shorts") || combined.contains("leg") {
        "bottom".to_string()
    } else if combined.contains("hair") || combined.contains("bang") || combined.contains("wig") {
        "hair".to_string()
    } else if combined.contains("glasses") || combined.contains("eyewear") || combined.contains("visor") {
        "glasses".to_string()
    } else if combined.contains("face") || combined.contains("head") || combined.contains("mask") || combined.contains("eye") || combined.contains("blush") || combined.contains("hat") {
        "face".to_string()
    } else if combined.contains("shoe") || combined.contains("boot") || combined.contains("heel") || combined.contains("feet") || combined.contains("sock") {
        "shoes".to_string()
    } else if combined.contains("weapon") || combined.contains("sword") || combined.contains("blade") || combined.contains("gun") || combined.contains("fx") {
        "weapon".to_string()
    } else if combined.contains("slider") || combined.contains("flat") || combined.contains("scale") || combined.contains("size") || combined.contains("thicc") {
        "slider".to_string()
    } else {
        "toggle".to_string()
    }
}

// =========================================================================
// Mod Menu Parsing & Construction
// =========================================================================

struct RawParsedKeybind {
    section: String,
    keys: Vec<String>,
    back_keys: Vec<String>,
    condition: String,
    bind_type: String,
    assigned_vars: Vec<(String, String)>, // (var_name, values_str)
    run_cmds: Vec<String>,
}

fn parse_ini_keybinds_deep(path: &Path) -> Vec<RawParsedKeybind> {
    let mut keybinds = Vec::new();
    if let Ok(content) = crate::utils::read_ini_to_string(path) {
        let mut current_bind: Option<RawParsedKeybind> = None;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with(';') || trimmed.starts_with('#') { continue; }

            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                if let Some(bind) = current_bind.take() {
                    if !bind.keys.is_empty() || !bind.back_keys.is_empty() || !bind.assigned_vars.is_empty() || !bind.run_cmds.is_empty() {
                        keybinds.push(bind);
                    }
                }
                let sec_name = trimmed[1..trimmed.len()-1].trim().to_string();
                if sec_name.to_lowercase().starts_with("key") {
                    current_bind = Some(RawParsedKeybind {
                        section: sec_name,
                        keys: Vec::new(),
                        back_keys: Vec::new(),
                        condition: String::new(),
                        bind_type: String::new(),
                        assigned_vars: Vec::new(),
                        run_cmds: Vec::new(),
                    });
                }
            } else if let Some(bind) = &mut current_bind {
                if let Some((k, v)) = trimmed.split_once('=') {
                    let key = k.trim();
                    let val = v.trim();
                    let key_lower = key.to_lowercase();

                    if key_lower == "key" {
                        bind.keys.push(val.to_string());
                    } else if key_lower == "back" {
                        bind.back_keys.push(val.to_string());
                    } else if key_lower == "type" {
                        bind.bind_type = val.to_string();
                    } else if key_lower == "condition" {
                        bind.condition = val.to_string();
                    } else if key_lower == "run" {
                        bind.run_cmds.push(val.to_string());
                    } else if key.starts_with('$') {
                        bind.assigned_vars.push((key.to_string(), val.to_string()));
                    }
                }
            }
        }

        if let Some(bind) = current_bind.take() {
            if !bind.keys.is_empty() || !bind.back_keys.is_empty() || !bind.assigned_vars.is_empty() || !bind.run_cmds.is_empty() {
                keybinds.push(bind);
            }
        }
    }
    keybinds
}

pub fn parse_mod_menu(
    _mod_root: &Path,
    ini_files: &[PathBuf],
    category_name: &str,
    raw_mod_name: &str,
) -> Option<ModMenuDefinition> {
    let mod_display_name = crate::utils::get_mod_display_name(raw_mod_name);
    let unique_mod_id = format!("{}_{}", category_name, mod_display_name);
    let safe_id = format!("{:016x}", fnv1a_hash(&unique_mod_id));

    let mut all_controls: Vec<MenuControl> = Vec::new();
    let mut all_sliders: Vec<MenuControl> = Vec::new();
    let mut all_tracking_targets: Vec<TrackingTarget> = Vec::new();
    let mut overall_base_condition = String::new();

    let mut raw_txt = String::new();
    raw_txt.push_str(&format!("[ {} ]\n\n", category_name));
    raw_txt.push_str(&format!("Mod:   {}\n\n", mod_display_name));

    for ini_file in ini_files {
        let file_name = ini_file.file_name().unwrap_or_default().to_string_lossy().to_string();
        let keybinds = parse_ini_keybinds_deep(ini_file);
        if keybinds.is_empty() { continue; }

        raw_txt.push_str(&format!("{}\n\n", file_name));

        // Inherit base condition for tracking targets
        let mut base_cond = String::new();
        for kb in &keybinds {
            let parts: Vec<&str> = kb.condition.split("&&").collect();
            if !parts.is_empty() {
                let c = parts[0].trim();
                if !c.is_empty() {
                    base_cond = c.to_string();
                    break;
                }
            }
        }
        if base_cond.is_empty() {
            base_cond = "$active == 1".to_string();
        }
        if overall_base_condition.is_empty() {
            overall_base_condition = base_cond.clone();
        }

        let mut targets = get_tracking_targets(ini_file, &base_cond);
        all_tracking_targets.append(&mut targets);

        for kb in keybinds {
            let label = clean_control_name(&kb.section);
            let icon_hint = infer_icon_hint(&label, kb.assigned_vars.first().map(|v| v.0.as_str()));

            raw_txt.push_str(&format!("     {}\n", kb.section));
            if !kb.keys.is_empty() {
                raw_txt.push_str(&format!("               Key:    {}\n", kb.keys.join(" ")));
            }
            if !kb.back_keys.is_empty() {
                raw_txt.push_str(&format!("               Back:  {}\n", kb.back_keys.join(" ")));
            }

            // Determine ControlType
            let control_type = if let Some((var, vals_str)) = kb.assigned_vars.first() {
                let vals: Vec<i64> = vals_str
                    .split(',')
                    .filter_map(|s| s.trim().parse::<i64>().ok())
                    .collect();

                let var_clean = var.trim().to_string();
                let is_slider_var = var_clean.to_lowercase().contains("slider")
                    || var_clean.to_lowercase().contains("flat")
                    || var_clean.to_lowercase().contains("morph")
                    || var_clean.to_lowercase().contains("scale");

                if is_slider_var {
                    ControlType::Slider {
                        variable: var_clean,
                        min: 0.0,
                        max: 1.0,
                        step: 0.05,
                    }
                } else if vals.len() > 2 {
                    let max_v = *vals.iter().max().unwrap_or(&1);
                    ControlType::Cycle {
                        variable: var_clean,
                        values: vals,
                        max_value: max_v,
                    }
                } else {
                    ControlType::Toggle {
                        variable: var_clean,
                    }
                }
            } else if let Some(cmd) = kb.run_cmds.first() {
                ControlType::Action {
                    command_list: cmd.trim().to_string(),
                }
            } else {
                // Default toggle based on section name
                let safe_var_name = format!("${}", kb.section.to_lowercase().replace(' ', "_"));
                ControlType::Toggle {
                    variable: safe_var_name,
                }
            };

            let control = MenuControl {
                id: format!("{}_{}", safe_id, all_controls.len() + all_sliders.len() + 1),
                name: label,
                keys: kb.keys,
                back_keys: kb.back_keys,
                control_type,
                icon_hint,
            };

            if matches!(control.control_type, ControlType::Slider { .. }) {
                all_sliders.push(control);
            } else {
                all_controls.push(control);
            }
        }
        raw_txt.push('\n');
    }

    if all_controls.is_empty() && all_sliders.is_empty() {
        return None;
    }

    // Deduplicate tracking targets by hash (respecting IB vs VB DRAW_TYPE == 1 invariant)
    let mut targets_map: HashMap<String, bool> = HashMap::new();
    for t in all_tracking_targets {
        targets_map
            .entry(t.hash)
            .and_modify(|has_dt1| *has_dt1 = *has_dt1 && t.has_draw_type_1)
            .or_insert(t.has_draw_type_1);
    }
    let mut sorted_hashes: Vec<_> = targets_map.keys().cloned().collect();
    sorted_hashes.sort();
    let deduplicated_targets: Vec<TrackingTarget> = sorted_hashes
        .into_iter()
        .map(|hash| {
            let dt1 = targets_map.get(&hash).copied().unwrap_or(false);
            TrackingTarget { hash, has_draw_type_1: dt1 }
        })
        .collect();

    // Paginate controls into 8 slots per page (2 rows x 4 columns)
    const SLOTS_PER_PAGE: usize = 8;
    let mut pages = Vec::new();
    for (page_idx, chunk) in all_controls.chunks(SLOTS_PER_PAGE).enumerate() {
        pages.push(MenuPage {
            page_index: page_idx,
            slots: chunk.to_vec(),
        });
    }

    if pages.is_empty() && !all_sliders.is_empty() {
        pages.push(MenuPage {
            page_index: 0,
            slots: Vec::new(),
        });
    }

    Some(ModMenuDefinition {
        safe_id,
        mod_display_name,
        category_name: category_name.to_string(),
        tracking_targets: deduplicated_targets,
        pages,
        sliders: all_sliders,
        base_condition: overall_base_condition,
        raw_txt_cheat_sheet: raw_txt,
    })
}
