//! Clue extraction, base model discovery, and archive helpers for 3D Mod Viewer.

use crate::error::AppError;
use crate::utils::find_ini_files;
use super::types::*;
use std::fs;
use std::path::{Path, PathBuf};

/// Extract clues about what base model a retexture mod was created for.
pub fn extract_mod_clues(mod_dir: &Path, sections: &[IniSection]) -> Vec<String> {
    let mut clues = Vec::new();

    // 1. Check .txt readme files in mod folder
    if let Ok(entries) = fs::read_dir(mod_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let fname = p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                if fname.ends_with(".txt") {
                    if let Ok(content) = fs::read_to_string(&p) {
                        let lines: Vec<&str> = content
                            .lines()
                            .map(|l| l.trim())
                            .filter(|l| !l.is_empty() && !l.starts_with('-') && !l.starts_with('='))
                            .take(4)
                            .collect();
                        for line in lines {
                            if line.len() > 3 && line.len() < 120 {
                                clues.push(format!("{}: {}", p.file_name().unwrap_or_default().to_string_lossy(), line));
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Check INI CreditInfo or Author data
    for sec in sections {
        for entry in &sec.entries {
            if entry.key == "data" && (entry.val.contains("Created by") || entry.val.contains("Credit") || entry.val.contains("Author") || entry.val.contains("VoidHero")) {
                let clean = entry.val.trim_matches('"').trim();
                if !clean.is_empty() && !clues.iter().any(|c| c.contains(clean)) {
                    clues.push(format!("INI Credit: {}", clean));
                }
            }
        }
    }

    // 3. Check referenced buffer names in Resource sections
    let mut referenced_bufs: Vec<String> = Vec::new();
    for sec in sections {
        if sec.name.to_lowercase().starts_with("resource") {
            for entry in &sec.entries {
                if entry.key == "filename" && (entry.val.ends_with(".buf") || entry.val.ends_with(".ib"))
                    && !referenced_bufs.contains(&entry.val) {
                        referenced_bufs.push(entry.val.clone());
                    }
            }
        }
    }
    if !referenced_bufs.is_empty() {
        clues.push(format!("Required Mesh Buffers: {}", referenced_bufs.join(", ")));
    }

    // 4. Character category name from parent directory
    if let Some(parent) = mod_dir.parent() {
        let parent_name = parent.file_name().unwrap_or_default().to_string_lossy();
        if !parent_name.is_empty() {
            clues.push(format!("Character Category: {}", parent_name));
        }
    }

    clues
}

/// Discover and evaluate all candidate base mesh mods in the character category folder.
pub fn discover_base_model_candidates(
    mod_dir: &Path,
    sections: &[IniSection],
) -> (Vec<BaseModelCandidate>, Vec<String>) {
    let mut candidates = Vec::new();
    let mut req_buffers = Vec::new();

    // Collect all requested .buf and .ib filenames from [Resource...] sections
    for sec in sections {
        if sec.name.to_lowercase().starts_with("resource") {
            for entry in &sec.entries {
                if entry.key == "filename" && (entry.val.ends_with(".buf") || entry.val.ends_with(".ib"))
                    && !req_buffers.contains(&entry.val) {
                        req_buffers.push(entry.val.clone());
                    }
            }
        }
    }

    let parent = match mod_dir.parent() {
        Some(p) => p,
        None => return (candidates, req_buffers),
    };

    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.flatten() {
            let sib_path = entry.path();
            if !sib_path.is_dir() || sib_path == mod_dir {
                continue;
            }

            let folder_name = entry.file_name().to_string_lossy().to_string();
            let display_name = folder_name
                .trim_start_matches("DISABLED ")
                .trim_start_matches("DISABLED_")
                .to_string();

            // Collect all .buf and .ib files inside this candidate folder
            let mut sib_bufs = Vec::new();
            if let Ok(sib_entries) = fs::read_dir(&sib_path) {
                for se in sib_entries.flatten() {
                    let sp = se.path();
                    if sp.is_file() {
                        let sn = se.file_name().to_string_lossy().to_string();
                        if sn.ends_with(".buf") || sn.ends_with(".ib") {
                            sib_bufs.push(sn);
                        }
                    } else if sp.is_dir() {
                        if let Ok(nested) = fs::read_dir(&sp) {
                            for ne in nested.flatten() {
                                let nn = ne.file_name().to_string_lossy().to_string();
                                if nn.ends_with(".buf") || nn.ends_with(".ib") {
                                    sib_bufs.push(nn);
                                }
                            }
                        }
                    }
                }
            }

            if sib_bufs.is_empty() {
                continue;
            }

            // Count matches with req_buffers
            let mut matched_count = 0;
            let mut matched_names = Vec::new();
            for req in &req_buffers {
                if sib_bufs.iter().any(|b| b.eq_ignore_ascii_case(req)) {
                    matched_count += 1;
                    matched_names.push(req.clone());
                }
            }

            let total_req = req_buffers.len();
            let (confidence, match_details) = if total_req > 0 && matched_count == total_req {
                ("exact", format!("Exact Match: {}/{} required mesh buffers found", matched_count, total_req))
            } else if matched_count > 0 {
                ("partial", format!("Partial Match: {}/{} buffers matched ({})", matched_count, total_req, matched_names.join(", ")))
            } else {
                ("low", format!("Contains {} 3D mesh buffers (unmatched filenames)", sib_bufs.len()))
            };

            candidates.push(BaseModelCandidate {
                folder_name,
                display_name,
                confidence: confidence.to_string(),
                matched_buffers_count: matched_count,
                total_required_buffers: total_req,
                match_details,
            });
        }
    }

    // Also scan other skin folders of the same character in grandparent (e.g. Jane Doe - Nocturne of Light)
    if let Some(grandparent) = parent.parent() {
        let parent_folder_name = parent.file_name().unwrap_or_default().to_string_lossy();
        let char_prefix = parent_folder_name
            .split(" - ")
            .next()
            .unwrap_or(&parent_folder_name)
            .trim();

        if let Ok(cat_entries) = fs::read_dir(grandparent) {
            for cat_entry in cat_entries.flatten() {
                let cat_p = cat_entry.path();
                if !cat_p.is_dir() || cat_p == parent {
                    continue;
                }
                let cat_name = cat_entry.file_name().to_string_lossy().to_string();
                if !cat_name.to_lowercase().starts_with(&char_prefix.to_lowercase()) {
                    continue;
                }

                if let Ok(other_mod_entries) = fs::read_dir(&cat_p) {
                    for ome in other_mod_entries.flatten() {
                        let other_mod_p = ome.path();
                        if !other_mod_p.is_dir() {
                            continue;
                        }

                        let raw_mod_name = ome.file_name().to_string_lossy().to_string();
                        let clean_mod_name = raw_mod_name
                            .trim_start_matches("DISABLED ")
                            .trim_start_matches("DISABLED_")
                            .to_string();

                        let mut other_bufs = Vec::new();
                        if let Ok(other_files) = fs::read_dir(&other_mod_p) {
                            for of in other_files.flatten() {
                                let ofp = of.path();
                                if ofp.is_file() {
                                    let ofn = of.file_name().to_string_lossy().to_string();
                                    if ofn.ends_with(".buf") || ofn.ends_with(".ib") {
                                        other_bufs.push(ofn);
                                    }
                                } else if ofp.is_dir() {
                                    if let Ok(nested_files) = fs::read_dir(&ofp) {
                                        for nf in nested_files.flatten() {
                                            let nfn = nf.file_name().to_string_lossy().to_string();
                                            if nfn.ends_with(".buf") || nfn.ends_with(".ib") {
                                                other_bufs.push(nfn);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if other_bufs.is_empty() {
                            continue;
                        }

                        let mut matched_count = 0;
                        let mut matched_names = Vec::new();
                        for req in &req_buffers {
                            if other_bufs.iter().any(|b| b.eq_ignore_ascii_case(req)) {
                                matched_count += 1;
                                matched_names.push(req.clone());
                            }
                        }

                        let total_req = req_buffers.len();
                        let (confidence, match_details) = if total_req > 0 && matched_count == total_req {
                            (
                                "exact",
                                format!(
                                    "Exact Match from {}: {}/{} required mesh buffers found",
                                    cat_name, matched_count, total_req
                                ),
                            )
                        } else if matched_count > 0 {
                            (
                                "partial",
                                format!(
                                    "Partial Match from {}: {}/{} buffers matched ({})",
                                    cat_name,
                                    matched_count,
                                    total_req,
                                    matched_names.join(", ")
                                ),
                            )
                        } else {
                            (
                                "low",
                                format!("From {}: Contains {} 3D mesh buffers", cat_name, other_bufs.len()),
                            )
                        };

                        candidates.push(BaseModelCandidate {
                            folder_name: format!("{}/{}", cat_name, raw_mod_name),
                            display_name: format!("{} ({})", clean_mod_name, cat_name),
                            confidence: confidence.to_string(),
                            matched_buffers_count: matched_count,
                            total_required_buffers: total_req,
                            match_details,
                        });
                    }
                }
            }
        }
    }

    // Sort:
    // 1. Confidence rank (exact > partial > low)
    // 2. Active enabled status (enabled mods > disabled mods)
    // 3. Matched buffer count descending
    candidates.sort_by(|a, b| {
        let conf_rank = |conf: &str| match conf {
            "exact" => 3,
            "partial" => 2,
            "low" => 1,
            _ => 0,
        };
        let is_enabled = |name: &str| !name.starts_with("DISABLED ") && !name.starts_with("DISABLED_");

        conf_rank(&b.confidence)
            .cmp(&conf_rank(&a.confidence))
            .then_with(|| is_enabled(&b.folder_name).cmp(&is_enabled(&a.folder_name)))
            .then_with(|| b.matched_buffers_count.cmp(&a.matched_buffers_count))
    });

    (candidates, req_buffers)
}


// ── GameBanana 3D Preview Helpers & Commands ─────────────────────────────────

pub fn extract_archive_generic(archive_path: &Path, dest_dir: &Path, winrar_path: &str) -> Result<(), AppError> {
    let ext = archive_path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    if ext == "zip" {
        crate::install::extract_mod_zip(&archive_path.to_string_lossy(), &dest_dir.to_string_lossy())?;
        Ok(())
    } else if ext == "rar" || ext == "7z" {
        if let Some((tool_path, tool_type)) = crate::install::find_archive_tool(winrar_path) {
            crate::install::extract_rar_or_7z(archive_path, dest_dir, &tool_path, tool_type)
        } else {
            Err(AppError::Custom("WinRAR or 7-Zip is required to extract .rar or .7z files. Please configure it in Settings.".into()))
        }
    } else {
        Err(AppError::Custom(format!("Unsupported archive format: .{}", ext)))
    }
}

pub fn find_mod_root_in_extracted(dest_dir: &Path) -> PathBuf {
    let mut inis = Vec::new();
    find_ini_files(dest_dir, &mut inis, 0, 5);
    if let Some(first_ini) = inis.first() {
        if let Some(parent) = first_ini.parent() {
            return parent.to_path_buf();
        }
    }
    if let Ok(entries) = fs::read_dir(dest_dir) {
        let subdirs: Vec<PathBuf> = entries
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .collect();
        if subdirs.len() == 1 {
            return subdirs[0].clone();
        }
    }
    dest_dir.to_path_buf()
}


