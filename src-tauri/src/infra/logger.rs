//! Dual-Track Logging & Operation History Engine
//!
//! Provides durable, thread-safe activity logging (`alterations.log` / `alterations.jsonl`)
//! and diagnostic error tracing (`errors.log` / `errors.jsonl`), plus one-click rollback
//! for operations that created backups.

use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, RwLock};
use serde::{Deserialize, Serialize};

use crate::core::error::AppError;

static LOG_DIR: RwLock<Option<PathBuf>> = RwLock::new(None);
static LOG_MUTEX: Mutex<()> = Mutex::new(());

const MAX_LOG_LINES: usize = 5000;
const TRUNCATE_TO_LINES: usize = 4000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlterationEntry {
    pub id: String,
    pub timestamp: String,
    pub action_type: String, // "mod_fix", "mod_split", "keybind_change", "script_fix", "toggle", "restore", "install", "delete", "move", "rename"
    pub target_name: String,
    pub target_path: String,
    pub details: String,
    pub backup_path: Option<String>,
    pub can_undo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorLogEntry {
    pub id: String,
    pub timestamp: String,
    pub subsystem: String,
    pub error_message: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackResult {
    pub success: bool,
    pub restored_count: usize,
    pub message: String,
}

/// Initialize the logger with the application data directory.
/// Creates a `logs/` subdirectory if it doesn't already exist.
pub fn init_logger(app_data_dir: PathBuf) {
    let logs_dir = app_data_dir.join("logs");
    let _ = fs::create_dir_all(&logs_dir);
    if let Ok(mut lock) = LOG_DIR.write() {
        *lock = Some(logs_dir);
    }
}

/// Helper to get the active logs directory.
pub fn get_logs_dir() -> PathBuf {
    if let Ok(lock) = LOG_DIR.read() {
        if let Some(ref dir) = *lock {
            return dir.clone();
        }
    }
    let fallback = std::env::temp_dir().join("zmm_logs");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

/// Returns current local/UTC ISO timestamp string
fn current_timestamp() -> String {
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    
    // Format YYYY-MM-DD HH:MM:SS
    let days = secs / 86400;
    let rem_secs = secs % 86400;
    let hours = rem_secs / 3600;
    let mins = (rem_secs % 3600) / 60;
    let s = rem_secs % 60;

    // Approximate year/month/day
    let mut year = 1970 + (days * 400 / 146097);
    let mut day_of_year = days - (year - 1970) * 365 - ((year - 1969) / 4);
    while day_of_year >= 365 {
        year += 1;
        day_of_year = days - (year - 1970) * 365 - ((year - 1969) / 4);
    }
    let months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 1;
    for (m_idx, &m_days) in months.iter().enumerate() {
        if day_of_year < m_days {
            month = m_idx + 1;
            break;
        }
        day_of_year -= m_days;
    }
    let day = day_of_year + 1;

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        year, month, day, hours, mins, s
    )
}

/// Generate unique short ID
fn generate_id() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let rand_suffix: u32 = rand::random::<u32>() % 10000;
    format!("alt_{}_{:04}", now, rand_suffix)
}

/// Truncate a file if it exceeds MAX_LOG_LINES
fn rotate_file_if_needed(path: &Path) {
    if !path.exists() {
        return;
    }
    if let Ok(file) = File::open(path) {
        let reader = BufReader::new(file);
        let lines: Vec<String> = reader.lines().map_while(Result::ok).collect();
        if lines.len() > MAX_LOG_LINES {
            let keep_from = lines.len().saturating_sub(TRUNCATE_TO_LINES);
            let truncated = lines[keep_from..].join("\n");
            let _ = fs::write(path, format!("{}\n", truncated));
        }
    }
}

/// Log an alteration to both `alterations.log` and `alterations.jsonl`.
pub fn log_alteration(
    action_type: &str,
    target_name: &str,
    target_path: &str,
    details: &str,
    backup_path: Option<&str>,
    can_undo: bool,
) -> AlterationEntry {
    let _guard = LOG_MUTEX.lock().unwrap();
    let logs_dir = get_logs_dir();
    let _ = fs::create_dir_all(&logs_dir);

    let entry = AlterationEntry {
        id: generate_id(),
        timestamp: current_timestamp(),
        action_type: action_type.to_string(),
        target_name: target_name.to_string(),
        target_path: target_path.to_string(),
        details: details.to_string(),
        backup_path: backup_path.map(|s| s.to_string()),
        can_undo,
    };

    // 1. Append to human-readable alterations.log
    let log_txt = logs_dir.join("alterations.log");
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&log_txt) {
        let backup_info = entry
            .backup_path
            .as_ref()
            .map(|b| format!(" | Backup: {}", b))
            .unwrap_or_default();
        let _ = writeln!(
            f,
            "[{}] [{}] {} ({}) | {}{}",
            entry.timestamp,
            entry.action_type.to_uppercase(),
            entry.target_name,
            entry.target_path,
            entry.details,
            backup_info
        );
    }
    rotate_file_if_needed(&log_txt);

    // 2. Append to structured alterations.jsonl
    let log_jsonl = logs_dir.join("alterations.jsonl");
    if let Ok(json_line) = serde_json::to_string(&entry) {
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&log_jsonl) {
            let _ = writeln!(f, "{}", json_line);
        }
    }
    rotate_file_if_needed(&log_jsonl);

    entry
}

