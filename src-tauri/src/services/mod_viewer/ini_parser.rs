//! INI file parsing, draw group extraction, toggles, and suggested tags.

use crate::error::AppError;
use super::types::*;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

/// Parse an INI file into sections with their key-value entries and condition stacks.
/// Handles UTF-8 and UTF-16 via our existing `read_ini_to_string` utility.
pub fn parse_ini_sections(path: &Path) -> Result<Vec<IniSection>, AppError> {
    let content = crate::utils::read_ini_to_string(path)?;
    let mut sections = Vec::new();
    let mut current: Option<IniSection> = None;
    let ini_dir = path.parent().unwrap_or(Path::new("")).to_path_buf();
    let mut cond_stack: Vec<String> = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        // Skip comments
        if trimmed.starts_with(';') || trimmed.starts_with("//") || trimmed.is_empty() {
            continue;
        }
        // Strip inline comments
        let trimmed = trimmed.split(';').next().unwrap_or(trimmed).trim();

        let lower = trimmed.to_lowercase();
        if lower.starts_with("if ") {
            let cond = trimmed[3..].trim().to_string();
            cond_stack.push(cond);
            continue;
        } else if lower == "endif" {
            cond_stack.pop();
            continue;
        } else if lower.starts_with("else") {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            if let Some(sec) = current.take() {
                sections.push(sec);
            }
            cond_stack.clear();
            current = Some(IniSection {
                name: trimmed[1..trimmed.len() - 1].to_string(),
                entries: Vec::new(),
                ini_dir: ini_dir.clone(),
            });
        } else if let Some(ref mut sec) = current {
            if let Some((key, val)) = trimmed.split_once('=') {
                let condition = if cond_stack.is_empty() {
                    None
                } else {
                    Some(cond_stack.join(" && "))
                };
                sec.entries.push(IniEntry {
                    key: key.trim().to_lowercase(),
                    val: val.trim().to_string(),
                    condition,
                });
            }
        }
    }
    if let Some(sec) = current {
        sections.push(sec);
    }
    Ok(sections)
}

pub fn find_file_in_dir_recursive(dir: &Path, file_name: &str, depth: usize, max_depth: usize) -> Option<PathBuf> {
    if depth > max_depth {
        return None;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if p.file_name().and_then(|n| n.to_str()).map(|n| n.eq_ignore_ascii_case(file_name)).unwrap_or(false) {
                    return Some(p);
                }
            } else if p.is_dir() {
                if let Some(found) = find_file_in_dir_recursive(&p, file_name, depth + 1, max_depth) {
                    return Some(found);
                }
            }
        }
    }
    None
}

/// Resolve a resource path relative to the INI directory or mod directory.
/// If not found in the immediate mod directory (e.g. for texture-only or retexture mods),
/// searches the specifically designated `base_model_folder` (if any).
pub fn safe_resource_path(
    base_dir: &Path,
    mod_dir: &Path,
    rel_path: &str,
    base_model_folder: Option<&Path>,
) -> Option<PathBuf> {
    if rel_path.is_empty() {
        return None;
    }
    let rel = Path::new(rel_path);
    if rel.is_absolute() {
        return None;
    }

    // 1. Try direct relative to base_dir (the INI's directory)
    let candidate1 = base_dir.join(rel);
    if candidate1.exists() {
        return Some(candidate1);
    }

    // 2. Try direct relative to mod_dir (mod root)
    let candidate2 = mod_dir.join(rel);
    if candidate2.exists() {
        return Some(candidate2);
    }

    let file_name = rel.file_name().and_then(|f| f.to_str()).unwrap_or(rel_path);

    // 3. Search deeply inside mod_dir
    if let Some(found) = find_file_in_dir_recursive(mod_dir, file_name, 0, 6) {
        return Some(found);
    }

    // 4. If an explicit base model folder is designated, search that specific folder only
    if let Some(base_path) = base_model_folder {
        let direct_base = base_path.join(file_name);
        if direct_base.exists() {
            return Some(direct_base);
        }
        if let Some(found) = find_file_in_dir_recursive(base_path, file_name, 0, 4) {
            return Some(found);
        }
    }

    // Return joined path as fallback even if not yet on disk
    Some(candidate1)
}

