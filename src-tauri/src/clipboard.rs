//! Clipboard for secrets, shared by the main window (`copy_secret`,
//! `clear_secret_if_unchanged`) and the Quick Search, which copies in the backend so
//! passwords never reach its webview.
use zeroize::Zeroizing;

/// Puts text on the clipboard (Unicode).
pub fn set(text: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        clipboard_win::set_clipboard(clipboard_win::formats::Unicode, text)
            .map_err(|e| format!("Impossibile copiare negli appunti: {e}"))
    }
    #[cfg(not(windows))]
    {
        let _ = text;
        Err("Clipboard disponibile nella build Windows".into())
    }
}

/// Empties the clipboard only if it still holds `expected`: something the user
/// copied afterwards is left alone.
pub fn clear_if_unchanged(expected: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        use clipboard_win::{formats, Clipboard, Getter, Setter};
        // The clipboard must remain open for the entire compare-and-clear
        // operation, preventing a separate app changing it between calls.
        let _guard = Clipboard::new_attempts(10)
            .map_err(|e| format!("Impossibile accedere agli appunti: {e}"))?;
        let mut current = Zeroizing::new(String::new());
        if formats::Unicode.read_clipboard(&mut *current).is_ok() && *current == expected {
            formats::Unicode
                .write_clipboard(&String::new())
                .map_err(|e| format!("Impossibile pulire gli appunti: {e}"))?;
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = expected;
        Ok(())
    }
}

/// Copies and, if `seconds` > 0, clears the clipboard after that delay unless the
/// user copied something else meanwhile. The copy waiting for the comparison is
/// wiped from memory when the timer ends.
pub fn copy_with_timeout(text: Zeroizing<String>, seconds: u64) -> Result<(), String> {
    set(&text)?;
    if seconds > 0 {
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(seconds));
            let _ = clear_if_unchanged(&text);
        });
    }
    Ok(())
}
