//! Global Quick Search: a launcher window opened by a global shortcut from anywhere,
//! to find an account and copy, show or open it without the main window.
//!
//! Security model (see docs/SECURITY.md, "Ricerca rapida globale"):
//! - it has no session of its own: every command goes through `Vault::call`, so the
//!   same unlocked/expiry checks apply, and the window unlocks with the same
//!   `unlock` command as the main window;
//! - the window only receives metadata (`metadata`): titles, usernames/emails, site
//!   addresses, categories, folders, favorites, group names and logos. Passwords are
//!   copied here in the backend (`quick_search_copy`) and reach the webview only
//!   through `quick_search_reveal`, when the user explicitly asks to see one;
//! - the search history and the recently used items exist only in memory and are
//!   wiped whenever the vault locks;
//! - settings are a device preference (`quick_search` in config.json): no vault data.
use crate::{clipboard, core, AppState};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Listener, Manager, PhysicalPosition, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut};
use zeroize::Zeroizing;

pub const LABEL: &str = "quick-search";
/// Logical size at 100% zoom (`zoom::apply_to` scales it).
pub const SIZE: (f64, f64) = (720., 500.);
pub const DEFAULT_SHORTCUT: &str = "Ctrl+Shift+Space";
const PREF: &str = "quick_search";
const HISTORY_MAX: usize = 8;
const RECENT_MAX: usize = 8;
/// Quick actions the main window can run on request (ids of `ACTIONS` in
/// src/dashboard/widgets.tsx) and pages it can open.
const ACTIONS: [&str; 6] = [
    "add-login",
    "add-note",
    "add-personal",
    "generate",
    "security",
    "passwords",
];
const PAGES: [&str; 2] = ["dashboard", "favorites"];

#[derive(Clone, Debug, PartialEq)]
pub struct Settings {
    pub enabled: bool,
    pub shortcut: String,
    pub close_after: bool,
    pub favorites: bool,
    pub recent: bool,
    pub categories: bool,
    pub history: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            enabled: true,
            shortcut: DEFAULT_SHORTCUT.into(),
            close_after: true,
            favorites: true,
            recent: true,
            categories: true,
            history: false,
        }
    }
}

impl Settings {
    /// Missing or malformed values keep the defaults.
    pub fn from_value(v: &Value) -> Self {
        let d = Settings::default();
        let flag = |k: &str, def: bool| v.get(k).and_then(Value::as_bool).unwrap_or(def);
        Settings {
            enabled: flag("enabled", d.enabled),
            shortcut: v
                .get("shortcut")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty() && s.len() <= 80)
                .map(str::to_owned)
                .unwrap_or(d.shortcut),
            close_after: flag("close_after", d.close_after),
            favorites: flag("favorites", d.favorites),
            recent: flag("recent", d.recent),
            categories: flag("categories", d.categories),
            history: flag("history", d.history),
        }
    }
    pub fn to_value(&self) -> Value {
        json!({
            "enabled": self.enabled,
            "shortcut": self.shortcut,
            "close_after": self.close_after,
            "favorites": self.favorites,
            "recent": self.recent,
            "categories": self.categories,
            "history": self.history,
        })
    }
}

