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
use crate::services::component_split;

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
    // Check if target is a legacy Jane head hash that was rerouted to Hands (294a319a)
    if matches!(target.as_str(), "9268a5af" | "7b16a708") && mod_hashes.contains("294a319a") {
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
        // 3DMigoto excludes DISABLED* from its recursive include, so these are inert
        // reference copies. Fixing them changes nothing in game and their diagnostics are
        // misleading - a stale DISABLED copy reports failures the live INI never had.
        if fname.starts_with("zzzmanager_ui_")
            || fname.starts_with("000_zzzmanager_ui_")
            || fname.to_uppercase().starts_with("DISABLED")
            || fname.ends_with(".bak")
        {
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
        // 3DMigoto excludes DISABLED* from its recursive include, so these are inert
        // reference copies. Fixing them changes nothing in game and their diagnostics are
        // misleading - a stale DISABLED copy reports failures the live INI never had.
        if fname.starts_with("zzzmanager_ui_")
            || fname.starts_with("000_zzzmanager_ui_")
            || fname.to_uppercase().starts_with("DISABLED")
            || fname.ends_with(".bak")
        {
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

            let is_jane = detected_char.as_ref().is_some_and(|dc| is_character_match(dc, "JaneDoe"));
            let jane_hijacked = is_jane && is_jane_head_hijacked(&content);

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
                                let mut target_hash = if terminal_hash != hash.to_lowercase() {
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

                                let mut display_desc = if family_matches {
                                    rule.description.clone()
                                } else {
                                    format!("{} Shared Texture ({})", display_char, rule.description)
                                };

                                if jane_hijacked {
                                    if let Some(hands_h) = get_jane_hands_reroute_hash_guarded(&content, hash) {
                                        target_hash = hands_h.to_string();
                                        display_desc = format!("{} (Rerouted to Hands & Accessories)", display_desc);
                                    }
                                } else if let Some((old_h, new_h, face_char)) = find_universal_face_rule(hash) {
                                    if hash.eq_ignore_ascii_case(old_h) {
                                        target_hash = new_h.to_string();
                                        display_desc = format!("{} Face Texcoord (3.2 upgrade)", face_char);
                                    }
                                }

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
                                // When Jane Doe's head was hijacked for clothing/arms, the mod is an outfit mod, not a hair mod.
                                // Never inject Jane.Hair.IB or multiply hair textures for a hijacked mod!
                                if jane_hijacked && action.section_title.as_ref().is_some_and(|t| t.to_lowercase().contains("hair")) {
                                    continue;
                                }
                                if let Some(ref equivs) = action.equiv_hashes {
                                    let mod_hash_set: HashSet<String> = sorted_hashes.iter().map(|h| h.to_lowercase()).collect();
                                    let has_any = equivs.iter().any(|eq| is_equiv_hash_satisfied(eq, &mod_hash_set, fixer_db));
                                    if !has_any && !equivs.is_empty() {
                                        let (target_eq, _) = resolve_terminal_hash(&equivs[0], fixer_db);
                                        let title = action.section_title.clone().unwrap_or_default();

                                        let sec_tag = format!("[TextureOverride{}]", title);
                                        let sec_tag_no_dots = format!("[TextureOverride{}]", title.replace('.', ""));
                                        let content_lower = content.to_lowercase();
                                        if content_lower.contains(&sec_tag.to_lowercase())
                                            || content_lower.contains(&sec_tag_no_dots.to_lowercase())
                                            || mod_hash_set.contains(&target_eq.to_lowercase()) {
                                            continue;
                                        }

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
                                // If Jane Doe: only propose update_blend_indices if the mod actually contains legacy head/blend hashes
                                if is_jane {
                                    let has_legacy_head = sorted_hashes.iter().any(|h| {
                                        matches!(
                                            h.to_lowercase().as_str(),
                                            "9268a5af" | "7b16a708" | "e7a3b7dc" | "24323bf9" | "8721477f" | "0a10c747"
                                        )
                                    });
                                    if !has_legacy_head {
                                        continue;
                                    }
                                }
                                let old_count = action.old_indices.as_ref().map(|v| v.len()).unwrap_or(0);
                                let desc = if is_jane {
                                    if jane_hijacked {
                                        "Remapped 2.5+ Hands bone indices (HAND_MAPPINGS)".to_string()
                                    } else {
                                        "Remapped 2.5+ Hair bone indices (HAIR_MAPPINGS)".to_string()
                                    }
                                } else {
                                    "Remapped 3.0 skeleton bone indices".to_string()
                                };
                                let item = BufferFixDetail {
                                    buffer_filename: format!("vb2 Blend Buffer ({})", rule.character),
                                    fix_type: "update_blend_indices".to_string(),
                                    old_format: format!("{} legacy bone indices", old_count),
                                    new_format: desc,
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

            // Auto-detect Jane Doe blend buffer bone remapping if not already in buffer_fixes
            if is_jane {
                let has_legacy_head = sorted_hashes.iter().any(|h| {
                    matches!(
                        h.to_lowercase().as_str(),
                        "9268a5af" | "7b16a708" | "e7a3b7dc" | "24323bf9" | "8721477f" | "0a10c747"
                    )
                });
                if has_legacy_head {
                    let all_vb2 = find_all_slot_buffers(&content, "vb2");
                    let comp_type = if jane_hijacked { "hands" } else { "hair" };
                    let safe_vb2 = filter_safe_blend_buffers_for_component(&all_vb2, comp_type);
                    for (b_name, _) in safe_vb2 {
                        let item = BufferFixDetail {
                            buffer_filename: format!("vb2 Blend Buffer (JaneDoe - {})", b_name),
                            fix_type: "update_blend_indices".to_string(),
                            old_format: "Jane Doe legacy 1.4 skeleton bone indices".to_string(),
                            new_format: if jane_hijacked {
                                "Remapped 2.5+ Hands bone indices (HAND_MAPPINGS)".to_string()
                            } else {
                                "Remapped 2.5+ Hair bone indices (HAIR_MAPPINGS)".to_string()
                            },
                        };
                        if !buffer_fixes.contains(&item) {
                            buffer_fixes.push(item);
                        }
                    }
                }
            }

            // Auto-detect Dialyn blend buffer bone remapping if not already in buffer_fixes
            if detected_char.as_ref().is_some_and(|dc| is_character_match(dc, "Dialyn")) {
                let has_legacy_dialyn = sorted_hashes.iter().any(|h| {
                    matches!(h.to_lowercase().as_str(), "3d7e53cf" | "ff36809b")
                });
                if has_legacy_dialyn {
                    let all_vb2 = find_all_slot_buffers(&content, "vb2");
                    let safe_vb2 = filter_safe_blend_buffers_for_component(&all_vb2, "dialyn");
                    for (b_name, _) in safe_vb2 {
                        let item = BufferFixDetail {
                            buffer_filename: format!("vb2 Blend Buffer (Dialyn - {})", b_name),
                            fix_type: "update_blend_indices".to_string(),
                            old_format: "Dialyn legacy skeleton bone indices".to_string(),
                            new_format: "Remapped 3.0+ Dialyn bone indices".to_string(),
                        };
                        if !buffer_fixes.contains(&item) {
                            buffer_fixes.push(item);
                        }
                    }
                }
            }

            // Auto-detect Universal Face 3.1 -> 3.2 texcoord format upgrade
            for hash in &sorted_hashes {
                if let Some((old_h, new_h, face_char)) = find_universal_face_rule(hash) {
                    let mut vb1_bufs = find_referenced_buffers(&content, old_h, "vb1");
                    if vb1_bufs.is_empty() {
                        vb1_bufs = find_referenced_buffers(&content, new_h, "vb1");
                    }
                    if vb1_bufs.is_empty() {
                        vb1_bufs = find_referenced_buffers(&content, hash, "vb1");
                    }
                    for (buf_file, stride) in vb1_bufs {
                        let buf_path = ini_path.parent().unwrap_or(mod_path).join(&buf_file);
                        let needs_remap = if buf_path.exists() {
                            if let Ok(meta) = fs::metadata(&buf_path) {
                                let len = meta.len() as usize;
                                len > 0 && len % 36 == 0 && len % 48 != 0
                            } else {
                                stride == 36
                            }
                        } else {
                            stride == 36
                        };
                        if needs_remap {
                            let item = BufferFixDetail {
                                buffer_filename: format!("vb1 Face Texcoord ({})", buf_file),
                                fix_type: "remap_texcoord".to_string(),
                                old_format: "4B,2f,2f,2f,2f (36-byte)".to_string(),
                                new_format: format!("4f,2f,2f,2f,2f (48-byte) - {} Face", face_char),
                            };
                            if !buffer_fixes.contains(&item) {
                                buffer_fixes.push(item);
                            }
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
        // 3DMigoto excludes DISABLED* from its recursive include, so these are inert
        // reference copies. Fixing them changes nothing in game and their diagnostics are
        // misleading - a stale DISABLED copy reports failures the live INI never had.
        if fname.starts_with("zzzmanager_ui_")
            || fname.starts_with("000_zzzmanager_ui_")
            || fname.to_uppercase().starts_with("DISABLED")
            || fname.ends_with(".bak")
        {
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

/// Find all buffer filenames referenced in any section using target_slot (e.g. "vb2")
pub fn find_all_slot_buffers(ini_content: &str, target_slot: &str) -> Vec<(String, usize)> {
    let sections = parse_ini_sections(ini_content);
    let target_slot_lower = target_slot.to_lowercase();
    let mut resource_names = HashSet::new();

    for sec in &sections {
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
                }
            }
        }
    }

    let mut results = Vec::new();
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

/// Ensures that any TextureOverride section containing an `ib = ` or `drawindexed` call has `handling = skip`.
/// Missing `handling = skip` causes 3DMigoto to pass through the original draw call to DirectX,
/// rendering the vanilla character and modded character simultaneously (double-render).
pub fn ensure_handling_skip_on_draw_sections(ini_content: &str) -> (String, usize) {
    let mut lines: Vec<String> = ini_content.lines().map(|l| l.to_string()).collect();
    let mut section_ranges: Vec<(usize, usize, String)> = Vec::new();
    let mut cur_header = None;
    let mut cur_start = 0;

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            if let Some(h) = cur_header {
                section_ranges.push((cur_start, i, h));
            }
            cur_header = Some(trimmed[1..trimmed.len() - 1].trim().to_string());
            cur_start = i;
        }
    }
    if let Some(h) = cur_header {
        section_ranges.push((cur_start, lines.len(), h));
    }

    let mut inserts: Vec<(usize, String)> = Vec::new();
    let mut count = 0;

    for (start, end, header) in section_ranges {
        if !header.to_lowercase().starts_with("textureoverride") {
            continue;
        }

        let sec_slice = &lines[start..end];
        let has_draw_or_ib = sec_slice.iter().any(|l| {
            let clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            if let Some((k, _)) = clean.split_once('=') {
                let kt = k.trim().to_lowercase();
                kt == "ib" || kt == "drawindexed" || kt == "draw"
            } else {
                let cl = clean.to_lowercase();
                cl.starts_with("drawindexed") || cl.starts_with("draw")
            }
        });

        let has_handling_skip = sec_slice.iter().any(|l| {
            let clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            if let Some((k, v)) = clean.split_once('=') {
                k.trim().eq_ignore_ascii_case("handling") && v.trim().eq_ignore_ascii_case("skip")
            } else {
                false
            }
        });

        if has_draw_or_ib && !has_handling_skip {
            let mut insert_idx = None;
            for (idx, l) in sec_slice.iter().enumerate() {
                let clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
                if let Some((k, _)) = clean.split_once('=') {
                    if k.trim().eq_ignore_ascii_case("hash") {
                        insert_idx = Some(start + idx + 1);
                        break;
                    }
                }
            }
            let target_line = insert_idx.unwrap_or(start + 1);
            inserts.push((target_line, "handling = skip".to_string()));
            count += 1;
        }
    }

    if inserts.is_empty() {
        return (ini_content.to_string(), 0);
    }

    inserts.sort_by(|a, b| b.0.cmp(&a.0));
    for (idx, text) in inserts {
        lines.insert(idx, text);
    }

    (lines.join("\r\n"), count)
}

/// 53 Universal Face Meshes in ZZZ that transitioned from 4B to 4f COLOR format (stride 36 -> 48)
pub static UNIVERSAL_FACE_3_2_HASHES: &[(&str, &str, &str)] = &[
    ("014159dd", "287c161c", "YeShunguangSkin"),
    ("01b43c04", "ffac76ac", "AstraYao"),
    ("02426764", "2e04aac2", "Yixuan"),
    ("0749a6d7", "7c9dbd4a", "Alice"),
    ("0aacc89a", "99d2733a", "Hugo"),
    ("1132301e", "d4a12ab7", "Trigger"),
    ("20095c2e", "48152e31", "Harumasa"),
    ("27fd9193", "d90368ed", "Dialyn"),
    ("2bc69f3c", "dfc76798", "Cissia"),
    ("2bcb59f6", "a0dfaf80", "Seed"),
    ("2fe49591", "58468aba", "Piper"),
    ("31df6120", "d5958556", "Nicole"),
    ("325bb10f", "0fd41a37", "Manato"),
    ("37a09c33", "9d0f7ef5", "Yuzuha"),
    ("3e7815b5", "f818271a", "Anby"),
    ("40cdb80f", "08316415", "Yidhari"),
    ("43cb221f", "9648c6d3", "Lucia"),
    ("50c5d703", "0afe5a44", "Vivian"),
    ("558c7001", "144828a7", "Anton"),
    ("57994826", "f41b27e6", "Koleda"),
    ("60732ab5", "7a476f86", "MiyabiSkin"),
    ("615a1f62", "48191f72", "Orphie"),
    ("61782f72", "14b70725", "Burnice"),
    ("63481380", "c3b7516b", "Grace"),
    ("644e5029", "d3d65ca5", "Promeia"),
    ("731a54ff", "d68e27c1", "Corin"),
    ("74ea3d75", "11f5d81b", "Pulchra"),
    ("79b29cb1", "9e3c9d74", "Caesar"),
    ("7c53d0fd", "d38d3862", "Ben"),
    ("7cd06c1a", "e9f8263f", "Seth"),
    ("7e7eb188", "da3a8174", "PanYinlin"),
    ("845a7b68", "fc6c8a74", "Soldier11"),
    ("89df8e16", "2b31a89c", "Soukaku"),
    ("90263f13", "0ae87295", "Ellen"),
    ("95bc72aa", "99763ca7", "ZhuYuan"),
    ("a37ea81f", "38df753b", "Billy"),
    ("a6a5789f", "6aa1d624", "Nekomata"),
    ("a8904724", "e7658dc7", "Qingyi"),
    ("ade78e5f", "f0e74f07", "Lycaon"),
    ("af36c071", "6814c8ec", "Lucy"),
    ("b64267d6", "e4125d03", "Rina"),
    ("b7837b2d", "a01a3ca5", "Miyabi"),
    ("bc54c000", "5c80e1ec", "BurniceSkin"),
    ("c12ea84b", "273a7d45", "Bao"),
    ("c5391d3e", "8627bc89", "EllenSkin"),
    ("c7c6cfb4", "ef316f73", "JaneDoe"),
    ("c8d1fc42", "e826b528", "Sunna"),
    ("cf0897b2", "d9ffc71d", "Lighter"),
    ("d5d05051", "f516a247", "Yanagi"),
    ("dd5cb465", "f08eb010", "JuFubuki"),
    ("e467d0a9", "406089bf", "Evelyn"),
    ("f62f01f0", "7963d33e", "General"),
    ("fcf0e4fe", "855c8eb3", "AstraYaoSkin"),
];

/// Returns the (old_3_1_hash, new_3_2_hash, character) entry if hash is a known face mesh
pub fn find_universal_face_rule(hash: &str) -> Option<(&'static str, &'static str, &'static str)> {
    let h_lower = hash.to_lowercase();
    UNIVERSAL_FACE_3_2_HASHES.iter().copied().find(|(old_h, new_h, _)| {
        old_h.eq_ignore_ascii_case(&h_lower) || new_h.eq_ignore_ascii_case(&h_lower)
    })
}

/// Inspects an INI file to detect if Jane Doe's legacy Head/Hair draw call
/// was hijacked to render arms, jacket, pouches, gloves, sleeves, or accessories
/// (a common workaround in ZZZ 1.0-1.4 because vanilla lacked a dedicated Hands slot).
pub fn is_jane_head_hijacked(ini_content: &str) -> bool {
    let lower = ini_content.to_lowercase();

    // 1. Direct clue: Binding Body textures (diffuse, normal, lightmap) into Head/Hair sections
    if lower.contains("resourcejanedoebodyanormalmap")
        || lower.contains("resourcejanedoebodyadiffuse")
        || (lower.contains("head") && lower.contains("bodyadiffuse"))
        || (lower.contains("head") && lower.contains("bodyanormal"))
    {
        return true;
    }

    // 2. Submesh / section inspection for clothing & limb keywords in Head sections
    let sections = parse_ini_sections(ini_content);
    for sec in &sections {
        let sec_name = sec.header.to_lowercase();
        let is_head_sec = sec_name.contains("head") || sec_name.contains("hair");
        let has_legacy_head_hash = sec.get_hash().as_deref().map_or(false, |h| {
            matches!(
                h,
                "9268a5af"
                    | "7b16a708"
                    | "e7a3b7dc"
                    | "24323bf9"
                    | "8721477f"
                    | "0a10c747"
                    | "acec29f8"
                    | "257a90d6"
                    | "2d06e785"
                    | "5721e4e7"
            )
        });

        if is_head_sec || has_legacy_head_hash {
            for line in &sec.lines {
                let l = line.to_lowercase();
                if l.contains("arm")
                    || l.contains("jacket")
                    || l.contains("glove")
                    || l.contains("sleeve")
                    || l.contains("pouch")
                    || l.contains("tie")
                    || l.contains("bodyanormal")
                    || l.contains("bodyadiffuse")
                {
                    return true;
                }
            }
        }
    }

    false
}

/// Reroutes legacy Jane Doe Head/Hair hashes to modern Hands & Accessories hashes
/// when the Head draw call was hijacked to render limbs/clothing.
pub fn get_jane_hands_reroute_hash(legacy_hash: &str) -> Option<&'static str> {
    match legacy_hash.to_lowercase().as_str() {
        "9268a5af" | "7b16a708" => Some("294a319a"), // IB -> Hands IB
        "e7a3b7dc" | "24323bf9" => Some("82e7c056"), // Position VB -> Hands Position VB
        "acec29f8" | "257a90d6" => Some("6d482e21"), // Texcoord VB -> Hands Texcoord VB
        "8721477f" | "0a10c747" => Some("d06a9206"), // Blend VB -> Hands Blend VB
        "2d06e785" | "5721e4e7" => Some("2b5dc947"), // Draw / VertexLimitRaise VB -> Hands Draw VB
        _ => None,
    }
}

/// Returns true when `hash`'s own section defines a standalone modern render pass: a plain
/// (non-indexed) `draw =` call gated behind `if DRAW_TYPE == 1` (the standard 3DMigoto idiom
/// restricting a full custom mesh replacement to the main color pass, so it doesn't fire during
/// shadow/depth prepasses). Full-body-rework mods often reuse the SAME legacy Head/Hair hash
/// family for two unrelated things at once: a genuine, self-contained modern Hair mesh (this
/// signal) AND a truly hijacked IB elsewhere in the file that repurposes that hair's underlying
/// vertex buffer via `drawindexed` subsets to render hands/gloves/accessories. Those two must not
/// share one hijack verdict, or the genuine hair gets rerouted/bone-remapped as if it were hands.
fn jane_hash_has_standalone_draw_type_gate(ini_content: &str, hash: &str) -> bool {
    let target = hash.to_lowercase();
    parse_ini_sections(ini_content).iter().any(|sec| {
        sec.get_hash().as_deref() == Some(target.as_str())
            && sec.lines.iter().any(|l| {
                let compact = l.trim().to_lowercase().replace(' ', "");
                compact.starts_with("if") && compact.contains("draw_type==1")
            })
    })
}

/// Family of Jane Doe Hair Blend/Position/Texcoord/VertexLimitRaise hashes that
/// `get_jane_hands_reroute_hash` reroutes to Hands & Accessories when hijacked.
const JANE_HAIR_BLEND_FAMILY_HASHES: [&str; 8] = [
    "8721477f", "0a10c747", "e7a3b7dc", "24323bf9", "acec29f8", "257a90d6", "2d06e785", "5721e4e7",
];

/// Guards `get_jane_hands_reroute_hash` against rerouting a hash whose Hair Blend/Position/
/// Texcoord/VertexLimitRaise family has its own standalone modern Hair render pass elsewhere in
/// the same file (see `jane_has_standalone_hair_blend`). The `if DRAW_TYPE == 1` gate typically
/// lives only in the Blend section itself, not in its sibling Position/Texcoord/VertexLimitRaise
/// sections — so the whole family must share one verdict, or siblings would still be misrouted
/// even after the Blend hash is correctly protected.
fn get_jane_hands_reroute_hash_guarded(ini_content: &str, hash: &str) -> Option<&'static str> {
    let h_lower = hash.to_lowercase();
    if JANE_HAIR_BLEND_FAMILY_HASHES.iter().any(|fam| fam.eq_ignore_ascii_case(&h_lower))
        && jane_has_standalone_hair_blend(ini_content)
    {
        return None;
    }
    get_jane_hands_reroute_hash(hash)
}

/// Returns true if any hash in the Hair Blend/Position/Texcoord/VertexLimitRaise family has its
/// own standalone modern Hair render pass in this INI (see `jane_hash_has_standalone_draw_type_gate`).
/// When true, the shared vb2 blend buffer must use Hair bone mappings, not Hands, even though the
/// file also contains a genuinely hijacked IB elsewhere.
fn jane_has_standalone_hair_blend(ini_content: &str) -> bool {
    JANE_HAIR_BLEND_FAMILY_HASHES
        .iter()
        .any(|h| jane_hash_has_standalone_draw_type_gate(ini_content, h))
}

/// Classifies a Jane Doe hijacked drawindexed sub-range's preceding comment as targeting genuine
/// hair geometry (as opposed to hand/glove/clothing), using the same descriptive labels modders
/// leave on these draw calls (mirroring `decompose_jane_hijacked_limbs`'s ".ArmsHEAD"/"JacketHEAD"
/// style). Word-boundary matched to avoid substring false positives (e.g. "wear" must not match "ear").
fn jane_comment_labels_hair(comment: &str) -> bool {
    comment
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .any(|w| {
            w.contains("hair") || w.starts_with("pigtail") || w.starts_with("ponytail") || w.starts_with("bang") || w.starts_with("fring") || w == "ear" || w == "ears"
        })
}

/// Reads raw vertex indices from a 3DMigoto index buffer (.ib) file for the
/// [start_index, start_index + count) range, honoring the declared index format.
fn read_ib_index_range(ib_path: &Path, format: &str, start_index: usize, count: usize) -> Vec<u32> {
    let Ok(bytes) = fs::read(ib_path) else {
        return Vec::new();
    };
    let index_size = if format.to_uppercase().contains("R16") { 2usize } else { 4usize };
    let mut out = Vec::with_capacity(count);
    for i in 0..count {
        let offset = (start_index + i) * index_size;
        if offset + index_size > bytes.len() {
            break;
        }
        let value = if index_size == 2 {
            u16::from_le_bytes([bytes[offset], bytes[offset + 1]]) as u32
        } else {
            u32::from_le_bytes([bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]])
        };
        out.push(value);
    }
    out
}

/// For a Jane Doe mod whose hijacked IB hash (9268a5af/7b16a708) mixes genuine hair-strand
/// drawindexed subsets with hand/clothing subsets against a SHARED vertex/blend buffer, scans
/// every drawindexed line's preceding comment inside sections using that hash to classify each
/// sub-range, then resolves that section's own `ib =` resource to read the actual vertex indices
/// each hair-labeled range touches. Returns the vertex indices that must keep Hair bone mappings
/// instead of the Hand mappings applied to the rest of the shared buffer. `base_dir` is the
/// directory the INI's own relative resource paths resolve against.
fn collect_jane_hijacked_hair_vertex_indices(base_dir: &Path, ini_content: &str) -> HashSet<u32> {
    let mut hair_vertices = HashSet::new();
    let sections = parse_ini_sections(ini_content);

    // Resource name -> (filename, format)
    let mut resource_ib: HashMap<String, (String, String)> = HashMap::new();
    for sec in &sections {
        if !sec.header.to_lowercase().starts_with("resource") {
            continue;
        }
        let mut filename = None;
        let mut format = String::new();
        for l in &sec.lines {
            let clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            if let Some((k, v)) = clean.split_once('=') {
                let k_l = k.trim().to_lowercase();
                let v_t = v.trim().trim_matches('"');
                if k_l == "filename" {
                    filename = Some(v_t.trim_start_matches(".\\").trim_start_matches("./").to_string());
                } else if k_l == "format" {
                    format = v_t.to_string();
                }
            }
        }
        if let Some(f) = filename {
            resource_ib.insert(sec.header.clone(), (f, format));
        }
    }

    for sec in &sections {
        let hash_matches = sec.get_hash().as_deref().is_some_and(|h| matches!(h, "9268a5af" | "7b16a708"));
        if !hash_matches {
            continue;
        }

        let mut ib_resource = None;
        for l in &sec.lines {
            let clean = l.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            if let Some((k, v)) = clean.split_once('=') {
                if k.trim().eq_ignore_ascii_case("ib") {
                    ib_resource = Some(v.trim().to_string());
                }
            }
        }
        let Some(ib_res) = ib_resource else { continue };
        let Some((filename, format)) = resource_ib.iter().find_map(|(name, val)| {
            if name.eq_ignore_ascii_case(&ib_res) || (name.len() > 8 && name.starts_with("Resource") && name[8..].eq_ignore_ascii_case(&ib_res)) {
                Some(val.clone())
            } else {
                None
            }
        }) else {
            continue;
        };

        let ib_path = base_dir.join(&filename);

        // Walk lines, tracking whether the most recent comment labels the next drawindexed as hair.
        let mut pending_is_hair = false;
        for l in &sec.lines {
            let trimmed = l.trim();
            if trimmed.starts_with(';') {
                let comment_text = trimmed.trim_start_matches(';').trim();
                if !comment_text.is_empty() {
                    pending_is_hair = jane_comment_labels_hair(comment_text);
                }
                continue;
            }
            let lower = trimmed.to_lowercase();
            if let Some(rest) = lower.strip_prefix("drawindexed") {
                if pending_is_hair {
                    let after_eq = rest.trim_start().trim_start_matches('=');
                    let parts: Vec<&str> = after_eq.split(',').map(|p| p.trim()).collect();
                    if parts.len() >= 2 {
                        if let (Ok(count), Ok(start)) = (parts[0].parse::<usize>(), parts[1].parse::<usize>()) {
                            for v in read_ib_index_range(&ib_path, &format, start, count) {
                                hair_vertices.insert(v);
                            }
                        }
                    }
                }
                pending_is_hair = false;
            }
        }
    }

    hair_vertices
}

/// Filters blend buffer candidate files to protect unaffected character components
/// (e.g. prevent Body or Knives/Boots blend buffers from being corrupted with Hair or Hand bone mappings).
pub fn filter_safe_blend_buffers_for_component(
    buffers: &[(String, usize)],
    component_type: &str,
) -> Vec<(String, usize)> {
    buffers
        .iter()
        .filter(|(name, _)| {
            let n = name.to_lowercase();
            // Never corrupt body or knives/boots with hair or hand mappings
            if (component_type == "hair" || component_type == "hands")
                && (n.contains("body") || n.contains("knife") || n.contains("knives") || n.contains("boot"))
            {
                return false;
            }
            if component_type == "hair" && n.contains("hand") {
                return false;
            }
            true
        })
        .cloned()
        .collect()
}

/// Decomposes composite Jane Doe Head draw calls (which packed Hair + Forearms/Hands into a 27,420-index block)
/// into distinct limb submeshes while suppressing the duplicate vanilla hair.
/// In 2.5+, vanilla hair is rendered natively in the dedicated Hair slot (3275b812).
/// Extracting the 3 limb submeshes ensures forearms, wrists, and hands are preserved without missing middle arms or duplicate hair.
pub fn decompose_jane_hijacked_limbs(ini_content: &str) -> (String, bool) {
    let mut changed = false;
    let mut out = ini_content.to_string();

    // 1. Match the 27,420 composite draw call (whether raw or previously commented out)
    static DECOMPOSE_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?im)^([ \t]*)(?:;\s*\[ZZZMODMANAGER[^\]]*\]\s*)?drawindexed\s*=\s*27420\s*,\s*(\d+)\s*,\s*(\d+)[^\r\n]*").expect("Valid regex")
    });

    // This whole 27,420-index composite draw layout (rule 1), its accompanying 1,626-index
    // "duplicate ears" draw (rule 2), and its 17,929-vertex buffer (rule 3) are all hardcoded
    // fingerprints of ONE specific hijacked mod layout. Full-body-rework mods with a different
    // draw-call layout (many small toggle-conditional drawindexed calls instead of one composite
    // block) must not have rules 2/3 applied to them just because they also happen to contain an
    // unrelated "drawindexed = 1626" or a VertexLimitRaise section on a shared hash — that would
    // delete legitimate content (e.g. a real short-hair toggle) or corrupt an unrelated buffer's
    // vertex count. Rules 2 and 3 therefore only run once rule 1's signature layout is confirmed
    // present (or was already decomposed in a previous pass).
    let composite_layout_present = DECOMPOSE_RE.is_match(&out) || out.contains("ZZZMODMANAGER DECOMPOSED JANE DOE LIMBS");

    if DECOMPOSE_RE.is_match(&out) {
        out = DECOMPOSE_RE.replace(&out, |caps: &regex::Captures| {
            changed = true;
            let indent = &caps[1];
            let offset = caps[2].parse::<usize>().unwrap_or(34170);
            let inst = &caps[3];
            let p1 = offset + 864;   // Glove details (1,188 indices)
            let p2 = offset + 8859;  // Wrists & Hands (4,527 indices)
            let p3 = offset + 22647; // Forearms (4,773 indices - connects to .ArmsHEAD)
            format!(
                "{indent}; [ZZZMODMANAGER DECOMPOSED JANE DOE LIMBS / SUPPRESSED DUPLICATE VANILLA HAIR]\r\n\
                 {indent}drawindexed = 1188, {p1}, {inst}\r\n\
                 {indent}drawindexed = 4527, {p2}, {inst}\r\n\
                 {indent}drawindexed = 4773, {p3}, {inst}",
                indent = indent,
                p1 = p1,
                p2 = p2,
                p3 = p3,
                inst = inst
            )
        }).to_string();
    }

    // 2. Suppress legacy mouse ears in HeadB (1,626 indices) since 2.5 Hair slot renders ears natively
    static JANE_EARS_DRAW_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?im)^([ \t]*)(drawindexed\s*=\s*1626\b[^\r\n]*)").expect("Valid regex")
    });
    if composite_layout_present && JANE_EARS_DRAW_RE.is_match(&out) {
        out = JANE_EARS_DRAW_RE
            .replace_all(&out, |caps: &regex::Captures| {
                changed = true;
                format!("{}handling = skip\r\n{}; [ZZZMODMANAGER SUPPRESSED DUPLICATE VANILLA EARS] {}", &caps[1], &caps[1], &caps[2])
            })
            .to_string();
    }

    // 3. Ensure VertexLimitRaise on the modern Hands draw hash (2b5dc947) accommodates the 17,929 vertex mod buffer
    static VLR_SEC_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?im)(\[TextureOverride[^\]]*HeadVertexLimitRaise\]\s*(?:\r?\n\s*;[^\r\n]*)*\s*hash\s*=\s*(?:2b5dc947|2d06e785))").expect("Valid regex")
    });
    if composite_layout_present && !out.contains("override_vertex_count = 17929") && VLR_SEC_RE.is_match(&out) {
        out = VLR_SEC_RE.replace(&out, |caps: &regex::Captures| {
            changed = true;
            format!("{}\r\noverride_vertex_count = 17929\r\noverride_byte_stride = 40", &caps[1])
        }).to_string();
    }

    (out, changed)
}

