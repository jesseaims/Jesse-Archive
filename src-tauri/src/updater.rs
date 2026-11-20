//! Automatic updates from the public GitHub Releases of the project.
//!
//! Every release carries `JesseArchive-Setup.exe` and `JesseArchive-Setup.exe.sig`:
//! a small text manifest (version, file name, size, SHA-256) signed with Ed25519 by
//! the key kept on the release PC. The public key is embedded at build time
//! (`update-public-key.txt`). An installer is downloaded and started only when the
//! signature is valid, the version is newer than the running one and size and hash
//! of the downloaded file match the signed manifest. GitHub alone (or a network
//! attacker) cannot make the app run an installer that was not signed.
//!
//! Checking is a per-device preference (`update_auto`, default on) stored in the
//! device config, never in the vault. Nothing is installed without the user's
//! confirmation in the UI.
use crate::core;
use base64::Engine;
use ed25519_dalek::{Signature, VerifyingKey};
use serde_json::{json, Value as V};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const REPOSITORY: &str = "jesseaims/Jesse-Archive";
pub const INSTALLER: &str = "JesseArchive-Setup.exe";
const MANIFEST_HEADER: &str = "JesseArchive update v1";
const PUBLIC_KEY: &str = include_str!("../update-public-key.txt");
const MAX_MANIFEST: usize = 4096;
const MAX_INSTALLER: u64 = 1024 * 1024 * 1024;
const USER_AGENT: &str = "JesseArchive-Updater";

static INSTALLING: AtomicBool = AtomicBool::new(false);
/// The verified installer, opened so that no other process can change, rename or
/// delete it, kept until the app exits (see `lock_verified`).
static LOCKED_INSTALLER: std::sync::Mutex<Option<std::fs::File>> = std::sync::Mutex::new(None);

#[derive(Debug, Clone, PartialEq)]
pub struct Manifest {
    pub version: String,
    pub size: u64,
    pub sha256: [u8; 32],
}

/// Parses "X.Y.Z" (optionally prefixed by "v") into numbers.
pub fn parse_version(v: &str) -> Option<(u64, u64, u64)> {
    let v = v.strip_prefix('v').unwrap_or(v);
    let mut parts = v.split('.');
    let a = parts.next()?.parse().ok()?;
    let b = parts.next()?.parse().ok()?;
    let c = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some((a, b, c))
}

pub fn is_newer(candidate: &str, current: &str) -> bool {
    match (parse_version(candidate), parse_version(current)) {
        (Some(a), Some(b)) => a > b,
        _ => false,
    }
}

/// The embedded public key, or None when this build has no update key configured.
pub fn public_key() -> Option<VerifyingKey> {
    let raw = base64::engine::general_purpose::STANDARD
        .decode(PUBLIC_KEY.trim())
        .ok()?;
    let bytes: [u8; 32] = raw.try_into().ok()?;
    VerifyingKey::from_bytes(&bytes).ok()
}

/// Verifies the signed manifest and returns its content. The signed message is the
/// exact text before the "signature: " line; the format is strict (LF endings).
pub fn verify_manifest(text: &str, key: &VerifyingKey) -> Result<Manifest, String> {
    let invalid = || "Firma dell'aggiornamento non valida.".to_string();
    let at = text.find("\nsignature: ").ok_or_else(invalid)?;
    let (signed, rest) = text.split_at(at + 1);
    let sig_b64 = rest
        .strip_prefix("signature: ")
        .and_then(|s| s.strip_suffix('\n').or(Some(s)))
        .ok_or_else(invalid)?;
    if sig_b64.contains(['\n', '\r']) {
        return Err(invalid());
    }
    let sig_bytes = base64::engine::general_purpose::STANDARD
        .decode(sig_b64)
        .map_err(|_| invalid())?;
    let signature = Signature::from_slice(&sig_bytes).map_err(|_| invalid())?;
    key.verify_strict(signed.as_bytes(), &signature)
        .map_err(|_| invalid())?;

    let lines: Vec<&str> = signed.trim_end_matches('\n').split('\n').collect();
    let field = |i: usize, name: &str| -> Result<String, String> {
        lines
            .get(i)
            .and_then(|l| l.strip_prefix(name))
            .and_then(|l| l.strip_prefix(": "))
            .map(str::to_string)
            .ok_or_else(|| format!("Manifest dell'aggiornamento non valido ({name})."))
    };
    if lines.len() != 5 || lines[0] != MANIFEST_HEADER {
        return Err("Manifest dell'aggiornamento non riconosciuto.".into());
    }
    let version = field(1, "version")?;
    if parse_version(&version).is_none() || version.starts_with('v') {
        return Err("Versione dell'aggiornamento non valida.".into());
    }
    if field(2, "file")? != INSTALLER {
        return Err("Il manifest non riguarda il setup di Jesse's Archive.".into());
    }
    let size: u64 = field(3, "size")?
        .parse()
        .map_err(|_| "Dimensione dell'aggiornamento non valida.".to_string())?;
    if size == 0 || size > MAX_INSTALLER {
        return Err("Dimensione dell'aggiornamento non valida.".into());
    }
    let hash = hex::decode(field(4, "sha256")?)
        .ok()
        .and_then(|h| <[u8; 32]>::try_from(h).ok())
        .ok_or("Hash dell'aggiornamento non valido.")?;
    Ok(Manifest {
        version,
        size,
        sha256: hash,
    })
}

