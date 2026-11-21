/// Every command registered in lib.rs (`generate_handler!`). Tauri creates an
/// `allow-<command>` permission for each, and a window may call only the ones its
/// capability file (capabilities/<window>.json) lists. tests/capabilities.test.mjs
/// checks that this list, lib.rs and the capabilities agree with the code.
const COMMANDS: &[&str] = &[
    "api",
    "choose_file",
    "choose_icon_data",
    "read_file",
    "save_file",
    "copy_secret",
    "copy_vault_secret",
    "clear_secret_if_unchanged",
    "browser_status",
    "browser_shortcut",
    "browser_accounts",
    "browser_fill",
    "browser_cancel",
    "browser_install",
    "browser_open_extensions",
    "browser_setup_status",
    "browser_setup_open",
    "browser_setup_show",
    "browser_setup_finish",
    "zoom_get",
    "zoom_change",
    "language_get",
    "language_set",
    "update_settings",
    "update_set_auto",
    "update_check",
    "update_install",
    "browser_save_state",
    "browser_save_approve",
    "browser_save_dismiss",
    "browser_save_settings",
    "browser_save_set_enabled",
    "browser_save_forget",
    "passkey_state",
    "passkey_approve",
    "passkey_fallback",
    "passkey_cancel",
    "passkey_settings",
    "passkey_set_enabled",
    "quick_search_data",
    "quick_search_copy",
    "quick_search_reveal",
    "quick_search_open_url",
    "quick_search_open",
    "quick_search_hide",
    "quick_search_clear_recent",
    "quick_search_settings",
    "quick_search_configure",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run the Tauri build script");
}
