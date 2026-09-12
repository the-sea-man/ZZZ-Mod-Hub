use crate::error::AppError;
use crate::utils::{get_mod_display_name, get_toggled_folder_name, safe_rename};
use std::fs;
use std::path::Path;
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use rand::seq::SliceRandom;

#[tauri::command]
pub async fn toggle_mod(mod_path: String, enable: bool) -> Result<String, AppError> {
    tauri::async_runtime::spawn_blocking(move || toggle_mod_sync(&mod_path, enable))
        .await
        .map_err(|e| AppError::Custom(e.to_string()))?
}

pub fn toggle_mod_sync(mod_path: &str, enable: bool) -> Result<String, AppError> {
    let mod_path_expanded = crate::utils::expand_path(mod_path);
    let path = Path::new(&mod_path_expanded);
    if !path.exists() || !path.is_dir() {
        return Err("Mod directory does not exist".into());
    }
    
    let parent = path.parent().ok_or("No parent directory")?;
    let folder_name = path.file_name().ok_or("No folder name")?.to_string_lossy().to_string();
    
    if let Some(new_folder_name) = get_toggled_folder_name(&folder_name, enable) {
        let new_path = parent.join(&new_folder_name);
        
        if new_path.exists() {
            return Err(AppError::ModConflict { target: new_folder_name });
        }

        let mods_root = crate::state_tracker::find_mods_root(path);

        // If disabling: backup persist variables from d3dx_user.ini and remove orphaned UI files
        if !enable {
            crate::state_tracker::backup_mod_state(&mods_root, path, &folder_name);
            crate::ui_generator::remove_mod_ui_files(&mods_root, &folder_name);
        }
        
        safe_rename(path, &new_path)?;

        // If enabling: restore persist variables into d3dx_user.ini
        if enable {
            let clean_name = new_folder_name.strip_prefix("DISABLED ").unwrap_or(&new_folder_name);
            crate::state_tracker::restore_mod_state(&mods_root, &new_path, clean_name);
        }

        Ok(new_path.to_string_lossy().to_string())
    } else {
        Ok(mod_path.to_string())
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ToggledModResult {
    pub old_path: String,
    pub new_path: String,
    pub is_enabled: bool,
}

#[tauri::command]
pub async fn bulk_toggle_mods(
    mod_paths: Vec<String>,
    enable: bool,
) -> Result<Vec<ToggledModResult>, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::with_capacity(mod_paths.len());
        for p in mod_paths {
            match toggle_mod_sync(&p, enable) {
                Ok(new_p) => {
                    results.push(ToggledModResult {
                        old_path: p,
                        new_path: new_p,
                        is_enabled: enable,
                    });
                }
                Err(e) => {
                    tracing::warn!("Failed to toggle mod {}: {:?}", p, e);
                }
            }
        }
        Ok(results)
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}

#[tauri::command]
pub async fn randomize_mods(
    root_path: String, 
    ignored_mods: Vec<String>, 
    whitelist: Vec<String>,
    favorite_mods: Vec<String>,
    favorite_weight: u32
) -> Result<Vec<String>, AppError> {
    let root_path = crate::utils::expand_path(&root_path);
    tauri::async_runtime::spawn_blocking(move || {
        let root = Path::new(&root_path);
    if !root.exists() || !root.is_dir() {
        return Err(AppError::Custom("Invalid root path".into()));
    }

    let mut rng = rand::thread_rng();
    let mut errors = Vec::new();

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                let category_name = entry.file_name().to_string_lossy().to_string();
                if !whitelist.contains(&category_name) {
                    continue;
                }

                let mut all_available_mods = Vec::new();
                if let Ok(mod_entries) = fs::read_dir(&path) {
                    for mod_entry in mod_entries.filter_map(Result::ok) {
                        if mod_entry.path().is_dir() {
                            let folder_name = mod_entry.file_name().to_string_lossy().to_string();
                            let base_name = get_mod_display_name(&folder_name);
                            if !ignored_mods.contains(&base_name) {
                                all_available_mods.push((mod_entry.path(), base_name));
                            }
                        }
                    }
                }

                if !all_available_mods.is_empty() {
                    let mut favorites_in_category = Vec::new();
                    let mut non_favorites_in_category = Vec::new();

                    for (mod_path, base_name) in &all_available_mods {
                        if favorite_mods.contains(base_name) {
                            favorites_in_category.push(mod_path.clone());
                        } else {
                            non_favorites_in_category.push(mod_path.clone());
                        }
                    }

                    use rand::Rng;
                    
                    let selected = if !favorites_in_category.is_empty() && rng.gen_range(0..100) < favorite_weight {
                        favorites_in_category.choose(&mut rng).cloned()
                    } else if !non_favorites_in_category.is_empty() {
                        non_favorites_in_category.choose(&mut rng).cloned()
                    } else {
                        favorites_in_category.choose(&mut rng).cloned()
                    };
                    
                    let selected = match selected {
                        Some(m) => m,
                        None => continue,
                    };
                    
                    for (mod_path, _) in all_available_mods {
                        let target_enable = mod_path == selected;
                        if let Err(e) = toggle_mod_sync(&mod_path.to_string_lossy(), target_enable) {
                            errors.push(format!("Failed to toggle '{}': {:?}", mod_path.display(), e));
                        }
                    }
                }
            }
        }
    }
    

    Ok(errors)
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}

