use crate::error::AppError;
use crate::install::detect_mod_auto_tags;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct VotePayload {
    pub mod_id: String,
    pub tag: String,
    pub voter_hash: String,
    pub nonce: u64,
    pub timestamp: u64,
}

#[derive(serde::Deserialize, Debug)]
struct ChallengeResponse {
    pub challenge: String,
    pub difficulty: String,
    pub timestamp: u64,
}

/// Solves a Proof-of-Work puzzle for the given challenge prefix
pub fn solve_pow_challenge(challenge: &str, difficulty_prefix: &str) -> (u64, String) {
    let mut nonce: u64 = 0;
    loop {
        let input = format!("{}:{}", challenge, nonce);
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        let hash = format!("{:x}", hasher.finalize());

        if hash.starts_with(difficulty_prefix) {
            return (nonce, hash);
        }
        nonce = nonce.wrapping_add(1);
    }
}

/// Computes an anonymous salted machine identifier for voter registry deduplication
pub fn get_anonymous_voter_hash() -> String {
    let raw_id = whoami_or_fallback();
    let mut hasher = Sha256::new();
    hasher.update(b"zzz_mod_hub_voter_salt_");
    hasher.update(raw_id.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn whoami_or_fallback() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "anonymous_user".to_string())
}

/// Analyzes a single mod's files and INI directives to auto-assign tags
#[tauri::command]
pub fn auto_tag_mod(mod_path: String) -> Result<Vec<String>, AppError> {
    let m_path = Path::new(&mod_path);
    if !m_path.exists() || !m_path.is_dir() {
        return Err("Mod directory does not exist".into());
    }

    let meta_path = m_path.join(".zmm-meta.json");
    let mut meta = if meta_path.exists() {
        let content = fs::read_to_string(&meta_path)?;
        serde_json::from_str::<crate::models::ModMeta>(&content).unwrap_or_default()
    } else {
        crate::models::ModMeta::default()
    };

    let parent_name = m_path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let detected = detect_mod_auto_tags(m_path, parent_name, false);
    let is_ui = detected.contains(&"UI".to_string());
    let is_recolor = detected.contains(&"Recolor".to_string());
    let is_outfit = detected.contains(&"Outfit".to_string());
    let is_weapon = detected.contains(&"Weapon".to_string());
    let is_anim = detected.contains(&"Animation".to_string());

    let mut all_tags: HashSet<String> = meta.tags.unwrap_or_default().into_iter().collect();

    // Clean up mutually exclusive / outdated false tags:
    if is_ui {
        all_tags.remove("Outfit");
        all_tags.remove("Recolor");
    }
    if is_recolor && !is_outfit {
        all_tags.remove("Outfit");
    }
    if is_outfit && !is_recolor {
        all_tags.remove("Recolor");
    }
    if is_weapon && !is_outfit && (parent_name.to_lowercase().contains("weapon") || parent_name.to_lowercase().contains("w-engine")) {
        all_tags.remove("Outfit");
    }
    if !is_anim {
        all_tags.remove("Animation");
    }

    for tag in detected {
        all_tags.insert(tag);
    }

    let mut result: Vec<String> = all_tags.into_iter().collect();
    result.sort();

    meta.tags = Some(result.clone());
    let new_content = serde_json::to_string_pretty(&meta)?;
    fs::write(&meta_path, new_content)?;

    Ok(result)
}