/// Backward compatibility wrapper for decompose_jane_hijacked_limbs
pub fn suppress_jane_head_duplicate_hair(ini_content: &str) -> (String, usize) {
    let (res, changed) = decompose_jane_hijacked_limbs(ini_content);
    (res, if changed { 1 } else { 0 })
}

/// Injects modern submesh suppression blocks and LoDs for characters where newer game versions
/// split secondary components or require LoD handling (e.g. Belle's Legs, Hairpin, BodyB, and Jane Doe's LoDs).
pub fn ensure_character_suppressions(ini_content: &str, character: &str) -> (String, usize) {
    let mut out = ini_content.to_string();
    let mut added = 0;

    if is_character_match(character, "Belle") {
        let content_lower = out.to_lowercase();
        let suppressions: &[(&str, &str, Option<&str>)] = &[
            ("BelleLegs", "e6afd8d1", None),
            ("BelleEarrings", "07920753", None),
            ("BelleHairpin", "3acf9aea", None),
            ("BelleBodyB", "c2b4ce3a", Some("match_first_index = 31275")),
        ];

        for (name, hash, extra) in suppressions {
            let hash_present = content_lower.contains(hash);
            let should_inject = match extra {
                Some(ex) => !content_lower.contains(&ex.to_lowercase()),
                None => !hash_present,
            };

            if should_inject {
                let extra_line = extra.map(|e| format!("{}\r\n", e)).unwrap_or_default();
                let block = format!(
                    "\r\n\r\n; [ZZZMODMANAGER AUTO-GENERATED VANILLA COMPONENT SUPPRESSION]\r\n[TextureOverride{}]\r\nhash = {}\r\n{}handling = skip",
                    name, hash, extra_line
                );
                out.push_str(&block);
                added += 1;
            }
        }
    } else if is_character_match(character, "JaneDoe") || is_character_match(character, "Jane") {
        let content_lower = out.to_lowercase();
        let has_body = content_lower.contains("ba4255a5") || content_lower.contains("10050266") || content_lower.contains("e27f398e");
        let has_hands = content_lower.contains("294a319a") || content_lower.contains("82e7c056") || content_lower.contains("d06a9206") || is_jane_head_hijacked(&out);

        if has_body {
            if !content_lower.contains("58e88ad0") {
                out.push_str("\r\n\r\n; [ZZZMODMANAGER AUTO-GENERATED JANE DOE LOD OVERRIDE]\r\n[TextureOverrideJaneLoDBodyBlend]\r\nhash = 58e88ad0\r\nhandling = skip");
                added += 1;
            }
            if !content_lower.contains("341b1f7b") {
                out.push_str("\r\n\r\n; [ZZZMODMANAGER AUTO-GENERATED JANE DOE LOD OVERRIDE]\r\n[TextureOverrideJaneLoDBodyIB]\r\nhash = 341b1f7b\r\nhandling = skip");
                added += 1;
            }
        }

        if has_hands {
            if !content_lower.contains("4c54eb77") {
                out.push_str("\r\n\r\n; [ZZZMODMANAGER AUTO-GENERATED JANE DOE LOD OVERRIDE]\r\n[TextureOverrideJaneLoDHandsBlend]\r\nhash = 4c54eb77\r\nhandling = skip");
                added += 1;
            }
            if !content_lower.contains("07888ddb") {
                out.push_str("\r\n\r\n; [ZZZMODMANAGER AUTO-GENERATED JANE DOE LOD OVERRIDE]\r\n[TextureOverrideJaneLoDHandsIB]\r\nhash = 07888ddb\r\nhandling = skip");
                added += 1;
            }
        }
    }

    (out, added)
}

