//! Offer to save credentials submitted on a site: sign-up, login with an account not in
//! the vault, or a new password for a saved one. The extension (save-capture.js) sends
//! what the user typed; the app keeps it in memory (at most `MAX_WAIT`), asks in the
//! quick-fill window and writes the vault only after the user confirms. The password is
//! never sent to the window.
use crate::{browser, AppState};
use serde::Deserialize;
use serde_json::{json, Value as V};
use std::{
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};
use zeroize::Zeroizing;

const MAX_WAIT: Duration = Duration::from_secs(180);
/// After "Non ora" the same site does not ask again for a while (repeated submits).
const QUIET: Duration = Duration::from_secs(120);
const MAX_FIELDS: usize = 12;

#[derive(Clone)]
struct Field {
    label: String,
    auto: String,
    kind: String,
    value: String,
}
struct Pending {
    /// Registrable domain of the tab (epicgames.com), with the port if any.
    site: String,
    /// Address of the frame with the form, for matching saved accounts.
    url: String,
    password: Zeroizing<String>,
    old: Zeroizing<String>,
    signup: bool,
    fields: Vec<Field>,
    user: Option<usize>,
    started: Instant,
}
#[derive(Default)]
pub struct Saves {
    pending: Mutex<Option<Pending>>,
    quiet: Mutex<Vec<(String, Instant)>>,
}
#[derive(Debug, PartialEq)]
enum Mode {
    New,
    Update { id: String, title: String },
    Skip,
}

pub fn enabled() -> bool {
    crate::core::device_pref("save_logins")
        .as_bool()
        .unwrap_or(true)
}
fn text(v: &V, max: usize) -> String {
    v.as_str()
        .unwrap_or_default()
        .chars()
        .filter(|c| !c.is_control())
        .take(max)
        .collect()
}
fn site_of(top: &str) -> Option<String> {
    let u = url::Url::parse(top).ok()?;
    if u.scheme() != "https" || !u.username().is_empty() || u.password().is_some() {
        return None;
    }
    let host = u.host_str()?.trim_end_matches('.').to_ascii_lowercase();
    let base = match u.host() {
        Some(url::Host::Domain(_)) => psl::domain_str(&host)
            .map(str::to_string)
            .unwrap_or_else(|| host.trim_start_matches("www.").to_string()),
        _ => host,
    };
    Some(match u.port() {
        Some(port) => format!("{base}:{port}"),
        None => base,
    })
}
/// Group key of the main list (src/groups.ts `deriveGroupKey`) for the saved URL.
fn group_key(site: &str) -> Option<String> {
    let host = site.split(':').next().unwrap_or_default();
    let valid = regex::Regex::new(r"^[a-z0-9.-]+\.[a-z]{2,}$").ok()?;
    valid.is_match(host).then(|| format!("web:{host}"))
}

/// Validates a "save" message from the extension. `None` drops it.
fn parse(message: &V) -> Option<Pending> {
    let url = message["url"].as_str().unwrap_or_default();
    let top = message["top"].as_str().unwrap_or_default();
    if !browser::frame_allowed(url, top) {
        return None;
    }
    let password = message["password"].as_str()?;
    if password.is_empty() || password.chars().count() > 1024 || password.contains(char::is_control)
    {
        return None;
    }
    let fields: Vec<Field> = message["fields"]
        .as_array()?
        .iter()
        .take(MAX_FIELDS)
        .map(|f| Field {
            label: text(&f["label"], 60).trim().to_string(),
            auto: text(&f["auto"], 40),
            kind: text(&f["type"], 20),
            value: text(&f["value"], 200).trim().to_string(),
        })
        .collect();
    let user = message["user"]
        .as_u64()
        .map(|u| u as usize)
        .filter(|&u| u < fields.len() && !fields[u].value.is_empty());
    Some(Pending {
        site: site_of(top)?,
        url: url.to_string(),
        password: Zeroizing::new(password.to_string()),
        old: Zeroizing::new(text(&message["old"], 1024)),
        signup: message["signup"] == true,
        fields,
        user,
        started: Instant::now(),
    })
}