/// Analyzes all mods in the entire library and automatically assigns discovered tags
#[tauri::command]
pub fn auto_tag_all_library_mods(root_path: String) -> Result<usize, AppError> {
    let root_expanded = crate::utils::expand_path(&root_path);
    let base = Path::new(&root_expanded);
    if !base.exists() || !base.is_dir() {
        return Err("Mods directory does not exist".into());
    }

    let mut count = 0;

    fn process_mod_folder(mod_path: &Path, cat_name: &str, count: &mut usize) {
        let meta_path = mod_path.join(".zmm-meta.json");
        let mut meta = if meta_path.exists() {
            let content = fs::read_to_string(&meta_path).unwrap_or_default();
            serde_json::from_str::<crate::models::ModMeta>(&content).unwrap_or_default()
        } else {
            crate::models::ModMeta::default()
        };

        let detected = detect_mod_auto_tags(mod_path, cat_name, false);
        let is_ui = detected.contains(&"UI".to_string());
        let is_recolor = detected.contains(&"Recolor".to_string());
        let is_outfit = detected.contains(&"Outfit".to_string());
        let is_weapon = detected.contains(&"Weapon".to_string());
        let is_anim = detected.contains(&"Animation".to_string());

        let mut all_tags: HashSet<String> = meta.tags.unwrap_or_default().into_iter().collect();

        if is_ui {
            all_tags.remove("Outfit");
            all_tags.remove("Recolor");
        }
        if is_recolor && !is_outfit {
            all_tags.remove("Outfit");
        }
        if is_outfit && !is_recolor {
            all_tags.remove("Recolor");
        }
        if is_weapon && !is_outfit && (cat_name.to_lowercase().contains("weapon") || cat_name.to_lowercase().contains("w-engine")) {
            all_tags.remove("Outfit");
        }
        if !is_anim {
            all_tags.remove("Animation");
        }

        for tag in detected {
            all_tags.insert(tag);
        }

        let mut result: Vec<String> = all_tags.into_iter().collect();
        result.sort();

        meta.tags = Some(result);
        if let Ok(new_content) = serde_json::to_string_pretty(&meta) {
            let _ = fs::write(&meta_path, new_content);
            *count += 1;
        }
    }

    let entries = match fs::read_dir(base) {
        Ok(entries) => entries,
        Err(_) => return Ok(0),
    };

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        // Check if this directory is a top-level tab container (e.g. Playable Characters, NPCs, UI)
        let sub_entries = fs::read_dir(&path).ok().map(|e| e.filter_map(Result::ok).collect::<Vec<_>>()).unwrap_or_default();
        let has_character_subdirs = sub_entries.iter().any(|se| {
            se.path().is_dir() && se.file_name().to_string_lossy().contains(" - ")
        });

        if has_character_subdirs {
            for cat in sub_entries {
                let cat_path = cat.path();
                if !cat_path.is_dir() {
                    continue;
                }
                let cat_name = cat.file_name().to_string_lossy().to_string();
                if let Ok(mod_dirs) = fs::read_dir(&cat_path) {
                    for md in mod_dirs.filter_map(Result::ok) {
                        let mp = md.path();
                        if mp.is_dir() {
                            process_mod_folder(&mp, &cat_name, &mut count);
                        }
                    }
                }
            }
        } else {
            // Direct category folder
            for md in sub_entries {
                let mp = md.path();
                if mp.is_dir() {
                    process_mod_folder(&mp, &name, &mut count);
                }
            }
        }
    }

    Ok(count)
}

/// Submits a Proof-of-Work verified community tag vote to a Cloudflare Worker
#[tauri::command]
pub async fn submit_community_tag_vote(
    mod_id: String,
    tag: String,
    worker_url: String,
) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let challenge_url = format!("{}/pow-challenge", worker_url.trim_end_matches('/'));
    let resp = client.get(&challenge_url).send().await?;

    if !resp.status().is_success() {
        return Err(format!("Server returned HTTP {}", resp.status()).into());
    }

    let challenge_data: ChallengeResponse = resp.json().await?;

    let (nonce, _) = solve_pow_challenge(
        &challenge_data.challenge,
        &challenge_data.difficulty,
    );

    let voter_hash = get_anonymous_voter_hash();

    let payload = VotePayload {
        mod_id,
        tag,
        voter_hash,
        nonce,
        timestamp: challenge_data.timestamp,
    };

    let vote_url = format!("{}/vote", worker_url.trim_end_matches('/'));
    let vote_resp = client.post(&vote_url).json(&payload).send().await?;

    if vote_resp.status().is_success() {
        Ok("Vote registered successfully".to_string())
    } else {
        let err_text = vote_resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Vote failed: {}", err_text).into())
    }
}
