use crate::models::{InstallResult, ModUpdateCheckRequest, UpdateAvailable};
use crate::error::AppError;
use crate::install::install_mods;
use std::fs;
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};
use tokio::io::AsyncWriteExt;
use std::sync::Arc;
use std::sync::atomic::Ordering;

#[derive(Clone, serde::Serialize)]
pub struct DownloadProgressPayload {
    download_id: String,
    mod_name: String,
    downloaded: u64,
    total: u64,
    status: String,
    speed_bytes_per_sec: f64,
}

#[derive(Clone, serde::Serialize)]
pub struct DownloadCompletePayload {
    download_id: String,
    status: String,
    results: Option<Vec<InstallResult>>,
    error: Option<String>,
}

pub fn score_search_relevance(title: &str, desc: &str, query: &str) -> i32 {
    let q_clean = query.trim().to_lowercase();
    if q_clean.is_empty() {
        return 0;
    }

    let t_lower = title.trim().to_lowercase();
    let d_lower = desc.trim().to_lowercase();

    let normalize = |s: &str| -> String {
        let mut res = String::new();
        let mut last_was_space = false;
        for c in s.chars() {
            if c.is_alphanumeric() {
                res.push(c.to_ascii_lowercase());
                last_was_space = false;
            } else if !last_was_space {
                res.push(' ');
                last_was_space = true;
            }
        }
        res.trim().to_string()
    };

    let q_norm = normalize(&q_clean);
    let t_norm = normalize(&t_lower);

    // 1. Exact full title match (e.g. "Bakery-Ellen" == "Bakery-Ellen" or "bakery ellen")
    if t_lower == q_clean || (!q_norm.is_empty() && t_norm == q_norm) {
        return 2000;
    }

    // 2. Title starts with exact query (e.g. "Bakery-Ellen (+NSFW)" starts with "Bakery-Ellen")
    if t_lower.starts_with(&q_clean) || (!q_norm.is_empty() && t_norm.starts_with(&q_norm)) {
        return 1500;
    }

    // 3. Title contains full query string verbatim
    if t_lower.contains(&q_clean) || (!q_norm.is_empty() && t_norm.contains(&q_norm)) {
        return 1000;
    }

    // 4. Multi-word checks in title
    let query_words: Vec<&str> = q_norm.split_whitespace().filter(|w| !w.is_empty()).collect();
    if !query_words.is_empty() {
        let all_words_in_title = query_words.iter().all(|w| t_norm.contains(w) || t_lower.contains(w));
        if all_words_in_title {
            return 800; // All words found in title!
        }

        let words_in_title_count = query_words.iter().filter(|w| t_norm.contains(*w) || t_lower.contains(*w)).count();
        if words_in_title_count > 0 {
            return 400 + (words_in_title_count as i32 * 50);
        }
    }

    // 5. Description matches
    if d_lower.contains(&q_clean) || (!q_norm.is_empty() && normalize(&d_lower).contains(&q_norm)) {
        return 200;
    }

    if !query_words.is_empty() && query_words.iter().all(|w| d_lower.contains(w)) {
        return 100;
    }

    0
}

