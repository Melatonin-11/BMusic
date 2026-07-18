// Prevents additional console window on Windows in release, do not remove!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::header::{COOKIE, REFERER, USER_AGENT};

mod portable_update;
use portable_update::{install_portable_update, is_portable_mode};

const CREDENTIAL_SERVICE: &str = "com.bili.randomizer";
const CREDENTIAL_USER: &str = "bilibili-sessdata";

fn credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USER)
        .map_err(|error| format!("无法访问 Windows 凭据管理器: {error}"))
}

fn load_sessdata() -> Result<String, String> {
    match credential_entry()?.get_password() {
        Ok(value) => Ok(value),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(error) => Err(format!("读取登录凭据失败: {error}")),
    }
}

#[tauri::command]
fn credential_has_sessdata() -> Result<bool, String> {
    Ok(!load_sessdata()?.is_empty())
}

#[tauri::command]
fn credential_save_sessdata(sessdata: String) -> Result<(), String> {
    let value = sessdata.trim();
    if value.is_empty() {
        return credential_delete_sessdata();
    }
    credential_entry()?
        .set_password(value)
        .map_err(|error| format!("保存登录凭据失败: {error}"))
}

#[tauri::command]
fn credential_delete_sessdata() -> Result<(), String> {
    match credential_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("删除登录凭据失败: {error}")),
    }
}

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
async fn bilibili_nav() -> Result<serde_json::Value, String> {
    let sessdata = load_sessdata()?;
    let client = bilibili_client()?;
    let request = client.get("https://api.bilibili.com/x/web-interface/nav");
    send_bilibili_request(add_bilibili_headers(request, &sessdata)).await
}

#[tauri::command]
async fn bilibili_playlist(
    media_id: String,
    pn: u32,
    ps: u32,
) -> Result<serde_json::Value, String> {
    if media_id.trim().is_empty() {
        return Err("Missing media_id parameter".to_string());
    }

    let sessdata = load_sessdata()?;
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            bilibili_nav,
            bilibili_playlist,
            credential_has_sessdata,
            credential_save_sessdata,
            credential_delete_sessdata,
            is_portable_mode,
            install_portable_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
