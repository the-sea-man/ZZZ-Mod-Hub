//! DDS decoding, mipmap selection, and PNG encoding for 3D Mod Viewer.

use std::fs;
use std::io::Cursor;
use std::path::Path;


pub const MAX_TEXTURE_FILE_BYTES: u64 = 128 * 1024 * 1024; // 128 MiB

/// Convert a DDS or image file to a base64 PNG data URI for browser display.
pub fn convert_texture_to_data_uri(path: &Path, max_dim: u32) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    if meta.len() == 0 || meta.len() > MAX_TEXTURE_FILE_BYTES {
        return None;
    }
    let data = fs::read(path).ok()?;

    // 1. Try decoding with image_dds (BC1/BC2/BC3/BC4/BC5/BC7 support)
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext == "dds" || (data.len() >= 4 && &data[0..4] == b"DDS ") {
        if let Ok(dds) = image_dds::ddsfile::Dds::read(Cursor::new(&data)) {
            // Select appropriate mipmap level that fits within max_dim to avoid slow 4K decompression
            let mut mipmap = 0;
            let mut w = dds.header.width;
            let mut h = dds.header.height;
            let max_mip = dds.header.mip_map_count.unwrap_or(1);
            while (w > max_dim || h > max_dim) && mipmap + 1 < max_mip {
                w = (w / 2).max(1);
                h = (h / 2).max(1);
                mipmap += 1;
            }

            let decoded_res = image_dds::image_from_dds(&dds, mipmap).or_else(|orig_err| {
                if mipmap > 0 {
                    image_dds::image_from_dds(&dds, 0)
                } else {
                    Err(orig_err)
                }
            });

            if let Ok(rgba) = decoded_res {
                let img = image::DynamicImage::ImageRgba8(rgba);
                let scaled = if img.width() > max_dim || img.height() > max_dim {
                    img.thumbnail(max_dim, max_dim)
                } else {
                    img
                };

                let mut png_buf = Vec::new();
                let encoder = image::codecs::png::PngEncoder::new_with_quality(
                    &mut png_buf,
                    image::codecs::png::CompressionType::Fast,
                    image::codecs::png::FilterType::NoFilter,
                );
                if scaled.write_with_encoder(encoder).is_ok() {
                    let b64 = base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        &png_buf,
                    );
                    return Some(format!("data:image/png;base64,{}", b64));
                }
            }
        }
    }

    // 2. Try loading with the image crate (PNG, JPG, BMP, etc.)
    if let Ok(img) = image::load_from_memory(&data) {
        let scaled = if img.width() > max_dim || img.height() > max_dim {
            img.thumbnail(max_dim, max_dim)
        } else {
            img
        };

        let mut png_buf = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new_with_quality(
            &mut png_buf,
            image::codecs::png::CompressionType::Fast,
            image::codecs::png::FilterType::NoFilter,
        );
        if scaled.write_with_encoder(encoder).is_ok() {
            let b64 = base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                &png_buf,
            );
            return Some(format!("data:image/png;base64,{}", b64));
        }
    }

    // Direct PNG/JPEG base64 fallback
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "png" => {
            let b64 = base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                &data,
            );
            Some(format!("data:image/png;base64,{}", b64))
        }
        "jpg" | "jpeg" => {
            let b64 = base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                &data,
            );
            Some(format!("data:image/jpeg;base64,{}", b64))
        }
        _ => None,
    }
}


