//! Archive extraction utilities.

use crate::error::AppError;
use super::types::sanitize_path_component;
use std::fs;
use std::path::Path;

#[tauri::command]
pub fn extract_mod_zip(zip_path: &str, destination_folder: &str) -> Result<String, AppError> {
    let file = fs::File::open(zip_path)?;
    let reader = std::io::BufReader::new(file);
    let mut archive = zip::ZipArchive::new(reader)?;

    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(f) => f,
            Err(e) => {
                let err_str = e.to_string().to_lowercase();
                if err_str.contains("password") || err_str.contains("encrypt") {
                    let file_name = Path::new(zip_path)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    return Err(AppError::PasswordProtected(file_name));
                }
                return Err(e.into());
            }
        };
        let outpath = match file.enclosed_name() {
            Some(path) => {
                let sanitized_path: std::path::PathBuf = path
                    .components()
                    .map(|comp| {
                        let os_str = comp.as_os_str().to_string_lossy();
                        sanitize_path_component(&os_str)
                    })
                    .collect();
                Path::new(destination_folder).join(sanitized_path)
            }
            None => continue,
        };

        if (*file.name()).ends_with('/') {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p)?;
                }
            }
            let outfile = std::fs::File::create(&outpath)?;
            let mut writer = std::io::BufWriter::new(outfile);
            std::io::copy(&mut file, &mut writer)?;
        }
    }
    
    Ok("Extracted successfully".into())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveToolType {
    WinRar,
    SevenZip,
}

/// Locates a valid extraction tool (WinRAR or 7-Zip) from user config or standard Windows install paths.
pub fn find_archive_tool(custom_path: &str) -> Option<(std::path::PathBuf, ArchiveToolType)> {
    let trimmed = custom_path.trim();
    if !trimmed.is_empty() {
        let p = Path::new(trimmed);
        if p.is_file() {
            let file_name = p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
            if file_name.contains("7z") {
                return Some((p.to_path_buf(), ArchiveToolType::SevenZip));
            } else {
                return Some((p.to_path_buf(), ArchiveToolType::WinRar));
            }
        }
    }

    let candidates = [
        ("C:\\Program Files\\WinRAR\\WinRAR.exe", ArchiveToolType::WinRar),
        ("C:\\Program Files (x86)\\WinRAR\\WinRAR.exe", ArchiveToolType::WinRar),
        ("C:\\Program Files\\7-Zip\\7z.exe", ArchiveToolType::SevenZip),
        ("C:\\Program Files (x86)\\7-Zip\\7z.exe", ArchiveToolType::SevenZip),
    ];

    for (cand, tool_type) in candidates {
        let p = Path::new(cand);
        if p.is_file() {
            return Some((p.to_path_buf(), tool_type));
        }
    }

    None
}

/// Extracts a .rar or .7z archive using either WinRAR or 7-Zip CLI.
pub fn extract_rar_or_7z(
    archive_path: &Path,
    dest_dir: &Path,
    tool_path: &Path,
    tool_type: ArchiveToolType,
) -> Result<(), AppError> {
    let mut cmd = std::process::Command::new(tool_path);
    match tool_type {
        ArchiveToolType::WinRar => {
            cmd.arg("x")
                .arg("-ibck")
                .arg("-y")
                .arg(archive_path)
                .arg(format!("{}\\", dest_dir.to_string_lossy()));
        }
        ArchiveToolType::SevenZip => {
            cmd.arg("x")
                .arg("-y")
                .arg(archive_path)
                .arg(format!("-o{}", dest_dir.to_string_lossy()));
        }
    }

    let output = cmd.output()?;
    if output.status.success() {
        Ok(())
    } else {
        let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
        let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
        let combined = format!("{} {}", stdout, stderr);
        let code = output.status.code().unwrap_or(0);

        if combined.contains("password")
            || combined.contains("encrypt")
            || combined.contains("wrong password")
            || combined.contains("data error")
            || code == 3
            || code == 8
        {
            let file_name = archive_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            Err(AppError::PasswordProtected(file_name))
        } else {
            Err(AppError::Custom(format!(
                "Archive extraction failed ({:?}): {}",
                tool_type, combined
            )))
        }
    }
}