/// Log an error to both `errors.log` and `errors.jsonl`.
pub fn log_error(subsystem: &str, error_message: &str, context: Option<&str>) -> ErrorLogEntry {
    let _guard = LOG_MUTEX.lock().unwrap();
    let logs_dir = get_logs_dir();
    let _ = fs::create_dir_all(&logs_dir);

    let entry = ErrorLogEntry {
        id: generate_id().replace("alt_", "err_"),
        timestamp: current_timestamp(),
        subsystem: subsystem.to_string(),
        error_message: error_message.to_string(),
        context: context.map(|s| s.to_string()),
    };

    // 1. Append to human-readable errors.log
    let log_txt = logs_dir.join("errors.log");
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&log_txt) {
        let ctx_info = entry
            .context
            .as_ref()
            .map(|c| format!(" | Context: {}", c))
            .unwrap_or_default();
        let _ = writeln!(
            f,
            "[{}] [ERROR] [{}] {}{}",
            entry.timestamp, entry.subsystem, entry.error_message, ctx_info
        );
    }
    rotate_file_if_needed(&log_txt);

    // 2. Append to structured errors.jsonl
    let log_jsonl = logs_dir.join("errors.jsonl");
    if let Ok(json_line) = serde_json::to_string(&entry) {
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&log_jsonl) {
            let _ = writeln!(f, "{}", json_line);
        }
    }
    rotate_file_if_needed(&log_jsonl);

    entry
}

/// Resolve mod path taking into account possible disabled prefix renaming
fn resolve_mod_path_flexible(path_str: &str) -> Option<PathBuf> {
    let p = Path::new(path_str);
    if p.exists() {
        return Some(p.to_path_buf());
    }
    if let (Some(parent), Some(file_name)) = (p.parent(), p.file_name()) {
        let name_str = file_name.to_string_lossy();
        let counterpart_name = if let Some(stripped) = name_str.strip_prefix("DISABLED ") {
            stripped.to_string()
        } else if let Some(stripped) = name_str.strip_prefix("DISABLED_") {
            stripped.to_string()
        } else {
            format!("DISABLED {}", name_str)
        };
        let counterpart = parent.join(&counterpart_name);
        if counterpart.exists() {
            return Some(counterpart);
        }
        let counterpart_underscore = parent.join(format!("DISABLED_{}", name_str));
        if counterpart_underscore.exists() {
            return Some(counterpart_underscore);
        }
    }
    None
}

/// Retrieve alteration entries from `alterations.jsonl`, newest first.
pub fn get_alteration_entries(limit: usize) -> Vec<AlterationEntry> {
    let _guard = LOG_MUTEX.lock().unwrap();
    let log_jsonl = get_logs_dir().join("alterations.jsonl");
    if !log_jsonl.exists() {
        return Vec::new();
    }

    let mut entries = Vec::new();
    if let Ok(file) = File::open(&log_jsonl) {
        let reader = BufReader::new(file);
        for line in reader.lines().map_while(Result::ok) {
            if let Ok(mut entry) = serde_json::from_str::<AlterationEntry>(&line) {
                // Dynamically verify if rollback is still possible on disk
                if entry.can_undo {
                    entry.can_undo = match entry.action_type.as_str() {
                        "mod_fix" => {
                            if let Some(resolved) = resolve_mod_path_flexible(&entry.target_path) {
                                crate::services::mod_fixer::has_mod_backup(&resolved)
                            } else {
                                false
                            }
                        }
                        "keybind_change" | "script_fix" => {
                            if let Some(ref bp) = entry.backup_path {
                                Path::new(bp).exists()
                            } else {
                                false
                            }
                        }
                        "mod_split" => {
                            if let Some(resolved) = resolve_mod_path_flexible(&entry.target_path) {
                                resolved.exists()
                            } else {
                                false
                            }
                        }
                        _ => false,
                    };
                }
                entries.push(entry);
            }
        }
    }

    entries.reverse();
    if limit > 0 && entries.len() > limit {
        entries.truncate(limit);
    }
    entries
}