#[tauri::command]
pub async fn fetch_gb_mods(
    page: u32,
    search: Option<String>,
    sort: Option<String>,
    category_id: Option<u32>,
    feed_mode: Option<String>,
    nsfw: bool,
) -> Result<Value, AppError> {
    let sort_mode = sort.unwrap_or_else(|| "default".to_string());
    let mode = feed_mode.unwrap_or_else(|| "all".to_string());
    let search_clean = search.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    let client = reqwest::Client::builder()
        .user_agent("ZzzModManager/1.0")
        .build()?;

    if mode == "featured" {
        let url = format!("https://gamebanana.com/apiv13/Util/List/Featured?_idGameRow=19567&_nPage={}", page);
        let response = client.get(&url).send().await?.json::<Value>().await?;
        return Ok(response);
    } else if mode == "spotlight" {
        // Spotlight doesn't support pagination
        let url = "https://gamebanana.com/apiv13/Game/19567/CommunitySpotlight".to_string();
        let response = client.get(&url).send().await?.json::<Value>().await?;
        return Ok(response);
    } else if mode == "top" {
        let url = "https://gamebanana.com/apiv13/Game/19567/TopSubs".to_string();
        let response = client.get(&url).send().await?.json::<Value>().await?;
        return Ok(response);
    }

    // Mode == "all"
    if let Some(s) = search_clean {
        let encoded_s = urlencoding::encode(&s);
        let nsfw_param = if nsfw {
            "&_bIncludeNsfw=1"
        } else {
            "&_aFilters[Generic_ContentRatings]=-"
        };

        if let Some(cat_id) = category_id {
            // Searching inside a specific Category
            let mapped_sort = match sort_mode.as_str() {
                "downloads" => "Generic_MostDownloaded",
                "likes" => "Generic_MostLiked",
                "views" => "Generic_MostViewed",
                _ => "Generic_Newest",
            };
            let url = format!(
                "https://gamebanana.com/apiv13/Mod/Index?_nPerpage=50&_sSort={}&_aFilters[Generic_Category]={}&_nPage={}{}",
                mapped_sort, cat_id, page, nsfw_param
            );
            let mut response = client.get(&url).send().await?.json::<Value>().await?;
            if let Some(records_arr) = response.get_mut("_aRecords").and_then(|r| r.as_array_mut()) {
                let mut scored: Vec<(i32, Value)> = records_arr
                    .drain(..)
                    .filter_map(|rec| {
                        let name = rec.get("_sName").and_then(|n| n.as_str()).unwrap_or("");
                        let desc = rec.get("_sDescription").and_then(|d| d.as_str()).unwrap_or("");
                        let score = score_search_relevance(name, desc, &s);
                        if score > 0 {
                            Some((score, rec))
                        } else {
                            None
                        }
                    })
                    .collect();
                scored.sort_by_key(|b| std::cmp::Reverse(b.0));
                *records_arr = scored.into_iter().map(|(_, rec)| rec).collect();
            }
            if let Some(obj) = response.as_object_mut() {
                obj.insert("_debugUrl".to_string(), Value::String(url));
            }
            return Ok(response);
        }

        // Global Text Search: HYBRID STRATEGY (Subfeed _sName + Search/Results name,description)
        let subfeed_url = format!(
            "https://gamebanana.com/apiv13/Game/19567/Subfeed?_nPage={}&_sName={}&_csvModelInclusions=Mod{}",
            page, encoded_s, nsfw_param
        );
        let search_url = format!(
            "https://gamebanana.com/apiv13/Util/Search/Results?_sOrder=best_match&_idGameRow=19567&_sSearchString={}&_csvFields=name%2Cdescription&_nPage={}&_csvModelInclusions=Mod{}",
            encoded_s, page, nsfw_param
        );

        let (subfeed_res, search_res) = tokio::join!(
            client.get(&subfeed_url).send(),
            client.get(&search_url).send()
        );

        let mut candidate_records: Vec<Value> = Vec::new();
        let mut seen_ids: std::collections::HashSet<u64> = std::collections::HashSet::new();
        let mut subfeed_complete = false;
        let mut subfeed_count: u64 = 0;
        let mut search_complete = false;
        let mut search_count: u64 = 0;

        // 1. Process Subfeed results (Precision title matches)
        if let Ok(res) = subfeed_res {
            if let Ok(json_val) = res.json::<Value>().await {
                if let Some(meta) = json_val.get("_aMetadata") {
                    subfeed_complete = meta.get("_bIsComplete").and_then(|b| b.as_bool()).unwrap_or(false);
                    subfeed_count = meta.get("_nRecordCount").and_then(|c| c.as_u64()).unwrap_or(0);
                }
                if let Some(records) = json_val.get("_aRecords").and_then(|r| r.as_array()) {
                    for rec in records {
                        let model_name = rec.get("_sModelName").and_then(|m| m.as_str()).unwrap_or("Mod");
                        if model_name != "Mod" {
                            continue;
                        }
                        if let Some(id) = rec.get("_idRow").and_then(|i| i.as_u64()) {
                            if seen_ids.insert(id) {
                                candidate_records.push(rec.clone());
                            }
                        }
                    }
                }
            }
        }

        // 2. Process Search/Results (Keyword / description matches)
        if let Ok(res) = search_res {
            if let Ok(json_val) = res.json::<Value>().await {
                if let Some(meta) = json_val.get("_aMetadata") {
                    search_complete = meta.get("_bIsComplete").and_then(|b| b.as_bool()).unwrap_or(false);
                    search_count = meta.get("_nRecordCount").and_then(|c| c.as_u64()).unwrap_or(0);
                }
                if let Some(records) = json_val.get("_aRecords").and_then(|r| r.as_array()) {
                    for rec in records {
                        let model_name = rec.get("_sModelName").and_then(|m| m.as_str()).unwrap_or("Mod");
                        if model_name != "Mod" {
                            continue;
                        }
                        if let Some(id) = rec.get("_idRow").and_then(|i| i.as_u64()) {
                            if seen_ids.insert(id) {
                                candidate_records.push(rec.clone());
                            }
                        }
                    }
                }
            }
        }

        // 3. Score all candidate records for relevance
        let mut scored_records: Vec<(i32, u64, u64, Value)> = candidate_records
            .into_iter()
            .map(|rec| {
                let name = rec.get("_sName").and_then(|n| n.as_str()).unwrap_or("");
                let desc = rec.get("_sDescription").and_then(|d| d.as_str()).unwrap_or("");
                let score = score_search_relevance(name, desc, &s);
                let likes = rec.get("_nLikeCount").and_then(|l| l.as_u64()).unwrap_or(0);
                let updated = rec.get("_tsDateUpdated").and_then(|t| t.as_u64()).unwrap_or(0);
                (score, likes, updated, rec)
            })
            .collect();

        // Sort by: score DESC, likes DESC, updated DESC
        scored_records.sort_by(|a, b| {
            b.0.cmp(&a.0)
                .then_with(|| b.1.cmp(&a.1))
                .then_with(|| b.2.cmp(&a.2))
        });

        let final_records: Vec<Value> = scored_records.into_iter().map(|(_, _, _, rec)| rec).collect();
        let total_count = final_records.len();
        let is_complete = (subfeed_complete && search_complete) || total_count == 0;
        let record_count = std::cmp::max(total_count as u64, std::cmp::max(subfeed_count, search_count));

        let response = json!({
            "_aMetadata": {
                "_nRecordCount": record_count,
                "_nPerpage": 15,
                "_bIsComplete": is_complete
            },
            "_aRecords": final_records,
            "_debugUrl": format!("Hybrid: Subfeed(_sName={}) + Search/Results(name,description)", s)
        });

        return Ok(response);
    }

    // Default category or global feed browsing when not searching
    let mut url = if let Some(cat_id) = category_id {
        let mapped_sort = match sort_mode.as_str() {
            "downloads" => "Generic_MostDownloaded",
            "likes" => "Generic_MostLiked",
            "views" => "Generic_MostViewed",
            _ => "Generic_Newest",
        };
        format!(
            "https://gamebanana.com/apiv13/Mod/Index?_nPerpage=15&_sSort={}&_aFilters[Generic_Category]={}&_nPage={}",
            mapped_sort, cat_id, page
        )
    } else {
        match sort_mode.as_str() {
            "updated" | "default" => {
                format!(
                    "https://gamebanana.com/apiv13/Game/19567/Subfeed?_nPage={}&_sSort={}&_csvModelInclusions=Mod",
                    page, sort_mode
                )
            }
            _ => {
                let mapped_sort = match sort_mode.as_str() {
                    "downloads" => "Generic_MostDownloaded",
                    "likes" => "Generic_MostLiked",
                    "views" => "Generic_MostViewed",
                    _ => "Generic_Newest",
                };
                format!(
                    "https://gamebanana.com/apiv13/Mod/Index?_nPerpage=15&_sSort={}&_aFilters[Generic_Game]=19567&_nPage={}",
                    mapped_sort, page
                )
            }
        }
    };

    if nsfw {
        if url.contains('?') {
            url = format!("{}&_bIncludeNsfw=1", url);
        } else {
            url = format!("{}?_bIncludeNsfw=1", url);
        }
    } else {
        if url.contains('?') {
            url = format!("{}&_aFilters[Generic_ContentRatings]=-", url);
        } else {
            url = format!("{}?_aFilters[Generic_ContentRatings]=-", url);
        }
    }

    let mut response = client.get(&url).send().await?.json::<Value>().await?;
    if let Some(obj) = response.as_object_mut() {
        obj.insert("_debugUrl".to_string(), Value::String(url));
    }

    Ok(response)
}

