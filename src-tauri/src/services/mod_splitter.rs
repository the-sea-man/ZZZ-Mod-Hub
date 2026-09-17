use crate::conflict_scanner::extract_component_name;
use crate::error::AppError;
use crate::install::sanitize_path_component;
use crate::utils::find_ini_files;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use tauri::Manager;
use crate::models::HashTarget;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IniSection {
    pub name: String,
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IniAst {
    pub header_lines: Vec<String>,
    pub sections: Vec<IniSection>,
}

impl IniAst {
    pub fn parse(content: &str) -> Self {
        let mut header_lines = Vec::new();
        let mut sections = Vec::new();
        let mut current_section: Option<IniSection> = None;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('[') {
                if let Some(close_idx) = trimmed.rfind(']') {
                    let sec_name = trimmed[1..close_idx].trim().to_string();
                    if let Some(sec) = current_section.take() {
                        sections.push(sec);
                    }
                    current_section = Some(IniSection {
                        name: sec_name,
                        lines: Vec::new(),
                    });
                    continue;
                }
            }

            if let Some(ref mut sec) = current_section {
                sec.lines.push(line.to_string());
            } else {
                header_lines.push(line.to_string());
            }
        }

        if let Some(sec) = current_section {
            sections.push(sec);
        }

        IniAst {
            header_lines,
            sections,
        }
    }
}

impl std::fmt::Display for IniAst {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if !self.header_lines.is_empty() {
            writeln!(f, "{}", self.header_lines.join("\n"))?;
        }
        for (i, sec) in self.sections.iter().enumerate() {
            if i > 0 || !self.header_lines.is_empty() {
                writeln!(f)?;
            }
            writeln!(f, "[{}]", sec.name)?;
            writeln!(f, "{}", sec.lines.join("\n"))?;
        }
        Ok(())
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SplitGroupPreview {
    pub group_name: String,
    pub target_folder_name: String,
    pub override_count: usize,
    pub resource_count: usize,
    pub asset_files: Vec<String>,
    #[serde(default)]
    pub is_monolithic: Option<bool>,
    #[serde(default)]
    pub warning: Option<String>,
}

/// Helper to parse a key-value line from an INI line, stripping comments.
fn parse_kv_line(line: &str) -> Option<(String, String)> {
    let line_no_comment = if let Some(idx) = line.find([';', '#']) {
        &line[..idx]
    } else if let Some(idx) = line.find("//") {
        &line[..idx]
    } else {
        line
    };
    let trimmed = line_no_comment.trim();
    if trimmed.is_empty() {
        return None;
    }
    let (k, v) = trimmed.split_once('=')?;
    let key = k.trim().to_lowercase();
    let val = v.trim().trim_matches(&['"', '\''][..]).trim().to_string();
    Some((key, val))
}

/// Checks if a key is a resource or command reference in a 3DMigoto/ZZMI section.
fn is_resource_key(key: &str) -> bool {
    matches!(
        key,
        "ib" | "vb0"
            | "vb1"
            | "vb2"
            | "ps-t0"
            | "ps-t1"
            | "ps-t2"
            | "ps-t3"
            | "filename"
            | "this"
            | "run"
            | "customshader"
            | "shader"
            | "vs"
            | "ps"
            | "cs"
    ) || key.starts_with("vb")
        || key.starts_with("ps-t")
        || key.starts_with("ps-u")
        || key.starts_with("vs-t")
        || key.starts_with("vs-u")
        || key.starts_with("cs-t")
        || key.starts_with("cs-u")
        || key.starts_with("resource")
}

fn is_probable_filepath(val: &str) -> bool {
    let clean = val.trim().trim_matches(&['"', '\''][..]);
    let lower = clean.to_lowercase();
    lower.ends_with(".dds")
        || lower.ends_with(".buf")
        || lower.ends_with(".ib")
        || lower.ends_with(".fmt")
        || lower.ends_with(".txt")
        || lower.ends_with(".png")
        || lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".webp")
        || lower.ends_with(".tga")
        || lower.ends_with(".hlsl")
        || clean.contains('/')
        || clean.contains('\\')
}

/// Sanitizes a relative file path extracted from INI files:
/// strips leading './', '../', '..\', and eliminates any '..' components
/// so that the path is strictly jailed within the mod directory.
pub fn sanitize_rel_path(path_str: &str) -> String {
    let mut clean = path_str
        .trim()
        .trim_matches(&['"', '\''][..])
        .replace('\\', "/");
    while clean.starts_with("./") || clean.starts_with("../") {
        if clean.starts_with("./") {
            clean = clean[2..].to_string();
        } else if clean.starts_with("../") {
            clean = clean[3..].to_string();
        }
    }
    let parts: Vec<&str> = clean
        .split('/')
        .filter(|p| !p.is_empty() && *p != "." && *p != "..")
        .collect();
    parts.join("/")
}

/// Normalizes an INI line containing file path references with parent traversals ('..').
/// Strips leading '../' and '..\' from path values while preserving line formatting and comments.
pub fn sanitize_ini_path_line(line: &str) -> String {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with(';') || trimmed.starts_with('#') || trimmed.starts_with("//") {
        return line.to_string();
    }
    if !line.contains("..") {
        return line.to_string();
    }
    let (code_part, comment_part) = if let Some(idx) = line.find([';', '#']) {
        (&line[..idx], &line[idx..])
    } else if let Some(idx) = line.find("//") {
        (&line[..idx], &line[idx..])
    } else {
        (line, "")
    };

    if let Some((k_raw, v_raw)) = code_part.split_once('=') {
        let mut v_clean = v_raw.trim();
        let mut quote = "";
        if (v_clean.starts_with('"') && v_clean.ends_with('"'))
            || (v_clean.starts_with('\'') && v_clean.ends_with('\''))
        {
            quote = "\"";
            v_clean = v_clean[1..v_clean.len() - 1].trim();
        }
        let normalized = sanitize_rel_path(v_clean);
        let formatted_path = if v_clean.contains('\\') {
            normalized.replace('/', "\\")
        } else {
            normalized
        };
        if !comment_part.is_empty() {
            format!("{} = {}{}{} {}", k_raw.trim(), quote, formatted_path, quote, comment_part.trim_start())
        } else {
            format!("{} = {}{}{}", k_raw.trim(), quote, formatted_path, quote)
        }
    } else {
        line.to_string()
    }
}

fn clean_resource_ref(val: &str) -> &str {
    let trimmed = val.trim().trim_matches(&['"', '\''][..]).trim();
    let stripped = trimmed
        .strip_prefix("ref ")
        .or_else(|| trimmed.strip_prefix("REF "))
        .or_else(|| trimmed.strip_prefix("Ref "))
        .or_else(|| trimmed.strip_prefix("copy "))
        .or_else(|| trimmed.strip_prefix("COPY "))
        .or_else(|| trimmed.strip_prefix("Copy "))
        .unwrap_or(trimmed);
    stripped.trim().trim_matches(&['"', '\''][..]).trim()
}

/// Extract referenced `[Resource...]` and `[CommandList...]` sections and asset filenames.
pub fn extract_section_dependencies(
    ast: &IniAst,
    override_sec: &IniSection,
) -> (Vec<IniSection>, Vec<String>) {
    let mut res_sections = Vec::new();
    let mut asset_files = Vec::new();
    let mut visited_res_names = HashSet::new();
    let mut queue = Vec::new();

    // Collect direct references from override_sec
    for line in &override_sec.lines {
        if let Some((key, val)) = parse_kv_line(line) {
            let clean = clean_resource_ref(&val);
            if is_resource_key(&key) && !clean.is_empty() {
                queue.push(clean.to_string());
            } else if key == "filename" || is_probable_filepath(clean) {
                let clean_asset = sanitize_rel_path(clean);
                if !clean_asset.is_empty() && !asset_files.contains(&clean_asset) {
                    asset_files.push(clean_asset);
                }
            }
        }
    }

    // Recursively resolve queue of referenced section names
    while let Some(target_name) = queue.pop() {
        let norm_target = target_name.replace('/', "\\");
        if let Some(res_sec) = ast
            .sections
            .iter()
            .find(|s| s.name.replace('/', "\\").eq_ignore_ascii_case(&norm_target))
        {
            if visited_res_names.insert(res_sec.name.to_lowercase()) {
                res_sections.push(res_sec.clone());

                for res_line in &res_sec.lines {
                    if let Some((res_k, res_v)) = parse_kv_line(res_line) {
                        let clean_v = clean_resource_ref(&res_v);
                        if (res_k == "filename" || is_probable_filepath(clean_v)) && !clean_v.is_empty()
                        {
                            let clean_asset = sanitize_rel_path(clean_v);
                            if !clean_asset.is_empty() && !asset_files.contains(&clean_asset) {
                                asset_files.push(clean_asset);
                            }
                        } else if is_resource_key(&res_k) && !clean_v.is_empty() {
                            queue.push(clean_v.to_string());
                        }
                    }
                }
            }
        } else if is_probable_filepath(&target_name) {
            let clean_asset = sanitize_rel_path(&target_name);
            if !clean_asset.is_empty() && !asset_files.contains(&clean_asset) {
                asset_files.push(clean_asset);
            }
        }
    }

    (res_sections, asset_files)
}


