//! External mod importer with depth discovery and heuristic guidance.

use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use rand::Rng;
use crate::error::AppError;
use crate::utils::{copy_dir_recursive, safe_move_dir};
use super::tagger::detect_mod_auto_tags;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepthAnalysis {
    pub depth: usize,
    pub candidate_count: usize,
    pub valid_mod_count: usize,
    pub shallow_warning_count: usize,
    pub deep_warning_count: usize,
    pub sample_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredCandidateMod {
    pub source_path: String,
    pub folder_name: String,
    pub relative_path: String,
    pub depth: usize,
    pub ini_count: usize,
    pub buf_count: usize,
    pub dds_count: usize,
    pub total_size_bytes: u64,
    pub has_subdirs_with_mods: bool,
    pub is_likely_subcomponent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalFolderScanResult {
    pub root_path: String,
    pub recommended_depth: usize,
    pub depth_analyses: Vec<DepthAnalysis>,
    pub candidates: Vec<DiscoveredCandidateMod>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExecuteImportRequest {
    pub candidate_paths: Vec<String>,
    pub destination_root: String,
    pub copy_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportExecutionResult {
    pub total_requested: usize,
    pub success_count: usize,
    pub failure_count: usize,
    pub conflict_count: usize,
    pub details: Vec<String>,
}

fn is_ignored_system_dir(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.starts_with('.')
        || lower == "node_modules"
        || lower == "$recycle.bin"
        || lower == "system volume information"
        || lower.starts_with("zzzzzz_")
        || lower == "zzzzzz_zzzmodmanagerui"
        || lower == "000_zzzmanager_ui"
        || lower.contains("zzzmodmanagerui")
}

/// Recursively collects directories at exactly `target_depth` relative to `current_dir`.
fn collect_dirs_at_depth(
    current_dir: &Path,
    current_depth: usize,
    target_depth: usize,
    out: &mut Vec<PathBuf>,
) {
    if current_depth == target_depth {
        out.push(current_dir.to_path_buf());
        return;
    }

    if let Ok(entries) = fs::read_dir(current_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if is_ignored_system_dir(&name) {
                    continue;
                }
                collect_dirs_at_depth(&path, current_depth + 1, target_depth, out);
            }
        }
    }
}

fn count_all_inis_recursive(dir: &Path, max_depth: usize) -> usize {
    let mut count = 0;
    count_inis_internal(dir, 0, max_depth, &mut count);
    count
}

fn count_inis_internal(dir: &Path, current_depth: usize, max_depth: usize, out: &mut usize) {
    if current_depth > max_depth {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    if ext.eq_ignore_ascii_case("ini") {
                        *out += 1;
                    }
                }
            } else if p.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !is_ignored_system_dir(&name) {
                    count_inis_internal(&p, current_depth + 1, max_depth, out);
                }
            }
        }
    }
}

fn aggregate_mod_metrics_recursive(dir: &Path, max_depth: usize) -> (usize, usize, usize, u64) {
    let mut inis = 0;
    let mut bufs = 0;
    let mut dds = 0;
    let mut bytes = 0;
    aggregate_metrics_internal(dir, 0, max_depth, &mut inis, &mut bufs, &mut dds, &mut bytes);
    (inis, bufs, dds, bytes)
}

fn aggregate_metrics_internal(
    dir: &Path,
    current_depth: usize,
    max_depth: usize,
    inis: &mut usize,
    bufs: &mut usize,
    dds: &mut usize,
    bytes: &mut u64,
) {
    if current_depth > max_depth {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let p = entry.path();
            if p.is_file() {
                if let Ok(meta) = p.metadata() {
                    *bytes += meta.len();
                }
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_ascii_lowercase();
                    if ext_lower == "ini" {
                        *inis += 1;
                    } else if ext_lower == "buf" || ext_lower == "ib" {
                        *bufs += 1;
                    } else if ext_lower == "dds" || ext_lower == "png" {
                        *dds += 1;
                    }
                }
            } else if p.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !is_ignored_system_dir(&name) {
                    aggregate_metrics_internal(&p, current_depth + 1, max_depth, inis, bufs, dds, bytes);
                }
            }
        }
    }
}