pub struct QuickSearch {
    settings: Mutex<Settings>,
    registered: Mutex<Option<Shortcut>>,
    error: Mutex<String>,
    history: Mutex<Vec<String>>,
    recent: Mutex<Vec<String>>,
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

impl QuickSearch {
    /// Session-only data: dropped when the vault locks.
    fn wipe(&self) {
        lock(&self.history).clear();
        lock(&self.recent).clear();
    }
    fn remember_item(&self, id: &str) {
        if !lock(&self.settings).recent {
            return;
        }
        let mut recent = lock(&self.recent);
        recent.retain(|x| x != id);
        recent.insert(0, id.to_owned());
        recent.truncate(RECENT_MAX);
    }
}

/// Validates a shortcut. It must have Ctrl, Alt or Win and must not take over a
/// combination that Windows or every application already uses.
pub fn parse_shortcut(text: &str) -> Result<Shortcut, String> {
    if !text.contains('+') || text.len() > 80 {
        return Err("Usa almeno un modificatore e un tasto".into());
    }
    let s: Shortcut = text
        .parse()
        .map_err(|_| "Scorciatoia non valida. Esempio: Ctrl+Shift+Space")?;
    let strong = Modifiers::CONTROL | Modifiers::ALT | Modifiers::SUPER;
    if !s.mods.intersects(strong) {
        return Err("Usa almeno Ctrl, Alt o Win nella scorciatoia".into());
    }
    let key = format!("{:?}", s.key);
    let only = |m: Modifiers| s.mods == m;
    let reserved = (only(Modifiers::CONTROL)
        && (key.starts_with("Key") || key.starts_with("Digit") || key == "Space"))
        || (only(Modifiers::ALT) && ["Tab", "F4", "Space", "Escape"].contains(&key.as_str()))
        || (only(Modifiers::CONTROL | Modifiers::ALT) && key == "Delete")
        || (only(Modifiers::CONTROL | Modifiers::SHIFT) && key == "Escape")
        || (only(Modifiers::CONTROL) && key == "Escape")
        || (s.mods.contains(Modifiers::SUPER) && key == "KeyL");
    if reserved {
        return Err("Questa combinazione è già usata da Windows o dalle applicazioni".into());
    }
    Ok(s)
}

/// True when `shortcut` is the active Quick Search shortcut (global handler).
pub fn handles(app: &AppHandle, shortcut: &Shortcut) -> bool {
    app.try_state::<QuickSearch>()
        .is_some_and(|q| lock(&q.registered).as_ref() == Some(shortcut))
}

pub fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let settings = Settings::from_value(&core::device_pref(PREF));
    app.manage(QuickSearch {
        settings: Mutex::new(settings.clone()),
        registered: Mutex::new(None),
        error: Mutex::new(String::new()),
        history: Mutex::new(Vec::new()),
        recent: Mutex::new(Vec::new()),
    });
    tauri::WebviewWindowBuilder::new(
        app,
        LABEL,
        tauri::WebviewUrl::App("index.html?quick-search".into()),
    )
    .title("Jesse's Archive")
    .inner_size(SIZE.0, SIZE.1)
    .resizable(false)
    .decorations(false)
    .shadow(true)
    .visible(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()?;
    if settings.enabled {
        if let Err(e) = register(app, &settings.shortcut) {
            *lock(&app.state::<QuickSearch>().error) = e;
        }
    }
    // Every lock (button, tray, inactivity, closing to the tray) emits vault-locked.
    let handle = app.clone();
    app.listen_any("vault-locked", move |_| {
        if let Some(q) = handle.try_state::<QuickSearch>() {
            q.wipe();
        }
    });
    Ok(())
}

/// Registers `text` as the shortcut, replacing the previous one only on success.
fn register(app: &AppHandle, text: &str) -> Result<(), String> {
    let next = parse_shortcut(text)?;
    if crate::browser::shortcut(app).as_ref() == Some(&next) {
        return Err("Scorciatoia già usata dall'inserimento nel browser: scegline un'altra".into());
    }
    let q = app.state::<QuickSearch>();
    let mut registered = lock(&q.registered);
    if registered.as_ref() == Some(&next) {
        return Ok(());
    }
    app.global_shortcut()
        .register(next)
        .map_err(|_| "Scorciatoia già occupata da un'altra applicazione: scegline un'altra")?;
    if let Some(old) = registered.take() {
        let _ = app.global_shortcut().unregister(old);
    }
    *registered = Some(next);
    lock(&q.error).clear();
    Ok(())
}

fn unregister(app: &AppHandle) {
    let q = app.state::<QuickSearch>();
    if let Some(old) = lock(&q.registered).take() {
        let _ = app.global_shortcut().unregister(old);
    }
    lock(&q.error).clear();
}

/// The browser shortcut must not take the Quick Search one.
pub fn uses(app: &AppHandle, shortcut: &Shortcut) -> bool {
    handles(app, shortcut)
}

fn window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(LABEL)
}

