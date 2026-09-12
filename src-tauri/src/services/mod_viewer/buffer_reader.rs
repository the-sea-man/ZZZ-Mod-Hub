//! Binary buffer readers and geometry compaction for 3D Mod Viewer.

use crate::error::AppError;
use super::types::*;
use byteorder::{LittleEndian, ReadBytesExt};
use half::f16;
use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::Path;

/// Read a binary buffer file with size validation.
pub fn read_buffer(path: &Path) -> Result<Vec<u8>, AppError> {
    let meta = fs::metadata(path)?;
    if meta.len() > MAX_BUFFER_FILE_BYTES {
        return Err(format!(
            "Buffer file too large: {} MiB (limit {} MiB)",
            meta.len() / (1024 * 1024),
            MAX_BUFFER_FILE_BYTES / (1024 * 1024)
        )
        .into());
    }
    Ok(fs::read(path)?)
}

/// Read vertex positions from a position buffer.
/// Each vertex is float32 x,y,z at the start of each stride.
pub fn read_positions(data: &[u8], stride: usize) -> Vec<f32> {
    let effective_stride = if stride >= 12 { stride } else { DEFAULT_POSITION_STRIDE };
    let mut positions = Vec::new();
    let mut offset = DEFAULT_POSITION_OFFSET;
    while offset + 12 <= data.len() {
        let mut cursor = Cursor::new(&data[offset..offset + 12]);
        if let (Ok(x), Ok(y), Ok(z)) = (
            cursor.read_f32::<LittleEndian>(),
            cursor.read_f32::<LittleEndian>(),
            cursor.read_f32::<LittleEndian>(),
        ) {
            if x.is_finite() && y.is_finite() && z.is_finite() {
                positions.push(x);
                positions.push(y);
                positions.push(z);
            } else {
                positions.push(0.0);
                positions.push(0.0);
                positions.push(0.0);
            }
        }
        offset += effective_stride;
    }
    positions
}

/// Detect the best UV format and offset by sampling the buffer.
/// Port of mod_viewer's `_detect_uv_best()` heuristic.
pub fn detect_uv_best(data: &[u8], stride: usize) -> (usize, UvFormat) {
    let total = data.len().checked_div(stride).unwrap_or(0);
    if total == 0 {
        return (DEFAULT_UV_OFFSET, UvFormat::Float16);
    }

    let sample_count = 4096.min(total);
    let step = (total / sample_count).max(1);

    struct Candidate {
        both_live: bool,
        in_range_ratio: f64,
        spread: f64,
        uv_offset: usize,
        format: UvFormat,
    }

    let mut candidates: Vec<Candidate> = Vec::new();

    for &uv_off in &[0usize, 4] {
        for &(fmt, fmt_size) in &[(UvFormat::Float16, 4usize), (UvFormat::Float32, 8)] {
            if uv_off + fmt_size > stride {
                continue;
            }

            let mut us = Vec::new();
            let mut vs = Vec::new();
            let mut sampled = 0usize;

            for i in (0..total).step_by(step) {
                let off = i * stride + uv_off;
                if off + fmt_size > data.len() {
                    break;
                }
                sampled += 1;

                let (u, v) = match fmt {
                    UvFormat::Float16 => {
                        let mut cursor = Cursor::new(&data[off..off + 4]);
                        let u_bits = cursor.read_u16::<LittleEndian>().unwrap_or(0);
                        let v_bits = cursor.read_u16::<LittleEndian>().unwrap_or(0);
                        (
                            f16::from_bits(u_bits).to_f64(),
                            f16::from_bits(v_bits).to_f64(),
                        )
                    }
                    UvFormat::Float32 => {
                        let mut cursor = Cursor::new(&data[off..off + 8]);
                        let u = cursor.read_f32::<LittleEndian>().unwrap_or(0.0) as f64;
                        let v = cursor.read_f32::<LittleEndian>().unwrap_or(0.0) as f64;
                        (u, v)
                    }
                };

                if (-0.01..=2.0).contains(&u) && (-0.01..=2.0).contains(&v) {
                    us.push(u);
                    vs.push(v);
                }
            }

            if sampled == 0 || us.is_empty() {
                continue;
            }

            let in_range_ratio = us.len() as f64 / sampled as f64;
            if in_range_ratio < 0.95 {
                continue;
            }

            let du = us.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
                - us.iter().cloned().fold(f64::INFINITY, f64::min);
            let dv = vs.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
                - vs.iter().cloned().fold(f64::INFINITY, f64::min);

            let both_live = du >= 1e-4 && dv >= 1e-4;

            candidates.push(Candidate {
                both_live,
                in_range_ratio,
                spread: du + dv,
                uv_offset: uv_off,
                format: fmt,
            });
        }
    }

    if candidates.is_empty() {
        return (DEFAULT_UV_OFFSET, UvFormat::Float16);
    }

    // Sort: both_live first, then in_range_ratio desc, then spread desc
    candidates.sort_by(|a, b| {
        b.both_live
            .cmp(&a.both_live)
            .then(
                b.in_range_ratio
                    .partial_cmp(&a.in_range_ratio)
                    .unwrap_or(std::cmp::Ordering::Equal),
            )
            .then(
                b.spread
                    .partial_cmp(&a.spread)
                    .unwrap_or(std::cmp::Ordering::Equal),
            )
    });

    (candidates[0].uv_offset, candidates[0].format)
}