/// Extract character group name from a `[TextureOverride...]` section.
pub fn extract_character_group(section: &IniSection) -> String {
    let sec_name = section.name.trim();

    // 1. Try to extract character name from section name (e.g. TextureOverrideJaneDoeHRFace -> JaneDoeHR)
    let sec_clean = sec_name.trim_matches(&['[', ']'][..]).trim();
    let remainder = if sec_clean.to_lowercase().starts_with("textureoverride") {
        &sec_clean[15..]
    } else {
        sec_clean
    }
    .trim();

    let comp = extract_component_name(sec_name);
    let remainder_lower = remainder.to_lowercase();
    let comp_lower = comp.to_lowercase();

    let char_candidate = if comp != "General" && remainder_lower.ends_with(&comp_lower) {
        let cutoff = remainder.len() - comp.len();
        remainder[..cutoff].trim_matches(&['_', '-'][..]).to_string()
    } else {
        remainder.trim_matches(&['_', '-'][..]).to_string()
    };

    if !char_candidate.is_empty() && !char_candidate.chars().all(|c| c.is_numeric()) {
        return char_candidate;
    }

    // 2. Check for hash in section lines
    for line in &section.lines {
        if let Some((k, v)) = parse_kv_line(line) {
            if k == "hash" {
                let clean_hash = v
                    .strip_prefix("0x")
                    .or_else(|| v.strip_prefix("0X"))
                    .unwrap_or(&v)
                    .to_lowercase();
                if !clean_hash.is_empty() {
                    return clean_hash;
                }
            }
        }
    }

    // 3. Fallback
    if !char_candidate.is_empty() {
        char_candidate
    } else {
        "General".to_string()
    }
}

fn parse_all_inis_in_dir(source_dir: &Path) -> Result<IniAst, AppError> {
    let mut ini_files = Vec::new();
    find_ini_files(source_dir, &mut ini_files, 0, 15);

    if ini_files.is_empty() {
        return Err(AppError::Custom(
            "No INI files found in mod directory".into(),
        ));
    }

    let mut combined_header_lines = Vec::new();
    let mut combined_sections = Vec::new();

    for ini_path in &ini_files {
        if let Ok(content) = crate::utils::read_ini_to_string(ini_path) {
            let ast = IniAst::parse(&content);
            for h in ast.header_lines {
                if !combined_header_lines.contains(&h) {
                    combined_header_lines.push(h);
                }
            }
            for sec in ast.sections {
                if !combined_sections
                    .iter()
                    .any(|s: &IniSection| s.name.eq_ignore_ascii_case(&sec.name))
                {
                    combined_sections.push(sec);
                }
            }
        }
    }

    Ok(IniAst {
        header_lines: combined_header_lines,
        sections: combined_sections,
    })
}

pub fn is_shared_utility_section(section: &IniSection) -> bool {
    let lower = section.name.to_lowercase();
    if lower == "present"
        || lower.starts_with("present.")
        || lower.contains("noise")
        || lower.contains("renderui")
        || lower.contains("frame_animation")
        || lower.contains("customshader")
        || lower.contains("menu")
        || lower.contains("credit")
    {
        return true;
    }
    for line in &section.lines {
        if let Some((k, v)) = parse_kv_line(line) {
            let v_low = v.to_lowercase();
            if k == "hash"
                && (crate::utils::GENERIC_SHARED_HASHES.contains(&v_low.as_str())
                    || v_low == "d9a12c0a")
            {
                return true;
            }
            if v_low.contains("noise.dds") || v_low.contains("renderui.hlsl") || v_low.contains("lib/") {
                return true;
            }
        }
    }
    false
}

pub fn get_anatomical_stems_for_group(group_name: &str) -> Vec<&'static str> {
    let lower = group_name.to_lowercase();
    let mut stems = Vec::new();
    if lower.contains("top")
        || lower.contains("torso")
        || lower.contains("chest")
        || lower.contains("bra")
        || lower.contains("shirt")
    {
        stems.push("top");
    }
    if lower.contains("bottom")
        || lower.contains("skirt")
        || lower.contains("dress")
        || lower.contains("pant")
        || lower.contains("leg")
        || lower.contains("pelvis")
    {
        stems.push("bottom");
    }
    if lower.contains("hair") || lower.contains("headwear") || lower.contains("hat") {
        stems.push("hair");
    }
    if lower.contains("face") || lower.contains("makeup") || lower.contains("eye") {
        stems.push("face");
    }
    if lower.contains("arm") || lower.contains("glove") {
        stems.push("arm");
    }
    if lower.contains("feet") || lower.contains("shoe") || lower.contains("boot") {
        stems.push("feet");
    }
    stems
}

pub fn should_include_utility_for_group(
    name_or_line: &str,
    current_group: &str,
    all_groups: &[String],
) -> bool {
    let lower = name_or_line.to_lowercase();
    let my_stems = get_anatomical_stems_for_group(current_group);

    // Check if line/section explicitly mentions any other group's anatomical stems
    let mut mentions_other = false;
    for other in all_groups {
        let other_stems = get_anatomical_stems_for_group(other);
        for os in other_stems {
            if !my_stems.contains(&os) && lower.contains(os) {
                mentions_other = true;
                break;
            }
        }
        if mentions_other {
            break;
        }
    }

    if mentions_other {
        // Only keep if it ALSO mentions one of our own stems
        return my_stems.iter().any(|ms| lower.contains(ms));
    }

    true
}

fn partition_sections(full_ast: &IniAst) -> (Vec<IniSection>, Vec<IniSection>, Vec<IniSection>) {
    let mut global_sections = Vec::new();
    let mut texture_overrides = Vec::new();
    let mut shared_utilities = Vec::new();

    for sec in &full_ast.sections {
        let name_lower = sec.name.to_lowercase();
        if is_shared_utility_section(sec) {
            shared_utilities.push(sec.clone());
        } else if name_lower.starts_with("textureoverride") || name_lower.starts_with("shaderoverride") {
            texture_overrides.push(sec.clone());
        } else if !name_lower.starts_with("resource") && !name_lower.starts_with("commandlist") {
            global_sections.push(sec.clone());
        }
    }

    (global_sections, texture_overrides, shared_utilities)
}

struct UnionFind {
    parent: Vec<usize>,
}

impl UnionFind {
    fn new(size: usize) -> Self {
        Self {
            parent: (0..size).collect(),
        }
    }

    fn find(&mut self, i: usize) -> usize {
        let mut root = i;
        while root != self.parent[root] {
            root = self.parent[root];
        }
        let mut curr = i;
        while curr != root {
            let nxt = self.parent[curr];
            self.parent[curr] = root;
            curr = nxt;
        }
        root
    }

    fn union(&mut self, i: usize, j: usize) {
        let root_i = self.find(i);
        let root_j = self.find(j);
        if root_i != root_j {
            self.parent[root_i] = root_j;
        }
    }
}

pub fn extract_semantic_stem(section_name: &str) -> String {
    extract_semantic_stem_with_char(section_name, None)
}