/// Centered horizontally on the screen under the mouse, in its upper part.
fn place(app: &AppHandle, w: &WebviewWindow) {
    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten());
    match (monitor, w.outer_size()) {
        (Some(m), Ok(size)) => {
            let (pos, area) = (m.position(), m.size());
            let x = pos.x + (area.width as i32 - size.width as i32) / 2;
            let y = pos.y + ((area.height as i32 - size.height as i32) as f64 * 0.3) as i32;
            let _ = w.set_position(PhysicalPosition::new(x, y.max(pos.y)));
        }
        _ => {
            let _ = w.center();
        }
    }
}

/// Global shortcut: shows the window (focused, search field ready) or hides it.
pub fn toggle(app: &AppHandle) {
    let Some(w) = window(app) else {
        return;
    };
    if w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false) {
        hide(app);
        return;
    }
    place(app, &w);
    let _ = w.show();
    let _ = w.unminimize();
    let _ = w.set_focus();
    let _ = app.emit_to(LABEL, "quick-search-shown", ());
}

/// Hides the window; the page drops results and any revealed password.
pub fn hide(app: &AppHandle) {
    if let Some(w) = window(app) {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
            let _ = app.emit_to(LABEL, "quick-search-hidden", ());
        }
    }
}

// --- Data for the window -------------------------------------------------------------

/// Fields of each category that the window may show and search. Never secrets
/// (passwords, card numbers, CVV, PIN, seeds, TOTP, passkey credentials) nor notes.
fn visible_fields(kind: &str) -> &'static [&'static str] {
    match kind {
        "login" | "passkey" => &["url", "username"],
        "personal" => &["email"],
        "crypto" => &["platform"],
        _ => &[],
    }
}

fn trashed(item: &Value) -> bool {
    item.get("trashed")
        .is_some_and(|t| !t.is_null() && t != &json!(0) && t != &json!(false))
}

fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v.get(k).and_then(Value::as_str).unwrap_or("")
}

/// What the window receives for one item: metadata only.
pub fn metadata(item: &Value) -> Option<Value> {
    if trashed(item) || text(item, "id").is_empty() {
        return None;
    }
    let kind = text(item, "type");
    let f = item.get("f").cloned().unwrap_or(Value::Null);
    let mut fields = serde_json::Map::new();
    for k in visible_fields(kind) {
        let v = text(&f, k);
        if !v.is_empty() {
            fields.insert((*k).into(), json!(v));
        }
    }
    let has_password = matches!(kind, "login" | "crypto") && !text(&f, "password").is_empty();
    Some(json!({
        "id": item["id"],
        "type": kind,
        "title": text(item, "title"),
        "folder": item.get("folder").cloned().unwrap_or(Value::Null),
        "fav": item.get("fav").and_then(Value::as_bool).unwrap_or(false),
        "created": item.get("created").cloned().unwrap_or(Value::Null),
        "updated": item.get("updated").cloned().unwrap_or(Value::Null),
        "gk": text(item, "gk"),
        "src": text(item, "src"),
        "f": fields,
        "has_password": has_password,
    }))
}

/// Metadata of the whole vault (items, folder names, group names and logos).
pub fn snapshot(data: &Value) -> Value {
    let items: Vec<Value> = data["items"]
        .as_array()
        .map(|a| a.iter().filter_map(metadata).collect())
        .unwrap_or_default();
    let folders: Vec<Value> = data["folders"]
        .as_array()
        .map(|a| {
            a.iter()
                .map(|f| json!({"id": f["id"], "name": text(f, "name")}))
                .collect()
        })
        .unwrap_or_default();
    let groups: serde_json::Map<String, Value> = data["groups"]
        .as_object()
        .map(|g| {
            g.iter()
                .map(|(k, v)| {
                    (
                        k.clone(),
                        json!({"name": text(v, "name"), "icon": text(v, "icon")}),
                    )
                })
                .collect()
        })
        .unwrap_or_default();
    json!({"items": items, "folders": folders, "groups": groups})
}