#[tauri::command]
pub async fn fetch_gb_mod_details(mod_id: u32, model_name: Option<String>) -> Result<Value, AppError> {
    let model = model_name.unwrap_or_else(|| "Mod".to_string());
    let url = format!("https://gamebanana.com/apiv13/{}/{}/ProfilePage", model, mod_id);
    let client = reqwest::Client::builder()
        .user_agent("ZzzModManager/1.0")
        .build()?;
    let response = client.get(&url).send().await?.json::<Value>().await?;
    
    Ok(response)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn download_gb_mod(
    app: AppHandle,
    download_id: String,
    download_url: String,
    file_name: String,
    root_path: String,
    winrar_path: String,
    target_category: Option<String>,
    max_attempts: u32,
    retry_interval: u64,
    gb_mod_id: Option<u64>,
    author: Option<String>,
    source_url: Option<String>,
    gb_last_updated: Option<u64>,
) -> Result<(), AppError> {
    
    let d_id = download_id.clone();
    
    let task_guard = crate::task_manager::register_task(&d_id, "download");
    let cancel_token = task_guard.token();
    
    tokio::spawn(async move {
        let _task_guard = task_guard;
        let mut attempts = 0;
        let mut last_error_msg = String::new();
        let mut download_success = false;
        
        let temp_dir = std::env::temp_dir().join("zzzmodmanager_gb_downloads");
        let temp_file_path = temp_dir.join(&file_name);
        
        let client = match reqwest::Client::builder()
            .user_agent("ZzzModManager/1.0")
            .connect_timeout(std::time::Duration::from_secs(8))
            .redirect(reqwest::redirect::Policy::none())
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit(
                    "download-complete",
                    DownloadCompletePayload {
                        download_id: d_id,
                        status: "Error".to_string(),
                        results: None,
                        error: Some(format!("Failed to initialize HTTP client: {e}")),
                    },
                );
                return;
            }
        };
        
        while attempts < max_attempts {
            if cancel_token.load(Ordering::Relaxed) {
                last_error_msg = "Cancelled by user".to_string();
                break;
            }
            attempts += 1;
            
            let _ = app.emit("download-progress", DownloadProgressPayload {
                download_id: d_id.clone(),
                mod_name: "".to_string(),
                downloaded: 0,
                total: 100,
                status: if attempts == 1 { "Starting download...".to_string() } else { format!("Retrying ({}/{})...", attempts, max_attempts) },
                speed_bytes_per_sec: 0.0,
            });
            
            if !temp_dir.exists() {
                let _ = fs::create_dir_all(&temp_dir);
            }
            
            let mut can_chunk = false;
            let mut total_size: u64 = 0;
            
            let mut current_url = download_url.clone();
            let mut resolved_url = download_url.clone();
            
            for _ in 0..5 {
                match client.get(&current_url).send().await {
                    Ok(resp) => {
                        if resp.status().is_redirection() {
                            if let Some(loc) = resp.headers().get(reqwest::header::LOCATION) {
                                if let Ok(loc_str) = loc.to_str() {
                                    current_url = loc_str.to_string();
                                    continue;
                                }
                            }
                        }
                        resolved_url = current_url.clone();
                        break;
                    }
                    Err(_) => {
                        if current_url.contains("filecache") {
                            if let Some(start_idx) = current_url.find("filecache") {
                                if let Some(end_idx) = current_url[start_idx..].find(".gamebanana.com") {
                                    let to_replace = &current_url[start_idx..start_idx + end_idx];
                                    current_url = current_url.replace(to_replace, "images");
                                    continue;
                                }
                            }
                        }
                        resolved_url = current_url.clone();
                        break;
                    }
                }
            }
            
            if let Ok(resp) = client.head(&resolved_url).send().await {
                use reqwest::header::{ACCEPT_RANGES, CONTENT_LENGTH};
                if let Some(accept) = resp.headers().get(ACCEPT_RANGES) {
                    if accept.to_str().unwrap_or("") == "bytes" {
                        can_chunk = true;
                    }
                }
                if let Some(cl) = resp.headers().get(CONTENT_LENGTH) {
                    if let Ok(cl_str) = cl.to_str() {
                        if let Ok(cl_val) = cl_str.parse::<u64>() {
                            total_size = cl_val;
                        }
                    }
                }
            }
            
            if can_chunk && total_size > 5_000_000 {
                let num_chunks = 4;
                let chunk_size = total_size / num_chunks;
                
                use std::sync::atomic::AtomicU64;
                let downloaded_bytes = Arc::new(AtomicU64::new(0));
                let mut tasks = vec![];
                let mut chunk_files = vec![];
                let mut chunk_error = false;
                
                for i in 0..num_chunks {
                    let start = i * chunk_size;
                    let end = if i == num_chunks - 1 { total_size - 1 } else { (i + 1) * chunk_size - 1 };
                    
                    let chunk_file_path = temp_dir.join(format!("{file_name}.part{i}"));
                    chunk_files.push(chunk_file_path.clone());
                    
                    let c_client = client.clone();
                    let c_url = resolved_url.clone();
                    let c_cancel = cancel_token.clone();
                    let c_downloaded = downloaded_bytes.clone();
                    
                    tasks.push(tokio::spawn(async move {
                        use reqwest::header::{RANGE, HeaderValue};
                        use tokio::io::AsyncWriteExt;
                        let range_header = format!("bytes={start}-{end}");
                        let range_val = HeaderValue::from_str(&range_header)
                            .map_err(|e| AppError::Custom(e.to_string()))?;
                        let mut req = c_client.get(&c_url).header(RANGE, range_val).send().await?;
                        
                        let file = tokio::fs::File::create(&chunk_file_path).await?;
                        let mut writer = tokio::io::BufWriter::with_capacity(1024 * 1024, file);
                        
                        while let Ok(Some(chunk)) = req.chunk().await {
                            if c_cancel.load(Ordering::Relaxed) {
                                return Err(AppError::Custom("Cancelled by user".to_string()));
                            }
                            writer.write_all(&chunk).await?;
                            c_downloaded.fetch_add(chunk.len() as u64, Ordering::Relaxed);
                        }
                        writer.flush().await?;
                        Ok::<(), AppError>(())
                    }));
                }
                
                let m_app = app.clone();
                let m_d_id = d_id.clone();
                let m_downloaded = downloaded_bytes.clone();
                let m_cancel = cancel_token.clone();
                
                let monitor = tokio::spawn(async move {
                    let mut last_val = 0;
                    let mut smoothed_speed: f64 = 0.0;
                    loop {
                        sleep(Duration::from_millis(1000)).await;
                        if m_cancel.load(Ordering::Relaxed) { break; }
                        let current = m_downloaded.load(Ordering::Relaxed);
                        let diff = current.saturating_sub(last_val);
                        
                        let instant_speed = diff as f64; // since interval is 1s, diff is bytes/sec
                        if smoothed_speed == 0.0 {
                            smoothed_speed = instant_speed;
                        } else {
                            smoothed_speed = (instant_speed * 0.3) + (smoothed_speed * 0.7);
                        }
                        
                        last_val = current;
                        
                        let _ = m_app.emit("download-progress", DownloadProgressPayload {
                            download_id: m_d_id.clone(),
                            mod_name: "".to_string(),
                            downloaded: current,
                            total: total_size,
                            status: "Downloading (Multipart)...".to_string(),
                            speed_bytes_per_sec: smoothed_speed,
                        });
                        
                        if current >= total_size { break; }
                    }
                });
                
                for task in tasks {
                    match task.await {
                        Ok(Ok(_)) => {},
                        Ok(Err(e)) => { chunk_error = true; last_error_msg = e.to_string(); },
                        Err(_) => { chunk_error = true; last_error_msg = "Task panicked".to_string(); }
                    }
                }
                
                monitor.abort();
                
                if !chunk_error && !cancel_token.load(Ordering::Relaxed) {
                    let mut final_file = match std::fs::File::create(&temp_file_path) {
                        Ok(f) => f,
                        Err(e) => { last_error_msg = format!("Failed to create final file: {}", e); continue; },
                    };
                    
                    let mut concat_error = false;
                    for chunk_file in &chunk_files {
                        if let Ok(mut c_file) = std::fs::File::open(chunk_file) {
                            if std::io::copy(&mut c_file, &mut final_file).is_err() {
                                concat_error = true; break;
                            }
                        } else {
                            concat_error = true; break;
                        }
                        let _ = std::fs::remove_file(chunk_file);
                    }
                    
                    if !concat_error {
                        download_success = true;
                        break;
                    } else {
                        last_error_msg = "Failed to concatenate chunks".to_string();
                    }
                }
                
                for chunk_file in chunk_files { let _ = std::fs::remove_file(chunk_file); }
                
            } else {
                let file_res = tokio::fs::File::create(&temp_file_path).await;
                let file = match file_res {
                    Ok(f) => f,
                    Err(e) => { last_error_msg = format!("Failed to create file: {}", e); continue; },
                };
                let mut writer = tokio::io::BufWriter::with_capacity(1024 * 1024, file);
                
                let req = client.get(&resolved_url).send().await;
                match req {
                    Ok(mut response) => {
                        let total_size = response.content_length().unwrap_or(0);
                        let mut downloaded: u64 = 0;
                        let mut last_downloaded: u64 = 0;
                        let mut last_emit_time = tokio::time::Instant::now();
                        let mut smoothed_speed: f64 = 0.0;
                        let mut read_error = false;
                        
                        while let Ok(Some(chunk)) = response.chunk().await {
                            if cancel_token.load(Ordering::Relaxed) {
                                read_error = true;
                                last_error_msg = "Cancelled by user".to_string();
                                break;
                            }
                            downloaded += chunk.len() as u64;
                            use tokio::io::AsyncWriteExt;
                            if writer.write_all(&chunk).await.is_err() {
                                read_error = true;
                                last_error_msg = "Failed to write chunk".to_string();
                                break;
                            }
                            
                            let elapsed = last_emit_time.elapsed();
                            if elapsed >= Duration::from_millis(1000) {
                                let diff = downloaded.saturating_sub(last_downloaded);
                                let elapsed_secs = elapsed.as_secs_f64();
                                let instant_speed = (diff as f64) / elapsed_secs;
                                
                                if smoothed_speed == 0.0 {
                                    smoothed_speed = instant_speed;
                                } else {
                                    smoothed_speed = (instant_speed * 0.3) + (smoothed_speed * 0.7);
                                }
                                
                                last_downloaded = downloaded;
                                
                                let _ = app.emit("download-progress", DownloadProgressPayload {
                                    download_id: d_id.clone(),
                                    mod_name: "".to_string(),
                                    downloaded,
                                    total: total_size,
                                    status: "Downloading...".to_string(),
                                    speed_bytes_per_sec: smoothed_speed,
                                });
                                last_emit_time = tokio::time::Instant::now();
                            }
                        }
                        
                        if !read_error {
                            let _ = writer.flush().await;
                            download_success = true;
                            break;
                        }
                    }
                    Err(e) => { last_error_msg = e.to_string(); }
                }
            }
            
            if !download_success && attempts < max_attempts && !cancel_token.load(Ordering::Relaxed) {
                sleep(Duration::from_secs(retry_interval)).await;
            }
        }
        
        if download_success {
            let _ = app.emit("download-progress", DownloadProgressPayload {
                download_id: d_id.clone(),
                mod_name: "".to_string(),
                downloaded: 100,
                total: 100,
                status: "Extracting...".to_string(),
                speed_bytes_per_sec: 0.0,
            });
            
            let temp_file_str = temp_file_path.to_string_lossy().to_string();
            let app_clone = app.clone();
            let res = tokio::task::spawn_blocking(move || {
                let results = install_mods(app_clone, vec![temp_file_str], root_path, winrar_path, target_category, gb_mod_id, author, source_url, gb_last_updated, Some(file_name.clone()));
                let _ = std::fs::remove_file(temp_file_path);
                results
            }).await;
            
            match res {
                Ok(Ok(install_results)) => {
                    let _ = app.emit("download-complete", DownloadCompletePayload {
                        download_id: d_id.clone(),
                        status: "Success".to_string(),
                        results: Some(install_results),
                        error: None,
                    });
                }
                Ok(Err(e)) => {
                    let _ = app.emit("download-complete", DownloadCompletePayload {
                        download_id: d_id.clone(),
                        status: "Error".to_string(),
                        results: None,
                        error: Some(e.to_string()),
                    });
                }
                Err(e) => {
                    let _ = app.emit("download-complete", DownloadCompletePayload {
                        download_id: d_id.clone(),
                        status: "Error".to_string(),
                        results: None,
                        error: Some(format!("Task panicked: {}", e)),
                    });
                }
            }
        } else {
            let _ = std::fs::remove_file(temp_file_path);
            let _ = app.emit("download-complete", DownloadCompletePayload {
                download_id: d_id.clone(),
                status: if last_error_msg == "Cancelled by user" { "Cancelled".to_string() } else { "Failed".to_string() },
                results: None,
                error: Some(if last_error_msg == "Cancelled by user" { "Cancelled by user".to_string() } else { format!("Failed to download mod after {} attempts. Last error: {}", max_attempts, last_error_msg) }),
            });
        }
    });
    
    Ok(())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn cancel_gb_mod_download(download_id: String) {
    crate::task_manager::cancel_task_sync(&download_id);
}

