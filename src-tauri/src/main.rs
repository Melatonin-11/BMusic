// Prevents additional console window on Windows in release, do not remove!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::header::{COOKIE, REFERER, USER_AGENT};

fn bilibili_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))
}

fn add_bilibili_headers(
    request: reqwest::RequestBuilder,
    sessdata: &str,
) -> reqwest::RequestBuilder {
    let request = request
        .header(
            USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .header(REFERER, "https://www.bilibili.com/");

    if sessdata.trim().is_empty() {
        request
    } else {
        let trimmed = sessdata.trim();
        let normalized = urlencoding::decode(trimmed)
            .map(|value| value.into_owned())
            .unwrap_or_else(|_| trimmed.to_string());
        request.header(
            COOKIE,
            format!("SESSDATA={}", urlencoding::encode(&normalized)),
        )
    }
}

async fn send_bilibili_request(
    request: reqwest::RequestBuilder,
) -> Result<serde_json::Value, String> {
    let response = request
        .send()
        .await
        .map_err(|error| format!("Bilibili request failed: {error}"))?;
    let status = response.status();

    if !status.is_success() {
        return Err(format!("Bilibili API returned HTTP {status}"));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("Invalid Bilibili response: {error}"))
}

#[tauri::command]
async fn bilibili_nav(sessdata: String) -> Result<serde_json::Value, String> {
    let client = bilibili_client()?;
    let request = client.get("https://api.bilibili.com/x/web-interface/nav");
    send_bilibili_request(add_bilibili_headers(request, &sessdata)).await
}

#[tauri::command]
async fn bilibili_playlist(
    media_id: String,
    pn: u32,
    ps: u32,
    sessdata: String,
) -> Result<serde_json::Value, String> {
    if media_id.trim().is_empty() {
        return Err("Missing media_id parameter".to_string());
    }

    let client = bilibili_client()?;
    let pn_string = pn.to_string();
    let ps_string = ps.to_string();
    let request = client
        .get("https://api.bilibili.com/x/v3/fav/resource/list")
        .query(&[
            ("media_id", media_id.as_str()),
            ("pn", pn_string.as_str()),
            ("ps", ps_string.as_str()),
            ("platform", "web"),
        ]);

    send_bilibili_request(add_bilibili_headers(request, &sessdata)).await
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![bilibili_nav, bilibili_playlist])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
