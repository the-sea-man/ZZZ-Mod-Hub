use crate::error::AppError;
use crate::utils::build_hash_alias_map;
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use tauri::Manager;

static RE_IB: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\bib\s*=\s*([0-9a-f]{6,16})\b").expect("Valid regex"));
static RE_VB0: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\bvb0\s*=\s*([0-9a-f]{6,16})\b").expect("Valid regex"));
static RE_VB1: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\bvb1\s*=\s*([0-9a-f]{6,16})\b").expect("Valid regex"));
static RE_VS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\bvs\s*=\s*([0-9a-f]{6,16})\b").expect("Valid regex"));
static RE_PS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\bps\s*=\s*([0-9a-f]{6,16})\b").expect("Valid regex"));
static RE_DRAW: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\bdraw(?:indexed)?\b").expect("Valid regex"));

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct CapturedHashEntry {
    pub hash_type: String, // "IB", "VB0", "VB1", "VS", "PS", or "DrawCall"
    pub hash: String,
    pub ib: Option<String>,
    pub vb0: Option<String>,
    pub vertex_count: Option<u32>,
    pub stride: Option<u32>,
    pub is_known: bool,
    pub matched_entity: Option<String>,
    pub line_snippet: String,
}

/// Finds the d3dx.ini or d3dx.log in the parent directory of Mods/ or within the mods root
fn find_xxmi_root(mods_path: &str) -> PathBuf {
    let mods_path_expanded = crate::utils::expand_path(mods_path);
    let p = Path::new(&mods_path_expanded);
    if let Some(parent) = p.parent() {
        if parent.join("d3d11.dll").exists() || parent.join("d3dx.ini").exists() || parent.join("d3dx.log").exists() {
            return parent.to_path_buf();
        }
    }
    p.to_path_buf()
}

/// Checks if 3DMigoto hunting mode is currently active (hunting = 1 or 2 in d3dx.ini)
#[tauri::command]
pub fn get_hunting_mode_status(mods_path: String) -> Result<bool, AppError> {
    let root = find_xxmi_root(&mods_path);
    let ini_path = root.join("d3dx.ini");
    if !ini_path.exists() {
        return Ok(false);
    }

    let content = fs::read_to_string(&ini_path).unwrap_or_default();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(';') || trimmed.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            if k.trim().eq_ignore_ascii_case("hunting") {
                let val = v.trim();
                return Ok(val == "1" || val == "2");
            }
        }
    }

    Ok(false)
}

/// Toggles 3DMigoto hunting mode inside d3dx.ini
#[tauri::command]
pub fn set_hunting_mode(mods_path: String, enabled: bool) -> Result<bool, AppError> {
    let root = find_xxmi_root(&mods_path);
    let ini_path = root.join("d3dx.ini");
    if !ini_path.exists() {
        return Err("d3dx.ini not found in 3DMigoto root directory".into());
    }

    let content = fs::read_to_string(&ini_path)?;
    let mut new_lines = Vec::new();
    let mut found_hunting = false;
    let target_val = if enabled { "1" } else { "0" };

    for line in content.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(';') && !trimmed.starts_with('#') {
            if let Some((k, _)) = trimmed.split_once('=') {
                if k.trim().eq_ignore_ascii_case("hunting") {
                    new_lines.push(format!("hunting = {}", target_val));
                    found_hunting = true;
                    continue;
                }
            }
        }
        new_lines.push(line.to_string());
    }

    if !found_hunting {
        new_lines.insert(0, format!("hunting = {}", target_val));
    }

    fs::write(&ini_path, new_lines.join("\r\n"))?;
    Ok(enabled)
}