/// Strip common 3DMigoto prefixes/suffixes to get a canonical lowercase component name.
/// e.g. "TextureOverrideJaneBodyPosition" -> "janebody"
/// e.g. "ResourceJaneBodyAIB" -> "janebody"
/// e.g. "TextureOverrideJaneHairBLOD2" -> "janehair"
pub fn clean_component_name(s: &str) -> String {
    let mut lower = s.to_lowercase();
    // Strip common prefixes
    for prefix in &[
        "textureoverride",
        "shaderoverride",
        "resource",
        "commandlist",
    ] {
        if let Some(stripped) = lower.strip_prefix(prefix) {
            lower = stripped.to_string();
            break;
        }
    }

    // Strip LOD suffixes (e.g. lod2, lod3, lod1)
    if let Some(idx) = lower.find("lod") {
        if idx + 3 < lower.len() && lower[idx + 3..].chars().all(|c| c.is_ascii_digit()) {
            lower = lower[..idx].to_string();
        }
    }

    // Strip common buffer/texture role suffixes
    for suffix in &[
        "position",
        "texcoord",
        "blend",
        "diffuse1k",
        "normalmap1k",
        "lightmap1k",
        "materialmap1k",
        "diffuse",
        "normalmap",
        "lightmap",
        "materialmap",
        "vertexlimitraise",
        "ib",
        "vb",
    ] {
        if let Some(stripped) = lower.strip_suffix(suffix) {
            lower = stripped.to_string();
            break;
        }
    }

    // Strip trailing single letter submesh markers (e.g. "janebodya" -> "janebody", "hairb" -> "hair")
    if lower.len() > 2 {
        let last = lower.chars().last().unwrap_or(' ');
        if last.is_ascii_alphabetic() && last.is_ascii_lowercase() {
            // Check if second-to-last is not single letter or represents submesh
            let prefix = &lower[..lower.len() - 1];
            if prefix.ends_with("body")
                || prefix.ends_with("hair")
                || prefix.ends_with("face")
                || prefix.ends_with("head")
                || prefix.ends_with("dress")
                || prefix.ends_with("legs")
                || prefix.ends_with("arms")
                || prefix.ends_with("mesh")
                || prefix.ends_with("weapon")
                || prefix.len() >= 3
            {
                lower = prefix.to_string();
            }
        }
    }

    lower
}