/// Retrieve error log entries from `errors.jsonl`, newest first.
pub fn get_error_entries(limit: usize) -> Vec<ErrorLogEntry> {
    let _guard = LOG_MUTEX.lock().unwrap();
    let log_jsonl = get_logs_dir().join("errors.jsonl");
    if !log_jsonl.exists() {
        return Vec::new();
    }

    let mut entries = Vec::new();
    if let Ok(file) = File::open(&log_jsonl) {
        let reader = BufReader::new(file);
        for line in reader.lines().map_while(Result::ok) {
            if let Ok(entry) = serde_json::from_str::<ErrorLogEntry>(&line) {
                entries.push(entry);
            }
        }
    }

    entries.reverse();
    if limit > 0 && entries.len() > limit {
        entries.truncate(limit);
    }
    entries
}

/// Clear specific log files or all.
pub fn clear_log(log_type: &str) -> Result<(), AppError> {
    let _guard = LOG_MUTEX.lock().unwrap();
    let logs_dir = get_logs_dir();

    match log_type {
        "alterations" => {
            let _ = fs::remove_file(logs_dir.join("alterations.log"));
            let _ = fs::remove_file(logs_dir.join("alterations.jsonl"));
        }
        "errors" => {
            let _ = fs::remove_file(logs_dir.join("errors.log"));
            let _ = fs::remove_file(logs_dir.join("errors.jsonl"));
        }
        _ => {
            let _ = fs::remove_file(logs_dir.join("alterations.log"));
            let _ = fs::remove_file(logs_dir.join("alterations.jsonl"));
            let _ = fs::remove_file(logs_dir.join("errors.log"));
            let _ = fs::remove_file(logs_dir.join("errors.jsonl"));
        }
    }
    Ok(())
}

