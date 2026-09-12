//! Mod categorization and character/skin scoring.

use crate::models::{Confidence, HashTarget};
use crate::utils::{find_ini_files, read_ini_to_string, is_generic_shared_hash};
use crate::conflict_scanner::extract_overrides_from_ini;
use super::types::ModCategoryMatch;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Returns true if a section header indicates a genuine game UI modification
/// (HUD, loading screens, screen UID, wallpapers, agent icons) rather than an in-game mod menu.
pub fn is_ui_section_header(sec: &str) -> bool {
    let lower = sec.to_lowercase();
    // In-game mod menus (e.g. [ResourceMenuItem], [CommandListUIAnimation], [CustomShader\UI]) are NOT game UI mods!
    if lower.contains("menu") || lower.contains("renderui") || lower.contains("uiresource") {
        return false;
    }
    if lower.contains("screenuid")
        || lower.contains("hud")
        || lower.contains("minimap")
        || lower.contains("crosshair")
        || lower.contains("loadscreen")
        || lower.contains("loading_screen")
        || lower.contains("wallpaper")
        || lower.contains("gacha")
        || lower.contains("agent_icon")
        || lower.contains("agent icons")
    {
        return true;
    }
    // Token check for isolated "ui" or "gui"
    lower.split(|c: char| !c.is_alphanumeric()).any(|w| w == "ui" || w == "gui")
}

/// Determines whether a folder contains a genuine UI mod (HUD, loading screen, wallpaper, icons, screen UID)
/// rather than a 3D character mesh outfit. Genuine UI mods must route to Unassigned.
pub fn is_genuine_ui_mod(mod_dir: &Path) -> bool {
    let folder_name = mod_dir
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();

    // Check for explicit UI keywords in folder or archive name with word boundary separation
    let has_ui_keyword = !folder_name.contains("menu") && (
        folder_name
            .split(|c: char| !c.is_alphanumeric())
            .any(|w| w == "ui" || w == "hud" || w == "gui")
        || folder_name.contains("hide_uid")
        || folder_name.contains("hideuid")
        || folder_name.contains("wallpaper")
        || folder_name.contains("loadscreen")
        || folder_name.contains("loading_screen")
        || folder_name.contains("loadingscreen")
        || folder_name.contains("loading screen")
        || folder_name.contains("icons mod")
        || folder_name.contains("agent icons")
        || folder_name.contains("agent_icons")
        || folder_name.contains("screenuid")
    );

    let mut ini_files = Vec::new();
    find_ini_files(mod_dir, &mut ini_files, 0, 10);

    let mut has_ui_ini = false;
    let mut has_3d_mesh_ini = false;

    for ini_path in &ini_files {
        let f_name = ini_path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
        if !f_name.contains("menu") {
            let ini_words: Vec<&str> = f_name.split(|c: char| !c.is_alphanumeric()).collect();
            if ini_words.contains(&"ui") || ini_words.contains(&"hud") || ini_words.contains(&"gui") || f_name.contains("loadscreen") || f_name.contains("wallpaper") {
                has_ui_ini = true;
            }
        }

        if let Ok(content) = read_ini_to_string(ini_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('[') && trimmed.ends_with(']') {
                    let sec = trimmed[1..trimmed.len() - 1].trim();
                    if is_ui_section_header(sec) {
                        has_ui_ini = true;
                    }
                    let sec_low = sec.to_lowercase();
                    if sec_low.contains("bodyib")
                        || sec_low.contains("headib")
                        || sec_low.contains("hairib")
                        || sec_low.contains("dressib")
                        || sec_low.contains("extraib")
                        || sec_low.contains("position")
                        || sec_low.contains("blend")
                    {
                        has_3d_mesh_ini = true;
                    }
                }
            }
        }
    }

    // Check if there are any physical 3D mesh files (.buf, .ib)
    let mut has_buf_or_ib = false;
    fn check_mesh_files(dir: &Path, has_mesh: &mut bool, depth: usize) {
        if depth > 8 || *has_mesh {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.filter_map(Result::ok) {
                let p = entry.path();
                if p.is_dir() {
                    let dir_name = p.file_name().unwrap_or_default().to_string_lossy();
                    let dir_upper = dir_name.to_ascii_uppercase();
                    if dir_upper.starts_with("DISABLED") || dir_upper.starts_with("DISABLE_") {
                        continue;
                    }
                    check_mesh_files(&p, has_mesh, depth + 1);
                } else if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "buf" || ext_lower == "ib" {
                        *has_mesh = true;
                    }
                }
            }
        }
    }
    check_mesh_files(mod_dir, &mut has_buf_or_ib, 0);

    // If it has UI indicators and does NOT have 3D character mesh overrides, it's a UI mod!
    (has_ui_keyword || has_ui_ini) && (!has_buf_or_ib && !has_3d_mesh_ini)
}

