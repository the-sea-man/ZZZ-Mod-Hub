use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, OnceLock, RwLock};
use regex::Regex;
use serde::{Deserialize, Serialize};
use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use half::f16;
use std::io::{Cursor, Read};

static HASH_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^\s*hash\s*=\s*([a-f0-9]{8})").expect("Valid regex"));
static BACKUP_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^DISABLED_BACKUP_\d+_(.+)\.(ini|buf)\.bak$").expect("Valid regex"));

use crate::error::AppError;
use crate::utils::{find_ini_files, read_ini_to_string};

/// In-memory cache for the parsed fixer database.
/// Keyed by the resolved JSON file path so switching databases is handled correctly.
/// Protected by RwLock — concurrent reads are non-blocking in the hot path.
static FIXER_DB_CACHE: OnceLock<RwLock<Option<(PathBuf, FixerDatabase)>>> = OnceLock::new();

fn get_fixer_db_cache() -> &'static RwLock<Option<(PathBuf, FixerDatabase)>> {
    FIXER_DB_CACHE.get_or_init(|| RwLock::new(None))
}

/// Invalidates the fixer database cache. Call this after a database sync/update.
pub fn invalidate_fixer_db_cache() {
    if let Ok(mut guard) = get_fixer_db_cache().write() {
        *guard = None;
    }
}


/// Action definition in a fixer rule
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FixerRuleAction {
    #[serde(rename = "type")]
    pub action_type: String,
    #[serde(default)]
    pub new_hash: Option<String>,
    #[serde(default)]
    pub equiv_hashes: Option<Vec<String>>,
    #[serde(default)]
    pub section_title: Option<String>,
    #[serde(default)]
    pub section_content: Option<String>,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub old_format: Option<Vec<String>>,
    #[serde(default)]
    pub new_format: Option<Vec<String>>,
    #[serde(default)]
    pub old_indices: Option<Vec<u32>>,
    #[serde(default)]
    pub new_indices: Option<Vec<u32>>,
    #[serde(default, alias = "hash")]
    pub target_hash: Option<String>,
    #[serde(default)]
    pub commandlist_title: Option<String>,
    #[serde(default)]
    pub from_indices: Option<Vec<i64>>,
    #[serde(default)]
    pub to_indices: Option<Vec<i64>>,
    #[serde(default)]
    pub from_index_counts: Option<Vec<i64>>,
    #[serde(default)]
    pub to_index_counts: Option<Vec<i64>>,
}

/// Single hash migration rule
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FixerRule {
    pub hash: String,
    #[serde(default)]
    pub character: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub version_from: String,
    #[serde(default)]
    pub version_to: String,
    #[serde(default)]
    pub actions: Vec<FixerRuleAction>,
}

/// Full compiled fixer database
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FixerDatabase {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub total_rules: usize,
    #[serde(default)]
    pub total_migrations: usize,
    #[serde(default)]
    pub rules: HashMap<String, FixerRule>,
}

/// Detailed description of a single hash replacement
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HashFixDetail {
    pub old_hash: String,
    pub new_hash: String,
    pub character: String,
    pub description: String,
    pub version_from: String,
    pub version_to: String,
}

/// Multi-resolution (1024p / 2048p) duplication detail
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MultiResFixDetail {
    pub source_hash: String,
    pub target_hash: String,
    pub section_title: String,
}

/// Buffer (.buf) binary format conversion detail
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BufferFixDetail {
    pub buffer_filename: String,
    pub fix_type: String,
    pub old_format: String,
    pub new_format: String,
}

/// Detailed description of a submesh first index shift
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IndexFixDetail {
    pub hash: String,
    pub section: String,
    pub old_index: i64,
    pub new_index: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub old_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub new_count: Option<i64>,
    pub character: String,
    pub description: String,
}

/// Full analysis report for an outdated mod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModFixAnalysis {
    pub mod_path: String,
    pub mod_name: String,
    pub is_fixable: bool,
    pub detected_character: Option<String>,
    pub detected_skin: Option<String>,
    pub available_skins: Vec<String>,
    pub detected_version_from: Option<String>,
    pub detected_version_to: Option<String>,
    pub hash_fixes: Vec<HashFixDetail>,
    pub multi_res_fixes: Vec<MultiResFixDetail>,
    pub buffer_fixes: Vec<BufferFixDetail>,
    #[serde(default)]
    pub index_fixes: Vec<IndexFixDetail>,
    pub total_fixes: usize,
    pub has_backup: bool,
}

/// Result of executing a mod upgrade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModFixResult {
    pub mod_path: String,
    pub success: bool,
    pub backup_created: Option<String>,
    pub modified_ini_files: Vec<String>,
    pub modified_buf_files: Vec<String>,
    pub hashes_updated: usize,
    pub sections_added: usize,
    pub buffers_remapped: usize,
    #[serde(default)]
    pub indices_remapped: usize,
    pub actions_summary: Vec<String>,
    pub error: Option<String>,
}

/// Helper to load the fixer database from local app data or fall back to bundled/empty.
/// Results are cached in memory keyed by the resolved file path. Call `invalidate_fixer_db_cache()`
/// after a database sync to force a fresh parse on the next call.
pub fn load_fixer_database(db_path: Option<&Path>) -> FixerDatabase {
    let mut candidate_paths = Vec::new();
    if let Some(p) = db_path {
        candidate_paths.push(p.to_path_buf());
        if let Some(parent) = p.parent() {
            candidate_paths.push(parent.join("hash_migrations.json"));
            candidate_paths.push(parent.join("database.json"));
        }
    }
    if let Ok(app_data) = std::env::var("APPDATA") {
        let base = PathBuf::from(app_data).join("com.zzzmodhub.app");
        candidate_paths.push(base.join("database.json"));
        candidate_paths.push(base.join("hash_migrations.json"));
    }

    // Fast path: find the first existing candidate path. If it matches the cached path, return cached DB.
    for path in &candidate_paths {
        if path.exists() {
            if let Ok(guard) = get_fixer_db_cache().read() {
                if let Some((cached_path, cached_db)) = guard.as_ref() {
                    if cached_path == path {
                        return cached_db.clone();
                    }
                }
            }
            break;
        }
    }

    for path in candidate_paths {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    // 1. Direct root structure with rules field
                    if let Ok(db) = serde_json::from_value::<FixerDatabase>(val.clone()) {
                        if !db.rules.is_empty() {
                            if let Ok(mut guard) = get_fixer_db_cache().write() {
                                *guard = Some((path, db.clone()));
                            }
                            return db;
                        }
                    }
                    // 2. Nested under hash_migrations key
                    if let Some(fixer_val) = val.get("hash_migrations") {
                        if let Ok(db) = serde_json::from_value::<FixerDatabase>(fixer_val.clone()) {
                            if !db.rules.is_empty() {
                                if let Ok(mut guard) = get_fixer_db_cache().write() {
                                *guard = Some((path, db.clone()));
                            }
                                return db;
                            }
                        }
                    }
                }
            }
        }
    }

    FixerDatabase::default()
}

/// Parsed section from an INI file
#[derive(Debug, Clone)]
pub struct IniSectionData {
    pub header: String,
    pub lines: Vec<String>,
}

impl IniSectionData {
    pub fn get_hash(&self) -> Option<String> {
        for l in &self.lines {
            let trimmed = l.trim();
            if trimmed.starts_with(';') || trimmed.starts_with('#') {
                continue;
            }
            let clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            if let Some((k, v)) = clean.split_once('=') {
                if k.trim().eq_ignore_ascii_case("hash") {
                    let val = v.trim().to_lowercase();
                    if !val.is_empty() {
                        return Some(val);
                    }
                }
            }
        }
        None
    }

    pub fn get_match_first_index(&self) -> Option<i64> {
        for l in &self.lines {
            let trimmed = l.trim();
            if trimmed.starts_with(';') || trimmed.starts_with('#') {
                continue;
            }
            let clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            if let Some((k, v)) = clean.split_once('=') {
                if k.trim().eq_ignore_ascii_case("match_first_index") {
                    if let Ok(idx) = v.trim().parse::<i64>() {
                        return Some(idx);
                    }
                }
            }
        }
        None
    }

    pub fn get_match_index_count(&self) -> Option<i64> {
        for l in &self.lines {
            let trimmed = l.trim();
            if trimmed.starts_with(';') || trimmed.starts_with('#') {
                continue;
            }
            let clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            if let Some((k, v)) = clean.split_once('=') {
                if k.trim().eq_ignore_ascii_case("match_index_count") {
                    if let Ok(idx) = v.trim().parse::<i64>() {
                        return Some(idx);
                    }
                }
            }
        }
        None
    }
}

pub fn parse_ini_sections(content: &str) -> Vec<IniSectionData> {
    let mut sections = Vec::new();
    let mut current_header = String::new();
    let mut current_lines = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            if !current_header.is_empty() || !current_lines.is_empty() {
                sections.push(IniSectionData {
                    header: std::mem::take(&mut current_header),
                    lines: std::mem::take(&mut current_lines),
                });
            }
            current_header = trimmed[1..trimmed.len() - 1].trim().to_string();
        } else {
            current_lines.push(line.to_string());
        }
    }
    if !current_header.is_empty() || !current_lines.is_empty() {
        sections.push(IniSectionData {
            header: current_header,
            lines: current_lines,
        });
    }
    sections
}

/// Extract all uncommented 8-character hex hashes from an INI file
pub fn extract_hashes_from_ini(content: &str) -> HashSet<String> {
    let mut hashes = HashSet::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(';') || trimmed.starts_with('#') {
            continue;
        }
        if let Some(caps) = HASH_RE.captures(trimmed) {
            if let Some(m) = caps.get(1) {
                hashes.insert(m.as_str().to_lowercase());
            }
        }
    }

    hashes
}

pub fn is_backup_file_name(name: &str) -> bool {
    name.starts_with("DISABLED_BACKUP_")
        || name.ends_with(".disabled.bak")
        || name.ends_with(".ini.bak")
        || name.ends_with(".buf.bak")
}

fn has_mod_backup_recursive(dir: &Path, depth: usize) -> bool {
    if depth > 10 || !dir.is_dir() {
        return false;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                if has_mod_backup_recursive(&path, depth + 1) {
                    return true;
                }
            } else {
                let name = entry.file_name().to_string_lossy().to_string();
                if is_backup_file_name(&name) {
                    return true;
                }
            }
        }
    }
    false
}

/// Check if a mod has existing .disabled.bak or DISABLED_BACKUP_ backups anywhere in its directory tree
pub fn has_mod_backup(mod_path: &Path) -> bool {
    if !mod_path.exists() || !mod_path.is_dir() {
        return false;
    }
    has_mod_backup_recursive(mod_path, 0)
}

