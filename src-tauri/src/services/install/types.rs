//! Types and path sanitization for mod installation.

use crate::models::Confidence;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct GenerateFolderRequest {
    pub folder_name: String,
    pub character_id: String,
    pub skin_id: Option<String>,
}

pub fn sanitize_path_component(s: &str) -> String {
    if s.is_empty() {
        return "unnamed".to_string();
    }
    let mut sanitized: String = s
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' | '\0'..='\x1F' => '_',
            _ => c,
        })
        .collect();

    sanitized = sanitized.replace("..", "_");

    let upper = sanitized.to_uppercase();
    let is_reserved = matches!(
        upper.as_str(),
        "CON" | "PRN" | "AUX" | "NUL"
            | "COM1" | "COM2" | "COM3" | "COM4" | "COM5" | "COM6" | "COM7" | "COM8" | "COM9"
            | "LPT1" | "LPT2" | "LPT3" | "LPT4" | "LPT5" | "LPT6" | "LPT7" | "LPT8" | "LPT9"
    );
    if is_reserved {
        sanitized = format!("_{}", sanitized);
    }

    let trimmed = sanitized.trim_end_matches(&['.', ' '][..]).to_string();
    if trimmed.is_empty() {
        "unnamed".to_string()
    } else {
        trimmed
    }
}


#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModCategoryMatch {
    pub category_name: String,
    pub confidence: Confidence,
    pub character_id: Option<String>,
    pub skin_id: Option<String>,
}
