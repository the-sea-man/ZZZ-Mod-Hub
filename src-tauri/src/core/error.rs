use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON Error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Request Error: {0}")]
    Reqwest(#[from] reqwest::Error),

    #[error("Zip Error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("Tauri Error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("Custom Error: {0}")]
    Custom(String),

    #[error("Conflict: '{target}' already exists. Please resolve the conflict manually by deleting or renaming the conflicting folder.")]
    ModConflict { target: String },

    #[error("'{0}' is password-protected — check the mod page")]
    PasswordProtected(String),

    #[error("Operation cancelled")]
    Cancelled,
}

// Convert string messages into AppError
impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Custom(s.to_string())
    }
}

impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Custom(s)
    }
}

// Tauri requires errors to be Serializable to pass them to the frontend
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