/// Traverses the fixer database migration graph to resolve multi-hop hash updates
/// (e.g. v1.0 -> v1.2 -> v2.5 -> v3.1).
pub fn resolve_terminal_hash(start_hash: &str, fixer_db: &FixerDatabase) -> (String, Vec<String>) {
    let mut current = start_hash.to_lowercase();
    let mut path = Vec::new();
    let mut visited = HashSet::new();
    visited.insert(current.clone());

    for _ in 0..10 {
        if let Some(rule) = fixer_db.rules.get(&current) {
            let mut next_hash = None;
            for action in &rule.actions {
                if action.action_type == "update_hash" {
                    if let Some(ref nh) = action.new_hash {
                        let nh_lower = nh.to_lowercase();
                        if !visited.contains(&nh_lower) && nh_lower != current {
                            next_hash = Some(nh_lower);
                            break;
                        }
                    }
                }
            }
            if let Some(nh) = next_hash {
                visited.insert(nh.clone());
                path.push(nh.clone());
                current = nh;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    (current, path)
}

/// Checks if an INI hash set already satisfies an equiv hash (either directly or via terminal migration)
pub fn is_equiv_hash_satisfied(equiv_hash: &str, mod_hashes: &HashSet<String>, fixer_db: &FixerDatabase) -> bool {
    let target = equiv_hash.to_lowercase();
    if mod_hashes.contains(&target) {
        return true;
    }
    let (eq_term, _) = resolve_terminal_hash(&target, fixer_db);
    if mod_hashes.contains(&eq_term) {
        return true;
    }
    for h in mod_hashes {
        let (term, _) = resolve_terminal_hash(h, fixer_db);
        if term == target || term == eq_term {
            return true;
        }
    }
    false
}

/// Reindexes submesh draw call indices in an INI file
#[allow(dead_code)]
pub fn reindex_submesh_sections(
    ini_content: &str,
    target_hash: &str,
    src_indices: &[String],
    trg_indices: &[String],
) -> (String, usize) {
    if src_indices.len() != trg_indices.len() {
        return (ini_content.to_string(), 0);
    }

    let mut result = ini_content.to_string();
    let mut count = 0;

    for (src, trg) in src_indices.iter().zip(trg_indices.iter()) {
        let pattern = format!(
            r"(?is)(\[\s*TextureOverride[a-zA-Z0-9_]+\s*\][^\[]*?hash\s*=\s*{}[^\[]*?match_first_index\s*=\s*){}(\b)",
            target_hash, src
        );
        if let Ok(section_re) = Regex::new(&pattern) {
            if section_re.is_match(&result) {
                result = section_re.replace_all(&result, format!("${{1}}{}${{2}}", trg).as_str()).to_string();
                count += 1;
            }
        }
    }

    (result, count)
}

/// Helper to parse semantic version tuple (e.g. "1.4" -> (1, 4))
fn parse_version_tuple(v: &str) -> Option<(u32, u32)> {
    let clean = v.trim().trim_start_matches('v').trim_start_matches('V');
    if clean.is_empty() {
        return None;
    }
    let parts: Vec<&str> = clean.split('.').collect();
    if parts.len() >= 2 {
        let major = parts[0].parse::<u32>().ok()?;
        let minor = parts[1].parse::<u32>().ok()?;
        Some((major, minor))
    } else if parts.len() == 1 {
        let major = parts[0].parse::<u32>().ok()?;
        Some((major, 0))
    } else {
        None
    }
}

/// Canonical registry of alternate skin identifiers from ZZZ Mod Fixer database
/// Maps (normalized_alt_skin_key, normalized_base_character_key)
pub const KNOWN_ALT_SKINS: &[(&str, &str)] = &[
    ("janedoenocturneoflight", "janedoe"),
    ("ellencampus", "ellen"),
    ("aliceseaoftime", "alice"),
    ("alicesummer", "alice"),
    ("ariaagentdiscordantnote", "aria"),
    ("ariadiscordantnote", "aria"),
    ("astrachandelier", "astrayao"),
    ("astrayaochandelier", "astrayao"),
    ("bellebrillianceofstars", "belle"),
    ("belledelicatesunlight", "belle"),
    ("bellesummer", "belle"),
    ("bellesummerskies", "belle"),
    ("belletemple", "belle"),
    ("lucyprincessonholiday", "lucy"),
    ("manatowhiteheartsilhouette", "manato"),
    ("miyabidignifiedblossom", "miyabi"),
    ("nangongyurhapsodymuse", "nangongyu"),
    ("nicolecutie", "nicole"),
    ("panyinhuculinaryjewel", "panyinhu"),
    ("remiellemoonlightwhispers", "remielle"),
    ("remielleseashadepasseul", "remielle"),
    ("sigridmajesticwavechaser", "sigrid"),
    ("sunnaafternoonteabreak", "sunna"),
    ("velinashadeofleisure", "velina"),
    ("vivianirisoftheshore", "vivian"),
    ("wiseoathofskies", "wise"),
    ("wisepeacefulwaves", "wise"),
    ("wisesoaringcrane", "wise"),
    ("wisesummer", "wise"),
    ("yeshunguangskin", "yeshunguang"),
    ("yeshunguangtouchofdawnlight", "yeshunguang"),
    ("yixuantrailsofink", "yixuan"),
    ("yuzuhasummer", "yuzuha"),
];

/// Known character aliases for canonical matching
pub const KNOWN_CHARACTER_ALIASES: &[(&str, &str)] = &[
    ("rina", "alexandrina"),
    ("alexandrina", "rina"),
    ("alexandrinasebastiane", "rina"),
    ("lucy", "luciana"),
    ("lucianademontefio", "lucy"),
    ("nekomata", "nekomiya"),
    ("nekomiyamana", "nekomata"),
    ("soukaku", "shoukaku"),
    ("soldier11", "soldier"),
    ("soldier", "soldier11"),
];

/// Checks whether a normalized name corresponds to a known alternate skin
pub fn is_alternate_skin(clean_name: &str) -> bool {
    KNOWN_ALT_SKINS.iter().any(|(alt, _)| *alt == clean_name)
}

/// Returns the base character for a known alternate skin, if applicable
pub fn get_base_character_for_skin(clean_name: &str) -> Option<&'static str> {
    KNOWN_ALT_SKINS
        .iter()
        .find(|(alt, _)| *alt == clean_name)
        .map(|(_, base)| *base)
}

/// Match two character/skin names case-insensitively, strictly isolating alternate skins
pub fn is_character_match(a: &str, b: &str) -> bool {
    if a.is_empty() || b.is_empty() {
        return false;
    }
    let clean_a = a.to_lowercase().replace([' ', '_', '-'], "");
    let clean_b = b.to_lowercase().replace([' ', '_', '-'], "");

    if clean_a == clean_b {
        return true;
    }

    let a_is_alt = is_alternate_skin(&clean_a);
    let b_is_alt = is_alternate_skin(&clean_b);

    // Invariant: Alternate skins must NEVER cross-match with base characters or other skins
    if a_is_alt || b_is_alt {
        return false;
    }

    // Check known alias pairs (e.g. Rina <-> Alexandrina)
    for (alias_1, alias_2) in KNOWN_CHARACTER_ALIASES {
        if (clean_a == *alias_1 && clean_b.starts_with(alias_2))
            || (clean_b == *alias_1 && clean_a.starts_with(alias_2))
            || (clean_a == *alias_2 && clean_b.starts_with(alias_1))
            || (clean_b == *alias_2 && clean_a.starts_with(alias_1))
        {
            return true;
        }
    }

    clean_a.starts_with(&clean_b) || clean_b.starts_with(&clean_a)
}

/// Match two characters if they belong to the same base character family (e.g. Remielle and RemielleMoonlightWhispers)
pub fn is_same_character_family(a: &str, b: &str) -> bool {
    if a.is_empty() || b.is_empty() {
        return false;
    }
    if is_character_match(a, b) {
        return true;
    }
    let clean_a = a.to_lowercase().replace([' ', '_', '-'], "");
    let clean_b = b.to_lowercase().replace([' ', '_', '-'], "");
    if clean_a == clean_b {
        return true;
    }
    let base_a = get_base_character_for_skin(&clean_a).unwrap_or(&clean_a);
    let base_b = get_base_character_for_skin(&clean_b).unwrap_or(&clean_b);
    base_a == base_b || is_character_match(base_a, base_b)
}

/// Detect the canonical character name (or alternate skin) from a mod's directory path or category folder
pub fn detect_character_from_mod_path(mod_path: &Path) -> Option<String> {
    let components: Vec<&str> = mod_path.iter().filter_map(|c| c.to_str()).collect();
    for i in 0..components.len() {
        if (components[i].eq_ignore_ascii_case("Playable Characters") || components[i].eq_ignore_ascii_case("Characters"))
            && i + 1 < components.len() {
                let cat = components[i + 1];
                if !cat.eq_ignore_ascii_case("Unassigned") {
                    let parts: Vec<&str> = cat.split('-').collect();
                    let char_name = parts[0].trim();
                    let skin_name = if parts.len() > 1 { parts[1].trim() } else { "" };

                    let clean_char = char_name.to_lowercase().replace([' ', '_', '-'], "");
                    let clean_skin = skin_name.to_lowercase().replace([' ', '_', '-'], "").replace("thyme", "time");

                    // Check if the skin in folder is a known alternate skin
                    let combined = format!("{}{}", clean_char, clean_skin);
                    for (alt_key, base_key) in KNOWN_ALT_SKINS {
                        let alt_suffix = alt_key.strip_prefix(base_key).unwrap_or("");
                        let matches_suffix = !alt_suffix.is_empty()
                            && (clean_skin.contains(alt_suffix)
                                || (clean_skin.len() >= 3 && alt_suffix.contains(&clean_skin)));
                        if combined == *alt_key
                            || (clean_char.starts_with(base_key) && matches_suffix && !clean_skin.is_empty())
                            || (*alt_key == "janedoenocturneoflight" && clean_char.starts_with("janedoe") && clean_skin.contains("summer"))
                        {
                            return Some(match *alt_key {
                                "janedoenocturneoflight" => "JaneDoeNocturneOfLight".to_string(),
                                "ellencampus" => "EllenCampus".to_string(),
                                "aliceseaoftime" => "AliceSeaOfTime".to_string(),
                                "alicesummer" => "AliceSummer".to_string(),
                                "ariaagentdiscordantnote" => "AriaAgentDiscordantNote".to_string(),
                                "ariadiscordantnote" => "AriaDiscordantNote".to_string(),
                                "astrachandelier" | "astrayaochandelier" => "AstraChandelier".to_string(),
                                "bellebrillianceofstars" => "BelleBrillianceOfStars".to_string(),
                                "belledelicatesunlight" => "BelleDelicateSunlight".to_string(),
                                "bellesummer" | "bellesummerskies" => "BelleSummer".to_string(),
                                "belletemple" => "BelleTemple".to_string(),
                                "lucyprincessonholiday" => "LucyPrincessOnHoliday".to_string(),
                                "manatowhiteheartsilhouette" => "ManatoWhiteHeartSilhouette".to_string(),
                                "miyabidignifiedblossom" => "MiyabiDignifiedBlossom".to_string(),
                                "nangongyurhapsodymuse" => "NangongYuRhapsodyMuse".to_string(),
                                "nicolecutie" => "NicoleCutie".to_string(),
                                "panyinhuculinaryjewel" => "PanYinhuCulinaryJewel".to_string(),
                                "remiellemoonlightwhispers" => "RemielleMoonlightWhispers".to_string(),
                                "remielleseashadepasseul" => "RemielleSeashadePasSeul".to_string(),
                                "sigridmajesticwavechaser" => "SigridMajesticWavechaser".to_string(),
                                "sunnaafternoonteabreak" => "SunnaAfternoonTeaBreak".to_string(),
                                "velinashadeofleisure" => "VelinaShadeOfLeisure".to_string(),
                                "vivianirisoftheshore" => "VivianIrisOfTheShore".to_string(),
                                "wiseoathofskies" => "WiseOathOfSkies".to_string(),
                                "wisepeacefulwaves" => "WisePeacefulWaves".to_string(),
                                "wisesoaringcrane" => "WiseSoaringCrane".to_string(),
                                "wisesummer" => "WiseSummer".to_string(),
                                "yeshunguangskin" => "YeShunguangSkin".to_string(),
                                "yeshunguangtouchofdawnlight" => "YeShunguangTouchOfDawnlight".to_string(),
                                "yixuantrailsofink" => "YixuanTrailsOfInk".to_string(),
                                "yuzuhasummer" => "YuzuhaSummer".to_string(),
                                _ => alt_key.to_string(),
                            });
                        }
                    }

                    // Otherwise, resolve canonical base character name
                    let canonical_base = match clean_char.as_str() {
                        "janedoe" | "jane" => "JaneDoe",
                        "alexandrina" | "alexandrinasebastiane" | "rina" => "Rina",
                        "astrayao" | "astra" => "AstraYao",
                        "zhuyuan" => "ZhuYuan",
                        "jufufu" => "JuFufu",
                        "panyinhu" => "PanYinhu",
                        "yeshunguang" => "YeShunguang",
                        "komanomanato" | "manato" => "Manato",
                        "hoshimimiyabi" | "miyabi" => "Miyabi",
                        "lucianademontefio" | "lucy" => "Lucy",
                        "nekomiyamana" | "nekomata" => "Nekomata",
                        "soldier11" | "soldier" => "Soldier11",
                        "tsukishiroyanagi" | "yanagi" => "Yanagi",
                        "asabaharumasa" | "harumasa" => "Harumasa",
                        "evelynchevalier" | "evelyn" => "Evelyn",
                        "hugovlad" | "hugo" => "Hugo",
                        "koledabelobog" | "koleda" => "Koleda",
                        "luciaelowen" | "lucia" => "Lucia",
                        "pulchrafellini" | "pulchra" => "Pulchra",
                        "remielledan" | "remielle" => "Remielle",
                        "ukinamiyuzuha" | "yuzuha" => "Yuzuha",
                        "velinaairgid" | "velina" => "Velina",
                        "vivianbanshee" | "vivian" => "Vivian",
                        "billykid" | "billy" => "Billy",
                        "anbydemara" | "anby" => "Anby",
                        "antonivanov" | "anton" => "Anton",
                        "benbigger" | "ben" => "Ben",
                        "corinwickes" | "corin" => "Corin",
                        "gracehoward" | "grace" => "Grace",
                        "nicoledemara" | "nicole" => "Nicole",
                        "piperwheel" | "piper" => "Piper",
                        "sethlowell" | "seth" => "Seth",
                        "burnicewhite" | "burnice" => "Burnice",
                        "caesarking" | "caesar" => "Caesar",
                        "vonlycaon" | "lycaon" => "Lycaon",
                        "ellenjoe" | "ellen" => "Ellen",
                        _ => {
                            let root = char_name.split_whitespace().next().unwrap_or(char_name);
                            return if !root.is_empty() { Some(root.to_string()) } else { None };
                        }
                    };
                    return Some(canonical_base.to_string());
                }
            }
    }
    None
}

/// Analyze a mod directory to detect outdated hashes, missing resolutions, and required buffer conversions
pub fn analyze_mod_for_fixes(mod_path: &Path, fixer_db: &FixerDatabase) -> ModFixAnalysis {
    let mod_name = mod_path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let mut ini_files = Vec::new();
    find_ini_files(mod_path, &mut ini_files, 0, 10);

    let mut hash_fixes: Vec<HashFixDetail> = Vec::new();
    let mut multi_res_fixes: Vec<MultiResFixDetail> = Vec::new();
    let mut buffer_fixes: Vec<BufferFixDetail> = Vec::new();
    let mut index_fixes: Vec<IndexFixDetail> = Vec::new();

    let mut all_v_from: Vec<(u32, u32)> = Vec::new();
    let mut all_v_to: Vec<(u32, u32)> = Vec::new();

    let mut all_mod_hashes: HashSet<String> = HashSet::new();

    for ini_path in &ini_files {
        let fname = ini_path.file_name().unwrap_or_default().to_string_lossy();
        if fname.starts_with("zzzmanager_ui_") || fname.starts_with("000_zzzmanager_ui_") || fname.ends_with(".bak") {
            continue;
        }

        if let Ok(content) = read_ini_to_string(ini_path) {
            let hashes = extract_hashes_from_ini(&content);
            for h in &hashes {
                all_mod_hashes.insert(h.clone());
            }
        }
    }

    // 1. Primary character detection: from directory path (e.g. Playable Characters/Nicole Demara)
    let mut detected_char = detect_character_from_mod_path(mod_path);

    // 2. Secondary character detection: score hashes across fixer rules (IB meshes weighted 10x)
    if detected_char.is_none() {
        let mut char_scores: HashMap<String, u32> = HashMap::new();
        for h in &all_mod_hashes {
            if let Some(rule) = fixer_db.rules.get(h) {
                if !rule.character.is_empty() {
                    let desc_l = rule.description.to_lowercase();
                    let weight = if desc_l.contains("ib") || desc_l.contains("mesh") || desc_l.contains("body") || desc_l.contains("hair") {
                        10
                    } else {
                        1
                    };
                    *char_scores.entry(rule.character.clone()).or_insert(0) += weight;
                }
            }
        }
        if let Some((best_char, _)) = char_scores.into_iter().max_by_key(|(_, score)| *score) {
            detected_char = Some(best_char);
        }
    }

    for ini_path in &ini_files {
        let fname = ini_path.file_name().unwrap_or_default().to_string_lossy();
        if fname.starts_with("zzzmanager_ui_") || fname.starts_with("000_zzzmanager_ui_") || fname.ends_with(".bak") {
            continue;
        }

        if let Ok(content) = read_ini_to_string(ini_path) {
            // Check for match_first_index and match_index_count shifts across sections
            for sec in parse_ini_sections(&content) {
                if let Some(ref h) = sec.get_hash() {
                    let old_first_idx = sec.get_match_first_index();
                    let old_cnt = sec.get_match_index_count();
                    if old_first_idx.is_none() && old_cnt.is_none() {
                        continue;
                    }
                    if let Some(rule) = fixer_db.rules.get(h) {
                        let family_matches = match detected_char {
                            Some(ref dc) => is_same_character_family(dc, &rule.character),
                            None => true,
                        };
                        if family_matches {
                            for action in &rule.actions {
                                if action.action_type == "remap_indices" {
                                    if let (Some(ref froms), Some(ref tos)) = (&action.from_indices, &action.to_indices) {
                                        for (i, (f_idx, t_idx)) in froms.iter().zip(tos.iter()).enumerate() {
                                            let mut need_first_remap = false;
                                            let mut need_count_remap = false;
                                            let mut old_count_val = None;
                                            let mut new_count_val = None;

                                            if let Some(cur_first) = old_first_idx {
                                                if cur_first == *f_idx && *t_idx != *f_idx {
                                                    need_first_remap = true;
                                                }
                                            }

                                            if let (Some(ref from_cnts), Some(ref to_cnts)) = (&action.from_index_counts, &action.to_index_counts) {
                                                if let (Some(f_c), Some(t_c)) = (from_cnts.get(i), to_cnts.get(i)) {
                                                    if let Some(cur_cnt) = old_cnt {
                                                        let slot_matches = old_first_idx.is_none_or(|fi| fi == *f_idx);
                                                        if slot_matches && cur_cnt == *f_c && *t_c != *f_c {
                                                            need_count_remap = true;
                                                            old_count_val = Some(*f_c);
                                                            new_count_val = Some(*t_c);
                                                        }
                                                    }
                                                }
                                            }

                                            if need_first_remap || need_count_remap {
                                                let desc = match (need_first_remap, need_count_remap) {
                                                    (true, true) => format!(
                                                        "Remap index {} -> {} & count {} -> {} in [{}] ({})",
                                                        f_idx, t_idx, old_count_val.unwrap_or(0), new_count_val.unwrap_or(0), sec.header, rule.character
                                                    ),
                                                    (true, false) => format!(
                                                        "Remap first index {} -> {} in [{}] ({})",
                                                        f_idx, t_idx, sec.header, rule.character
                                                    ),
                                                    (false, true) => format!(
                                                        "Remap index count {} -> {} in [{}] ({})",
                                                        old_count_val.unwrap_or(0), new_count_val.unwrap_or(0), sec.header, rule.character
                                                    ),
                                                    (false, false) => unreachable!(),
                                                };
                                                let item = IndexFixDetail {
                                                    hash: h.clone(),
                                                    section: sec.header.clone(),
                                                    old_index: if need_first_remap { *f_idx } else { old_first_idx.unwrap_or(0) },
                                                    new_index: if need_first_remap { *t_idx } else { old_first_idx.unwrap_or(0) },
                                                    old_count: old_count_val,
                                                    new_count: new_count_val,
                                                    character: rule.character.clone(),
                                                    description: desc,
                                                };
                                                if !index_fixes.contains(&item) {
                                                    index_fixes.push(item);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            let hashes = extract_hashes_from_ini(&content);
            let mut sorted_hashes: Vec<String> = hashes.into_iter().collect();
            sorted_hashes.sort();

            for hash in &sorted_hashes {
                if let Some(rule) = fixer_db.rules.get(hash) {
                    let char_matches = match detected_char {
                        Some(ref dc) => is_character_match(dc, &rule.character),
                        None => true,
                    };
                    let family_matches = match detected_char {
                        Some(ref dc) => is_same_character_family(dc, &rule.character),
                        None => true,
                    };
                    let is_mesh_or_ib = {
                        let desc_l = rule.description.to_lowercase();
                        desc_l.contains("ib") || desc_l.contains("mesh") || desc_l.contains("draw") || desc_l.contains("position")
                    };

                    // Never propose migrating another character family's unique mesh IB
                    if !family_matches && is_mesh_or_ib {
                        continue;
                    }

                    if let Some(vt) = parse_version_tuple(&rule.version_from) {
                        all_v_from.push(vt);
                    }
                    if let Some(vt) = parse_version_tuple(&rule.version_to) {
                        all_v_to.push(vt);
                    }

                    for action in &rule.actions {
                        match action.action_type.as_str() {
                            "update_hash" => {
                                let (terminal_hash, _) = resolve_terminal_hash(hash, fixer_db);
                                let target_hash = if terminal_hash != hash.to_lowercase() {
                                    terminal_hash
                                } else if let Some(ref new_h) = action.new_hash {
                                    new_h.clone()
                                } else {
                                    continue;
                                };

                                let display_char = if family_matches {
                                    rule.character.clone()
                                } else {
                                    detected_char.clone().unwrap_or_else(|| rule.character.clone())
                                };

                                let display_desc = if family_matches {
                                    rule.description.clone()
                                } else {
                                    format!("{} Shared Texture ({})", display_char, rule.description)
                                };

                                let item = HashFixDetail {
                                    old_hash: hash.clone(),
                                    new_hash: target_hash,
                                    character: display_char,
                                    description: display_desc,
                                    version_from: if rule.version_from.is_empty() { "1.0".to_string() } else { rule.version_from.clone() },
                                    version_to: if rule.version_to.is_empty() { "3.1".to_string() } else { rule.version_to.clone() },
                                };
                                if !hash_fixes.contains(&item) {
                                    hash_fixes.push(item);
                                }
                            }
                            "multiply_section_if_missing" | "add_section_if_missing" => {
                                let can_inject = match detected_char {
                                    Some(ref dc) => {
                                        if let Some(ref title) = action.section_title {
                                            let prefix = title.split('.').next().unwrap_or(title);
                                            is_character_match(dc, prefix)
                                        } else {
                                            is_character_match(dc, &rule.character)
                                        }
                                    }
                                    None => false,
                                };
                                if !can_inject {
                                    continue;
                                }
                                if let Some(ref equivs) = action.equiv_hashes {
                                    let mod_hash_set: HashSet<String> = sorted_hashes.iter().map(|h| h.to_lowercase()).collect();
                                    let has_any = equivs.iter().any(|eq| is_equiv_hash_satisfied(eq, &mod_hash_set, fixer_db));
                                    if !has_any && !equivs.is_empty() {
                                        let (target_eq, _) = resolve_terminal_hash(&equivs[0], fixer_db);
                                        let title = action.section_title.clone().unwrap_or_default();
                                        let item = MultiResFixDetail {
                                            source_hash: hash.clone(),
                                            target_hash: target_eq,
                                            section_title: title,
                                        };
                                        if !multi_res_fixes.contains(&item) {
                                            multi_res_fixes.push(item);
                                        }
                                    }
                                }
                            }
                            "remap_texcoord" => {
                                if !char_matches {
                                    continue;
                                }
                                let old_f = action.old_format.clone().unwrap_or_default().join(",");
                                let new_f = action.new_format.clone().unwrap_or_default().join(",");
                                let item = BufferFixDetail {
                                    buffer_filename: format!("vb1 Buffer ({})", action.id.clone().unwrap_or_else(|| rule.character.clone())),
                                    fix_type: "remap_texcoord".to_string(),
                                    old_format: old_f,
                                    new_format: new_f,
                                };
                                if !buffer_fixes.contains(&item) {
                                    buffer_fixes.push(item);
                                }
                            }
                            "shrink_texcoord_color" => {
                                if !char_matches {
                                    continue;
                                }
                                let item = BufferFixDetail {
                                    buffer_filename: format!("vb1 Color Buffer ({})", action.id.clone().unwrap_or_else(|| "1.2".to_string())),
                                    fix_type: "shrink_texcoord_color".to_string(),
                                    old_format: "4f (16-byte)".to_string(),
                                    new_format: "4B (4-byte)".to_string(),
                                };
                                if !buffer_fixes.contains(&item) {
                                    buffer_fixes.push(item);
                                }
                            }
                            "update_blend_indices" => {
                                if !char_matches {
                                    continue;
                                }
                                let old_count = action.old_indices.as_ref().map(|v| v.len()).unwrap_or(0);
                                let item = BufferFixDetail {
                                    buffer_filename: format!("vb2 Blend Buffer ({})", rule.character),
                                    fix_type: "update_blend_indices".to_string(),
                                    old_format: format!("{} legacy bone indices", old_count),
                                    new_format: "Remapped 3.0 skeleton bone indices".to_string(),
                                };
                                if !buffer_fixes.contains(&item) {
                                    buffer_fixes.push(item);
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    // Check for legacy combined vertex strides (92, 96, 76) that distort separated vertex streams (stride 40)
    static LEGACY_STRIDE_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?im)^[ \t]*override_byte_stride\s*=\s*(?:92|96|76)\b").expect("Valid regex"));
    for ini_path in &ini_files {
        let fname = ini_path.file_name().unwrap_or_default().to_string_lossy();
        if fname.starts_with("zzzmanager_ui_") || fname.starts_with("000_zzzmanager_ui_") || fname.ends_with(".bak") {
            continue;
        }
        if let Ok(content) = read_ini_to_string(ini_path) {
            for m in LEGACY_STRIDE_RE.find_iter(&content) {
                let old_val = m.as_str().trim();
                let item = BufferFixDetail {
                    buffer_filename: format!("VertexLimitRaise ({})", fname),
                    fix_type: "normalize_byte_stride".to_string(),
                    old_format: old_val.to_string(),
                    new_format: "override_byte_stride = 40".to_string(),
                };
                if !buffer_fixes.contains(&item) {
                    buffer_fixes.push(item);
                }
            }
        }
    }

    let detected_v_from = if !all_v_from.is_empty() {
        all_v_from.sort();
        let (maj, min) = all_v_from[0];
        Some(format!("{}.{}", maj, min))
    } else {
        detected_char.as_ref().map(|_| "1.0".to_string())
    };

    let detected_v_to = if !all_v_to.is_empty() {
        all_v_to.sort();
        let (maj, min) = all_v_to.last().copied().unwrap_or((3, 1));
        Some(format!("{}.{}", maj, min))
    } else {
        detected_char.as_ref().map(|_| "3.1".to_string())
    };

    // Ensure v_from < v_to
    let (detected_version_from, detected_version_to) = match (detected_v_from, detected_v_to) {
        (Some(f), Some(t)) => {
            let f_tup = parse_version_tuple(&f).unwrap_or((1, 0));
            let t_tup = parse_version_tuple(&t).unwrap_or((3, 1));
            if f_tup >= t_tup {
                (Some(format!("{}.{}", f_tup.0, f_tup.1)), Some("3.1".to_string()))
            } else {
                (Some(f), Some(t))
            }
        }
        (f, t) => (f, t),
    };

    let available_skins: Vec<String> = all_mod_hashes
        .iter()
        .filter_map(|h| fixer_db.rules.get(h))
        .map(|r| r.character.clone())
        .filter(|c| !c.is_empty() && detected_char.as_ref().is_none_or(|dc| is_same_character_family(dc, c)))
        .collect::<HashSet<String>>()
        .into_iter()
        .collect();

    let detected_skin = available_skins.first().cloned().or_else(|| detected_char.clone());
    let total_fixes = hash_fixes.len() + multi_res_fixes.len() + buffer_fixes.len() + index_fixes.len();
    let is_fixable = !hash_fixes.is_empty() || !buffer_fixes.is_empty() || !multi_res_fixes.is_empty() || !index_fixes.is_empty();
    let has_backup = has_mod_backup(mod_path);

    ModFixAnalysis {
        mod_path: mod_path.to_string_lossy().replace('\\', "/"),
        mod_name,
        is_fixable,
        detected_character: detected_char,
        detected_skin,
        available_skins,
        detected_version_from,
        detected_version_to,
        hash_fixes,
        multi_res_fixes,
        buffer_fixes,
        index_fixes,
        total_fixes,
        has_backup,
    }
}

/// Extract all buffer filenames referenced by a section or commandlist in an INI
fn find_referenced_buffers(ini_content: &str, target_hash: &str, target_slot: &str) -> Vec<(String, usize)> {
    let mut results = Vec::new();
    let mut resource_names = HashSet::new();

    struct Section {
        header: String,
        lines: Vec<String>,
    }

    let mut sections: Vec<Section> = Vec::new();
    let mut current_header = String::new();
    let mut current_lines = Vec::new();

    for line in ini_content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            if !current_header.is_empty() {
                sections.push(Section {
                    header: std::mem::take(&mut current_header),
                    lines: std::mem::take(&mut current_lines),
                });
            }
            current_header = trimmed[1..trimmed.len() - 1].trim().to_string();
        } else {
            current_lines.push(trimmed.to_string());
        }
    }
    if !current_header.is_empty() {
        sections.push(Section {
            header: current_header,
            lines: current_lines,
        });
    }

    let target_hash_lower = target_hash.to_lowercase();
    let target_slot_lower = target_slot.to_lowercase();
    let mut command_lists_to_visit: Vec<String> = Vec::new();
    let mut visited_command_lists: HashSet<String> = HashSet::new();

    // 1. Find section with matching hash and extract slot assignment (e.g. vb1 = ResourceName)
    // or run = CommandList...
    for sec in &sections {
        let has_target_hash = sec.lines.iter().any(|l| {
            let l_trimmed = l.trim();
            if l_trimmed.starts_with(';') || l_trimmed.starts_with('#') {
                return false;
            }
            let l_clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            if let Some((k, v)) = l_clean.split_once('=') {
                let k_t = k.trim();
                let v_t = v.trim();
                k_t.eq_ignore_ascii_case("hash") && v_t.eq_ignore_ascii_case(&target_hash_lower)
            } else {
                false
            }
        });

        if has_target_hash {
            for l in &sec.lines {
                let l_trimmed = l.trim();
                if l_trimmed.starts_with(';') || l_trimmed.starts_with('#') {
                    continue;
                }
                let l_clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
                if let Some((k, v)) = l_clean.split_once('=') {
                    let k_t = k.trim();
                    let mut v_t = v.trim();
                    if k_t.eq_ignore_ascii_case(&target_slot_lower) {
                        if v_t.to_lowercase().starts_with("ref ") {
                            v_t = v_t[4..].trim();
                        }
                        resource_names.insert(v_t.to_string());
                    } else if k_t.eq_ignore_ascii_case("run") {
                        command_lists_to_visit.push(v_t.to_string());
                    }
                }
            }
        }
    }

    // Follow CommandList indirection
    while let Some(cl_name) = command_lists_to_visit.pop() {
        let cl_lower = cl_name.to_lowercase();
        if visited_command_lists.contains(&cl_lower) {
            continue;
        }
        visited_command_lists.insert(cl_lower);

        for sec in &sections {
            if sec.header.eq_ignore_ascii_case(&cl_name) {
                for l in &sec.lines {
                    let l_trimmed = l.trim();
                    if l_trimmed.starts_with(';') || l_trimmed.starts_with('#') {
                        continue;
                    }
                    let l_clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
                    if let Some((k, v)) = l_clean.split_once('=') {
                        let k_t = k.trim();
                        let mut v_t = v.trim();
                        if k_t.eq_ignore_ascii_case(&target_slot_lower) {
                            if v_t.to_lowercase().starts_with("ref ") {
                                v_t = v_t[4..].trim();
                            }
                            resource_names.insert(v_t.to_string());
                        } else if k_t.eq_ignore_ascii_case("run") {
                            command_lists_to_visit.push(v_t.to_string());
                        }
                    }
                }
            }
        }
    }

    // 2. Match Resource sections to extract filename and stride
    for sec in &sections {
        let header_name = &sec.header;
        let is_target_resource = resource_names.iter().any(|r| {
            header_name.eq_ignore_ascii_case(r)
                || (header_name.starts_with("Resource") && header_name[8..].eq_ignore_ascii_case(r))
                || (r.starts_with("Resource") && r[8..].eq_ignore_ascii_case(header_name))
        });

        if is_target_resource {
            let mut filename = None;
            let mut stride = 0;

            for l in &sec.lines {
                let l_trimmed = l.trim();
                if l_trimmed.starts_with(';') || l_trimmed.starts_with('#') {
                    continue;
                }
                let l_clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
                if let Some((k, v)) = l_clean.split_once('=') {
                    let k_l = k.trim().to_lowercase();
                    let mut v_t = v.trim();
                    if v_t.starts_with('"') && v_t.ends_with('"') && v_t.len() >= 2 {
                        v_t = v_t[1..v_t.len() - 1].trim();
                    }
                    let clean_path = v_t.trim_start_matches(".\\").trim_start_matches("./");
                    if k_l == "filename" {
                        filename = Some(clean_path.to_string());
                    } else if k_l == "stride" {
                        stride = v_t.parse::<usize>().unwrap_or(0);
                    }
                }
            }

            if let Some(f) = filename {
                results.push((f, stride));
            }
        }
    }

    results
}

/// Calculate format chunk byte size
fn calc_format_chunk_size(chunk: &str) -> usize {
    match chunk {
        "1e" | "1E" | "1i" | "1s" => 2,
        "4B" | "4b" | "2e" | "2E" | "1f" | "1F" | "2i" | "2s" | "1I" => 4,
        "2f" | "2F" | "4e" | "4E" | "4i" | "4s" | "2I" => 8,
        "3f" | "3F" | "3I" => 12,
        "4f" | "4F" | "4I" => 16,
        _ => 4,
    }
}

/// Update resource stride in INI text when a buffer format changes
pub fn update_resource_stride_in_ini(ini_content: &str, buf_filename: &str, new_stride: usize) -> (String, bool) {
    let mut lines: Vec<String> = ini_content.lines().map(|l| l.to_string()).collect();
    let mut section_ranges: Vec<(usize, usize)> = Vec::new();
    let mut current_start = None;

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            if let Some(start) = current_start {
                section_ranges.push((start, i));
            }
            current_start = Some(i);
        }
    }
    if let Some(start) = current_start {
        section_ranges.push((start, lines.len()));
    }

    let buf_lower = buf_filename.to_lowercase();
    let mut changed = false;

    for (start, end) in section_ranges {
        let mut has_target_filename = false;
        let mut stride_line_idx = None;

        for (idx, line) in lines.iter().enumerate().take(end).skip(start) {
            let line_clean = line.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            if let Some((k, v)) = line_clean.split_once('=') {
                let k_t = k.trim();
                let mut v_t = v.trim();
                if v_t.starts_with('"') && v_t.ends_with('"') && v_t.len() >= 2 {
                    v_t = v_t[1..v_t.len() - 1].trim();
                }
                let clean_v = v_t.trim_start_matches(".\\").trim_start_matches("./");
                if k_t.eq_ignore_ascii_case("filename") && clean_v.to_lowercase() == buf_lower {
                    has_target_filename = true;
                } else if k_t.eq_ignore_ascii_case("stride") {
                    stride_line_idx = Some(idx);
                }
            }
        }

        if has_target_filename {
            if let Some(s_idx) = stride_line_idx {
                let old_line = &lines[s_idx];
                let current_val = old_line.split_once('=').map(|(_, v)| v.trim()).unwrap_or("");
                if current_val != new_stride.to_string() {
                    lines[s_idx] = format!("stride = {}", new_stride);
                    changed = true;
                }
            } else {
                lines.insert(start + 1, format!("stride = {}", new_stride));
                changed = true;
            }
        }
    }

    let line_ending = if ini_content.contains("\r\n") { "\r\n" } else { "\n" };
    let result = if changed {
        let mut out = lines.join(line_ending);
        if ini_content.ends_with('\n') && !out.ends_with('\n') {
            out.push_str(line_ending);
        }
        out
    } else {
        ini_content.to_string()
    };

    (result, changed)
}

/// Perform binary format conversion on buffer data
pub fn remap_buffer_bytes(
    buffer: &[u8],
    old_stride: usize,
    old_format: &[String],
    new_format: &[String],
) -> Vec<u8> {
    let mut new_stride = 0;
    for chunk in new_format {
        new_stride += calc_format_chunk_size(chunk);
    }

    if old_stride == 0 || !buffer.len().is_multiple_of(old_stride) {
        return buffer.to_vec();
    }

    let vertex_count = buffer.len() / old_stride;
    let mut new_buffer = Vec::with_capacity(vertex_count * new_stride);

    for i in 0..vertex_count {
        let v_start = i * old_stride;
        let v_slice = &buffer[v_start..v_start + old_stride];
        let mut cursor = Cursor::new(v_slice);

        for (old_chunk, new_chunk) in old_format.iter().zip(new_format.iter()) {
            if old_chunk == new_chunk {
                let size = calc_format_chunk_size(old_chunk);
                let mut buf = vec![0u8; size];
                let _ = cursor.read_exact(&mut buf);
                new_buffer.extend_from_slice(&buf);
            } else if old_chunk == "4B" && new_chunk == "4f" {
                // Color unsigned byte (0-255) -> float (0.0-1.0)
                for _ in 0..4 {
                    let b = cursor.read_u8().unwrap_or(0);
                    let f = (b as f32) / 255.0;
                    let _ = new_buffer.write_f32::<LittleEndian>(f);
                }
            } else if old_chunk == "4f" && new_chunk == "4B" {
                // Color float (0.0-1.0) -> unsigned byte (0-255)
                for _ in 0..4 {
                    let f = cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                    let b = (f.clamp(0.0, 1.0) * 255.0) as u8;
                    new_buffer.push(b);
                }
            } else if old_chunk == "2e" && new_chunk == "2f" {
                // 2x half-float (f16) -> 2x single float (f32)
                for _ in 0..2 {
                    let h = cursor.read_u16::<LittleEndian>().unwrap_or(0);
                    let f = f16::from_bits(h).to_f32();
                    let _ = new_buffer.write_f32::<LittleEndian>(f);
                }
            } else if old_chunk == "2f" && new_chunk == "2e" {
                // 2x single float (f32) -> 2x half-float (f16)
                for _ in 0..2 {
                    let f = cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                    let h = f16::from_f32(f).to_bits();
                    let _ = new_buffer.write_u16::<LittleEndian>(h);
                }
            } else {
                let size = calc_format_chunk_size(old_chunk);
                let mut buf = vec![0u8; size];
                let _ = cursor.read_exact(&mut buf);
                new_buffer.extend_from_slice(&buf);
            }
        }
    }

    new_buffer
}

/// Shrink texcoord color buffer from 4f (16-byte) to 4B (4-byte)
pub fn shrink_color_buffer_bytes(buffer: &[u8], stride: usize) -> Vec<u8> {
    if stride < 16 || !buffer.len().is_multiple_of(stride) {
        return buffer.to_vec();
    }
    let new_stride = stride - 12;
    let vertex_count = buffer.len() / stride;
    let mut new_buffer = Vec::with_capacity(vertex_count * new_stride);

    for i in 0..vertex_count {
        let v_start = i * stride;
        let v_slice = &buffer[v_start..v_start + stride];
        let mut cursor = Cursor::new(v_slice);

        // First 16 bytes: 4x f32
        for _ in 0..4 {
            let f = cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
            let b = (f.clamp(0.0, 1.0) * 255.0) as u8;
            new_buffer.push(b);
        }

        // Remaining bytes in vertex
        if stride > 16 {
            let remainder = &v_slice[16..stride];
            new_buffer.extend_from_slice(remainder);
        }
    }

    new_buffer
}

/// Remap vertex bone blend indices in a 32-byte stride buffer
#[allow(dead_code)]
pub fn remap_bone_indices_buffer_bytes(
    buffer: &[u8],
    stride: usize,
    mappings: &HashMap<u32, u32>,
) -> Vec<u8> {
    if stride < 32 || !buffer.len().is_multiple_of(stride) {
        return buffer.to_vec();
    }
    let vertex_count = buffer.len() / stride;
    let mut new_buffer = buffer.to_vec();

    for i in 0..vertex_count {
        let v_start = i * stride;
        let mut cursor = Cursor::new(&buffer[v_start + 16..v_start + 32]);
        let mut out_cursor = Cursor::new(&mut new_buffer[v_start + 16..v_start + 32]);

        for _ in 0..4 {
            let idx = cursor.read_u32::<LittleEndian>().unwrap_or(0);
            let mapped_idx = mappings.get(&idx).copied().unwrap_or(idx);
            let _ = out_cursor.write_u32::<LittleEndian>(mapped_idx);
        }
    }

    new_buffer
}

/// Returns Jane Doe Hair bone blend remapping dictionary
#[allow(dead_code)]
pub fn get_jane_hair_bone_mappings() -> HashMap<u32, u32> {
    let raw = [
        (26, 4), (27, 5), (28, 6), (29, 7), (30, 8), (31, 9), (32, 10), (33, 11), (34, 12), (35, 13),
        (36, 14), (37, 15), (38, 16), (39, 17), (40, 19), (41, 20), (42, 18), (43, 22), (44, 23),
        (45, 24), (46, 25), (47, 26), (48, 27), (49, 28), (50, 21), (51, 29), (52, 30), (53, 31),
        (90, 33), (91, 34), (92, 32), (93, 36), (94, 37), (95, 35), (96, 38), (97, 39), (98, 40),
        (99, 41), (100, 42), (101, 44), (102, 45), (103, 46), (104, 48), (105, 47), (106, 43),
        (107, 49), (108, 52), (109, 53), (110, 54), (111, 55), (112, 50), (113, 51), (114, 56),
        (115, 57), (116, 58), (117, 59), (118, 60), (119, 61), (120, 62), (121, 63), (122, 64),
        (123, 65), (124, 66), (125, 67), (126, 68)
    ];
    raw.into_iter().collect()
}

/// Returns Jane Doe Hand bone blend remapping dictionary
#[allow(dead_code)]
pub fn get_jane_hand_bone_mappings() -> HashMap<u32, u32> {
    let raw = [
        (4, 0), (5, 1), (6, 2), (7, 3), (8, 4), (9, 5), (10, 6), (11, 7), (12, 8), (13, 9), (14, 10),
        (15, 11), (16, 12), (17, 13), (18, 14), (19, 15), (20, 16), (21, 17), (22, 18), (23, 19),
        (24, 20), (25, 21),
        (54, 22), (55, 23), (56, 24), (57, 25), (58, 26), (59, 27), (60, 28), (61, 29), (62, 30),
        (63, 31), (64, 32), (65, 33), (66, 34), (67, 35), (68, 36), (69, 37), (70, 38), (71, 39),
        (72, 40), (73, 41), (74, 42), (75, 43), (76, 44), (77, 45), (78, 46), (79, 47), (80, 48),
        (81, 49), (82, 50), (83, 51), (84, 52), (85, 53), (86, 54), (87, 55), (88, 56), (89, 57),
        (127, 58), (128, 59), (129, 60)
    ];
    raw.into_iter().collect()
}

/// Returns Dialyn bone blend remapping dictionary
#[allow(dead_code)]
pub fn get_dialyn_bone_mappings() -> HashMap<u32, u32> {
    let raw = [
        (18, 20), (19, 18), (20, 19),
        (54, 62), (55, 54), (56, 55), (57, 56), (58, 57), (59, 58), (60, 59), (61, 60), (62, 61),
        (69, 71), (70, 72), (71, 70), (72, 69),
        (91, 98), (92, 91), (93, 92), (94, 93), (95, 94), (96, 95), (97, 96), (98, 97),
        (113, 114), (114, 113),
        (128, 129), (129, 128), (130, 132), (131, 130), (132, 131),
        (188, 189), (189, 188),
    ];
    raw.into_iter().collect()
}

/// Apply full upgrades, duplications, and buffer conversions to a mod
pub fn apply_mod_fix(mod_path: &Path, fixer_db: &FixerDatabase) -> Result<ModFixResult, AppError> {
    if !mod_path.exists() || !mod_path.is_dir() {
        return Err(AppError::Custom(format!("Mod path does not exist: {:?}", mod_path)));
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let mut ini_files = Vec::new();
    find_ini_files(mod_path, &mut ini_files, 0, 10);

    let mut modified_ini_files = Vec::new();
    let mut modified_buf_files = Vec::new();
    let mut actions_summary = Vec::new();
    let mut hashes_updated = 0;
    let mut sections_added = 0;
    let mut buffers_remapped = 0;
    let mut indices_remapped = 0;

    let mut backup_created_name = None;

    let analysis = analyze_mod_for_fixes(mod_path, fixer_db);
    let detected_character = analysis.detected_character;

    for ini_path in &ini_files {
        let fname = ini_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        if fname.starts_with("zzzmanager_ui_") || fname.starts_with("000_zzzmanager_ui_") || fname.ends_with(".bak") {
            continue;
        }

        let content = match read_ini_to_string(ini_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let active_hashes = extract_hashes_from_ini(&content);
        let mut new_content = content.clone();
        let mut ini_changed = false;

        // Submesh index remapping (e.g. match_first_index and match_index_count shifts across game patches)
        for sec in parse_ini_sections(&content) {
            if let Some(ref h) = sec.get_hash() {
                let old_first_idx = sec.get_match_first_index();
                let old_cnt = sec.get_match_index_count();
                if old_first_idx.is_none() && old_cnt.is_none() {
                    continue;
                }
                if let Some(rule) = fixer_db.rules.get(h) {
                    let family_matches = match detected_character {
                        Some(ref dc) => is_same_character_family(dc, &rule.character),
                        None => true,
                    };
                    if family_matches {
                        for action in &rule.actions {
                            if action.action_type == "remap_indices" {
                                if let (Some(ref froms), Some(ref tos)) = (&action.from_indices, &action.to_indices) {
                                    for (i, (f_idx, t_idx)) in froms.iter().zip(tos.iter()).enumerate() {
                                        // 1. Remap match_first_index if present and matches this submesh
                                        if let Some(cur_first) = old_first_idx {
                                            if cur_first == *f_idx && *t_idx != *f_idx {
                                                let sec_pat = format!(
                                                    r"(?im)(\[{}[^\]]*\][\s\S]*?)(^[ \t]*match_first_index\s*=\s*){}\b",
                                                    regex::escape(&sec.header),
                                                    f_idx
                                                );
                                                if let Ok(re) = Regex::new(&sec_pat) {
                                                    if re.is_match(&new_content) {
                                                        let repl = format!("${{1}}${{2}}{}\r\n; [ZZZMODMANAGER PREVIOUS INDEX] match_first_index = {}", t_idx, f_idx);
                                                        new_content = re.replace(&new_content, repl.as_str()).to_string();
                                                        ini_changed = true;
                                                        indices_remapped += 1;
                                                        actions_summary.push(format!("Remapped match_first_index {} -> {} in [{}] ({})", f_idx, t_idx, sec.header, rule.character));
                                                    }
                                                }
                                            }
                                        }

                                        // 2. Remap match_index_count if present and matches this submesh
                                        if let (Some(ref from_cnts), Some(ref to_cnts)) = (&action.from_index_counts, &action.to_index_counts) {
                                            if let (Some(f_c), Some(t_c)) = (from_cnts.get(i), to_cnts.get(i)) {
                                                if let Some(cur_cnt) = old_cnt {
                                                    let slot_matches = old_first_idx.is_none_or(|fi| fi == *f_idx);
                                                    if slot_matches && cur_cnt == *f_c && *t_c != *f_c {
                                                        let count_pat = format!(
                                                            r"(?im)(\[{}[^\]]*\][\s\S]*?)(^[ \t]*match_index_count\s*=\s*){}\b",
                                                            regex::escape(&sec.header),
                                                            f_c
                                                        );
                                                        if let Ok(re) = Regex::new(&count_pat) {
                                                            if re.is_match(&new_content) {
                                                                let repl = format!("${{1}}${{2}}{}\r\n; [ZZZMODMANAGER PREVIOUS COUNT] match_index_count = {}", t_c, f_c);
                                                                new_content = re.replace(&new_content, repl.as_str()).to_string();
                                                                ini_changed = true;
                                                                indices_remapped += 1;
                                                                actions_summary.push(format!("Remapped match_index_count {} -> {} in [{}] ({})", f_c, t_c, sec.header, rule.character));
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Normalize legacy override_byte_stride (e.g. 92, 96, 76) to 40 on character vertex limit raise sections
        static STRIDE_REPLACE_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?im)^([ \t]*override_byte_stride\s*=\s*)(?:92|96|76)\b").expect("Valid regex"));
        if STRIDE_REPLACE_RE.is_match(&new_content) {
            let repl = "${1}40\r\n; [ZZZMODMANAGER PREVIOUS STRIDE] override_byte_stride = 92";
            new_content = STRIDE_REPLACE_RE.replace_all(&new_content, repl).to_string();
            ini_changed = true;
            buffers_remapped += 1;
            actions_summary.push("Normalized legacy override_byte_stride to 40 to prevent vertex mesh distortion".to_string());
        }

        // Collect buffer modifications needed: (buf_filename, fix_type, old_format, new_format, stride)
        type BufTask = (String, String, Vec<String>, Vec<String>, usize);
        let mut buf_tasks: Vec<BufTask> = Vec::new();

        for hash in &active_hashes {
            if let Some(rule) = fixer_db.rules.get(hash) {
                let char_matches = match detected_character {
                    Some(ref dc) => is_character_match(dc, &rule.character),
                    None => true,
                };
                let family_matches = match detected_character {
                    Some(ref dc) => is_same_character_family(dc, &rule.character),
                    None => true,
                };
                let is_mesh_or_ib = {
                    let desc_l = rule.description.to_lowercase();
                    desc_l.contains("ib") || desc_l.contains("mesh") || desc_l.contains("draw") || desc_l.contains("position")
                };

                // Do not update character-specific unique meshes of another character family
                if !family_matches && is_mesh_or_ib {
                    continue;
                }

                for action in &rule.actions {
                    match action.action_type.as_str() {
                        "update_hash" => {
                            let (terminal_h, _) = resolve_terminal_hash(hash, fixer_db);
                            let target_h = if terminal_h != hash.to_lowercase() {
                                terminal_h
                            } else if let Some(ref new_h) = action.new_hash {
                                new_h.clone()
                            } else {
                                continue;
                            };

                            let pattern = format!(r"(?i)(^|\r?\n)(\s*)(hash\s*=\s*){}", hash);
                            if let Ok(hash_re) = Regex::new(&pattern) {
                                if hash_re.is_match(&new_content) {
                                    let replacement = format!("${{1}}${{2}}hash = {}\r\n${{2}}; [ZZZMODMANAGER PREVIOUS HASH] hash = {}", target_h, hash);
                                    new_content = hash_re.replace_all(&new_content, replacement.as_str()).to_string();
                                    ini_changed = true;
                                    hashes_updated += 1;
                                    actions_summary.push(format!("Updated hash {} -> {} ({})", hash, target_h, rule.description));
                                }
                            }
                        }
                        "multiply_section_if_missing" => {
                            let can_inject = match detected_character {
                                Some(ref dc) => {
                                    if let Some(ref title) = action.section_title {
                                        let prefix = title.split('.').next().unwrap_or(title);
                                        is_character_match(dc, prefix)
                                    } else {
                                        is_character_match(dc, &rule.character)
                                    }
                                }
                                None => false,
                            };
                            if !can_inject {
                                continue;
                            }

                            if let Some(ref equivs) = action.equiv_hashes {
                                let has_any = equivs.iter().any(|eq| active_hashes.contains(eq) || new_content.contains(eq));
                                if !has_any && !equivs.is_empty() {
                                    let (terminal_target_eq, _) = resolve_terminal_hash(&equivs[0], fixer_db);
                                    let target_eq = &terminal_target_eq;
                                    let title = action.section_title.clone().unwrap_or_else(|| format!("{}.Duplicate", rule.character));

                                    // Extract lines from the source section matching `hash = <hash>` to preserve its body (e.g. `this = Resource...`)
                                    let mut body_lines = Vec::new();
                                    let lines: Vec<&str> = new_content.lines().collect();
                                    let mut sec_start = None;
                                    let mut sec_end = lines.len();
                                    let hash_pat = format!("hash = {}", hash);
                                    let hash_pat_compact = format!("hash={}", hash);

                                    for (idx, l) in lines.iter().enumerate() {
                                        let t = l.trim();
                                        if t.starts_with('[') && t.ends_with(']')
                                            && sec_start.is_some() {
                                                sec_end = idx;
                                                break;
                                            }
                                        let t_lower = t.to_lowercase();
                                        if (t_lower == hash_pat || t_lower == hash_pat_compact) && sec_start.is_none() {
                                            for back in (0..=idx).rev() {
                                                let bt = lines[back].trim();
                                                if bt.starts_with('[') && bt.ends_with(']') {
                                                    sec_start = Some(back);
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    if let Some(start) = sec_start {
                                        for l in lines.iter().take(sec_end).skip(start + 1) {
                                            let t = l.trim().to_lowercase();
                                            if !t.starts_with("hash") {
                                                body_lines.push(l.to_string());
                                            }
                                        }
                                    }

                                    let body_str = if body_lines.is_empty() {
                                        String::new()
                                    } else {
                                        format!("{}\r\n", body_lines.join("\r\n"))
                                    };

                                    let new_sec = format!(
                                        "\r\n\r\n; [ZZZMODMANAGER AUTO-GENERATED MULTI-RESOLUTION OVERRIDE]\r\n[TextureOverride{}]\r\nhash = {}\r\n{}",
                                        title, target_eq, body_str
                                    );
                                    new_content.push_str(&new_sec);
                                    ini_changed = true;
                                    sections_added += 1;
                                    actions_summary.push(format!("Added multi-resolution section '{}' with hash {}", title, target_eq));
                                }
                            }
                        }
                        "add_section_if_missing" => {
                            let can_inject = match detected_character {
                                Some(ref dc) => {
                                    if let Some(ref title) = action.section_title {
                                        let prefix = title.split('.').next().unwrap_or(title);
                                        is_character_match(dc, prefix)
                                    } else {
                                        is_character_match(dc, &rule.character)
                                    }
                                }
                                None => false,
                            };
                            if !can_inject {
                                continue;
                            }

                            if let Some(ref equivs) = action.equiv_hashes {
                                let has_any = equivs.iter().any(|eq| {
                                    let eq_lower = eq.to_lowercase();
                                    active_hashes.contains(&eq_lower)
                                        || new_content.to_lowercase().contains(&eq_lower)
                                        || is_equiv_hash_satisfied(&eq_lower, &active_hashes, fixer_db)
                                });
                                if !has_any && !equivs.is_empty() {
                                    let (terminal_target_eq, _) = resolve_terminal_hash(&equivs[0], fixer_db);
                                    let target_eq = &terminal_target_eq;
                                    let title = action.section_title.clone().unwrap_or_default();

                                    // Guard: if INI already has an override section for this title, do not overwrite/conflict
                                    let sec_tag = format!("[TextureOverride{}]", title);
                                    if new_content.to_lowercase().contains(&sec_tag.to_lowercase()) {
                                        continue;
                                    }

                                    let body = action.section_content.clone().unwrap_or_default();
                                    let body_formatted = if !body.is_empty() && !body.ends_with('\n') {
                                        format!("{}\r\n", body)
                                    } else {
                                        body
                                    };
                                    let new_sec = format!(
                                        "\r\n\r\n; [ZZZMODMANAGER AUTO-GENERATED OVERRIDE]\r\n[TextureOverride{}]\r\nhash = {}\r\n{}",
                                        title, target_eq, body_formatted
                                    );
                                    new_content.push_str(&new_sec);
                                    ini_changed = true;
                                    sections_added += 1;
                                    actions_summary.push(format!("Injected required section '[TextureOverride{}]' (hash {})", title, target_eq));
                                }
                            }
                        }
                        "remap_texcoord" => {
                            if !char_matches {
                                continue;
                            }
                            let old_fmt = action.old_format.clone().unwrap_or_default();
                            let new_fmt = action.new_format.clone().unwrap_or_default();
                            let buffers = find_referenced_buffers(&content, hash, "vb1");
                            for (buf_file, stride) in buffers {
                                buf_tasks.push((buf_file, "remap_texcoord".to_string(), old_fmt.clone(), new_fmt.clone(), stride));
                            }
                        }
                        "shrink_texcoord_color" => {
                            if !char_matches {
                                continue;
                            }
                            let buffers = find_referenced_buffers(&content, hash, "vb1");
                            for (buf_file, stride) in buffers {
                                buf_tasks.push((buf_file, "shrink_texcoord_color".to_string(), Vec::new(), Vec::new(), stride));
                            }
                        }
                        "update_blend_indices" => {
                            if !char_matches {
                                continue;
                            }
                            let old_idx = action.old_indices.clone().unwrap_or_default();
                            let new_idx = action.new_indices.clone().unwrap_or_default();
                            let target_h = if let Some(ref th) = action.target_hash {
                                if !th.is_empty() { th.as_str() } else { hash }
                            } else {
                                hash
                            };
                            let buffers = find_referenced_buffers(&content, target_h, "vb2");
                            for (buf_file, stride) in buffers {
                                buf_tasks.push((
                                    buf_file,
                                    "update_blend_indices".to_string(),
                                    old_idx.iter().map(|n| n.to_string()).collect(),
                                    new_idx.iter().map(|n| n.to_string()).collect(),
                                    stride,
                                ));
                            }
                        }
                        _ => {}
                    }
                }
            }
        }

        let mut seen_buf_tasks: HashSet<(PathBuf, String)> = HashSet::new();

        // Apply buffer transformations
        for (buf_name, fix_type, old_fmt, new_fmt, stride) in buf_tasks {
            let buf_path = ini_path.parent().unwrap_or(mod_path).join(&buf_name);
            let task_key = (buf_path.clone(), fix_type.clone());
            if seen_buf_tasks.contains(&task_key) {
                continue;
            }
            seen_buf_tasks.insert(task_key);

            if buf_path.exists() {
                if let Ok(raw_bytes) = fs::read(&buf_path) {
                    // Backup original buffer (use file stem to prevent double .buf.buf extension)
                    let stem = Path::new(&buf_name).file_stem().and_then(|s| s.to_str()).unwrap_or(&buf_name);
                    let buf_backup_name = format!("DISABLED_BACKUP_{}_{}.buf.bak", timestamp, stem);
                    let buf_backup_path = buf_path.with_file_name(&buf_backup_name);
                    let _ = fs::copy(&buf_path, &buf_backup_path);

                    let (modified_bytes, target_new_stride) = match fix_type.as_str() {
                        "remap_texcoord" => {
                            let mut ns = 0;
                            for chunk in &new_fmt {
                                ns += calc_format_chunk_size(chunk);
                            }
                            let mut os = 0;
                            for chunk in &old_fmt {
                                os += calc_format_chunk_size(chunk);
                            }
                            let effective_stride = if stride == 0 { os } else { stride };
                            (remap_buffer_bytes(&raw_bytes, effective_stride, &old_fmt, &new_fmt), if ns > 0 { Some(ns) } else { None })
                        }
                        "shrink_texcoord_color" => {
                            let effective_stride = if stride == 0 && raw_bytes.len() % 28 == 0 {
                                28
                            } else if stride == 0 && raw_bytes.len() % 16 == 0 {
                                16
                            } else {
                                stride
                            };
                            let ns = if effective_stride >= 16 { Some(effective_stride - 12) } else { None };
                            (shrink_color_buffer_bytes(&raw_bytes, effective_stride), ns)
                        }
                        "update_blend_indices" => {
                            let mut mapping = HashMap::new();
                            for (o_str, n_str) in old_fmt.iter().zip(new_fmt.iter()) {
                                if let (Ok(o), Ok(n)) = (o_str.parse::<u32>(), n_str.parse::<u32>()) {
                                    mapping.insert(o, n);
                                }
                            }
                            let effective_stride = if stride == 0 && raw_bytes.len() % 32 == 0 {
                                32
                            } else {
                                stride
                            };
                            (remap_bone_indices_buffer_bytes(&raw_bytes, effective_stride, &mapping), None)
                        }
                        _ => (raw_bytes.clone(), None),
                    };

                    if modified_bytes != raw_bytes
                        && fs::write(&buf_path, &modified_bytes).is_ok() {
                            buffers_remapped += 1;
                            modified_buf_files.push(buf_name.clone());
                            actions_summary.push(format!("Remapped binary buffer '{}' ({} format conversion)", buf_name, fix_type));

                            // Update stride in INI if the format stride changed
                            if let Some(ns) = target_new_stride {
                                if ns != stride {
                                    let (updated_ini, changed) = update_resource_stride_in_ini(&new_content, &buf_name, ns);
                                    if changed {
                                        new_content = updated_ini;
                                        ini_changed = true;
                                        actions_summary.push(format!("Updated INI resource stride for '{}': {} -> {}", buf_name, stride, ns));
                                    }
                                }
                            }
                        }
                }
            }
        }

        // Save modified INI
        if ini_changed {
            let stem = Path::new(&fname).file_stem().and_then(|s| s.to_str()).unwrap_or(&fname);
            let ini_backup_name = format!("DISABLED_BACKUP_{}_{}.ini.bak", timestamp, stem);
            let ini_backup_path = ini_path.with_file_name(&ini_backup_name);
            let _ = fs::copy(ini_path, &ini_backup_path);
            backup_created_name = Some(ini_backup_name);

            if fs::write(ini_path, new_content).is_ok() {
                modified_ini_files.push(fname);
            }
        }
    }

    let res = ModFixResult {
        mod_path: mod_path.to_string_lossy().replace('\\', "/"),
        success: true,
        backup_created: backup_created_name,
        modified_ini_files,
        modified_buf_files,
        hashes_updated,
        sections_added,
        buffers_remapped,
        indices_remapped,
        actions_summary,
        error: None,
    };

    let mod_name = mod_path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let details = if res.actions_summary.is_empty() {
        "Applied mod upgrade fixes".to_string()
    } else {
        res.actions_summary.join("; ")
    };
    let has_backup = res.backup_created.is_some();
    crate::infra::logger::log_alteration(
        "mod_fix",
        &mod_name,
        &res.mod_path,
        &details,
        res.backup_created.as_deref(),
        has_backup,
    );

    Ok(res)
}

fn find_backup_files_recursive(dir: &Path, out: &mut Vec<PathBuf>, depth: usize) {
    if depth > 10 || !dir.is_dir() {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                find_backup_files_recursive(&path, out, depth + 1);
            } else {
                let name = entry.file_name().to_string_lossy().to_string();
                if is_backup_file_name(&name) {
                    out.push(path);
                }
            }
        }
    }
}

/// Information about a single backup file discovered in a mod folder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModBackupInfo {
    pub backup_path: String,
    pub backup_file_name: String,
    pub target_file_name: String,
    pub target_path: String,
    pub created_at: Option<u64>,
    pub backup_size_bytes: u64,
    pub target_size_bytes: Option<u64>,
    pub target_exists: bool,
}

/// Result of restoring one or more selected backups
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreBackupResult {
    pub success: bool,
    pub restored_files: Vec<String>,
    pub remaining_backups_count: usize,
    pub error: Option<String>,
}

/// Resolves the destination active file, full target path, and timestamp for a backup file
pub fn resolve_backup_target_info(backup_path: &Path) -> Option<(String, PathBuf, Option<u64>)> {
    let name = backup_path.file_name()?.to_str()?;
    let parent = backup_path.parent().unwrap_or_else(|| Path::new("."));

    if name.starts_with("DISABLED_BACKUP_") {
        if let Some(caps) = BACKUP_RE.captures(name) {
            let orig_name = caps.get(1).map_or("", |m| m.as_str());
            let ext = caps.get(2).map_or("", |m| m.as_str());
            let clean_orig = if orig_name.ends_with(&format!(".{}", ext)) {
                orig_name.to_string()
            } else {
                format!("{}.{}", orig_name, ext)
            };
            let ts = name
                .strip_prefix("DISABLED_BACKUP_")
                .and_then(|s| s.split('_').next())
                .and_then(|s| s.parse::<u64>().ok());
            let target_path = parent.join(&clean_orig);
            return Some((clean_orig, target_path, ts));
        }
    } else if name.ends_with(".disabled.bak") {
        let clean_orig = name.trim_end_matches(".disabled.bak").to_string();
        let target_path = parent.join(&clean_orig);
        return Some((clean_orig, target_path, None));
    } else if name.ends_with(".ini.bak") {
        let clean_orig = name.trim_end_matches(".bak").to_string();
        let target_path = parent.join(&clean_orig);
        return Some((clean_orig, target_path, None));
    } else if name.ends_with(".buf.bak") {
        let clean_orig = name.trim_end_matches(".bak").to_string();
        let target_path = parent.join(&clean_orig);
        return Some((clean_orig, target_path, None));
    }

    None
}

/// Lists all backup files in a mod folder with metadata and target file resolution
pub fn list_mod_backups(mod_path: &Path) -> Result<Vec<ModBackupInfo>, AppError> {
    if !mod_path.exists() || !mod_path.is_dir() {
        return Err(AppError::Custom(format!("Mod path does not exist: {:?}", mod_path)));
    }

    let mut backup_paths = Vec::new();
    find_backup_files_recursive(mod_path, &mut backup_paths, 0);

    let mut results = Vec::new();
    for bp in backup_paths {
        if let Some((target_name, target_path, ts_opt)) = resolve_backup_target_info(&bp) {
            let backup_file_name = bp.file_name().unwrap_or_default().to_string_lossy().to_string();
            let backup_size_bytes = fs::metadata(&bp).map(|m| m.len()).unwrap_or(0);
            let (target_exists, target_size_bytes) = match fs::metadata(&target_path) {
                Ok(m) => (true, Some(m.len())),
                Err(_) => (false, None),
            };

            // If timestamp not in name, fall back to file modified time
            let created_at = ts_opt.or_else(|| {
                fs::metadata(&bp).ok().and_then(|m| m.modified().ok()).and_then(|t| {
                    t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
                })
            });

            results.push(ModBackupInfo {
                backup_path: bp.to_string_lossy().replace('\\', "/"),
                backup_file_name,
                target_file_name: target_name,
                target_path: target_path.to_string_lossy().replace('\\', "/"),
                created_at,
                backup_size_bytes,
                target_size_bytes,
                target_exists,
            });
        }
    }

    // Sort newest first by timestamp, then filename
    results.sort_by(|a, b| {
        b.created_at.cmp(&a.created_at)
            .then_with(|| a.target_file_name.cmp(&b.target_file_name))
    });

    Ok(results)
}

/// Restores only selected backup files into their active locations with security checks
pub fn restore_selected_mod_backups(
    mod_path: &Path,
    selected_backup_paths: &[String],
    keep_backups: bool,
) -> Result<RestoreBackupResult, AppError> {
    if !mod_path.exists() || !mod_path.is_dir() {
        return Err(AppError::Custom(format!("Mod path does not exist: {:?}", mod_path)));
    }

    let canonical_mod_path = mod_path.canonicalize().map_err(|e| {
        AppError::Custom(format!("Failed to canonicalize mod path: {}", e))
    })?;

    let mut restored_files = Vec::new();

    for bp_str in selected_backup_paths {
        let bp = PathBuf::from(bp_str);
        if !bp.exists() {
            continue;
        }

        // Security check: Path traversal prevention
        let canonical_bp = match bp.canonicalize() {
            Ok(c) => c,
            Err(_) => continue,
        };

        if !canonical_bp.starts_with(&canonical_mod_path) {
            return Err(AppError::Custom(format!(
                "Security violation: Backup path {:?} is outside mod directory {:?}",
                bp, mod_path
            )));
        }

        if let Some((target_name, target_path, _)) = resolve_backup_target_info(&canonical_bp) {
            // Ensure target directory exists
            if let Some(parent) = target_path.parent() {
                let _ = fs::create_dir_all(parent);
            }

            if fs::copy(&canonical_bp, &target_path).is_ok() {
                restored_files.push(target_name);
                if !keep_backups {
                    let _ = fs::remove_file(&canonical_bp);
                }
            }
        }
    }

    let remaining_backups = list_mod_backups(mod_path).map(|v| v.len()).unwrap_or(0);

    if !restored_files.is_empty() {
        let mod_name = mod_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        crate::infra::logger::log_alteration(
            "restore",
            &mod_name,
            &mod_path.to_string_lossy(),
            &format!(
                "Restored {} files from backup: {}",
                restored_files.len(),
                restored_files.join(", ")
            ),
            None,
            false,
        );
    }

    Ok(RestoreBackupResult {
        success: !restored_files.is_empty(),
        restored_files,
        remaining_backups_count: remaining_backups,
        error: None,
    })
}

/// Restore a mod from all its latest backup files across its directory tree
pub fn restore_mod_backup(mod_path: &Path) -> Result<bool, AppError> {
    if !mod_path.exists() || !mod_path.is_dir() {
        return Err(AppError::Custom(format!("Mod path does not exist: {:?}", mod_path)));
    }

    let backups = list_mod_backups(mod_path)?;
    if backups.is_empty() {
        return Ok(false);
    }

    let backup_paths: Vec<String> = backups.into_iter().map(|b| b.backup_path).collect();
    let res = restore_selected_mod_backups(mod_path, &backup_paths, false)?;
    Ok(res.success)
}

/// Helper to scan all mods in the Mods folder for outdated hashes
pub fn internal_batch_scan_fixable_mods(mods_dir: &Path, fixer_db: &FixerDatabase) -> Vec<ModFixAnalysis> {
    let mut results = Vec::new();
    if !mods_dir.exists() || !mods_dir.is_dir() {
        return results;
    }

    let mut category_paths: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = fs::read_dir(mods_dir) {
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
                            category_paths.push(sub_p);
                        }
                    }
                }
            } else {
                category_paths.push(p);
            }
        }
    }

    for cat_path in category_paths {
        if let Ok(mod_entries) = fs::read_dir(&cat_path) {
            for mod_entry in mod_entries.filter_map(Result::ok) {
                let mod_path = mod_entry.path();
                if !mod_path.is_dir() {
                    continue;
                }

                let analysis = analyze_mod_for_fixes(&mod_path, fixer_db);
                if analysis.is_fixable {
                    results.push(analysis);
                }
            }
        }
    }

    results
}

/// Helper to apply fixes to selected mod paths
pub fn internal_batch_apply_mod_fixes(mod_paths: &[String], fixer_db: &FixerDatabase) -> Vec<ModFixResult> {
    internal_batch_apply_mod_fixes_with_cancel(mod_paths, fixer_db, None)
}

pub fn internal_batch_apply_mod_fixes_with_cancel(
    mod_paths: &[String],
    fixer_db: &FixerDatabase,
    cancel_token: Option<&std::sync::Arc<std::sync::atomic::AtomicBool>>,
) -> Vec<ModFixResult> {
    let mut results = Vec::new();
    for p_str in mod_paths {
        if let Some(token) = cancel_token {
            if token.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }
        }
        let p = Path::new(p_str);
        match apply_mod_fix(p, fixer_db) {
            Ok(res) => results.push(res),
            Err(e) => {
                crate::infra::logger::log_error("mod_fixer", &e.to_string(), Some(p_str));
                results.push(ModFixResult {
                    mod_path: p_str.clone(),
                    success: false,
                    backup_created: None,
                    modified_ini_files: Vec::new(),
                    modified_buf_files: Vec::new(),
                    hashes_updated: 0,
                    sections_added: 0,
                    buffers_remapped: 0,
                    indices_remapped: 0,
                    actions_summary: Vec::new(),
                    error: Some(e.to_string()),
                });
            }
        }
    }
    results
}

// ---------------------------------------------------------------------------
// Tauri IPC Commands
// ---------------------------------------------------------------------------

use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn check_mod_fixable(app: AppHandle, mod_path: String) -> Result<ModFixAnalysis, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let p = Path::new(&mod_path);
    let app_db_path = app.path().app_data_dir().ok().map(|d| d.join("database.json"));
    let fixer_db = load_fixer_database(app_db_path.as_deref());
    Ok(analyze_mod_for_fixes(p, &fixer_db))
}

#[tauri::command]
pub fn fix_mod(app: AppHandle, mod_path: String) -> Result<ModFixResult, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let p = Path::new(&mod_path);
    let app_db_path = app.path().app_data_dir().ok().map(|d| d.join("database.json"));
    let fixer_db = load_fixer_database(app_db_path.as_deref());
    match apply_mod_fix(p, &fixer_db) {
        Ok(res) => Ok(res),
        Err(e) => {
            crate::infra::logger::log_error("mod_fixer", &e.to_string(), Some(&mod_path));
            Err(e)
        }
    }
}

#[tauri::command]
pub fn batch_scan_fixable_mods(app: AppHandle, mods_dir: String) -> Result<Vec<ModFixAnalysis>, AppError> {
    let mods_dir = crate::utils::expand_path(&mods_dir);
    let p = Path::new(&mods_dir);
    let app_db_path = app.path().app_data_dir().ok().map(|d| d.join("database.json"));
    let fixer_db = load_fixer_database(app_db_path.as_deref());
    Ok(internal_batch_scan_fixable_mods(p, &fixer_db))
}

#[tauri::command]
pub fn batch_fix_mods(
    app: AppHandle,
    mod_paths: Vec<String>,
    task_id: Option<String>,
) -> Result<Vec<ModFixResult>, AppError> {
    let mod_paths: Vec<String> = mod_paths.into_iter().map(|p| crate::utils::expand_path(&p)).collect();
    let t_id = task_id.unwrap_or_else(|| "fix:batch".to_string());
    let guard = crate::task_manager::register_task(&t_id, "fix");
    let cancel_token = guard.token();

    let app_db_path = app.path().app_data_dir().ok().map(|d| d.join("database.json"));
    let fixer_db = load_fixer_database(app_db_path.as_deref());
    Ok(internal_batch_apply_mod_fixes_with_cancel(&mod_paths, &fixer_db, Some(&cancel_token)))
}

#[tauri::command]
pub fn restore_mod_backup_command(mod_path: String) -> Result<bool, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let p = Path::new(&mod_path);
    restore_mod_backup(p)
}

#[tauri::command]
pub fn list_mod_backups_command(mod_path: String) -> Result<Vec<ModBackupInfo>, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let p = Path::new(&mod_path);
    list_mod_backups(p)
}

#[tauri::command]
pub fn restore_selected_mod_backups_command(
    mod_path: String,
    backup_paths: Vec<String>,
    keep_backups: bool,
) -> Result<RestoreBackupResult, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let p = Path::new(&mod_path);
    restore_selected_mod_backups(p, &backup_paths, keep_backups)
}

#[cfg(test)]
#[path = "mod_fixer_tests.rs"]
mod tests;