/// Extract renderable draw groups by analyzing INI resources, component bindings, and draw sections.
pub fn extract_draw_groups(
    sections: &[IniSection],
    mod_dir: &Path,
    base_model_folder: Option<&Path>,
) -> Vec<DrawGroup> {
    // ── 1. Collect all [Resource...] definitions ──────────────────────────────
    let mut resources: HashMap<String, ResourceRecord> = HashMap::new();

    for sec in sections {
        let lower_name = sec.name.to_lowercase();
        if lower_name.starts_with("resource") {
            let mut filename: Option<String> = None;
            let mut stride: Option<usize> = None;
            let mut format: Option<String> = None;

            for entry in &sec.entries {
                match entry.key.as_str() {
                    "filename" => filename = Some(entry.val.clone()),
                    "stride" => stride = entry.val.parse::<usize>().ok(),
                    "format" => format = Some(entry.val.clone()),
                    _ => {}
                }
            }

            if let Some(fname) = filename {
                if let Some(full_path) = safe_resource_path(&sec.ini_dir, mod_dir, &fname, base_model_folder) {
                    resources.insert(
                        lower_name.clone(),
                        ResourceRecord {
                            name: sec.name.clone(),
                            filename: fname,
                            full_path,
                            stride,
                            format,
                        },
                    );
                }
            }
        }
    }

    // Helper: resolve a resource name to ResourceRecord
    let find_resource = |res_name: &str| -> Option<ResourceRecord> {
        let clean = res_name.trim().trim_start_matches("ref ").trim().to_lowercase();
        let direct_key = if clean.starts_with("resource") {
            clean.clone()
        } else {
            format!("resource{}", clean)
        };

        if let Some(r) = resources.get(&direct_key) {
            return Some(r.clone());
        }
        if let Some(r) = resources.get(&clean) {
            return Some(r.clone());
        }

        // Direct file fallback
        if clean.ends_with(".buf") || clean.ends_with(".ib") || clean.ends_with(".dds") || clean.ends_with(".png") || clean.ends_with(".jpg") {
            if let Some(p) = safe_resource_path(mod_dir, mod_dir, res_name, base_model_folder) {
                return Some(ResourceRecord {
                    name: res_name.to_string(),
                    filename: res_name.to_string(),
                    full_path: p,
                    stride: None,
                    format: None,
                });
            }
        }
        None
    };

    // ── 2. Scan component buffer bindings and map overrides ─────────────────────
    let mut comp_pos: HashMap<String, String> = HashMap::new(); // comp -> resource name
    let mut comp_tc: HashMap<String, String> = HashMap::new();
    let mut hash_pos: HashMap<String, String> = HashMap::new(); // hash -> resource name
    let mut hash_tc: HashMap<String, String> = HashMap::new();
    let mut hash_diffuse: HashMap<String, String> = HashMap::new(); // hash -> resource name
    let mut diffuse_map: HashMap<String, String> = HashMap::new(); // comp/submesh -> resource name
    let mut normal_map: HashMap<String, String> = HashMap::new();
    let mut light_map: HashMap<String, String> = HashMap::new();
    let mut material_map: HashMap<String, String> = HashMap::new();

    for sec in sections {
        let sec_lower = sec.name.to_lowercase();
        if !sec_lower.starts_with("textureoverride") && !sec_lower.starts_with("commandlist") {
            continue;
        }

        let comp = clean_component_name(&sec.name);
        let mut sec_hash: Option<String> = None;

        for entry in &sec.entries {
            let k = entry.key.as_str();
            let v = entry.val.as_str();
            match k {
                "hash" => {
                    let h = v.trim().trim_start_matches("0x").to_lowercase();
                    sec_hash = Some(h);
                }
                "vb0" => {
                    if !v.eq_ignore_ascii_case("null") {
                        if !comp.is_empty() {
                            comp_pos.insert(comp.clone(), v.to_string());
                        }
                        if let Some(ref h) = sec_hash {
                            hash_pos.insert(h.clone(), v.to_string());
                        }
                    }
                }
                "vb1" => {
                    if !v.eq_ignore_ascii_case("null") {
                        if !comp.is_empty() {
                            comp_tc.insert(comp.clone(), v.to_string());
                        }
                        if let Some(ref h) = sec_hash {
                            hash_tc.insert(h.clone(), v.to_string());
                        }
                    }
                }
                "vb2" => {
                    // In some mods vb2 is Texcoord (stride != 32)
                    if !v.eq_ignore_ascii_case("null") {
                        if let Some(r) = find_resource(v) {
                            if r.stride.unwrap_or(0) != 32 {
                                if !comp.is_empty() && !comp_tc.contains_key(&comp) {
                                    comp_tc.insert(comp.clone(), v.to_string());
                                }
                                if let Some(ref h) = sec_hash {
                                    hash_tc.insert(h.clone(), v.to_string());
                                }
                            }
                        }
                    }
                }
                "this" | "ps-t0" => {
                    if !v.eq_ignore_ascii_case("null") {
                        let is_diffuse = sec.name.to_lowercase().contains("diffuse")
                            || v.to_lowercase().contains("diffuse")
                            || k == "ps-t0";
                        if is_diffuse {
                            if !comp.is_empty() {
                                diffuse_map.insert(comp.clone(), v.to_string());
                            }
                            if let Some(ref h) = sec_hash {
                                hash_diffuse.insert(h.clone(), v.to_string());
                            }
                            let raw_sec_clean = sec
                                .name
                                .strip_prefix("TextureOverride")
                                .unwrap_or(&sec.name)
                                .to_lowercase();
                            diffuse_map.insert(raw_sec_clean, v.to_string());
                        } else if sec.name.to_lowercase().contains("normal") {
                            if !comp.is_empty() { normal_map.insert(comp.clone(), v.to_string()); }
                            normal_map.insert(sec.name.to_lowercase(), v.to_string());
                        } else if sec.name.to_lowercase().contains("light") {
                            if !comp.is_empty() { light_map.insert(comp.clone(), v.to_string()); }
                            light_map.insert(sec.name.to_lowercase(), v.to_string());
                        } else if sec.name.to_lowercase().contains("material") {
                            if !comp.is_empty() { material_map.insert(comp.clone(), v.to_string()); }
                            material_map.insert(sec.name.to_lowercase(), v.to_string());
                        }
                    }
                }
                "ps-t1" => {
                    if !v.eq_ignore_ascii_case("null") {
                        if !comp.is_empty() { normal_map.insert(comp.clone(), v.to_string()); }
                        normal_map.insert(sec.name.to_lowercase(), v.to_string());
                    }
                }
                "ps-t2" => {
                    if !v.eq_ignore_ascii_case("null") {
                        if !comp.is_empty() { light_map.insert(comp.clone(), v.to_string()); }
                        light_map.insert(sec.name.to_lowercase(), v.to_string());
                    }
                }
                "ps-t3" => {
                    if !v.eq_ignore_ascii_case("null") {
                        if !comp.is_empty() { material_map.insert(comp.clone(), v.to_string()); }
                        material_map.insert(sec.name.to_lowercase(), v.to_string());
                    }
                }
                k_str if k_str.contains("diffuse") => {
                    if !v.eq_ignore_ascii_case("null") {
                        if !comp.is_empty() {
                            diffuse_map.insert(comp.clone(), v.to_string());
                        }
                        if let Some(ref h) = sec_hash {
                            hash_diffuse.insert(h.clone(), v.to_string());
                        }
                        let raw_sec_clean = sec
                            .name
                            .strip_prefix("TextureOverride")
                            .or_else(|| sec.name.strip_prefix("CommandList"))
                            .unwrap_or(&sec.name)
                            .to_lowercase();
                        diffuse_map.insert(raw_sec_clean, v.to_string());
                    }
                }
                k_str if k_str.contains("normal") => {
                    if !v.eq_ignore_ascii_case("null") {
                        if !comp.is_empty() { normal_map.insert(comp.clone(), v.to_string()); }
                        normal_map.insert(sec.name.to_lowercase(), v.to_string());
                    }
                }
                k_str if k_str.contains("light") => {
                    if !v.eq_ignore_ascii_case("null") {
                        if !comp.is_empty() { light_map.insert(comp.clone(), v.to_string()); }
                        light_map.insert(sec.name.to_lowercase(), v.to_string());
                    }
                }
                k_str if k_str.contains("material")
                    && !v.eq_ignore_ascii_case("null") => {
                        if !comp.is_empty() { material_map.insert(comp.clone(), v.to_string()); }
                        material_map.insert(sec.name.to_lowercase(), v.to_string());
                    }
                _ => {}
            }
        }
    }

    // ── 3. Find draw sections & build groups ───────────────────────────────────
    let mut groups: Vec<DrawGroup> = Vec::new();
    let mut seen_draw_keys: HashSet<(PathBuf, usize, usize, i32, Option<String>, PathBuf)> = HashSet::new();

    // Map of lowercase section name -> &IniSection
    let mut section_map: HashMap<String, &IniSection> = HashMap::new();
    for sec in sections {
        section_map.insert(sec.name.to_lowercase(), sec);
    }

    #[derive(Default, Debug)]
    struct ScannedSection {
        ib: Option<String>,
        vb0: Option<String>,
        vb1: Option<String>,
        diffuse: Option<String>,
        normal: Option<String>,
        light: Option<String>,
        material: Option<String>,
        handling_skip: bool,
        hash: Option<String>,
        draws: Vec<DrawIndexed>,
        runs: Vec<String>,
    }

    fn scan_section_recursive(
        sec_name: &str,
        section_map: &HashMap<String, &IniSection>,
        out: &mut ScannedSection,
        visiting: &mut HashSet<String>,
    ) {
        let sec_key = sec_name.trim().trim_start_matches("ref ").trim().to_lowercase();
        if visiting.contains(&sec_key) {
            return;
        }
        let sec = match section_map.get(&sec_key) {
            Some(s) => *s,
            None => return,
        };

        visiting.insert(sec_key.clone());

        for entry in &sec.entries {
            let k_low = entry.key.to_lowercase();
            let v_clean = entry.val.trim();
            if v_clean.eq_ignore_ascii_case("null") {
                continue;
            }

            match k_low.as_str() {
                "ib" => {
                    if out.ib.is_none() {
                        out.ib = Some(v_clean.to_string());
                    }
                }
                "vb0" => {
                    if out.vb0.is_none() {
                        out.vb0 = Some(v_clean.to_string());
                    }
                }
                "vb1" => {
                    if out.vb1.is_none() {
                        out.vb1 = Some(v_clean.to_string());
                    }
                }
                "vb2" => {
                    if out.vb1.is_none() {
                        out.vb1 = Some(v_clean.to_string());
                    }
                }
                "ps-t0" => {
                    if out.diffuse.is_none() {
                        out.diffuse = Some(v_clean.to_string());
                    }
                }
                "ps-t1" => {
                    if out.normal.is_none() {
                        out.normal = Some(v_clean.to_string());
                    }
                }
                "ps-t2" => {
                    if out.light.is_none() {
                        out.light = Some(v_clean.to_string());
                    }
                }
                "ps-t3" => {
                    if out.material.is_none() {
                        out.material = Some(v_clean.to_string());
                    }
                }
                "this" => {
                    let sec_low = sec.name.to_lowercase();
                    if sec_low.contains("diffuse") && out.diffuse.is_none() {
                        out.diffuse = Some(v_clean.to_string());
                    } else if sec_low.contains("normal") && out.normal.is_none() {
                        out.normal = Some(v_clean.to_string());
                    } else if sec_low.contains("light") && out.light.is_none() {
                        out.light = Some(v_clean.to_string());
                    } else if sec_low.contains("material") && out.material.is_none() {
                        out.material = Some(v_clean.to_string());
                    }
                }
                k_str if k_str.contains("diffuse") => {
                    if out.diffuse.is_none() {
                        out.diffuse = Some(v_clean.to_string());
                    }
                }
                k_str if k_str.contains("normal") => {
                    if out.normal.is_none() {
                        out.normal = Some(v_clean.to_string());
                    }
                }
                k_str if k_str.contains("light") => {
                    if out.light.is_none() {
                        out.light = Some(v_clean.to_string());
                    }
                }
                k_str if k_str.contains("material") => {
                    if out.material.is_none() {
                        out.material = Some(v_clean.to_string());
                    }
                }
                "handling" if v_clean.eq_ignore_ascii_case("skip") => {
                    out.handling_skip = true;
                }
                "hash" => {
                    if out.hash.is_none() {
                        out.hash = Some(v_clean.trim_start_matches("0x").to_lowercase());
                    }
                }
                "drawindexed" => {
                    let parts: Vec<&str> = v_clean.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 3 {
                        if let (Ok(count), Ok(start), Ok(base)) = (
                            parts[0].parse::<usize>(),
                            parts[1].parse::<usize>(),
                            parts[2].parse::<i32>(),
                        ) {
                            out.draws.push(DrawIndexed {
                                count,
                                start,
                                base,
                                condition: entry.condition.clone(),
                            });
                        }
                    } else if parts.len() == 1 && parts[0].eq_ignore_ascii_case("auto") {
                        out.draws.push(DrawIndexed {
                            count: 0,
                            start: 0,
                            base: 0,
                            condition: entry.condition.clone(),
                        });
                    }
                }
                "run" => {
                    let target = v_clean.trim_start_matches("ref ").trim();
                    out.runs.push(target.to_string());
                    scan_section_recursive(target, section_map, out, visiting);
                }
                _ => {}
            }
        }

        visiting.remove(&sec_key);
    }

    for sec in sections {
        let sec_lower = sec.name.to_lowercase();
        if !sec_lower.starts_with("textureoverride") && !sec_lower.starts_with("commandlist") {
            continue;
        }

        let mut scanned = ScannedSection::default();
        let mut visiting = HashSet::new();
        scan_section_recursive(&sec.name, &section_map, &mut scanned, &mut visiting);

        // If handling = skip and NO drawindexed lines, skip (it's only suppressing the original draw)
        if scanned.handling_skip && scanned.draws.is_empty() {
            continue;
        }

        // Must have either an IB or drawindexed lines
        if scanned.ib.is_none() && scanned.draws.is_empty() {
            continue;
        }

        let comp_key = clean_component_name(&sec.name);

        // Resolve IB Resource
        let ib_res_record = scanned
            .ib
            .as_deref()
            .and_then(find_resource)
            .or_else(|| {
                resources.values().find(|r| {
                    let r_name = r.name.to_lowercase();
                    let f_name = r.filename.to_lowercase();
                    (r_name.ends_with("ib") || f_name.ends_with(".ib"))
                        && (r_name.contains(&comp_key) || comp_key.contains(&clean_component_name(&r.name)))
                }).cloned()
            });

        let ib_record = match ib_res_record {
            Some(r) if r.full_path.exists() => r,
            _ => continue,
        };

        // Determine derived component name from IB name if more specific
        let effective_comp = clean_component_name(&ib_record.name);
        let lookup_comp = if !effective_comp.is_empty() { effective_comp } else { comp_key };

        // Resolve Position Buffer
        let pos_record = scanned
            .vb0
            .as_deref()
            .and_then(find_resource)
            .or_else(|| comp_pos.get(&lookup_comp).and_then(|r| find_resource(r)))
            .or_else(|| {
                comp_pos.iter().find(|(k, _)| lookup_comp.contains(k.as_str()) || k.contains(&lookup_comp))
                    .and_then(|(_, r)| find_resource(r))
            })
            .or_else(|| scanned.hash.as_ref().and_then(|h| hash_pos.get(h)).and_then(|r| find_resource(r)))
            .or_else(|| {
                resources.values().find(|r| {
                    let n = r.name.to_lowercase();
                    let f = r.filename.to_lowercase();
                    (n.contains("position") || f.contains("position"))
                        && (n.contains(&lookup_comp) || lookup_comp.contains(&clean_component_name(&r.name)))
                }).cloned()
            })
            .or_else(|| {
                let pos_bufs: Vec<_> = resources.values().filter(|r| r.name.to_lowercase().contains("position") || r.filename.to_lowercase().contains("position")).collect();
                if pos_bufs.len() == 1 {
                    Some(pos_bufs[0].clone())
                } else {
                    None
                }
            });

        let pos_record = match pos_record {
            Some(r) if r.full_path.exists() => r,
            _ => continue,
        };

        // Resolve Texcoord Buffer
        let tc_record = scanned
            .vb1
            .as_deref()
            .and_then(find_resource)
            .or_else(|| comp_tc.get(&lookup_comp).and_then(|r| find_resource(r)))
            .or_else(|| {
                comp_tc.iter().find(|(k, _)| lookup_comp.contains(k.as_str()) || k.contains(&lookup_comp))
                    .and_then(|(_, r)| find_resource(r))
            })
            .or_else(|| scanned.hash.as_ref().and_then(|h| hash_tc.get(h)).and_then(|r| find_resource(r)))
            .or_else(|| {
                resources.values().find(|r| {
                    let n = r.name.to_lowercase();
                    let f = r.filename.to_lowercase();
                    (n.contains("texcoord") || f.contains("texcoord"))
                        && (n.contains(&lookup_comp) || lookup_comp.contains(&clean_component_name(&r.name)))
                }).cloned()
            })
            .or_else(|| {
                let tc_bufs: Vec<_> = resources.values().filter(|r| r.name.to_lowercase().contains("texcoord") || r.filename.to_lowercase().contains("texcoord")).collect();
                if tc_bufs.len() == 1 {
                    Some(tc_bufs[0].clone())
                } else {
                    None
                }
            });

        // Resolve Diffuse Texture
        let submesh_key = sec.name.strip_prefix("TextureOverride").or_else(|| sec.name.strip_prefix("CommandList")).unwrap_or(&sec.name).to_lowercase();
        let diff_record = scanned
            .diffuse
            .as_deref()
            .and_then(find_resource)
            .or_else(|| {
                for r in &scanned.runs {
                    let clean_r = r.strip_prefix("commandlist").unwrap_or(r);
                    if let Some(res) = diffuse_map.get(clean_r) {
                        if let Some(rec) = find_resource(res) {
                            return Some(rec);
                        }
                    }
                }
                None
            })
            .or_else(|| scanned.hash.as_ref().and_then(|h| hash_diffuse.get(h)).and_then(|r| find_resource(r)))
            .or_else(|| diffuse_map.get(&submesh_key).and_then(|r| find_resource(r)))
            .or_else(|| diffuse_map.get(&lookup_comp).and_then(|r| find_resource(r)))
            .or_else(|| {
                resources.values().find(|r| {
                    let n = r.name.to_lowercase();
                    let f = r.filename.to_lowercase();
                    (n.contains("diffuse") || f.contains("diffuse"))
                        && (n.contains(&submesh_key) || n.contains(&lookup_comp))
                }).cloned()
            });

        // Resolve Normal Map
        let normal_record = scanned
            .normal
            .as_deref()
            .and_then(find_resource)
            .or_else(|| normal_map.get(&submesh_key).and_then(|r| find_resource(r)))
            .or_else(|| normal_map.get(&lookup_comp).and_then(|r| find_resource(r)))
            .or_else(|| {
                resources.values().find(|r| {
                    let n = r.name.to_lowercase();
                    let f = r.filename.to_lowercase();
                    (n.contains("normal") || f.contains("normal"))
                        && (n.contains(&submesh_key) || n.contains(&lookup_comp))
                }).cloned()
            });

        // Resolve Light Map
        let light_record = scanned
            .light
            .as_deref()
            .and_then(find_resource)
            .or_else(|| light_map.get(&submesh_key).and_then(|r| find_resource(r)))
            .or_else(|| light_map.get(&lookup_comp).and_then(|r| find_resource(r)))
            .or_else(|| {
                resources.values().find(|r| {
                    let n = r.name.to_lowercase();
                    let f = r.filename.to_lowercase();
                    (n.contains("light") || f.contains("light"))
                        && (n.contains(&submesh_key) || n.contains(&lookup_comp))
                }).cloned()
            });

        // Resolve Material Map
        let material_record = scanned
            .material
            .as_deref()
            .and_then(find_resource)
            .or_else(|| material_map.get(&submesh_key).and_then(|r| find_resource(r)))
            .or_else(|| material_map.get(&lookup_comp).and_then(|r| find_resource(r)))
            .or_else(|| {
                resources.values().find(|r| {
                    let n = r.name.to_lowercase();
                    let f = r.filename.to_lowercase();
                    (n.contains("material") || f.contains("material"))
                        && (n.contains(&submesh_key) || n.contains(&lookup_comp))
                }).cloned()
            });

        // If no explicit drawindexed, treat as auto/whole buffer
        let mut draws = scanned.draws;
        if draws.is_empty() {
            draws.push(DrawIndexed { count: 0, start: 0, base: 0, condition: None });
        }

        // Deduplicate draw calls: if we've already registered this exact draw against these buffers, filter it out
        let mut unique_draws = Vec::new();
        for d in draws {
            let key = (
                ib_record.full_path.clone(),
                d.start,
                d.count,
                d.base,
                d.condition.clone(),
                pos_record.full_path.clone(),
            );
            if !seen_draw_keys.contains(&key) {
                seen_draw_keys.insert(key);
                unique_draws.push(d);
            }
        }

        if unique_draws.is_empty() {
            continue;
        }

        let display_name = sec
            .name
            .strip_prefix("TextureOverride")
            .or_else(|| sec.name.strip_prefix("CommandList"))
            .unwrap_or(&sec.name)
            .to_string();

        let index_size = match ib_record.format.as_deref() {
            Some(fmt) if fmt.contains("R16") => INDEX_SIZE_U16,
            _ => INDEX_SIZE_U32,
        };

        let pos_stride = pos_record.stride.filter(|&s| s >= 12).unwrap_or(DEFAULT_POSITION_STRIDE);
        let tc_stride = tc_record.as_ref().and_then(|r| r.stride).filter(|&s| s >= 4).unwrap_or(24);

        groups.push(DrawGroup {
            name: display_name,
            position_file: pos_record.full_path,
            texcoord_file: tc_record.map(|r| r.full_path),
            ib_file: ib_record.full_path,
            position_stride: pos_stride,
            texcoord_stride: tc_stride,
            index_size,
            diffuse_file: diff_record.map(|r| r.full_path),
            normal_file: normal_record.map(|r| r.full_path),
            light_file: light_record.map(|r| r.full_path),
            material_file: material_record.map(|r| r.full_path),
            draws: unique_draws,
        });
    }

    // ── 4. Fallback: Resource-based synthesis if no INI draw sections were resolved ───
    if groups.is_empty() {
        let ib_resources: Vec<ResourceRecord> = resources
            .values()
            .filter(|r| {
                let n = r.name.to_lowercase();
                let f = r.filename.to_lowercase();
                f.ends_with(".ib")
                    || n.ends_with("ib")
                    || r.format.as_deref().map(|fmt| fmt.contains("UINT")).unwrap_or(false)
            })
            .cloned()
            .collect();

        for ib_res in ib_resources {
            let comp = clean_component_name(&ib_res.name);
            let pos_res = resources.values().find(|r| {
                let n = r.name.to_lowercase();
                let f = r.filename.to_lowercase();
                (f.ends_with(".buf") || n.contains("position") || f.contains("position"))
                    && (n.contains(&comp) || comp.contains(&clean_component_name(&r.name)) || f.contains("position"))
            });
            let tc_res = resources.values().find(|r| {
                let n = r.name.to_lowercase();
                let f = r.filename.to_lowercase();
                (f.ends_with(".buf") || n.contains("texcoord") || f.contains("texcoord"))
                    && (n.contains(&comp) || comp.contains(&clean_component_name(&r.name)) || f.contains("texcoord"))
            });
            let diff_res = resources.values().find(|r| {
                let n = r.name.to_lowercase();
                let f = r.filename.to_lowercase();
                (f.ends_with(".dds") || f.ends_with(".png"))
                    && (n.contains("diffuse") || f.contains("diffuse"))
                    && (n.contains(&comp) || comp.contains(&clean_component_name(&r.name)))
            }).or_else(|| {
                resources.values().find(|r| {
                    let f = r.filename.to_lowercase();
                    f.ends_with(".dds") || f.ends_with(".png")
                })
            });
            let normal_res = resources.values().find(|r| {
                let n = r.name.to_lowercase();
                let f = r.filename.to_lowercase();
                (f.ends_with(".dds") || f.ends_with(".png") || f.ends_with(".jpg"))
                    && (n.contains("normal") || f.contains("normal"))
                    && (n.contains(&comp) || comp.contains(&clean_component_name(&r.name)))
            });
            let light_res = resources.values().find(|r| {
                let n = r.name.to_lowercase();
                let f = r.filename.to_lowercase();
                (f.ends_with(".dds") || f.ends_with(".png"))
                    && (n.contains("light") || f.contains("light"))
                    && (n.contains(&comp) || comp.contains(&clean_component_name(&r.name)))
            });
            let material_res = resources.values().find(|r| {
                let n = r.name.to_lowercase();
                let f = r.filename.to_lowercase();
                (f.ends_with(".dds") || f.ends_with(".png"))
                    && (n.contains("material") || f.contains("material"))
                    && (n.contains(&comp) || comp.contains(&clean_component_name(&r.name)))
            });

            if let (Some(pos), Some(tc)) = (pos_res, tc_res) {
                if pos.full_path.exists() && tc.full_path.exists() && ib_res.full_path.exists() {
                    let index_size = match ib_res.format.as_deref() {
                        Some(fmt) if fmt.contains("R16") => INDEX_SIZE_U16,
                        _ => INDEX_SIZE_U32,
                    };
                    groups.push(DrawGroup {
                        name: comp.clone(),
                        position_file: pos.full_path.clone(),
                        texcoord_file: Some(tc.full_path.clone()),
                        ib_file: ib_res.full_path.clone(),
                        position_stride: pos.stride.filter(|&s| s >= 12).unwrap_or(DEFAULT_POSITION_STRIDE),
                        texcoord_stride: tc.stride.filter(|&s| s >= 4).unwrap_or(24),
                        index_size,
                        diffuse_file: diff_res.map(|r| r.full_path.clone()),
                        normal_file: normal_res.map(|r| r.full_path.clone()),
                        light_file: light_res.map(|r| r.full_path.clone()),
                        material_file: material_res.map(|r| r.full_path.clone()),
                        draws: vec![DrawIndexed { count: 0, start: 0, base: 0, condition: None }],
                    });
                }
            }
        }
    }

    groups
}


