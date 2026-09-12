//! 3D Mod Viewer — Modularized architecture
//!
//! Reads INI override sections to discover buffer bindings (vb0/ib/ps-t0),
//! decodes binary .buf files into position/UV/index arrays, and converts
//! DDS textures to PNG for browser display.

pub mod types;
pub mod buffer_reader;
pub mod texture_decoder;
pub mod ini_parser;
pub mod retexture;

#[cfg(test)]
mod tests;

pub use types::*;
pub use retexture::{extract_archive_generic, find_mod_root_in_extracted};

use crate::error::AppError;
use crate::utils::find_ini_files;
use buffer_reader::*;
use ini_parser::*;
use retexture::*;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use texture_decoder::*;

pub fn parse_mod(
    mod_path: &str,
    base_model_folder: Option<String>,
    quality: Option<&str>,
) -> Result<ViewerPayload, AppError> {
    parse_mod_with_cancel(mod_path, base_model_folder, quality, None)
}

pub fn parse_mod_with_cancel(
    mod_path: &str,
    base_model_folder: Option<String>,
    quality: Option<&str>,
    cancel_token: Option<&Arc<AtomicBool>>,
) -> Result<ViewerPayload, AppError> {
    if let Some(token) = cancel_token {
        if token.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }
    }

    let mod_dir = Path::new(mod_path);
    if !mod_dir.exists() || !mod_dir.is_dir() {
        return Err("Mod directory does not exist".into());
    }

    // Check if the mod directory contains its own .buf / .ib geometry files (recursively)
    fn count_geometry_files_recursive(dir: &Path, depth: usize, max_depth: usize) -> usize {
        if depth > max_depth {
            return 0;
        }
        let mut count = 0;
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    let n = p.to_string_lossy().to_lowercase();
                    if n.ends_with(".buf") || n.ends_with(".ib") {
                        count += 1;
                    }
                } else if p.is_dir() {
                    count += count_geometry_files_recursive(&p, depth + 1, max_depth);
                }
            }
        }
        count
    }
    let own_geometry_count = count_geometry_files_recursive(mod_dir, 0, 6);
    let is_retexture = own_geometry_count == 0;
    // Discover all active INI files (skipping backups/disabled)
    let mut ini_files = Vec::new();
    find_ini_files(mod_dir, &mut ini_files, 0, 5);

    if ini_files.is_empty() {
        return Err("No INI files found in mod folder".into());
    }

    // Parse all INI sections from all discovered files
    let mut all_sections = Vec::new();
    for ini_path in &ini_files {
        match parse_ini_sections(ini_path) {
            Ok(sections) => all_sections.extend(sections),
            Err(e) => {
                tracing::warn!("Failed to parse INI {}: {}", ini_path.display(), e);
            }
        }
    }

    let clues = if is_retexture {
        extract_mod_clues(mod_dir, &all_sections)
    } else {
        Vec::new()
    };

    let (candidates, _req_buffers) = if is_retexture {
        discover_base_model_candidates(mod_dir, &all_sections)
    } else {
        (Vec::new(), Vec::new())
    };

    // Determine target base model folder:
    // 1. If base_model_folder is explicitly passed (folder name, relative path, or absolute path):
    //    - if "none", chosen is None
    //    - resolve candidate path from parent, grandparent, or absolute directory
    // 2. If None:
    //    - if top candidate has confidence == "exact" or matched_buffers_count > 0, auto-select it
    //    - else None (do NOT arbitrarily pick an unrelated candidate)
    let chosen_base_path: Option<PathBuf> = if is_retexture {
        if let Some(ref folder) = base_model_folder {
            if folder.eq_ignore_ascii_case("none") || folder.is_empty() {
                None
            } else {
                let p = Path::new(folder);
                if p.is_absolute() && p.is_dir() {
                    Some(p.to_path_buf())
                } else if let Some(parent) = mod_dir.parent() {
                    let cand1 = parent.join(folder);
                    if cand1.is_dir() {
                        Some(cand1)
                    } else if let Some(grandparent) = parent.parent() {
                        let cand2 = grandparent.join(folder);
                        if cand2.is_dir() {
                            Some(cand2)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
        } else {
            // Auto-select ONLY if we have high/partial confidence match
            if let Some(top) = candidates.first() {
                if top.confidence == "exact" || top.matched_buffers_count > 0 {
                    if let Some(parent) = mod_dir.parent() {
                        let p1 = parent.join(&top.folder_name);
                        if p1.is_dir() {
                            Some(p1)
                        } else if let Some(grandparent) = parent.parent() {
                            let p2 = grandparent.join(&top.folder_name);
                            if p2.is_dir() {
                                Some(p2)
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        }
    } else {
        None
    };

    let base_model_source = chosen_base_path.as_ref().map(|p| {
        p.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    });

    // Merge sections: parse base model INIs if base folder is chosen
    let combined_sections = if let Some(ref base_path) = chosen_base_path {
        let mut base_ini_files = Vec::new();
        find_ini_files(base_path, &mut base_ini_files, 0, 5);
        let mut base_sections = Vec::new();
        for bp in &base_ini_files {
            if let Ok(secs) = parse_ini_sections(bp) {
                base_sections.extend(secs);
            }
        }
        // Base sections provide geometry & draw groups; retexture sections provide texture overrides
        let mut combined = base_sections;
        combined.extend(all_sections.clone());
        combined
    } else {
        all_sections.clone()
    };

    let toggles = extract_ini_toggles(&combined_sections);

    // Extract draw groups using multi-pass resolution with chosen base folder
    let groups = extract_draw_groups(&combined_sections, mod_dir, chosen_base_path.as_deref());
    if groups.is_empty() {
        if is_retexture {
            let suggested_tags = compute_suggested_tags(true, &[], &HashMap::new(), &toggles);
            return Ok(ViewerPayload {
                meshes: Vec::new(),
                textures: HashMap::new(),
                is_retexture: true,
                base_model_source: None,
                clues,
                base_model_candidates: candidates,
                toggles,
                suggested_tags,
                temp_install_path: None,
                archive_file_name: None,
            });
        }
        return Err("No renderable draw groups found in INI files".into());
    }


    let is_potato = quality
        .map(|q| !q.eq_ignore_ascii_case("balanced") && !q.eq_ignore_ascii_case("high") && !q.eq_ignore_ascii_case("full"))
        .unwrap_or(true);
    let max_tex_dim: u32 = if is_potato {
        512
    } else if quality.map(|q| q.eq_ignore_ascii_case("high") || q.eq_ignore_ascii_case("full")).unwrap_or(false) {
        2048
    } else {
        1024
    };

    let mut meshes: Vec<MeshData> = Vec::new();
    let mut textures: HashMap<String, String> = HashMap::new();
    let mut buf_cache: HashMap<PathBuf, Vec<u8>> = HashMap::new();

    // Pre-collect all unique texture paths across all groups and convert in parallel with Rayon
    use rayon::prelude::*;
    let mut unique_tex_paths: HashSet<PathBuf> = HashSet::new();
    for g in &groups {
        if let Some(ref p) = g.diffuse_file {
            if p.exists() {
                unique_tex_paths.insert(p.clone());
            }
        }
        // In potato mode, skip secondary maps (normal, light, material) for instant preview!
        if !is_potato {
            if let Some(ref p) = g.normal_file {
                if p.exists() {
                    unique_tex_paths.insert(p.clone());
                }
            }
            if let Some(ref p) = g.light_file {
                if p.exists() {
                    unique_tex_paths.insert(p.clone());
                }
            }
            if let Some(ref p) = g.material_file {
                if p.exists() {
                    unique_tex_paths.insert(p.clone());
                }
            }
        }
    }

    let cancel_token_clone = cancel_token.cloned();
    let converted_textures: Vec<(PathBuf, String)> = unique_tex_paths
        .into_par_iter()
        .filter_map(|p| {
            if let Some(ref token) = cancel_token_clone {
                if token.load(Ordering::Relaxed) {
                    return None;
                }
            }
            let uri = convert_texture_to_data_uri(&p, max_tex_dim)?;
            Some((p, uri))
        })
        .collect();

    if let Some(token) = cancel_token {
        if token.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }
    }

    let tex_file_map: HashMap<PathBuf, String> = converted_textures.into_iter().collect();

    for group in &groups {
        if let Some(token) = cancel_token {
            if token.load(Ordering::Relaxed) {
                return Err(AppError::Cancelled);
            }
        }

        let pos_path = &group.position_file;
        let ib_path = &group.ib_file;

        if !pos_path.exists() || !ib_path.exists() {
            continue;
        }

        // Read position buffer (with in-memory cache)
        let pos_data = if let Some(cached) = buf_cache.get(pos_path) {
            cached.clone()
        } else {
            let data = read_buffer(pos_path)?;
            buf_cache.insert(pos_path.clone(), data.clone());
            data
        };

        // Read texcoord buffer (optional, with in-memory cache)
        let tc_data = group.texcoord_file.as_ref().and_then(|tc_path| {
            if !tc_path.exists() {
                return None;
            }
            if let Some(cached) = buf_cache.get(tc_path) {
                Some(cached.clone())
            } else {
                match read_buffer(tc_path) {
                    Ok(data) => {
                        buf_cache.insert(tc_path.clone(), data.clone());
                        Some(data)
                    }
                    Err(_) => None,
                }
            }
        });

        // Read index buffer (with in-memory cache)
        let ib_data = if let Some(cached) = buf_cache.get(ib_path) {
            cached.clone()
        } else {
            let data = read_buffer(ib_path)?;
            buf_cache.insert(ib_path.clone(), data.clone());
            data
        };

        // Decode positions
        let all_positions = read_positions(&pos_data, group.position_stride);

        // Detect and decode UVs
        let all_uvs = tc_data.as_ref().map(|tc| {
            let (uv_off, uv_fmt) = detect_uv_best(tc, group.texcoord_stride);
            read_texcoords(tc, group.texcoord_stride, uv_off, uv_fmt)
        });

        // Resolve diffuse texture
        let tex_key = group.diffuse_file.as_ref().and_then(|tex_path| {
            let uri = tex_file_map.get(tex_path)?;
            let rel_path = tex_path
                .strip_prefix(mod_dir)
                .ok()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|| tex_path.file_name().unwrap_or_default().to_string_lossy().to_string());
            let key = format!("diffuse::{}", rel_path);
            if !textures.contains_key(&key) {
                textures.insert(key.clone(), uri.clone());
            }
            Some(key)
        });

        // Resolve normal map (skipped in potato mode)
        let normal_key = if is_potato {
            None
        } else {
            group.normal_file.as_ref().and_then(|tex_path| {
                let uri = tex_file_map.get(tex_path)?;
                let rel_path = tex_path
                    .strip_prefix(mod_dir)
                    .ok()
                    .map(|p| p.to_string_lossy().replace('\\', "/"))
                    .unwrap_or_else(|| tex_path.file_name().unwrap_or_default().to_string_lossy().to_string());
                let key = format!("normal::{}", rel_path);
                if !textures.contains_key(&key) {
                    textures.insert(key.clone(), uri.clone());
                }
                Some(key)
            })
        };

        // Resolve light map (skipped in potato mode)
        let light_key = if is_potato {
            None
        } else {
            group.light_file.as_ref().and_then(|tex_path| {
                let uri = tex_file_map.get(tex_path)?;
                let rel_path = tex_path
                    .strip_prefix(mod_dir)
                    .ok()
                    .map(|p| p.to_string_lossy().replace('\\', "/"))
                    .unwrap_or_else(|| tex_path.file_name().unwrap_or_default().to_string_lossy().to_string());
                let key = format!("light::{}", rel_path);
                if !textures.contains_key(&key) {
                    textures.insert(key.clone(), uri.clone());
                }
                Some(key)
            })
        };

        // Resolve material map (skipped in potato mode)
        let material_key = if is_potato {
            None
        } else {
            group.material_file.as_ref().and_then(|tex_path| {
                let uri = tex_file_map.get(tex_path)?;
                let rel_path = tex_path
                    .strip_prefix(mod_dir)
                    .ok()
                    .map(|p| p.to_string_lossy().replace('\\', "/"))
                    .unwrap_or_else(|| tex_path.file_name().unwrap_or_default().to_string_lossy().to_string());
                let key = format!("material::{}", rel_path);
                if !textures.contains_key(&key) {
                    textures.insert(key.clone(), uri.clone());
                }
                Some(key)
            })
        };

        // Process each draw call in the group
        for (draw_idx, draw) in group.draws.iter().enumerate() {
            let raw_indices =
                read_indices(&ib_data, draw.start, draw.count, group.index_size);
            if raw_indices.is_empty() {
                continue;
            }

            // Compact vertices: only keep referenced ones
            let compacted = compact_vertices(
                &all_positions,
                all_uvs.as_deref(),
                &raw_indices,
                draw.base,
            );

            let (compact_pos, compact_uv, remapped_idx) = match compacted {
                Some(c) => c,
                None => continue,
            };

            if compact_pos.is_empty() || remapped_idx.is_empty() {
                continue;
            }

            let name = if group.draws.len() > 1 {
                format!("{} #{}", group.name, draw_idx + 1)
            } else {
                group.name.clone()
            };

            meshes.push(MeshData {
                name,
                positions: encode_f32_array(&compact_pos),
                uvs: compact_uv.as_ref().map(|uv| encode_f32_array(uv)),
                indices: encode_u32_array(&remapped_idx),
                tex_key: tex_key.clone(),
                normal_key: normal_key.clone(),
                light_key: light_key.clone(),
                material_key: material_key.clone(),
                component: Some(group.name.clone()),
                condition: draw.condition.clone(),
            });
        }
    }

    if meshes.is_empty() {
        if is_retexture {
            let suggested_tags = compute_suggested_tags(true, &[], &textures, &toggles);
            return Ok(ViewerPayload {
                meshes: Vec::new(),
                textures,
                is_retexture: true,
                base_model_source: None,
                clues,
                base_model_candidates: candidates,
                toggles,
                suggested_tags,
                temp_install_path: None,
                archive_file_name: None,
            });
        }
        return Err(
            "Could not extract any renderable meshes. The mod may have an unsupported layout."
                .into(),
        );
    }

    let suggested_tags = compute_suggested_tags(is_retexture, &meshes, &textures, &toggles);
    Ok(ViewerPayload {
        meshes,
        textures,
        is_retexture,
        base_model_source,
        clues,
        base_model_candidates: candidates,
        toggles,
        suggested_tags,
        temp_install_path: None,
        archive_file_name: None,
    })
}

// ── Tauri command ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn parse_mod_for_viewer(
    mod_path: String,
    base_model_folder: Option<String>,
    quality: Option<String>,
    task_id: Option<String>,
) -> Result<ViewerPayload, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let t_id = task_id.unwrap_or_else(|| format!("viewer:{}", mod_path));
    let guard = crate::task_manager::register_task(&t_id, "viewer");
    let cancel_token = guard.token();

    tokio::task::spawn_blocking(move || {
        let _guard = guard;
        parse_mod_with_cancel(&mod_path, base_model_folder, quality.as_deref(), Some(&cancel_token))
    })
    .await
    .map_err(|e| AppError::Custom(format!("Spawn blocking failed: {}", e)))?
}


#[tauri::command]
pub async fn preview_gamebanana_mod(
    download_url: String,
    file_name: String,
    winrar_path: String,
    task_id: Option<String>,
) -> Result<ViewerPayload, AppError> {
    let winrar_path = crate::utils::expand_path(&winrar_path);
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let preview_id = format!("preview_{}_{}", timestamp, rand::random::<u32>());
    let t_id = task_id.unwrap_or_else(|| format!("viewer:gb_{}", preview_id));
    let guard = crate::task_manager::register_task(&t_id, "viewer");
    let cancel_token = guard.token();

    let temp_base = std::env::temp_dir().join("zzz_mod_viewer_gb_previews").join(&preview_id);
    let archive_path = temp_base.join(&file_name);
    let extracted_dir = temp_base.join("extracted");

    fs::create_dir_all(&temp_base)?;
    fs::create_dir_all(&extracted_dir)?;

    // Download archive
    let client = reqwest::Client::builder()
        .user_agent("ZzzModManager/1.0")
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()?;

    guard.check_cancelled()?;

    let resp = client.get(&download_url).send().await?;
    if !resp.status().is_success() {
        let _ = fs::remove_dir_all(&temp_base);
        return Err(AppError::Custom(format!(
            "Failed to download GameBanana archive: HTTP {}",
            resp.status()
        )));
    }

    guard.check_cancelled()?;

    let bytes = resp.bytes().await?;
    fs::write(&archive_path, &bytes)?;

    guard.check_cancelled()?;

    // Extract archive
    if let Err(e) = extract_archive_generic(&archive_path, &extracted_dir, &winrar_path) {
        let _ = fs::remove_dir_all(&temp_base);
        return Err(e);
    }

    guard.check_cancelled()?;

    // Locate mod root
    let mod_root = find_mod_root_in_extracted(&extracted_dir);

    // Parse mod for viewer
    let mod_root_str = mod_root.to_string_lossy().to_string();
    let file_name_clone = file_name.clone();
    let temp_base_str = temp_base.to_string_lossy().to_string();

    let cancel_token_clone = cancel_token.clone();
    let mut payload = tokio::task::spawn_blocking(move || {
        let _guard = guard;
        parse_mod_with_cancel(&mod_root_str, None, None, Some(&cancel_token_clone))
    })
    .await
    .map_err(|e| AppError::Custom(format!("Spawn blocking failed: {}", e)))??;

    payload.temp_install_path = Some(temp_base_str);
    payload.archive_file_name = Some(file_name_clone);
    Ok(payload)
}

#[tauri::command]
pub fn discard_gamebanana_preview(temp_path: String) -> Result<(), AppError> {
    let p = Path::new(&temp_path);
    if p.exists() && p.starts_with(std::env::temp_dir()) {
        let _ = fs::remove_dir_all(p);
    }
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn commit_gamebanana_preview(
    app: tauri::AppHandle,
    temp_path: String,
    archive_file_name: String,
    root_path: String,
    winrar_path: String,
    target_category: Option<String>,
    gb_mod_id: Option<u64>,
    author: Option<String>,
    source_url: Option<String>,
) -> Result<Vec<crate::models::InstallResult>, AppError> {
    let temp_p = PathBuf::from(&temp_path);
    let archive_path = temp_p.join(&archive_file_name);
    if !archive_path.exists() {
        return Err(AppError::Custom("Archive file not found in preview cache".into()));
    }

    let archive_str = archive_path.to_string_lossy().to_string();
    let archive_file_name_clone = archive_file_name.clone();
    let res = tokio::task::spawn_blocking(move || {
        crate::install::install_mods(
            app,
            vec![archive_str],
            root_path,
            winrar_path,
            target_category,
            gb_mod_id,
            author,
            source_url,
            None,
            Some(archive_file_name_clone),
        )
    })
    .await
    .map_err(|e| AppError::Custom(format!("Install task failed: {}", e)))??;

    let _ = fs::remove_dir_all(&temp_p);
    Ok(res)
}


