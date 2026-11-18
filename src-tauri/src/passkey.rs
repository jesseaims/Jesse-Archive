//! WebAuthn passkeys stored in the vault and used through the browser extension.
//!
//! The extension intercepts `navigator.credentials.create/get` on HTTPS pages and
//! forwards the request with the origin reported by the browser (never by the page).
//! The quick-fill window asks the user: save/use a passkey from Jesse's Archive, or
//! let the browser handle it ("fallback": phone, Windows Hello, security key).
//!
//! Credentials are ES256 (P-256), attestation "none", AAGUID zero, sign counter 0.
//! The private key lives only inside the encrypted vault, in the hidden item field
//! `webauthn` of a "passkey" item. "User verified" is reported because the vault
//! must be unlocked with the master password and the user confirms every use.
use crate::{browser, AppState};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64U, Engine};
use p256::ecdsa::{signature::Signer, Signature, SigningKey, VerifyingKey};
use rand::{rngs::OsRng, RngCore};
use serde_json::{json, Value as V};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};
use zeroize::Zeroizing;

const ES256: i64 = -7;
/// UP | UV | BE | BS (+ AT on creation): synced, user-verified credentials.
const FLAGS_GET: u8 = 0x01 | 0x04 | 0x08 | 0x10;
const FLAGS_CREATE: u8 = FLAGS_GET | 0x40;
const SPKI_P256_PREFIX: [u8; 26] = [
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
];
const MAX_WAIT: Duration = Duration::from_secs(10 * 60);

#[derive(Clone, Debug, PartialEq)]
pub enum Op {
    Create,
    Get,
}

#[derive(Clone, Debug)]
pub struct Pending {
    client: String,
    request: String,
    op: Op,
    origin: String,
    rp_id: String,
    rp_name: String,
    challenge: Vec<u8>,
    user_id: Vec<u8>,
    user_name: String,
    user_display: String,
    allow: Vec<String>,
    exclude: Vec<String>,
    cred_props: bool,
    started: Instant,
}

pub struct Passkeys(pub Mutex<Option<Pending>>);

/// What the vault keeps (as JSON in the hidden `webauthn` field).
#[derive(Clone, Debug, PartialEq)]
pub struct Stored {
    pub rp_id: String,
    pub cred_id: Vec<u8>,
    pub user_handle: Vec<u8>,
    pub key: Zeroizing<Vec<u8>>,
}

impl Stored {
    fn to_json(&self) -> String {
        json!({
            "v": 1,
            "alg": ES256,
            "rp_id": self.rp_id,
            "cred_id": B64U.encode(&self.cred_id),
            "user_handle": B64U.encode(&self.user_handle),
            "key": B64U.encode(&*self.key),
        })
        .to_string()
    }
    fn from_item(item: &V) -> Option<Stored> {
        let w: V = serde_json::from_str(item["f"]["webauthn"].as_str()?).ok()?;
        if w["v"] != 1 || w["alg"] != ES256 {
            return None;
        }
        Some(Stored {
            rp_id: w["rp_id"].as_str()?.to_string(),
            cred_id: B64U.decode(w["cred_id"].as_str()?).ok()?,
            user_handle: B64U.decode(w["user_handle"].as_str()?).ok()?,
            key: Zeroizing::new(B64U.decode(w["key"].as_str()?).ok()?),
        })
    }
}

// --- Minimal CBOR (only what attestation objects need) -------------------------