pub fn extract_semantic_stem_with_char(section_name: &str, char_hint: Option<&str>) -> String {
    let sec_clean = section_name.trim_matches(&['[', ']'][..]).trim();
    let is_upper: Vec<bool> = sec_clean.chars().map(|c| c.is_ascii_uppercase()).collect();
    let lower = sec_clean.to_lowercase();
    let mut remainder = lower
        .strip_prefix("textureoverride")
        .or_else(|| lower.strip_prefix("shaderoverride"))
        .or_else(|| lower.strip_prefix("resource"))
        .or_else(|| lower.strip_prefix("commandlist"))
        .unwrap_or(&lower)
        .trim();

    // 1. Strip dynamic character hint if provided (e.g. from detected section character)
    if let Some(hint) = char_hint {
        let h_low = hint.to_lowercase();
        let h_clean = h_low.replace('_', "");
        if !h_low.is_empty() && h_low != "general" {
            if remainder.starts_with(&h_low) {
                remainder = remainder.split_at(h_low.len()).1;
            } else if remainder.starts_with(&h_clean) {
                remainder = remainder.split_at(h_clean.len()).1;
            } else {
                for word in h_low.split(['_', ' ']) {
                    if word.len() >= 3 && remainder.starts_with(word) {
                        remainder = remainder.split_at(word.len()).1;
                        break;
                    }
                }
            }
        }
    }
    remainder = remainder.trim_matches(&['.', '_', '-', '/', '\\', ' '][..]);

    // 2. Strip known character names (prefixes)
    for name in &[
        "alexandrina_sebastiane", "alexandrina", "sebastiane", "rina", "jane_doe", "jane",
        "ellen_joe", "ellen", "anby_demara", "anby", "nicole_demara", "nicole",
        "zhu_yuan", "zhuyuan", "grace_howard", "grace", "ben_bigger", "ben",
        "koleda_belobog", "koleda", "billy_kid", "billy", "von_lycaon", "lycaon",
        "corin_wickes", "corin", "nekomata", "nekomiya_mana", "nekomiya",
        "soldier_11", "soldier11", "anton_ivanov", "anton", "soukaku",
        "qingyi", "seth_lowell", "seth", "caesar_king", "caesar", "burnice_white", "burnice",
        "lucy", "luciana", "hoshimi_miyabi", "miyabi", "asaba_harumasa", "harumasa",
        "tsukishiro_yanagi", "yanagi", "lighter", "yidhari_murphy", "yidhari",
        "ukinami_yuzuha", "yuzuha", "piper_wheel", "piper", "astra_yao", "astra",
        "evelyn_chevalier", "evelyn", "pulchra", "asakura", "aria_robot", "aria",
        "seed", "hugo", "vivian", "sunbather", "claret_flint", "claret", "flint",
    ] {
        let n_clean = name.replace('_', "");
        if remainder.starts_with(name) {
            remainder = remainder.split_at(name.len()).1;
            break;
        } else if remainder.starts_with(&n_clean) {
            remainder = remainder.split_at(n_clean.len()).1;
            break;
        }
    }
    remainder = remainder.trim_matches(&['.', '_', '-', '/', '\\', ' '][..]);

    // Keep stripping technical suffixes in a loop
    let mut changed = true;
    let mut total_stripped_len = 0;
    while changed {
        changed = false;
        let prev = remainder;

        for suffix in &[
            "vertexlimitraise", "vertexlimit", "limitraise", "limit", "raise", "position", "texcoord", "blend",
            "diffuse", "normalmap", "normal", "lightmap", "light", "materialmap", "material", "glowmap", "glow",
            "shadow", "fx", "ib", "vb", "drawindexed", "draw", "lod0", "lod1", "lod2", "lod3",
            "1024", "2048", "4096", "1k", "2k", "4k",
        ] {
            if remainder.ends_with(suffix) {
                remainder = remainder.split_at(remainder.len() - suffix.len()).0;
                total_stripped_len += suffix.len();
                changed = true;
            }
        }

        let old_len = remainder.len();
        remainder = remainder.trim_matches(&['.', '_', '-', '/', '\\', ' '][..]);
        total_stripped_len += old_len - remainder.len();

        if let Some(last_char) = remainder.chars().last() {
            let orig_idx = sec_clean.len().saturating_sub(total_stripped_len + 1);
            let was_uppercase = orig_idx < is_upper.len() && is_upper[orig_idx];
            let second_last = if remainder.len() > 1 { remainder.chars().nth(remainder.len() - 2) } else { None };
            let has_sep = matches!(second_last, Some('.' | '_' | '-' | '/' | '\\' | ' '));

            if last_char.is_ascii_digit()
                || (was_uppercase && matches!(last_char, 'a' | 'b' | 'c' | 'd'))
                || (has_sep && matches!(last_char, 'a' | 'b' | 'c' | 'd'))
            {
                remainder = remainder.split_at(remainder.len() - 1).0;
                total_stripped_len += 1;
                changed = true;
            }
        }

        let old_len = remainder.len();
        remainder = remainder.trim_matches(&['.', '_', '-', '/', '\\', ' '][..]);
        total_stripped_len += old_len - remainder.len();

        if remainder == prev {
            break;
        }
    }

    remainder.to_string()
}

pub fn standardize_group_name(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("face")
        || lower.contains("head")
        || lower.contains("eye")
        || lower.contains("makeup")
    {
        "Face".to_string()
    } else if lower.contains("hair") {
        "Hair".to_string()
    } else if lower.contains("tail") || lower.contains("tentacle") {
        "Tail".to_string()
    } else if lower.contains("weapon")
        || lower.contains("umbrella")
        || lower.contains("kama")
        || lower.contains("sword")
        || lower.contains("blade")
        || lower.contains("gun")
        || lower.contains("hammer")
        || lower.contains("shield")
        || lower.contains("cannon")
        || lower.contains("bow")
        || lower.contains("spear")
        || lower.contains("dagger")
        || lower.contains("whip")
    {
        "Weapon".to_string()
    } else if lower.contains("raccoon")
        || lower.contains("animal")
        || lower.contains("pet")
        || lower.contains("mascot")
        || lower.contains("drone")
        || lower.contains("robot")
        || lower.contains("doll")
        || lower.contains("plush")
    {
        "Extra".to_string()
    } else if lower.contains("bag")
        || lower.contains("strap")
        || lower.contains("pouch")
        || lower.contains("backpack")
        || lower.contains("purse")
        || lower.contains("glass")
        || lower.contains("accessory")
        || lower.contains("accessories")
        || lower.contains("gadget")
        || lower.contains("hat")
        || lower.contains("earring")
        || lower.contains("necklace")
        || lower.contains("belt")
        || lower.contains("cape")
        || lower.contains("wing")
        || lower.contains("mask")
        || lower.contains("collar")
        || lower.contains("tie")
        || lower.contains("ribbon")
    {
        "Accessories".to_string()
    } else if lower.contains("body") || lower.contains("skin") {
        "Body".to_string()
    } else if lower.contains("top") || lower.contains("chest") || lower.contains("torso") {
        "Top".to_string()
    } else if lower.contains("bottom") {
        "Bottom".to_string()
    } else if lower.contains("leg") || lower.contains("shoe") || lower.contains("boot") {
        "Legs".to_string()
    } else if lower.contains("arm") || lower.contains("glove") {
        "Arms".to_string()
    } else if lower.contains("dress")
        || lower.contains("outfit")
        || lower.contains("costume")
        || lower.contains("clothes")
        || lower.contains("clothing")
        || lower.contains("shirt")
        || lower.contains("suit")
        || lower.contains("jacket")
        || lower.contains("coat")
        || lower.contains("vest")
        || lower.contains("pant")
        || lower.contains("skirt")
        || lower.contains("shorts")
        || lower.contains("swimsuit")
        || lower.contains("bikini")
        || lower.contains("bra")
        || lower.contains("panties")
        || lower.contains("corset")
        || lower.contains("underwear")
        || lower.len() <= 2
        || lower == "base"
        || lower == "raise"
        || lower == "limit"
        || lower == "vertexlimit"
        || lower == "glow"
        || lower == "ib"
        || lower == "vb"
        || lower == "blend"
        || lower == "position"
        || lower == "texcoord"
    {
        "Outfit".to_string()
    } else {
        let mut chars = raw.chars();
        match chars.next() {
            None => "Outfit".to_string(),
            Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
        }
    }
}