#[tauri::command]
pub async fn disable_all_mods(mod_paths: Vec<String>) -> Result<Vec<String>, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut errors = Vec::new();

        for path_str in mod_paths {
            if let Err(e) = toggle_mod_sync(&path_str, false) {
                errors.push(format!("Failed to disable '{}': {:?}", path_str, e));
            }
        }
        
        Ok(errors)
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}

#[tauri::command]
pub fn restore_mods_state(mod_paths: Vec<String>) -> Result<Vec<String>, AppError> {
    let mut errors = Vec::new();

    for path_str in mod_paths {
        let path = Path::new(&path_str);
        if let (Some(parent), Some(file_name)) = (path.parent(), path.file_name()) {
            let folder_name = file_name.to_string_lossy();
            
            // Check for space prefix first, then fallback to underscore prefix
            let space_disabled = parent.join(format!("DISABLED {}", folder_name));
            let underscore_disabled = parent.join(format!("DISABLED_{}", folder_name));

            let source_path = if space_disabled.exists() {
                Some(space_disabled)
            } else if underscore_disabled.exists() {
                Some(underscore_disabled)
            } else {
                None
            };

            if let Some(disabled_path) = source_path {
                if let Err(e) = toggle_mod_sync(&disabled_path.to_string_lossy(), true) {
                    errors.push(format!("Failed to restore '{}': {:?}", folder_name, e));
                }
            }
        }
    }

    Ok(errors)
}

fn parse_command_line(cmd_in: &str) -> (String, Vec<String>) {
    let mut cmd = cmd_in.trim().to_string();
    
    // Universal case-insensitive %VAR% expansion for game command line
    static ENV_REGEX: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"%([^%]+)%").expect("Valid regex"));
    cmd = ENV_REGEX
        .replace_all(&cmd, |caps: &regex::Captures| {
            let var_name = &caps[1];
            if let Ok(val) = std::env::var(var_name) {
                val
            } else {
                let var_name_upper = var_name.to_uppercase();
                std::env::vars()
                    .find(|(k, _)| k.to_uppercase() == var_name_upper)
                    .map(|(_, v)| v)
                    .unwrap_or_else(|| caps[0].to_string())
            }
        })
        .to_string();

    if let Some(stripped) = cmd.strip_prefix('"') {
        if let Some(end_idx) = stripped.find('"') {
            let program = stripped[..end_idx].to_string();
            let rest = &stripped[end_idx + 1..];
            
            let mut args = Vec::new();
            let mut current_arg = String::new();
            let mut in_quotes = false;
            for c in rest.trim().chars() {
                if c == '"' {
                    in_quotes = !in_quotes;
                } else if c.is_whitespace() && !in_quotes {
                    if !current_arg.is_empty() {
                        args.push(current_arg.clone());
                        current_arg.clear();
                    }
                } else {
                    current_arg.push(c);
                }
            }
            if !current_arg.is_empty() {
                args.push(current_arg);
            }
            (program, args)
        } else {
            (stripped.to_string(), Vec::new())
        }
    } else {
        if Path::new(&cmd).is_file() {
            return (cmd, Vec::new());
        }

        if let Some(space_idx) = cmd.find(' ') {
            let program = cmd[..space_idx].to_string();
            let rest = &cmd[space_idx..];
            
            let mut args = Vec::new();
            let mut current_arg = String::new();
            let mut in_quotes = false;
            for c in rest.trim().chars() {
                if c == '"' {
                    in_quotes = !in_quotes;
                } else if c.is_whitespace() && !in_quotes {
                    if !current_arg.is_empty() {
                        args.push(current_arg.clone());
                        current_arg.clear();
                    }
                } else {
                    current_arg.push(c);
                }
            }
            if !current_arg.is_empty() {
                args.push(current_arg);
            }
            (program, args)
        } else {
            (cmd.to_string(), Vec::new())
        }
    }
}