pub fn clean_variable_name(var: &str) -> String {
    let raw = var.trim_start_matches('$').replace('_', " ");
    let words: Vec<String> = raw
        .split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect();
    if words.is_empty() {
        var.to_string()
    } else {
        words.join(" ")
    }
}

/// Extract interactive toggles and variation cycles from [Constants] and [Key...] sections.
pub fn extract_ini_toggles(sections: &[IniSection]) -> Vec<ViewerToggle> {
    let mut defaults: HashMap<String, i32> = HashMap::new();
    let mut toggles: Vec<ViewerToggle> = Vec::new();
    let mut seen_vars: HashSet<String> = HashSet::new();

    // 1. Scan [Constants] for default values
    for sec in sections {
        if sec.name.eq_ignore_ascii_case("constants") {
            for entry in &sec.entries {
                let clean_k = entry.key.trim().to_lowercase();
                let var_part = clean_k
                    .split_whitespace()
                    .find(|p| p.starts_with('$'))
                    .unwrap_or(&clean_k);
                if var_part.starts_with('$') {
                    if let Ok(v) = entry.val.trim().parse::<i32>() {
                        defaults.insert(var_part.to_string(), v);
                    }
                }
            }
        }
    }

    // 2. Scan [Key...] sections
    for sec in sections {
        let sec_low = sec.name.to_lowercase();
        if !sec_low.starts_with("key") {
            continue;
        }

        let key_bind = sec
            .entries
            .iter()
            .find(|e| e.key == "key")
            .map(|e| e.val.trim().to_string());

        for entry in &sec.entries {
            if entry.key.starts_with('$') {
                let var_name = entry.key.trim().to_string();
                if seen_vars.contains(&var_name) {
                    continue;
                }

                let values: Vec<i32> = entry
                    .val
                    .split(',')
                    .filter_map(|s| s.trim().parse::<i32>().ok())
                    .collect();

                if values.is_empty() {
                    continue;
                }

                // Deduplicate preserving order
                let mut unique_values = Vec::new();
                for &v in &values {
                    if !unique_values.contains(&v) {
                        unique_values.push(v);
                    }
                }

                let cur_val = defaults.get(&var_name).copied().unwrap_or(unique_values[0]);
                let display_name = clean_variable_name(&var_name);

                let labels = if unique_values == vec![0, 1] {
                    Some(vec!["Off".to_string(), "On".to_string()])
                } else if unique_values == vec![1, 0] {
                    Some(vec!["On".to_string(), "Off".to_string()])
                } else {
                    Some(
                        unique_values
                            .iter()
                            .enumerate()
                            .map(|(i, _)| format!("Style {}", i + 1))
                            .collect(),
                    )
                };

                seen_vars.insert(var_name.clone());
                toggles.push(ViewerToggle {
                    id: format!("{}_{}", sec.name, var_name.trim_start_matches('$')),
                    name: display_name,
                    key: key_bind.clone(),
                    variable: var_name,
                    current_value: cur_val,
                    values: unique_values,
                    labels,
                });
            }
        }
    }

    toggles
}