/// Roll back an operation by its entry ID.
pub fn rollback_alteration_by_id(entry_id: &str) -> Result<RollbackResult, AppError> {
    let entries = get_alteration_entries(0);
    let target_entry = entries
        .into_iter()
        .find(|e| e.id == entry_id)
        .ok_or_else(|| AppError::Custom(format!("Alteration entry '{}' not found", entry_id)))?;

    if !target_entry.can_undo {
        return Err(AppError::Custom(format!(
            "Operation '{}' is marked as not reversible",
            target_entry.details
        )));
    }

    match target_entry.action_type.as_str() {
        "mod_fix" => {
            let mod_path = resolve_mod_path_flexible(&target_entry.target_path)
                .ok_or_else(|| AppError::Custom(format!(
                    "Target mod directory does not exist: {:?}",
                    target_entry.target_path
                )))?;

            let restored = crate::services::mod_fixer::restore_mod_backup(&mod_path)?;
            if restored {
                log_alteration(
                    "restore",
                    &target_entry.target_name,
                    &mod_path.to_string_lossy(),
                    &format!("Reversed mod fix: {}", target_entry.details),
                    None,
                    false,
                );
                Ok(RollbackResult {
                    success: true,
                    restored_count: 1,
                    message: format!(
                        "Successfully restored '{}' from backup and re-applied original files.",
                        target_entry.target_name
                    ),
                })
            } else {
                Err(AppError::Custom(
                    "No backup files (.bak) were found in the mod folder to restore.".into(),
                ))
            }
        }
        "keybind_change" | "script_fix" => {
            if let Some(ref backup_str) = target_entry.backup_path {
                let backup_path = Path::new(backup_str);
                let target_path = Path::new(&target_entry.target_path);

                if !backup_path.exists() {
                    return Err(AppError::Custom(format!(
                        "Backup file not found at: {:?}",
                        backup_path
                    )));
                }

                fs::copy(backup_path, target_path)?;
                let _ = fs::remove_file(backup_path);

                log_alteration(
                    "restore",
                    &target_entry.target_name,
                    &target_entry.target_path,
                    &format!("Restored previous version: {}", target_entry.details),
                    None,
                    false,
                );

                Ok(RollbackResult {
                    success: true,
                    restored_count: 1,
                    message: format!(
                        "Successfully restored original configuration for '{}'.",
                        target_entry.target_name
                    ),
                })
            } else {
                Err(AppError::Custom("No backup file was recorded for this change.".into()))
            }
        }
        "mod_split" => {
            // For split mods, original was disabled as `DISABLED <mod_name>`.
            let orig_path = Path::new(&target_entry.target_path);
            let parent = orig_path.parent().unwrap_or(orig_path);
            let orig_folder_name = orig_path.file_name().unwrap_or_default().to_string_lossy();
            let disabled_name = if orig_folder_name.starts_with("DISABLED ") {
                orig_folder_name.to_string()
            } else {
                format!("DISABLED {}", orig_folder_name)
            };
            let disabled_path = parent.join(&disabled_name);

            // If disabled source exists and target was disabled, re-enable it
            let mut restored = false;
            if disabled_path.exists() && disabled_name != orig_folder_name.as_ref() {
                crate::core::utils::safe_rename(&disabled_path, orig_path)?;
                restored = true;
            }

            log_alteration(
                "restore",
                &target_entry.target_name,
                &target_entry.target_path,
                &format!("Reversed mod split: Re-enabled original folder {}", orig_folder_name),
                None,
                false,
            );

            Ok(RollbackResult {
                success: true,
                restored_count: if restored { 1 } else { 0 },
                message: format!(
                    "Re-enabled original mod '{}'. Generated split parts remain intact.",
                    target_entry.target_name
                ),
            })
        }
        other => Err(AppError::Custom(format!(
            "Rollback handler for operation type '{}' is not supported.",
            other
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn test_log_alteration_and_read() {
        let _lock = TEST_MUTEX.lock().unwrap();
        let temp_dir = std::env::temp_dir().join(format!("zmm_test_log_{}", rand::random::<u32>()));
        let _ = fs::create_dir_all(&temp_dir);
        init_logger(temp_dir.clone());

        let entry = log_alteration(
            "mod_fix",
            "ClaretSweater",
            "C:/Games/Mods/ClaretSweater",
            "Fixed weapon stride and hash collision",
            Some("C:/Games/Mods/ClaretSweater/DISABLED_BACKUP_123_Caesar.ini.bak"),
            true,
        );

        assert_eq!(entry.action_type, "mod_fix");
        assert_eq!(entry.target_name, "ClaretSweater");
        assert!(entry.can_undo);

        let entries = get_alteration_entries(50);
        let found = entries.iter().find(|e| e.id == entry.id).expect("Logged alteration entry should be found");
        assert_eq!(found.target_name, "ClaretSweater");
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_log_error_and_read() {
        let _lock = TEST_MUTEX.lock().unwrap();
        let temp_dir = std::env::temp_dir().join(format!("zmm_test_err_{}", rand::random::<u32>()));
        let _ = fs::create_dir_all(&temp_dir);
        init_logger(temp_dir.clone());

        let err_entry = log_error("mod_splitter", "Invalid INI syntax on line 42", Some("Claret/mod.ini"));
        assert_eq!(err_entry.subsystem, "mod_splitter");

        let err_entries = get_error_entries(50);
        let found = err_entries.iter().find(|e| e.id == err_entry.id).expect("Logged error entry should be found");
        assert_eq!(found.error_message, "Invalid INI syntax on line 42");
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_rollback_mod_fix() {
        let _lock = TEST_MUTEX.lock().unwrap();
        let temp_dir = std::env::temp_dir().join(format!("zmm_test_rb_{}", rand::random::<u32>()));
        let mod_dir = temp_dir.join("TestMod");
        let _ = fs::create_dir_all(&mod_dir);
        init_logger(temp_dir.clone());

        // Create modified file and backup file matching mod_fixer regex
        let ini_file = mod_dir.join("mod.ini");
        let bak_file = mod_dir.join("DISABLED_BACKUP_123456_mod.ini.bak");
        fs::write(&ini_file, "modified content").unwrap();
        fs::write(&bak_file, "original content").unwrap();

        let entry = log_alteration(
            "mod_fix",
            "TestMod",
            &mod_dir.to_string_lossy(),
            "Applied stride fix",
            Some(&bak_file.to_string_lossy()),
            true,
        );

        let res = rollback_alteration_by_id(&entry.id).unwrap();
        assert!(res.success);

        // Verify original content was restored
        let restored_content = fs::read_to_string(&ini_file).unwrap();
        assert_eq!(restored_content, "original content");
        assert!(!bak_file.exists());
    }
}