/// Read UV coordinates from a texcoord buffer.
/// Returns float32 pairs with V flipped for Three.js (v → 1.0 - v).
pub fn read_texcoords(
    data: &[u8],
    stride: usize,
    uv_offset: usize,
    format: UvFormat,
) -> Vec<f32> {
    let fmt_size = match format {
        UvFormat::Float16 => 4,
        UvFormat::Float32 => 8,
    };
    let effective_stride = if stride >= fmt_size { stride } else { 24 };

    let mut uvs = Vec::new();
    let mut offset = uv_offset;

    while offset + fmt_size <= data.len() {
        let (u, v) = match format {
            UvFormat::Float16 => {
                let mut cursor = Cursor::new(&data[offset..offset + 4]);
                let u_bits = cursor.read_u16::<LittleEndian>().unwrap_or(0);
                let v_bits = cursor.read_u16::<LittleEndian>().unwrap_or(0);
                (
                    f16::from_bits(u_bits).to_f32(),
                    f16::from_bits(v_bits).to_f32(),
                )
            }
            UvFormat::Float32 => {
                let mut cursor = Cursor::new(&data[offset..offset + 8]);
                let u = cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                let v = cursor.read_f32::<LittleEndian>().unwrap_or(0.0);
                (u, v)
            }
        };

        if u.is_finite() && v.is_finite() {
            uvs.push(u);
            uvs.push(1.0 - v); // Flip V for Three.js
        } else {
            uvs.push(0.0);
            uvs.push(0.0);
        }

        offset += effective_stride;
    }
    uvs
}

/// Read index buffer values. Supports both uint16 and uint32 formats.
pub fn read_indices(
    data: &[u8],
    start: usize,
    count: usize,
    index_size: usize,
) -> Vec<u32> {
    let safe_index_size = if index_size == INDEX_SIZE_U32 {
        INDEX_SIZE_U32
    } else {
        INDEX_SIZE_U16
    };
    let total = data.len() / safe_index_size;
    let effective_count = if count == 0 {
        total.saturating_sub(start)
    } else {
        count
    };
    let end = (start + effective_count).min(total);

    let mut indices = Vec::with_capacity(end.saturating_sub(start));
    for i in start..end {
        let off = i * safe_index_size;
        if off + safe_index_size > data.len() {
            break;
        }
        let value = if safe_index_size == INDEX_SIZE_U16 {
            let mut cursor = Cursor::new(&data[off..off + 2]);
            cursor.read_u16::<LittleEndian>().unwrap_or(0) as u32
        } else {
            let mut cursor = Cursor::new(&data[off..off + 4]);
            cursor.read_u32::<LittleEndian>().unwrap_or(0)
        };
        indices.push(value);
    }
    indices
}