pub enum Cbor {
    Int(i64),
    Bytes(Vec<u8>),
    Text(&'static str),
    Map(Vec<(Cbor, Cbor)>),
}

fn cbor_head(out: &mut Vec<u8>, major: u8, n: u64) {
    let m = major << 5;
    match n {
        0..=23 => out.push(m | n as u8),
        24..=0xff => out.extend([m | 24, n as u8]),
        0x100..=0xffff => {
            out.push(m | 25);
            out.extend((n as u16).to_be_bytes());
        }
        0x1_0000..=0xffff_ffff => {
            out.push(m | 26);
            out.extend((n as u32).to_be_bytes());
        }
        _ => {
            out.push(m | 27);
            out.extend(n.to_be_bytes());
        }
    }
}

pub fn cbor(value: &Cbor, out: &mut Vec<u8>) {
    match value {
        Cbor::Int(i) if *i >= 0 => cbor_head(out, 0, *i as u64),
        Cbor::Int(i) => cbor_head(out, 1, (-1 - *i) as u64),
        Cbor::Bytes(b) => {
            cbor_head(out, 2, b.len() as u64);
            out.extend(b);
        }
        Cbor::Text(t) => {
            cbor_head(out, 3, t.len() as u64);
            out.extend(t.as_bytes());
        }
        Cbor::Map(entries) => {
            cbor_head(out, 5, entries.len() as u64);
            for (k, v) in entries {
                cbor(k, out);
                cbor(v, out);
            }
        }
    }
}

// --- WebAuthn structures ----------------------------------------------------------

/// Valid when rp_id equals the origin host or is a registrable parent of it (never a
/// public suffix such as "com" or "github.io"). IP addresses must match exactly.
pub fn valid_rp_id(host: &str, rp_id: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    let rp = rp_id.to_ascii_lowercase();
    if rp.is_empty() || rp != rp_id || rp.contains(['/', ':', '@']) {
        return false;
    }
    if host == rp {
        return true;
    }
    if host.parse::<std::net::IpAddr>().is_ok() || !host.ends_with(&format!(".{rp}")) {
        return false;
    }
    psl::domain_str(&rp).is_some_and(|d| rp == d || rp.ends_with(&format!(".{d}")))
}

pub fn client_data_json(kind: &str, challenge: &[u8], origin: &str) -> Vec<u8> {
    // Field order as produced by browsers; values are JSON-escaped.
    format!(
        "{{\"type\":{},\"challenge\":{},\"origin\":{},\"crossOrigin\":false}}",
        V::from(kind),
        V::from(B64U.encode(challenge)),
        V::from(origin)
    )
    .into_bytes()
}

fn authenticator_data(rp_id: &str, flags: u8, attested: Option<(&[u8], &VerifyingKey)>) -> Vec<u8> {
    let mut data = Sha256::digest(rp_id.as_bytes()).to_vec();
    data.push(flags);
    data.extend(0u32.to_be_bytes());
    if let Some((cred_id, key)) = attested {
        data.extend([0u8; 16]); // AAGUID
        data.extend((cred_id.len() as u16).to_be_bytes());
        data.extend(cred_id);
        let point = key.to_encoded_point(false);
        let cose = Cbor::Map(vec![
            (Cbor::Int(1), Cbor::Int(2)),
            (Cbor::Int(3), Cbor::Int(ES256)),
            (Cbor::Int(-1), Cbor::Int(1)),
            (
                Cbor::Int(-2),
                Cbor::Bytes(point.x().map(|x| x.to_vec()).unwrap_or_default()),
            ),
            (
                Cbor::Int(-3),
                Cbor::Bytes(point.y().map(|y| y.to_vec()).unwrap_or_default()),
            ),
        ]);
        cbor(&cose, &mut data);
    }
    data
}

pub fn spki(key: &VerifyingKey) -> Vec<u8> {
    let mut out = SPKI_P256_PREFIX.to_vec();
    out.extend(key.to_encoded_point(false).as_bytes());
    out
}

/// Creates a new credential. Returns what the vault stores and the page response.
pub fn make_credential(
    rp_id: &str,
    origin: &str,
    challenge: &[u8],
    user_id: &[u8],
    cred_props: bool,
) -> (Stored, V) {
    let key = SigningKey::random(&mut OsRng);
    let public = VerifyingKey::from(&key);
    let mut cred_id = vec![0u8; 16];
    OsRng.fill_bytes(&mut cred_id);
    let auth_data = authenticator_data(rp_id, FLAGS_CREATE, Some((&cred_id, &public)));
    let client_data = client_data_json("webauthn.create", challenge, origin);
    let mut attestation = Vec::new();
    cbor(
        &Cbor::Map(vec![
            (Cbor::Text("fmt"), Cbor::Text("none")),
            (Cbor::Text("attStmt"), Cbor::Map(vec![])),
            (Cbor::Text("authData"), Cbor::Bytes(auth_data.clone())),
        ]),
        &mut attestation,
    );
    let id = B64U.encode(&cred_id);
    let response = json!({
        "action": "result",
        "op": "create",
        "id": id,
        "clientDataJSON": B64U.encode(&client_data),
        "attestationObject": B64U.encode(&attestation),
        "authenticatorData": B64U.encode(&auth_data),
        "publicKey": B64U.encode(spki(&public)),
        "publicKeyAlgorithm": ES256,
        "transports": ["internal"],
        "extensions": if cred_props { json!({"credProps": {"rk": true}}) } else { json!({}) },
    });
    let stored = Stored {
        rp_id: rp_id.to_string(),
        cred_id,
        user_handle: user_id.to_vec(),
        key: Zeroizing::new(key.to_bytes().to_vec()),
    };
    (stored, response)
}

/// Signs an assertion with a stored credential.
pub fn get_assertion(stored: &Stored, origin: &str, challenge: &[u8]) -> Result<V, String> {
    let key = SigningKey::from_slice(&stored.key).map_err(|_| "Passkey danneggiata.")?;
    let auth_data = authenticator_data(&stored.rp_id, FLAGS_GET, None);
    let client_data = client_data_json("webauthn.get", challenge, origin);
    let mut signed = auth_data.clone();
    signed.extend(Sha256::digest(&client_data));
    let signature: Signature = key.sign(&signed);
    Ok(json!({
        "action": "result",
        "op": "get",
        "id": B64U.encode(&stored.cred_id),
        "clientDataJSON": B64U.encode(&client_data),
        "authenticatorData": B64U.encode(&auth_data),
        "signature": B64U.encode(signature.to_der().as_bytes()),
        "userHandle": B64U.encode(&stored.user_handle),
    }))
}

// --- Request handling -------------------------------------------------------------

fn enabled() -> bool {
    crate::core::device_pref("passkeys")
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

fn b64(v: &V, min: usize, max: usize) -> Option<Vec<u8>> {
    let bytes = B64U.decode(v.as_str()?).ok()?;
    (min..=max).contains(&bytes.len()).then_some(bytes)
}

fn reply(app: &tauri::AppHandle, client: &str, request: &str, result: V) {
    let _ = browser::send(
        app,
        client,
        json!({"kind": "passkey-result", "request": request, "result": result}),
    );
}

fn error(name: &str, message: &str) -> V {
    json!({"action": "error", "name": name, "message": message})
}

/// Parses and validates a request from the extension. `Err` carries the reply.
fn parse(client: &str, message: &V) -> Result<Pending, V> {
    let fallback = || json!({"action": "fallback"});
    let request = text(&message["request"], 100);
    let origin_url = url::Url::parse(message["origin"].as_str().unwrap_or_default())
        .ok()
        .filter(|u| u.scheme() == "https" && u.host_str().is_some())
        .ok_or_else(fallback)?;
    let host = origin_url.host_str().unwrap_or_default().to_string();
    let origin = origin_url.origin().ascii_serialization();
    let o = &message["options"];
    let op = match message["op"].as_str() {
        Some("create") => Op::Create,
        Some("get") => Op::Get,
        _ => return Err(fallback()),
    };
    let rp_id = match op {
        Op::Create => o["rp"]["id"].as_str(),
        Op::Get => o["rpId"].as_str(),
    }
    .map(str::to_string)
    .unwrap_or_else(|| host.clone());
    if !valid_rp_id(&host, &rp_id) {
        return Err(error(
            "SecurityError",
            "Identificativo del sito non valido per questa origine.",
        ));
    }
    let challenge = b64(&o["challenge"], 1, 1024).ok_or_else(fallback)?;
    let ids = |v: &V| -> Vec<String> {
        v.as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|x| x.as_str().map(str::to_string))
                    .take(200)
                    .collect()
            })
            .unwrap_or_default()
    };
    let mut pending = Pending {
        client: client.into(),
        request,
        op: op.clone(),
        origin,
        rp_name: text(&o["rp"]["name"], 120),
        rp_id,
        challenge,
        user_id: vec![],
        user_name: String::new(),
        user_display: String::new(),
        allow: ids(&o["allowCredentials"]),
        exclude: ids(&o["excludeCredentials"]),
        cred_props: o["credProps"] == true,
        started: Instant::now(),
    };
    if op == Op::Create {
        let algs: Vec<i64> = o["pubKeyCredParams"]
            .as_array()
            .map(|a| a.iter().filter_map(|p| p["alg"].as_i64()).collect())
            .unwrap_or_default();
        // An empty list means the defaults (ES256 and RS256); otherwise ES256 must be allowed.
        if !algs.is_empty() && !algs.contains(&ES256) {
            return Err(fallback());
        }
        if o["attachment"].as_str() == Some("cross-platform") {
            return Err(fallback());
        }
        pending.user_id = b64(&o["user"]["id"], 1, 64).ok_or_else(fallback)?;
        pending.user_name = text(&o["user"]["name"], 200);
        pending.user_display = text(&o["user"]["displayName"], 200);
    }
    Ok(pending)
}

