use crate::error::AppError;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct TaskInfo {
    pub task_id: String,
    pub task_type: String,
    pub started_at: u64,
}

pub struct TaskEntry {
    pub info: TaskInfo,
    pub is_cancelled: Arc<AtomicBool>,
    pub abort_handle: Option<tokio::task::AbortHandle>,
}

type CleanupFn = Box<dyn FnOnce(&str) + Send>;

/// RAII Guard that automatically removes the task from the registry when dropped.
pub struct TaskGuard {
    task_id: String,
    cancel_flag: Arc<AtomicBool>,
    cleanup: Option<CleanupFn>,
}

impl TaskGuard {
    pub fn new(task_id: String, cancel_flag: Arc<AtomicBool>, cleanup: Option<CleanupFn>) -> Self {
        Self {
            task_id,
            cancel_flag,
            cleanup,
        }
    }

    #[allow(dead_code)]
    pub fn task_id(&self) -> &str {
        &self.task_id
    }

    pub fn token(&self) -> Arc<AtomicBool> {
        self.cancel_flag.clone()
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancel_flag.load(Ordering::Relaxed)
    }

    pub fn check_cancelled(&self) -> Result<(), AppError> {
        if self.is_cancelled() {
            Err(AppError::Cancelled)
        } else {
            Ok(())
        }
    }

    /// Disarm the guard so it will not remove the task on drop.
    #[allow(dead_code)]
    pub fn disarm(&mut self) {
        self.cleanup = None;
    }
}

impl Drop for TaskGuard {
    fn drop(&mut self) {
        if let Some(cleanup) = self.cleanup.take() {
            cleanup(&self.task_id);
        }
    }
}

/// Thread-safe universal registry for active tasks, cancellation flags, and abort handles.
pub struct TaskRegistry {
    tasks: Arc<Mutex<HashMap<String, TaskEntry>>>,
}

impl Default for TaskRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl TaskRegistry {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Registers a new task or re-registers an existing task ID with fresh cancellation state.
    /// Returns a `TaskGuard` that automatically unregisters the task on drop.
    pub fn register_task(&self, task_id: &str, task_type: &str) -> TaskGuard {
        let flag = Arc::new(AtomicBool::new(false));
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let entry = TaskEntry {
            info: TaskInfo {
                task_id: task_id.to_string(),
                task_type: task_type.to_string(),
                started_at: now_ms,
            },
            is_cancelled: flag.clone(),
            abort_handle: None,
        };

        if let Ok(mut map) = self.tasks.lock() {
            map.insert(task_id.to_string(), entry);
        }

        let tasks_ref = self.tasks.clone();
        let cleanup = Box::new(move |id: &str| {
            if let Ok(mut map) = tasks_ref.lock() {
                map.remove(id);
            }
        });

        TaskGuard::new(task_id.to_string(), flag, Some(cleanup))
    }

    /// Attaches an async Tokio `AbortHandle` to an already registered task.
    #[allow(dead_code)]
    pub fn attach_abort_handle(&self, task_id: &str, handle: tokio::task::AbortHandle) {
        if let Ok(mut map) = self.tasks.lock() {
            if let Some(entry) = map.get_mut(task_id) {
                entry.abort_handle = Some(handle);
            }
        }
    }

    /// Cancels a specific task by setting its atomic cancellation flag and triggering abort handles.
    /// Returns true if the task was found and flagged.
    pub fn cancel_task(&self, task_id: &str) -> bool {
        if let Ok(map) = self.tasks.lock() {
            if let Some(entry) = map.get(task_id) {
                entry.is_cancelled.store(true, Ordering::SeqCst);
                if let Some(ref abort) = entry.abort_handle {
                    abort.abort();
                }
                return true;
            }
        }
        false
    }

    /// Cancels all tasks whose IDs start with the specified prefix.
    /// Returns the number of tasks that were flagged and cancelled.
    pub fn cancel_by_prefix(&self, prefix: &str) -> usize {
        let mut count = 0;
        if let Ok(map) = self.tasks.lock() {
            for (id, entry) in map.iter() {
                if id.starts_with(prefix) {
                    entry.is_cancelled.store(true, Ordering::SeqCst);
                    if let Some(ref abort) = entry.abort_handle {
                        abort.abort();
                    }
                    count += 1;
                }
            }
        }
        count
    }

    /// Cancels all registered active tasks.
    #[allow(dead_code)]
    pub fn cancel_all(&self) -> usize {
        let mut count = 0;
        if let Ok(map) = self.tasks.lock() {
            for entry in map.values() {
                entry.is_cancelled.store(true, Ordering::SeqCst);
                if let Some(ref abort) = entry.abort_handle {
                    abort.abort();
                }
                count += 1;
            }
        }
        count
    }

    /// Checks whether a task has been cancelled.
    /// Note: Returns true if the task does NOT exist in the registry (i.e. already finished/cleaned up).
    #[allow(dead_code)]
    pub fn is_cancelled(&self, task_id: &str) -> bool {
        if let Ok(map) = self.tasks.lock() {
            if let Some(entry) = map.get(task_id) {
                return entry.is_cancelled.load(Ordering::Relaxed);
            }
        }
        true
    }