#[tauri::command]
pub async fn fetch_gb_mods_multi(ids: Vec<u32>) -> Result<Value, AppError> {
    if ids.is_empty() {
        return Ok(json!([]));
    }

    let client = reqwest::Client::builder()
        .user_agent("ZzzModManager/1.0")
        .build()?;

    let mut combined_results = Vec::new();
    for chunk in ids.chunks(50) {
        let str_ids: Vec<String> = chunk.iter().map(|id| id.to_string()).collect();
        let csv_ids = str_ids.join(",");
        let url = format!(
            "https://gamebanana.com/apiv13/Mod/Multi?_csvRowIds={}&_csvProperties=_idRow,_sName,_sDescription,_aSubmitter,_tsDateAdded,_tsDateUpdated,_aCategory,_nViewCount,_nLikeCount,_nDownloadCount,_aFiles,_sVersion,_bIsObsolete,_aPreviewContent",
            csv_ids
        );

        let res = client.get(&url).send().await?;
        let json: Value = res.json().await?;
        if let Some(arr) = json.as_array() {
            combined_results.extend(arr.clone());
        }
    }

    Ok(json!(combined_results))
}

#[tauri::command]
pub async fn check_mod_updates(mods: Vec<ModUpdateCheckRequest>) -> Result<Vec<UpdateAvailable>, AppError> {
    if mods.is_empty() {
        return Ok(Vec::new());
    }

    let mut updates = Vec::new();
    let client = reqwest::Client::builder()
        .user_agent("ZzzModManager/1.0")
        .build()?;

    // Batch IDs in groups of 50
    for chunk in mods.chunks(50) {
        let ids: Vec<String> = chunk.iter().map(|m| m.gb_mod_id.to_string()).collect();
        let csv_ids = ids.join(",");
        
        let url = format!(
            "https://gamebanana.com/apiv13/Mod/Multi?_csvRowIds={}&_csvProperties=_idRow,_sName,_tsDateUpdated",
            csv_ids
        );
        
        match client.get(&url).send().await {
            Ok(resp) => {
                if let Ok(json_array) = resp.json::<Vec<Value>>().await {
                    for item in json_array {
                        if let (Some(id), Some(name), Some(date_updated)) = (
                            item.get("_idRow").and_then(|v| v.as_u64()),
                            item.get("_sName").and_then(|v| v.as_str()),
                            item.get("_tsDateUpdated").and_then(|v| v.as_u64())
                        ) {
                            // Find the corresponding mod in our chunk
                            if let Some(local_mod) = chunk.iter().find(|m| m.gb_mod_id == id) {
                                // If the API timestamp is newer than our local download timestamp, it's an update!
                                if date_updated > local_mod.downloaded_at {
                                    updates.push(UpdateAvailable {
                                        mod_path: local_mod.mod_path.clone(),
                                        gb_mod_id: id,
                                        mod_name: name.to_string(),
                                        new_timestamp: date_updated,
                                    });
                                }
                            }
                        }
                    }
                }
            },
            Err(e) => {
                tracing::error!("Failed to check mod updates batch: {}", e);
            }
        }
    }

    Ok(updates)
}

