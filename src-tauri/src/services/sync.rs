use tauri::{AppHandle, Manager};
use std::path::Path;
use tokio::fs as async_fs;
use crate::error::AppError;
use tracing::{info, instrument};
use serde_json::{Value, json, Map};
use std::sync::Arc;
use tokio::sync::Semaphore;
use std::fs::OpenOptions;
use std::io::Write;

const CATEGORIES: &[&str] = &[
    "playable_characters",
    "npcs",
    "bangboos",
    "weapons",
    "ui",
    "enemies",
    "hash_migrations",
    "community_feed",
];

fn append_sync_log(app_data_dir: &Path, msg: &str) {
    tracing::warn!("{msg}");
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(app_data_dir.join("sync.log")) {
        let _ = writeln!(f, "{msg}");
    }
}

#[tauri::command]
#[instrument(skip(app))]
pub async fn sync_database(app: AppHandle, mut repo_url: String, download_images: bool) -> Result<String, AppError> {
    info!("Syncing database from {}, download_images: {}", repo_url, download_images);
    if repo_url.contains("github.com") && !repo_url.contains("raw.githubusercontent.com") {
        let clean_url = repo_url.replace(".git", "");
        let parts: Vec<&str> = clean_url.split("github.com/").collect();
        if parts.len() == 2 {
            let repo_path = parts[1].trim_end_matches('/');
            repo_url = format!("https://raw.githubusercontent.com/{}/main/", repo_path);
        }
    }

    let base_url = if repo_url.ends_with(".json") {
        if let Some(idx) = repo_url.rfind('/') {
            repo_url[..idx].to_string()
        } else {
            repo_url.clone()
        }
    } else {
        repo_url.trim_end_matches('/').to_string()
    };

    let app_data_dir = app.path().app_data_dir()?;
    async_fs::create_dir_all(&app_data_dir).await?;
    let images_dir = app_data_dir.join("images");
    async_fs::create_dir_all(&images_dir).await?;
    let db_path = app_data_dir.join("database.json");

    let client = reqwest::Client::new();
    let mut combined_db = Map::new();
    let mut all_downloads: Vec<(String, std::path::PathBuf)> = Vec::new();

    for category in CATEGORIES {
        let cat_url = format!("{}/{}.json", base_url, category);
        if let Ok(res) = client.get(&cat_url).send().await {
            if res.status().is_success() {
                if let Ok(text) = res.text().await {
                    if let Ok(mut parsed) = serde_json::from_str::<Value>(&text) {
                        // The file itself might be an array of items, an object wrapping an array/map, or a standalone object
                        let items = if parsed.is_array() {
                            parsed.take()
                        } else if let Some(arr) = parsed.get_mut(category) {
                            arr.take()
                        } else if let Some(arr) = parsed.get_mut("characters") {
                            arr.take()
                        } else {
                            parsed
                        };

                        if let Some(arr) = items.as_array() {
                            for char in arr {
                                let mut urls_to_download = Vec::new();
                                let fields = ["image_url", "icon_url", "mindscape_url"];
                                for f in fields {
                                    if let Some(u) = char.get(f).and_then(|u| u.as_str()) {
                                        if !u.is_empty() { urls_to_download.push(u.to_string()); }
                                    }
                                }
                                if let Some(skins) = char.get("skins").and_then(|s| s.as_array()) {
                                    for skin in skins {
                                        for f in ["image_url", "icon_url"] {
                                            if let Some(u) = skin.get(f).and_then(|u| u.as_str()) {
                                                if !u.is_empty() { urls_to_download.push(u.to_string()); }
                                            }
                                        }
                                    }
                                }

                                for img_url in urls_to_download {
                                    let file_name = Path::new(&img_url).file_name().unwrap_or_default().to_string_lossy().to_string();
                                    let local_img_path = images_dir.join(&file_name);
                                    
                                    let target_url = if img_url.starts_with("http") {
                                        img_url.to_string()
                                    } else {
                                        let clean_img = img_url.strip_prefix('/').unwrap_or(&img_url);
                                        format!("{}/{}", base_url, clean_img)
                                    };
                                    
                                    all_downloads.push((target_url, local_img_path));
                                }
                            }
                        }
                        combined_db.insert(category.to_string(), items);
                    } else {
                        append_sync_log(&app_data_dir, &format!("JSON Parse failed for {}: {}", cat_url, text));
                        combined_db.insert(category.to_string(), Value::Array(vec![]));
                    }
                } else {
                    append_sync_log(&app_data_dir, &format!("Failed to read text for {}", cat_url));
                    combined_db.insert(category.to_string(), Value::Array(vec![]));
                }
            } else {
                append_sync_log(&app_data_dir, &format!("Request failed with status {} for {}", res.status(), cat_url));
                // If the file doesn't exist (e.g. 404), just insert an empty array
                combined_db.insert(category.to_string(), Value::Array(vec![]));
            }
        } else {
            append_sync_log(&app_data_dir, &format!("Reqwest send failed for {}", cat_url));
        }
    }

    if download_images {
        let semaphore = Arc::new(Semaphore::new(5));
        let mut tasks = Vec::new();

        for (target_url, local_img_path) in all_downloads {
            let sem = semaphore.clone();
            let client_clone = client.clone();
            
            tasks.push(tokio::spawn(async move {
                let Ok(_permit) = sem.acquire().await else {
                    return;
                };
                
                let local_size = async_fs::metadata(&local_img_path).await.map(|m| m.len()).unwrap_or(0);
                let mut should_download = true;

                if local_size > 0 {
                    if let Ok(head_res) = client_clone.head(&target_url).send().await {
                        if let Some(cl) = head_res.headers().get(reqwest::header::CONTENT_LENGTH) {
                            if let Ok(remote_size) = cl.to_str().unwrap_or("").parse::<u64>() {
                                if local_size == remote_size {
                                    should_download = false;
                                }
                            }
                        }
                    }
                }

                if should_download {
                    if let Ok(img_res) = client_clone.get(&target_url).send().await {
                        if let Ok(bytes) = img_res.bytes().await {
                            let _ = async_fs::write(&local_img_path, bytes).await;
                        }
                    }
                }
            }));
        }

        for task in tasks {
            let _ = task.await;
        }
    }

    let combined_json = Value::Object(combined_db);
    let out_text = serde_json::to_string_pretty(&combined_json)?;
    let tmp_path = db_path.with_extension("tmp");
    async_fs::write(&tmp_path, &out_text).await?;
    let _ = async_fs::rename(&tmp_path, &db_path).await;

    // Invalidate the in-memory hash alias and fixer database caches so the next operations use fresh data.
    crate::utils::invalidate_hash_alias_cache();
    crate::mod_fixer::invalidate_fixer_db_cache();

    Ok("Synced successfully".into())
}

