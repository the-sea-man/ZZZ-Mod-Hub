use crate::error::AppError;
use serde_json::Value;

/// Fetches translated text chunks using resilient multi-endpoint fallback.
/// Running natively in Rust bypasses browser WebView CORS restrictions and URL length limits.
#[tauri::command]
pub async fn translate_query(query: String, target_lang: String) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| AppError::Custom(e.to_string()))?;

    let encoded_lang = urlencoding::encode(&target_lang);
    let encoded_query = urlencoding::encode(&query);

    let endpoints = [
        format!("https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl={encoded_lang}&q={encoded_query}"),
        format!("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl={encoded_lang}&dt=t&q={encoded_query}"),
        format!("https://translate.google.com/translate_a/single?client=at&sl=en&tl={encoded_lang}&dt=t&q={encoded_query}"),
    ];

    let mut last_err = String::from("No endpoint reached");

    for url in endpoints {
        match client.get(&url).send().await {
            Ok(res) if res.status().is_success() => {
                if let Ok(body) = res.text().await {
                    if let Ok(json) = serde_json::from_str::<Value>(&body) {
                        // dict-chrome-ex format: ["translated text"]
                        if let Some(arr) = json.as_array() {
                            if let Some(first_str) = arr.first().and_then(|v| v.as_str()) {
                                return Ok(first_str.to_string());
                            }
                            // gtx format: [[["chunk 1"], ["chunk 2"]], ...]
                            if let Some(chunks) = arr.first().and_then(|v| v.as_array()) {
                                let mut full = String::new();
                                for chunk in chunks {
                                    if let Some(txt) = chunk.as_array().and_then(|c| c.first()).and_then(|t| t.as_str()) {
                                        full.push_str(txt);
                                    }
                                }
                                if !full.is_empty() {
                                    return Ok(full);
                                }
                            }
                        }
                    }
                }
            }
            Ok(res) => {
                last_err = format!("Server returned status {}", res.status());
            }
            Err(err) => {
                last_err = format!("Network error: {err}");
            }
        }
    }

    Err(AppError::Custom(format!(
        "All translation endpoints failed: {last_err}"
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_translate_query_live() {
        let query = "[[[0]]] Hello world\n[[[1]]] Welcome";
        let res = translate_query(query.to_string(), "sr".to_string()).await;
        assert!(res.is_ok(), "Live translation request should succeed: {:?}", res.err());
        let text = res.unwrap();
        assert!(text.contains("[[[0]]]"), "Response should retain bracket delimiter token: {}", text);
    }
}
