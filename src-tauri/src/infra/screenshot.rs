use crate::error::AppError;
use std::path::Path;
use screenshots::Screen;
use image::imageops::crop_imm;
use image::RgbaImage;
use image::DynamicImage;

#[tauri::command]
pub async fn take_and_crop_screenshot(mod_path: String, x: u32, y: u32, width: u32, height: u32) -> Result<String, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let screens = Screen::all().map_err(|e| AppError::Custom(format!("Failed to get screens: {}", e)))?;
        if screens.is_empty() {
            return Err(AppError::Custom("No screens found".to_string()));
        }

        let screen = screens[0];
        let image = screen.capture().map_err(|e| AppError::Custom(format!("Failed to capture screen: {}", e)))?;
    
    // Ensure we don't crop out of bounds
    let screen_w = image.width();
    let screen_h = image.height();
    
    let crop_x = x;
    let crop_y = y;
    let mut crop_w = width;
    let mut crop_h = height;
    
    if crop_x + crop_w > screen_w {
        if screen_w > crop_x {
            crop_w = screen_w - crop_x;
        } else {
            return Err(AppError::Custom("Crop region is outside the screen bounds".to_string()));
        }
    }
    
    if crop_y + crop_h > screen_h {
        if screen_h > crop_y {
            crop_h = screen_h - crop_y;
        } else {
            return Err(AppError::Custom("Crop region is outside the screen bounds".to_string()));
        }
    }

    let raw_rgba = image.into_raw();
    
    let rgba_img = RgbaImage::from_raw(screen_w, screen_h, raw_rgba)
        .ok_or_else(|| AppError::Custom("Failed to parse image data".to_string()))?;
        
    let dynamic_img = DynamicImage::ImageRgba8(rgba_img);

    let cropped = crop_imm(&dynamic_img, crop_x, crop_y, crop_w, crop_h).to_image();
    
        let path = Path::new(&mod_path).join("preview.png");
        cropped.save(&path).map_err(|e| AppError::Custom(format!("Failed to save screenshot: {}", e)))?;
        
        Ok(path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}