pub type CompactedMesh = (Vec<f32>, Option<Vec<f32>>, Vec<u32>);

/// Compact vertex data: only export vertices actually referenced by valid triangles.
/// Discards primitive restarts (0xFFFF / 0xFFFFFFFF) and out-of-bounds indices at the triangle level
/// rather than discarding the entire mesh.
/// Returns (compacted_positions, compacted_uvs, remapped_indices).
pub fn compact_vertices(
    all_positions: &[f32],
    all_uvs: Option<&[f32]>,
    raw_indices: &[u32],
    base: i32,
) -> Option<CompactedMesh> {
    let vertex_count = all_positions.len() / 3;
    if vertex_count == 0 || raw_indices.len() < 3 {
        return None;
    }

    // Process indices in triangle triplets to filter out DirectX primitive restarts
    // (0xFFFF / 0xFFFFFFFF) and out-of-bounds indices without dropping the entire mesh.
    let mut valid_adjusted: Vec<usize> = Vec::with_capacity(raw_indices.len());
    for chunk in raw_indices.as_chunks::<3>().0 {
        let (r0, r1, r2) = (chunk[0], chunk[1], chunk[2]);
        // Check for primitive restart / strip cut markers
        if r0 == 0xFFFF || r1 == 0xFFFF || r2 == 0xFFFF
            || r0 == 0xFFFF_FFFF || r1 == 0xFFFF_FFFF || r2 == 0xFFFF_FFFF
        {
            continue;
        }

        let a0 = r0 as i64 + base as i64;
        let a1 = r1 as i64 + base as i64;
        let a2 = r2 as i64 + base as i64;

        if a0 >= 0 && (a0 as usize) < vertex_count
            && a1 >= 0 && (a1 as usize) < vertex_count
            && a2 >= 0 && (a2 as usize) < vertex_count
        {
            valid_adjusted.push(a0 as usize);
            valid_adjusted.push(a1 as usize);
            valid_adjusted.push(a2 as usize);
        }
    }

    if valid_adjusted.is_empty() {
        return None;
    }

    // Collect unique referenced vertices
    let mut used: Vec<usize> = valid_adjusted.clone();
    used.sort_unstable();
    used.dedup();

    // Build remap table
    let mut remap: HashMap<usize, u32> = HashMap::with_capacity(used.len());
    for (new_idx, &old_idx) in used.iter().enumerate() {
        remap.insert(old_idx, new_idx as u32);
    }

    // Compact positions
    let mut compact_pos = Vec::with_capacity(used.len() * 3);
    for &vi in &used {
        let off = vi * 3;
        compact_pos.push(all_positions[off]);
        compact_pos.push(all_positions[off + 1]);
        compact_pos.push(all_positions[off + 2]);
    }

    // Compact UVs
    let compact_uv = all_uvs.map(|uvs| {
        let uv_vertex_count = uvs.len() / 2;
        let mut compact = Vec::with_capacity(used.len() * 2);
        for &vi in &used {
            if vi < uv_vertex_count {
                let off = vi * 2;
                compact.push(uvs[off]);
                compact.push(uvs[off + 1]);
            } else {
                compact.push(0.0);
                compact.push(0.0);
            }
        }
        compact
    });

    // Remap indices
    let remapped: Vec<u32> = valid_adjusted
        .iter()
        .map(|&i| *remap.get(&i).unwrap_or(&0))
        .collect();

    Some((compact_pos, compact_uv, remapped))
}


pub fn encode_f32_array(data: &[f32]) -> String {
    let bytes: Vec<u8> = data
        .iter()
        .flat_map(|&f| f.to_le_bytes())
        .collect();
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)
}

pub fn encode_u32_array(data: &[u32]) -> String {
    let bytes: Vec<u8> = data
        .iter()
        .flat_map(|&i| i.to_le_bytes())
        .collect();
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)
}