/// Reads and parses d3dx.log to extract captured IB/VB hashes and cross-reference with the database
#[tauri::command]
pub async fn read_hunting_log(
    app: tauri::AppHandle,
    mods_path: String,
) -> Result<Vec<CapturedHashEntry>, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = find_xxmi_root(&mods_path);
        let log_path = root.join("d3dx.log");
        if !log_path.exists() {
            return Err("d3dx.log not found. Launch the game with hunting mode enabled to capture hashes.".into());
        }

        let content = fs::read_to_string(&log_path).unwrap_or_default();
        if content.is_empty() {
            return Ok(vec![]);
        }

        let mut hash_alias_map = HashMap::new();
        if let Ok(app_dir) = app.path().app_data_dir() {
            hash_alias_map = build_hash_alias_map(&app_dir);
        }

        let mut captured: Vec<CapturedHashEntry> = Vec::new();
        let mut seen_hashes: HashSet<String> = HashSet::new();

        for line in content.lines().rev() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let ib_match = RE_IB.captures(trimmed).map(|c| c[1].to_lowercase());
            let vb0_match = RE_VB0.captures(trimmed).map(|c| c[1].to_lowercase());
            let vb1_match = RE_VB1.captures(trimmed).map(|c| c[1].to_lowercase());
            let _vs_match = RE_VS.captures(trimmed).map(|c| c[1].to_lowercase());
            let _ps_match = RE_PS.captures(trimmed).map(|c| c[1].to_lowercase());
            let is_draw = RE_DRAW.is_match(trimmed);

            // Record distinct IB
            if let Some(ref ib_hash) = ib_match {
                if seen_hashes.insert(format!("ib_{}", ib_hash)) {
                    let matched = hash_alias_map.get(ib_hash).and_then(|targets| {
                        targets.first().map(|t| format!("{} ({:?})", t.category_name, t.match_type))
                    });
                    captured.push(CapturedHashEntry {
                        hash_type: "IB (Index Buffer)".to_string(),
                        hash: ib_hash.clone(),
                        ib: Some(ib_hash.clone()),
                        vb0: vb0_match.clone(),
                        vertex_count: None,
                        stride: None,
                        is_known: matched.is_some(),
                        matched_entity: matched,
                        line_snippet: trimmed.to_string(),
                    });
                }
            }

            // Record distinct VB0
            if let Some(ref vb0_hash) = vb0_match {
                if seen_hashes.insert(format!("vb0_{}", vb0_hash)) {
                    let matched = hash_alias_map.get(vb0_hash).and_then(|targets| {
                        targets.first().map(|t| format!("{} ({:?})", t.category_name, t.match_type))
                    });
                    captured.push(CapturedHashEntry {
                        hash_type: "VB0 (Vertex Buffer)".to_string(),
                        hash: vb0_hash.clone(),
                        ib: ib_match.clone(),
                        vb0: Some(vb0_hash.clone()),
                        vertex_count: None,
                        stride: None,
                        is_known: matched.is_some(),
                        matched_entity: matched,
                        line_snippet: trimmed.to_string(),
                    });
                }
            }

            // Record distinct VB1
            if let Some(ref vb1_hash) = vb1_match {
                if seen_hashes.insert(format!("vb1_{}", vb1_hash)) {
                    let matched = hash_alias_map.get(vb1_hash).and_then(|targets| {
                        targets.first().map(|t| format!("{} ({:?})", t.category_name, t.match_type))
                    });
                    captured.push(CapturedHashEntry {
                        hash_type: "VB1 (Blend / Weights)".to_string(),
                        hash: vb1_hash.clone(),
                        ib: None,
                        vb0: None,
                        vertex_count: None,
                        stride: None,
                        is_known: matched.is_some(),
                        matched_entity: matched,
                        line_snippet: trimmed.to_string(),
                    });
                }
            }

            // If it's a draw call with both IB + VB
            if is_draw {
                if let (Some(ib), Some(vb0)) = (&ib_match, &vb0_match) {
                    let combo_key = format!("combo_{ib}_{vb0}");
                    if seen_hashes.insert(combo_key) {
                        let matched = hash_alias_map.get(ib).and_then(|targets| {
                            targets.first().map(|t| format!("{} ({:?})", t.category_name, t.match_type))
                        });
                        captured.push(CapturedHashEntry {
                            hash_type: "Draw Call (IB + VB0)".to_string(),
                            hash: format!("{ib}:{vb0}"),
                            ib: ib_match.clone(),
                            vb0: vb0_match.clone(),
                            vertex_count: None,
                            stride: None,
                            is_known: matched.is_some(),
                            matched_entity: matched,
                            line_snippet: trimmed.to_string(),
                        });
                    }
                }
            }

            if captured.len() >= 200 {
                break;
            }
        }

        Ok(captured)
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}
