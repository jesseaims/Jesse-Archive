use crate::{browser_protocol as wire, AppState};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    net::{TcpListener, TcpStream},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

struct Session {
    client: String,
    request: String,
    url: String,
    top: String,
    started: Instant,
    filling: bool,
}
pub struct Bridge {
    clients: Mutex<HashMap<String, Arc<Mutex<TcpStream>>>>,
    request: Mutex<Option<(String, Instant)>>,
    session: Mutex<Option<Session>>,
    shortcut: Mutex<String>,
    shortcut_error: Mutex<String>,
}
fn random() -> String {
    use rand::RngCore;
    let mut b = [0; 32];
    rand::rngs::OsRng.fill_bytes(&mut b);
    hex::encode(b)
}
pub fn host(value: &str) -> Option<String> {
    let url = url::Url::parse(value).ok()?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return None;
    }
    let host = url
        .host_str()?
        .trim_start_matches("www.")
        .to_ascii_lowercase();
    Some(match url.port() {
        Some(port) => format!("{host}:{port}"),
        None => host,
    })
}
fn matching(item: &Value, url: &str) -> bool {
    item["type"] == "login"
        && item["trashed"].is_null()
        && same_account_site(item["f"]["url"].as_str().unwrap_or(""), url)
}
// Normalize saved addresses, but require an explicit HTTPS URL from the browser.
// This is used for account suggestions AND the final credential release. The
// stricter frame/top-page origin check intentionally keeps using `host` above.
fn account_url(value: &str, saved: bool) -> Option<url::Url> {
    let value = value.trim();
    if value.is_empty() || value.chars().any(char::is_control) {
        return None;
    }
    let normalized = if saved && !value.contains("://") {
        if value.starts_with("//") {
            format!("https:{value}")
        } else {
            format!("https://{value}")
        }
    } else {
        value.to_string()
    };
    let url = url::Url::parse(&normalized).ok()?;
    (url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.host_str().is_some())
    .then_some(url)
}
fn same_account_site(saved: &str, target: &str) -> bool {
    let (Some(saved), Some(target)) = (account_url(saved, true), account_url(target, false)) else {
        return false;
    };
    if saved.port_or_known_default() != target.port_or_known_default() {
        return false;
    }
    let saved_host = saved.host_str().unwrap().trim_end_matches('.');
    let target_host = target.host_str().unwrap().trim_end_matches('.');
    if saved_host == target_host {
        return true;
    }
    if !matches!(saved.host(), Some(url::Host::Domain(_)))
        || !matches!(target.host(), Some(url::Host::Domain(_)))
    {
        return false;
    }
    // Includes private suffixes: alice.github.io and bob.github.io remain distinct.
    match (psl::domain_str(saved_host), psl::domain_str(target_host)) {
        (Some(a), Some(b)) => a == b,
        _ => false,
    }
}
fn send(app: &tauri::AppHandle, client: &str, message: Value) -> Result<(), String> {
    let bridge = app.state::<Bridge>();
    let stream = bridge
        .clients
        .lock()
        .map_err(|_| "Connessione occupata")?
        .get(client)
        .cloned()
        .ok_or("Browser disconnesso")?;
    let mut stream = stream.lock().map_err(|_| "Connessione occupata")?;
    wire::write_frame(&mut *stream, &message).map_err(|_| "Browser disconnesso".into())
}
pub fn request(app: &tauri::AppHandle) {
    let bridge = app.state::<Bridge>();
    let id = random();
    *bridge.session.lock().unwrap() = None;
    *bridge.request.lock().unwrap() = Some((id.clone(), Instant::now()));
    let clients: Vec<_> = bridge.clients.lock().unwrap().keys().cloned().collect();
    if clients.is_empty() {
        show(app);
        let _ = app.emit_to("quick-fill", "browser-changed", ());
    }
    for client in clients {
        let _ = send(app, &client, json!({"kind":"context","request":id}));
    }
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(2));
        let bridge = handle.state::<Bridge>();
        if bridge
            .request
            .lock()
            .unwrap()
            .as_ref()
            .is_some_and(|(pending, _)| *pending == id)
        {
            show(&handle);
            let _ = handle.emit_to("quick-fill", "browser-changed", ());
        }
    });
}
fn show(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("quick-fill") {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
fn receive(app: &tauri::AppHandle, client: &str, message: Value) {
    match message["kind"].as_str().unwrap_or("") {
        "open" => {
            // Only the extension's toolbar action sends this message.
            let id = random();
            *app.state::<Bridge>().request.lock().unwrap() = Some((id.clone(), Instant::now()));
            let _ = send(app, client, json!({"kind":"context","request":id}));
        }
        "context" => {
            let bridge = app.state::<Bridge>();
            let mut pending = bridge.request.lock().unwrap();
            let Some((id, started)) = pending.as_ref() else {
                return;
            };
            if started.elapsed() > Duration::from_secs(5) || message["request"] != *id {
                return;
            }
            let url = message["url"].as_str().unwrap_or("");
            let top = message["top"].as_str().unwrap_or("");
            // Cross-origin frames require a separate explicit site association; never leak top-site credentials.
            if host(url).is_none() || host(url) != host(top) {
                return;
            }
            *bridge.session.lock().unwrap() = Some(Session {
                client: client.into(),
                request: id.clone(),
                url: url.into(),
                top: top.into(),
                started: Instant::now(),
                filling: false,
            });
            *pending = None;
            drop(pending);
            show(app);
            let _ = app.emit_to("quick-fill", "browser-changed", ());
        }
        "filled" => {
            let bridge = app.state::<Bridge>();
            let mut session = bridge.session.lock().unwrap();
            if session
                .as_ref()
                .is_some_and(|s| s.client == client && message["request"] == s.request && s.filling)
            {
                *session = None;
                let ok = message["ok"] == true;
                let _ = app.emit_to(
                    "quick-fill",
                    "browser-result",
                    json!({"ok":ok,"message":message["message"]}),
                );
            }
        }
        _ => (),
    }
}
pub fn setup(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let token = random();
    let directory = wire::directory();
    std::fs::create_dir_all(&directory)?;
    let shortcut = std::fs::read(directory.join("preferences.json"))
        .ok()
        .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
        .and_then(|v| v["shortcut"].as_str().map(str::to_owned))
        .unwrap_or("Ctrl+Alt+J".into());
    app.manage(Bridge {
        clients: Mutex::new(HashMap::new()),
        request: Mutex::new(None),
        session: Mutex::new(None),
        shortcut: Mutex::new(shortcut.clone()),
        shortcut_error: Mutex::new(String::new()),
    });
    std::fs::write(
        directory.join("connection.json"),
        serde_json::to_vec(&json!({"port":listener.local_addr()?.port(),"token":token}))?,
    )?;
    let shortcut_result = shortcut
        .parse::<Shortcut>()
        .map_err(|e| e.to_string())
        .and_then(|s| app.global_shortcut().register(s).map_err(|e| e.to_string()));
    if let Err(error) = shortcut_result {
        *app.state::<Bridge>().shortcut_error.lock().unwrap() = error;
    }
    tauri::WebviewWindowBuilder::new(
        app,
        "quick-fill",
        tauri::WebviewUrl::App("index.html?quick-fill".into()),
    )
    .title("JesseArchive · Inserimento rapido")
    .inner_size(460., 540.)
    .resizable(false)
    .visible(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()?;
    let handle = app.clone();
    std::thread::spawn(move || {
        for socket in listener.incoming().flatten() {
            let app = handle.clone();
            let token = token.clone();
            std::thread::spawn(move || {
                let mut socket = socket;
                let _ = socket.set_read_timeout(Some(Duration::from_secs(3)));
                if !wire::read_frame(&mut socket)
                    .ok()
                    .is_some_and(|v| v["token"] == token)
                {
                    return;
                }
                let _ = socket.set_read_timeout(None);
                let _ = socket.set_write_timeout(Some(Duration::from_secs(2)));
                let id = random();
                let Ok(writer) = socket.try_clone() else {
                    return;
                };
                app.state::<Bridge>()
                    .clients
                    .lock()
                    .unwrap()
                    .insert(id.clone(), Arc::new(Mutex::new(writer)));
                while let Ok(message) = wire::read_frame(&mut socket) {
                    receive(&app, &id, message);
                }
                let bridge = app.state::<Bridge>();
                bridge.clients.lock().unwrap().remove(&id);
                let mut session = bridge.session.lock().unwrap();
                if session.as_ref().is_some_and(|s| s.client == id) {
                    *session = None;
                    let _ = app.emit_to("quick-fill", "browser-changed", ());
                }
            });
        }
    });
    Ok(())
}
#[tauri::command]
pub fn browser_status(app: tauri::AppHandle) -> Value {
    let b = app.state::<Bridge>();
    json!({"shortcut":*b.shortcut.lock().unwrap(),"error":*b.shortcut_error.lock().unwrap(),"connected":b.clients.lock().unwrap().len(),"extension_id":wire::CHROMIUM_ID.trim()})
}
#[tauri::command]
pub fn browser_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    let next = shortcut
        .parse::<Shortcut>()
        .map_err(|_| "Scorciatoia non valida. Esempio: Ctrl+Alt+J")?;
    if !shortcut.contains('+') || shortcut.len() > 80 {
        return Err("Usa almeno un modificatore e un tasto".into());
    }
    let b = app.state::<Bridge>();
    let mut previous = b.shortcut.lock().unwrap();
    if *previous == shortcut && b.shortcut_error.lock().unwrap().is_empty() {
        return Ok(());
    }
    app.global_shortcut()
        .register(next)
        .map_err(|_| "Scorciatoia già occupata: scegline un'altra")?;
    if let Err(error) = std::fs::write(
        wire::directory().join("preferences.json"),
        json!({"shortcut":shortcut}).to_string(),
    ) {
        let _ = app.global_shortcut().unregister(next);
        return Err(error.to_string());
    }
    if let Ok(old) = previous.parse::<Shortcut>() {
        let _ = app.global_shortcut().unregister(old);
    }
    *previous = shortcut;
    b.shortcut_error.lock().unwrap().clear();
    Ok(())
}
#[tauri::command]
pub fn browser_accounts(app: tauri::AppHandle) -> Result<Value, String> {
    let b = app.state::<Bridge>();
    let session = b.session.lock().unwrap();
    let Some(s) = session
        .as_ref()
        .filter(|s| s.started.elapsed() < Duration::from_secs(120))
    else {
        return Ok(json!({"available":false}));
    };
    let state = app.state::<AppState>();
    let mut vault = state.vault()?;
    let status = vault.call("status", json!({}))?;
    let mut result = json!({"available":true,"url":s.url,"domain":host(&s.url),"unlocked":status["unlocked"],"accounts":[]});
    if status["unlocked"] == true {
        match vault.call("browser_state", json!({})) {
            Ok(data) => {
                result["accounts"] = json!(data["items"]
                    .as_array()
                    .unwrap_or(&Vec::new())
                    .iter()
                    .filter(|i| matching(i, &s.url))
                    .map(|i| json!({"id":i["id"],"title":i["title"],"username":i["f"]["username"]}))
                    .collect::<Vec<_>>())
            }
            Err(_) => result["unlocked"] = json!(false),
        }
    }
    Ok(result)
}
#[tauri::command]
pub fn browser_fill(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let b = app.state::<Bridge>();
    let mut session = b.session.lock().unwrap();
    let s = session
        .as_mut()
        .filter(|s| !s.filling && s.started.elapsed() < Duration::from_secs(120))
        .ok_or("Richiesta scaduta. Premi nuovamente la scorciatoia nel browser.")?;
    let state = app.state::<AppState>();
    let mut vault = state.vault()?;
    let data = vault.call("browser_state", json!({}))?;
    let item = data["items"]
        .as_array()
        .and_then(|items| items.iter().find(|i| i["id"] == id && matching(i, &s.url)))
        .ok_or("Account non associato a questo dominio")?;
    send(
        &app,
        &s.client,
        json!({"kind":"fill","request":s.request,"url":s.url,"top":s.top,"username":item["f"]["username"],"password":item["f"]["password"]}),
    )?;
    s.filling = true;
    Ok(())
}
#[tauri::command]
pub fn browser_cancel(app: tauri::AppHandle) {
    let b = app.state::<Bridge>();
    *b.session.lock().unwrap() = None;
    *b.request.lock().unwrap() = None;
    let _ = app.emit_to("quick-fill", "browser-dismissed", ());
    if let Some(w) = app.get_webview_window("quick-fill") {
        let _ = w.hide();
    }
}
#[tauri::command]
pub fn browser_open_extensions() -> Result<(), String> {
    let directory = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .with_file_name("browser-extension");
    if !directory.is_dir() {
        return Err("Le estensioni sono nel pacchetto accanto al nuovo setup, oppure nella cartella browser-extension del progetto.".into());
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe")
            .arg(directory)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
pub fn browser_install() -> Result<String, String> {
    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .with_file_name("jesse-browser-host.exe");
    if !exe.exists() {
        return Err("Componente browser non trovato: installa il nuovo setup completo.".into());
    }
    let dir = wire::directory();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let chromium = dir.join("chromium.json");
    let firefox = dir.join("firefox.json");
    let base = json!({"name":wire::HOST,"description":"JesseArchive browser integration","path":exe,"type":"stdio"});
    let mut c = base.clone();
    c["allowed_origins"] = json!([format!("chrome-extension://{}/", wire::CHROMIUM_ID.trim())]);
    let mut f = base;
    f["allowed_extensions"] = json!([wire::FIREFOX_ID]);
    std::fs::write(&chromium, c.to_string()).map_err(|e| e.to_string())?;
    std::fs::write(&firefox, f.to_string()).map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        let root = RegKey::predef(HKEY_CURRENT_USER);
        for vendor in [
            "Google\\Chrome",
            "Microsoft\\Edge",
            "BraveSoftware\\Brave-Browser",
            "Opera Software",
            "Vivaldi",
            "Chromium",
            "Mozilla",
        ] {
            let (key, _) = root
                .create_subkey(format!(
                    "Software\\{vendor}\\NativeMessagingHosts\\{}",
                    wire::HOST
                ))
                .map_err(|e| e.to_string())?;
            key.set_value(
                "",
                &if vendor == "Mozilla" {
                    firefox.to_string_lossy().to_string()
                } else {
                    chromium.to_string_lossy().to_string()
                },
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok("Collegamento registrato. Installa l'estensione e riavvia il browser.".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_site_matching() {
        let item = json!({"type":"login","f":{"url":"https://www.example.com/login"}});
        assert!(matching(&item, "https://example.com/account"));
        for url in [
            "https://example.com.evil.test",
            "https://evil-example.com",
            "http://example.com",
            "https://example.com@evil.test",
            "https://example.com:8443",
        ] {
            assert!(!matching(&item, url));
        }
        let mut trashed = item;
        trashed["trashed"] = json!(123);
        assert!(!matching(&trashed, "https://example.com"));
    }
    #[test]
    fn epic_accounts_match_bare_domains_and_store_login_subdomains() {
        for saved in [
            "epicgames.com",
            "https://store.epicgames.com/",
            "  EPICGAMES.COM  ",
            "https://www.epicgames.com/id/login",
        ] {
            let item = json!({"type":"login","f":{"url":saved}});
            for target in [
                "https://www.epicgames.com/id/login",
                "https://accounts.epicgames.com/login",
                "https://store.epicgames.com/en-US/",
            ] {
                assert!(matching(&item, target), "{saved} -> {target}");
            }
        }
        // Broad account suggestions must not broaden the frame origin gate.
        assert_ne!(
            host("https://store.epicgames.com"),
            host("https://accounts.epicgames.com")
        );
    }
    #[test]
    fn related_site_matching_respects_suffix_boundaries_and_protocols() {
        for (saved, target) in [
            ("epicgames.com", "https://epicgames.com.attacker.com"),
            ("epicgames.com", "https://fakeepicgames.com"),
            ("epicgames.com", "http://www.epicgames.com"),
            ("epicgames.com", "https://epicgames.com@attacker.com"),
            ("epicgames.com", "https://epicgames.com:8443"),
            ("https://alice.github.io", "https://bob.github.io"),
            ("https://alice.blogspot.com", "https://bob.blogspot.com"),
            ("https://example.co.uk", "https://other.co.uk"),
            ("co.uk", "https://example.co.uk"),
            ("", "https://epicgames.com"),
            ("https://user:secret@epicgames.com", "https://epicgames.com"),
            ("epicgames.com", "epicgames.com"),
            ("https://127.0.0.1", "https://127.0.0.2"),
        ] {
            assert!(!same_account_site(saved, target), "{saved} -> {target}");
        }
        assert!(same_account_site(
            "https://shop.example.co.uk",
            "https://login.example.co.uk"
        ));
        assert!(same_account_site(
            "https://a.alice.github.io",
            "https://alice.github.io"
        ));
        assert!(same_account_site(
            "https://127.0.0.1:443",
            "https://127.0.0.1"
        ));
    }
}