#[tauri::command]
pub async fn get_cached_database(app: AppHandle) -> Result<String, AppError> {
    let app_data_dir = app.path().app_data_dir()?;
    let mut db_path = app_data_dir.join("database.json");
    if !db_path.exists() {
        // Fallback to old path
        db_path = app_data_dir.join("characters.json");
    }
    
    let images_dir = app_data_dir.join("images");
    
    if db_path.exists() {
        let content = async_fs::read_to_string(&db_path).await?;
        
        if let Ok(mut parsed) = serde_json::from_str::<serde_json::Value>(&content) {
            // It could be the new format { "playable_characters": [], "npcs": [] } or old { "characters": [] }
            let mut categories_to_process = Vec::new();
            if let Some(obj) = parsed.as_object() {
                for (k, _) in obj {
                    categories_to_process.push(k.clone());
                }
            } else {
                return Ok(content);
            }

            for cat in categories_to_process {
                if let Some(items) = parsed.get_mut(&cat).and_then(|c| c.as_array_mut()) {
                    for char in items {
                        let fields = ["image_url", "icon_url", "mindscape_url"];
                        for f in fields {
                            if let Some(img_url) = char.get(f).and_then(|u| u.as_str()) {
                                if !img_url.is_empty() {
                                    let file_name = Path::new(img_url).file_name().unwrap_or_default().to_string_lossy().to_string();
                                    let local_img_path = images_dir.join(&file_name);
                                    if local_img_path.exists() {
                                        char[f] = json!(local_img_path.to_string_lossy().replace("\\", "/"));
                                    } else {
                                        char[f] = serde_json::Value::Null;
                                    }
                                }
                            }
                        }
                        if let Some(skins) = char.get_mut("skins").and_then(|s| s.as_array_mut()) {
                            for skin in skins {
                                for f in ["image_url", "icon_url"] {
                                    if let Some(img_url) = skin.get(f).and_then(|u| u.as_str()) {
                                        if !img_url.is_empty() {
                                            let file_name = Path::new(img_url).file_name().unwrap_or_default().to_string_lossy().to_string();
                                            let local_img_path = images_dir.join(&file_name);
                                            if local_img_path.exists() {
                                                skin[f] = json!(local_img_path.to_string_lossy().replace("\\", "/"));
                                            } else {
                                                skin[f] = serde_json::Value::Null;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Ok(serde_json::to_string(&parsed)?)
        } else {
            Ok(content)
        }
    } else {
        Err(AppError::Custom("Database not found".into()))
    }
}