#[tauri::command]
pub fn launch_game(exe_path: &str) -> Result<String, AppError> {
    if exe_path.trim().is_empty() {
        return Err(AppError::Custom("Executable path is empty".into()));
    }
    
    let (program, args) = parse_command_line(exe_path);
    let path = Path::new(&program);
    let parent = path.parent().unwrap_or(Path::new(""));
    
    let mut cmd = Command::new(&program);
    cmd.args(&args).current_dir(parent);
    
    // Detach I/O so the child doesn't crash if the parent closes its pipes
    use std::process::Stdio;
    cmd.stdin(Stdio::null())
       .stdout(Stdio::null())
       .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }

    match cmd.spawn()
    {
        Ok(_) => Ok("Launched".into()),
        Err(e) => {
            if let Some(740) = e.raw_os_error() {
                let mut ps_args = vec!["-Command".to_string(), "Start-Process".to_string(), format!("'{}'", program.replace("'", "''"))];
                if !args.is_empty() {
                    let args_joined = args.iter().map(|a| format!("'{}'", a.replace("'", "''"))).collect::<Vec<_>>().join(", ");
                    ps_args.push("-ArgumentList".to_string());
                    ps_args.push(args_joined);
                }
                ps_args.push("-Verb".to_string());
                ps_args.push("RunAs".to_string());
                
                match Command::new("powershell")
                    .args(&ps_args)
                    .current_dir(parent)
                    .spawn()
                {
                    Ok(_) => return Ok("Launched with Administrator privileges".into()),
                    Err(e2) => return Err(AppError::Custom(format!("Failed to launch as Admin: {}", e2))),
                }
            }
            Err(AppError::Custom(format!("Failed to launch game: {}", e)))
        }
    }
}

#[tauri::command]
pub async fn generate_in_game_ui(
    root_path: String,
    active_mod_paths: Option<Vec<String>>,
    hud_key: Option<String>,
    menu_mode: Option<String>,
) -> Result<String, AppError> {
    let root_path = crate::utils::expand_path(&root_path);
    tauri::async_runtime::spawn_blocking(move || {
        crate::ui_generator::generate_in_game_ui(&root_path, active_mod_paths, hud_key, menu_mode)
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}

#[tauri::command]
pub async fn disable_in_game_ui(root_path: String) -> Result<String, AppError> {
    let root_path = crate::utils::expand_path(&root_path);
    tauri::async_runtime::spawn_blocking(move || {
        crate::ui_generator::disable_in_game_ui(&root_path)
    })
    .await
    .map_err(|e| AppError::Custom(e.to_string()))?
}

#[tauri::command]
pub fn is_game_running(custom_exe: Option<String>) -> Result<bool, AppError> {
    #[cfg(windows)]
    {
        use winapi::um::handleapi::{CloseHandle, INVALID_HANDLE_VALUE};
        use winapi::um::tlhelp32::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        };
        use winapi::um::winuser::FindWindowW;

        // 1. Check Window Presence (instant check if game window exists)
        unsafe {
            let class_name: Vec<u16> = "ZenlessZoneZero\0".encode_utf16().collect();
            let hwnd = FindWindowW(class_name.as_ptr(), std::ptr::null());
            if !hwnd.is_null() {
                return Ok(true);
            }

            let title_name: Vec<u16> = "Zenless Zone Zero\0".encode_utf16().collect();
            let hwnd_title = FindWindowW(std::ptr::null(), title_name.as_ptr());
            if !hwnd_title.is_null() {
                return Ok(true);
            }
        }

        // 2. Check Process Snapshot (works without elevated PROCESS_VM_READ permissions)
        let custom_name = custom_exe.as_ref().and_then(|p| {
            std::path::Path::new(p)
                .file_name()
                .map(|f| f.to_string_lossy().to_lowercase())
        });

        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snapshot != INVALID_HANDLE_VALUE {
                let mut entry: PROCESSENTRY32W = std::mem::zeroed();
                entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

                if Process32FirstW(snapshot, &mut entry) != 0 {
                    loop {
                        let len = entry
                            .szExeFile
                            .iter()
                            .position(|&c| c == 0)
                            .unwrap_or(entry.szExeFile.len());
                        let exe_name = String::from_utf16_lossy(&entry.szExeFile[..len]).to_lowercase();

                        // Match game processes and mod loaders
                        if exe_name.contains("zenlesszonezero")
                            || exe_name == "zzzero.exe"
                            || exe_name.contains("xxmi")
                            || exe_name.contains("3dmigoto")
                        {
                            CloseHandle(snapshot);
                            return Ok(true);
                        }

                        // Match custom configured executable name if provided
                        if let Some(ref c_name) = custom_name {
                            if !c_name.is_empty()
                                && (exe_name == *c_name
                                    || exe_name.contains(c_name.trim_end_matches(".exe")))
                            {
                                CloseHandle(snapshot);
                                return Ok(true);
                            }
                        }

                        if Process32NextW(snapshot, &mut entry) == 0 {
                            break;
                        }
                    }
                }
                CloseHandle(snapshot);
            }
        }

        Ok(false)
    }

    #[cfg(not(windows))]
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_game_running_execution() {
        // Calling is_game_running should succeed (returns Ok(true) or Ok(false)) without error or panic
        let res = is_game_running(None);
        assert!(res.is_ok());

        // Test with custom executable name should return a valid boolean result
        let custom_res = is_game_running(Some("ZenlessZoneZero.exe".to_string()));
        assert!(custom_res.is_ok());
    }
}