fn username(p: &Pending) -> &str {
    p.user.map(|u| p.fields[u].value.as_str()).unwrap_or("")
}
/// What to offer, given the vault items and the sites excluded by the user.
fn decide(items: &[V], never: &[V], p: &Pending) -> Mode {
    if never.iter().any(|s| s.as_str() == Some(p.site.as_str())) {
        return Mode::Skip;
    }
    let saved: Vec<&V> = items
        .iter()
        .filter(|i| browser::matching(i, &p.url))
        .collect();
    let pw = |i: &V| i["f"]["password"].as_str().unwrap_or_default().to_string();
    let user = username(p);
    let same_user = |i: &V| {
        !user.is_empty()
            && i["f"]["username"]
                .as_str()
                .unwrap_or_default()
                .trim()
                .eq_ignore_ascii_case(user)
    };
    let update = |i: &V| Mode::Update {
        id: i["id"].as_str().unwrap_or_default().to_string(),
        title: i["title"].as_str().unwrap_or_default().to_string(),
    };
    // Already saved: same password for this username (or for any account, if the form
    // had no username).
    if saved
        .iter()
        .any(|i| pw(i) == *p.password && (user.is_empty() || same_user(i)))
    {
        return Mode::Skip;
    }
    if !p.old.is_empty() {
        if let Some(i) = saved.iter().find(|i| pw(i) == *p.old) {
            return update(i);
        }
    }
    match saved.iter().find(|i| same_user(i)) {
        Some(i) => update(i),
        None => Mode::New,
    }
}

/// Items and excluded sites, or `None` when the vault is locked.
/// Login items and excluded sites; `None` while the vault is locked.
type VaultView = Option<(Vec<V>, Vec<V>)>;
fn vault_view(app: &tauri::AppHandle) -> Result<VaultView, String> {
    let state = app.state::<AppState>();
    let mut vault = state.vault()?;
    if vault.call("status", json!({}))?["unlocked"] != true {
        return Ok(None);
    }
    let data = vault.call("browser_state", json!({}))?;
    let items = data["items"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter(|i| i["type"] == "login" && i["trashed"].is_null())
                .cloned()
                .collect()
        })
        .unwrap_or_default();
    let never = data["settings"]["never_save"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    Ok(Some((items, never)))
}
fn changed(app: &tauri::AppHandle) {
    let _ = app.emit_to("quick-fill", "save-changed", ());
}
fn quiet(app: &tauri::AppHandle, site: &str) -> bool {
    let saves = app.state::<Saves>();
    let mut quiet = saves.quiet.lock().unwrap_or_else(|e| e.into_inner());
    quiet.retain(|(_, at)| at.elapsed() < QUIET);
    quiet.iter().any(|(s, _)| s == site)
}
pub fn active(app: &tauri::AppHandle) -> bool {
    app.state::<Saves>()
        .pending
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_ref()
        .is_some_and(|p| p.started.elapsed() < MAX_WAIT)
}
/// Drops a pending request (a new quick-fill request replaces it).
pub fn clear(app: &tauri::AppHandle) {
    if app
        .state::<Saves>()
        .pending
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
        .is_some()
    {
        changed(app);
    }
}

/// "save" message from the extension.
pub fn receive(app: &tauri::AppHandle, message: &V) {
    if !enabled() {
        return;
    }
    let Some(pending) = parse(message) else {
        return;
    };
    if quiet(app, &pending.site) {
        return;
    }
    // Decided now when unlocked; a locked vault asks to unlock first, then decides.
    if let Ok(Some((items, never))) = vault_view(app) {
        if decide(&items, &never, &pending) == Mode::Skip {
            return;
        }
    }
    *app.state::<Saves>()
        .pending
        .lock()
        .unwrap_or_else(|e| e.into_inner()) = Some(pending);
    browser::show(app);
    changed(app);
}

