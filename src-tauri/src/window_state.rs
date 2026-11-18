//! Size, position and maximized/fullscreen state of the main window, remembered
//! across restarts.
//!
//! Stored as the per-device preference `window` in the unencrypted device config
//! (`%APPDATA%/JesseArchive/config.json`), next to zoom and language: it describes
//! the screen, not the vault, and must apply before unlocking. It contains only
//! numbers and two flags.
//!
//! The main window starts hidden (`"visible": false` in tauri.conf.json) and is
//! shown by `show_main` once the saved state is applied, so it never flashes at the
//! default size. With `--background` it stays hidden and the state is applied the
//! first time it is shown (maximizing a hidden window would show it).
use crate::core;
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

const KEY: &str = "window";
/// Same as minWidth/minHeight of the main window in tauri.conf.json.
const MIN_SIZE: (u32, u32) = (980, 640);
/// Part of the window that must be on a screen for the saved position to be used.
const MIN_VISIBLE: (i64, i64) = (120, 60);

/// Bounds of the window when neither maximized nor fullscreen, in physical pixels.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Saved {
    /// None when the position should not be used (no screen there any more).
    pub bounds: Option<Bounds>,
    pub size: Option<(u32, u32)>,
    pub maximized: bool,
    pub fullscreen: bool,
}

/// Restored bounds seen last (tracked on resize/move: the size of a maximized
/// window is not the one to restore) and state still to apply on first show.
#[derive(Default)]
pub struct WindowState {
    normal: Mutex<Option<Bounds>>,
    pending: Mutex<Option<Saved>>,
}

/// Screen rectangle: x, y, width, height in physical pixels.
pub type Screen = (i32, i32, u32, u32);

fn int(v: &Value, k: &str) -> Option<i64> {
    v.get(k).and_then(Value::as_i64)
}

/// Turns the stored preference into something safe to apply on the current screens.
/// Anything missing, damaged or out of range is dropped: the window then opens at
/// the default size, centered.
pub fn sanitize(stored: &Value, screens: &[Screen]) -> Option<Saved> {
    if !stored.is_object() {
        return None;
    }
    let flag = |k: &str| stored.get(k).and_then(Value::as_bool).unwrap_or(false);
    let largest = screens
        .iter()
        .fold((0u32, 0u32), |(w, h), s| (w.max(s.2), h.max(s.3)));
    let size = match (int(stored, "width"), int(stored, "height")) {
        (Some(w), Some(h)) if w > 0 && h > 0 && w <= 100_000 && h <= 100_000 => {
            let (mw, mh) = if largest.0 > 0 {
                largest
            } else {
                (u32::MAX, u32::MAX)
            };
            Some((
                (w as u32).clamp(MIN_SIZE.0, mw.max(MIN_SIZE.0)),
                (h as u32).clamp(MIN_SIZE.1, mh.max(MIN_SIZE.1)),
            ))
        }
        _ => None,
    };
    let bounds = match (size, int(stored, "x"), int(stored, "y")) {
        (Some((width, height)), Some(x), Some(y))
            if x.abs() <= 1_000_000 && y.abs() <= 1_000_000 =>
        {
            let on_screen = screens.iter().any(|&(sx, sy, sw, sh)| {
                let (sx, sy) = (sx as i64, sy as i64);
                let left = x.max(sx);
                let right = (x + width as i64).min(sx + sw as i64);
                let top = y.max(sy);
                let bottom = (y + height as i64).min(sy + sh as i64);
                right - left >= MIN_VISIBLE.0 && bottom - top >= MIN_VISIBLE.1
            });
            on_screen.then_some(Bounds {
                x: x as i32,
                y: y as i32,
                width,
                height,
            })
        }
        _ => None,
    };
    Some(Saved {
        bounds,
        size,
        maximized: flag("maximized"),
        fullscreen: flag("fullscreen"),
    })
}

fn is_normal(w: &WebviewWindow) -> bool {
    !w.is_maximized().unwrap_or(false)
        && !w.is_minimized().unwrap_or(false)
        && !w.is_fullscreen().unwrap_or(false)
}

fn current_bounds(w: &WebviewWindow) -> Option<Bounds> {
    let pos = w.outer_position().ok()?;
    let size = w.inner_size().ok()?;
    Some(Bounds {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
    })
}

/// Called on resize/move of the main window: remembers the bounds to restore.
pub fn track(app: &AppHandle, w: &WebviewWindow) {
    if !w.is_visible().unwrap_or(false) || !is_normal(w) {
        return;
    }
    if let (Some(state), Some(b)) = (app.try_state::<WindowState>(), current_bounds(w)) {
        *state.normal.lock().unwrap_or_else(|e| e.into_inner()) = Some(b);
    }
}