/// Inspects a candidate directory to count files and check for nested mod structures or subcomponents.
/// Returns the candidate mod descriptor and whether it is considered a valid mod.
fn inspect_candidate_dir(dir: &Path, root: &Path, depth: usize) -> (DiscoveredCandidateMod, bool) {
    let folder_name = dir.file_name().unwrap_or_default().to_string_lossy().to_string();
    let relative_path = dir
        .strip_prefix(root)
        .unwrap_or(dir)
        .to_string_lossy()
        .replace('\\', "/");

    let mut ini_count = 0usize;
    let mut buf_count = 0usize;
    let mut dds_count = 0usize;
    let mut total_size_bytes = 0u64;

    // Check direct children
    let mut subdirs = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let p = entry.path();
            if p.is_file() {
                if let Ok(meta) = p.metadata() {
                    total_size_bytes += meta.len();
                }
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_ascii_lowercase();
                    if ext_lower == "ini" {
                        ini_count += 1;
                    } else if ext_lower == "buf" || ext_lower == "ib" {
                        buf_count += 1;
                    } else if ext_lower == "dds" || ext_lower == "png" {
                        dds_count += 1;
                    }
                }
            } else if p.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !is_ignored_system_dir(&name) {
                    subdirs.push(p);
                }
            }
        }
    }

    let direct_has_mod_files = ini_count > 0 || buf_count > 0;

    // Check how many subdirectories contain .ini files
    let mut subdirs_with_inis = 0usize;
    for subdir in &subdirs {
        if count_all_inis_recursive(subdir, 3) > 0 {
            subdirs_with_inis += 1;
        }
    }

    let lower_name = folder_name.to_ascii_lowercase();
    let is_component_name = lower_name == "textures"
        || lower_name == "texture"
        || lower_name == "options"
        || lower_name == "option"
        || lower_name == "meshes"
        || lower_name == "mesh"
        || lower_name == "materials"
        || lower_name == "disabled";

    // A folder is a category container (too shallow) ONLY IF:
    // It has NO direct mod files at its root, and contains MULTIPLE child directories that have inis.
    let has_subdirs_with_mods = !direct_has_mod_files && subdirs_with_inis > 1;

    // A folder is a subcomponent (too deep) if:
    // It has no mod files or inis anywhere (direct or indirect), and contains only textures/buffers or has a component name.
    let is_likely_subcomponent = !direct_has_mod_files
        && subdirs_with_inis == 0
        && (dds_count > 0 || is_component_name);

    // It is a valid mod if:
    // 1) It directly contains ini or buffer files, OR
    // 2) It is a single-mod wrapper folder containing exactly 1 branch with inis (and not a container category or subcomponent)
    let is_valid_mod = direct_has_mod_files
        || (!has_subdirs_with_mods && !is_likely_subcomponent && subdirs_with_inis == 1);

    // If it's a single-mod wrapper (direct files = 0, but subdirs_with_inis == 1),
    // aggregate metrics from the inner tree so UI displays the actual file counts
    if !direct_has_mod_files && is_valid_mod {
        let (agg_ini, agg_buf, agg_dds, agg_bytes) = aggregate_mod_metrics_recursive(dir, 3);
        ini_count = agg_ini;
        buf_count = agg_buf;
        dds_count = agg_dds;
        total_size_bytes = agg_bytes;
    }

    (
        DiscoveredCandidateMod {
            source_path: dir.to_string_lossy().to_string(),
            folder_name,
            relative_path,
            depth,
            ini_count,
            buf_count,
            dds_count,
            total_size_bytes,
            has_subdirs_with_mods,
            is_likely_subcomponent,
        },
        is_valid_mod,
    )
}

/// Recursively traverses directory boundaries to discover standalone mods and unpack character/category collections.
fn discover_smart_mods(root: &Path) -> Vec<DiscoveredCandidateMod> {
    let mut candidates = Vec::new();
    discover_smart_mods_recursive(root, root, 1, 4, &mut candidates);
    candidates.sort_by(|a, b| a.folder_name.to_lowercase().cmp(&b.folder_name.to_lowercase()));
    candidates
}

fn discover_smart_mods_recursive(
    current_dir: &Path,
    root: &Path,
    depth: usize,
    max_depth: usize,
    out: &mut Vec<DiscoveredCandidateMod>,
) {
    if depth > max_depth {
        return;
    }

    let mut subdirs = Vec::new();
    if let Ok(entries) = fs::read_dir(current_dir) {
        for entry in entries.filter_map(Result::ok) {
            let p = entry.path();
            if p.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !is_ignored_system_dir(&name) {
                    subdirs.push(p);
                }
            }
        }
    }

    for subdir in subdirs {
        let (candidate, is_valid_mod) = inspect_candidate_dir(&subdir, root, depth);
        if is_valid_mod {
            // Found a valid self-contained mod (direct mod or single-mod wrapper)
            // Register it as a candidate mod and PRUNE traversal into its internal subdirectories!
            out.push(candidate);
        } else if candidate.has_subdirs_with_mods {
            // Found a category container (e.g. Belle - Vibrant Store Manager with multiple mods inside)
            // Recurse into children to discover the individual mods
            discover_smart_mods_recursive(&subdir, root, depth + 1, max_depth, out);
        }
        // Subcomponents or empty folders with 0 inis are ignored
    }
}

