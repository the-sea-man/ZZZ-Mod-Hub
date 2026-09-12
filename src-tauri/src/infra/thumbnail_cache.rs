use crate::error::AppError;
use crate::utils::fnv1a_hash;
use image::imageops::FilterType;
use image::ImageFormat;
use rayon::prelude::*;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

/// Resolves the thumbnail directory under app_data_dir/thumbnails.
/// Creates the directory if it does not exist.
pub fn get_thumbnail_dir(app_handle: &AppHandle) -> Result<PathBuf, AppError> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Custom(format!("Failed to get app_data_dir: {}", e)))?;
    let thumb_dir = app_dir.join("thumbnails");
    if !thumb_dir.exists() {
        let _ = fs::create_dir_all(&thumb_dir);
    }
    Ok(thumb_dir)
}

/// Computes a cache key and path for a given image source path and its file mtime.
pub fn compute_thumbnail_path(thumb_dir: &Path, source_path: &str) -> (PathBuf, u64) {
    let mtime = fs::metadata(source_path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let path_hash = fnv1a_hash(source_path);
    let filename = format!("{:016x}_{}.jpg", path_hash, mtime);
    (thumb_dir.join(filename), path_hash)
}

/// Generates a lightweight 360x450 JPEG thumbnail from the source image.
/// INVARIANT: The original mod file is strictly read-only and NEVER modified, renamed, or deleted.
pub fn generate_thumbnail(source_path: &str, target_path: &Path) -> Result<(), AppError> {
    let img = image::open(source_path)
        .map_err(|e| AppError::Custom(format!("Failed to open image {}: {}", source_path, e)))?;

    // Downscale while preserving aspect ratio into a 360x450 boundary.
    // Triangle (bilinear) filter is extremely fast and high quality for downscaling preview cards.
    let thumb = img.resize(360, 450, FilterType::Triangle);

    if let Some(parent) = target_path.parent() {
        if !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }

    let mut out_file = fs::File::create(target_path)
        .map_err(|e| AppError::Custom(format!("Failed to create thumbnail file {:?}: {}", target_path, e)))?;

    thumb
        .write_to(&mut out_file, ImageFormat::Jpeg)
        .map_err(|e| AppError::Custom(format!("Failed to write thumbnail JPEG: {}", e)))?;

    Ok(())
}

/// Retrieves or creates a thumbnail for the specified image path.
/// Returns the absolute path of the cached thumbnail, or the original source_path on error.
pub fn get_or_create_thumbnail(source_path: &str, app_handle: &AppHandle) -> String {
    let thumb_dir = match get_thumbnail_dir(app_handle) {
        Ok(d) => d,
        Err(_) => return source_path.to_string(),
    };

    let (target_path, path_hash) = compute_thumbnail_path(&thumb_dir, source_path);

    // Cache hit: file already exists
    if target_path.exists() {
        return target_path.to_string_lossy().replace('\\', "/");
    }

    // Cache miss: generate thumbnail safely without altering original file
    if generate_thumbnail(source_path, &target_path).is_ok() {
        // Clean up older stale thumbnails for this same path hash
        cleanup_old_thumbnails(&thumb_dir, path_hash, &target_path);
        target_path.to_string_lossy().replace('\\', "/")
    } else {
        // Graceful fallback to original source
        source_path.to_string()
    }
}

/// Cleans up older thumbnail versions when an image file is modified.
fn cleanup_old_thumbnails(thumb_dir: &Path, path_hash: u64, current_thumb: &Path) {
    let prefix = format!("{:016x}_", path_hash);
    if let Ok(entries) = fs::read_dir(thumb_dir) {
        for entry in entries.filter_map(Result::ok) {
            let p = entry.path();
            if p != current_thumb {
                if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with(&prefix) && name.ends_with(".jpg") {
                        let _ = fs::remove_file(p);
                    }
                }
            }
        }
    }
}

/// Tauri command to get or generate a cached thumbnail for a single image.
#[tauri::command]
pub async fn get_cached_thumbnail(
    image_path: String,
    app: AppHandle,
) -> Result<String, AppError> {
    let image_path = crate::utils::expand_path(&image_path);
    tauri::async_runtime::spawn_blocking(move || {
        Ok(get_or_create_thumbnail(&image_path, &app))
    })
    .await
    .map_err(|e| AppError::Custom(format!("Join error: {}", e)))?
}

/// Tauri command to prewarm thumbnails for a list of image paths in parallel using Rayon.
#[tauri::command]
pub async fn prewarm_thumbnails(
    image_paths: Vec<String>,
    app: AppHandle,
) -> Result<usize, AppError> {
    let image_paths: Vec<String> = image_paths.into_iter().map(|p| crate::utils::expand_path(&p)).collect();
    tauri::async_runtime::spawn_blocking(move || {
        let count = image_paths
            .par_iter()
            .filter(|p| {
                let res = get_or_create_thumbnail(p, &app);
                res != **p
            })
            .count();
        Ok(count)
    })
    .await
    .map_err(|e| AppError::Custom(format!("Join error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_thumbnail_path_and_generation() {
        let unique_id = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_thumb_{}", unique_id));
        let _ = fs::create_dir_all(&temp_dir);

        let src_img_path = temp_dir.join("preview.png");

        // Create a synthetic 800x800 test image
        let img = image::RgbImage::new(800, 800);
        img.save_with_format(&src_img_path, ImageFormat::Png).unwrap();

        let thumb_dir = temp_dir.join("thumbnails");
        fs::create_dir_all(&thumb_dir).unwrap();

        let (target_path, _hash) = compute_thumbnail_path(&thumb_dir, src_img_path.to_str().unwrap());
        assert!(!target_path.exists());

        generate_thumbnail(src_img_path.to_str().unwrap(), &target_path).unwrap();
        assert!(target_path.exists());

        // Check thumbnail dimensions are bounded to 360x450
        let loaded = image::open(&target_path).unwrap();
        assert!(loaded.width() <= 360);
        assert!(loaded.height() <= 450);

        // Crucial invariant: Verify original source file was NOT modified or deleted!
        assert!(src_img_path.exists());

        let _ = fs::remove_dir_all(temp_dir);
    }
}