/// Compute heuristic auto-suggested tags based on geometry inspection and INI toggles.
pub fn compute_suggested_tags(
    is_retexture: bool,
    meshes: &[MeshData],
    textures: &HashMap<String, String>,
    toggles: &[ViewerToggle],
) -> Vec<String> {
    let mut tags = Vec::new();

    if is_retexture || (meshes.is_empty() && !textures.is_empty()) {
        tags.push("Retexture".to_string());
    }

    if !toggles.is_empty() {
        tags.push("Toggle".to_string());
    }

    let mut has_outfit = false;
    let mut has_weapon = false;

    for m in meshes {
        let name_lower = m.name.to_lowercase();
        let comp_lower = m.component.as_deref().unwrap_or("").to_lowercase();
        let combined = format!("{} {}", name_lower, comp_lower);

        if combined.contains("body")
            || combined.contains("dress")
            || combined.contains("hair")
            || combined.contains("head")
            || combined.contains("cloth")
            || combined.contains("suit")
            || combined.contains("outfit")
            || combined.contains("jacket")
        {
            has_outfit = true;
        }

        if combined.contains("weapon")
            || combined.contains("wpn")
            || combined.contains("sword")
            || combined.contains("gun")
            || combined.contains("blade")
            || combined.contains("spear")
            || combined.contains("shield")
            || combined.contains("hammer")
        {
            has_weapon = true;
        }
    }

    if has_outfit {
        tags.push("Outfit".to_string());
    }
    if has_weapon {
        tags.push("Weapon".to_string());
    }
    if meshes.len() >= 4 {
        tags.push("MultiMesh".to_string());
    }

    tags.sort();
    tags.dedup();
    tags
}