/// Passkey items for the request's site, if the vault is unlocked.
fn stored_items(app: &tauri::AppHandle, rp_id: &str) -> Result<Option<Vec<(V, Stored)>>, String> {
    let state = app.state::<AppState>();
    let mut vault = state.vault()?;
    if vault.call("status", json!({}))?["unlocked"] != true {
        return Ok(None);
    }
    let data = vault.call("browser_state", json!({}))?;
    Ok(Some(
        data["items"]
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .filter(|i| i["type"] == "passkey" && i["trashed"].is_null())
                    .filter_map(|i| Stored::from_item(i).map(|s| (i.clone(), s)))
                    .filter(|(_, s)| s.rp_id == rp_id)
                    .collect()
            })
            .unwrap_or_default(),
    ))
}

fn usable(pending: &Pending, stored: &Stored) -> bool {
    pending.allow.is_empty() || pending.allow.contains(&B64U.encode(&stored.cred_id))
}

/// New request from the extension ("passkey").
pub fn request(app: &tauri::AppHandle, client: &str, message: &V) {
    let request = text(&message["request"], 100);
    if !enabled() {
        return reply(app, client, &request, json!({"action": "fallback"}));
    }
    let pending = match parse(client, message) {
        Ok(p) => p,
        Err(result) => return reply(app, client, &request, result),
    };
    // Unlocked vault without passkeys for this site: let the browser handle sign-in.
    if pending.op == Op::Get {
        if let Ok(Some(items)) = stored_items(app, &pending.rp_id) {
            if !items.iter().any(|(_, s)| usable(&pending, s)) {
                return reply(app, client, &request, json!({"action": "fallback"}));
            }
        }
    }
    let state = app.state::<Passkeys>();
    let mut slot = state.0.lock().unwrap_or_else(|e| e.into_inner());
    if slot
        .as_ref()
        .is_some_and(|p| p.started.elapsed() < MAX_WAIT)
    {
        drop(slot);
        return reply(app, client, &request, json!({"action": "fallback"}));
    }
    *slot = Some(pending);
    drop(slot);
    browser::show(app);
    let _ = app.emit_to("quick-fill", "passkey-changed", ());
}

