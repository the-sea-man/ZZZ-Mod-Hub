use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use crate::error::AppError;

pub struct WatcherState(pub Mutex<Option<Debouncer<RecommendedWatcher, FileIdMap>>>);

impl Default for WatcherState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

/// Returns true if an event path is one of the manager's own internal writes.
/// These must be silently ignored to prevent self-triggering scan loops.
fn is_internal_manager_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    // Manager-written metadata and state files
    if path_str.ends_with(".zmm-meta.json")
        || path_str.ends_with(".zzz_d3dx_state_cache.json")
        || path_str.ends_with(".zzz_hunting_hashes.log")
        || path_str.ends_with("preview.png")
    {
        return true;
    }
    // Backup files written during mod fixing / upgrades
    if path_str.ends_with(".bak") || path_str.ends_with(".disabled.bak") {
        return true;
    }
    // Manager-generated in-game HUD folders (written on every mod toggle)
    let components: Vec<&str> = path_str.split(['/', '\\']).collect();
    for component in &components {
        if *component == "zzzzzz_ZZZModManagerUI"
            || *component == "000_ZzzManager_UI"
            || *component == ".staging"
        {
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn start_folder_watch(
    app: AppHandle,
    state: State<'_, WatcherState>,
    mods_path: String,
) -> std::result::Result<(), AppError> {
    let mods_path = crate::utils::expand_path(&mods_path);
    let path = Path::new(&mods_path);
    if !path.exists() || !path.is_dir() {
        return Err(AppError::Custom(format!(
            "Mods path does not exist or is not a directory: {}",
            mods_path
        )));
    }

    let app_handle = app.clone();
    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        None,
        move |result: DebounceEventResult| match result {
            Ok(events) => {
                // Filter out events triggered by the manager's own internal writes.
                // Without this filter, writing .zmm-meta.json during scan would cause
                // the watcher to fire mods-folder-changed → scan → write meta → loop.
                let has_external_change = events.iter().any(|e| {
                    e.paths.iter().any(|p| !is_internal_manager_path(p))
                });
                if has_external_change {
                    let _ = app_handle.emit("mods-folder-changed", ());
                }
            }
            Err(errors) => {
                tracing::warn!("FS Watcher error: {:?}", errors);
            }
        },
    )
    .map_err(|e| AppError::Custom(format!("Failed to create debouncer: {}", e)))?;

    debouncer
        .watch(path, RecursiveMode::Recursive)
        .map_err(|e| AppError::Custom(format!("Failed to watch path {}: {}", mods_path, e)))?;

    let mut lock = state
        .0
        .lock()
        .map_err(|_| AppError::Custom("Failed to acquire watcher state lock".to_string()))?;
    *lock = Some(debouncer);

    tracing::info!("Started watching mods folder: {}", mods_path);
    Ok(())
}