pub fn determine_mod_category(
    mod_dir: &Path,
    hash_alias_map: &HashMap<String, Vec<HashTarget>>,
) -> Option<ModCategoryMatch> {
    // 0. Explicit rule: Genuine UI, HUD, and loading screen mods must stay in Unassigned
    if is_genuine_ui_mod(mod_dir) {
        return None;
    }
    let mut ini_files = Vec::new();
    find_ini_files(mod_dir, &mut ini_files, 0, 10);
    
    // Target and whether that specific hash was shared across multiple skins of this character
    let mut matched_target_hits: Vec<(HashTarget, bool)> = Vec::new();
    let mut seen_targets: std::collections::HashSet<(String, String, String)> = std::collections::HashSet::new();

    for ini_path in ini_files {
        if let Ok(content) = read_ini_to_string(&ini_path) {
            let rel_path = ini_path.strip_prefix(mod_dir).unwrap_or(&ini_path)
                .to_string_lossy().to_string();
            let overrides = extract_overrides_from_ini(&content, &rel_path);
            
            for ov in overrides {
                let clean_hash = ov.hash.to_lowercase();

                // Ignore generic shared textures (shared by >= 5 characters, like default normal maps)
                if is_generic_shared_hash(&clean_hash, hash_alias_map) {
                    continue;
                }

                if let Some(targets) = hash_alias_map.get(&clean_hash) {
                    // Check if this specific hash is mapped to multiple skins of the same character
                    let mut skins_by_char: HashMap<&str, std::collections::HashSet<&str>> = HashMap::new();
                    for t in targets {
                        skins_by_char.entry(&t.character_id).or_default().insert(&t.skin_id);
                    }

                    for target in targets {
                        let key = (clean_hash.clone(), target.character_id.clone(), target.skin_id.clone());
                        if seen_targets.insert(key) {
                            let is_shared_for_this_char = skins_by_char
                                .get(target.character_id.as_str())
                                .is_some_and(|skins| skins.len() > 1);
                            matched_target_hits.push((target.clone(), is_shared_for_this_char));
                        }
                    }
                }
            }
        }
    }

    if matched_target_hits.is_empty() {
        return None;
    }

    // 1. Group targets by character and calculate character-level statistics
    struct CharacterScoreInfo {
        total_score: u32,
        ib_count: usize,
        max_confidence: Confidence,
        skin_scores: HashMap<String, u32>,
        skin_targets: HashMap<String, HashTarget>,
        skin_conf: HashMap<String, Confidence>,
    }

    let mut char_map: HashMap<String, CharacterScoreInfo> = HashMap::new();

    // Group targets per character
    let mut targets_by_char: HashMap<String, Vec<&(HashTarget, bool)>> = HashMap::new();
    for hit in &matched_target_hits {
        targets_by_char.entry(hit.0.character_id.clone()).or_default().push(hit);
    }

    for (char_id, targets) in targets_by_char {
        let mut skin_scores: HashMap<String, u32> = HashMap::new();
        let mut skin_targets: HashMap<String, HashTarget> = HashMap::new();
        let mut skin_conf: HashMap<String, Confidence> = HashMap::new();
        let mut total_score = 0;
        let mut ib_count = 0;
        let mut max_confidence = Confidence::Low;

        for (target, is_shared_across_skins) in targets {
            let (conf, points) = match target.match_type.as_deref() {
                Some("ib") => {
                    ib_count += 1;
                    (Confidence::Highest, 100)
                }
                Some("position_vb") => (Confidence::High, 50),
                Some("blend_vb") => (Confidence::High, 30),
                Some("texcoord_vb") => (Confidence::Medium, 20),
                Some("draw_vb") => (Confidence::Low, 10),
                Some(s) if s.starts_with("textures.") => (Confidence::Medium, 10),
                _ => (Confidence::Low, 5),
            };

            // If this specific hash is shared across multiple skins of this same character (e.g. shared head/face),
            // base skin gets 1 tie-breaker point; alt skin gets 0 points.
            // If this specific hash is unique to an alt skin (e.g. alt outfit IB), alt skin gets full points!
            let final_points = if *is_shared_across_skins {
                if target.is_base_skin { 1 } else { 0 }
            } else {
                points
            };

            *skin_scores.entry(target.skin_id.clone()).or_insert(0) += final_points;
            total_score += points;
            skin_targets.insert(target.skin_id.clone(), target.clone());

            if conf > max_confidence {
                max_confidence = conf.clone();
            }

            let cur_c = skin_conf.get(&target.skin_id).unwrap_or(&Confidence::Low);
            if conf > *cur_c {
                skin_conf.insert(target.skin_id.clone(), conf);
            }
        }

        char_map.insert(
            char_id,
            CharacterScoreInfo {
                total_score,
                ib_count,
                max_confidence,
                skin_scores,
                skin_targets,
                skin_conf,
            },
        );
    }

    if char_map.is_empty() {
        return None;
    }

    // 2. Rank characters by confidence: IB count, then total score
    let mut ranked_chars: Vec<(&String, &CharacterScoreInfo)> = char_map.iter().collect();
    ranked_chars.sort_by(|a, b| {
        b.1.ib_count
            .cmp(&a.1.ib_count)
            .then_with(|| b.1.total_score.cmp(&a.1.total_score))
    });

    let (_top_char_id, top_info) = ranked_chars[0];

    // 3. Multi-character detection:
    // A mod is only truly Multi-Character if at least 2 distinct characters have substantial competing primary mesh matches.
    if ranked_chars.len() > 1 {
        let (_runner_up_id, runner_up_info) = ranked_chars[1];

        let is_competing_multi_char = if top_info.ib_count > 0 && runner_up_info.ib_count > 0 {
            // Both have Index Buffer matches: check if runner-up has at least 35% of top score
            runner_up_info.total_score * 100 >= top_info.total_score * 35
        } else if top_info.ib_count == 0 && runner_up_info.ib_count == 0 {
            // Neither has IB matches (e.g. texture/VB only): check if scores are close (>= 40%)
            runner_up_info.total_score * 100 >= top_info.total_score * 40
        } else {
            // Top has IBs but runner up has 0 IBs: runner up is noise/draw collision
            false
        };

        if is_competing_multi_char {
            return Some(ModCategoryMatch {
                category_name: "Multi-Character".to_string(),
                confidence: Confidence::Highest,
                character_id: None,
                skin_id: None,
            });
        }
    }

    // 4. Resolve the best skin for the winning character
    let mut best_skin: Option<String> = None;
    let mut best_score = 0;

    for (skin_id, score) in &top_info.skin_scores {
        if *score > best_score {
            best_score = *score;
            best_skin = Some(skin_id.clone());
        } else if *score == best_score && *score > 0 {
            if let Some(target) = top_info.skin_targets.get(skin_id) {
                if target.is_base_skin {
                    best_skin = Some(skin_id.clone());
                }
            }
        }
    }

    // If all scores were 0 (e.g. only shared meshes where alt skins got 0 and no base skin had points,
    // or tied with 0), deterministically resolve to the canonical base skin.
    if best_skin.is_none() {
        if let Some((_, base_target)) = top_info.skin_targets.iter().find(|(_, t)| t.is_base_skin) {
            best_skin = Some(base_target.skin_id.clone());
        }
    }

    if let Some(skin_id) = best_skin {
        if let Some(target) = top_info.skin_targets.get(&skin_id) {
            let conf = top_info
                .skin_conf
                .get(&skin_id)
                .cloned()
                .unwrap_or_else(|| top_info.max_confidence.clone());
            return Some(ModCategoryMatch {
                category_name: target.category_name.clone(),
                confidence: conf,
                character_id: Some(target.character_id.clone()),
                skin_id: Some(target.skin_id.clone()),
            });
        }
    }
    if let Some(first) = top_info.skin_targets.values().next() {
        return Some(ModCategoryMatch {
            category_name: first.category_name.clone(),
            confidence: top_info.max_confidence.clone(),
            character_id: Some(first.character_id.clone()),
            skin_id: Some(first.skin_id.clone()),
        });
    }

    None
}