#[tauri::command]
pub async fn fetch_mod_updates_v13(mod_id: u64, page: Option<u32>, per_page: Option<u32>) -> Result<Value, AppError> {
    let p = page.unwrap_or(1);
    let pp = per_page.unwrap_or(5);
    
    let url = format!(
        "https://gamebanana.com/apiv13/Mod/{}/Updates?_nPage={}&_nPerpage={}",
        mod_id, p, pp
    );
    
    let client = reqwest::Client::builder()
        .user_agent("ZzzModManager/1.0")
        .build()?;
        
    let response = client.get(&url).send().await?.json::<Value>().await?;
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_score_search_relevance_exact_match() {
        let score_exact = score_search_relevance("Bakery-Ellen", "", "Bakery-Ellen");
        let score_fuzzy_exact = score_search_relevance("Bakery-Ellen", "", "bakery ellen");
        assert_eq!(score_exact, 2000);
        assert_eq!(score_fuzzy_exact, 2000);
    }

    #[test]
    fn test_score_search_relevance_prefix_match() {
        let score = score_search_relevance("Bakery-Ellen (+NSFW)", "", "Bakery-Ellen");
        assert_eq!(score, 1500);
    }

    #[test]
    fn test_score_search_relevance_contains_full_phrase() {
        let score = score_search_relevance("Ellen - Cute Comfy Cardigan", "", "Cute Comfy Cardigan");
        assert_eq!(score, 1000);
    }

    #[test]
    fn test_score_search_relevance_all_words() {
        let score = score_search_relevance("Megalodon Maid Ellen", "", "Shark Maid");
        // "Maid" is in title
        assert!(score >= 450);

        let score_all = score_search_relevance("Megalodon Maid Shark Ellen", "", "Shark Maid");
        assert_eq!(score_all, 800);
    }

    #[test]
    fn test_score_search_relevance_description_fallback() {
        let score_desc = score_search_relevance("Unrelated Title", "This mod adds a police uniform for Jane", "police uniform");
        assert_eq!(score_desc, 200);
    }
}