/// Scans an external folder, analyzes depths 1 to 4, computes recommendations, and returns candidate mods.
pub fn scan_external_folder(
    root: &Path,
    chosen_depth: Option<usize>,
) -> Result<ExternalFolderScanResult, AppError> {
    if !root.exists() || !root.is_dir() {
        return Err(format!("Selected path does not exist or is not a directory: {:?}", root).into());
    }

    let smart_candidates = discover_smart_mods(root);
    let smart_candidate_count = smart_candidates.len();

    let mut depth_analyses = Vec::new();
    let mut candidates_by_depth: std::collections::HashMap<usize, Vec<DiscoveredCandidateMod>> =
        std::collections::HashMap::new();

    // Depth 0 represents Smart Auto-Detect
    let smart_sample = smart_candidates.first().map(|c| c.relative_path.clone()).unwrap_or_default();
    depth_analyses.push(DepthAnalysis {
        depth: 0,
        candidate_count: smart_candidate_count,
        valid_mod_count: smart_candidate_count,
        shallow_warning_count: 0,
        deep_warning_count: 0,
        sample_path: smart_sample,
    });
    candidates_by_depth.insert(0, smart_candidates);

    let mut best_depth = 1usize;
    let mut highest_score = i32::MIN;
    let mut has_any_valid_depth = false;

    for d in 1..=4 {
        let mut dirs = Vec::new();
        collect_dirs_at_depth(root, 0, d, &mut dirs);

        let mut valid_mod_count = 0usize;
        let mut shallow_warning_count = 0usize;
        let mut deep_warning_count = 0usize;
        let mut sample_path = String::new();

        let mut depth_candidates = Vec::new();

        for dir in &dirs {
            let (candidate, is_valid_mod) = inspect_candidate_dir(dir, root, d);
            if sample_path.is_empty() {
                sample_path = candidate.relative_path.clone();
            }

            if candidate.has_subdirs_with_mods {
                shallow_warning_count += 1;
            } else if candidate.is_likely_subcomponent {
                deep_warning_count += 1;
            }

            if is_valid_mod {
                valid_mod_count += 1;
            }

            depth_candidates.push(candidate);
        }

        let candidate_count = depth_candidates.len();

        let score = if candidate_count == 0 || valid_mod_count == 0 {
            -1000
        } else {
            (valid_mod_count as i32 * 10)
                - (shallow_warning_count as i32 * 15)
                - (deep_warning_count as i32 * 8)
        };

        if score > highest_score && valid_mod_count > 0 {
            highest_score = score;
            best_depth = d;
            has_any_valid_depth = true;
        }

        depth_analyses.push(DepthAnalysis {
            depth: d,
            candidate_count,
            valid_mod_count,
            shallow_warning_count,
            deep_warning_count,
            sample_path,
        });

        candidates_by_depth.insert(d, depth_candidates);
    }

    let max_fixed_valid_mods = depth_analyses
        .iter()
        .filter(|d| d.depth >= 1)
        .map(|d| d.valid_mod_count)
        .max()
        .unwrap_or(0);

    // Recommendation logic:
    // If no mods are found at all -> 0 (no "Best" badge)
    // If mixed/heterogeneous (smart discovered more valid mods than any single fixed depth) -> 0 (Smart)
    // If a clean uniform fixed depth captures all mods -> best_depth (e.g. 1 or 2)
    let recommended_depth = if smart_candidate_count == 0 {
        0
    } else if smart_candidate_count > max_fixed_valid_mods || !has_any_valid_depth {
        0
    } else {
        best_depth
    };

    let effective_depth = if let Some(cd) = chosen_depth {
        cd.clamp(0, 4)
    } else {
        recommended_depth
    };

    let candidates = candidates_by_depth.remove(&effective_depth).unwrap_or_default();

    Ok(ExternalFolderScanResult {
        root_path: root.to_string_lossy().to_string(),
        recommended_depth,
        depth_analyses,
        candidates,
    })
}

