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
//! - the recently used items are saved in the encrypted vault (`settings.recent`,
//!   item ids only, shared with the Dashboard widget), so they survive a restart; with the vault locked the window
//!   receives none of them and forgets what it was showing;
//! - settings are a device preference (`quick_search` in config.json): no vault data.
use crate::{clipboard, core, AppState};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut};
use zeroize::Zeroizing;

pub const LABEL: &str = "quick-search";
/// Logical size at 100% zoom (`zoom::apply_to` scales it).
pub const SIZE: (f64, f64) = (880., 540.);
pub const DEFAULT_SHORTCUT: &str = "Ctrl+Shift+Space";
const PREF: &str = "quick_search";
/// Same limit as the backend and the Dashboard widget; the window shows fewer.
const RECENT_MAX: usize = 12;
const RECENT_SHOWN: usize = 8;
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
        })
    }
}

pub struct QuickSearch {
    settings: Mutex<Settings>,
    registered: Mutex<Option<Shortcut>>,
    error: Mutex<String>,
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
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
    if w.is_visible().unwrap_or(false) && in_front(&w) {
        hide(app);
        return;
    }
    place(app, &w);
    let _ = w.show();
    let _ = w.unminimize();
    let _ = w.set_focus();
    // Bringing the window to the front does not give the keyboard to WebView2:
    // focus the webview too, so the search field takes typing right away.
    let _ = AsRef::<tauri::Webview>::as_ref(&w).set_focus();
    let _ = app.emit_to(LABEL, "quick-search-shown", ());
}

/// True when the window is the one in front. Not `is_focused`: that turns false when
/// the keyboard moves from the window to its own webview.
#[cfg(windows)]
fn in_front(w: &WebviewWindow) -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
    // SAFETY: no arguments; returns the foreground window handle or null.
    let front = unsafe { GetForegroundWindow() };
    w.hwnd().is_ok_and(|h| h.0 as isize == front as isize)
}
#[cfg(not(windows))]
fn in_front(w: &WebviewWindow) -> bool {
    w.is_focused().unwrap_or(false)
}

/// The window reported a focus loss. Focusing the webview inside it also reports
/// one, so it hides only if another window is really in front a moment later.
pub fn focus_lost(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(120));
        if let Some(w) = window(&app) {
            if !in_front(&w) {
                hide(&app);
            }
        }
    });
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

/// Recently used items saved in the vault, newest first. Items deleted or in the
/// trash since then are left out.
pub fn recent_ids(data: &Value) -> Vec<String> {
    let alive = |id: &str| {
        data["items"]
            .as_array()
            .is_some_and(|a| a.iter().any(|i| text(i, "id") == id && !trashed(i)))
    };
    data["settings"]["recent"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .filter(|id| alive(id))
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

/// The list with `id` first, at most `RECENT_MAX` entries; None when unchanged.
fn next_recent(current: &[String], id: &str) -> Option<Vec<String>> {
    if current.first().map(String::as_str) == Some(id) {
        return None;
    }
    let mut next = vec![id.to_owned()];
    next.extend(current.iter().filter(|x| *x != id).cloned());
    next.truncate(RECENT_MAX);
    Some(next)
}

/// Puts an item first among the recently used ones, in the encrypted vault settings.
/// A convenience: if the vault is locked or cannot be saved, nothing changes.
fn remember_item(app: &AppHandle, id: &str) {
    if !lock(&app.state::<QuickSearch>().settings).recent {
        return;
    }
    let state = app.state::<AppState>();
    let Ok(mut vault) = state.vault() else {
        return;
    };
    if !matches!(vault.call("status", json!({})), Ok(s) if s["unlocked"] == true) {
        return;
    }
    let Ok(data) = vault.call("browser_state", json!({})) else {
        return;
    };
    if let Some(next) = next_recent(&recent_ids(&data), id) {
        drop(data);
        if vault.call("settings", json!({ "recent": next })).is_ok() {
            drop(vault);
            // The main window (Dashboard widget) reloads the vault state.
            let _ = app.emit("vault-changed", ());
        }
    }
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
        return Ok(json!({"unlocked": false, "settings": settings.to_value()}));
    };
    let mut out = snapshot(&data);
    out["unlocked"] = json!(true);
    out["settings"] = settings.to_value();
    // Same colors as the main window (a preset name or custom colors).
    out["theme"] = data["settings"]["theme"].clone();
    out["recent"] = json!(if settings.recent {
        recent_ids(&data).into_iter().take(RECENT_SHOWN).collect()
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
        remember_item(&app, &id);
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
    remember_item(&app, &id);
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
    remember_item(&app, &id);
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
            remember_item(&app, id);
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

/// Empties the recently used items saved in the vault (also those of the Dashboard).
#[tauri::command]
pub fn quick_search_clear_recent(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut vault = state.vault()?;
    if vault.call("status", json!({}))?["unlocked"] != true {
        return Err("Vault bloccato".into());
    }
    vault.call("settings", json!({ "recent": [] }))?;
    drop(vault);
    let _ = app.emit("vault-changed", ());
    Ok(())
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
        let s = Settings::from_value(&json!({"enabled": false, "shortcut": "", "recent": "yes"}));
        assert!(!s.enabled);
        assert_eq!(s.shortcut, DEFAULT_SHORTCUT);
        assert!(s.recent);
        let round = Settings::from_value(&s.to_value());
        assert_eq!(round, s);
    }

    #[test]
    fn recent_items_skip_deleted_ones_and_stay_bounded() {
        let data = json!({
            "settings": {"recent": ["b", "gone", "a", 3, "t"]},
            "items": [
                {"id": "a", "type": "login"},
                {"id": "b", "type": "note"},
                {"id": "t", "type": "login", "trashed": 1700000000.0},
            ],
        });
        assert_eq!(recent_ids(&data), ["b", "a"]);
        assert!(recent_ids(&json!({})).is_empty());
        let ids = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert_eq!(next_recent(&ids(&["b", "a"]), "b"), None, "already first");
        assert_eq!(next_recent(&ids(&["b", "a"]), "a"), Some(ids(&["a", "b"])));
        let full: Vec<String> = (0..RECENT_MAX).map(|i| i.to_string()).collect();
        let next = next_recent(&full, "new").unwrap();
        assert_eq!(next.len(), RECENT_MAX);
        assert_eq!(next[0], "new");
    }
}