/// The page aborted, the extension timed out or the browser disconnected.
pub fn aborted(app: &tauri::AppHandle, client: &str, request: Option<&str>) {
    let state = app.state::<Passkeys>();
    let mut slot = state.0.lock().unwrap_or_else(|e| e.into_inner());
    if slot
        .as_ref()
        .is_some_and(|p| p.client == client && request.is_none_or(|r| r == p.request))
    {
        *slot = None;
        drop(slot);
        let _ = app.emit_to("quick-fill", "passkey-changed", ());
        browser::hide(app);
    }
}

fn take(app: &tauri::AppHandle) -> Result<Pending, String> {
    let state = app.state::<Passkeys>();
    let mut slot = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let pending = slot.take().ok_or("Richiesta passkey scaduta.")?;
    if pending.started.elapsed() > MAX_WAIT {
        return Err("Richiesta passkey scaduta.".into());
    }
    Ok(pending)
}

fn finish(app: &tauri::AppHandle, pending: &Pending, result: V) {
    reply(app, &pending.client, &pending.request, result);
    let _ = app.emit_to("quick-fill", "passkey-changed", ());
    browser::hide(app);
}

/// Cancels a pending request (window closed or "Annulla").
pub fn cancel(app: &tauri::AppHandle) {
    if let Ok(pending) = take(app) {
        finish(
            app,
            &pending,
            error("NotAllowedError", "Operazione annullata dall'utente."),
        );
    }
}

