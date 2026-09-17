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
    if character_id.trim().is_empty() {
        if json_path.exists() {
            let _ = fs::remove_file(&json_path);
        }
        return Ok("Mapping removed".into());
    }

    let mut map = serde_json::Map::new();
    map.insert("character_id".to_string(), serde_json::Value::String(character_id.to_string()));
    if let Some(sid) = skin_id {
        if !sid.trim().is_empty() {
            map.insert("skin_id".to_string(), serde_json::Value::String(sid));
        }
    }
    
    let content = serde_json::Value::Object(map);

    fs::write(&json_path, serde_json::to_string_pretty(&content).unwrap_or_default())?;

    Ok("Mapping saved".into())
}

#[tauri::command]
pub fn create_category_folder(
    root_path: String,
    folder_name: String,
    character_id: Option<String>,
    skin_id: Option<String>,
) -> Result<String, AppError> {
    let root_expanded = crate::utils::expand_path(&root_path);
    let root = Path::new(&root_expanded);
    if !root.exists() {
        fs::create_dir_all(root)?;
    }

    let trimmed = folder_name.trim();
    if trimmed.is_empty() || trimmed.contains("..") {
        return Err(AppError::Custom("Invalid folder name: cannot be empty or contain '..' path traversal".into()));
    }

    let safe_name = crate::services::install::types::sanitize_path_component(trimmed);
    let target_dir = root.join(&safe_name);

    if target_dir.exists() {
        return Err(AppError::Custom(format!("A folder named '{}' already exists.", safe_name)));
    }

    fs::create_dir_all(&target_dir)?;

    if let Some(cid) = character_id {
        if !cid.trim().is_empty() {
            let json_path = target_dir.join("category.json");
            let mut map = serde_json::Map::new();
            map.insert("character_id".to_string(), serde_json::Value::String(cid.trim().to_string()));
            if let Some(sid) = skin_id {
                if !sid.trim().is_empty() {
                    map.insert("skin_id".to_string(), serde_json::Value::String(sid.trim().to_string()));
                }
            }
            let content = serde_json::Value::Object(map);
            let _ = fs::write(&json_path, serde_json::to_string_pretty(&content).unwrap_or_default());
        }
    }

    crate::infra::logger::log_alteration(
        "create_folder",
        &safe_name,
        &target_dir.to_string_lossy(),
        "Created category folder",
        None,
        false,
    );

    Ok(safe_name)
}

#[tauri::command]
pub fn rename_category_folder(
    root_path: String,
    old_name: String,
    new_name: String,
) -> Result<String, AppError> {
    let root_expanded = crate::utils::expand_path(&root_path);
    let root = Path::new(&root_expanded);
    if !root.exists() || !root.is_dir() {
        return Err(AppError::Custom("Root directory does not exist".into()));
    }

    let old_trimmed = old_name.trim();
    let new_trimmed = new_name.trim();
    if old_trimmed.is_empty() || old_trimmed.contains("..") || new_trimmed.is_empty() || new_trimmed.contains("..") {
        return Err(AppError::Custom("Invalid folder name: cannot be empty or contain '..' path traversal".into()));
    }

    let old_dir = root.join(old_trimmed);
    if !old_dir.exists() || !old_dir.is_dir() {
        return Err(AppError::Custom(format!("Folder '{}' does not exist.", old_trimmed)));
    }

    // Protect essential system folders from being renamed
    let lower_old = old_trimmed.to_lowercase();
    if matches!(lower_old.as_str(), "unassigned" | "_conflicts" | ".staging") {
        return Err(AppError::Custom(format!("Essential system folder '{}' cannot be renamed.", old_trimmed)));
    }

    let safe_new_name = crate::services::install::types::sanitize_path_component(new_trimmed);
    let new_dir = root.join(&safe_new_name);

    if old_dir == new_dir {
        return Ok(safe_new_name);
    }

    if new_dir.exists() {
        return Err(AppError::Custom(format!("A folder named '{}' already exists.", safe_new_name)));
    }

    safe_rename(&old_dir, &new_dir)?;

    crate::infra::logger::log_alteration(
        "rename_folder",
        &safe_new_name,
        &new_dir.to_string_lossy(),
        &format!("Renamed category folder from '{}' to '{}'", old_trimmed, safe_new_name),
        None,
        false,
    );

    Ok(safe_new_name)
}