/// Alias for ensure_character_suppressions to express both LoD and suppression injection semantics
pub fn ensure_character_lods_and_suppressions(ini_content: &str, character: &str) -> (String, usize) {
    ensure_character_suppressions(ini_content, character)
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

    // Compare by file name only. A resource may point into a subfolder
    // (`filename = Buffer/Foo.buf`), and callers pass the bare name - matching the whole
    // declared path silently skipped those mods, leaving a rewritten buffer described by its
    // old stride. 3DMigoto then reads every vertex from the wrong offset, drifting further
    // the deeper into the buffer it gets, which renders as scrambled UVs.
    let base_name = |v: &str| -> String {
        v.rsplit(['/', '\\']).next().unwrap_or(v).to_lowercase()
    };
    let buf_lower = base_name(buf_filename);
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
                if k_t.eq_ignore_ascii_case("filename") && base_name(clean_v) == buf_lower {
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

/// Remaps vb2 blend buffer bone indices per-vertex: `hair_mappings` for vertices whose index is in
/// `hair_vertex_indices`, `default_mappings` for every other vertex. Used when a single shared
/// buffer mixes genuine hair geometry with hijacked hand/clothing geometry (see
/// `collect_jane_hijacked_hair_vertex_indices`) and a uniform, whole-buffer mapping choice would
/// corrupt one side or the other.
pub fn remap_bone_indices_buffer_bytes_mixed(
    buffer: &[u8],
    stride: usize,
    default_mappings: &HashMap<u32, u32>,
    hair_mappings: &HashMap<u32, u32>,
    hair_vertex_indices: &HashSet<u32>,
) -> Vec<u8> {
    if stride < 32 || !buffer.len().is_multiple_of(stride) {
        return buffer.to_vec();
    }
    let vertex_count = buffer.len() / stride;
    let mut new_buffer = buffer.to_vec();

    for i in 0..vertex_count {
        let v_start = i * stride;
        let mappings = if hair_vertex_indices.contains(&(i as u32)) { hair_mappings } else { default_mappings };
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
        // 3DMigoto excludes DISABLED* from its recursive include, so these are inert
        // reference copies. Fixing them changes nothing in game and their diagnostics are
        // misleading - a stale DISABLED copy reports failures the live INI never had.
        if fname.starts_with("zzzmanager_ui_")
            || fname.starts_with("000_zzzmanager_ui_")
            || fname.to_uppercase().starts_with("DISABLED")
            || fname.ends_with(".bak")
        {
            continue;
        }

        let content = match read_ini_to_string(ini_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let active_hashes = extract_hashes_from_ini(&content);
        let mut new_content = content.clone();
        let mut ini_changed = false;

        let is_jane = detected_character.as_ref().is_some_and(|dc| is_character_match(dc, "JaneDoe"));
        let jane_hijacked = is_jane && is_jane_head_hijacked(&content);
        // A hijacked IB (9268a5af/7b16a708) can coexist with a genuinely standalone modern Hair
        // mesh in the same file, both drawing from the SAME shared vb2 blend buffer. Neither a
        // uniform Hand nor a uniform Hair bone-mapping choice is correct for that shared buffer;
        // the specific vertex indices proven (via drawindexed comment labels + actual index
        // buffer content) to belong to hair-labeled sub-draws need Hair mappings, while
        // everything else in the buffer keeps the default Hand mappings.
        let jane_hijacked_hair_vertices: HashSet<u32> = if is_jane && jane_hijacked {
            collect_jane_hijacked_hair_vertex_indices(ini_path.parent().unwrap_or(mod_path), &content)
        } else {
            HashSet::new()
        };

        // If the game split this legacy component into two modern components, the mod has to be
        // registered on both, each with its own bone palette. That supersedes every per-hash
        // migration and whole-buffer bone remap below for the component it consumes.
        let mut split_source_blend: Option<String> = None;
        let mut component_split_applied = false;
        // Set when this mod needs a split but could not get one. Migrating its legacy
        // hashes anyway would point the component's buffers and its index buffer at two
        // different modern components, which renders the character with the split-off
        // half missing entirely - worse than leaving the mod alone.
        let mut split_required_but_failed: Option<&'static component_split::ComponentSplitRule> = None;
        // Set when the split actually ran, so later binary conversions can also reach the
        // per-component buffers it produced.
        let mut split_rule_applied: Option<&'static component_split::ComponentSplitRule> = None;
        if let Some(split_rule) =
            component_split::find_component_split(&content, detected_character.as_deref())
        {
            let base_dir = ini_path.parent().unwrap_or(mod_path);
            let remap = split_rule
                .legacy_ibs()
                .map(|ib| component_split::subdraw_remap_from_db(fixer_db, ib))
                .find(|m| !m.is_empty())
                .unwrap_or_default();
            match component_split::apply_component_split(base_dir, &content, split_rule, &remap) {
                Ok(split) => {
                    if backup_created_name.is_none() {
                        let backup_name = format!("DISABLED_BACKUP_{}_{}.ini.bak", timestamp, fname);
                        let backup_path = ini_path.with_file_name(&backup_name);
                        if fs::copy(ini_path, &backup_path).is_ok() {
                            backup_created_name = Some(backup_name);
                        }
                    }
                    new_content = split.new_ini.clone();
                    ini_changed = true;
                    component_split_applied = true;
                    split_rule_applied = Some(split_rule);
                    split_source_blend = Some(split.source_blend.clone());
                    for f in &split.files_written {
                        modified_buf_files.push(f.clone());
                    }
                    buffers_remapped += 2;
                    actions_summary.push(format!(
                        "Split legacy {} component across modern {} ({} verts) and {} ({} verts), \
                         bone-remapping each half into its own palette",
                        split_rule.character,
                        split_rule.primary_label,
                        split.primary_vertices,
                        split_rule.secondary_label,
                        split.secondary_vertices
                    ));
                }
                Err(e) if e.is_blocking() => {
                    split_required_but_failed = Some(split_rule);
                    actions_summary.push(format!(
                        "Left the legacy {} component untouched - it needs a {}/{} component \
                         split that cannot be performed: {e}",
                        split_rule.character, split_rule.primary_label, split_rule.secondary_label
                    ));
                }
                Err(e) => {
                    // Could not inspect the component at all, so fall through to the
                    // ordinary per-hash migration rather than assuming a split was needed.
                    actions_summary.push(format!("Component split not applicable: {e}"));
                }
            }
        }

        // Submesh index remapping (e.g. match_first_index and match_index_count shifts across game patches)
        for sec in parse_ini_sections(&content) {
            if let Some(ref h) = sec.get_hash() {
                // Sub-draw offsets belong to the component the section is migrating to.
                // If that migration is being withheld, the offsets must stay as authored.
                if split_required_but_failed.is_some_and(|r| r.legacy_contains(h)) {
                    continue;
                }
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

        // Normalize legacy override_byte_stride (e.g. 92, 96, 76) to 40 on character vertex limit raise sections.
        // ${2} carries the value actually matched - the rollback annotation must record the
        // real previous stride, not a fixed guess, or restoring from it corrupts the section.
        static STRIDE_REPLACE_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?im)^([ \t]*override_byte_stride\s*=\s*)(92|96|76)\b").expect("Valid regex"));
        if STRIDE_REPLACE_RE.is_match(&new_content) {
            let repl = "${1}40\r\n; [ZZZMODMANAGER PREVIOUS STRIDE] override_byte_stride = ${2}";
            new_content = STRIDE_REPLACE_RE.replace_all(&new_content, repl).to_string();
            ini_changed = true;
            buffers_remapped += 1;
            actions_summary.push("Normalized legacy override_byte_stride to 40 to prevent vertex mesh distortion".to_string());
        }

        // Collect buffer modifications needed: (buf_filename, fix_type, old_format, new_format, stride)
        type BufTask = (String, String, Vec<String>, Vec<String>, usize);
        let mut buf_tasks: Vec<BufTask> = Vec::new();

        for hash in &active_hashes {
            // A component that needs a split but did not get one must keep its legacy
            // hashes: migrating them would split the component across two modern targets.
            if split_required_but_failed.is_some_and(|r| r.legacy_contains(hash)) {
                continue;
            }
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
                            let mut target_h = if terminal_h != hash.to_lowercase() {
                                terminal_h
                            } else if let Some(ref new_h) = action.new_hash {
                                new_h.clone()
                            } else {
                                continue;
                            };

                            let mut desc = rule.description.clone();
                            if jane_hijacked {
                                if let Some(hands_h) = get_jane_hands_reroute_hash_guarded(&content, hash) {
                                    target_h = hands_h.to_string();
                                    desc = format!("{} (Rerouted to Hands & Accessories)", desc);
                                }
                            } else if let Some((old_h, new_h, face_char)) = find_universal_face_rule(hash) {
                                if hash.eq_ignore_ascii_case(old_h) {
                                    target_h = new_h.to_string();
                                    desc = format!("{} Face Texcoord (3.2 upgrade)", face_char);
                                }
                            }

                            let pattern = format!(r"(?i)(^|\r?\n)(\s*)(hash\s*=\s*){}", hash);
                            if let Ok(hash_re) = Regex::new(&pattern) {
                                if hash_re.is_match(&new_content) {
                                    let replacement = format!("${{1}}${{2}}hash = {}\r\n${{2}}; [ZZZMODMANAGER PREVIOUS HASH] hash = {}", target_h, hash);
                                    new_content = hash_re.replace_all(&new_content, replacement.as_str()).to_string();
                                    ini_changed = true;
                                    hashes_updated += 1;
                                    actions_summary.push(format!("Updated hash {} -> {} ({})", hash, target_h, desc));
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

                                    let sec_tag = format!("[TextureOverride{}]", title);
                                    let sec_tag_no_dots = format!("[TextureOverride{}]", title.replace('.', ""));
                                    let nc_lower = new_content.to_lowercase();
                                    if nc_lower.contains(&sec_tag.to_lowercase())
                                        || nc_lower.contains(&sec_tag_no_dots.to_lowercase())
                                        || nc_lower.contains(&format!("hash = {}", target_eq.to_lowercase()))
                                        || nc_lower.contains(&format!("hash={}", target_eq.to_lowercase())) {
                                        continue;
                                    }

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

                                    // Guard: if INI already has an override section for this title or hash, do not overwrite/conflict
                                    let sec_tag = format!("[TextureOverride{}]", title);
                                    let sec_tag_no_dots = format!("[TextureOverride{}]", title.replace('.', ""));
                                    let nc_lower = new_content.to_lowercase();
                                    if nc_lower.contains(&sec_tag.to_lowercase())
                                        || nc_lower.contains(&sec_tag_no_dots.to_lowercase())
                                        || nc_lower.contains(&format!("hash = {}", target_eq.to_lowercase()))
                                        || nc_lower.contains(&format!("hash={}", target_eq.to_lowercase())) {
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
                            let mut buffers = find_referenced_buffers(&content, hash, "vb1");
                            // A component split replaces the legacy texcoord binding with one
                            // buffer per modern component, sliced out of this same source, so
                            // they inherit its vertex format and the conversion has to reach
                            // them too. Left out, the split halves keep the pre-1.2 32-byte
                            // stride the game stopped reading and their UVs come out
                            // progressively more scrambled the deeper into the buffer they sit.
                            // In shared mode there are no slices and this finds the source
                            // buffer again, which the de-dup below drops.
                            if let Some(rule) = split_rule_applied {
                                for modern in [rule.primary.texcoord_vb, rule.secondary.texcoord_vb] {
                                    buffers.extend(find_referenced_buffers(&new_content, modern, "vb1"));
                                }
                            }
                            buffers.sort();
                            buffers.dedup();
                            for (buf_file, stride) in buffers {
                                buf_tasks.push((buf_file, "shrink_texcoord_color".to_string(), Vec::new(), Vec::new(), stride));
                            }
                        }
                        "update_blend_indices" => {
                            if !char_matches {
                                continue;
                            }
                            let mut old_idx = action.old_indices.clone().unwrap_or_default();
                            let mut new_idx = action.new_indices.clone().unwrap_or_default();
                            let target_h = if let Some(ref th) = action.target_hash {
                                if !th.is_empty() { th.as_str() } else { hash }
                            } else {
                                hash
                            };

                            let comp_type = if is_jane {
                                if jane_hijacked { "hands" } else { "hair" }
                            } else if detected_character.as_ref().is_some_and(|dc| is_character_match(dc, "Dialyn")) {
                                "dialyn"
                            } else {
                                "generic"
                            };

                            if is_jane {
                                if jane_hijacked {
                                    let mappings = get_jane_hand_bone_mappings();
                                    old_idx = mappings.keys().copied().collect();
                                    new_idx = mappings.values().copied().collect();
                                } else if old_idx.is_empty() {
                                    let mappings = get_jane_hair_bone_mappings();
                                    old_idx = mappings.keys().copied().collect();
                                    new_idx = mappings.values().copied().collect();
                                }
                            }

                            let mut buffers = find_referenced_buffers(&content, target_h, "vb2");
                            if buffers.is_empty() {
                                buffers = find_all_slot_buffers(&content, "vb2");
                            }
                            let safe_buffers = filter_safe_blend_buffers_for_component(&buffers, comp_type);
                            for (buf_file, stride) in safe_buffers {
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

        // 1. Ensure Jane Doe blend buffers have the correct bone mappings (Hands vs Hair).
        // Skipped when a component split ran: it already remapped each half into its own
        // palette, and a second whole-buffer pass would corrupt one of them.
        if is_jane && !component_split_applied && split_required_but_failed.is_none() {
            let has_legacy_head = active_hashes.iter().any(|h| {
                matches!(
                    h.to_lowercase().as_str(),
                    "9268a5af" | "7b16a708" | "e7a3b7dc" | "24323bf9" | "8721477f" | "0a10c747"
                )
            });
            if has_legacy_head {
                let all_vb2 = find_all_slot_buffers(&content, "vb2");
                let comp_type = if jane_hijacked { "hands" } else { "hair" };
                let safe_vb2 = filter_safe_blend_buffers_for_component(&all_vb2, comp_type);
                let mappings = if jane_hijacked {
                    get_jane_hand_bone_mappings()
                } else {
                    get_jane_hair_bone_mappings()
                };
                let old_k: Vec<String> = mappings.keys().map(|k| k.to_string()).collect();
                let new_v: Vec<String> = mappings.values().map(|v| v.to_string()).collect();
                for (b_file, stride) in safe_vb2 {
                    if !buf_tasks.iter().any(|(f, t, _, _, _)| f == &b_file && t == "update_blend_indices") {
                        buf_tasks.push((
                            b_file,
                            "update_blend_indices".to_string(),
                            old_k.clone(),
                            new_v.clone(),
                            stride,
                        ));
                    }
                }
            }
        }

        // 2. Ensure Dialyn blend buffers have the correct bone mappings
        if detected_character.as_ref().is_some_and(|dc| is_character_match(dc, "Dialyn")) {
            let has_legacy_dialyn = active_hashes.iter().any(|h| {
                matches!(h.to_lowercase().as_str(), "3d7e53cf" | "ff36809b")
            });
            if has_legacy_dialyn {
                let all_vb2 = find_all_slot_buffers(&content, "vb2");
                let safe_vb2 = filter_safe_blend_buffers_for_component(&all_vb2, "dialyn");
                let mappings = get_dialyn_bone_mappings();
                let old_k: Vec<String> = mappings.keys().map(|k| k.to_string()).collect();
                let new_v: Vec<String> = mappings.values().map(|v| v.to_string()).collect();
                for (b_file, stride) in safe_vb2 {
                    if !buf_tasks.iter().any(|(f, t, _, _, _)| f == &b_file && t == "update_blend_indices") {
                        buf_tasks.push((
                            b_file,
                            "update_blend_indices".to_string(),
                            old_k.clone(),
                            new_v.clone(),
                            stride,
                        ));
                    }
                }
            }
        }

        // 3. Ensure Universal Face 3.1 -> 3.2 texcoord format upgrade if not already queued
        for h in &active_hashes {
            if let Some((old_h, new_h, _char_name)) = find_universal_face_rule(h) {
                let mut vb1_bufs = find_referenced_buffers(&content, old_h, "vb1");
                if vb1_bufs.is_empty() {
                    vb1_bufs = find_referenced_buffers(&content, new_h, "vb1");
                }
                if vb1_bufs.is_empty() {
                    vb1_bufs = find_referenced_buffers(&content, h, "vb1");
                }
                for (b_file, stride) in vb1_bufs {
                    if !buf_tasks.iter().any(|(f, t, _, _, _)| f == &b_file && t == "remap_texcoord") {
                        let old_face_fmt = vec![
                            "4B".to_string(),
                            "2f".to_string(),
                            "2f".to_string(),
                            "2f".to_string(),
                            "2f".to_string(),
                        ];
                        let new_face_fmt = vec![
                            "4f".to_string(),
                            "2f".to_string(),
                            "2f".to_string(),
                            "2f".to_string(),
                            "2f".to_string(),
                        ];
                        buf_tasks.push((
                            b_file,
                            "remap_texcoord".to_string(),
                            old_face_fmt,
                            new_face_fmt,
                            if stride == 0 { 36 } else { stride },
                        ));
                    }
                }
            }
        }

        let mut seen_buf_tasks: HashSet<(PathBuf, String)> = HashSet::new();

        // Apply buffer transformations
        for (buf_name, fix_type, old_fmt, new_fmt, stride) in buf_tasks {
            // The component split already produced per-palette copies of this buffer; remapping
            // the shared source again would corrupt whichever half it is not appropriate for.
            if fix_type == "update_blend_indices"
                && split_source_blend.as_deref().is_some_and(|src| src.eq_ignore_ascii_case(&buf_name))
            {
                continue;
            }
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
                            if is_jane && jane_hijacked && !jane_hijacked_hair_vertices.is_empty() {
                                // This buffer is shared between a genuinely hijacked hand/clothing
                                // draw and a standalone hair draw; remap Hair-labeled vertices with
                                // Hair mappings and leave everything else on the default mapping.
                                let hair_mapping = get_jane_hair_bone_mappings();
                                (
                                    remap_bone_indices_buffer_bytes_mixed(&raw_bytes, effective_stride, &mapping, &hair_mapping, &jane_hijacked_hair_vertices),
                                    None,
                                )
                            } else {
                                (remap_bone_indices_buffer_bytes(&raw_bytes, effective_stride, &mapping), None)
                            }
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

        // Ensure handling = skip on any TextureOverride section that specifies ib = or drawindexed
        let (content_after_skip, skip_count) = ensure_handling_skip_on_draw_sections(&new_content);
        if skip_count > 0 {
            new_content = content_after_skip;
            ini_changed = true;
            actions_summary.push(format!("Injected 'handling = skip' into {} draw sections to prevent double-render", skip_count));
        }

        // Suppress split sub-meshes from modern game versions (e.g. Belle Legs, Earrings, Hairpin, BodyB)
        if let Some(ref dc) = detected_character {
            let (content_after_supp, supp_count) = ensure_character_suppressions(&new_content, dc);
            if supp_count > 0 {
                new_content = content_after_supp;
                ini_changed = true;
                sections_added += supp_count;
                actions_summary.push(format!("Injected {} modern vanilla component suppression blocks", supp_count));
            }
        }

        // Upgrade hijacked Jane Doe mods to use canonical Hands & Accessories (294a319a).
        // Its hardcoded 27,420 / 1,626 / 17,929 fingerprints describe one specific mod layout,
        // so it must not run on a mod the component split already restructured.
        if is_jane && jane_hijacked && !component_split_applied && split_required_but_failed.is_none() {
            let (content_after_decomp, decomp_changed) = decompose_jane_hijacked_limbs(&new_content);
            if decomp_changed {
                new_content = content_after_decomp;
                ini_changed = true;
                actions_summary.push("Decomposed hijacked Jane Doe Head section into articulated forearms and hands (294a319a)".to_string());
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
    } else if name.ends_with(".ini.bak") || name.ends_with(".buf.bak") {
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