/// Reads the vault through the normal access checks; None when locked.
fn vault_data(app: &AppHandle) -> Result<Option<Value>, String> {
    let state = app.state::<AppState>();
    let mut vault = state.vault()?;
    if vault.call("status", json!({}))?["unlocked"] != true {
        return Ok(None);
    }
    vault.call("browser_state", json!({})).map(Some)
}

fn find<'a>(data: &'a Value, id: &str) -> Result<&'a Value, String> {
    data["items"]
        .as_array()
        .and_then(|a| a.iter().find(|i| text(i, "id") == id && !trashed(i)))
        .ok_or_else(|| "Elemento non trovato".into())
}

/// A deliberate action on the vault counts as activity for the auto-lock delay.
fn touch(app: &AppHandle) {
    if let Ok(mut vault) = app.state::<AppState>().vault() {
        let _ = vault.call("touch", json!({}));
    }
}

#[tauri::command]
pub fn quick_search_data(app: AppHandle) -> Result<Value, String> {
    let q = app.state::<QuickSearch>();
    let settings = lock(&q.settings).clone();
    let Some(data) = vault_data(&app)? else {
        q.wipe();
        return Ok(json!({"unlocked": false, "settings": settings.to_value()}));
    };
    let mut out = snapshot(&data);
    out["unlocked"] = json!(true);
    out["settings"] = settings.to_value();
    // Same colors as the main window (a preset name or custom colors).
    out["theme"] = data["settings"]["theme"].clone();
    out["recent"] = json!(if settings.recent {
        lock(&q.recent).clone()
    } else {
        vec![]
    });
    out["history"] = json!(if settings.history {
        lock(&q.history).clone()
    } else {
        vec![]
    });
    Ok(out)
}

/// Copies the username/email or the password of an item, in the backend. The
/// clipboard is cleared after the vault's delay unless something else was copied.
#[tauri::command]
pub async fn quick_search_copy(app: AppHandle, id: String, field: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let data = vault_data(&app)?.ok_or("Vault bloccato")?;
        let item = find(&data, &id)?;
        let f = &item["f"];
        let value = match field.as_str() {
            "username" => Some(text(f, "username"))
                .filter(|v| !v.is_empty())
                .or(Some(text(f, "email")))
                .filter(|v| !v.is_empty())
                .ok_or("Nessuno username o email per questo elemento")?,
            "password" if matches!(text(item, "type"), "login" | "crypto") => {
                Some(text(f, "password"))
                    .filter(|v| !v.is_empty())
                    .ok_or("Nessuna password salvata per questo elemento")?
            }
            _ => return Err("Operazione non disponibile per questo elemento".into()),
        };
        let value = Zeroizing::new(value.to_owned());
        let seconds = data["settings"]["clip"].as_u64().unwrap_or(30).min(3600);
        drop(data);
        clipboard::copy_with_timeout(value, seconds)?;
        touch(&app);
        app.state::<QuickSearch>().remember_item(&id);
        Ok(json!({"ok": true, "clear_after": seconds}))
    })
    .await
    .map_err(|e| format!("Errore nel thread degli appunti: {e}"))?
}

/// Returns the password of an item to show it for a few seconds: only on an
/// explicit request from the user.
#[tauri::command]
pub fn quick_search_reveal(app: AppHandle, id: String) -> Result<Value, String> {
    let data = vault_data(&app)?.ok_or("Vault bloccato")?;
    let item = find(&data, &id)?;
    if !matches!(text(item, "type"), "login" | "crypto") {
        return Err("Operazione non disponibile per questo elemento".into());
    }
    let value = text(&item["f"], "password");
    if value.is_empty() {
        return Err("Nessuna password salvata per questo elemento".into());
    }
    let out = json!({"value": value});
    drop(data);
    touch(&app);
    app.state::<QuickSearch>().remember_item(&id);
    Ok(out)
}

/// Only http(s) addresses open; a bare domain gets https://.
pub fn site_url(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() || raw.len() > 2048 {
        return None;
    }
    let candidate = if raw.contains("://") {
        raw.to_owned()
    } else {
        format!("https://{raw}")
    };
    let url = url::Url::parse(&candidate).ok()?;
    (matches!(url.scheme(), "http" | "https") && url.host_str().is_some_and(|h| !h.is_empty()))
        .then(|| url.to_string())
}