#[tauri::command]
pub async fn delete_category_folder(
    root_path: String,
    folder_name: String,
    force: bool,
) -> Result<(), AppError> {
    let root_expanded = crate::utils::expand_path(&root_path);
    let root = Path::new(&root_expanded);
    if !root.exists() || !root.is_dir() {
        return Err(AppError::Custom("Root directory does not exist".into()));
    }

    let trimmed = folder_name.trim();
    if trimmed.is_empty() || trimmed.contains("..") {
        return Err(AppError::Custom("Invalid folder name: contains path traversal or is empty".into()));
    }

    // Protect essential system folders from deletion
    let lower_name = trimmed.to_lowercase();
    if matches!(lower_name.as_str(), "unassigned" | "_conflicts" | ".staging") {
        return Err(AppError::Custom(format!("Essential system folder '{}' cannot be deleted.", trimmed)));
    }

    let target_dir = root.join(trimmed);
    if !target_dir.exists() {
        return Ok(());
    }

    // Safety checks against system root paths
    validate_safe_mod_deletion_path(&target_dir)?;

    // Check if empty when force == false
    if !force {
        let entries: Vec<_> = fs::read_dir(&target_dir)
            .map_err(AppError::Io)?
            .filter_map(Result::ok)
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_lowercase();
                name != "category.json" && name != "desktop.ini" && name != "thumbs.db"
            })
            .collect();

        if !entries.is_empty() {
            return Err(AppError::Custom(format!(
                "Folder '{}' is not empty (contains {} items). Confirmation required.",
                trimmed,
                entries.len()
            )));
        }
    }

    let target_dir_clone = target_dir.clone();
    let folder_name_clone = trimmed.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        safe_remove_dir_all(&target_dir_clone)?;
        crate::infra::logger::log_alteration(
            "delete_folder",
            &folder_name_clone,
            &target_dir_clone.to_string_lossy(),
            "Deleted category folder",
            None,
            false,
        );
        Ok::<(), AppError>(())
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))??;

    Ok(())
}

