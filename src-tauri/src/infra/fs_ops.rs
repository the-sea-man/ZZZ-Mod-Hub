use crate::error::AppError;
use crate::utils::{safe_remove_dir_all, safe_rename};
use std::fs;
use std::path::Path;

#[tauri::command]
pub fn set_category_mapping(category_path: &str, character_id: &str, skin_id: Option<String>) -> Result<String, AppError> {
    let cat_expanded = crate::utils::expand_path(category_path);
    let path = Path::new(&cat_expanded);
    if !path.exists() || !path.is_dir() {
        return Err("Category directory does not exist".into());
    }

    let json_path = path.join("category.json");
    let mut map = serde_json::Map::new();
    map.insert("character_id".to_string(), serde_json::Value::String(character_id.to_string()));
    if let Some(sid) = skin_id {
        map.insert("skin_id".to_string(), serde_json::Value::String(sid));
    }
    
    let content = serde_json::Value::Object(map);

    fs::write(&json_path, serde_json::to_string_pretty(&content).unwrap_or_default())?;

    Ok("Mapping saved".into())
}

fn validate_safe_mod_deletion_path(path: &Path) -> Result<(), AppError> {
    if path.to_string_lossy().contains("..") {
        return Err(AppError::Custom("Invalid path: contains '..'".into()));
    }
    if !path.exists() {
        return Ok(());
    }
    let canonical = path.canonicalize().map_err(AppError::Io)?;
    let components: Vec<_> = canonical.components().collect();
    if components.len() < 3 {
        return Err(AppError::Custom("Refusing to delete root or top-level directory".into()));
    }

    let path_str = canonical.to_string_lossy().to_lowercase();
    let forbidden_substrings = [
        "\\windows",
        "\\system32",
        "\\program files",
        "\\program files (x86)",
        "\\appdata\\local\\microsoft",
    ];
    for forbidden in forbidden_substrings {
        if path_str.contains(forbidden) {
            return Err(AppError::Custom(format!(
                "Refusing to delete protected system path: {}",
                path.display()
            )));
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_mod(mod_path: String) -> Result<(), AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    tauri::async_runtime::spawn_blocking(move || {
        let path = std::path::Path::new(&mod_path);
        if path.exists() {
            validate_safe_mod_deletion_path(path)?;
            safe_remove_dir_all(path)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), AppError> {
    let path = crate::utils::expand_path(&path);
    #[cfg(target_os = "windows")]
    {
        let mut win_path = path.replace("/", "\\");
        if win_path.starts_with("\\\\?\\") {
            win_path = win_path[4..].to_string();
        }
        let p = std::path::Path::new(&win_path);
        if !p.exists() {
            return Err(AppError::Custom(format!("Path does not exist: {win_path}")));
        }
        if p.is_file() {
            std::process::Command::new("explorer")
                .arg(format!("/select,{}", win_path))
                .spawn()
                .map_err(AppError::Io)?;
        } else {
            std::process::Command::new("explorer")
                .arg(&win_path)
                .spawn()
                .map_err(AppError::Io)?;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let p = std::path::Path::new(&path);
        if !p.exists() {
            return Err(AppError::Custom(format!("Path does not exist: {path}")));
        }
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(AppError::Io)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_logs_folder(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Manager;
    if let Ok(app_dir) = app.path().app_data_dir() {
        let _ = fs::create_dir_all(&app_dir);
        let log_path = app_dir.join("app.log");
        if !log_path.exists() {
            let _ = fs::write(&log_path, "=== ZzzModManager Log ===\n");
        }
        open_folder(log_path.to_string_lossy().to_string()).await?;
    }
    Ok(())
}

#[tauri::command]
pub fn move_to_unassigned(mod_paths: Vec<String>, root_path: String) -> Result<String, AppError> {
    let root_expanded = crate::utils::expand_path(&root_path);
    let root = Path::new(&root_expanded);
    let unassigned_dir = root.join("Unassigned");
    
    if !unassigned_dir.exists() {
        fs::create_dir_all(&unassigned_dir)?;
    }

    let mut moved_count = 0;
    
    for mod_path_str in mod_paths {
        let mod_path_expanded = crate::utils::expand_path(&mod_path_str);
        let mod_path = Path::new(&mod_path_expanded);
        if !mod_path.exists() {
            continue;
        }
        
        if let Some(folder_name) = mod_path.file_name() {
            let target_path = unassigned_dir.join(folder_name);
            if !target_path.exists()
                && safe_rename(mod_path, &target_path).is_ok() {
                    moved_count += 1;
                }
        }
    }

    Ok(format!("Successfully moved {} mods to Unassigned.", moved_count))
}

#[tauri::command]
pub fn rename_mod(mod_path: String, new_name: String) -> Result<String, AppError> {
    let trimmed_name = new_name.trim();
    if trimmed_name.is_empty() || trimmed_name.contains('/') || trimmed_name.contains('\\') || trimmed_name.contains("..") {
        return Err("Invalid mod name: cannot contain path separators or '..'".into());
    }

    let mod_path = crate::utils::expand_path(&mod_path);
    let path = Path::new(&mod_path);
    if !path.exists() || !path.is_dir() {
        return Err("Mod directory does not exist".into());
    }
    
    let parent = path.parent().ok_or("No parent directory")?;
    let current_name = path.file_name()
        .ok_or("No folder name")?
        .to_string_lossy()
        .to_string();
    
    let final_new_name = if current_name.starts_with("DISABLED ") && !trimmed_name.starts_with("DISABLED ") {
        format!("DISABLED {}", trimmed_name)
    } else {
        trimmed_name.to_string()
    };
    
    let new_path = parent.join(&final_new_name);
    if new_path.exists() {
        return Err(format!("A mod named '{}' already exists here.", final_new_name).into());
    }
    
    safe_rename(path, &new_path)?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn move_mod_to_category(mod_path: String, target_category: String, root_path: String) -> Result<String, AppError> {
    let trimmed_cat = target_category.trim();
    if trimmed_cat.is_empty() || trimmed_cat.contains("..") || trimmed_cat.starts_with('/') || trimmed_cat.starts_with('\\') {
        return Err("Invalid target category: cannot contain '..' or leading path separators".into());
    }

    let mod_path = crate::utils::expand_path(&mod_path);
    let path = Path::new(&mod_path);
    if !path.exists() || !path.is_dir() {
        return Err("Mod directory does not exist".into());
    }
    
    let root_expanded = crate::utils::expand_path(&root_path);
    let root = Path::new(&root_expanded);
    let target_dir = root.join(trimmed_cat);
    
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir)?;
    }
    
    let folder_name = path.file_name()
        .ok_or("No folder name")?
        .to_string_lossy()
        .to_string();
    let new_path = target_dir.join(&folder_name);
    
    let clean_name = folder_name.strip_prefix("DISABLED ").unwrap_or(&folder_name);
    let enabled_path = target_dir.join(clean_name);
    let disabled_path = target_dir.join(format!("DISABLED {}", clean_name));
    if (enabled_path.exists() && path != enabled_path) || (disabled_path.exists() && path != disabled_path) {
        if path == new_path {
            return Ok(new_path.to_string_lossy().to_string());
        }
        return Err(format!("A mod named '{}' already exists in {}.", clean_name, target_category).into());
    }
    
    safe_rename(path, &new_path)?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn resolve_conflict(
    mod_path: String, 
    action: String, 
    new_name: Option<String>, 
    target_category: String, 
    root_path: String
) -> Result<String, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let path = Path::new(&mod_path);
    if !path.exists() || !path.is_dir() {
        return Err("Mod directory does not exist".into());
    }
    
    let root_expanded = crate::utils::expand_path(&root_path);
    let root = Path::new(&root_expanded);
    let target_dir = root.join(&target_category);
    
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir)?;
    }
    
    let current_name = path.file_name()
        .ok_or("No folder name")?
        .to_string_lossy()
        .to_string();
    
    let mut base_name = current_name.clone();
    if let Some(idx) = base_name.find("_conflict_") {
        base_name = base_name[..idx].to_string();
    }

    match action.as_str() {
        "replace" => {
            let base_enabled = base_name.strip_prefix("DISABLED ").unwrap_or(&base_name).to_string();
            let disabled_variant = format!("DISABLED {}", base_enabled);
            
            let enabled_path = target_dir.join(&base_enabled);
            if enabled_path.exists() {
                safe_remove_dir_all(&enabled_path)?;
            }
            
            let disabled_path = target_dir.join(&disabled_variant);
            if disabled_path.exists() {
                safe_remove_dir_all(&disabled_path)?;
            }
            
            let new_path = target_dir.join(&base_name);
            safe_rename(path, &new_path)?;
            Ok("Replaced successfully".into())
        },
        "rename" => {
            if let Some(n) = new_name {
                let final_new_name = if current_name.starts_with("DISABLED ") && !n.starts_with("DISABLED ") {
                    format!("DISABLED {}", n)
                } else {
                    n
                };
                let new_path = target_dir.join(&final_new_name);
                if new_path.exists() {
                    return Err(format!("A mod named '{}' already exists in {}.", final_new_name, target_category).into());
                }
                safe_rename(path, &new_path)?;
                Ok("Renamed successfully".into())
            } else {
                Err("New name required for rename action".into())
            }
        },
        "delete" => {
            safe_remove_dir_all(path)?;
            Ok("Deleted successfully".into())
        },
        _ => Err("Invalid action".into())
    }
}

#[tauri::command]
pub fn set_mod_preview_image(mod_path: String, image_path: String) -> Result<String, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let image_path = crate::utils::expand_path(&image_path);
    let m_path = Path::new(&mod_path);
    if !m_path.exists() || !m_path.is_dir() {
        return Err("Mod directory does not exist".into());
    }

    let i_path = Path::new(&image_path);
    if !i_path.exists() || !i_path.is_file() {
        return Err("Image file does not exist".into());
    }

    let ext = i_path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
    if ext != "png" && ext != "jpg" && ext != "jpeg" {
        return Err("Only PNG and JPG images are supported".into());
    }

    for e in ["png", "jpg", "jpeg"] {
        let existing = m_path.join(format!("preview.{}", e));
        if existing.exists() {
            let _ = std::fs::remove_file(existing);
        }
    }

    let target_path = m_path.join(format!("preview.{}", ext));
    std::fs::copy(i_path, &target_path)?;

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_mod_preview_base64(mod_path: String, base64_data: String) -> Result<String, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let m_path = Path::new(&mod_path);
    if !m_path.exists() || !m_path.is_dir() {
        return Err("Mod directory does not exist".into());
    }

    let raw_b64 = if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };

    use base64::Engine;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(raw_b64.trim())
        .map_err(|e| AppError::Custom(format!("Invalid base64 image data: {}", e)))?;

    for e in ["png", "jpg", "jpeg", "webp"] {
        let existing = m_path.join(format!("preview.{}", e));
        if existing.exists() {
            let _ = std::fs::remove_file(existing);
        }
    }

    let target_path = m_path.join("preview.png");
    std::fs::write(&target_path, decoded)?;

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_mod_note(mod_path: String, note: String) -> Result<String, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let m_path = Path::new(&mod_path);
    if !m_path.exists() || !m_path.is_dir() {
        return Err("Mod directory does not exist".into());
    }

    let meta_path = m_path.join(".zmm-meta.json");
    let mut meta = if meta_path.exists() {
        let content = fs::read_to_string(&meta_path)?;
        serde_json::from_str::<crate::models::ModMeta>(&content).unwrap_or_default()
    } else {
        crate::models::ModMeta::default()
    };

    meta.notes = Some(note);

    let new_content = serde_json::to_string_pretty(&meta)?;
    fs::write(&meta_path, new_content)?;

    Ok("Note updated successfully".into())
}

#[tauri::command]
pub fn set_mod_tags(mod_path: String, tags: Vec<String>) -> Result<String, AppError> {
    let mod_path = crate::utils::expand_path(&mod_path);
    let m_path = Path::new(&mod_path);
    if !m_path.exists() || !m_path.is_dir() {
        return Err("Mod directory does not exist".into());
    }

    let meta_path = m_path.join(".zmm-meta.json");
    let mut meta = if meta_path.exists() {
        let content = fs::read_to_string(&meta_path)?;
        serde_json::from_str::<crate::models::ModMeta>(&content).unwrap_or_default()
    } else {
        crate::models::ModMeta::default()
    };

    meta.tags = Some(tags);

    let new_content = serde_json::to_string_pretty(&meta)?;
    fs::write(&meta_path, new_content)?;

    Ok("Tags updated successfully".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_deletion_rejects_top_level_and_traversal() {
        // Relative path with ..
        let res = validate_safe_mod_deletion_path(Path::new("some/path/../forbidden"));
        assert!(res.is_err(), "Must reject path with '..'");

        // Windows root & system paths
        #[cfg(windows)]
        {
            let res_root = validate_safe_mod_deletion_path(Path::new("C:\\"));
            assert!(res_root.is_err(), "Must reject drive root");

            let res_win = validate_safe_mod_deletion_path(Path::new("C:\\Windows"));
            assert!(res_win.is_err(), "Must reject Windows directory");
        }
    }

    #[test]
    fn test_rename_mod_rejects_path_traversal() {
        let res1 = rename_mod("C:\\Mods\\mod1".into(), "../escaped".into());
        assert!(res1.is_err(), "Must reject rename with ..");

        let res2 = rename_mod("C:\\Mods\\mod1".into(), "sub/folder".into());
        assert!(res2.is_err(), "Must reject rename with /");
    }

    #[test]
    fn test_move_mod_to_category_rejects_path_traversal() {
        let res = move_mod_to_category(
            "C:\\Mods\\mod1".into(),
            "../../System32".into(),
            "C:\\Mods".into(),
        );
        assert!(res.is_err(), "Must reject move with ..");
    }
}