#[cfg(windows)]
fn open_in_browser(url: &str) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let wide = |s: &str| {
        std::ffi::OsStr::new(s)
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<u16>>()
    };
    let (verb, file) = (wide("open"), wide(url));
    // SAFETY: NUL-terminated UTF-16 buffers alive for the call; the URL was validated
    // as http(s) by `site_url`, so it opens in the default browser.
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if result as isize > 32 {
        Ok(())
    } else {
        Err("Impossibile aprire il sito nel browser".into())
    }
}
#[cfg(not(windows))]
fn open_in_browser(_url: &str) -> Result<(), String> {
    Err("Apertura dei siti disponibile nella build Windows".into())
}

#[tauri::command]
pub fn quick_search_open_url(app: AppHandle, id: String) -> Result<(), String> {
    let data = vault_data(&app)?.ok_or("Vault bloccato")?;
    let url =
        site_url(text(&find(&data, &id)?["f"], "url")).ok_or("Indirizzo del sito non valido")?;
    drop(data);
    open_in_browser(&url)?;
    app.state::<QuickSearch>().remember_item(&id);
    Ok(())
}

/// Opens something in the main window: an item, a quick action or a page.
#[tauri::command]
pub fn quick_search_open(app: AppHandle, target: Value) -> Result<(), String> {
    let kind = text(&target, "kind");
    let payload = match kind {
        "item" => {
            let id = text(&target, "id");
            let data = vault_data(&app)?.ok_or("Vault bloccato")?;
            find(&data, id)?;
            app.state::<QuickSearch>().remember_item(id);
            json!({"kind": "item", "id": id})
        }
        "action" if ACTIONS.contains(&text(&target, "action")) => {
            json!({"kind": "action", "action": text(&target, "action")})
        }
        "page" if PAGES.contains(&text(&target, "page")) => {
            json!({"kind": "page", "page": text(&target, "page")})
        }
        "unlock" => json!({"kind": "unlock"}),
        _ => return Err("Operazione non disponibile".into()),
    };
    hide(&app);
    crate::window_state::show_main(&app);
    app.emit_to("main", "quick-search-open", payload)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn quick_search_hide(app: AppHandle) {
    hide(&app);
}

/// Adds a query to the session history, when the history is enabled.
#[tauri::command]
pub fn quick_search_remember(app: AppHandle, query: String) {
    let q = app.state::<QuickSearch>();
    let query = query.trim();
    if !lock(&q.settings).history || query.is_empty() || query.chars().count() > 100 {
        return;
    }
    if !matches!(vault_data(&app), Ok(Some(_))) {
        return;
    }
    let mut history = lock(&q.history);
    history.retain(|x| x != query);
    history.insert(0, query.to_owned());
    history.truncate(HISTORY_MAX);
}

#[tauri::command]
pub fn quick_search_clear_history(app: AppHandle) {
    lock(&app.state::<QuickSearch>().history).clear();
}

#[tauri::command]
pub fn quick_search_settings(app: AppHandle) -> Value {
    let q = app.state::<QuickSearch>();
    let settings = lock(&q.settings).clone();
    json!({
        "settings": settings.to_value(),
        "default_shortcut": DEFAULT_SHORTCUT,
        "active": lock(&q.registered).is_some(),
        "error": *lock(&q.error),
    })
}

/// Saves the settings. The shortcut is validated and registered first: if that
/// fails nothing changes and the previous shortcut keeps working.
#[tauri::command]
pub fn quick_search_configure(app: AppHandle, settings: Value) -> Result<Value, String> {
    let next = Settings::from_value(&settings);
    let q = app.state::<QuickSearch>();
    let previous = lock(&q.settings).clone();
    if next.enabled {
        register(&app, &next.shortcut)?;
    } else {
        unregister(&app);
    }
    if let Err(e) = core::set_device_pref(PREF, next.to_value()) {
        // Put the previous shortcut back.
        if previous.enabled {
            let _ = register(&app, &previous.shortcut);
        } else {
            unregister(&app);
        }
        return Err(e);
    }
    if !next.history {
        lock(&q.history).clear();
    }
    if !next.recent {
        lock(&q.recent).clear();
    }
    *lock(&q.settings) = next;
    if !lock(&q.settings).enabled {
        hide(&app);
    }
    Ok(quick_search_settings(app.clone()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metadata_never_contains_secrets_or_notes() {
        let items = json!({"items": [
            {"id":"a","type":"login","title":"Epic Games","notes":"nota segreta","fav":true,
             "f":{"url":"https://epicgames.com","username":"uno@example.test","password":"Sintetica-1","totp":"JBSWY3DP"}},
            {"id":"b","type":"card","title":"Carta","f":{"holder":"Mario","number":"4111111111111111","cvv":"123","pin":"9999"}},
            {"id":"c","type":"crypto","title":"Wallet","f":{"platform":"Ledger","seed":"seme sintetico","password":"Sintetica-2","address":"0xabc"}},
            {"id":"d","type":"passkey","title":"Sito","f":{"url":"https://a.test","username":"u","credential":"{\"d\":\"chiave\"}"}},
            {"id":"e","type":"personal","title":"Io","f":{"email":"io@example.test","phone":"123","address":"Via"}},
            {"id":"f","type":"note","title":"Nota","notes":"testo"},
            {"id":"g","type":"login","title":"Cestino","trashed":123,"f":{"username":"x"}}
        ]});
        let out = snapshot(&items);
        let text = out.to_string();
        for secret in [
            "Sintetica-1",
            "Sintetica-2",
            "JBSWY3DP",
            "4111111111111111",
            "9999",
            "seme sintetico",
            "chiave",
            "nota segreta",
            "testo",
            "0xabc",
            "Mario",
        ] {
            assert!(!text.contains(secret), "{secret} leaked");
        }
        let list = out["items"].as_array().unwrap();
        assert_eq!(list.len(), 6, "trashed items are left out");
        assert_eq!(list[0]["f"]["username"], "uno@example.test");
        assert_eq!(list[0]["has_password"], true);
        assert_eq!(
            list[1]["has_password"], false,
            "a card PIN is not a password"
        );
        assert_eq!(list[2]["has_password"], true);
        assert_eq!(list[4]["f"]["email"], "io@example.test");
    }

    #[test]
    fn only_http_sites_open() {
        assert_eq!(
            site_url("epicgames.com").as_deref(),
            Some("https://epicgames.com/")
        );
        assert_eq!(
            site_url("http://intranet.test/login").as_deref(),
            Some("http://intranet.test/login")
        );
        for bad in [
            "",
            "javascript:alert(1)",
            "file:///C:/Windows/system32/cmd.exe",
            "ms-settings:privacy",
            "https://",
        ] {
            assert_eq!(site_url(bad), None, "{bad}");
        }
    }

    #[test]
    fn shortcuts_need_a_strong_modifier_and_avoid_system_ones() {
        assert!(parse_shortcut(DEFAULT_SHORTCUT).is_ok());
        assert!(parse_shortcut("Ctrl+Alt+K").is_ok());
        assert!(parse_shortcut("Super+Shift+F").is_ok());
        for bad in [
            "Space",
            "Shift+K",
            "Ctrl+C",
            "Ctrl+V",
            "Ctrl+Space",
            "Alt+Tab",
            "Alt+F4",
            "Alt+Space",
            "Ctrl+Alt+Delete",
            "Ctrl+Shift+Escape",
            "Super+L",
            "Ctrl+Nonsense",
        ] {
            assert!(parse_shortcut(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn settings_fall_back_to_defaults() {
        assert_eq!(Settings::from_value(&Value::Null), Settings::default());
        let s = Settings::from_value(&json!({"enabled": false, "shortcut": "", "history": "yes"}));
        assert!(!s.enabled);
        assert_eq!(s.shortcut, DEFAULT_SHORTCUT);
        assert!(!s.history);
        let round = Settings::from_value(&s.to_value());
        assert_eq!(round, s);
    }
}