pub fn determine_anchor_character(
    source_dir: &Path,
    full_ast: &IniAst,
    hash_alias_map: &HashMap<String, Vec<HashTarget>>,
) -> Option<(String, String)> {
    // 1. Check parent folder name
    if let Some(parent) = source_dir.parent() {
        let parent_name = parent.file_name().unwrap_or_default().to_string_lossy();
        let cat_clean = parent_name.split(" - ").next().unwrap_or(&parent_name).trim();
        for targets in hash_alias_map.values() {
            for t in targets {
                if !t.character_id.is_empty() {
                    let char_name = t.category_name.split(" - ").next().unwrap_or(&t.category_name).trim();
                    if char_name.eq_ignore_ascii_case(cat_clean) || t.character_id.eq_ignore_ascii_case(cat_clean) {
                        return Some((t.character_id.clone(), char_name.to_string()));
                    }
                }
            }
        }
    }

    // 2. Tally primary mesh hashes across full_ast (excluding generic shared hashes)
    let mut votes: HashMap<(String, String), usize> = HashMap::new();
    for sec in &full_ast.sections {
        for line in &sec.lines {
            if let Some((k, v)) = parse_kv_line(line) {
                if k == "hash" {
                    let clean = v
                        .strip_prefix("0x")
                        .or_else(|| v.strip_prefix("0X"))
                        .unwrap_or(&v)
                        .to_lowercase();
                    if clean.len() == 8
                        && clean.chars().all(|c| c.is_ascii_hexdigit())
                        && !crate::utils::GENERIC_SHARED_HASHES.contains(&clean.as_str())
                        && clean != "d9a12c0a"
                    {
                        if let Some(targets) = hash_alias_map.get(&clean) {
                            for t in targets {
                                if !t.character_id.is_empty() {
                                    let char_name = t
                                        .category_name
                                        .split(" - ")
                                        .next()
                                        .unwrap_or(&t.category_name)
                                        .trim()
                                        .to_string();
                                    *votes.entry((t.character_id.clone(), char_name)).or_insert(0) += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(((id, name), count)) = votes.into_iter().max_by_key(|(_, c)| *c) {
        if count >= 1 {
            return Some((id, name));
        }
    }

    None
}

pub fn extract_character_for_section(
    section: &IniSection,
    hash_alias_map: &HashMap<String, Vec<HashTarget>>,
    anchor: Option<&(String, String)>,
) -> (String, String) {
    let sec_name = section.name.trim_matches(&['[', ']'][..]).trim().to_lowercase();
    let clean = sec_name
        .strip_prefix("textureoverride")
        .or_else(|| sec_name.strip_prefix("shaderoverride"))
        .or_else(|| sec_name.strip_prefix("resource"))
        .unwrap_or(&sec_name);

    // 1. Explicit character in section name
    for targets in hash_alias_map.values() {
        for t in targets {
            if t.character_id.is_empty() {
                continue;
            }
            let char_name = t
                .category_name
                .split(" - ")
                .next()
                .unwrap_or(&t.category_name)
                .trim()
                .to_string();

            let id_clean = t.character_id.replace('_', "").to_lowercase();
            if clean.starts_with(&id_clean) {
                return (t.character_id.clone(), char_name);
            }

            for word in char_name.split_whitespace() {
                let w_clean = word.to_lowercase();
                if w_clean.len() >= 3 && clean.starts_with(&w_clean) {
                    return (t.character_id.clone(), char_name);
                }
            }
        }
    }

    // Common character name prefixes in section
    if clean.starts_with("rina") || clean.starts_with("alexandrina") {
        return ("alexandrina_sebastiane".to_string(), "Alexandrina Sebastiane".to_string());
    } else if clean.starts_with("jane") {
        return ("jane_doe".to_string(), "Jane Doe".to_string());
    } else if clean.starts_with("ellen") {
        return ("ellen_joe".to_string(), "Ellen Joe".to_string());
    } else if clean.starts_with("anby") {
        return ("anby_demara".to_string(), "Anby Demara".to_string());
    } else if clean.starts_with("nicole") {
        return ("nicole_demara".to_string(), "Nicole Demara".to_string());
    } else if clean.starts_with("billy") {
        return ("billy_kid".to_string(), "Billy Kid".to_string());
    } else if clean.starts_with("zhuyuan") || clean.starts_with("zhu_yuan") {
        return ("zhu_yuan".to_string(), "Zhu Yuan".to_string());
    } else if clean.starts_with("grace") {
        return ("grace_howard".to_string(), "Grace Howard".to_string());
    } else if clean.starts_with("seth") {
        return ("seth_lowell".to_string(), "Seth Lowell".to_string());
    } else if clean.starts_with("caesar") {
        return ("caesar_king".to_string(), "Caesar King".to_string());
    } else if clean.starts_with("burnice") {
        return ("burnice_white".to_string(), "Burnice White".to_string());
    } else if clean.starts_with("miyabi") || clean.starts_with("hoshimi") {
        return ("hoshimi_miyabi".to_string(), "Hoshimi Miyabi".to_string());
    } else if clean.starts_with("yanagi") || clean.starts_with("tsukishiro") {
        return ("tsukishiro_yanagi".to_string(), "Tsukishiro Yanagi".to_string());
    } else if clean.starts_with("harumasa") || clean.starts_with("asaba") {
        return ("asaba_harumasa".to_string(), "Asaba Harumasa".to_string());
    } else if clean.starts_with("lighter") {
        return ("lighter".to_string(), "Lighter".to_string());
    } else if clean.starts_with("yuzuha") || clean.starts_with("ukinami") {
        return ("ukinami_yuzuha".to_string(), "Ukinami Yuzuha".to_string());
    } else if clean.starts_with("piper") {
        return ("piper_wheel".to_string(), "Piper Wheel".to_string());
    } else if clean.starts_with("lucy") || clean.starts_with("luciana") {
        return ("lucy".to_string(), "Lucy".to_string());
    } else if clean.starts_with("claret") || clean.starts_with("flint") {
        return ("claret_flint".to_string(), "Claret Flint".to_string());
    }

    // 2. Check primary geometry hashes (ib, vb0)
    for line in &section.lines {
        if let Some((k, v)) = parse_kv_line(line) {
            let is_mesh_key = k == "ib" || k == "vb0" || (k == "hash" && section.lines.iter().any(|l| {
                let low = l.to_lowercase();
                low.contains("ib =") || low.contains("drawindexed")
            }));
            if is_mesh_key {
                let clean_hash = v.strip_prefix("0x").unwrap_or(&v).to_lowercase();
                if !crate::utils::GENERIC_SHARED_HASHES.contains(&clean_hash.as_str()) && clean_hash != "d9a12c0a" {
                    if let Some(targets) = hash_alias_map.get(&clean_hash) {
                        for t in targets {
                            if !t.character_id.is_empty() {
                                let char_name = t.category_name.split(" - ").next().unwrap_or(&t.category_name).to_string();
                                return (t.character_id.clone(), char_name);
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Fallback to anchor if available
    if let Some((anchor_id, anchor_name)) = anchor {
        return (anchor_id.clone(), anchor_name.clone());
    }

    // 4. Fallback to extract_character_group
    let fallback = extract_character_group(section);
    (fallback.to_lowercase(), fallback)
}

pub fn is_anatomical_keyword(word: &str) -> bool {
    let lower = word.to_lowercase();
    let keywords = [
        "hair", "head", "face", "makeup", "eye", "veil", "top", "bra", "chest", "breast",
        "corset", "front", "neck", "shirt", "dress", "skirt", "apron", "leg", "stocking",
        "tight", "thigh", "butt", "feet", "heel", "boot", "shoe", "sock", "glove", "sleeve",
        "arm", "nail", "hand", "belt", "decor", "thing", "wire", "tail", "wing", "bag",
        "strap", "body", "pelvis", "pant", "leotard", "swimsuit", "underwear",
    ];
    keywords.iter().any(|&k| lower.contains(k))
}

pub fn detect_internal_submeshes(full_ast: &IniAst) -> bool {
    let mut total_draws = 0;
    let mut has_submesh_comments = false;
    let mut has_toggle_vars = false;

    for sec in &full_ast.sections {
        if sec.name.to_lowercase().starts_with("textureoverride") {
            for line in &sec.lines {
                let trimmed = line.trim();
                let lower = trimmed.to_lowercase();
                if lower.starts_with("drawindexed") {
                    total_draws += 1;
                }
                if trimmed.starts_with(';') {
                    let comment = trimmed.trim_start_matches(';').trim();
                    if is_anatomical_keyword(comment) {
                        has_submesh_comments = true;
                    }
                }
                if lower.contains("$swapvar") || lower.contains("$toggle") || lower.contains("$outfit") {
                    has_toggle_vars = true;
                }
            }
        }
    }

    total_draws >= 2 && (has_submesh_comments || has_toggle_vars)
}

pub fn detect_monolithic_mesh(full_ast: &IniAst) -> bool {
    for sec in &full_ast.sections {
        if sec.name.to_lowercase().starts_with("textureoverride") {
            let mut has_skip = false;
            let mut draw_count = 0;
            for line in &sec.lines {
                let trimmed = line.trim();
                let lower = trimmed.to_lowercase();
                if let Some((k, v)) = parse_kv_line(trimmed) {
                    if k.eq_ignore_ascii_case("handling") && v.eq_ignore_ascii_case("skip") {
                        has_skip = true;
                    }
                }
                if lower.starts_with("drawindexed") || lower.starts_with("draw ") {
                    draw_count += 1;
                }
            }
            if has_skip && draw_count >= 2 {
                return true;
            }
        }
    }
    false
}

pub fn classify_submesh_draw(comments: &[String], conditions: &[String], sec_name: &str) -> String {
    let mut combined = String::new();
    for c in comments {
        combined.push(' ');
        combined.push_str(c);
    }
    for cond in conditions {
        combined.push(' ');
        combined.push_str(cond);
    }
    let lower = combined.to_lowercase();

    if lower.contains("hair")
        || lower.contains("hat")
        || lower.contains("earring")
        || lower.contains("ears")
        || lower.split(|c: char| !c.is_alphanumeric()).any(|w| w == "ear")
    {
        "Hair & Headwear".to_string()
    } else if lower.contains("face") || lower.contains("makeup") || lower.contains("eye") || lower.contains("veil") || lower.contains("glass") || lower.contains("mask") {
        "Face & Makeup".to_string()
    } else if lower.contains("bra") || lower.contains("chest") || lower.contains("breast") || lower.contains("corset") || lower.contains("front") || lower.contains("neck") || lower.contains("shirt") || lower.contains("top") {
        "Top & Torso".to_string()
    } else if lower.contains("dress") || lower.contains("skirt") || lower.contains("apron") {
        "Dress & Skirt".to_string()
    } else if lower.contains("leg") || lower.contains("stocking") || lower.contains("tight") || lower.contains("thigh") || lower.contains("butt") {
        "Legs & Stockings".to_string()
    } else if lower.contains("feet") || lower.contains("heel") || lower.contains("boot") || lower.contains("shoe") || lower.contains("sock") {
        "Feet & Shoes".to_string()
    } else if lower.contains("glove") || lower.contains("sleeve") || lower.contains("arm") || lower.contains("claw") || lower.contains("nail") || lower.contains("hand") {
        "Arms & Gloves".to_string()
    } else if lower.contains("belt") || lower.contains("decor") || lower.contains("thing") || lower.contains("wire") || lower.contains("tail") || lower.contains("wing") || lower.contains("bag") || lower.contains("strap") || lower.contains("weapon") {
        "Accessories & Extra".to_string()
    } else if lower.contains("pelvis") || lower.contains("pant") || lower.contains("leotard") || lower.contains("swimsuit") || lower.contains("underwear") || lower.contains("body") {
        "Body & Underwear".to_string()
    } else {
        standardize_group_name(&extract_semantic_stem(sec_name))
    }
}

#[derive(Debug, Clone)]
pub struct SubmeshDrawItem {
    pub parent_sec_name: String,
    pub block_lines: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct SubmeshPartGroup {
    pub category: String,
    pub target_folder_name: String,
    pub draw_items: Vec<SubmeshDrawItem>,
    pub associated_sections: Vec<IniSection>,
    pub group_resources: Vec<IniSection>,
    pub asset_files: Vec<String>,
}

pub fn map_to_submesh_category(cat: &str) -> String {
    if cat == "Hair & Headwear"
        || cat == "Face & Makeup"
        || cat == "Top & Torso"
        || cat == "Dress & Skirt"
        || cat == "Legs & Stockings"
        || cat == "Feet & Shoes"
        || cat == "Arms & Gloves"
        || cat == "Accessories & Extra"
        || cat == "Body & Underwear"
    {
        return cat.to_string();
    }

    let lower = cat.to_lowercase();
    if lower.contains("hair")
        || lower.contains("hat")
        || lower.contains("earring")
        || lower.contains("ears")
        || lower.split(|c: char| !c.is_alphanumeric()).any(|w| w == "ear")
    {
        "Hair & Headwear".to_string()
    } else if lower.contains("face") || lower.contains("makeup") || lower.contains("head") || lower.contains("eye") || lower.contains("veil") || lower.contains("glass") || lower.contains("mask") {
        "Face & Makeup".to_string()
    } else if lower.contains("top") || lower.contains("bra") || lower.contains("chest") || lower.contains("breast") || lower.contains("corset") || lower.contains("front") || lower.contains("neck") || lower.contains("shirt") {
        "Top & Torso".to_string()
    } else if lower.contains("dress") || lower.contains("skirt") || lower.contains("apron") {
        "Dress & Skirt".to_string()
    } else if lower.contains("leg") || lower.contains("stocking") || lower.contains("tight") || lower.contains("thigh") || lower.contains("butt") {
        "Legs & Stockings".to_string()
    } else if lower.contains("feet") || lower.contains("shoe") || lower.contains("boot") || lower.contains("heel") || lower.contains("sock") || lower.contains("foot") {
        "Feet & Shoes".to_string()
    } else if lower.contains("arm") || lower.contains("glove") || lower.contains("sleeve") || lower.contains("claw") || lower.contains("hand") {
        "Arms & Gloves".to_string()
    } else if lower.contains("accessory") || lower.contains("accessories") || lower.contains("extra") || lower.contains("weapon") || lower.contains("tail") || lower.contains("belt") || lower.contains("decor") || lower.contains("wire") || lower.contains("thing") || lower.contains("wing") || lower.contains("bag") || lower.contains("strap") {
        "Accessories & Extra".to_string()
    } else if lower.contains("body") || lower.contains("skin") || lower.contains("underwear") || lower.contains("pant") || lower.contains("pelvis") || lower.contains("leotard") || lower.contains("swimsuit") {
        "Body & Underwear".to_string()
    } else {
        "Accessories & Extra".to_string()
    }
}

pub fn extract_section_header_lines(sec: &IniSection) -> Vec<String> {
    let mut header_lines = Vec::new();
    for line in &sec.lines {
        let trimmed = line.trim();
        let low = trimmed.to_lowercase();
        // Stop if we hit conditionals or draw calls
        if low.starts_with("drawindexed")
            || low.starts_with("draw ")
            || low.starts_with("if ")
            || low.starts_with("else")
            || low.starts_with("endif")
        {
            break;
        }
        if trimmed.starts_with(';') {
            let c = trimmed.trim_start_matches(';').trim();
            // If comment describes a submesh draw or contains an anatomical keyword, it begins the draw block
            if is_anatomical_keyword(c) || c.to_lowercase().contains("submesh") || c.to_lowercase().contains("draw") {
                break;
            }
            header_lines.push(line.clone());
            continue;
        }
        if let Some((k, _)) = parse_kv_line(trimmed) {
            if matches!(
                k.as_str(),
                "hash"
                    | "match_first_index"
                    | "filter_index"
                    | "handling"
                    | "override_vertex_count"
                    | "override_byte_stride"
                    | "model"
                    | "index"
                    | "ib"
                    | "vb0"
                    | "vb1"
                    | "vb2"
                    | "run"
                    | "this"
            ) || k.starts_with("vb")
                || k.starts_with("ps-t")
                || k.starts_with("vs-t")
                || k.starts_with("cs-t")
                || k.starts_with("resource")
            {
                header_lines.push(line.clone());
            }
        }
    }

    // Safety fallback: guarantee 'hash' and any 'vb0' in the section are present
    let has_hash = header_lines.iter().any(|l| parse_kv_line(l).is_some_and(|(k, _)| k == "hash"));
    if !has_hash {
        for line in &sec.lines {
            if let Some((k, _)) = parse_kv_line(line) {
                if k == "hash" {
                    header_lines.insert(0, line.clone());
                    break;
                }
            }
        }
    }

    header_lines
}

fn extract_submesh_draw_items(sec: &IniSection) -> Vec<(String, SubmeshDrawItem)> {
    let mut items = Vec::new();
    let mut in_draw_section = false;
    let mut current_block: Vec<String> = Vec::new();
    let mut current_comments: Vec<String> = Vec::new();
    let mut current_conditions: Vec<String> = Vec::new();
    let mut if_depth: usize = 0;
    let mut saw_draw = false;

    for line in &sec.lines {
        let trimmed = line.trim();
        let low = trimmed.to_lowercase();
        let is_draw = low.starts_with("drawindexed") || low.starts_with("draw ");
        let is_if = low.starts_with("if ");
        let is_endif = low.starts_with("endif");
        let is_comment = trimmed.starts_with(';');

        if !in_draw_section {
            if is_draw || is_if {
                in_draw_section = true;
            } else if is_comment {
                let c = trimmed.trim_start_matches(';').trim();
                if is_anatomical_keyword(c) || c.to_lowercase().contains("submesh") || c.to_lowercase().contains("draw") {
                    in_draw_section = true;
                }
            }
            if !in_draw_section {
                continue;
            }
        }

        current_block.push(line.clone());

        if is_comment {
            let c = trimmed.trim_start_matches(';').trim().to_string();
            if !c.is_empty() {
                current_comments.push(c);
                if current_comments.len() > 4 {
                    current_comments.remove(0);
                }
            }
        } else if is_if {
            if_depth += 1;
            current_conditions.push(trimmed[3..].trim().to_string());
        } else if is_endif {
            if_depth = if_depth.saturating_sub(1);
            if !current_conditions.is_empty() {
                current_conditions.pop();
            }
        }

        if is_draw {
            saw_draw = true;
        }

        // Draw block completes when a draw call has occurred and any enclosing conditionals are closed
        if saw_draw && if_depth == 0 {
            let raw_cat = classify_submesh_draw(&current_comments, &current_conditions, &sec.name);
            let cat = map_to_submesh_category(&raw_cat);
            items.push((cat, SubmeshDrawItem {
                parent_sec_name: sec.name.clone(),
                block_lines: current_block.clone(),
            }));
            current_block.clear();
            current_comments.clear();
            current_conditions.clear();
            saw_draw = false;
        }
    }

    if saw_draw && !current_block.is_empty() {
        let raw_cat = classify_submesh_draw(&current_comments, &current_conditions, &sec.name);
        let cat = map_to_submesh_category(&raw_cat);
        items.push((cat, SubmeshDrawItem {
            parent_sec_name: sec.name.clone(),
            block_lines: current_block,
        }));
    }

    items
}

pub fn build_submesh_groups(
    full_ast: &IniAst,
    texture_overrides: &[IniSection],
    clean_mod_name: &str,
) -> Vec<SubmeshPartGroup> {
    let mut category_draws: HashMap<String, Vec<SubmeshDrawItem>> = HashMap::new();
    let mut category_associated_sections: HashMap<String, Vec<IniSection>> = HashMap::new();

    for sec in texture_overrides {
        let has_draws = sec.lines.iter().any(|l| {
            let low = l.trim().to_lowercase();
            low.starts_with("drawindexed") || low.starts_with("draw ")
        });
        if !has_draws {
            // It's a texture/material map or vertex limit override
            let stem = extract_semantic_stem(&sec.name);
            let cat = map_to_submesh_category(&standardize_group_name(&stem));
            category_associated_sections.entry(cat).or_default().push(sec.clone());
            continue;
        }

        let items = extract_submesh_draw_items(sec);
        for (cat, draw_item) in items {
            category_draws.entry(cat).or_default().push(draw_item);
        }
    }

    let mut all_cats: HashSet<String> = HashSet::new();
    for c in category_draws.keys() {
        all_cats.insert(c.clone());
    }
    for c in category_associated_sections.keys() {
        all_cats.insert(c.clone());
    }

    let mut result = Vec::new();

    for cat in all_cats {
        let draw_items = category_draws.remove(&cat).unwrap_or_default();
        let associated = category_associated_sections.remove(&cat).unwrap_or_default();

        if draw_items.is_empty() && associated.is_empty() {
            continue;
        }

        let safe_name = sanitize_path_component(&cat);
        let target_folder_name = format!("{} - {}", clean_mod_name, safe_name);

        // Collect referenced resources & assets
        let mut group_sections = Vec::new();
        let mut parent_secs_used = HashSet::new();
        for item in &draw_items {
            if parent_secs_used.insert(item.parent_sec_name.to_lowercase()) {
                if let Some(orig_sec) = texture_overrides.iter().find(|s| s.name.eq_ignore_ascii_case(&item.parent_sec_name)) {
                    let synth_lines = extract_section_header_lines(orig_sec);
                    group_sections.push(IniSection {
                        name: orig_sec.name.clone(),
                        lines: synth_lines,
                    });
                }
            }
        }
        for item in &draw_items {
            group_sections.push(IniSection {
                name: format!("Draw_{}", item.parent_sec_name),
                lines: item.block_lines.clone(),
            });
        }
        group_sections.extend(associated.clone());

        let (group_resources, asset_files) = collect_group_dependencies(full_ast, &group_sections);

        result.push(SubmeshPartGroup {
            category: cat,
            target_folder_name,
            draw_items,
            associated_sections: associated,
            group_resources,
            asset_files,
        });
    }

    result.sort_by(|a, b| a.category.cmp(&b.category));
    result
}

fn group_overrides(
    texture_overrides: &[IniSection],
    mode: &str,
    hash_alias_map: &HashMap<String, Vec<HashTarget>>,
    anchor: Option<&(String, String)>,
) -> HashMap<String, Vec<IniSection>> {
    let mut groups: HashMap<String, Vec<IniSection>> = HashMap::new();

    if mode.eq_ignore_ascii_case("character") {
        for ov in texture_overrides {
            let (_, char_display_name) = extract_character_for_section(ov, hash_alias_map, anchor);
            groups.entry(char_display_name).or_default().push(ov.clone());
        }
        return groups;
    }

    if mode.eq_ignore_ascii_case("break") || mode.eq_ignore_ascii_case("shards") {
        for ov in texture_overrides {
            let group_key = extract_component_name(&ov.name);
            groups.entry(group_key).or_default().push(ov.clone());
        }
        return groups;
    }

    // Default 'component' mode: Graph Clustering via Union-Find
    let size = texture_overrides.len();
    let mut uf = UnionFind::new(size);

    let mut char_info: Vec<(String, String)> = texture_overrides
        .iter()
        .map(|sec| extract_character_for_section(sec, hash_alias_map, anchor))
        .collect();

    // Identify dominant character if almost all known sections belong to one character
    let mut char_counts: HashMap<String, (String, usize)> = HashMap::new();
    for (id, display) in &char_info {
        if !id.is_empty() && id != "general" {
            let entry = char_counts.entry(id.clone()).or_insert_with(|| (display.clone(), 0));
            entry.1 += 1;
        }
    }

    if let Some((dominant_id, (dominant_display, count))) = char_counts.iter().max_by_key(|(_, (_, c))| *c) {
        if *count >= (size / 3).max(1) && char_counts.len() <= 2 {
            for (id, display) in char_info.iter_mut() {
                let dom_clean = dominant_id.replace('_', "").to_lowercase();
                let id_clean = id.replace('_', "").to_lowercase();
                if id_clean.starts_with(&dom_clean) || dom_clean.starts_with(&id_clean) || id == "general" {
                    *id = dominant_id.clone();
                    *display = dominant_display.clone();
                }
            }
        }
    }

    let stems: Vec<String> = texture_overrides
        .iter()
        .enumerate()
        .map(|(i, sec)| extract_semantic_stem_with_char(&sec.name, Some(&char_info[i].0)))
        .collect();

    let hashes: Vec<Option<String>> = texture_overrides
        .iter()
        .map(|sec| {
            for line in &sec.lines {
                if let Some((k, v)) = parse_kv_line(line) {
                    if k == "hash" {
                        return Some(
                            v.strip_prefix("0x")
                                .or_else(|| v.strip_prefix("0X"))
                                .unwrap_or(&v)
                                .to_lowercase(),
                        );
                    }
                }
            }
            None
        })
        .collect();

    let referenced_resources: Vec<HashSet<String>> = texture_overrides
        .iter()
        .map(|sec| {
            let mut refs = HashSet::new();
            for line in &sec.lines {
                if let Some((k, v)) = parse_kv_line(line) {
                    let is_geom_key = k.starts_with("vb") || k.starts_with("ib") || k == "position" || k == "blend" || k == "texcoord";
                    if is_geom_key && !v.is_empty() {
                        let clean_v = clean_resource_ref(&v);
                        let clean = clean_v.to_lowercase();
                        if !clean.is_empty()
                            && !clean.starts_with("commandlist")
                            && !clean.contains("settextures")
                            && !clean.contains("creditinfo")
                            && !clean.contains("customshader")
                        {
                            refs.insert(clean);
                        }
                    }
                }
            }
            refs
        })
        .collect();

    let db_components: Vec<Option<String>> = hashes
        .iter()
        .map(|h_opt| {
            if let Some(ref h) = h_opt {
                if let Some(targets) = hash_alias_map.get(h) {
                    for t in targets {
                        if let Some(ref comp) = t.component_name {
                            if !comp.is_empty() {
                                return Some(comp.clone());
                            }
                        }
                    }
                }
            }
            None
        })
        .collect();

    for i in 0..size {
        for j in (i + 1)..size {
            // Overrides for different characters can never be in the same component cluster
            if char_info[i].0 != char_info[j].0 {
                continue;
            }

            let mut should_union = false;

            if !stems[i].is_empty() && stems[i] == stems[j] {
                should_union = true;
            }

            if !should_union {
                if let (Some(ref h_i), Some(ref h_j)) = (&hashes[i], &hashes[j]) {
                    if h_i == h_j && !crate::utils::is_generic_shared_hash(h_i, hash_alias_map) {
                        should_union = true;
                    }
                }
            }

            if !should_union
                && !referenced_resources[i].is_disjoint(&referenced_resources[j]) {
                    should_union = true;
                }

            if !should_union {
                if let (Some(ref db_i), Some(ref db_j)) = (&db_components[i], &db_components[j]) {
                    if db_i == db_j {
                        should_union = true;
                    }
                }
            }

            if should_union {
                uf.union(i, j);
            }
        }
    }

    let mut component_groups: HashMap<usize, Vec<IniSection>> = HashMap::new();
    for (i, sec) in texture_overrides.iter().enumerate().take(size) {
        let root = uf.find(i);
        component_groups.entry(root).or_default().push(sec.clone());
    }

    // Count how many distinct characters exist in this mod
    let mut all_unique_chars: HashSet<&str> = HashSet::new();
    for info in &char_info {
        all_unique_chars.insert(&info.0);
    }
    let has_multiple_characters = all_unique_chars.len() > 1;

    for (root, secs) in component_groups {
        let root_indices: Vec<usize> = (0..size).filter(|&idx| uf.find(idx) == root).collect();

        let char_display = &char_info[root_indices[0]].1;

        let mut db_name = None;
        for &idx in &root_indices {
            if let Some(ref db_comp) = db_components[idx] {
                db_name = Some(db_comp.clone());
                break;
            }
        }

        let mut stem_name = None;
        if db_name.is_none() {
            let mut stem_freq = HashMap::new();
            for &idx in &root_indices {
                if !stems[idx].is_empty() {
                    *stem_freq.entry(&stems[idx]).or_insert(0) += 1;
                }
            }
            if let Some((&most_common, _)) = stem_freq.iter().max_by_key(|&(_, count)| count) {
                stem_name = Some(most_common.clone());
            }
        }

        let raw_name = db_name
            .or(stem_name)
            .unwrap_or_else(|| "Outfit".to_string());

        let standardized = standardize_group_name(&raw_name);
        let group_key = if has_multiple_characters {
            format!("{} - {}", char_display, standardized)
        } else {
            standardized
        };

        groups.entry(group_key).or_default().extend(secs);
    }

    groups
}

fn collect_group_dependencies(
    full_ast: &IniAst,
    group_overrides: &[IniSection],
) -> (Vec<IniSection>, Vec<String>) {
    let mut group_resources = Vec::new();
    let mut group_asset_files = Vec::new();
    let mut visited_res = HashSet::new();

    for ov in group_overrides {
        let (res_secs, assets) = extract_section_dependencies(full_ast, ov);
        for r in res_secs {
            if visited_res.insert(r.name.to_lowercase()) {
                group_resources.push(r);
            }
        }
        for a in assets {
            if !group_asset_files.contains(&a) {
                group_asset_files.push(a);
            }
        }
    }

    (group_resources, group_asset_files)
}

pub fn preview_split_mod_impl(
    db_path: &Path,
    mod_path: String,
    mode: String,
) -> Result<Vec<SplitGroupPreview>, AppError> {
    let source_dir = Path::new(&mod_path);
    if !source_dir.exists() || !source_dir.is_dir() {
        return Err(AppError::Custom(format!(
            "Mod path does not exist or is not a directory: {}",
            mod_path
        )));
    }

    let original_folder_name = source_dir
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let clean_mod_name = original_folder_name
        .strip_prefix("DISABLED ")
        .unwrap_or(&original_folder_name)
        .to_string();

    let full_ast = parse_all_inis_in_dir(source_dir)?;
    let (_global_sections, texture_overrides, shared_utilities) = partition_sections(&full_ast);
    let (shared_utility_resources, shared_utility_assets) =
        collect_group_dependencies(&full_ast, &shared_utilities);

    if texture_overrides.is_empty() {
        return Err(AppError::Custom(
            "No TextureOverride sections found to split".into(),
        ));
    }

    let hash_alias_map = crate::utils::build_hash_alias_map(db_path);
    let anchor = determine_anchor_character(source_dir, &full_ast, &hash_alias_map);
    let is_monolithic = detect_monolithic_mesh(&full_ast);
    let monolithic_warning = if is_monolithic {
        Some("This mod uses a monolithic mesh with 'handling = skip'. Splitting internal submesh components will cause missing body parts and invisible limbs because individual pieces cannot render without the unified body mesh.".to_string())
    } else {
        None
    };

    let is_bodypart_mode = mode.eq_ignore_ascii_case("bodypart")
        || mode.eq_ignore_ascii_case("body_part")
        || mode.eq_ignore_ascii_case("macro");

    let is_submesh_mode = mode.eq_ignore_ascii_case("submesh")
        || mode.eq_ignore_ascii_case("accessory")
        || mode.eq_ignore_ascii_case("toggles")
        || mode.eq_ignore_ascii_case("break")
        || mode.eq_ignore_ascii_case("shards");

    // 1. If mode is submesh/accessory (or legacy component fallback) and mod has internal submeshes, perform Submesh Decompilation
    // Note: bodypart mode NEVER runs submesh decompilation - it guarantees complete macro body parts!
    if !is_bodypart_mode
        && (is_submesh_mode || mode.eq_ignore_ascii_case("component"))
        && detect_internal_submeshes(&full_ast)
    {
        let submesh_groups = build_submesh_groups(&full_ast, &texture_overrides, &clean_mod_name);
        if !submesh_groups.is_empty() {
            let all_group_names: Vec<String> = submesh_groups.iter().map(|g| g.category.clone()).collect();
            let mut previews: Vec<SplitGroupPreview> = submesh_groups
                .into_iter()
                .map(|g| {
                    let mut assets = g.asset_files;
                    for a in &shared_utility_assets {
                        if should_include_utility_for_group(a, &g.category, &all_group_names) && !assets.contains(a) {
                            assets.push(a.clone());
                        }
                    }
                    SplitGroupPreview {
                        group_name: g.category,
                        target_folder_name: g.target_folder_name,
                        override_count: g.draw_items.len() + g.associated_sections.len(),
                        resource_count: g.group_resources.len(),
                        asset_files: assets,
                        is_monolithic: if is_monolithic { Some(true) } else { None },
                        warning: monolithic_warning.clone(),
                    }
                })
                .collect();
            previews.sort_by(|a, b| a.group_name.cmp(&b.group_name));
            return Ok(previews);
        }
    }

    // 2. Otherwise, use macro section-level clustering
    let groups = group_overrides(&texture_overrides, &mode, &hash_alias_map, anchor.as_ref());
    let all_group_names: Vec<String> = groups.keys().cloned().collect();
    let mut previews = Vec::new();

    for (group_name, group_ovs) in groups {
        let (mut group_resources, mut group_asset_files) =
            collect_group_dependencies(&full_ast, &group_ovs);

        for res in &shared_utility_resources {
            if should_include_utility_for_group(&res.name, &group_name, &all_group_names)
                && !group_resources.iter().any(|s| s.name.eq_ignore_ascii_case(&res.name))
            {
                group_resources.push(res.clone());
            }
        }
        for asset in &shared_utility_assets {
            if should_include_utility_for_group(asset, &group_name, &all_group_names)
                && !group_asset_files.contains(asset)
            {
                group_asset_files.push(asset.clone());
            }
        }

        let safe_group_name = sanitize_path_component(&group_name);
        let target_folder_name = format!("{} - {}", clean_mod_name, safe_group_name);

        previews.push(SplitGroupPreview {
            group_name,
            target_folder_name,
            override_count: group_ovs.len(),
            resource_count: group_resources.len(),
            asset_files: group_asset_files,
            is_monolithic: if is_monolithic && !is_bodypart_mode { Some(true) } else { None },
            warning: if is_monolithic && !is_bodypart_mode { monolithic_warning.clone() } else { None },
        });
    }

    previews.sort_by(|a, b| a.group_name.cmp(&b.group_name));

    Ok(previews)
}

/// Previews what folders, files, and overrides will be generated for a split mod.
#[tauri::command]
pub fn preview_split_mod(
    app: AppHandle,
    mod_path: String,
    mode: String,
) -> Result<Vec<SplitGroupPreview>, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let app_dir = app.path().app_data_dir().unwrap_or_default();
    let db_path = app_dir.join("playable_characters.json");
    preview_split_mod_impl(&db_path, mod_path, mode)
}

pub fn split_mod_impl(
    db_path: &Path,
    mod_path: String,
    mode: String,
    selected_targets: Option<Vec<String>>,
) -> Result<Vec<String>, AppError> {
    let source_dir = Path::new(&mod_path);
    if !source_dir.exists() || !source_dir.is_dir() {
        return Err(AppError::Custom(format!(
            "Mod path does not exist or is not a directory: {}",
            mod_path
        )));
    }

    let parent_dir = source_dir.parent().unwrap_or(source_dir);
    let original_folder_name = source_dir
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let clean_mod_name = original_folder_name
        .strip_prefix("DISABLED ")
        .unwrap_or(&original_folder_name)
        .to_string();

    let full_ast = parse_all_inis_in_dir(source_dir)?;
    let (global_sections, texture_overrides, shared_utilities) = partition_sections(&full_ast);

    if texture_overrides.is_empty() {
        return Err(AppError::Custom(
            "No TextureOverride sections found to split".into(),
        ));
    }

    let hash_alias_map = crate::utils::build_hash_alias_map(db_path);
    let anchor = determine_anchor_character(source_dir, &full_ast, &hash_alias_map);
    let (shared_utility_resources, shared_utility_assets) =
        collect_group_dependencies(&full_ast, &shared_utilities);
    let mut created_mod_paths = Vec::new();

    let is_bodypart_mode = mode.eq_ignore_ascii_case("bodypart")
        || mode.eq_ignore_ascii_case("body_part")
        || mode.eq_ignore_ascii_case("macro");

    let is_submesh_mode = mode.eq_ignore_ascii_case("submesh")
        || mode.eq_ignore_ascii_case("accessory")
        || mode.eq_ignore_ascii_case("toggles")
        || mode.eq_ignore_ascii_case("break")
        || mode.eq_ignore_ascii_case("shards");

    // 1. Submesh Decompilation mode (bypassed if bodypart mode is selected)
    if !is_bodypart_mode
        && (is_submesh_mode || mode.eq_ignore_ascii_case("component"))
        && detect_internal_submeshes(&full_ast)
    {
        let submesh_groups = build_submesh_groups(&full_ast, &texture_overrides, &clean_mod_name);
        if !submesh_groups.is_empty() {
            for group in &submesh_groups {
                // Filter by selected_targets if provided
                if let Some(ref targets) = selected_targets {
                    if !targets.is_empty()
                        && !targets.iter().any(|t| {
                            t.eq_ignore_ascii_case(&group.category)
                                || t.eq_ignore_ascii_case(&group.target_folder_name)
                        })
                    {
                        continue;
                    }
                }

                let target_dir = parent_dir.join(&group.target_folder_name);
                if !target_dir.exists() {
                    fs::create_dir_all(&target_dir)?;
                }

                let all_group_names: Vec<String> = submesh_groups.iter().map(|g| g.category.clone()).collect();

                // Copy asset files
                for asset in &group.asset_files {
                    copy_asset_file(source_dir, &target_dir, asset)?;
                }
                for asset in &shared_utility_assets {
                    if should_include_utility_for_group(asset, &group.category, &all_group_names) {
                        copy_asset_file(source_dir, &target_dir, asset)?;
                    }
                }

                // Copy preview image
                for preview_name in &["preview.png", "preview.jpg", "preview.webp", "Preview.png"] {
                    let src_prev = source_dir.join(preview_name);
                    if src_prev.exists() {
                        let _ = fs::copy(&src_prev, target_dir.join(preview_name));
                    }
                }

                // Generate selective mod.ini
                let mut split_sections = Vec::new();
                split_sections.extend(global_sections.clone());

                // Rebuild selective TextureOverride sections
                for sec in &texture_overrides {
                    let draws_for_cat: Vec<&SubmeshDrawItem> = group
                        .draw_items
                        .iter()
                        .filter(|d| d.parent_sec_name.eq_ignore_ascii_case(&sec.name))
                        .collect();
                    if !draws_for_cat.is_empty() {
                        let mut sec_lines = extract_section_header_lines(sec);
                        for draw in draws_for_cat {
                            sec_lines.extend(draw.block_lines.clone());
                        }
                        split_sections.push(IniSection {
                            name: sec.name.clone(),
                            lines: sec_lines,
                        });
                    }
                }

                // Add associated sections (texture maps, material maps, limits)
                for ov in &group.associated_sections {
                    if !split_sections.iter().any(|s| s.name.eq_ignore_ascii_case(&ov.name)) {
                        split_sections.push(ov.clone());
                    }
                }

                // Add referenced resources
                for res in &group.group_resources {
                    if !split_sections.iter().any(|s| s.name.eq_ignore_ascii_case(&res.name)) {
                        split_sections.push(res.clone());
                    }
                }

                // Add shared utilities and their referenced resources
                for util in &shared_utilities {
                    if util.name.eq_ignore_ascii_case("Present") {
                        let mut filtered_util = util.clone();
                        filtered_util.lines.retain(|line| should_include_utility_for_group(line, &group.category, &all_group_names));
                        if !split_sections.iter().any(|s| s.name.eq_ignore_ascii_case(&filtered_util.name)) {
                            split_sections.push(filtered_util);
                        }
                    } else if should_include_utility_for_group(&util.name, &group.category, &all_group_names)
                        && !split_sections.iter().any(|s| s.name.eq_ignore_ascii_case(&util.name)) {
                            split_sections.push(util.clone());
                        }
                }
                for res in &shared_utility_resources {
                    if should_include_utility_for_group(&res.name, &group.category, &all_group_names)
                        && !split_sections.iter().any(|s| s.name.eq_ignore_ascii_case(&res.name)) {
                            split_sections.push(res.clone());
                        }
                }

                let split_ast = IniAst {
                    header_lines: full_ast.header_lines.clone(),
                    sections: split_sections
                        .into_iter()
                        .map(|mut sec| {
                            sec.lines = sec
                                .lines
                                .into_iter()
                                .map(|l| sanitize_ini_path_line(&l))
                                .collect();
                            sec
                        })
                        .collect(),
                };

                let target_ini_path = target_dir.join("mod.ini");
                fs::write(&target_ini_path, split_ast.to_string())?;

                created_mod_paths.push(target_dir.to_string_lossy().to_string());
            }

            if !created_mod_paths.is_empty() {
                let part_names = created_mod_paths
                    .iter()
                    .map(|p| Path::new(p).file_name().unwrap_or_default().to_string_lossy().to_string())
                    .collect::<Vec<_>>()
                    .join(", ");
                crate::infra::logger::log_alteration(
                    "mod_split",
                    &clean_mod_name,
                    &mod_path,
                    &format!("Split into {} submesh parts ({})", created_mod_paths.len(), part_names),
                    None,
                    true,
                );

                if !original_folder_name.starts_with("DISABLED ") {
                    let disabled_folder_name = format!("DISABLED {}", original_folder_name);
                    let disabled_path = parent_dir.join(&disabled_folder_name);
                    if !disabled_path.exists() {
                        let _ = crate::utils::safe_rename(source_dir, &disabled_path);
                    }
                }
            }

            return Ok(created_mod_paths);
        }
    }

    // 2. Macro section-level splitting
    let groups = group_overrides(&texture_overrides, &mode, &hash_alias_map, anchor.as_ref());
    let all_group_names: Vec<String> = groups.keys().cloned().collect();

    for (group_name, group_ovs) in groups {
        if let Some(ref targets) = selected_targets {
            let safe_check = sanitize_path_component(&group_name);
            let target_check = format!("{} - {}", clean_mod_name, safe_check);
            if !targets.is_empty()
                && !targets.iter().any(|t| {
                    t.eq_ignore_ascii_case(&group_name) || t.eq_ignore_ascii_case(&target_check)
                })
            {
                continue;
            }
        }

        let (group_resources, group_asset_files) =
            collect_group_dependencies(&full_ast, &group_ovs);

        let safe_group_name = sanitize_path_component(&group_name);
        let target_folder_name = format!("{} - {}", clean_mod_name, safe_group_name);
        let target_dir = parent_dir.join(&target_folder_name);

        if !target_dir.exists() {
            fs::create_dir_all(&target_dir)?;
        }

        // Copy asset files
        for asset in &group_asset_files {
            copy_asset_file(source_dir, &target_dir, asset)?;
        }
        for asset in &shared_utility_assets {
            if should_include_utility_for_group(asset, &group_name, &all_group_names) {
                copy_asset_file(source_dir, &target_dir, asset)?;
            }
        }

        // Copy optional preview image if present in source_dir
        for preview_name in &["preview.png", "preview.jpg", "preview.webp", "Preview.png"] {
            let src_prev = source_dir.join(preview_name);
            if src_prev.exists() {
                let _ = fs::copy(&src_prev, target_dir.join(preview_name));
            }
        }

        // Generate mod.ini
        let mut split_sections = Vec::new();
        split_sections.extend(global_sections.clone());
        for ov in group_ovs {
            if !split_sections.iter().any(|s| s.name.eq_ignore_ascii_case(&ov.name)) {
                split_sections.push(ov);
            }
        }
        for res in group_resources {
            if !split_sections.iter().any(|s| s.name.eq_ignore_ascii_case(&res.name)) {
                split_sections.push(res);
            }
        }
        for util in &shared_utilities {
            if util.name.eq_ignore_ascii_case("Present") {
                let mut filtered_util = util.clone();
                filtered_util.lines.retain(|line| should_include_utility_for_group(line, &group_name, &all_group_names));
                if !split_sections.iter().any(|s| s.name.eq_ignore_ascii_case(&filtered_util.name)) {
                    split_sections.push(filtered_util);
                }
            } else if should_include_utility_for_group(&util.name, &group_name, &all_group_names)
                && !split_sections.iter().any(|s| s.name.eq_ignore_ascii_case(&util.name)) {
                    split_sections.push(util.clone());
                }
        }
        for res in &shared_utility_resources {
            if should_include_utility_for_group(&res.name, &group_name, &all_group_names)
                && !split_sections.iter().any(|s| s.name.eq_ignore_ascii_case(&res.name)) {
                    split_sections.push(res.clone());
                }
        }

        let split_ast = IniAst {
            header_lines: full_ast.header_lines.clone(),
            sections: split_sections
                .into_iter()
                .map(|mut sec| {
                    sec.lines = sec
                        .lines
                        .into_iter()
                        .map(|l| sanitize_ini_path_line(&l))
                        .collect();
                    sec
                })
                .collect(),
        };

        let target_ini_path = target_dir.join("mod.ini");
        fs::write(&target_ini_path, split_ast.to_string())?;

        created_mod_paths.push(target_dir.to_string_lossy().to_string());
    }

    if !created_mod_paths.is_empty() {
        let part_names = created_mod_paths
            .iter()
            .map(|p| Path::new(p).file_name().unwrap_or_default().to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(", ");
        crate::infra::logger::log_alteration(
            "mod_split",
            &clean_mod_name,
            &mod_path,
            &format!("Split into {} {} parts ({})", created_mod_paths.len(), mode, part_names),
            None,
            true,
        );

        if !original_folder_name.starts_with("DISABLED ") {
            let disabled_folder_name = format!("DISABLED {}", original_folder_name);
            let disabled_path = parent_dir.join(&disabled_folder_name);
            if !disabled_path.exists() {
                let _ = crate::utils::safe_rename(source_dir, &disabled_path);
            }
        }
    }

    Ok(created_mod_paths)
}

/// Split a monolithic mod directory into separate isolated mod directories.
#[tauri::command]
pub fn split_mod(
    app: AppHandle,
    mod_path: String,
    mode: String,
    selected_targets: Option<Vec<String>>,
) -> Result<Vec<String>, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let app_dir = app.path().app_data_dir().unwrap_or_default();
    let db_path = app_dir.join("playable_characters.json");
    match split_mod_impl(&db_path, mod_path.clone(), mode, selected_targets) {
        Ok(res) => Ok(res),
        Err(e) => {
            crate::infra::logger::log_error("mod_splitter", &e.to_string(), Some(&mod_path));
            Err(e)
        }
    }
}

fn find_file_recursive(dir: &Path, target_filename: &str) -> Option<std::path::PathBuf> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name() {
                    if name.to_string_lossy().eq_ignore_ascii_case(target_filename) {
                        return Some(path);
                    }
                }
            } else if path.is_dir() {
                let dirname = path.file_name().unwrap_or_default().to_string_lossy();
                if !dirname.starts_with('.') && !dirname.starts_with("DISABLED_BACKUP") {
                    if let Some(found) = find_file_recursive(&path, target_filename) {
                        return Some(found);
                    }
                }
            }
        }
    }
    None
}

fn copy_asset_file(source_dir: &Path, target_dir: &Path, rel_path: &str) -> Result<(), AppError> {
    let safe_rel = sanitize_rel_path(rel_path);
    if safe_rel.is_empty() {
        return Ok(());
    }

    let dest_file = target_dir.join(&safe_rel);

    // 1. Try resolving directly inside source_dir with safe_rel
    let mut resolved_src = None;
    let direct_src = source_dir.join(&safe_rel);
    if direct_src.exists() && direct_src.is_file() {
        resolved_src = Some(direct_src);
    } else {
        // 2. Fallback: search recursively in source_dir for the file by filename
        let file_name = Path::new(&safe_rel)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| safe_rel.clone());

        if let Some(found_path) = find_file_recursive(source_dir, &file_name) {
            resolved_src = Some(found_path);
        }
    }

    if let Some(src_file) = resolved_src {
        // Guard against copying a file onto itself (which causes OS error 32 on Windows)
        if src_file == dest_file {
            return Ok(());
        }
        if let (Ok(s_canon), Ok(d_canon)) = (src_file.canonicalize(), dest_file.canonicalize()) {
            if s_canon == d_canon {
                return Ok(());
            }
        }

        if let Some(parent) = dest_file.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }
        crate::utils::safe_copy_file(&src_file, &dest_file)?;
    }

    Ok(())
}

#[cfg(test)]
#[path = "mod_splitter_tests.rs"]
mod tests;
