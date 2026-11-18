//! Interface language: a per-device preference (`lang` in the device config, like
//! the zoom) chosen in the UI. The frontend translates its own text (src/i18n.ts);
//! the backend only needs it for the native parts: tray menu and window titles.
use crate::core;
use serde_json::json;
use tauri::menu::MenuItem;
use tauri::{AppHandle, Emitter, Manager, Wry};

pub const LANGS: [&str; 10] = ["it", "en", "es", "fr", "de", "pt", "ru", "zh", "ja", "ko"];

/// Native strings: [tray open, tray lock, tray quit, quick-fill title, browser-setup title].
pub fn native(lang: &str) -> [&'static str; 5] {
    match lang {
        "en" => [
            "Open Jesse's Archive",
            "Lock the vault",
            "Quit",
            "JesseArchive · Quick fill",
            "JesseArchive · Set up browsers",
        ],
        "es" => [
            "Abrir Jesse's Archive",
            "Bloquear la bóveda",
            "Salir",
            "JesseArchive · Relleno rápido",
            "JesseArchive · Configurar navegadores",
        ],
        "fr" => [
            "Ouvrir Jesse's Archive",
            "Verrouiller le coffre",
            "Quitter",
            "JesseArchive · Remplissage rapide",
            "JesseArchive · Configurer les navigateurs",
        ],
        "de" => [
            "Jesse's Archive öffnen",
            "Tresor sperren",
            "Beenden",
            "JesseArchive · Schnelles Ausfüllen",
            "JesseArchive · Browser einrichten",
        ],
        "pt" => [
            "Abrir o Jesse's Archive",
            "Bloquear o cofre",
            "Sair",
            "JesseArchive · Preenchimento rápido",
            "JesseArchive · Configurar navegadores",
        ],
        "ru" => [
            "Открыть Jesse's Archive",
            "Заблокировать хранилище",
            "Выход",
            "JesseArchive · Быстрое заполнение",
            "JesseArchive · Настройка браузеров",
        ],
        "zh" => [
            "打开 Jesse's Archive",
            "锁定保险库",
            "退出",
            "JesseArchive · 快速填充",
            "JesseArchive · 配置浏览器",
        ],
        "ja" => [
            "Jesse's Archive を開く",
            "保管庫をロック",
            "終了",
            "JesseArchive · クイック入力",
            "JesseArchive · ブラウザーの設定",
        ],
        "ko" => [
            "Jesse's Archive 열기",
            "보관함 잠금",
            "종료",
            "JesseArchive · 빠른 입력",
            "JesseArchive · 브라우저 설정",
        ],
        _ => [
            "Apri Jesse's Archive",
            "Blocca il vault",
            "Esci",
            "JesseArchive · Inserimento rapido",
            "JesseArchive · Configura i browser",
        ],
    }
}

/// Saved language, or Italian until the UI saves the detected one on first start.
pub fn current() -> String {
    core::device_pref("lang")
        .as_str()
        .filter(|l| LANGS.contains(l))
        .unwrap_or("it")
        .to_string()
}

/// Tray menu entries, kept to relabel them when the language changes.
pub struct Tray(pub [MenuItem<Wry>; 3]);

pub fn apply_native(app: &AppHandle, lang: &str) {
    let text = native(lang);
    if let Some(tray) = app.try_state::<Tray>() {
        for (item, label) in tray.0.iter().zip(text) {
            let _ = item.set_text(label);
        }
    }
    if let Some(w) = app.get_webview_window("quick-fill") {
        let _ = w.set_title(text[3]);
    }
    if let Some(w) = app.get_webview_window("browser-setup") {
        let _ = w.set_title(text[4]);
    }
}

#[tauri::command]
pub fn language_get() -> Option<String> {
    core::device_pref("lang")
        .as_str()
        .filter(|l| LANGS.contains(l))
        .map(str::to_string)
}

#[tauri::command]
pub fn language_set(app: AppHandle, lang: String) -> Result<(), String> {
    if !LANGS.contains(&lang.as_str()) {
        return Err("Lingua non supportata".into());
    }
    core::set_device_pref("lang", json!(lang))?;
    apply_native(&app, &lang);
    let _ = app.emit("language-changed", &lang);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_language_has_native_strings() {
        for lang in LANGS {
            assert!(native(lang).iter().all(|s| !s.is_empty()), "{lang}");
        }
        assert_eq!(native("xx"), native("it"));
        assert_ne!(native("en"), native("it"));
    }
}