#[tauri::command]
pub fn passkey_state(app: tauri::AppHandle) -> Result<V, String> {
    let pending = app
        .state::<Passkeys>()
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .filter(|p| p.started.elapsed() < MAX_WAIT);
    let Some(p) = pending else {
        return Ok(json!({"active": false}));
    };
    let items = stored_items(&app, &p.rp_id)?;
    let candidates: Vec<V> = items
        .iter()
        .flatten()
        .filter(|(_, s)| usable(&p, s))
        .map(|(i, _)| json!({"id": i["id"], "title": i["title"], "username": i["f"]["username"]}))
        .collect();
    let existing = items
        .iter()
        .flatten()
        .any(|(_, s)| p.exclude.contains(&B64U.encode(&s.cred_id)));
    Ok(json!({
        "active": true,
        "op": if p.op == Op::Create { "create" } else { "get" },
        "rpId": p.rp_id,
        "rpName": p.rp_name,
        "origin": p.origin,
        "userName": p.user_name,
        "userDisplay": p.user_display,
        "unlocked": items.is_some(),
        "candidates": candidates,
        "existing": existing,
    }))
}

/// Creates the passkey (op "create") or signs in with item `id` (op "get").
#[tauri::command]
pub fn passkey_approve(app: tauri::AppHandle, id: Option<String>) -> Result<(), String> {
    let pending = take(&app)?;
    let outcome = (|| -> Result<V, V> {
        let fail = |m: String| error("NotAllowedError", &m);
        let items = stored_items(&app, &pending.rp_id)
            .map_err(fail)?
            .ok_or_else(|| fail("Vault bloccato.".into()))?;
        match pending.op {
            Op::Create => {
                if items
                    .iter()
                    .any(|(_, s)| pending.exclude.contains(&B64U.encode(&s.cred_id)))
                {
                    return Err(error(
                        "InvalidStateError",
                        "Per questo account esiste già una passkey in Jesse's Archive.",
                    ));
                }
                let (stored, response) = make_credential(
                    &pending.rp_id,
                    &pending.origin,
                    &pending.challenge,
                    &pending.user_id,
                    pending.cred_props,
                );
                let title = if pending.rp_name.is_empty() {
                    pending.rp_id.clone()
                } else {
                    pending.rp_name.clone()
                };
                let username = if pending.user_name.is_empty() {
                    pending.user_display.clone()
                } else {
                    pending.user_name.clone()
                };
                let state = app.state::<AppState>();
                let mut vault = state.vault().map_err(fail)?;
                vault
                    .call(
                        "item",
                        json!({
                            "type": "passkey",
                            "title": title,
                            "f": {
                                "url": format!("https://{}", pending.rp_id),
                                "username": username,
                                "credential": format!("Passkey WebAuthn per {}", pending.rp_id),
                                "webauthn": stored.to_json(),
                            },
                        }),
                    )
                    .map_err(|e| fail(format!("Salvataggio della passkey non riuscito: {e}")))?;
                drop(vault);
                let _ = app.emit("vault-changed", ());
                Ok(response)
            }
            Op::Get => {
                let id = id.ok_or_else(|| fail("Nessuna passkey selezionata.".into()))?;
                let (_, stored) = items
                    .iter()
                    .find(|(i, s)| i["id"] == id.as_str() && usable(&pending, s))
                    .ok_or_else(|| fail("Passkey non valida per questo sito.".into()))?;
                get_assertion(stored, &pending.origin, &pending.challenge).map_err(fail)
            }
        }
    })();
    let ok = outcome.is_ok();
    let message = outcome
        .as_ref()
        .err()
        .and_then(|e| e["message"].as_str().map(str::to_string));
    finish(&app, &pending, outcome.unwrap_or_else(|e| e));
    if ok {
        Ok(())
    } else {
        Err(message.unwrap_or_else(|| "Operazione non riuscita.".into()))
    }
}

