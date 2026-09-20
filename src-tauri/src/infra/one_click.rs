use crate::error::AppError;
use std::sync::{Arc, Mutex};

/// IPC and internal payload representing a parsed GameBanana 1-Click download request.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct OneClickPayload {
    pub download_url: String,
    pub item_type: String,
    pub item_id: Option<u64>,
    pub file_id: Option<u64>,
}

/// IPC and internal payload representing a GameBanana Remote Install pairing event.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct RemotePairPayload {
    pub member_id: u64,
    pub secret_key: String,
}

/// Action represented by an incoming `zzzmm:` protocol URL.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OneClickProtocolAction {
    Install(OneClickPayload),
    Pair(RemotePairPayload),
}

/// Global thread-safe state holding any pending 1-Click download or Remote Install pair request.
#[derive(Default, Clone)]
pub struct OneClickState {
    pub pending_install: Arc<Mutex<Option<OneClickPayload>>>,
    pub pending_pair: Arc<Mutex<Option<RemotePairPayload>>>,
}

impl OneClickState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_pending(&self, payload: Option<OneClickPayload>) {
        if let Ok(mut lock) = self.pending_install.lock() {
            *lock = payload;
        }
    }

    pub fn take_pending(&self) -> Option<OneClickPayload> {
        if let Ok(mut lock) = self.pending_install.lock() {
            lock.take()
        } else {
            None
        }
    }

    pub fn set_pending_pair(&self, payload: Option<RemotePairPayload>) {
        if let Ok(mut lock) = self.pending_pair.lock() {
            *lock = payload;
        }
    }

    pub fn take_pending_pair(&self) -> Option<RemotePairPayload> {
        if let Ok(mut lock) = self.pending_pair.lock() {
            lock.take()
        } else {
            None
        }
    }
}

/// Parses an incoming `zzzmm:` protocol URL to determine whether it is an installation or pairing action.
pub fn parse_protocol_action(raw: &str) -> Result<OneClickProtocolAction, AppError> {
    let mut cleaned = raw.trim();

    // Strip wrapping quotes if passed from shell
    if (cleaned.starts_with('"') && cleaned.ends_with('"'))
        || (cleaned.starts_with('\'') && cleaned.ends_with('\''))
    {
        cleaned = &cleaned[1..cleaned.len() - 1];
        cleaned = cleaned.trim();
    }

    // Strip scheme prefix (case-insensitive)
    let lower = cleaned.to_ascii_lowercase();
    let body = if lower.starts_with("zzzmm://") {
        &cleaned[8..]
    } else if lower.starts_with("zzzmm:") {
        &cleaned[6..]
    } else {
        cleaned
    };

    let body = body.trim();

    // Check for percent-encoding in case browser encoded the commas / slashes
    let decoded_body = if body.contains('%') {
        urlencoding::decode(body)
            .map(|s| s.into_owned())
            .unwrap_or_else(|_| body.to_string())
    } else {
        body.to_string()
    };

    let trimmed_body = decoded_body.trim().trim_end_matches('/');

    // Check if formatted as a Remote Install pairing link
    if let Some(pair) = parse_pair_payload(trimmed_body) {
        return Ok(OneClickProtocolAction::Pair(pair));
    }

    // Otherwise, parse as a standard 1-Click mod installation link
    parse_one_click_url(raw).map(OneClickProtocolAction::Install)
}