/// Only direct download links of this repository's release assets are accepted.
pub fn asset_url_ok(url: &str, tag: &str, name: &str) -> bool {
    url == format!("https://github.com/{REPOSITORY}/releases/download/{tag}/{name}")
}

struct Release {
    tag: String,
    notes: String,
    installer_url: String,
    installer_size: u64,
    manifest_url: Option<String>,
}

fn client(timeout: Duration) -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(timeout)
        .user_agent(USER_AGENT)
        .build()
        .map_err(|_| "Impossibile preparare la connessione.".to_string())
}

fn latest_release() -> Result<Release, String> {
    let offline = || "Impossibile contattare GitHub per gli aggiornamenti.".to_string();
    let text = client(Duration::from_secs(20))?
        .get(format!(
            "https://api.github.com/repos/{REPOSITORY}/releases/latest"
        ))
        .header("Accept", "application/vnd.github+json")
        .send()
        .and_then(|r| r.error_for_status())
        .and_then(|r| r.text())
        .map_err(|_| offline())?;
    let body: V = serde_json::from_str(&text).map_err(|_| offline())?;
    let tag = body["tag_name"].as_str().unwrap_or_default().to_string();
    if body["draft"].as_bool() == Some(true) || parse_version(&tag).is_none() {
        return Err("Nessuna release valida trovata.".into());
    }
    let asset = |name: &str| {
        body["assets"].as_array().and_then(|list| {
            list.iter().find(|a| {
                a["name"].as_str() == Some(name)
                    && a["state"].as_str() == Some("uploaded")
                    && a["browser_download_url"]
                        .as_str()
                        .is_some_and(|u| asset_url_ok(u, &tag, name))
            })
        })
    };
    let installer = asset(INSTALLER).ok_or("La release non contiene il setup.")?;
    let manifest = asset(&format!("{INSTALLER}.sig"));
    let notes: String = body["body"]
        .as_str()
        .unwrap_or_default()
        .chars()
        .take(4000)
        .collect();
    Ok(Release {
        installer_url: installer["browser_download_url"]
            .as_str()
            .unwrap_or_default()
            .into(),
        installer_size: installer["size"].as_u64().unwrap_or(0),
        manifest_url: manifest
            .and_then(|m| m["browser_download_url"].as_str())
            .map(str::to_string),
        tag,
        notes,
    })
}

fn fetch_manifest(release: &Release, key: &VerifyingKey) -> Result<Manifest, String> {
    let url = release
        .manifest_url
        .as_deref()
        .ok_or("La nuova release non è firmata: aggiornamento automatico non possibile.")?;
    let mut resp = client(Duration::from_secs(30))?
        .get(url)
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|_| "Impossibile scaricare la firma dell'aggiornamento.".to_string())?;
    let mut buf = Vec::new();
    (&mut resp)
        .take(MAX_MANIFEST as u64 + 1)
        .read_to_end(&mut buf)
        .map_err(|_| "Impossibile scaricare la firma dell'aggiornamento.".to_string())?;
    if buf.len() > MAX_MANIFEST {
        return Err("Firma dell'aggiornamento non valida.".into());
    }
    let text = String::from_utf8(buf).map_err(|_| "Firma dell'aggiornamento non valida.")?;
    let manifest = verify_manifest(&text, key)?;
    if parse_version(&manifest.version) != parse_version(&release.tag) {
        return Err("La firma non corrisponde alla versione pubblicata.".into());
    }
    if manifest.size != release.installer_size {
        return Err("La dimensione del setup non corrisponde alla firma.".into());
    }
    Ok(manifest)
}