/// "Usa un altro dispositivo": the browser shows its own passkey dialog.
#[tauri::command]
pub fn passkey_fallback(app: tauri::AppHandle) -> Result<(), String> {
    let pending = take(&app)?;
    finish(&app, &pending, json!({"action": "fallback"}));
    Ok(())
}

#[tauri::command]
pub fn passkey_cancel(app: tauri::AppHandle) {
    cancel(&app);
}

#[tauri::command]
pub fn passkey_settings() -> V {
    json!({"enabled": enabled()})
}

#[tauri::command]
pub fn passkey_set_enabled(enabled: bool) -> Result<(), String> {
    crate::core::set_device_pref("passkeys", json!(enabled))
}

#[cfg(test)]
mod tests {
    use super::*;
    use p256::ecdsa::signature::Verifier;
    use p256::pkcs8::DecodePublicKey;

    #[test]
    fn rp_id_must_be_the_origin_or_a_registrable_parent() {
        assert!(valid_rp_id("example.com", "example.com"));
        assert!(valid_rp_id("login.example.com", "example.com"));
        assert!(valid_rp_id("a.b.example.co.uk", "b.example.co.uk"));
        assert!(!valid_rp_id("example.com", "login.example.com"));
        assert!(!valid_rp_id("example.com", "com"));
        assert!(!valid_rp_id("evil-example.com", "example.com"));
        assert!(!valid_rp_id("example.com.evil.test", "example.com"));
        assert!(!valid_rp_id("alice.github.io", "github.io"));
        assert!(!valid_rp_id("example.co.uk", "co.uk"));
        assert!(!valid_rp_id("example.com", "Example.com"));
        assert!(!valid_rp_id("example.com", ""));
        assert!(valid_rp_id("127.0.0.1", "127.0.0.1"));
        assert!(!valid_rp_id("10.0.0.1", "0.0.1"));
    }

    #[test]
    fn cbor_encodes_canonical_small_values() {
        let mut out = Vec::new();
        cbor(
            &Cbor::Map(vec![
                (Cbor::Int(1), Cbor::Int(2)),
                (Cbor::Int(-1), Cbor::Int(-25)),
                (Cbor::Text("a"), Cbor::Bytes(vec![0xff; 24])),
            ]),
            &mut out,
        );
        let mut expected = vec![0xa3, 0x01, 0x02, 0x20, 0x38, 0x18, 0x61, b'a', 0x58, 24];
        expected.extend([0xff; 24]);
        assert_eq!(out, expected);
    }

    #[test]
    fn client_data_is_escaped_json_in_browser_order() {
        let cd =
            String::from_utf8(client_data_json("webauthn.get", b"abc", "https://x.test")).unwrap();
        assert_eq!(
            cd,
            r#"{"type":"webauthn.get","challenge":"YWJj","origin":"https://x.test","crossOrigin":false}"#
        );
        let v: V = serde_json::from_str(&cd).unwrap();
        assert_eq!(v["challenge"], "YWJj");
    }