#[tauri::command]
pub fn generate_essential_folders(
    root_path: String,
    folders: Option<Vec<String>>,
) -> Result<Vec<String>, AppError> {
    let root_expanded = crate::utils::expand_path(&root_path);
    let root = Path::new(&root_expanded);
    if !root.exists() {
        fs::create_dir_all(root)?;
    }

    let default_essentials = vec![
        "Unassigned".to_string(),
        "_Conflicts".to_string(),
        ".staging".to_string(),
    ];

    let target_folders = folders.unwrap_or(default_essentials);
    let mut created = Vec::new();

    for name in target_folders {
        let trimmed = name.trim();
        if trimmed.is_empty() || trimmed.contains("..") {
            continue;
        }
        let safe_name = crate::services::install::types::sanitize_path_component(trimmed);
        let dir = root.join(&safe_name);
        if !dir.exists() {
            if fs::create_dir_all(&dir).is_ok() {
                created.push(safe_name.clone());
                crate::infra::logger::log_alteration(
                    "create_folder",
                    &safe_name,
                    &dir.to_string_lossy(),
                    "Generated essential folder",
                    None,
                    false,
                );
            }
        } else {
            created.push(safe_name);
        }
    }

    Ok(created)
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
            let mod_name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            safe_remove_dir_all(path)?;
            crate::infra::logger::log_alteration(
                "delete",
                &mod_name,
                &mod_path,
                "Deleted mod folder",
                None,
                false,
            );
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
        let logs_dir = app_dir.join("logs");
        let _ = fs::create_dir_all(&logs_dir);
        open_folder(logs_dir.to_string_lossy().to_string()).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_log_file(app: tauri::AppHandle, log_type: String) -> Result<(), AppError> {
    use tauri::Manager;
    if let Ok(app_dir) = app.path().app_data_dir() {
        let logs_dir = app_dir.join("logs");
        let _ = fs::create_dir_all(&logs_dir);
        let file_name = match log_type.as_str() {
            "errors" | "error" => "errors.log",
            _ => "alterations.log",
        };
        let file_path = logs_dir.join(file_name);
        if !file_path.exists() {
            let header = format!("=== ZzzModManager {} ===\n", file_name);
            let _ = fs::write(&file_path, header);
        }
        let _ = tauri_plugin_opener::open_path(file_path.to_string_lossy().to_string(), None::<&str>);
    }
    Ok(())
}

#[tauri::command]
pub fn get_alteration_history(
    limit: Option<usize>,
) -> Result<Vec<crate::infra::logger::AlterationEntry>, AppError> {
    Ok(crate::infra::logger::get_alteration_entries(limit.unwrap_or(100)))
}

#[tauri::command]
pub fn get_error_logs(
    limit: Option<usize>,
) -> Result<Vec<crate::infra::logger::ErrorLogEntry>, AppError> {
    Ok(crate::infra::logger::get_error_entries(limit.unwrap_or(100)))
}

#[tauri::command]
pub fn clear_logs(log_type: String) -> Result<(), AppError> {
    crate::infra::logger::clear_log(&log_type)
}

#[tauri::command]
pub fn rollback_alteration(
    entry_id: String,
) -> Result<crate::infra::logger::RollbackResult, AppError> {
    crate::infra::logger::rollback_alteration_by_id(&entry_id)
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
    crate::infra::logger::log_alteration(
        "rename",
        &final_new_name,
        &new_path.to_string_lossy(),
        &format!("Renamed from '{}' to '{}'", current_name, final_new_name),
        None,
        false,
    );
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
    crate::infra::logger::log_alteration(
        "move",
        &folder_name,
        &new_path.to_string_lossy(),
        &format!("Moved to category '{}'", trimmed_cat),
        None,
        false,
    );
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

    #[test]
    fn test_create_category_folder_sanitization_and_collision() {
        let temp_path = std::env::temp_dir().join(format!("zmm_test_create_{}", rand::random::<u32>()));
        let _ = std::fs::remove_dir_all(&temp_path);
        std::fs::create_dir_all(&temp_path).expect("create temp dir");
        let root = temp_path.to_string_lossy().to_string();

        // Path traversal rejected
        let res_traversal = create_category_folder(root.clone(), "../traversal".into(), None, None);
        assert!(res_traversal.is_err(), "Must reject '..' traversal");

        // Valid creation with characters to sanitize
        let res_created = create_category_folder(
            root.clone(),
            "My Custom:Folder*Test".into(),
            Some("ellen_joe".into()),
            Some("base".into()),
        );
        assert!(res_created.is_ok(), "Must successfully create sanitized folder");
        let created_name = res_created.unwrap();
        assert!(!created_name.contains(':'), "Must sanitize colon");
        assert!(!created_name.contains('*'), "Must sanitize asterisk");

        let target_dir = temp_path.join(&created_name);
        assert!(target_dir.exists(), "Directory must exist on disk");
        let cat_json = target_dir.join("category.json");
        assert!(cat_json.exists(), "category.json must exist when character_id is provided");

        // Duplicate name collision
        let res_dup = create_category_folder(root, created_name, None, None);
        assert!(res_dup.is_err(), "Must reject creating duplicate folder");

        let _ = std::fs::remove_dir_all(&temp_path);
    }

    #[test]
    fn test_rename_category_folder_and_essential_protection() {
        let temp_path = std::env::temp_dir().join(format!("zmm_test_rename_{}", rand::random::<u32>()));
        let _ = std::fs::remove_dir_all(&temp_path);
        std::fs::create_dir_all(&temp_path).expect("create temp dir");
        let root = temp_path.to_string_lossy().to_string();

        // Create folder
        let created = create_category_folder(root.clone(), "OldFolderName".into(), None, None).unwrap();
        assert!(temp_path.join(&created).exists());

        // Rename folder successfully
        let renamed = rename_category_folder(root.clone(), created, "NewFolderName".into());
        assert!(renamed.is_ok());
        assert!(!temp_path.join("OldFolderName").exists());
        assert!(temp_path.join("NewFolderName").exists());

        // Rename essential folder rejected
        let unassigned_dir = temp_path.join("Unassigned");
        std::fs::create_dir_all(&unassigned_dir).unwrap();
        let rename_essential = rename_category_folder(root.clone(), "Unassigned".into(), "Custom".into());
        assert!(rename_essential.is_err(), "Must reject renaming essential folder");

        // Rename with traversal rejected
        let rename_traversal = rename_category_folder(root, "NewFolderName".into(), "../escape".into());
        assert!(rename_traversal.is_err(), "Must reject traversal rename");

        let _ = std::fs::remove_dir_all(&temp_path);
    }

    #[tokio::test]
    async fn test_delete_category_folder_safety_and_essential_protection() {
        let temp_path = std::env::temp_dir().join(format!("zmm_test_del_{}", rand::random::<u32>()));
        let _ = std::fs::remove_dir_all(&temp_path);
        std::fs::create_dir_all(&temp_path).expect("create temp dir");
        let root = temp_path.to_string_lossy().to_string();

        // Essential folder deletion rejected
        let conflicts_dir = temp_path.join("_Conflicts");
        std::fs::create_dir_all(&conflicts_dir).unwrap();
        let del_essential = delete_category_folder(root.clone(), "_Conflicts".into(), true).await;
        assert!(del_essential.is_err(), "Must reject deleting _Conflicts");

        // Non-empty folder without force rejected
        let custom_dir = temp_path.join("CustomCategory");
        std::fs::create_dir_all(&custom_dir).unwrap();
        std::fs::write(custom_dir.join("mod_file.txt"), "mod content").unwrap();

        let del_non_empty = delete_category_folder(root.clone(), "CustomCategory".into(), false).await;
        assert!(del_non_empty.is_err(), "Must reject deleting non-empty folder when force == false");

        // Force delete non-empty folder succeeds
        let del_force = delete_category_folder(root.clone(), "CustomCategory".into(), true).await;
        assert!(del_force.is_ok(), "Must allow force deleting non-empty folder");
        assert!(!custom_dir.exists());

        let _ = std::fs::remove_dir_all(&temp_path);
    }

    #[test]
    fn test_generate_essential_folders() {
        let temp_path = std::env::temp_dir().join(format!("zmm_test_ess_{}", rand::random::<u32>()));
        let _ = std::fs::remove_dir_all(&temp_path);
        std::fs::create_dir_all(&temp_path).expect("create temp dir");
        let root = temp_path.to_string_lossy().to_string();

        let generated = generate_essential_folders(root, None).expect("generate essentials");
        assert!(generated.contains(&"Unassigned".to_string()));
        assert!(generated.contains(&"_Conflicts".to_string()));
        assert!(generated.contains(&".staging".to_string()));

        assert!(temp_path.join("Unassigned").exists());
        assert!(temp_path.join("_Conflicts").exists());
        assert!(temp_path.join(".staging").exists());

        let _ = std::fs::remove_dir_all(&temp_path);
    }
}