/// Latest signed release, verified; `available` is true only if it is newer.
fn check_blocking() -> Result<(V, Option<(Release, Manifest)>), String> {
    let current = env!("CARGO_PKG_VERSION");
    let key = public_key().ok_or("Aggiornamento automatico non configurato in questa build.")?;
    let release = latest_release()?;
    let latest = release.tag.trim_start_matches('v').to_string();
    if !is_newer(&latest, current) {
        let info = json!({"available": false, "current": current, "version": latest});
        return Ok((info, None));
    }
    let manifest = fetch_manifest(&release, &key)?;
    let info = json!({
        "available": true,
        "current": current,
        "version": manifest.version,
        "size": manifest.size,
        "notes": release.notes,
    });
    Ok((info, Some((release, manifest))))
}

fn download(app: &AppHandle, release: &Release, manifest: &Manifest) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("JesseArchive-Update");
    std::fs::create_dir_all(&dir).map_err(|_| "Cartella temporanea non disponibile.")?;
    let path = dir.join(format!("JesseArchive-Setup-{}.exe", manifest.version));
    let failed = || "Download dell'aggiornamento non riuscito.".to_string();
    let mut resp = client(Duration::from_secs(60 * 60))?
        .get(&release.installer_url)
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|_| failed())?;
    let mut file = std::fs::File::create(&path).map_err(|_| failed())?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut last_emit: u64 = 0;
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        let n = resp.read(&mut buf).map_err(|_| failed())?;
        if n == 0 {
            break;
        }
        received += n as u64;
        if received > manifest.size {
            drop(file);
            let _ = std::fs::remove_file(&path);
            return Err("Il setup scaricato è più grande di quello firmato.".into());
        }
        hasher.update(&buf[..n]);
        file.write_all(&buf[..n]).map_err(|_| failed())?;
        if received - last_emit >= 2 * 1024 * 1024 || received == manifest.size {
            last_emit = received;
            let _ = app.emit(
                "update-progress",
                json!({"received": received, "total": manifest.size}),
            );
        }
    }
    file.sync_all().map_err(|_| failed())?;
    drop(file);
    let digest: [u8; 32] = hasher.finalize().into();
    if received != manifest.size || digest != manifest.sha256 {
        let _ = std::fs::remove_file(&path);
        return Err(
            "Il setup scaricato non corrisponde alla firma: installazione annullata.".into(),
        );
    }
    Ok(path)
}

/// Reopens the downloaded installer denying write and delete access to every other
/// process, then checks size and hash again through that handle. The file sits in the
/// user's temporary folder: without this, a program running as the same user could
/// replace it between the check and the elevated start, and get its own executable
/// approved in the UAC prompt of the update.
#[cfg(windows)]
fn lock_verified(path: &Path, manifest: &Manifest) -> Result<std::fs::File, String> {
    use std::os::windows::fs::OpenOptionsExt;
    const FILE_SHARE_READ: u32 = 0x1;
    let changed = || "Il setup scaricato è stato modificato: installazione annullata.".to_string();
    let mut file = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ)
        .open(path)
        .map_err(|_| {
            "Il setup scaricato è in uso da un altro programma: installazione annullata."
                .to_string()
        })?;
    let mut hasher = Sha256::new();
    let mut total: u64 = 0;
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        let n = file.read(&mut buf).map_err(|_| changed())?;
        if n == 0 {
            break;
        }
        total += n as u64;
        hasher.update(&buf[..n]);
    }
    let digest: [u8; 32] = hasher.finalize().into();
    if total != manifest.size || digest != manifest.sha256 {
        return Err(changed());
    }
    Ok(file)
}
#[cfg(not(windows))]
fn lock_verified(path: &Path, _manifest: &Manifest) -> Result<std::fs::File, String> {
    std::fs::File::open(path).map_err(|e| e.to_string())
}

/// Starts the installer through ShellExecute, which shows the UAC prompt required by
/// the setup. It installs silently in the current program folder and restarts the app.
#[cfg(windows)]
fn launch(installer: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let install_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(Path::to_path_buf))
        .ok_or("Cartella del programma non individuata.")?;
    let wide = |s: &std::ffi::OsStr| s.encode_wide().chain(Some(0)).collect::<Vec<u16>>();
    let params = format!(
        "/SILENT /SUPPRESSMSGBOXES /NORESTART /INSTALLDIR=\"{}\"",
        install_dir.display()
    );
    let verb = wide("open".as_ref());
    let file = wide(installer.as_os_str());
    let params = wide(params.as_ref());
    // SAFETY: all pointers are NUL-terminated UTF-16 buffers alive for the call.
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            params.as_ptr(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if result as isize <= 32 {
        return Err("Installazione annullata o non avviata (autorizzazione negata?).".into());
    }
    Ok(())
}

