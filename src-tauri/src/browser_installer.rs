use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::Manager;

struct Browser {
    id: &'static str,
    name: &'static str,
    executable: &'static str,
    paths: &'static [&'static str],
    page: &'static str,
}
const BROWSERS: &[Browser] = &[
    Browser {
        id: "chrome",
        name: "Google Chrome",
        executable: "chrome.exe",
        paths: &["Google/Chrome/Application/chrome.exe"],
        page: "chrome://extensions/",
    },
    Browser {
        id: "edge",
        name: "Microsoft Edge",
        executable: "msedge.exe",
        paths: &["Microsoft/Edge/Application/msedge.exe"],
        page: "edge://extensions/",
    },
    Browser {
        id: "brave",
        name: "Brave",
        executable: "brave.exe",
        paths: &["BraveSoftware/Brave-Browser/Application/brave.exe"],
        page: "brave://extensions/",
    },
    Browser {
        id: "opera",
        name: "Opera",
        executable: "opera.exe",
        paths: &[
            "Programs/Opera/launcher.exe",
            "Opera/launcher.exe",
            "Programs/Opera/opera.exe",
            "Opera/opera.exe",
        ],
        page: "opera://extensions/",
    },
    Browser {
        id: "vivaldi",
        name: "Vivaldi",
        executable: "vivaldi.exe",
        paths: &["Vivaldi/Application/vivaldi.exe"],
        page: "vivaldi://extensions/",
    },
    Browser {
        id: "firefox",
        name: "Mozilla Firefox",
        executable: "firefox.exe",
        paths: &["Mozilla Firefox/firefox.exe"],
        page: "about:debugging#/runtime/this-firefox",
    },
];
fn browser(id: &str) -> Result<&'static Browser, String> {
    BROWSERS
        .iter()
        .find(|b| b.id == id)
        .ok_or("Browser non supportato".into())
}
fn executable(browser: &Browser) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        use winreg::{
            enums::{
                HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY,
            },
            RegKey,
        };
        for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
            for view in [KEY_WOW64_64KEY, KEY_WOW64_32KEY] {
                if let Ok(key) = RegKey::predef(hive).open_subkey_with_flags(
                    format!(
                        "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{}",
                        browser.executable
                    ),
                    KEY_READ | view,
                ) {
                    if let Ok(path) = key.get_value::<String, _>("") {
                        let path = PathBuf::from(path.trim_matches('"'));
                        if path.is_file() {
                            return Some(path);
                        }
                    }
                }
            }
        }
    }
    for root in ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(root) = std::env::var_os(root) {
            for suffix in browser.paths {
                let path = PathBuf::from(&root).join(suffix);
                if path.is_file() {
                    return Some(path);
                }
            }
        }
    }
    None
}
fn extension_directory(id: &str) -> Result<PathBuf, String> {
    browser(id)?;
    let path = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .with_file_name("browser-extension")
        .join(if id == "firefox" {
            "firefox"
        } else {
            "chromium"
        });
    if !path.join("manifest.json").is_file() {
        return Err("Estensione non trovata. Installa il setup completo aggiornato.".into());
    }
    Ok(path)
}
#[tauri::command]
pub fn browser_setup_status() -> Value {
    let helper = std::env::current_exe()
        .ok()
        .map(|p| p.with_file_name("jesse-browser-host.exe").is_file())
        .unwrap_or(false);
    json!({"helper":helper,"browsers":BROWSERS.iter().map(|b|json!({"id":b.id,"name":b.name,"page":b.page,"installed":executable(b).is_some(),"folder":extension_directory(b.id).ok().map(|p|p.to_string_lossy().to_string())})).collect::<Vec<_>>()})
}
fn setup_open_impl(id: String) -> Result<Value, String> {
    let browser = browser(&id)?;
    let executable = executable(browser).ok_or(
        "Browser non rilevato. Puoi caricare l'estensione dalla cartella inclusa nel setup.",
    )?;
    let directory = extension_directory(&id)?;
    crate::browser::browser_install()?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        crate::browser_navigation::open(&executable, &id, browser.page)?;
        let mut explorer = std::process::Command::new("explorer.exe");
        if id == "firefox" {
            explorer
                .arg("/select,")
                .arg(directory.join("manifest.json"));
        } else {
            explorer.arg(&directory);
        }
        explorer
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| format!("Impossibile aprire la cartella: {e}"))?;
    }
    Ok(json!({"folder":directory.to_string_lossy(),"firefox":id=="firefox"}))
}
#[tauri::command]
pub async fn browser_setup_open(id: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || setup_open_impl(id))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn browser_setup_show(app: tauri::AppHandle) -> Result<(), String> {
    show(&app)
}
pub fn show(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("browser-setup") {
        window.show().map_err(|e| e.to_string())?;
        return window.set_focus().map_err(|e| e.to_string());
    }
    tauri::WebviewWindowBuilder::new(
        app,
        "browser-setup",
        tauri::WebviewUrl::App("index.html?browser-setup".into()),
    )
    .title("JesseArchive · Configura i browser")
    .inner_size(640., 740.)
    .min_inner_size(520., 560.)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn browser_targets_are_fixed_and_complete() {
        assert_eq!(BROWSERS.len(), 6);
        for b in BROWSERS {
            assert!(b.page.starts_with(&format!("{}:", b.id)) || b.id == "firefox");
            assert_eq!(browser(b.id).unwrap().name, b.name);
        }
        for value in [
            "",
            "chrome --load-extension=evil",
            "https://example.com",
            "../firefox",
            "Chrome",
        ] {
            assert!(browser(value).is_err());
        }
    }
}
