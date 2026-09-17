use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ModInfo {
    pub name: String,
    pub full_path: String,
    pub is_enabled: bool,
    pub preview_url: Option<String>,
    #[serde(default)]
    pub thumbnail_url: Option<String>,
    pub meta: Option<ModMeta>,
    /// Total disk size of the mod folder in bytes, computed during scan.
    /// Eliminates the need for a per-card `get_mod_metadata` IPC call.
    #[serde(default)]
    pub total_size_bytes: Option<u64>,
    /// Whether any backup files (.bak / .disabled.bak) exist in this mod folder.
    #[serde(default)]
    pub has_backup: bool,
}

#[derive(Serialize, Deserialize)]
pub struct CategoryInfo {
    pub category_name: String,
    pub character_id: Option<String>,
    pub skin_id: Option<String>,
    pub mods: Vec<ModInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Confidence {
    Low,
    Medium,
    High,
    Highest,
}

impl std::fmt::Display for Confidence {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Confidence::Low => write!(f, "Low"),
            Confidence::Medium => write!(f, "Medium"),
            Confidence::High => write!(f, "High"),
            Confidence::Highest => write!(f, "Highest"),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Hash)]
pub struct HashTarget {
    pub category_name: String,
    pub character_id: String,
    pub skin_id: String,
    pub match_type: Option<String>,
    #[serde(default)]
    pub component_name: Option<String>,
    #[serde(default)]
    pub is_base_skin: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct KeybindInfo {
    pub ini_file: String,
    pub section: String,
    pub keys: Vec<String>,
    pub back_keys: Vec<String>,
    pub bind_type: String,
    pub condition: String,
    pub variables: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModToggleInfo {
    pub id: String,
    pub ini_file: String,
    pub section: String,
    pub variable: String,
    pub display_name: String,
    pub key: Option<String>,
    pub back_key: Option<String>,
    pub bind_type: String,
    pub condition: Option<String>,
    pub current_value: i32,
    pub values: Vec<i32>,
    pub labels: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstallResult {
    pub original_zip: String,
    pub extracted_folder_name: String,
    pub category: String,
    pub full_path: String,
    pub is_conflict: bool,
    pub downloaded_at: Option<String>,
    pub gb_mod_id: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ModMeta {
    pub gb_mod_id: Option<u64>,
    pub downloaded_at: Option<String>,
    pub source_url: Option<String>,
    pub gb_last_updated: Option<u64>,
    pub author: Option<String>,
    pub original_file_name: Option<String>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct HashOverride {
    pub file: String,
    pub section: String,
    pub hash: String,
    pub first_index: u32,
    pub component_name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct ModConflict {
    pub hash: String,
    pub first_index: u32,
    pub affected_component: String,
    pub conflicting_mods: Vec<String>,
    pub is_fatal: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModUpdateCheckRequest {
    pub mod_path: String,
    pub gb_mod_id: u64,
    pub downloaded_at: u64, // Unix timestamp fallback
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateAvailable {
    pub mod_path: String,
    pub gb_mod_id: u64,
    pub mod_name: String,
    pub new_timestamp: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HashAnalysisResult {
    pub conflicts: Vec<ModConflict>,
    pub mod_hashes: std::collections::HashMap<String, Vec<HashOverride>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct KeybindConflict {
    pub key: String,
    pub mods: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct BrokenModEntry {
    pub category: String,
    pub mod_path: String,
    pub file: Option<String>,
    pub hash: String,
    pub component: Option<String>,
    pub reason: String,
    pub current_hash: Option<String>,
    pub version_gap: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct ModWarning {
    pub rule_id: String,
    pub level: String, // "critical" | "warning" | "info" | "ini_issue" | "conflict"
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ParsedIni {
    pub path: std::path::PathBuf,
    pub rel_path: String,
    pub overrides: Vec<HashOverride>,
    pub integrity_warnings: Vec<ModWarning>,
}


