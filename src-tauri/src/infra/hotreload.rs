use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use crate::error::AppError;

pub struct HotreloadState {
    pub enabled: Arc<AtomicBool>,
    pub is_monitoring_running: Arc<AtomicBool>,
}

impl Default for HotreloadState {
    fn default() -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(false)),
            is_monitoring_running: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[tauri::command]
pub fn set_hotreload(state: State<'_, HotreloadState>, enabled: bool) -> Result<(), AppError> {
    state.enabled.store(enabled, Ordering::Relaxed);
    tracing::info!("Hotreload set to: {}", enabled);
    Ok(())
}

#[tauri::command]
pub fn start_window_monitoring(
    app: AppHandle,
    state: State<'_, HotreloadState>,
) -> Result<(), AppError> {
    if state.is_monitoring_running.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    let enabled_flag = Arc::clone(&state.enabled);
    let app_handle = app.clone();

    tokio::task::spawn_blocking(move || {
        let mut last_active = false;

        loop {
            if enabled_flag.load(Ordering::Relaxed) {
                let is_active = is_zzz_active_window();

                if is_active != last_active {
                    last_active = is_active;
                    let _ = app_handle.emit("game-active-changed", is_active);
                }
            } else if last_active {
                last_active = false;
                let _ = app_handle.emit("game-active-changed", false);
            }

            std::thread::sleep(Duration::from_millis(500));
        }
    });

    Ok(())
}

#[cfg(windows)]
fn is_zzz_active_window() -> bool {
    use winapi::um::winuser::{GetForegroundWindow, GetWindowTextW};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return false;
        }

        let mut buffer = [0u16; 512];
        let len = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
        if len > 0 {
            let title = String::from_utf16_lossy(&buffer[..len as usize]);
            return title.contains("ZenlessZoneZero") || title.contains("Zenless Zone Zero");
        }
    }
    false
}

#[cfg(not(windows))]
fn is_zzz_active_window() -> bool {
    false
}

#[tauri::command]
pub fn focus_and_send_f10() -> Result<(), AppError> {
    #[cfg(windows)]
    {
        use winapi::um::winuser::{
            FindWindowW, SetForegroundWindow, keybd_event, VK_F10, KEYEVENTF_KEYUP,
        };

        unsafe {
            let window_name: Vec<u16> = "ZenlessZoneZero\0".encode_utf16().collect();
            let mut hwnd = FindWindowW(std::ptr::null(), window_name.as_ptr());

            if hwnd.is_null() {
                let window_name_alt: Vec<u16> = "Zenless Zone Zero\0".encode_utf16().collect();
                hwnd = FindWindowW(std::ptr::null(), window_name_alt.as_ptr());
            }

            if !hwnd.is_null() {
                SetForegroundWindow(hwnd);
                std::thread::sleep(Duration::from_millis(100));

                keybd_event(VK_F10 as u8, 0, 0, 0);
                std::thread::sleep(Duration::from_millis(50));
                keybd_event(VK_F10 as u8, 0, KEYEVENTF_KEYUP, 0);

                tracing::info!("Sent F10 hotreload key to ZenlessZoneZero");
                Ok(())
            } else {
                Err(AppError::Custom(
                    "ZenlessZoneZero window not found".to_string(),
                ))
            }
        }
    }

    #[cfg(not(windows))]
    Err(AppError::Custom("Unsupported platform".to_string()))
}