#[cfg(not(windows))]
fn launch(_installer: &Path) -> Result<(), String> {
    Err("Aggiornamento automatico disponibile solo su Windows.".into())
}

fn auto_enabled() -> bool {
    core::device_pref("update_auto").as_bool().unwrap_or(true)
}

#[tauri::command]
pub fn update_settings() -> V {
    json!({
        "current": env!("CARGO_PKG_VERSION"),
        "auto": auto_enabled(),
        "configured": public_key().is_some(),
    })
}

#[tauri::command]
pub fn update_set_auto(enabled: bool) -> Result<(), String> {
    core::set_device_pref("update_auto", json!(enabled))
}

#[tauri::command]
pub async fn update_check() -> Result<V, String> {
    tauri::async_runtime::spawn_blocking(|| check_blocking().map(|(info, _)| info))
        .await
        .map_err(|_| "Controllo aggiornamenti interrotto.".to_string())?
}

/// Downloads and verifies `version` again from scratch (nothing from the UI is
/// trusted), locks the vault, starts the installer and closes the app.
#[tauri::command]
pub async fn update_install(app: AppHandle, version: String) -> Result<(), String> {
    if INSTALLING.swap(true, Ordering::SeqCst) {
        return Err("Aggiornamento già in corso.".into());
    }
    let handle = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let (_, found) = check_blocking()?;
        let (release, manifest) = found.ok_or("Nessun aggiornamento disponibile.")?;
        if manifest.version != version {
            return Err(
                "È stata pubblicata un'altra versione: ricontrolla gli aggiornamenti.".into(),
            );
        }
        let installer = download(&handle, &release, &manifest)?;
        let locked = lock_verified(&installer, &manifest)?;
        launch(&installer)?;
        *LOCKED_INSTALLER.lock().unwrap_or_else(|e| e.into_inner()) = Some(locked);
        Ok(())
    })
    .await
    .map_err(|_| "Aggiornamento interrotto.".to_string())
    .and_then(|r| r);
    if let Err(e) = result {
        INSTALLING.store(false, Ordering::SeqCst);
        return Err(e);
    }
    if let Some(st) = app.try_state::<crate::AppState>() {
        if let Ok(mut vault) = st.vault() {
            let _ = vault.call("lock", json!({}));
        }
    }
    let _ = app.emit("vault-locked", ());
    // The installer waits for UAC/extraction; leave a moment for the UI, then quit so
    // the setup can replace the program files.
    let exit = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(800));
        exit.exit(0);
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    #[cfg(windows)]
    #[test]
    fn verified_installer_cannot_be_replaced_before_launch() {
        let dir = std::env::temp_dir().join(format!("jesse-update-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("setup-sintetico.exe");
        let content = b"setup sintetico per il test".repeat(1000);
        std::fs::write(&path, &content).unwrap();
        let manifest = Manifest {
            version: "9.9.9".into(),
            size: content.len() as u64,
            sha256: Sha256::digest(&content).into(),
        };
        let locked = lock_verified(&path, &manifest).unwrap();
        // While locked, nothing can write, truncate, rename or delete it.
        assert!(std::fs::OpenOptions::new().write(true).open(&path).is_err());
        assert!(std::fs::remove_file(&path).is_err());
        assert!(std::fs::rename(&path, dir.join("altro.exe")).is_err());
        // It can still be read (ShellExecute and the setup itself open it for reading).
        assert_eq!(std::fs::read(&path).unwrap(), content);
        drop(locked);
        // A modified file is refused.
        std::fs::write(&path, b"contenuto sostituito").unwrap();
        assert!(lock_verified(&path, &manifest).is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    fn key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32])
    }

    fn manifest_text(signing: &SigningKey, version: &str, file: &str, size: u64) -> String {
        let body = format!(
            "{MANIFEST_HEADER}\nversion: {version}\nfile: {file}\nsize: {size}\nsha256: {}\n",
            "ab".repeat(32)
        );
        let sig = signing.sign(body.as_bytes());
        format!(
            "{body}signature: {}\n",
            base64::engine::general_purpose::STANDARD.encode(sig.to_bytes())
        )
    }

    #[test]
    fn versions_compare_numerically() {
        assert!(is_newer("1.1.13", "1.1.12"));
        assert!(is_newer("v1.2.0", "1.1.99"));
        assert!(is_newer("1.1.100", "1.1.99"));
        assert!(!is_newer("1.1.12", "1.1.12"));
        assert!(!is_newer("1.1.11", "1.1.12"));
        assert!(!is_newer("1.1", "1.0.0"));
        assert!(!is_newer("1.1.13-beta", "1.1.12"));
    }

    #[test]
    fn valid_signed_manifest_is_accepted() {
        let k = key();
        let m = verify_manifest(
            &manifest_text(&k, "1.1.13", INSTALLER, 1234),
            &k.verifying_key(),
        )
        .unwrap();
        assert_eq!(m.version, "1.1.13");
        assert_eq!(m.size, 1234);
        assert_eq!(m.sha256, [0xab; 32]);
    }

    #[test]
    fn tampered_or_foreign_manifests_are_rejected() {
        let k = key();
        let good = manifest_text(&k, "1.1.13", INSTALLER, 1234);
        let pk = k.verifying_key();
        // Any change to the signed text invalidates the signature.
        assert!(verify_manifest(&good.replace("1234", "1235"), &pk).is_err());
        assert!(verify_manifest(&good.replace("1.1.13", "9.9.9"), &pk).is_err());
        // Signed by another key.
        let other = SigningKey::from_bytes(&[9u8; 32]);
        assert!(verify_manifest(&manifest_text(&other, "1.1.13", INSTALLER, 1), &pk).is_err());
        // Correctly signed but for another file, or malformed fields.
        assert!(verify_manifest(&manifest_text(&k, "1.1.13", "other.exe", 1), &pk).is_err());
        assert!(verify_manifest(&manifest_text(&k, "v1.1.13", INSTALLER, 1), &pk).is_err());
        assert!(verify_manifest(&manifest_text(&k, "1.1.13", INSTALLER, 0), &pk).is_err());
        // Missing signature or CRLF rewrites.
        assert!(verify_manifest(good.split("signature").next().unwrap(), &pk).is_err());
        assert!(verify_manifest(&good.replace('\n', "\r\n"), &pk).is_err());
    }

    #[test]
    fn only_this_repository_assets_are_downloaded() {
        let ok = "https://github.com/jesseaims/Jesse-Archive/releases/download/v1.1.13/JesseArchive-Setup.exe";
        assert!(asset_url_ok(ok, "v1.1.13", INSTALLER));
        assert!(!asset_url_ok(ok, "v1.1.14", INSTALLER));
        assert!(!asset_url_ok(
            "https://github.com/evil/Jesse-Archive/releases/download/v1.1.13/JesseArchive-Setup.exe",
            "v1.1.13",
            INSTALLER
        ));
        assert!(!asset_url_ok(
            "http://github.com/jesseaims/Jesse-Archive/releases/download/v1.1.13/JesseArchive-Setup.exe",
            "v1.1.13",
            INSTALLER
        ));
    }

    #[test]
    fn embedded_public_key_is_valid() {
        assert!(
            public_key().is_some(),
            "update-public-key.txt must contain the release key"
        );
    }

    /// Network check against the real repository (run with --ignored).
    #[test]
    #[ignore]
    fn live_check_reads_latest_release() {
        let release = latest_release().expect("latest release");
        assert!(parse_version(&release.tag).is_some());
        assert!(asset_url_ok(
            &release.installer_url,
            &release.tag,
            INSTALLER
        ));
        let (info, _) = check_blocking().expect("check");
        eprintln!("live check: {info}");
    }

    /// Manifest of a dummy 3 MB file produced by scripts/update-signature.mjs with the
    /// real release key: the Node signer and this verifier must agree byte for byte.
    #[test]
    fn manifest_from_node_signer_verifies_with_embedded_key() {
        let text = "JesseArchive update v1\nversion: 9.9.9\nfile: JesseArchive-Setup.exe\nsize: 3000000\nsha256: 50223c6710ccbadd222bed436371bae5ba33b9e904e738b35709ce1eb066aa2e\nsignature: hlrOeJi2S3IPXzW83LdrHNwckSudE9YpkdSzlqmoc3Cdi+GWlgh4uJnaU+2kIOkF09u+gWf2Hl6CgU2foIrRCg==\n";
        let m = verify_manifest(text, &public_key().unwrap()).unwrap();
        assert_eq!((m.version.as_str(), m.size), ("9.9.9", 3_000_000));
        assert!(verify_manifest(&text.replace("9.9.9", "9.9.8"), &public_key().unwrap()).is_err());
    }
}
