//! Interface zoom shared by all windows (main, quick-fill, browser-setup).
//!
//! Uses the native WebView2 zoom, so CSS sees a narrower viewport and the existing
//! responsive layout adapts. The level is a per-device preference stored in the
//! unencrypted device config (it must work on the lock screen too), never in the
//! vault.
use crate::core;
use serde_json::json;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, LogicalSize, Manager, WebviewWindow};

/// Same steps as common browsers.
pub const LEVELS: [f64; 11] = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];

pub struct Zoom(pub Mutex<f64>);

pub fn clamp(f: f64) -> f64 {
    if f.is_finite() {
        f.clamp(LEVELS[0], LEVELS[LEVELS.len() - 1])
    } else {
        1.0
    }
}

/// Next level above (`up`) or below the current factor; stays at the bounds.
pub fn step(current: f64, up: bool) -> f64 {
    const EPS: f64 = 1e-6;
    let next = if up {
        LEVELS.iter().copied().find(|l| *l > current + EPS)
    } else {
        LEVELS.iter().rev().copied().find(|l| *l < current - EPS)
    };
    next.unwrap_or_else(|| clamp(current))
}

pub fn load() -> f64 {
    core::device_pref("zoom").as_f64().map(clamp).unwrap_or(1.0)
}

pub fn current(app: &AppHandle) -> f64 {
    app.try_state::<Zoom>()
        .map(|z| *z.0.lock().unwrap_or_else(|e| e.into_inner()))
        .unwrap_or(1.0)
}

/// Applies the zoom to one window. The quick-fill window is not resizable, so its
/// size follows the zoom to keep the whole panel visible.
pub fn apply_to(window: &WebviewWindow, factor: f64) {
    let _ = window.set_zoom(factor);
    let fixed = match window.label() {
        "quick-fill" => Some(crate::browser::QUICK_FILL_SIZE),
        crate::quick_search::LABEL => Some(crate::quick_search::SIZE),
        _ => None,
    };
    if let Some((w, h)) = fixed {
        let _ = window.set_size(LogicalSize::new(w * factor, h * factor));
    }
}

pub fn apply_all(app: &AppHandle, factor: f64) {
    for window in app.webview_windows().values() {
        apply_to(window, factor);
    }
}

#[tauri::command]
pub fn zoom_get(app: AppHandle) -> f64 {
    current(&app)
}

/// `action`: "in", "out", "reset" or "set" (with `value`). Applies the new level to
/// every window, notifies them with `zoom-changed` and saves it for this device.
#[tauri::command]
pub fn zoom_change(app: AppHandle, action: String, value: Option<f64>) -> Result<f64, String> {
    let state = app.state::<Zoom>();
    let mut zoom = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let next = match action.as_str() {
        "in" => step(*zoom, true),
        "out" => step(*zoom, false),
        "reset" => 1.0,
        "set" => clamp(value.ok_or("Valore di zoom mancante")?),
        _ => return Err("Azione di zoom non valida".into()),
    };
    *zoom = next;
    drop(zoom);
    apply_all(&app, next);
    let _ = app.emit("zoom-changed", next);
    core::set_device_pref("zoom", json!(next))
        .map_err(|e| format!("Zoom applicato ma non salvato: {e}"))?;
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn steps_follow_levels_and_stop_at_bounds() {
        assert_eq!(step(1.0, true), 1.1);
        assert_eq!(step(1.0, false), 0.9);
        assert_eq!(step(2.0, true), 2.0);
        assert_eq!(step(0.5, false), 0.5);
        // A value between levels moves to the nearest level in that direction.
        assert_eq!(step(1.2, true), 1.25);
        assert_eq!(step(1.2, false), 1.1);
        assert_eq!(clamp(9.0), 2.0);
        assert_eq!(clamp(f64::NAN), 1.0);
    }
}