#[tauri::command]
pub fn browser_save_state(app: tauri::AppHandle) -> Result<V, String> {
    let saves = app.state::<Saves>();
    let mut slot = saves.pending.lock().unwrap_or_else(|e| e.into_inner());
    if slot
        .as_ref()
        .is_some_and(|p| p.started.elapsed() >= MAX_WAIT)
    {
        // Unanswered for too long: forget the credentials and close the panel.
        *slot = None;
        drop(slot);
        browser::hide(&app);
        return Ok(json!({"active": false}));
    }
    let Some(p) = slot.as_ref() else {
        return Ok(json!({"active": false}));
    };
    let mut result = json!({
        "active": true,
        "site": p.site,
        "unlocked": false,
        "signup": p.signup,
        "expires": MAX_WAIT.saturating_sub(p.started.elapsed()).as_secs(),
    });
    let Some((items, never)) = vault_view(&app)? else {
        return Ok(result);
    };
    match decide(&items, &never, p) {
        Mode::Skip => {
            // Unlocked and found already saved: nothing to ask.
            *slot = None;
            drop(slot);
            browser::hide(&app);
            return Ok(json!({"active": false}));
        }
        Mode::New => {
            result["mode"] = json!("new");
            result["title"] = json!(p.site);
        }
        Mode::Update { title, .. } => {
            result["mode"] = json!("update");
            result["title"] = json!(title);
        }
    }
    result["unlocked"] = json!(true);
    result["user"] = json!(p.user);
    result["fields"] = json!(p
        .fields
        .iter()
        .map(|f| json!({"label": f.label, "auto": f.auto, "type": f.kind, "value": f.value}))
        .collect::<Vec<_>>());
    Ok(result)
}

#[derive(Deserialize)]
pub struct Note {
    index: usize,
    label: String,
}
/// Saves the new account (or the new password) chosen in the window.
#[tauri::command]
pub fn browser_save_approve(
    app: tauri::AppHandle,
    title: String,
    username: String,
    notes: Vec<Note>,
) -> Result<V, String> {
    let saves = app.state::<Saves>();
    let mut slot = saves.pending.lock().unwrap_or_else(|e| e.into_inner());
    let p = slot
        .take()
        .filter(|p| p.started.elapsed() < MAX_WAIT)
        .ok_or("Richiesta di salvataggio scaduta.")?;
    drop(slot);
    let (items, never) = vault_view(&app)?.ok_or("Vault bloccato")?;
    let state = app.state::<AppState>();
    let mut logo = None;
    let saved = match decide(&items, &never, &p) {
        Mode::Skip => json!({"saved": false}),
        Mode::Update { id, title } => {
            let item = items
                .iter()
                .find(|i| i["id"] == id.as_str())
                .ok_or("L’account da aggiornare non esiste più.")?;
            let mut f = item["f"].clone();
            f["password"] = json!(p.password.as_str());
            state.vault()?.call("item", json!({"id": id, "f": f}))?;
            json!({"saved": true, "title": title})
        }
        Mode::New => {
            let title: String = title
                .trim()
                .chars()
                .filter(|c| !c.is_control())
                .take(120)
                .collect();
            let title = if title.is_empty() {
                p.site.clone()
            } else {
                title
            };
            let username: String = username
                .trim()
                .chars()
                .filter(|c| !c.is_control())
                .take(256)
                .collect();
            let lines: Vec<String> = notes
                .iter()
                .filter_map(|n| {
                    let field = p.fields.get(n.index)?;
                    let label: String = n
                        .label
                        .trim()
                        .chars()
                        .filter(|c| !c.is_control())
                        .take(60)
                        .collect();
                    Some(if label.is_empty() {
                        field.value.clone()
                    } else {
                        format!("{label}: {}", field.value)
                    })
                })
                .collect();
            let mut body = json!({
                "type": "login",
                "title": title,
                "f": {
                    "url": format!("https://{}", p.site),
                    "username": username,
                    "password": p.password.as_str(),
                    "totp": "",
                },
                "notes": lines.join("\n"),
            });
            if let Some(key) = group_key(&p.site) {
                body["group"] = json!({"key": key, "name": p.site, "src": "web"});
                logo = Some(key);
            }
            state.vault()?.call("item", body)?;
            json!({"saved": true, "title": title})
        }
    };
    let _ = app.emit("vault-changed", ());
    changed(&app);
    browser::hide(&app);
    // Site logo as when saving from the main window (only if logos are on: group_logo
    // checks the setting). In the background: it may take a few seconds of network.
    if let Some(key) = logo {
        let handle = app.clone();
        std::thread::spawn(move || {
            let state = handle.state::<AppState>();
            let found = state
                .vault()
                .ok()
                .and_then(|mut v| v.call("group_logo", json!({"key": key})).ok())
                .is_some_and(|r| r["found"] == true);
            if found {
                let _ = handle.emit("vault-changed", ());
            }
        });
    }
    Ok(saved)
}