/// Saves the current state. Only while the window is visible: a window hidden in
/// the tray was already saved when it was closed.
pub fn save(app: &AppHandle) {
    let Some(w) = app.get_webview_window("main") else {
        return;
    };
    if !w.is_visible().unwrap_or(false) {
        return;
    }
    let tracked = app
        .try_state::<WindowState>()
        .and_then(|s| *s.normal.lock().unwrap_or_else(|e| e.into_inner()));
    let bounds = if is_normal(&w) {
        current_bounds(&w).or(tracked)
    } else {
        tracked
    };
    let mut value = json!({
        "maximized": w.is_maximized().unwrap_or(false),
        "fullscreen": w.is_fullscreen().unwrap_or(false),
    });
    if let Some(b) = bounds {
        value["x"] = json!(b.x);
        value["y"] = json!(b.y);
        value["width"] = json!(b.width);
        value["height"] = json!(b.height);
    }
    let _ = core::set_device_pref(KEY, value);
}

fn apply(w: &WebviewWindow, saved: Saved) {
    match (saved.bounds, saved.size) {
        (Some(b), _) => {
            let _ = w.set_size(PhysicalSize::new(b.width, b.height));
            let _ = w.set_position(PhysicalPosition::new(b.x, b.y));
        }
        (None, Some((width, height))) => {
            let _ = w.set_size(PhysicalSize::new(width, height));
            let _ = w.center();
        }
        (None, None) => (),
    }
    if saved.fullscreen {
        let _ = w.set_fullscreen(true);
    } else if saved.maximized {
        let _ = w.maximize();
    }
}

/// Reads the saved state at startup. It is applied by `show_main`.
pub fn load(app: &AppHandle) {
    let Some(w) = app.get_webview_window("main") else {
        return;
    };
    let screens: Vec<Screen> = w
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let (p, s) = (m.position(), m.size());
            (p.x, p.y, s.width, s.height)
        })
        .collect();
    let saved = sanitize(&core::device_pref(KEY), &screens);
    if let Some(state) = app.try_state::<WindowState>() {
        *state.normal.lock().unwrap_or_else(|e| e.into_inner()) = saved.and_then(|s| s.bounds);
        *state.pending.lock().unwrap_or_else(|e| e.into_inner()) = saved;
    }
}

/// Shows the main window (applying the saved state the first time) and focuses it.
pub fn show_main(app: &AppHandle) {
    let Some(w) = app.get_webview_window("main") else {
        return;
    };
    let pending = app
        .try_state::<WindowState>()
        .and_then(|s| s.pending.lock().unwrap_or_else(|e| e.into_inner()).take());
    if let Some(saved) = pending {
        apply(&w, saved);
    }
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_focus();
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCREEN: Screen = (0, 0, 1920, 1080);

    #[test]
    fn restores_bounds_and_flags_on_a_present_screen() {
        let s = sanitize(
            &json!({"x": 100, "y": 50, "width": 1500, "height": 900, "maximized": true}),
            &[SCREEN],
        )
        .expect("valid");
        assert_eq!(
            s.bounds,
            Some(Bounds {
                x: 100,
                y: 50,
                width: 1500,
                height: 900
            })
        );
        assert!(s.maximized && !s.fullscreen);
    }

    #[test]
    fn missing_or_damaged_values_fall_back_to_defaults() {
        assert_eq!(sanitize(&Value::Null, &[SCREEN]), None);
        assert_eq!(sanitize(&json!("text"), &[SCREEN]), None);
        let s = sanitize(&json!({"width": "big", "maximized": "yes"}), &[SCREEN]).expect("object");
        assert_eq!((s.bounds, s.size, s.maximized), (None, None, false));
        let s = sanitize(
            &json!({"x": 0, "y": 0, "width": -5, "height": 900}),
            &[SCREEN],
        )
        .unwrap();
        assert_eq!((s.bounds, s.size), (None, None));
    }

    #[test]
    fn size_is_kept_within_the_minimum_and_the_largest_screen() {
        let s = sanitize(
            &json!({"x": 0, "y": 0, "width": 200, "height": 9000}),
            &[SCREEN],
        )
        .unwrap();
        assert_eq!(s.size, Some((980, 1080)));
    }

    #[test]
    fn position_on_a_screen_that_is_gone_is_dropped_but_size_kept() {
        // Saved on a second monitor to the right that is now unplugged.
        let s = sanitize(
            &json!({"x": 2500, "y": 100, "width": 1200, "height": 800}),
            &[SCREEN],
        )
        .unwrap();
        assert_eq!(s.bounds, None);
        assert_eq!(s.size, Some((1200, 800)));
        // Barely touching the screen is not enough either.
        let s = sanitize(
            &json!({"x": 1900, "y": 100, "width": 1200, "height": 800}),
            &[SCREEN],
        )
        .unwrap();
        assert_eq!(s.bounds, None);
        // With the second monitor present the position is used.
        let s = sanitize(
            &json!({"x": 2500, "y": 100, "width": 1200, "height": 800}),
            &[SCREEN, (1920, 0, 2560, 1440)],
        )
        .unwrap();
        assert!(s.bounds.is_some());
    }
}
