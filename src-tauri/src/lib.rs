//! Deck — Tauri backend.
//!
//! Azure DevOps REST does not send permissive CORS headers, so the webview
//! cannot call it directly. All ADO traffic is routed through these Rust
//! commands: the Personal Access Token is stored in the OS keychain and the
//! `Authorization: Basic base64(":" + PAT)` header is attached here — the PAT
//! never lives in JS.

use base64::Engine as _;
use serde::Serialize;

/// Keychain service + account under which the single active PAT is stored.
const KEYRING_SERVICE: &str = "com.deck.adoboard";
const KEYRING_USER: &str = "ado-pat";

fn pat_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

/// Store (or overwrite) the active PAT in the OS keychain.
#[tauri::command]
fn save_pat(pat: String) -> Result<(), String> {
    pat_entry()?.set_password(&pat).map_err(|e| e.to_string())
}

/// Whether a PAT is currently stored. Never returns the secret itself.
#[tauri::command]
fn has_pat() -> bool {
    match pat_entry() {
        Ok(entry) => entry.get_password().is_ok(),
        Err(_) => false,
    }
}

/// Remove the stored PAT (sign out).
#[tauri::command]
fn delete_pat() -> Result<(), String> {
    let entry = pat_entry()?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// A completed HTTP response handed back to the frontend. Note: 4xx/5xx are
/// returned as a normal value (with `ok = false`) so the TS client can read the
/// ADO error body; only transport failures map to `Err`.
#[derive(Serialize)]
struct AdoResponse {
    status: u16,
    ok: bool,
    body: serde_json::Value,
}

fn auth_header(pat: &str) -> String {
    let token = base64::engine::general_purpose::STANDARD.encode(format!(":{pat}"));
    format!("Basic {token}")
}

async fn perform(
    method: String,
    url: String,
    body: Option<serde_json::Value>,
    content_type: Option<String>,
    pat: String,
) -> Result<AdoResponse, String> {
    let client = reqwest::Client::builder()
        .user_agent("Deck/0.1 (+https://github.com/CT4nk3r/ado-boarder)")
        .build()
        .map_err(|e| e.to_string())?;

    let m = reqwest::Method::from_bytes(method.to_uppercase().as_bytes())
        .map_err(|e| format!("invalid HTTP method: {e}"))?;

    let mut req = client
        .request(m, &url)
        .header(reqwest::header::AUTHORIZATION, auth_header(&pat))
        .header(reqwest::header::ACCEPT, "application/json");

    if let Some(value) = body {
        // Serialize manually so an explicit content-type (e.g. the JSON-Patch
        // media type ADO requires) is preserved instead of being overwritten.
        let ct = content_type.unwrap_or_else(|| "application/json".to_string());
        let bytes = serde_json::to_vec(&value).map_err(|e| e.to_string())?;
        req = req
            .header(reqwest::header::CONTENT_TYPE, ct)
            .body(bytes);
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let parsed = if text.trim().is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(serde_json::Value::String(text))
    };

    Ok(AdoResponse { status, ok, body: parsed })
}

/// Make an ADO request using the PAT stored in the keychain. `url` is the full
/// ADO URL (built by the TS layer, which knows org/project); the secret is
/// attached here.
#[tauri::command]
async fn ado_request(
    method: String,
    url: String,
    body: Option<serde_json::Value>,
    content_type: Option<String>,
) -> Result<AdoResponse, String> {
    let pat = pat_entry()?
        .get_password()
        .map_err(|_| "No PAT stored. Please reconnect to Azure DevOps.".to_string())?;
    perform(method, url, body, content_type, pat).await
}

/// Make an ADO request with a PAT supplied inline. Used during onboarding to
/// validate credentials *before* committing them to the keychain.
#[tauri::command]
async fn ado_request_with_pat(
    method: String,
    url: String,
    body: Option<serde_json::Value>,
    content_type: Option<String>,
    pat: String,
) -> Result<AdoResponse, String> {
    perform(method, url, body, content_type, pat).await
}

/// A fetched avatar image, encoded as a `data:` URL the webview can render
/// directly. `data_url` is `None` for non-2xx responses (e.g. a stale URL).
#[derive(Serialize)]
struct ImageResponse {
    status: u16,
    ok: bool,
    #[serde(rename = "dataUrl")]
    data_url: Option<String>,
}

/// Only ever attach the PAT to genuine Azure DevOps hosts, so a poisoned avatar
/// URL in a work item payload can't exfiltrate the token to a third party.
fn is_azure_host(url: &str) -> bool {
    match reqwest::Url::parse(url) {
        Ok(parsed) => parsed.scheme() == "https" && matches!(parsed.host_str(), Some(host)
            if host == "dev.azure.com"
                || host.ends_with(".azure.com")
                || host.ends_with(".visualstudio.com")),
        Err(_) => false,
    }
}

/// Fetch an ADO avatar image (which requires authentication) using the stored
/// PAT and hand it back as a base64 `data:` URL. The webview never authenticates
/// to ADO itself, so this is the only way it can show real profile pictures.
#[tauri::command]
async fn ado_fetch_image(url: String) -> Result<ImageResponse, String> {
    if !is_azure_host(&url) {
        return Err("Refusing to fetch image from a non-Azure DevOps host.".to_string());
    }

    let pat = pat_entry()?
        .get_password()
        .map_err(|_| "No PAT stored. Please reconnect to Azure DevOps.".to_string())?;

    let client = reqwest::Client::builder()
        .user_agent("Deck/0.1 (+https://github.com/CT4nk3r/ado-boarder)")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .header(reqwest::header::AUTHORIZATION, auth_header(&pat))
        .header(reqwest::header::ACCEPT, "image/*")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    if !ok {
        return Ok(ImageResponse { status, ok, data_url: None });
    }

    // Trust the server's content type only when it actually names an image;
    // ADO occasionally returns application/octet-stream, which <img> won't render.
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .filter(|ct| ct.starts_with("image/"))
        .unwrap_or("image/png")
        .to_string();

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{content_type};base64,{encoded}");

    Ok(ImageResponse { status, ok, data_url: Some(data_url) })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // The updater plugin is desktop-only.
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_pat,
            has_pat,
            delete_pat,
            ado_request,
            ado_request_with_pat,
            ado_fetch_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