/// "Non ora" (`never` false) or "Mai per questo sito" (`never` true).
#[tauri::command]
pub fn browser_save_dismiss(app: tauri::AppHandle, never: bool) -> Result<(), String> {
    let saves = app.state::<Saves>();
    let pending = saves
        .pending
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take();
    // "Non ora" quiets the site for a while; "Mai" is permanent on its own, and must not
    // leave a pause behind if the user removes the site from the list right away.
    if let Some(p) = pending.as_ref().filter(|_| !never) {
        saves
            .quiet
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .push((p.site.clone(), Instant::now()));
    }
    changed(&app);
    browser::hide(&app);
    let Some(p) = pending.filter(|_| never) else {
        return Ok(());
    };
    let (_, mut list) = vault_view(&app)?.ok_or("Vault bloccato")?;
    if !list.iter().any(|s| s.as_str() == Some(p.site.as_str())) {
        list.push(json!(p.site));
    }
    set_never(&app, list)
}
fn set_never(app: &tauri::AppHandle, list: Vec<V>) -> Result<(), String> {
    app.state::<AppState>()
        .vault()?
        .call("settings", json!({"never_save": list}))?;
    let _ = app.emit("vault-changed", ());
    Ok(())
}

/// Settings page: the switch (per device) and the excluded sites (in the vault).
#[tauri::command]
pub fn browser_save_settings(app: tauri::AppHandle) -> Result<V, String> {
    let never = vault_view(&app)?.map(|(_, never)| never);
    Ok(json!({"enabled": enabled(), "never": never}))
}
#[tauri::command]
pub fn browser_save_set_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    crate::core::set_device_pref("save_logins", json!(enabled))?;
    if !enabled {
        clear(&app);
    }
    // The extension stops capturing as soon as it knows.
    browser::broadcast(&app, json!({"kind": "config", "save": enabled}));
    Ok(())
}
#[tauri::command]
pub fn browser_save_forget(app: tauri::AppHandle, site: String) -> Result<(), String> {
    let (_, list) = vault_view(&app)?.ok_or("Vault bloccato")?;
    // Removed from the exclusions: the next submit on the site asks again.
    app.state::<Saves>()
        .quiet
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .retain(|(s, _)| *s != site);
    set_never(
        &app,
        list.into_iter()
            .filter(|s| s.as_str() != Some(site.as_str()))
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(password: &str, fields: V, user: i64) -> V {
        json!({
            "url": "https://accounts.example.com/signup",
            "top": "https://www.example.com/register",
            "password": password,
            "old": "",
            "signup": true,
            "user": user,
            "fields": fields,
        })
    }
    fn login(id: &str, username: &str, password: &str) -> V {
        json!({"id": id, "type": "login", "title": id, "trashed": null,
            "f": {"url": "https://example.com", "username": username, "password": password}})
    }

    #[test]
    fn site_is_the_registrable_domain_of_the_tab() {
        assert_eq!(
            site_of("https://store.epicgames.com/it").as_deref(),
            Some("epicgames.com")
        );
        assert_eq!(
            site_of("https://www.example.co.uk/").as_deref(),
            Some("example.co.uk")
        );
        assert_eq!(
            site_of("https://alice.github.io/").as_deref(),
            Some("alice.github.io")
        );
        assert_eq!(
            site_of("https://example.com:8443/").as_deref(),
            Some("example.com:8443")
        );
        assert_eq!(site_of("http://example.com/"), None);
        assert_eq!(site_of("https://user@example.com/"), None);
        assert_eq!(
            group_key("epicgames.com").as_deref(),
            Some("web:epicgames.com")
        );
        assert_eq!(
            group_key("example.com:8443").as_deref(),
            Some("web:example.com")
        );
        assert_eq!(group_key("127.0.0.1"), None);
    }

    #[test]
    fn messages_are_validated() {
        let fields = json!([{"label": "Email", "auto": "email", "type": "email", "value": " a@example.com "}]);
        let p = parse(&message("sëgreto🔑", fields.clone(), 0)).unwrap();
        assert_eq!(p.site, "example.com");
        assert_eq!(username(&p), "a@example.com");
        assert!(p.signup);
        // Frame of another site, plain HTTP, empty or control-character passwords.
        let mut other = message("x", fields.clone(), 0);
        other["url"] = json!("https://evil.test/");
        assert!(parse(&other).is_none());
        let mut http = message("x", fields.clone(), 0);
        http["top"] = json!("http://www.example.com/");
        assert!(parse(&http).is_none());
        assert!(parse(&message("", fields.clone(), 0)).is_none());
        assert!(parse(&message("a\u{0}b", fields.clone(), 0)).is_none());
        assert!(parse(&message(&"x".repeat(1025), fields.clone(), 0)).is_none());
        // Out-of-range user index, long values and too many fields are bounded.
        assert_eq!(parse(&message("x", fields, 5)).unwrap().user, None);
        let many: Vec<V> = (0..20)
            .map(|i| json!({"label": "L".repeat(100), "type": "text", "value": format!("{i}{}", "v".repeat(300))}))
            .collect();
        let p = parse(&message("x", json!(many), 0)).unwrap();
        assert_eq!(p.fields.len(), MAX_FIELDS);
        assert_eq!(p.fields[0].label.chars().count(), 60);
        assert_eq!(p.fields[0].value.chars().count(), 200);
    }

    #[test]
    fn decides_new_update_or_nothing() {
        let fields = json!([{"label": "Email", "type": "email", "value": "a@example.com"}]);
        let p = parse(&message("nuova-pw", fields.clone(), 0)).unwrap();
        // Nothing saved for the site, or only for another site: new account.
        assert_eq!(decide(&[], &[], &p), Mode::New);
        let mut elsewhere = login("x", "a@example.com", "nuova-pw");
        elsewhere["f"]["url"] = json!("https://example.org");
        assert_eq!(decide(&[elsewhere], &[], &p), Mode::New);
        // Same username and password: already saved.
        assert_eq!(
            decide(&[login("1", "A@Example.com", "nuova-pw")], &[], &p),
            Mode::Skip
        );
        // Same username, different password: update.
        assert_eq!(
            decide(&[login("1", "a@example.com", "vecchia")], &[], &p),
            Mode::Update {
                id: "1".into(),
                title: "1".into()
            }
        );
        // Another username on the same site: a second account.
        assert_eq!(
            decide(&[login("1", "b@example.com", "altra")], &[], &p),
            Mode::New
        );
        // Trashed items are not passed in (vault_view filters them); excluded site: nothing.
        assert_eq!(decide(&[], &[json!("example.com")], &p), Mode::Skip);
        // Password-only step: any saved account with that password means already saved.
        let only = parse(&message("nuova-pw", json!([]), -1)).unwrap();
        assert_eq!(
            decide(&[login("1", "chi", "nuova-pw")], &[], &only),
            Mode::Skip
        );
        assert_eq!(decide(&[login("1", "chi", "altra")], &[], &only), Mode::New);
        // Change form: the account with the current password gets the new one.
        let mut change = message("nuova-pw", json!([]), -1);
        change["old"] = json!("vecchia");
        let change = parse(&change).unwrap();
        assert_eq!(
            decide(&[login("2", "chi", "vecchia")], &[], &change),
            Mode::Update {
                id: "2".into(),
                title: "2".into()
            }
        );
    }
}