fn parse_pair_payload(body: &str) -> Option<RemotePairPayload> {
    let lower = body.to_ascii_lowercase();

    // Check query-style pairing: e.g. "pair?member_id=123&secret_key=xyz"
    if lower.contains("member_id=")
        || lower.contains("secret_key=")
        || lower.contains("memberid=")
        || lower.contains("secretkey=")
    {
        let qs = if let Some(idx) = body.find('?') {
            &body[idx + 1..]
        } else {
            body
        };

        let mut member_id: Option<u64> = None;
        let mut secret_key = String::new();

        for pair in qs.split('&') {
            let mut kv = pair.splitn(2, '=');
            let key = kv.next().unwrap_or("").trim().to_ascii_lowercase();
            let val = kv.next().unwrap_or("").trim();

            match key.as_str() {
                "member_id" | "memberid" | "user_id" | "userid" => {
                    member_id = val.parse::<u64>().ok();
                }
                "secret_key" | "secretkey" | "key" | "secret" | "token" => {
                    secret_key = val.to_string();
                }
                _ => {}
            }
        }

        if let (Some(m_id), false) = (member_id, secret_key.is_empty()) {
            return Some(RemotePairPayload {
                member_id: m_id,
                secret_key,
            });
        }
    }

    // Split on '/' or ','
    let tokens: Vec<&str> = body
        .split(|c| c == '/' || c == ',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && !s.eq_ignore_ascii_case("pair"))
        .collect();

    if tokens.len() == 2 {
        let t0 = tokens[0];
        let t1 = tokens[1];

        let is_url_like = |s: &str| {
            let s_lower = s.to_ascii_lowercase();
            s_lower.contains("://")
                || s_lower.starts_with("//")
                || s_lower.contains("gamebanana.com")
                || s_lower.contains("gbcdn.net")
                || s_lower.contains("gamemods.com")
                || s_lower.ends_with(".zip")
                || s_lower.ends_with(".rar")
                || s_lower.ends_with(".7z")
        };

        if is_url_like(t0) || is_url_like(t1) {
            return None;
        }

        let num0 = t0.parse::<u64>().ok();
        let num1 = t1.parse::<u64>().ok();

        match (num0, num1) {
            (Some(id), None) if !t1.is_empty() => Some(RemotePairPayload {
                member_id: id,
                secret_key: t1.to_string(),
            }),
            (None, Some(id)) if !t0.is_empty() => Some(RemotePairPayload {
                member_id: id,
                secret_key: t0.to_string(),
            }),
            _ => None,
        }
    } else {
        None
    }
}

/// Parses a raw 1-Click URL string received from the browser or OS command line.
///
/// Handles formats:
/// - `zzzmm:https://gamebanana.com/mmdl/1773037,Mod,700143`
/// - `zzzmm://https://gamebanana.com/mmdl/1773037,Mod,700143`
/// - `zzzmm:https://gamebanana.com/mmdl/1773037,700143`
/// - `zzzmm:https://gamebanana.com/mmdl/1773037`
/// - `zzzmm://install?url=https://gamebanana.com/mmdl/1773037&id=700143&type=Mod`
/// - URL percent-encoded variants
pub fn parse_one_click_url(raw: &str) -> Result<OneClickPayload, AppError> {
    let mut cleaned = raw.trim();

    // Strip wrapping quotes if passed from shell
    if (cleaned.starts_with('"') && cleaned.ends_with('"'))
        || (cleaned.starts_with('\'') && cleaned.ends_with('\''))
    {
        cleaned = &cleaned[1..cleaned.len() - 1];
        cleaned = cleaned.trim();
    }

    // Strip scheme prefix (case-insensitive)
    let lower = cleaned.to_ascii_lowercase();
    let body = if lower.starts_with("zzzmm://") {
        &cleaned[8..]
    } else if lower.starts_with("zzzmm:") {
        &cleaned[6..]
    } else {
        cleaned
    };

    let body = body.trim();

    // Check for percent-encoding in case browser encoded the commas / slashes
    let decoded_body = if body.contains('%') {
        urlencoding::decode(body)
            .map(|s| s.into_owned())
            .unwrap_or_else(|_| body.to_string())
    } else {
        body.to_string()
    };

    let mut trimmed_body = decoded_body.trim();

    // Strip trailing slash if appended by browser URL normalizer
    if trimmed_body.ends_with('/') {
        trimmed_body = trimmed_body.trim_end_matches('/');
    }

    if trimmed_body.is_empty() {
        return Err(AppError::Custom("Empty 1-Click URL payload".to_string()));
    }

    // Check if formatted as query parameters: e.g. "download?url=..." or "?url=..."
    if trimmed_body.contains("url=") {
        return parse_query_style(trimmed_body);
    }

    // Comma-delimited format: [FILE_URL],[ITEM_TYPE],[ITEM_ID] or [FILE_URL],[ITEM_ID]
    let parts: Vec<&str> = trimmed_body.split(',').map(|p| p.trim()).collect();
    let download_url = parts[0].to_string();

    let mut item_type = "Mod".to_string();
    let mut item_id: Option<u64> = None;

    if parts.len() >= 3 {
        let type_part = parts[1];
        if !type_part.is_empty() {
            item_type = type_part.to_string();
        }
        item_id = parts[2].parse::<u64>().ok();
    } else if parts.len() == 2 {
        if let Ok(id_num) = parts[1].parse::<u64>() {
            item_id = Some(id_num);
        } else if !parts[1].is_empty() {
            item_type = parts[1].to_string();
        }
    }

    validate_and_build_payload(download_url, item_type, item_id)
}

fn parse_query_style(query_str: &str) -> Result<OneClickPayload, AppError> {
    let qs = if let Some(idx) = query_str.find('?') {
        &query_str[idx + 1..]
    } else {
        query_str
    };

    let mut download_url = String::new();
    let mut item_type = "Mod".to_string();
    let mut item_id: Option<u64> = None;

    for pair in qs.split('&') {
        let mut kv = pair.splitn(2, '=');
        let key = kv.next().unwrap_or("").trim().to_ascii_lowercase();
        let val = kv.next().unwrap_or("").trim();

        match key.as_str() {
            "url" | "file_url" | "download_url" => {
                download_url = val.to_string();
            }
            "type" | "item_type" | "model" => {
                if !val.is_empty() {
                    item_type = val.to_string();
                }
            }
            "id" | "item_id" | "mod_id" => {
                item_id = val.parse::<u64>().ok();
            }
            _ => {}
        }
    }

    if download_url.is_empty() {
        return Err(AppError::Custom("Missing 'url' parameter in 1-Click query".to_string()));
    }

    validate_and_build_payload(download_url, item_type, item_id)
}

/// Validates that a download URL strictly originates from trusted GameBanana infrastructure.
///
/// Prevents SSRF, drive-by malware delivery from arbitrary third-party websites, and user-info spoofing.
pub fn is_allowed_domain(url_str: &str) -> bool {
    let lower = url_str.to_ascii_lowercase();

    // Must be https:// (or http:// in debug/test builds)
    let after_scheme = if let Some(rest) = lower.strip_prefix("https://") {
        rest
    } else if cfg!(debug_assertions) && lower.starts_with("http://") {
        &lower[7..]
    } else {
        return false;
    };

    // Extract authority portion (before '/', '?', or '#')
    let authority = after_scheme
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("");

    // Strip userinfo to prevent spoofing (e.g. https://gamebanana.com@evil.com/)
    let host_and_port = if let Some(pos) = authority.rfind('@') {
        &authority[pos + 1..]
    } else {
        authority
    };

    // Strip port if present
    let host = if let Some(pos) = host_and_port.find(':') {
        &host_and_port[..pos]
    } else {
        host_and_port
    };

    let host = host.trim();
    if host.is_empty() {
        return false;
    }

    // Allowed official GameBanana hosting domains
    if host == "gamebanana.com"
        || host.ends_with(".gamebanana.com")
        || host == "gbcdn.net"
        || host.ends_with(".gbcdn.net")
        || host == "gamemods.com"
        || host.ends_with(".gamemods.com")
    {
        return true;
    }

    // Localhost allowed only in debug / test environments
    if cfg!(debug_assertions) && (host == "localhost" || host == "127.0.0.1") {
        return true;
    }

    false
}

fn normalize_download_url(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.starts_with("//") {
        format!("https:{}", trimmed)
    } else if let Some(rest) = trimmed.strip_prefix("http://") {
        // Upgrade GameBanana HTTP links to secure HTTPS automatically
        format!("https://{}", rest)
    } else if !trimmed.starts_with("https://") {
        let lower = trimmed.to_ascii_lowercase();
        if lower.starts_with("gamebanana.com")
            || lower.starts_with("www.gamebanana.com")
            || lower.starts_with("files.gamebanana.com")
            || lower.starts_with("gbcdn.net")
            || lower.starts_with("gamemods.com")
        {
            format!("https://{}", trimmed)
        } else {
            trimmed.to_string()
        }
    } else {
        trimmed.to_string()
    }
}

fn validate_and_build_payload(
    download_url: String,
    item_type: String,
    item_id: Option<u64>,
) -> Result<OneClickPayload, AppError> {
    let download_url = normalize_download_url(&download_url);

    if !is_allowed_domain(&download_url) {
        return Err(AppError::Custom(format!(
            "Security verification failed: 1-Click download URL must be a valid HTTPS URL originating from GameBanana (gamebanana.com, gbcdn.net, gamemods.com): {download_url}"
        )));
    }

    // Extract file_id if URL points to GameBanana /mmdl/<id> or /dl/<id>
    let file_id = extract_file_id(&download_url);

    Ok(OneClickPayload {
        download_url,
        item_type,
        item_id,
        file_id,
    })
}

fn extract_file_id(url: &str) -> Option<u64> {
    // Look for /mmdl/12345 or /dl/12345
    for pattern in &["/mmdl/", "/dl/"] {
        if let Some(pos) = url.find(pattern) {
            let after = &url[pos + pattern.len()..];
            let num_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(id) = num_str.parse::<u64>() {
                return Some(id);
            }
        }
    }
    None
}

// ── Windows Registry Management ─────────────────────────────────────────────

#[cfg(target_os = "windows")]
pub fn register_protocol() -> Result<(), AppError> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey(r"Software\Classes\zzzmm")
        .map_err(|e| AppError::Custom(format!("Failed to create HKCU zzzmm registry key: {e}")))?;

    key.set_value("", &"URL:ZZZ Mod Hub Protocol")
        .map_err(|e| AppError::Custom(format!("Failed to set registry description: {e}")))?;
    key.set_value("URL Protocol", &"")
        .map_err(|e| AppError::Custom(format!("Failed to set URL Protocol value: {e}")))?;

    let current_exe = std::env::current_exe()
        .map_err(|e| AppError::Custom(format!("Failed to get current executable path: {e}")))?;
    let exe_str = current_exe.to_string_lossy().to_string();

    let (icon_key, _) = hkcu
        .create_subkey(r"Software\Classes\zzzmm\DefaultIcon")
        .map_err(|e| AppError::Custom(format!("Failed to create DefaultIcon key: {e}")))?;
    let icon_val = format!("\"{}\",0", exe_str);
    icon_key
        .set_value("", &icon_val)
        .map_err(|e| AppError::Custom(format!("Failed to set DefaultIcon: {e}")))?;

    let (cmd_key, _) = hkcu
        .create_subkey(r"Software\Classes\zzzmm\shell\open\command")
        .map_err(|e| AppError::Custom(format!("Failed to create command key: {e}")))?;
    let cmd_val = format!("\"{}\" \"%1\"", exe_str);
    cmd_key
        .set_value("", &cmd_val)
        .map_err(|e| AppError::Custom(format!("Failed to set shell command: {e}")))?;

    tracing::info!("Registered zzzmm custom protocol in HKCU: {}", cmd_val);
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn register_protocol() -> Result<(), AppError> {
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn unregister_protocol() -> Result<(), AppError> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    match hkcu.delete_subkey_all(r"Software\Classes\zzzmm") {
        Ok(_) => {
            tracing::info!("Unregistered zzzmm custom protocol from HKCU");
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(AppError::Custom(format!(
            "Failed to delete zzzmm registry key: {e}"
        ))),
    }
}

#[cfg(not(target_os = "windows"))]
pub fn unregister_protocol() -> Result<(), AppError> {
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn is_protocol_registered() -> Result<bool, AppError> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let cmd_key = match hkcu.open_subkey(r"Software\Classes\zzzmm\shell\open\command") {
        Ok(k) => k,
        Err(_) => return Ok(false),
    };

    let val: String = match cmd_key.get_value("") {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };

    let current_exe = std::env::current_exe()
        .map_err(|e| AppError::Custom(format!("Failed to get current executable path: {e}")))?;
    let exe_str = current_exe.to_string_lossy().to_string();

    Ok(val.contains(&exe_str))
}

#[cfg(not(target_os = "windows"))]
pub fn is_protocol_registered() -> Result<bool, AppError> {
    Ok(false)
}

// ── Tauri IPC Commands ──────────────────────────────────────────────────────

#[tauri::command]
pub fn register_one_click_protocol(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Manager;
    if let Ok(app_dir) = app.path().app_data_dir() {
        let flag = app_dir.join("one_click_disabled");
        let _ = std::fs::remove_file(flag);
    }
    register_protocol()
}

#[tauri::command]
pub fn unregister_one_click_protocol(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Manager;
    if let Ok(app_dir) = app.path().app_data_dir() {
        let _ = std::fs::create_dir_all(&app_dir);
        let flag = app_dir.join("one_click_disabled");
        let _ = std::fs::write(flag, b"1");
    }
    unregister_protocol()
}

#[tauri::command]
pub fn is_one_click_protocol_registered() -> Result<bool, AppError> {
    is_protocol_registered()
}

#[tauri::command]
pub fn check_pending_one_click(
    state: tauri::State<'_, OneClickState>,
) -> Result<Option<OneClickPayload>, AppError> {
    Ok(state.take_pending())
}

#[tauri::command]
pub fn check_pending_pair(
    state: tauri::State<'_, OneClickState>,
) -> Result<Option<RemotePairPayload>, AppError> {
    Ok(state.take_pending_pair())
}

/// Polls the GameBanana Remote Install queue for this user.
///
/// Route: GET https://gamebanana.com/apiv11/RemoteInstall/{memberID}/{secretKey}/{alias}
///
/// Returns an array of parsed `OneClickPayload` objects ready for download/installation.
#[tauri::command]
pub async fn poll_remote_install_queue(
    member_id: u64,
    secret_key: String,
    alias: Option<String>,
) -> Result<Vec<OneClickPayload>, AppError> {
    if member_id == 0 {
        return Err(AppError::Custom("Invalid GameBanana member ID".to_string()));
    }
    let secret = secret_key.trim();
    if secret.is_empty() {
        return Err(AppError::Custom(
            "GameBanana secret key cannot be empty".to_string(),
        ));
    }

    let manager_alias = alias
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("ZzzModManager");

    let url = format!(
        "https://gamebanana.com/apiv11/RemoteInstall/{}/{}/{}",
        member_id, secret, manager_alias
    );

    tracing::info!(
        "Polling GameBanana Remote Install queue: member_id={}, alias={}",
        member_id,
        manager_alias
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| AppError::Custom(format!("Failed to build HTTP client: {e}")))?;

    let res = client
        .get(&url)
        .header("User-Agent", "ZzzModManager/1.0")
        .send()
        .await
        .map_err(|e| {
            AppError::Custom(format!(
                "Failed to connect to GameBanana Remote Install API: {e}"
            ))
        })?;

    let status = res.status();
    let body_text = res.text().await.map_err(|e| {
        AppError::Custom(format!("Failed to read Remote Install response body: {e}"))
    })?;

    // Try parsing as array of queue items: e.g. ["https://gamebanana.com/mmdl/1588761,Mod,639529", ...]
    if let Ok(items) = serde_json::from_str::<Vec<String>>(&body_text) {
        let mut payloads = Vec::with_capacity(items.len());
        for item in items {
            match parse_one_click_url(&item) {
                Ok(payload) => payloads.push(payload),
                Err(err) => {
                    tracing::warn!("Failed to parse Remote Install queue item '{}': {}", item, err);
                }
            }
        }
        return Ok(payloads);
    }

    // Try parsing as GameBanana API error object: {"_sErrorCode": "...", "_sErrorMessage": "..."}
    #[derive(serde::Deserialize)]
    struct GbApiError {
        #[serde(rename = "_sErrorCode")]
        error_code: Option<String>,
        #[serde(rename = "_sErrorMessage")]
        error_message: Option<String>,
    }

    if let Ok(api_err) = serde_json::from_str::<GbApiError>(&body_text) {
        if let Some(code) = api_err.error_code {
            let msg = api_err
                .error_message
                .unwrap_or_else(|| "Unknown error".to_string());
            return Err(AppError::Custom(format!(
                "GameBanana Remote Install: {} ({})",
                msg, code
            )));
        }
    }

    if !status.is_success() {
        return Err(AppError::Custom(format!(
            "GameBanana Remote Install HTTP error {}: {}",
            status, body_text
        )));
    }

    Ok(Vec::new())
}

// ── Unit Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_standard_gamebanana_url() {
        let input = "zzzmm:https://gamebanana.com/mmdl/1773037,Mod,700143";
        let parsed = parse_one_click_url(input).expect("Should parse standard URL");
        assert_eq!(
            parsed,
            OneClickPayload {
                download_url: "https://gamebanana.com/mmdl/1773037".to_string(),
                item_type: "Mod".to_string(),
                item_id: Some(700143),
                file_id: Some(1773037),
            }
        );
    }

    #[test]
    fn test_parse_gamebanana_download_logging_url_with_toolid() {
        let input = "zzzmm:https://gamebanana.com/mmdl/1773037?toolid=24500,Mod,700143";
        let parsed = parse_one_click_url(input).expect("Should parse URL with toolid");
        assert_eq!(
            parsed,
            OneClickPayload {
                download_url: "https://gamebanana.com/mmdl/1773037?toolid=24500".to_string(),
                item_type: "Mod".to_string(),
                item_id: Some(700143),
                file_id: Some(1773037),
            }
        );
    }

    #[test]
    fn test_parse_schemeless_and_protocol_relative_gamebanana_urls() {
        // Schemeless URL as typed by Tom in chat
        let schemeless = "zzzmm:gamebanana.com/mmdl/1773037?toolid=24500,Mod,700143";
        let parsed = parse_one_click_url(schemeless).expect("Should parse schemeless URL");
        assert_eq!(parsed.download_url, "https://gamebanana.com/mmdl/1773037?toolid=24500");
        assert_eq!(parsed.file_id, Some(1773037));

        // Protocol-relative URL
        let proto_rel = "zzzmm:////gamebanana.com/mmdl/1773037,Mod,700143";
        let parsed_proto = parse_one_click_url(proto_rel).expect("Should parse protocol-relative URL");
        assert_eq!(parsed_proto.download_url, "https://gamebanana.com/mmdl/1773037");

        // HTTP upgraded to HTTPS
        let http_url = "zzzmm:http://gamebanana.com/mmdl/1773037,Mod,700143";
        let parsed_http = parse_one_click_url(http_url).expect("Should upgrade HTTP to HTTPS");
        assert_eq!(parsed_http.download_url, "https://gamebanana.com/mmdl/1773037");
    }

    #[test]
    fn test_parse_with_slashes_and_trailing_slash() {
        let input = "zzzmm://https://gamebanana.com/mmdl/1773037,Mod,700143/";
        let parsed = parse_one_click_url(input).expect("Should parse slashes");
        assert_eq!(
            parsed,
            OneClickPayload {
                download_url: "https://gamebanana.com/mmdl/1773037".to_string(),
                item_type: "Mod".to_string(),
                item_id: Some(700143),
                file_id: Some(1773037),
            }
        );
    }

    #[test]
    fn test_parse_without_item_type() {
        let input = "zzzmm:https://gamebanana.com/mmdl/1773037,700143";
        let parsed = parse_one_click_url(input).expect("Should infer default Mod type");
        assert_eq!(
            parsed,
            OneClickPayload {
                download_url: "https://gamebanana.com/mmdl/1773037".to_string(),
                item_type: "Mod".to_string(),
                item_id: Some(700143),
                file_id: Some(1773037),
            }
        );
    }

    #[test]
    fn test_parse_file_only() {
        let input = "zzzmm:https://gamebanana.com/dl/999888";
        let parsed = parse_one_click_url(input).expect("Should parse file-only URL");
        assert_eq!(
            parsed,
            OneClickPayload {
                download_url: "https://gamebanana.com/dl/999888".to_string(),
                item_type: "Mod".to_string(),
                item_id: None,
                file_id: Some(999888),
            }
        );
    }

    #[test]
    fn test_parse_percent_encoded_url() {
        let input = "zzzmm:https%3A%2F%2Fgamebanana.com%2Fmmdl%2F1773037%2CMod%2C700143";
        let parsed = parse_one_click_url(input).expect("Should decode percent encoding");
        assert_eq!(
            parsed,
            OneClickPayload {
                download_url: "https://gamebanana.com/mmdl/1773037".to_string(),
                item_type: "Mod".to_string(),
                item_id: Some(700143),
                file_id: Some(1773037),
            }
        );
    }

    #[test]
    fn test_parse_query_param_style() {
        let input = "zzzmm://install?url=https://gamebanana.com/mmdl/1773037&id=700143&type=Mod";
        let parsed = parse_one_click_url(input).expect("Should parse query style");
        assert_eq!(
            parsed,
            OneClickPayload {
                download_url: "https://gamebanana.com/mmdl/1773037".to_string(),
                item_type: "Mod".to_string(),
                item_id: Some(700143),
                file_id: Some(1773037),
            }
        );
    }

    #[test]
    fn test_parse_quoted_string() {
        let input = "\"zzzmm:https://gamebanana.com/mmdl/1773037,Mod,700143\"";
        let parsed = parse_one_click_url(input).expect("Should strip shell quotes");
        assert_eq!(parsed.item_id, Some(700143));
    }

    #[test]
    fn test_reject_dangerous_schemes() {
        let malicious_inputs = [
            "zzzmm:file:///C:/Windows/System32/cmd.exe",
            "zzzmm:javascript:alert(1)",
            "zzzmm:data:text/html,<html>",
            "zzzmm:powershell.exe -enc ...",
        ];

        for input in malicious_inputs {
            assert!(
                parse_one_click_url(input).is_err(),
                "Should have rejected dangerous input: {}",
                input
            );
        }
    }

    #[test]
    fn test_state_pending_take() {
        let state = OneClickState::new();
        assert_eq!(state.take_pending(), None);

        let payload = OneClickPayload {
            download_url: "https://gamebanana.com/mmdl/123".to_string(),
            item_type: "Mod".to_string(),
            item_id: Some(456),
            file_id: Some(123),
        };

        state.set_pending(Some(payload.clone()));
        assert_eq!(state.take_pending(), Some(payload));
        assert_eq!(state.take_pending(), None);

        // Test pair state
        assert_eq!(state.take_pending_pair(), None);
        let pair_payload = RemotePairPayload {
            member_id: 789012,
            secret_key: "testsecretkey".to_string(),
        };
        state.set_pending_pair(Some(pair_payload.clone()));
        assert_eq!(state.take_pending_pair(), Some(pair_payload));
        assert_eq!(state.take_pending_pair(), None);
    }

    #[test]
    fn test_allowed_domain_verification() {
        assert!(is_allowed_domain("https://gamebanana.com/mmdl/12345"));
        assert!(is_allowed_domain("https://files.gamebanana.com/mods/test.zip"));
        assert!(is_allowed_domain("https://images.gbcdn.net/file.7z"));
        assert!(is_allowed_domain("https://cdn.gamemods.com/download.rar"));
        assert!(is_allowed_domain("https://gamebanana.com:443/mmdl/12345"));
    }

    #[test]
    fn test_reject_untrusted_origins_and_spoofing() {
        let untrusted_urls = [
            "https://evil.com/malware.zip",
            "https://gamebanana.com@evil.com/malware.zip",
            "https://evil.com/gamebanana.com/malware.zip",
            "https://gamebanana.com.evil.com/malware.zip",
            "https://notgamebanana.com/download",
            "https://192.168.1.1/secret.zip",
            "ftp://gamebanana.com/mod.zip",
            "file:///C:/Windows/calc.exe",
        ];

        for url in untrusted_urls {
            assert!(
                !is_allowed_domain(url),
                "Should have rejected untrusted origin: {}",
                url
            );

            let parsed = parse_one_click_url(&format!("zzzmm:{url}"));
            assert!(
                parsed.is_err(),
                "parse_one_click_url should fail for untrusted origin: {}",
                url
            );
        }
    }

    #[test]
    fn test_redirect_url_resolution_and_validation() {
        let base_url = "https://gamebanana.com/dl/12345";
        let base = reqwest::Url::parse(base_url).unwrap();

        // Legitimate relative redirect
        let rel_redirect = "/mmdl/67890";
        let joined_rel = base.join(rel_redirect).unwrap().to_string();
        assert_eq!(joined_rel, "https://gamebanana.com/mmdl/67890");
        assert!(is_allowed_domain(&joined_rel));

        // Legitimate protocol-relative CDN redirect
        let proto_rel = "//files.gamebanana.com/mods/cool.zip";
        let joined_proto = base.join(proto_rel).unwrap().to_string();
        assert_eq!(joined_proto, "https://files.gamebanana.com/mods/cool.zip");
        assert!(is_allowed_domain(&joined_proto));

        // Malicious open redirect to external evil domain
        let evil_redirect = "https://evil-attacker.com/payload.exe";
        let joined_evil = base.join(evil_redirect).unwrap().to_string();
        assert_eq!(joined_evil, "https://evil-attacker.com/payload.exe");
        assert!(!is_allowed_domain(&joined_evil));

        // Malicious redirect with userinfo spoofing
        let spoof_redirect = "https://gamebanana.com@evil-attacker.com/payload.exe";
        let joined_spoof = base.join(spoof_redirect).unwrap().to_string();
        assert!(!is_allowed_domain(&joined_spoof));
    }

    #[test]
    fn test_parse_remote_pair_protocols() {
        // Standard path with member_id first
        let res1 = parse_protocol_action("zzzmm://pair/12345/mysecretkey").expect("Should parse pair");
        assert_eq!(
            res1,
            OneClickProtocolAction::Pair(RemotePairPayload {
                member_id: 12345,
                secret_key: "mysecretkey".to_string(),
            })
        );

        // Path with secret_key first
        let res2 = parse_protocol_action("zzzmm://pair/mysecretkey/12345").expect("Should parse pair");
        assert_eq!(
            res2,
            OneClickProtocolAction::Pair(RemotePairPayload {
                member_id: 12345,
                secret_key: "mysecretkey".to_string(),
            })
        );

        // Comma-separated without 'pair' prefix (from Tom's chat: myapp://{secretKey},{memberID})
        let res3 = parse_protocol_action("zzzmm:mysecretkey,12345").expect("Should parse pair");
        assert_eq!(
            res3,
            OneClickProtocolAction::Pair(RemotePairPayload {
                member_id: 12345,
                secret_key: "mysecretkey".to_string(),
            })
        );

        // Query param style
        let res4 = parse_protocol_action("zzzmm://pair?member_id=12345&secret_key=mysecretkey")
            .expect("Should parse query pair");
        assert_eq!(
            res4,
            OneClickProtocolAction::Pair(RemotePairPayload {
                member_id: 12345,
                secret_key: "mysecretkey".to_string(),
            })
        );

        // Normal 1-Click install URL is correctly distinguished as Install
        let res_install = parse_protocol_action("zzzmm:https://gamebanana.com/mmdl/1773037,Mod,700143")
            .expect("Should parse install");
        assert!(matches!(res_install, OneClickProtocolAction::Install(_)));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_windows_registry_lifecycle() {
        // Test registration
        let reg_res = register_protocol();
        assert!(reg_res.is_ok(), "Registry registration should succeed: {:?}", reg_res);
        assert!(is_protocol_registered().unwrap_or(false), "Should report as registered");
    }
}