    /// Registration then authentication, verified like a relying party would.
    #[test]
    fn created_credential_signs_verifiable_assertions() {
        let (stored, created) = make_credential(
            "example.com",
            "https://login.example.com",
            b"chal-1",
            b"user-7",
            true,
        );
        assert_eq!(created["extensions"]["credProps"]["rk"], true);
        // authenticatorData: rpIdHash, flags, counter, AAGUID, credential id, COSE key.
        let auth = B64U
            .decode(created["authenticatorData"].as_str().unwrap())
            .unwrap();
        assert_eq!(&auth[..32], Sha256::digest(b"example.com").as_slice());
        assert_eq!(auth[32], FLAGS_CREATE);
        assert_eq!(&auth[33..37], &[0, 0, 0, 0]);
        assert_eq!(
            u16::from_be_bytes([auth[53], auth[54]]) as usize,
            stored.cred_id.len()
        );
        assert_eq!(
            &auth[55..55 + stored.cred_id.len()],
            stored.cred_id.as_slice()
        );
        // attestationObject = {"fmt":"none","attStmt":{},"authData":...}
        let att = B64U
            .decode(created["attestationObject"].as_str().unwrap())
            .unwrap();
        assert_eq!(&att[..19], b"\xa3cfmtdnonegattStmt\xa0");
        assert!(att.ends_with(&auth));
        let public = VerifyingKey::from_public_key_der(
            &B64U.decode(created["publicKey"].as_str().unwrap()).unwrap(),
        )
        .unwrap();

        let assertion = get_assertion(&stored, "https://example.com", b"chal-2").unwrap();
        let auth = B64U
            .decode(assertion["authenticatorData"].as_str().unwrap())
            .unwrap();
        assert_eq!(auth.len(), 37);
        assert_eq!(auth[32], FLAGS_GET);
        let cd = B64U
            .decode(assertion["clientDataJSON"].as_str().unwrap())
            .unwrap();
        let mut signed = auth.clone();
        signed.extend(Sha256::digest(&cd));
        let sig = Signature::from_der(
            &B64U
                .decode(assertion["signature"].as_str().unwrap())
                .unwrap(),
        )
        .unwrap();
        public.verify(&signed, &sig).unwrap();
        assert_eq!(assertion["userHandle"], B64U.encode(b"user-7"));
        assert_eq!(assertion["id"], created["id"]);
        // A different challenge invalidates the signature.
        let mut other = auth;
        other.extend(Sha256::digest(client_data_json(
            "webauthn.get",
            b"x",
            "https://example.com",
        )));
        assert!(public.verify(&other, &sig).is_err());
    }

    #[test]
    fn stored_credential_round_trips_through_the_vault_field() {
        let (stored, _) = make_credential("example.com", "https://example.com", b"c", b"u", false);
        let item = json!({"type":"passkey","f":{"webauthn": stored.to_json()}});
        assert_eq!(Stored::from_item(&item).unwrap(), stored);
        assert!(Stored::from_item(&json!({"f":{"webauthn":"{}"}})).is_none());
        assert!(Stored::from_item(&json!({"f":{}})).is_none());
    }

    #[test]
    fn requests_are_validated_before_any_prompt() {
        let base = json!({"request":"r","op":"create","origin":"https://login.example.com","options":{
            "rp":{"id":"example.com","name":"Example"},"challenge":B64U.encode(b"challenge"),
            "user":{"id":B64U.encode(b"u1"),"name":"mario","displayName":"Mario"},
            "pubKeyCredParams":[{"type":"public-key","alg":-7}]}});
        let p = parse("c", &base).unwrap();
        assert_eq!(
            (p.rp_id.as_str(), p.origin.as_str()),
            ("example.com", "https://login.example.com")
        );
        let mut bad = base.clone();
        bad["options"]["rp"]["id"] = json!("other.com");
        assert_eq!(parse("c", &bad).unwrap_err()["name"], "SecurityError");
        let mut http = base.clone();
        http["origin"] = json!("http://login.example.com");
        assert_eq!(parse("c", &http).unwrap_err()["action"], "fallback");
        let mut rs = base.clone();
        rs["options"]["pubKeyCredParams"] = json!([{"type":"public-key","alg":-257}]);
        assert_eq!(parse("c", &rs).unwrap_err()["action"], "fallback");
        let mut no_user = base.clone();
        no_user["options"]["user"]["id"] = json!("");
        assert!(parse("c", &no_user).is_err());
        let get = json!({"request":"r","op":"get","origin":"https://example.com","options":{
            "challenge":B64U.encode(b"c"),"allowCredentials":["AAAA"]}});
        let p = parse("c", &get).unwrap();
        assert_eq!((p.rp_id.as_str(), p.allow.len()), ("example.com", 1));
    }
}

#[cfg(test)]
mod interop {
    /// Prints a registration + assertion for an external verifier (run with --ignored).
    #[test]
    #[ignore]
    fn dump_for_external_verifier() {
        let (stored, created) =
            super::make_credential("example.com", "https://example.com", b"reg", b"u", false);
        let assertion = super::get_assertion(&stored, "https://example.com", b"login").unwrap();
        println!(
            "INTEROP {}",
            serde_json::json!({"create": created, "get": assertion})
        );
    }
}