    /// Retrieves a clone of the `Arc<AtomicBool>` cancellation token for a registered task.
    #[allow(dead_code)]
    pub fn get_token(&self, task_id: &str) -> Option<Arc<AtomicBool>> {
        if let Ok(map) = self.tasks.lock() {
            map.get(task_id).map(|e| e.is_cancelled.clone())
        } else {
            None
        }
    }

    /// Removes a task from the active registry.
    #[allow(dead_code)]
    pub fn remove_task(&self, task_id: &str) {
        if let Ok(mut map) = self.tasks.lock() {
            map.remove(task_id);
        }
    }

    /// Lists all currently active tasks.
    pub fn list_tasks(&self) -> Vec<TaskInfo> {
        if let Ok(map) = self.tasks.lock() {
            map.values().map(|e| e.info.clone()).collect()
        } else {
            Vec::new()
        }
    }
}

/// Global singleton accessor for the TaskRegistry.
pub fn global_task_registry() -> &'static TaskRegistry {
    static REGISTRY: OnceLock<TaskRegistry> = OnceLock::new();
    REGISTRY.get_or_init(TaskRegistry::new)
}

pub fn register_task(task_id: &str, task_type: &str) -> TaskGuard {
    global_task_registry().register_task(task_id, task_type)
}

pub fn cancel_task_sync(task_id: &str) -> bool {
    global_task_registry().cancel_task(task_id)
}

pub fn cancel_by_prefix_sync(prefix: &str) -> usize {
    global_task_registry().cancel_by_prefix(prefix)
}

#[allow(dead_code)]
pub fn is_cancelled(task_id: &str) -> bool {
    global_task_registry().is_cancelled(task_id)
}

#[allow(dead_code)]
pub fn get_task_token(task_id: &str) -> Option<Arc<AtomicBool>> {
    global_task_registry().get_token(task_id)
}

// ── Tauri IPC Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn cancel_task(task_id: String) -> Result<bool, AppError> {
    Ok(global_task_registry().cancel_task(&task_id))
}

#[tauri::command]
pub fn cancel_tasks_by_prefix(prefix: String) -> Result<usize, AppError> {
    Ok(global_task_registry().cancel_by_prefix(&prefix))
}

#[tauri::command]
pub fn list_active_tasks() -> Result<Vec<TaskInfo>, AppError> {
    Ok(global_task_registry().list_tasks())
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_and_cancel_task() {
        let registry = TaskRegistry::new();
        let guard = registry.register_task("test_task_1", "test");

        assert_eq!(guard.task_id(), "test_task_1");
        assert!(!guard.is_cancelled());
        assert!(guard.check_cancelled().is_ok());

        let cancelled = registry.cancel_task("test_task_1");
        assert!(cancelled);
        assert!(guard.is_cancelled());
        assert!(matches!(guard.check_cancelled(), Err(AppError::Cancelled)));
    }

    #[test]
    fn test_raii_task_guard_drop_cleanup() {
        let registry = TaskRegistry::new();
        {
            let _guard = registry.register_task("scoped_task", "compute");
            let tasks = registry.list_tasks();
            assert_eq!(tasks.len(), 1);
            assert_eq!(tasks[0].task_id, "scoped_task");
        }
        // Guard was dropped here; registry must be empty
        let tasks = registry.list_tasks();
        assert!(tasks.is_empty());
    }

    #[test]
    fn test_cancel_by_prefix() {
        let registry = TaskRegistry::new();
        let _g1 = registry.register_task("viewer:ellen", "viewer");
        let _g2 = registry.register_task("viewer:jane", "viewer");
        let _g3 = registry.register_task("download:12345", "download");

        assert_eq!(registry.list_tasks().len(), 3);

        let cancelled_count = registry.cancel_by_prefix("viewer:");
        assert_eq!(cancelled_count, 2);

        assert!(_g1.is_cancelled());
        assert!(_g2.is_cancelled());
        assert!(!_g3.is_cancelled());
    }

    #[test]
    fn test_cancel_all() {
        let registry = TaskRegistry::new();
        let _g1 = registry.register_task("t1", "job");
        let _g2 = registry.register_task("t2", "job");

        let cancelled = registry.cancel_all();
        assert_eq!(cancelled, 2);
        assert!(_g1.is_cancelled());
        assert!(_g2.is_cancelled());
    }

    #[test]
    fn test_concurrent_task_operations() {
        use std::thread;

        let registry = Arc::new(TaskRegistry::new());
        let mut handles = Vec::new();

        for i in 0..10 {
            let reg = registry.clone();
            handles.push(thread::spawn(move || {
                let id = format!("task_{}", i);
                let guard = reg.register_task(&id, "worker");
                if i % 2 == 0 {
                    reg.cancel_task(&id);
                }
                guard.is_cancelled()
            }));
        }

        let results: Vec<bool> = handles.into_iter().map(|h| h.join().unwrap()).collect();
        assert_eq!(results.len(), 10);
    }
}