/// Executes importing candidate mod folders directly into the Unassigned folder of destination_root.
pub fn execute_external_import(
    request: ExecuteImportRequest,
) -> Result<ImportExecutionResult, AppError> {
    let dest_root_expanded = crate::utils::expand_path(&request.destination_root);
    let mut dest_root = PathBuf::from(&dest_root_expanded);
    if !dest_root.exists() {
        fs::create_dir_all(&dest_root)?;
    }

    // If destination_root is the top-level Mods folder and contains a "Playable Characters" directory,
    // ensure we route into "Playable Characters" where the library's active category folders and Unassigned reside.
    if dest_root.join("Playable Characters").exists() && !dest_root.ends_with("Playable Characters") {
        dest_root = dest_root.join("Playable Characters");
    }

    let unassigned_dir = if dest_root.ends_with("Unassigned") {
        dest_root.clone()
    } else {
        dest_root.join("Unassigned")
    };

    if !unassigned_dir.exists() {
        fs::create_dir_all(&unassigned_dir)?;
    }

    // Auto-migrate any orphan mods from an earlier top-level "Mods/Unassigned" into the active "Playable Characters/Unassigned"
    let candidate_top_unassigned = if dest_root.ends_with("Playable Characters") {
        dest_root.parent().map(|p| p.join("Unassigned"))
    } else {
        Some(Path::new(&dest_root_expanded).join("Unassigned"))
    };

    if let Some(top_unassigned) = candidate_top_unassigned {
        if top_unassigned.exists() && top_unassigned != unassigned_dir {
            if let Ok(entries) = fs::read_dir(&top_unassigned) {
                for entry in entries.filter_map(Result::ok) {
                    let p = entry.path();
                    if p.is_dir() {
                        if let Some(folder_name) = p.file_name() {
                            let target = unassigned_dir.join(folder_name);
                            if !target.exists() {
                                let _ = safe_move_dir(&p, &target);
                            }
                        }
                    }
                }
            }
            let _ = fs::remove_dir(&top_unassigned);
        }
    }

    let mut success_count = 0usize;
    let mut failure_count = 0usize;
    let mut conflict_count = 0usize;
    let mut details = Vec::new();

    for src_path_str in &request.candidate_paths {
        let src_path = Path::new(src_path_str);
        if !src_path.exists() || !src_path.is_dir() {
            failure_count += 1;
            details.push(format!("Skipped non-existent directory: {}", src_path_str));
            continue;
        }

        let folder_name = src_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let base_name = folder_name
            .strip_prefix("DISABLED ")
            .unwrap_or(&folder_name)
            .to_string();

        // Check for conflicts in destination
        let enabled_target = unassigned_dir.join(&base_name);
        let disabled_target = unassigned_dir.join(format!("DISABLED {}", base_name));

        let (final_folder_name, is_conflict) = if enabled_target.exists() || disabled_target.exists() {
            conflict_count += 1;
            let rand_str: String = rand::thread_rng()
                .sample_iter(&rand::distributions::Alphanumeric)
                .take(6)
                .map(char::from)
                .map(|c| c.to_ascii_lowercase())
                .collect();
            (format!("DISABLED {}_conflict_{}", base_name, rand_str), true)
        } else {
            (base_name.clone(), false)
        };

        let dest_path = unassigned_dir.join(&final_folder_name);

        let op_result = if request.copy_mode {
            copy_dir_recursive(src_path, &dest_path).map(|_| ())
        } else {
            safe_move_dir(src_path, &dest_path)
        };

        match op_result {
            Ok(()) => {
                success_count += 1;
                let conflict_note = if is_conflict { " (Renamed to prevent conflict)" } else { "" };
                details.push(format!(
                    "{} '{}' -> Unassigned/{}{}",
                    if request.copy_mode { "Copied" } else { "Moved" },
                    folder_name,
                    final_folder_name,
                    conflict_note
                ));

                // Auto-detect tags and write .zmm-meta.json
                let auto_tags = detect_mod_auto_tags(&dest_path, "Unassigned", false);
                let tags = if auto_tags.is_empty() { None } else { Some(auto_tags) };

                let now_secs = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                let meta = crate::models::ModMeta {
                    gb_mod_id: None,
                    downloaded_at: Some(now_secs.to_string()),
                    author: None,
                    notes: Some("Imported from external manager".to_string()),
                    tags,
                    gb_last_updated: None,
                    source_url: None,
                    original_file_name: Some(folder_name.clone()),
                };

                if let Ok(meta_json) = serde_json::to_string_pretty(&meta) {
                    let _ = fs::write(dest_path.join(".zmm-meta.json"), meta_json);
                }

                crate::infra::logger::log_alteration(
                    if request.copy_mode { "import_copy" } else { "import_move" },
                    &folder_name,
                    &dest_path.to_string_lossy(),
                    &format!("Imported to Unassigned (conflict: {})", is_conflict),
                    None,
                    false,
                );
            }
            Err(e) => {
                failure_count += 1;
                details.push(format!("Failed to import '{}': {}", folder_name, e));
            }
        }
    }

    Ok(ImportExecutionResult {
        total_requested: request.candidate_paths.len(),
        success_count,
        failure_count,
        conflict_count,
        details,
    })
}
