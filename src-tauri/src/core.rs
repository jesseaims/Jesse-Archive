use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::{rngs::OsRng, seq::SliceRandom, RngCore};
use scrypt::{scrypt, Params};
use serde_json::{json, Value as V};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use zeroize::Zeroizing;

type Res<T> = Result<T, String>;
fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}
pub fn now() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64()
}
fn rand_bytes<const N: usize>() -> [u8; N] {
    let mut b = [0; N];
    OsRng.fill_bytes(&mut b);
    b
}
fn id() -> String {
    hex::encode(rand_bytes::<6>())
}
fn s<'a>(v: &'a V, k: &str) -> &'a str {
    v.get(k).and_then(V::as_str).unwrap_or("")
}
fn num(v: &V, k: &str) -> f64 {
    v.get(k).and_then(V::as_f64).unwrap_or(0.)
}
fn array<'a>(v: &'a V, k: &str) -> &'a [V] {
    v.get(k)
        .and_then(V::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}
fn arr<'a>(v: &'a mut V, k: &str) -> &'a mut Vec<V> {
    v.as_object_mut()
        .unwrap()
        .entry(k)
        .or_insert(json!([]))
        .as_array_mut()
        .unwrap()
}
fn obj<'a>(v: &'a mut V, k: &str) -> &'a mut serde_json::Map<String, V> {
    v.as_object_mut()
        .unwrap()
        .entry(k)
        .or_insert(json!({}))
        .as_object_mut()
        .unwrap()
}
/// Minimum length policy for secrets chosen by the user, counted in Unicode
/// characters (not UTF-8 bytes) so accented passwords are treated consistently.
const MIN_SECRET_CHARS: usize = 8;
fn long_enough(v: &str) -> bool {
    v.chars().count() >= MIN_SECRET_CHARS
}
fn key(k: &str) -> String {
    k.to_uppercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}
fn kdf(pass: &str, salt: &[u8]) -> Res<Zeroizing<[u8; 32]>> {
    let mut out = Zeroizing::new([0; 32]);
    let params = Params::new(15, 8, 1, 32).map_err(err)?;
    scrypt(pass.as_bytes(), salt, &params, &mut *out).map_err(err)?;
    Ok(out)
}
fn seal(k: &[u8; 32], plain: &[u8]) -> Res<String> {
    let nonce = rand_bytes::<12>();
    let aes = Aes256Gcm::new_from_slice(k).map_err(err)?;
    let cipher = aes.encrypt(Nonce::from_slice(&nonce), plain).map_err(err)?;
    let mut raw = nonce.to_vec();
    raw.extend(cipher);
    Ok(B64.encode(raw))
}
const AUTH_FAILED: &str = "Autenticazione AES-GCM fallita";
const REKEYED: &str = "La chiave del vault è stata cambiata su un altro dispositivo: sbloccalo con la password principale attuale.";
fn unseal(k: &[u8; 32], blob: &str) -> Res<Vec<u8>> {
    let raw = B64.decode(blob).map_err(err)?;
    if raw.len() < 28 {
        return Err("Blob cifrato non valido".into());
    }
    Aes256Gcm::new_from_slice(k)
        .map_err(err)?
        .decrypt(Nonce::from_slice(&raw[..12]), &raw[12..])
        .map_err(|_| AUTH_FAILED.into())
}
fn decode(v: &V, k: &str) -> Res<Vec<u8>> {
    B64.decode(s(v, k)).map_err(err)
}
fn recovery() -> String {
    let alphabet = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut out = String::new();
    let mut rng = OsRng;
    for i in 0..24 {
        if i > 0 && i % 4 == 0 {
            out.push('-')
        }
        let mut b = [0u8; 1];
        loop {
            rng.fill_bytes(&mut b);
            if b[0] < 224 {
                break;
            }
        }
        out.push(alphabet[(b[0] as usize) % alphabet.len()] as char)
    }
    out
}
/// Authentication of the vault header (version, salts, wrapped keys, `hv`) with a key
/// derived from the DEK: only someone who can open the vault can produce it. Without
/// it, a copy placed in the vault folder with an old header and a higher `hv` was
/// adopted, bringing back an old master password or making the vault unreadable.
fn header_mac_engine(dek: &[u8; 32], h: &V) -> Res<hmac::Hmac<sha2::Sha256>> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    let mut derive = <Hmac<Sha256> as Mac>::new_from_slice(dek).map_err(err)?;
    derive.update(b"jesse-archive header mac v1");
    let key = Zeroizing::new(derive.finalize().into_bytes());
    // serde_json maps keep their keys sorted: the same header always gives the same text.
    let fields = json!({"v":h["v"],"salt":h["salt"],"wrap":h["wrap"],"rsalt":h["rsalt"],"rwrap":h["rwrap"],"hv":h["hv"]});
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(&key).map_err(err)?;
    mac.update(&serde_json::to_vec(&fields).map_err(err)?);
    Ok(mac)
}
fn header_mac(dek: &[u8; 32], h: &V) -> Res<String> {
    use hmac::Mac;
    Ok(B64.encode(header_mac_engine(dek, h)?.finalize().into_bytes()))
}
/// Constant-time check of the header's `mac` (`verify_slice`).
fn header_mac_ok(dek: &[u8; 32], h: &V) -> bool {
    use hmac::Mac;
    match (B64.decode(s(h, "mac")), header_mac_engine(dek, h)) {
        (Ok(given), Ok(mac)) => mac.verify_slice(&given).is_ok(),
        _ => false,
    }
}
fn wrapped(secret: &str, dek: &[u8; 32]) -> Res<(String, String)> {
    let salt = rand_bytes::<16>();
    let wrap = seal(&*kdf(secret, &salt)?, dek)?;
    Ok((B64.encode(salt), wrap))
}
fn empty() -> V {
    json!({"items":[],"passwords":[],"folders":[],"deleted":{},"settings_upd":0,"settings":{"autolock":5,"clip":30,"old_days":180}})
}
/// Checks the top-level shape the rest of the core relies on (`arr`/`obj` and
/// indexing assume these types). Fills missing collections, rejects wrong types
/// instead of panicking later while the vault mutex is held.
fn ensure_shape(d: &mut V) -> Res<()> {
    let o = d.as_object_mut().ok_or("Dati del vault non validi")?;
    for k in ["items", "passwords", "folders"] {
        match o.entry(k).or_insert(json!([])) {
            V::Array(list) if list.iter().all(V::is_object) => {}
            _ => {
                return Err(format!(
                    "Dati del vault non validi: '{k}' non è un elenco di record"
                ))
            }
        }
    }
    for k in ["deleted", "groups", "settings"] {
        match o.get(k) {
            None if k != "deleted" => {}
            None | Some(V::Null) => {
                o.insert(k.into(), json!({}));
            }
            Some(V::Object(_)) => {}
            Some(_) => return Err(format!("Dati del vault non validi: '{k}' non è un oggetto")),
        }
    }
    o.entry("settings_upd").or_insert(json!(0));
    Ok(())
}
/// Rejects the whole JSON/.jshare payload at the first invalid record, so an
/// import is applied entirely or not at all.
fn validate_import(pl: &V) -> Res<()> {
    if !pl.is_object() {
        return Err("Importazione non valida: il file non contiene un oggetto JSON".into());
    }
    let list = |k: &str| -> Res<&[V]> {
        match pl.get(k) {
            None | Some(V::Null) => Ok(&[]),
            Some(V::Array(a)) => Ok(a.as_slice()),
            Some(_) => Err(format!("Importazione non valida: '{k}' non è un elenco")),
        }
    };
    let bad = |what: &str, i: usize, why: &str| -> String {
        format!("Importazione non valida: {what} n. {} {why}", i + 1)
    };
    for (i, f) in list("folders")?.iter().enumerate() {
        if !f.is_object() || !f["name"].is_string() {
            return Err(bad("cartella", i, "senza nome valido"));
        }
    }
    for (i, it) in list("items")?.iter().enumerate() {
        if !it.is_object() {
            return Err(bad("elemento", i, "non è un oggetto"));
        }
        if s(it, "id").is_empty() {
            return Err(bad("elemento", i, "senza identificativo"));
        }
        if fields(s(it, "type")).is_none() {
            return Err(bad("elemento", i, "ha un tipo sconosciuto"));
        }
        if !(it["title"].is_null() || it["title"].is_string()) {
            return Err(bad("elemento", i, "ha un titolo non valido"));
        }
        if !(it["f"].is_null() || it["f"].is_object()) {
            return Err(bad("elemento", i, "ha campi non validi"));
        }
    }
    for (i, p) in list("passwords")?.iter().enumerate() {
        if !p.is_object() || s(p, "id").is_empty() || !p["value"].is_string() {
            return Err(bad("password", i, "non valida"));
        }
    }
    Ok(())
}
fn fields(typ: &str) -> Option<&'static [&'static str]> {
    match typ {
        "login" => Some(&["url", "username", "password", "totp"]),
        "card" => Some(&["holder", "number", "expiry", "cvv", "pin"]),
        "note" => Some(&[]),
        "personal" => Some(&[
            "fullname", "email", "phone", "address", "city", "zip", "country", "birthday",
        ]),
        "passkey" => Some(&["url", "username", "credential"]),
        "crypto" => Some(&["platform", "address", "seed", "password"]),
        _ => None,
    }
}
fn secret(typ: &str) -> Option<&'static str> {
    match typ {
        "login" => Some("password"),
        "card" => Some("pin"),
        "crypto" => Some("password"),
        _ => None,
    }
}
fn ts(v: &V) -> f64 {
    for k in ["upd", "updated", "created"] {
        let n = num(v, k);
        if n != 0. {
            return n;
        }
    }
    0.
}
fn link(d: &mut V, it: &V, value: &str) {
    let ps = arr(d, "passwords");
    let iid = s(it, "id");
    let cur = ps
        .iter()
        .position(|p| s(p, "item_id") == iid && p["active"] == true);
    if let Some(idx) = cur {
        if s(&ps[idx], "value") == value {
            return;
        }
        ps[idx]["active"] = json!(false);
        ps[idx]["retired"] = json!(now());
        ps[idx]["upd"] = json!(now());
    }
    if value.is_empty() {
        return;
    }
    let ix = ps
        .iter()
        .position(|p| s(p, "value") == value && (p["item_id"].is_null() || s(p, "item_id") == iid));
    let mut p = if let Some(ix) = ix {
        ps[ix].clone()
    } else {
        json!({"id":id(),"value":value,"created":now(),"upd":now(),"source":"manual"})
    };
    p["item_id"] = json!(iid);
    p["active"] = json!(true);
    p["linked"] = json!(now());
    p["upd"] = json!(now());
    p["retired"] = V::Null;
    p["item_title"] = it["title"].clone();
    p["item_type"] = it["type"].clone();
    if let Some(ix) = ix {
        ps[ix] = p
    } else {
        ps.push(p)
    }
}
fn normalize(d: &mut V) -> bool {
    let mut changed = false;
    let fids: HashSet<String> = array(d, "folders")
        .iter()
        .map(|x| s(x, "id").to_string())
        .collect();
    let items = array(d, "items").to_vec();
    let iids: HashSet<String> = items.iter().map(|x| s(x, "id").to_string()).collect();
    for p in arr(d, "passwords") {
        if !p["item_id"].is_null() && !s(p, "item_id").is_empty() && !iids.contains(s(p, "item_id"))
        {
            p["orphan_of"] = p["item_title"].clone();
            p["item_id"] = V::Null;
            p["active"] = json!(false);
            p["upd"] = json!(now());
            changed = true
        }
    }
    for it in items {
        let iid = s(&it, "id").to_string();
        let mut edited = it.clone();
        if !s(&it, "folder").is_empty() && !fids.contains(s(&it, "folder")) {
            edited["folder"] = V::Null;
            changed = true
        }
        if let Some(sf) = secret(s(&it, "type")) {
            let val = s(&it["f"], sf);
            let act: Vec<_> = array(d, "passwords")
                .iter()
                .filter(|p| s(p, "item_id") == iid && p["active"] == true)
                .collect();
            if !(act.len() == 1 && s(act[0], "value") == val || (val.is_empty() && act.is_empty()))
            {
                link(d, &it, val);
                changed = true
            }
        }
        if let Some(x) = arr(d, "items").iter_mut().find(|x| s(x, "id") == iid) {
            *x = edited
        }
    }
    changed
}
fn merge_data(a: &mut V, b: &V) -> bool {
    let mut ch = false;
    for (k, v) in b
        .get("deleted")
        .and_then(V::as_object)
        .into_iter()
        .flatten()
    {
        if v.as_f64().unwrap_or(0.) > num(&a["deleted"], k) {
            obj(a, "deleted").insert(k.clone(), v.clone());
            ch = true
        }
    }
    for name in ["items", "passwords", "folders"] {
        for incoming in array(b, name) {
            if let Some(local) = arr(a, name)
                .iter_mut()
                .find(|x| s(x, "id") == s(incoming, "id"))
            {
                if ts(incoming) > ts(local) {
                    *local = incoming.clone();
                    ch = true
                }
            } else {
                arr(a, name).push(incoming.clone());
                ch = true
            }
        }
        let tomb = a["deleted"].clone();
        let before = arr(a, name).len();
        arr(a, name).retain(|x| num(&tomb, s(x, "id")) < ts(x));
        if arr(a, name).len() != before {
            ch = true
        }
    }
    if let Some(groups) = b.get("groups").and_then(V::as_object) {
        for (k, g) in groups {
            if a["groups"].get(k).map(|x| ts(g) > ts(x)).unwrap_or(true) {
                obj(a, "groups").insert(k.clone(), g.clone());
                ch = true
            }
        }
    }
    if num(b, "settings_upd") > num(a, "settings_upd") {
        a["settings"] = b["settings"].clone();
        a["settings_upd"] = b["settings_upd"].clone();
        ch = true
    }
    normalize(a) || ch
}
fn atomic_write(path: &Path, text: &[u8]) -> Res<()> {
    fs::create_dir_all(path.parent().ok_or("Directory mancante")?).map_err(err)?;
    let tmp = path.with_extension(format!("tmp-{}", id()));
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&tmp)
        .map_err(err)?;
    use std::io::Write;
    if let Err(e) = f.write_all(text).and_then(|_| f.sync_all()) {
        let _ = fs::remove_file(&tmp);
        return Err(err(e));
    }
    if path.exists() {
        fs::copy(path, path.with_extension("bak")).map_err(err)?;
    }
    if let Err(e) = fs::rename(&tmp, path) {
        #[cfg(windows)]
        {
            if path.exists() {
                // Windows rename cannot replace existing target; rollback via backup if replacement fails.
                let previous = path.with_extension(format!("old-{}", id()));
                fs::rename(path, &previous).map_err(err)?;
                match fs::rename(&tmp, path) {
                    Ok(_) => {
                        let _ = fs::remove_file(previous);
                        return Ok(());
                    }
                    Err(e2) => {
                        let _ = fs::rename(previous, path);
                        return Err(err(e2));
                    }
                }
            }
        }
        return Err(err(e));
    }
    Ok(())
}
fn sig(path: &Path) -> Option<(u64, u128)> {
    let m = fs::metadata(path).ok()?;
    let t = m
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_nanos();
    Some((m.len(), t))
}
pub struct Vault {
    pub path: PathBuf,
    config: PathBuf,
    key: Option<Zeroizing<[u8; 32]>>,
    header: V,
    data: V,
    last: f64,
    last_sync: f64,
    signature: Option<(u64, u128)>,
    push: bool,
    rev: u64,
    fails: u32,
}
/// Device configuration (`%APPDATA%/JesseArchive/config.json`): not encrypted, not
/// part of the vault; holds the vault path and per-device preferences.
fn device_config_path() -> PathBuf {
    dirs_config().join("JesseArchive").join("config.json")
}
fn read_config_key(path: &Path, k: &str) -> V {
    fs::read_to_string(path)
        .ok()
        .and_then(|t| serde_json::from_str::<V>(&t).ok())
        .and_then(|v| v.get(k).cloned())
        .unwrap_or(V::Null)
}
fn write_config_key(path: &Path, k: &str, val: V) -> Res<()> {
    let mut c = fs::read_to_string(path)
        .ok()
        .and_then(|t| serde_json::from_str::<V>(&t).ok())
        .filter(V::is_object)
        .unwrap_or(json!({}));
    c[k] = val;
    fs::create_dir_all(path.parent().ok_or("config path")?).map_err(err)?;
    fs::write(path, serde_json::to_vec(&c).map_err(err)?).map_err(err)
}
/// Wrong unlock attempts (password or recovery code) allowed without waiting; after
/// them each attempt waits 30 s, doubling up to 15 minutes. Against someone using the
/// app on this PC: a copy of the vault file is protected by scrypt, not by this.
const FREE_UNLOCK_ATTEMPTS: u32 = 5;
const MAX_UNLOCK_WAIT: f64 = 900.;
fn unlock_wait(fails: u32) -> f64 {
    match fails.checked_sub(FREE_UNLOCK_ATTEMPTS) {
        None => 0.,
        Some(extra) => (30. * 2f64.powi(extra.min(10) as i32)).min(MAX_UNLOCK_WAIT),
    }
}
/// Per-device preference that must work while the vault is locked (e.g. zoom).
pub fn device_pref(k: &str) -> V {
    read_config_key(&device_config_path(), k)
}
pub fn set_device_pref(k: &str, val: V) -> Res<()> {
    write_config_key(&device_config_path(), k, val)
}
impl Vault {
    pub fn new() -> Self {
        let root = std::env::current_exe()
            .ok()
            .and_then(|x| x.parent().map(Path::to_path_buf))
            .unwrap_or_else(|| PathBuf::from("."));
        let cfg = device_config_path();
        let loc = fs::read_to_string(&cfg)
            .ok()
            .and_then(|x| serde_json::from_str::<V>(&x).ok())
            .and_then(|x| x["vault"].as_str().map(PathBuf::from));
        let legacy = root.join("dati").join("jesse_archive.vault");
        let path = std::env::var("JESSE_ARCHIVE_VAULT")
            .ok()
            .map(PathBuf::from)
            .or(loc)
            .unwrap_or_else(|| {
                if legacy.exists() {
                    legacy
                } else {
                    dirs_data().join("JesseArchive").join("jesse_archive.vault")
                }
            });
        Self {
            path,
            config: cfg,
            key: None,
            header: V::Null,
            data: V::Null,
            last: now(),
            last_sync: now(),
            signature: None,
            push: false,
            rev: 0,
            fails: 0,
        }
    }
    pub fn unlocked(&self) -> bool {
        self.key.is_some()
    }
    /// Locks the vault when the auto-lock delay (`settings.autolock`, minutes,
    /// default 5, 0 = never) has passed since the last user activity. Called by
    /// every command and by the periodic expiry thread in `lib.rs`. Returns true
    /// only when this call performed the lock.
    pub fn expire_if_idle(&mut self) -> bool {
        if !self.unlocked() {
            return false;
        }
        let minutes = self.data["settings"]["autolock"].as_f64().unwrap_or(5.);
        if minutes > 0. && now() - self.last > minutes * 60. {
            self.lock();
            return true;
        }
        false
    }
    pub fn close_action(&self) -> String {
        self.pref("close_action")
            .as_str()
            .unwrap_or("quit")
            .to_string()
    }
    pub fn lock(&mut self) {
        self.key = None;
        self.header = V::Null;
        self.data = V::Null;
        self.last = now();
    }
    fn persist_config(&self) -> Res<()> {
        let mut c = fs::read_to_string(&self.config)
            .ok()
            .and_then(|t| serde_json::from_str::<V>(&t).ok())
            .unwrap_or(json!({}));
        c["vault"] = json!(self.path.to_string_lossy());
        fs::create_dir_all(self.config.parent().ok_or("config path")?).map_err(err)?;
        fs::write(&self.config, serde_json::to_vec(&c).map_err(err)?).map_err(err)
    }
    fn pref(&self, k: &str) -> V {
        read_config_key(&self.config, k)
    }
    fn set_pref(&self, k: &str, val: V) -> Res<()> {
        write_config_key(&self.config, k, val)
    }
    fn read(&self, path: &Path) -> Res<(V, V)> {
        let h: V = serde_json::from_slice(&fs::read(path).map_err(err)?).map_err(err)?;
        let plain = unseal(&**self.key.as_ref().ok_or("Vault bloccato")?, s(&h, "data"))?;
        let mut d = serde_json::from_slice(&plain).map_err(err)?;
        ensure_shape(&mut d)?;
        Ok((h, d))
    }
    /// Takes the header of another copy only if it is newer and authenticated with the
    /// current key: an old header with an inflated `hv`, or one without `mac` (written by
    /// a version before 1.6.0), is ignored.
    fn adopt(&mut self, h: &V) {
        let Some(key) = self.key.as_ref() else {
            return;
        };
        if num(h, "hv") > num(&self.header, "hv") && header_mac_ok(key, h) {
            let mut v = h.clone();
            v.as_object_mut().map(|o| o.remove("data"));
            self.header = v
        }
    }
    fn pull(&mut self) -> Res<()> {
        if self.key.is_none() {
            return Ok(());
        }
        let sign = sig(&self.path);
        if sign.is_some() && sign != self.signature {
            match self.read(&self.path) {
                Ok((h, remote)) => {
                    if merge_data(&mut self.data, &remote) {
                        self.rev += 1;
                    }
                    self.adopt(&h);
                    self.push |= self.data != remote || num(&h, "hv") < num(&self.header, "hv");
                    self.signature = sign;
                }
                // The file is readable but this key no longer opens it: another device
                // re-encrypted the vault with a new key. Writing now would overwrite its
                // data with the old key, so this session closes instead.
                Err(e) if e == AUTH_FAILED => {
                    self.lock();
                    return Err(REKEYED.into());
                }
                // Partial write of a sync client: retried at the next synchronization.
                Err(_) => {}
            }
        }
        // Do not rename conflict files automatically: preserve cloud copies until the user has a verified backup.
        if let Some(parent) = self.path.parent().map(Path::to_path_buf) {
            if let Ok(iter) = fs::read_dir(&parent) {
                for f in iter.flatten() {
                    let p = f.path();
                    if p == self.path
                        || p.extension().and_then(|e| e.to_str()) != Some("vault")
                        || !p
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .starts_with("jesse_archive")
                    {
                        continue;
                    }
                    if let Ok((h, r)) = self.read(&p) {
                        let changed = merge_data(&mut self.data, &r);
                        if changed {
                            self.rev += 1;
                        }
                        self.adopt(&h);
                        self.push |= changed || num(&h, "hv") < num(&self.header, "hv");
                    }
                }
            }
        }
        self.last_sync = now();
        Ok(())
    }
    /// Applies `change` to the data and saves; on any error restores the previous
    /// in-memory state (data, header, file signature) so a failed import or write
    /// never leaves a half-applied vault in memory.
    fn transact<T>(&mut self, change: impl FnOnce(&mut V) -> Res<T>) -> Res<T> {
        let snapshot = (self.data.clone(), self.header.clone(), self.signature);
        let result = change(&mut self.data).and_then(|out| self.save().map(|_| out));
        if result.is_err() {
            (self.data, self.header, self.signature) = snapshot;
        }
        result
    }
    fn save(&mut self) -> Res<()> {
        self.pull()?;
        self.write_out()
    }
    /// Writes the vault with the current key; the header is authenticated every time.
    fn write_out(&mut self) -> Res<()> {
        let key = Zeroizing::new(**self.key.as_ref().ok_or("Vault bloccato")?);
        self.header["mac"] = json!(header_mac(&key, &self.header)?);
        let mut h = self.header.clone();
        h["data"] = json!(seal(&key, &serde_json::to_vec(&self.data).map_err(err)?)?);
        atomic_write(&self.path, &serde_json::to_vec(&h).map_err(err)?)?;
        self.signature = sig(&self.path);
        self.push = false;
        self.rev += 1;
        Ok(())
    }
    /// New data key: everything is re-encrypted, the master password is wrapped again
    /// and a new recovery code is created (the old one cannot be re-wrapped: only its
    /// wrapped form is known). Old passwords, recovery codes and copies of the header
    /// no longer open the data written from now on; existing backups still do.
    fn rotate_key(&mut self, password: &str) -> Res<String> {
        // Merge what other devices wrote while the old key still opens it.
        self.pull()?;
        let dek = Zeroizing::new(rand_bytes::<32>());
        let rec = recovery();
        let (salt, wrap) = wrapped(password, &dek)?;
        let (rsalt, rwrap) = wrapped(&key(&rec), &dek)?;
        let snapshot = (self.key.clone(), self.header.clone());
        for (k, v) in [
            ("salt", salt),
            ("wrap", wrap),
            ("rsalt", rsalt),
            ("rwrap", rwrap),
        ] {
            self.header[k] = json!(v);
        }
        self.header["hv"] = json!(now());
        self.key = Some(dek);
        if let Err(e) = self.write_out() {
            (self.key, self.header) = snapshot;
            return Err(e);
        }
        Ok(rec)
    }
    fn state(&self) -> V {
        let mut d = self.data.clone();
        d["path"] = json!(self.path.to_string_lossy());
        d["synced_at"] = json!(self.last_sync);
        d["prefs"] = json!({"close":self.pref("close_action").as_str().unwrap_or("quit"),"autostart":autostart_get(),"tray_ok":true,"native":true,"win":cfg!(windows)});
        d
    }
    fn check_master(&self, pw: &str) -> Res<()> {
        unseal(
            &*kdf(pw, &decode(&self.header, "salt")?)?,
            s(&self.header, "wrap"),
        )
        .map(|_| ())
        .map_err(|_| "Password principale non corretta".into())
    }
    fn find(&self, iid: &str) -> Res<V> {
        array(&self.data, "items")
            .iter()
            .find(|x| s(x, "id") == iid)
            .cloned()
            .ok_or_else(|| "Elemento non trovato".into())
    }
    fn secure_reset(&mut self) {
        self.lock();
        self.fails = 0;
        self.signature = None;
        self.push = false;
    }
    pub fn call(&mut self, name: &str, b: V) -> Res<V> {
        let open = [
            "status", "create", "unlock", "ping", "suggest", "loc_use", "show",
        ];
        // Expiry applies to every command, including ping/status: they then simply
        // report `unlocked: false`.
        if self.expire_if_idle() && !open.contains(&name) {
            return Err("Sessione scaduta: vault bloccato".into());
        }
        if !open.contains(&name) && !self.unlocked() {
            return Err("Vault bloccato".into());
        }
        // Read-only commands a screen may call by itself (dashboard widgets, polling)
        // must not postpone the inactivity lock.
        if !["ping", "status", "browser_state", "health", "backup_info"].contains(&name) {
            self.last = now()
        }
        match name {
            "status" => Ok(
                json!({"exists":self.path.exists(),"unlocked":self.unlocked(),"path":self.path.to_string_lossy()}),
            ),
            "ping" => {
                if self.unlocked() {
                    self.pull()?;
                    if self.push {
                        self.save()?;
                    }
                }
                Ok(json!({"ok":1,"unlocked":self.unlocked(),"rev":self.rev}))
            }
            "create" => {
                if self.path.exists() {
                    return Err("Esiste già un vault".into());
                }
                let pw = s(&b, "password");
                if !long_enough(pw) {
                    return Err("Password principale: minimo 8 caratteri".into());
                }
                let dek = Zeroizing::new(rand_bytes::<32>());
                let rec = recovery();
                let (salt, wrap) = wrapped(pw, &dek)?;
                let (rsalt, rwrap) = wrapped(&key(&rec), &dek)?;
                self.header =
                    json!({"v":1,"salt":salt,"wrap":wrap,"rsalt":rsalt,"rwrap":rwrap,"hv":now()});
                self.key = Some(dek);
                self.data = empty();
                self.save()?;
                Ok(json!({"recovery":rec}))
            }
            "unlock" => {
                if !self.path.exists() {
                    return Err("Nessun vault trovato".into());
                }
                // Wrong attempts are counted in the device configuration, so restarting
                // the app does not reset them. The remaining wait is bounded, so moving
                // the clock back cannot lock the user out for longer.
                let fails = self.fails.max(
                    read_config_key(&self.config, "unlock_fails")
                        .as_u64()
                        .unwrap_or(0)
                        .min(u32::MAX as u64) as u32,
                );
                let last_fail = read_config_key(&self.config, "unlock_last_fail")
                    .as_f64()
                    .unwrap_or(0.);
                let wait = unlock_wait(fails);
                let remaining = (last_fail + wait - now()).clamp(0., wait);
                if remaining > 0. {
                    return Err(format!(
                        "Troppi tentativi errati: riprova tra {} secondi",
                        remaining.ceil() as u64
                    ));
                }
                let h: V =
                    serde_json::from_slice(&fs::read(&self.path).map_err(err)?).map_err(err)?;
                let is_rec = !s(&b, "recovery").is_empty();
                let new_password = if is_rec { s(&b, "new_password") } else { "" };
                // Checked before decryption so a rejected password never leaves the vault unlocked.
                if !new_password.is_empty() && !long_enough(new_password) {
                    return Err("Nuova password: minimo 8 caratteri".into());
                }
                let (salt, blob, pass) = if is_rec {
                    (decode(&h, "rsalt")?, s(&h, "rwrap"), key(s(&b, "recovery")))
                } else {
                    (
                        decode(&h, "salt")?,
                        s(&h, "wrap"),
                        s(&b, "password").to_string(),
                    )
                };
                let decryption = (|| -> Res<(Zeroizing<[u8; 32]>, V)> {
                    let bytes = unseal(&*kdf(&pass, &salt)?, blob)?;
                    let dek: [u8; 32] = bytes.try_into().map_err(|_| "DEK non valida")?;
                    let dek = Zeroizing::new(dek);
                    let data: V =
                        serde_json::from_slice(&unseal(&dek, s(&h, "data"))?).map_err(err)?;
                    Ok((dek, data))
                })();
                let (dek, mut data) = match decryption {
                    Ok(x) => x,
                    Err(_) => {
                        self.fails = fails.saturating_add(1);
                        // Best effort: if the configuration cannot be written, the count
                        // still applies in memory until the app closes.
                        let _ = write_config_key(&self.config, "unlock_fails", json!(self.fails));
                        let _ = write_config_key(&self.config, "unlock_last_fail", json!(now()));
                        let wait = unlock_wait(self.fails);
                        if wait > 0. {
                            return Err(format!(
                                "Password o codice di recupero non corretti. Troppi tentativi: riprova tra {} secondi",
                                wait as u64
                            ));
                        }
                        return Err("Password o codice di recupero non corretti".into());
                    }
                };
                ensure_shape(&mut data)?;
                if fails > 0 {
                    let _ = write_config_key(&self.config, "unlock_fails", json!(0));
                    let _ = write_config_key(&self.config, "unlock_last_fail", V::Null);
                }
                self.header = h;
                self.header.as_object_mut().unwrap().remove("data");
                self.key = Some(dek);
                self.data = data;
                self.fails = 0;
                self.signature = sig(&self.path);
                self.push = false;
                if !new_password.is_empty() {
                    let (salt, wrap) = wrapped(new_password, self.key.as_ref().unwrap())?;
                    self.header["salt"] = json!(salt);
                    self.header["wrap"] = json!(wrap);
                    self.header["hv"] = json!(now());
                    self.save()?
                } else {
                    self.pull()?
                }
                Ok(json!({"ok":1}))
            }
            "lock" => {
                self.lock();
                Ok(json!({"ok":1}))
            }
            "touch" | "show" => Ok(json!({"ok":1})),
            "state" | "browser_state" => {
                self.pull()?;
                if self.push {
                    self.save()?;
                }
                Ok(self.state())
            }
            "item" => {
                let mut it = self.data["items"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .find(|x| s(x, "id") == s(&b, "id") && !s(&b, "id").is_empty())
                    .cloned()
                    .unwrap_or(
                        json!({"id":id(),"created":now(),"trashed":null,"shared":false,"f":{}}),
                    );
                if fields(s(&it, "type")).is_none() && fields(s(&b, "type")).is_none() {
                    return Err("Tipo non valido".into());
                }
                for k in ["type", "title", "folder", "fav", "f", "notes"] {
                    if let Some(v) = b.get(k) {
                        it[k] = v.clone()
                    }
                }
                it["title"] = json!(s(&it, "title").trim().to_string());
                if s(&it, "title").is_empty() {
                    it["title"] = json!("Senza titolo")
                }
                it["updated"] = json!(now());
                if let Some(g) = b.get("group") {
                    let gk = s(g, "key");
                    if !gk.is_empty() && s(&it, "type") == "login" {
                        let gk: String = gk.chars().take(200).collect();
                        it["gk"] = json!(gk);
                        it["src"] = json!(if s(g, "src").is_empty() {
                            "web"
                        } else {
                            s(g, "src")
                        });
                        let ic = s(g, "icon");
                        let ic = if ic.starts_with("data:image/") && ic.len() < 250000 {
                            ic
                        } else {
                            ""
                        };
                        if self.data["groups"].get(&gk).is_none() {
                            obj(&mut self.data,"groups").insert(gk.clone(),json!({"name":if s(g,"name").is_empty(){gk.as_str()}else{s(g,"name")},"src":it["src"],"icon":ic,"upd":now()}));
                        } else if !ic.is_empty() {
                            self.data["groups"][&gk]["icon"] = json!(ic);
                            self.data["groups"][&gk]["upd"] = json!(now())
                        }
                    }
                }
                let iid = s(&it, "id").to_string();
                if let Some(x) = arr(&mut self.data, "items")
                    .iter_mut()
                    .find(|x| s(x, "id") == iid)
                {
                    *x = it.clone()
                } else {
                    arr(&mut self.data, "items").push(it.clone())
                }
                if let Some(sf) = secret(s(&it, "type")) {
                    link(&mut self.data, &it, s(&it["f"], sf))
                }
                for p in arr(&mut self.data, "passwords") {
                    if s(p, "item_id") == iid {
                        p["item_title"] = it["title"].clone();
                        p["item_type"] = it["type"].clone()
                    }
                }
                self.save()?;
                Ok(json!({"id":iid,"state":self.state()}))
            }
            "trash" => {
                let it = self.find(s(&b, "id"))?;
                let iid = s(&it, "id");
                for i in arr(&mut self.data, "items") {
                    if s(i, "id") == iid {
                        i["trashed"] = if b["restore"] == true {
                            V::Null
                        } else {
                            json!(now())
                        };
                        i["updated"] = json!(now());
                    }
                }
                self.save()?;
                Ok(json!({"state":self.state()}))
            }
            "delete" => {
                let ids: HashSet<String> = array(&self.data, "items")
                    .iter()
                    .filter(|i| {
                        s(i, "id") == s(&b, "id") || (b["all"] == true && !i["trashed"].is_null())
                    })
                    .map(|i| s(i, "id").to_string())
                    .collect();
                self.delete_ids(&ids);
                self.save()?;
                Ok(json!({"state":self.state()}))
            }
            "bulk" => {
                let op = s(&b, "op");
                let ids: HashSet<String> = array(&b, "ids")
                    .iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect();
                let mut count = 0;
                if op == "delete" {
                    let dead: HashSet<_> = array(&self.data, "items")
                        .iter()
                        .filter(|i| ids.contains(s(i, "id")) && !i["trashed"].is_null())
                        .map(|i| s(i, "id").to_string())
                        .collect();
                    count = dead.len();
                    self.delete_ids(&dead)
                } else if ["trash", "restore", "move"].contains(&op) {
                    if op == "move"
                        && !s(&b, "folder").is_empty()
                        && !array(&self.data, "folders")
                            .iter()
                            .any(|f| s(f, "id") == s(&b, "folder"))
                    {
                        return Err("Cartella non trovata".into());
                    }
                    for i in arr(&mut self.data, "items") {
                        if ids.contains(s(i, "id")) {
                            count += 1;
                            match op {
                                "trash" => i["trashed"] = json!(now()),
                                "restore" => i["trashed"] = V::Null,
                                _ => {
                                    i["folder"] = b
                                        .get("folder")
                                        .cloned()
                                        .filter(|v| !v.as_str().unwrap_or("").is_empty())
                                        .unwrap_or(V::Null)
                                }
                            }
                            i["updated"] = json!(now());
                        }
                    }
                } else {
                    return Err("Operazione non valida".into());
                }
                self.save()?;
                Ok(json!({"state":self.state(),"count":count}))
            }
            "folder" => {
                if b["delete"] == true {
                    let fid = s(&b, "id").to_string();
                    obj(&mut self.data, "deleted").insert(fid.clone(), json!(now()));
                    arr(&mut self.data, "folders").retain(|x| s(x, "id") != fid);
                    for i in arr(&mut self.data, "items") {
                        if s(i, "folder") == fid {
                            i["folder"] = V::Null;
                            i["updated"] = json!(now())
                        }
                    }
                } else {
                    let name = s(&b, "name").trim();
                    if name.is_empty() {
                        return Err("Dai un nome alla cartella".into());
                    }
                    if let Some(x) = arr(&mut self.data, "folders")
                        .iter_mut()
                        .find(|x| s(x, "id") == s(&b, "id") && !s(&b, "id").is_empty())
                    {
                        x["name"] = json!(name);
                        x["upd"] = json!(now())
                    } else {
                        arr(&mut self.data, "folders")
                            .push(json!({"id":id(),"name":name,"upd":now()}))
                    }
                }
                self.save()?;
                Ok(json!({"state":self.state()}))
            }
            "pw_save" => {
                let val = s(&b, "value");
                if val.is_empty() {
                    return Err("Password vuota".into());
                }
                if !array(&self.data, "passwords")
                    .iter()
                    .any(|p| s(p, "value") == val)
                {
                    arr(&mut self.data,"passwords").push(json!({"id":id(),"value":val,"created":now(),"upd":now(),"source":b.get("source").cloned().unwrap_or(json!("generated")),"item_id":null,"active":false,"label":s(&b,"label")}));
                    self.save()?
                }
                Ok(json!({"state":self.state()}))
            }
            "pw_link" => {
                let p = array(&self.data, "passwords")
                    .iter()
                    .find(|p| s(p, "id") == s(&b, "pid"))
                    .cloned()
                    .ok_or("Password non trovata")?;
                let mut it = self.find(s(&b, "item_id"))?;
                let sf = secret(s(&it, "type")).ok_or("Tipo senza password collegabile")?;
                it["f"][sf] = p["value"].clone();
                it["updated"] = json!(now());
                let iid = s(&it, "id");
                if let Some(x) = arr(&mut self.data, "items")
                    .iter_mut()
                    .find(|x| s(x, "id") == iid)
                {
                    *x = it.clone()
                }
                link(&mut self.data, &it, s(&p, "value"));
                self.save()?;
                Ok(json!({"state":self.state()}))
            }
            "pw_del" | "pw_bulk" => {
                let ids: HashSet<String> = if name == "pw_del" {
                    [s(&b, "pid").to_string()].into()
                } else {
                    array(&b, "pids")
                        .iter()
                        .filter_map(|x| x.as_str().map(str::to_string))
                        .collect()
                };
                let dead: HashSet<_> = array(&self.data, "passwords")
                    .iter()
                    .filter(|p| {
                        ids.contains(s(p, "id"))
                            && !(p["active"] == true && !s(p, "item_id").is_empty())
                    })
                    .map(|p| s(p, "id").to_string())
                    .collect();
                if name == "pw_del" && dead.is_empty() {
                    return Err("Password attuale: modificala nell'elemento".into());
                }
                for i in &dead {
                    obj(&mut self.data, "deleted").insert(i.clone(), json!(now()));
                }
                arr(&mut self.data, "passwords").retain(|p| !dead.contains(s(p, "id")));
                self.save()?;
                Ok(json!({"state":self.state(),"count":dead.len(),"skipped":ids.len()-dead.len()}))
            }
            "generate" => Ok(json!({"results":generate(&b)?})),
            // Backup status for the dashboard: the rolling `.bak` written by
            // atomic_write before every save, and the last merge with cloud copies.
            "backup_info" => {
                let modified = |p: &Path| -> V {
                    fs::metadata(p)
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| json!(d.as_secs_f64()))
                        .unwrap_or(V::Null)
                };
                let bak = self.path.with_extension("bak");
                Ok(json!({
                    "path": self.path.to_string_lossy(),
                    "folder": self.path.parent().map(|p| p.to_string_lossy().to_string()),
                    "modified": modified(&self.path),
                    "bak_exists": bak.exists(),
                    "bak_modified": modified(&bak),
                    "synced_at": self.last_sync,
                }))
            }
            "health" => Ok(health(&self.data)),
            "totp" => {
                let it = self.find(s(&b, "id"))?;
                let t = now() as u64;
                Ok(json!({"code":totp(s(&it["f"],"totp"),t)?,"left":30-t%30}))
            }
            "breach" => Ok(json!({"results":breaches(&self.data)?})),
            "settings" => {
                for k in ["autolock", "clip", "old_days", "logos"] {
                    if let Some(n) = b.get(k).and_then(V::as_i64) {
                        self.data["settings"][k] = json!(n.max(0))
                    }
                }
                if let Some(t) = b.get("theme") {
                    if t.is_object() {
                        self.data["settings"]["theme"] = t.clone()
                    }
                }
                // Dashboard layout (widget types, sizes, options; no secrets). The UI
                // normalizes it; here only the shape and size are bounded.
                if let Some(d) = b.get("dashboard") {
                    if !d.is_object() || d.to_string().len() > 32 * 1024 {
                        return Err("Configurazione della dashboard non valida".into());
                    }
                    self.data["settings"]["dashboard"] = d.clone()
                }
                // Recently used items (Dashboard widget and Global Quick Search): item ids only.
                if let Some(r) = b.get("recent") {
                    let ids = r.as_array().filter(|a| {
                        a.len() <= 12
                            && a.iter().all(|x| {
                                x.as_str().is_some_and(|s| !s.is_empty() && s.len() <= 128)
                            })
                    });
                    let Some(ids) = ids else {
                        return Err("Elenco degli usati di recente non valido".into());
                    };
                    self.data["settings"]["recent"] = json!(ids);
                }
                // Sites where the browser extension never offers to save accounts.
                if let Some(n) = b.get("never_save") {
                    let ok = n.as_array().is_some_and(|a| {
                        a.len() <= 500
                            && a.iter().all(|x| {
                                x.as_str().is_some_and(|s| !s.is_empty() && s.len() <= 260)
                            })
                    });
                    if !ok {
                        return Err("Elenco dei siti esclusi non valido".into());
                    }
                    self.data["settings"]["never_save"] = n.clone();
                }
                self.data["settings_upd"] = json!(now());
                self.save()?;
                Ok(json!({"state":self.state()}))
            }
            "master" => {
                self.check_master(s(&b, "old"))?;
                if !long_enough(s(&b, "new")) {
                    return Err("Minimo 8 caratteri".into());
                }
                // "The old password may have been discovered": new data key as well.
                if b["rotate"] == true {
                    let rec = self.rotate_key(s(&b, "new"))?;
                    return Ok(json!({"ok":1,"recovery":rec}));
                }
                let (salt, wrap) = wrapped(s(&b, "new"), self.key.as_ref().unwrap())?;
                self.header["salt"] = json!(salt);
                self.header["wrap"] = json!(wrap);
                self.header["hv"] = json!(now());
                self.save()?;
                Ok(json!({"ok":1}))
            }
            "recovery_new" => {
                self.check_master(s(&b, "password"))?;
                // A new recovery code is made when the old one may be known: the data
                // key changes too, so the old code no longer opens anything new.
                let rec = self.rotate_key(s(&b, "password"))?;
                Ok(json!({"recovery":rec}))
            }
            "pack" => {
                let pw = s(&b, "passphrase");
                if !long_enough(pw) {
                    return Err("Passphrase: minimo 8 caratteri".into());
                }
                let ids: HashSet<String> = array(&b, "ids")
                    .iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect();
                let items: Vec<V> = array(&self.data, "items")
                    .iter()
                    .filter(|i| ids.is_empty() || ids.contains(s(i, "id")))
                    .cloned()
                    .collect();
                let iset: HashSet<String> = items.iter().map(|i| s(i, "id").to_string()).collect();
                if !ids.is_empty() {
                    for i in arr(&mut self.data, "items") {
                        if iset.contains(s(i, "id")) {
                            i["shared"] = json!(true)
                        }
                    }
                    self.save()?
                }
                let ps: Vec<V> = array(&self.data, "passwords")
                    .iter()
                    .filter(|p| {
                        iset.contains(s(p, "item_id"))
                            || (ids.is_empty() && s(p, "item_id").is_empty())
                    })
                    .cloned()
                    .collect();
                let payload = json!({"folders":self.data["folders"],"items":items,"passwords":ps});
                let salt = rand_bytes::<16>();
                let blob = seal(
                    &*kdf(pw, &salt)?,
                    &serde_json::to_vec(&payload).map_err(err)?,
                )?;
                Ok(
                    json!({"data":json!({"jessamine":1,"salt":B64.encode(salt),"blob":blob}).to_string(),"state":self.state()}),
                )
            }
            "unpack" => {
                let pkg: V =
                    serde_json::from_str(s(&b, "data")).map_err(|_| "Pacchetto non valido")?;
                let salt = decode(&pkg, "salt")?;
                let pl: V = serde_json::from_slice(&unseal(
                    &*kdf(s(&b, "passphrase"), &salt)?,
                    s(&pkg, "blob"),
                )?)
                .map_err(|_| "Passphrase errata o pacchetto non valido")?;
                validate_import(&pl)?;
                let n = self.transact(|d| Ok(merge_import(d, &pl)))?;
                Ok(json!({"count":n,"state":self.state()}))
            }
            "export" => {
                let text = export_text(&self.data, s(&b, "format"))?;
                Ok(json!({"text":text}))
            }
            "import" => {
                let text = s(&b, "text").trim_start_matches('\u{feff}');
                let mapping = import_mapping(&b);
                let n = match import_format(text)? {
                    ImportFormat::Own(pl) => {
                        validate_import(&pl)?;
                        self.transact(|d| Ok(merge_import(d, &pl)))?
                    }
                    ImportFormat::Bitwarden(pl) => {
                        let entries = crate::importers::parse_bitwarden(&pl)?;
                        self.transact(|d| Ok(add_entries(d, entries)))?
                    }
                    ImportFormat::KeePass => {
                        let entries = crate::importers::parse_keepass(text)?;
                        self.transact(|d| Ok(add_entries(d, entries)))?
                    }
                    ImportFormat::Kaspersky => self.transact(|d| import_kaspersky(d, text))?,
                    ImportFormat::Csv => {
                        self.transact(|d| import_csv(d, text, mapping.as_ref()))?
                    }
                };
                Ok(json!({"count":n,"state":self.state()}))
            }
            // What an import would do, without writing: program recognized, number of
            // items and, for a CSV, the columns with their field (passwords never shown).
            "import_preview" => {
                let text = s(&b, "text").trim_start_matches('\u{feff}');
                let mapping = import_mapping(&b);
                let (format, source, count, columns) = match import_format(text)? {
                    ImportFormat::Own(pl) => {
                        validate_import(&pl)?;
                        (
                            "json",
                            "Jesse's Archive",
                            array(&pl, "items").len(),
                            V::Null,
                        )
                    }
                    ImportFormat::Bitwarden(pl) => (
                        "json",
                        "Bitwarden",
                        crate::importers::parse_bitwarden(&pl)?.len(),
                        V::Null,
                    ),
                    ImportFormat::KeePass => (
                        "xml",
                        "KeePass / KeePassXC",
                        crate::importers::parse_keepass(text)?.len(),
                        V::Null,
                    ),
                    ImportFormat::Kaspersky => (
                        "txt",
                        "Kaspersky Password Manager",
                        import_kaspersky(&mut empty(), text)?,
                        V::Null,
                    ),
                    ImportFormat::Csv => {
                        let columns = crate::importers::csv_columns(text, mapping.as_ref())?;
                        let headers: Vec<String> = columns.iter().map(|c| c.0.clone()).collect();
                        (
                            "csv",
                            crate::importers::csv_source(&headers),
                            crate::importers::parse_csv(text, &columns)?.len(),
                            crate::importers::column_preview(text, &columns),
                        )
                    }
                };
                Ok(json!({"format":format,"source":source,"count":count,"columns":columns}))
            }
            "group_edit" => {
                let k = s(&b, "key");
                if k.is_empty() {
                    return Err("Gruppo mancante".into());
                }
                let mut g = self.data["groups"].get(k).cloned().unwrap_or(
                    json!({"name":k,"src":k.split(':').next().unwrap_or("web"),"icon":""}),
                );
                if !s(&b, "name").trim().is_empty() {
                    g["name"] = json!(s(&b, "name").trim().chars().take(80).collect::<String>())
                }
                let ic = s(&b, "icon");
                if ic == "-" {
                    g["icon"] = json!("");
                    g["tried"] = json!(0)
                } else if ic.starts_with("data:image/") && ic.len() < 250000 {
                    g["icon"] = json!(ic)
                }
                g["upd"] = json!(now());
                obj(&mut self.data, "groups").insert(k.to_string(), g);
                self.save()?;
                Ok(json!({"state":self.state()}))
            }
            "group_logo" => {
                let key = s(&b, "key");
                let dom = key.strip_prefix("web:").unwrap_or("");
                let valid = regex::Regex::new(r"^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$").unwrap();
                if !valid.is_match(dom) || self.data["settings"]["logos"] == 0 {
                    return Ok(json!({"found":false}));
                }
                let existing = self.data["groups"]
                    .get(key)
                    .cloned()
                    .unwrap_or(json!({"name":dom,"icon":"","src":"web","upd":now()}));
                if !s(&existing, "icon").is_empty() || now() - num(&existing, "tried") < 604800. {
                    return Ok(json!({"found":false}));
                }
                let url = format!("https://icons.duckduckgo.com/ip3/{dom}.ico");
                let got = reqwest::blocking::Client::builder()
                    .timeout(std::time::Duration::from_secs(6))
                    .build()
                    .map_err(err)?
                    .get(url)
                    .send();
                let mut g = existing;
                if let Ok(resp) = got {
                    if resp.status().is_success() {
                        let ct = resp
                            .headers()
                            .get(reqwest::header::CONTENT_TYPE)
                            .and_then(|x| x.to_str().ok())
                            .unwrap_or("image/x-icon")
                            .to_owned();
                        if let Ok(bytes) = resp.bytes() {
                            if bytes.len() > 100 && bytes.len() <= 200000 {
                                g["icon"] = json!(format!(
                                    "data:{};base64,{}",
                                    if ct.starts_with("image/") {
                                        ct.as_str()
                                    } else {
                                        "image/x-icon"
                                    },
                                    B64.encode(bytes)
                                ));
                            }
                        }
                    }
                    g["tried"] = json!(now());
                    g["upd"] = json!(now());
                    obj(&mut self.data, "groups").insert(key.to_owned(), g.clone());
                    self.save()?;
                    return Ok(json!({"found":!s(&g,"icon").is_empty(),"state":self.state()}));
                }
                Ok(json!({"found":false}))
            }
            "apps" => Ok(json!({"apps":installed_apps()})),
            "app_icon" => Ok(json!({"icon":app_icon(s(&b,"path"))?})),
            // Application chosen by hand ("Sfoglia…"): its display name and icon.
            "app_info" => {
                let p = s(&b, "path");
                Ok(json!({"name":app_name(p)?,"icon":app_icon(p)?}))
            }
            "prefs_set" => {
                if let Some(c) = b.get("close_action").and_then(V::as_str) {
                    if c != "quit" && c != "tray" {
                        return Err("Preferenza non valida".into());
                    }
                    self.set_pref("close_action", json!(c))?
                }
                if let Some(a) = b.get("autostart") {
                    autostart_set(a == true || a == 1 || a == "1")?
                }
                Ok(json!({"state":self.state()}))
            }
            "suggest" => Ok(json!({"dirs":discover_cloud_directories()})),
            "loc_use" => {
                let folder = PathBuf::from(s(&b, "folder"));
                let c = [
                    folder.join("jesse_archive.vault"),
                    folder.join("JesseArchive").join("jesse_archive.vault"),
                ];
                let p = c
                    .into_iter()
                    .find(|x| x.is_file())
                    .ok_or("Nessun vault trovato nella cartella")?;
                self.secure_reset();
                self.path = p;
                self.persist_config()?;
                Ok(json!({"ok":1}))
            }
            "loc_move" => {
                let folder = PathBuf::from(s(&b, "folder"));
                if !folder.is_dir() {
                    return Err("La cartella non esiste".into());
                }
                let dest = if folder.file_name().and_then(|x| x.to_str()) == Some("JesseArchive") {
                    folder
                } else {
                    folder.join("JesseArchive")
                };
                let next = dest.join("jesse_archive.vault");
                if next.exists() {
                    return Err("La destinazione contiene già un vault".into());
                }
                self.save()?;
                fs::create_dir_all(&dest).map_err(err)?;
                fs::copy(&self.path, &next).map_err(err)?;
                let src_hash = sha2hash(&fs::read(&self.path).map_err(err)?);
                let dst_hash = sha2hash(&fs::read(&next).map_err(err)?);
                if src_hash != dst_hash {
                    return Err("Verifica della copia fallita; originale conservato".into());
                }
                let backup = self.path.with_extension("bak");
                if backup.exists() {
                    let _ = fs::copy(backup, dest.join("jesse_archive.bak"));
                }
                self.path = next;
                self.persist_config()?;
                self.signature = sig(&self.path);
                Ok(json!({"state":self.state()}))
            }
            _ => Err(format!("Comando sconosciuto: {name}")),
        }
    }
    fn delete_ids(&mut self, ids: &HashSet<String>) {
        for p in arr(&mut self.data, "passwords") {
            if ids.contains(s(p, "item_id")) {
                p["orphan_of"] = p["item_title"].clone();
                p["item_id"] = V::Null;
                p["active"] = json!(false);
                p["upd"] = json!(now());
            }
        }
        for i in ids {
            obj(&mut self.data, "deleted").insert(i.clone(), json!(now()));
        }
        arr(&mut self.data, "items").retain(|x| !ids.contains(s(x, "id")));
    }
}
fn sha2hash(b: &[u8]) -> String {
    use sha2::Digest;
    hex::encode(sha2::Sha256::digest(b))
}
// Cartelle cloud locali: la ricerca non invia dati in rete e non modifica il vault.
// Si evitano scansioni ricorsive dell'intero disco e chiamate a PowerShell/CMD.
fn discover_cloud_directories() -> Vec<String> {
    let mut found: Vec<PathBuf> = Vec::new();
    let add = |path: PathBuf, found: &mut Vec<PathBuf>| {
        if path.is_dir()
            && !found.iter().any(|p| {
                p.to_string_lossy()
                    .eq_ignore_ascii_case(&path.to_string_lossy())
            })
        {
            found.push(path);
        }
    };
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_default();
    if home.is_dir() {
        // Include OneDrive - Personal, OneDrive - Azienda, e gli altri nomi locali più diffusi.
        let names = [
            "OneDrive",
            "Dropbox",
            "Google Drive",
            "My Drive",
            "iCloudDrive",
            "iCloud Drive",
            "Nextcloud",
            "ownCloud",
            "pCloudDrive",
            "Sync",
            "MEGA",
            "MegaSync",
            "Box",
            "Box Sync",
            "Tresorit",
            "Proton Drive",
        ];
        for name in names {
            add(home.join(name), &mut found);
        }
        if let Ok(entries) = fs::read_dir(&home) {
            for entry in entries.flatten().take(256) {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                if name.starts_with("onedrive - ")
                    || name.starts_with("nextcloud - ")
                    || name.starts_with("dropbox (")
                {
                    add(entry.path(), &mut found);
                }
            }
        }
    }
    for key in [
        "OneDrive",
        "OneDriveConsumer",
        "OneDriveCommercial",
        "Dropbox",
        "Nextcloud",
    ] {
        if let Some(path) = std::env::var_os(key) {
            add(PathBuf::from(path), &mut found);
        }
    }
    // Dropbox pubblica il percorso effettivo della cartella sincronizzata in info.json.
    for env_name in ["APPDATA", "LOCALAPPDATA"] {
        if let Some(root) = std::env::var_os(env_name) {
            let info_path = PathBuf::from(root).join("Dropbox").join("info.json");
            if let Ok(text) = fs::read_to_string(info_path) {
                if let Ok(v) = serde_json::from_str::<V>(&text) {
                    for kind in ["personal", "business"] {
                        if let Some(path) =
                            v.get(kind).and_then(|x| x.get("path")).and_then(V::as_str)
                        {
                            add(PathBuf::from(path), &mut found);
                        }
                    }
                }
            }
        }
    }
    #[cfg(windows)]
    {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        // OneDrive può usare percorsi personalizzati, diversi da quelli sotto USERPROFILE.
        if let Ok(accounts) = hkcu.open_subkey(r"Software\Microsoft\OneDrive\Accounts") {
            for name in accounts.enum_keys().flatten() {
                if let Ok(account) = accounts.open_subkey(&name) {
                    if let Ok(path) = account.get_value::<String, _>("UserFolder") {
                        add(PathBuf::from(path), &mut found);
                    }
                }
            }
        }
    }
    found.sort_by_key(|p| p.to_string_lossy().to_lowercase());
    found
        .into_iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

fn dirs_data() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(p) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(p);
        }
    }
    dirs_config()
}
fn dirs_config() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(p) = std::env::var("APPDATA") {
            return PathBuf::from(p);
        }
    }
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(".config")
}
fn merge_import(d: &mut V, pl: &V) -> usize {
    let fs_remote: HashMap<String, String> = array(pl, "folders")
        .iter()
        .map(|f| (s(f, "id").to_string(), s(f, "name").to_string()))
        .collect();
    for name in fs_remote.values() {
        if !array(d, "folders").iter().any(|f| s(f, "name") == name) {
            arr(d, "folders").push(json!({"id":id(),"name":name,"upd":now()}))
        }
    }
    let local: HashMap<String, String> = array(d, "folders")
        .iter()
        .map(|f| (s(f, "name").to_string(), s(f, "id").to_string()))
        .collect();
    let mut n = 0;
    for item in array(pl, "items") {
        if !item.is_object() {
            continue;
        }
        let mut it = item.clone();
        let fname = fs_remote.get(s(&it, "folder"));
        it["folder"] = fname
            .and_then(|n| local.get(n))
            .map(|x| json!(x))
            .unwrap_or(V::Null);
        if let Some(old) = arr(d, "items")
            .iter_mut()
            .find(|x| s(x, "id") == s(&it, "id"))
        {
            if num(&it, "updated") > num(old, "updated") {
                *old = it;
                n += 1
            }
        } else {
            arr(d, "items").push(it);
            n += 1
        }
    }
    let existing: HashSet<String> = array(d, "passwords")
        .iter()
        .map(|p| s(p, "id").to_string())
        .collect();
    for p in array(pl, "passwords") {
        if !existing.contains(s(p, "id")) {
            arr(d, "passwords").push(p.clone())
        }
    }
    n
}
fn export_text(d: &V, format: &str) -> Res<String> {
    if format == "json" {
        return serde_json::to_string_pretty(&json!({"kind":"jessamine-export","folders":d["folders"],"items":d["items"],"passwords":d["passwords"]})).map_err(err);
    }
    let mut columns = vec![];
    for t in ["card", "crypto", "login", "passkey", "personal"] {
        for k in fields(t).unwrap_or(&[]) {
            if !columns.contains(k) {
                columns.push(*k)
            }
        }
    }
    columns.sort();
    let mut out = csv::Writer::from_writer(Vec::new());
    let mut head = vec!["name", "type", "folder", "notes"];
    head.extend(columns.iter().copied());
    out.write_record(head).map_err(err)?;
    for i in array(d, "items") {
        if !i["trashed"].is_null() {
            continue;
        }
        let folder = array(d, "folders")
            .iter()
            .find(|f| s(f, "id") == s(i, "folder"))
            .map(|f| s(f, "name"))
            .unwrap_or("");
        let mut row = vec![s(i, "title"), s(i, "type"), folder, s(i, "notes")];
        row.extend(columns.iter().map(|k| s(&i["f"], k)));
        out.write_record(row).map_err(err)?
    }
    String::from_utf8(out.into_inner().map_err(err)?).map_err(err)
}
/// CSV of Jesse's Archive or another password manager / browser. `mapping` (column
/// -> field) is the user's choice in the import preview; without it the columns are
/// recognized by name (src-tauri/src/importers.rs).
fn import_csv(d: &mut V, text: &str, mapping: Option<&HashMap<String, String>>) -> Res<usize> {
    let columns = crate::importers::csv_columns(text, mapping)?;
    let entries = crate::importers::parse_csv(text, &columns)?;
    Ok(add_entries(d, entries))
}
enum ImportFormat {
    /// Jesse's Archive JSON export.
    Own(V),
    /// Bitwarden JSON export.
    Bitwarden(V),
    KeePass,
    Kaspersky,
    Csv,
}
fn import_format(text: &str) -> Res<ImportFormat> {
    if text.trim_start().starts_with(['{', '[']) {
        let pl: V = serde_json::from_str(text).map_err(|_| "JSON non valido")?;
        Ok(if crate::importers::is_bitwarden(&pl) {
            ImportFormat::Bitwarden(pl)
        } else {
            ImportFormat::Own(pl)
        })
    } else if crate::importers::is_keepass(text) {
        Ok(ImportFormat::KeePass)
    } else if is_kaspersky(text) {
        Ok(ImportFormat::Kaspersky)
    } else {
        Ok(ImportFormat::Csv)
    }
}
/// Column mapping chosen in the import preview ({"Column": "field"}), if any.
fn import_mapping(b: &V) -> Option<HashMap<String, String>> {
    b.get("mapping").and_then(V::as_object).map(|m| {
        m.iter()
            .take(200)
            .filter_map(|(k, v)| v.as_str().map(|v| (k.clone(), v.to_string())))
            .collect()
    })
}
/// Adds records read from another program: folders by name (created if missing),
/// only the fields of each item type, favorites and the password history.
fn add_entries(d: &mut V, entries: Vec<crate::importers::Entry>) -> usize {
    let mut n = 0;
    for e in entries {
        let typ = if fields(&e.kind).is_some() {
            e.kind.as_str()
        } else {
            "login"
        };
        let folder = if e.folder.is_empty() {
            V::Null
        } else if let Some(f) = array(d, "folders")
            .iter()
            .find(|f| s(f, "name") == e.folder)
        {
            json!(s(f, "id"))
        } else {
            let uuid = id();
            arr(d, "folders").push(json!({"id":uuid,"name":e.folder,"upd":now()}));
            json!(uuid)
        };
        let mut f = json!({});
        for k in fields(typ).unwrap_or(&[]) {
            if let Some(v) = e.fields.get(*k) {
                f[*k] = json!(v)
            }
        }
        push_imported(d, typ, &e.title, folder, f, &e.notes);
        if e.fav {
            if let Some(it) = arr(d, "items").last_mut() {
                it["fav"] = json!(true);
            }
        }
        n += 1
    }
    n
}
/// Text of an imported file: UTF-8 (with or without BOM) or UTF-16 with BOM, as
/// Windows programs (Kaspersky Password Manager) often save their text exports.
pub fn decode_text(bytes: &[u8]) -> Res<String> {
    let utf16 = |be: bool| -> Res<String> {
        let body = &bytes[2..];
        if !body.len().is_multiple_of(2) {
            return Err("File di testo non valido".into());
        }
        let units: Vec<u16> = body
            .as_chunks::<2>()
            .0
            .iter()
            .map(|&c| {
                if be {
                    u16::from_be_bytes(c)
                } else {
                    u16::from_le_bytes(c)
                }
            })
            .collect();
        String::from_utf16(&units).map_err(|_| "File di testo non valido".into())
    };
    match bytes {
        [0xff, 0xfe, ..] => utf16(false),
        [0xfe, 0xff, ..] => utf16(true),
        _ => String::from_utf8(bytes.to_vec())
            .map(|t| t.trim_start_matches('\u{feff}').to_string())
            .map_err(|_| "Il file non è testo UTF-8 o UTF-16".into()),
    }
}

/// Field of the Kaspersky Password Manager text export ("Website name: …"), in English
/// or Italian.
#[derive(Clone, Copy, PartialEq)]
enum KField {
    Title,
    Url,
    LoginName,
    Username,
    Password,
    Notes,
    Text,
}
fn kaspersky_field(label: &str) -> Option<KField> {
    let l = label.trim().to_lowercase();
    Some(match l.as_str() {
        "website name"
        | "application"
        | "account name"
        | "name"
        | "nome sito web"
        | "nome del sito web"
        | "nome sito"
        | "applicazione"
        | "nome account"
        | "nome dell'account"
        | "nome dell’account"
        | "nome"
        | "titolo" => KField::Title,
        "website url" | "url" | "url sito web" | "url del sito web" | "indirizzo"
        | "indirizzo web" => KField::Url,
        "login name"
        | "nome login"
        | "nome di accesso"
        | "nome dell'accesso"
        | "nome dell’accesso" => KField::LoginName,
        "login" | "username" | "user name" | "nome utente" | "utente" | "accesso" => {
            KField::Username
        }
        "password" => KField::Password,
        "comment" | "comments" | "commento" | "commenti" | "notes" | "note" => KField::Notes,
        "text" | "testo" => KField::Text,
        _ => return None,
    })
}
/// "Label: value" with a short label (no URL scheme mistaken for a label).
fn label_line(line: &str) -> Option<(&str, &str)> {
    let (label, value) = line.split_once(':')?;
    let ok = !label.is_empty()
        && label.chars().count() <= 40
        && !label.starts_with(' ')
        && !value.starts_with("//")
        && label
            .chars()
            .all(|c| c.is_alphabetic() || matches!(c, ' ' | '\'' | '’' | '-'));
    ok.then(|| (label, value.strip_prefix(' ').unwrap_or(value)))
}
/// Whether `text` looks like a Kaspersky Password Manager text export: entries
/// separated by "---" lines and known field labels.
fn is_kaspersky(text: &str) -> bool {
    let mut separators = false;
    let mut fields = false;
    for line in text.lines() {
        let line = line.trim_end();
        separators |= line == "---";
        fields |= label_line(line).is_some_and(|(l, _)| {
            matches!(
                kaspersky_field(l),
                Some(KField::Password | KField::Url | KField::Title)
            )
        });
    }
    separators && fields
}
/// Imports a Kaspersky Password Manager text export. Sections (Websites, Applications,
/// Other accounts) become logins and the Notes section notes; multi-line comments are
/// kept; labels repeated in the file but unknown go into the notes instead of being lost.
fn import_kaspersky(d: &mut V, text: &str) -> Res<usize> {
    // Labels used on several lines are fields even if unknown (another language).
    let mut seen: HashMap<String, usize> = HashMap::new();
    for line in text.lines() {
        if let Some((label, _)) = label_line(line.trim_end()) {
            *seen.entry(label.to_lowercase()).or_default() += 1;
        }
    }
    let is_field = |label: &str| {
        kaspersky_field(label).is_some() || seen.get(&label.to_lowercase()) >= Some(&2)
    };
    let note_sections = ["notes", "note"];
    let mut section = String::new();
    let mut entries: Vec<(String, Vec<(String, String)>)> = Vec::new();
    let mut current: Vec<(String, String)> = Vec::new();
    let flush = |current: &mut Vec<(String, String)>,
                 section: &str,
                 out: &mut Vec<(String, Vec<(String, String)>)>| {
        if !current.is_empty() {
            out.push((section.to_string(), std::mem::take(current)));
        }
    };
    for raw in text.lines() {
        let line = raw.trim_end();
        if line.trim() == "---" {
            flush(&mut current, &section, &mut entries);
            continue;
        }
        if let Some((label, value)) = label_line(line).filter(|(l, _)| is_field(l)) {
            current.push((label.trim().to_string(), value.to_string()));
            continue;
        }
        if current.is_empty() {
            // A heading between entries ("Websites", "Notes"): the section of the next ones.
            if !line.trim().is_empty() {
                section = line.trim().to_lowercase();
            }
            continue;
        }
        // Continuation of a multi-line value (comments, note text).
        if let Some((_, value)) = current.last_mut() {
            value.push('\n');
            value.push_str(line);
        }
    }
    flush(&mut current, &section, &mut entries);
    let mut n = 0;
    for (section, fields) in entries {
        let mut title = String::new();
        let mut url = String::new();
        let mut login_name = String::new();
        let mut username = String::new();
        let mut password = String::new();
        let mut notes: Vec<String> = Vec::new();
        // In every Kaspersky entry the first field is its name, whatever the language.
        let first = fields
            .first()
            .map(|(_, v)| v.trim().chars().take(120).collect::<String>())
            .unwrap_or_default();
        for (label, value) in fields {
            let value = value.trim().to_string();
            if value.is_empty() {
                continue;
            }
            match kaspersky_field(&label) {
                Some(KField::Title) => title = value,
                Some(KField::Url) => url = value,
                Some(KField::LoginName) => login_name = value,
                Some(KField::Username) => username = value,
                Some(KField::Password) => password = value,
                Some(KField::Notes | KField::Text) => notes.push(value),
                None => notes.push(format!("{label}: {value}")),
            }
        }
        let is_note = note_sections.contains(&section.as_str())
            || (password.is_empty() && username.is_empty() && url.is_empty());
        let mut title = if !title.is_empty() {
            title
        } else if !first.is_empty() && first != password {
            first
        } else if !url.is_empty() {
            url.clone()
        } else {
            username.clone()
        };
        if title.is_empty() && is_note {
            title = notes
                .first()
                .and_then(|n| n.lines().next())
                .unwrap_or("")
                .chars()
                .take(60)
                .collect();
        }
        if title.is_empty() {
            continue;
        }
        // Without an address the main list would group a web account by the domain of
        // its email: Kaspersky applications become installed-app accounts grouped by
        // the app, other accounts plain groups by name.
        let src = if !url.is_empty() {
            "web"
        } else if section.contains("applica") {
            "app"
        } else {
            "other"
        };
        // Kaspersky's "Login name" is the name the user gave to each account of a site or
        // app ("Sea of thieves" inside "Microsoft Store"): it becomes the title, while the
        // site/app stays the group. Only "other" accounts are grouped by their own title,
        // so there it goes to the notes instead.
        let group_name = title.clone();
        let named = !login_name.is_empty() && login_name != username && login_name != title;
        if named && src != "other" {
            title = login_name.clone();
        } else if named {
            notes.insert(0, format!("Nome account: {login_name}"));
        }
        let notes = notes.join("\n\n");
        if is_note {
            push_imported(d, "note", &title, V::Null, json!({}), &notes);
        } else {
            let f = json!({"url": url, "username": username, "password": password, "totp": ""});
            push_imported(d, "login", &title, V::Null, f, &notes);
            if src != "web" {
                group_by_title(d, src, &group_name);
            }
        }
        n += 1;
    }
    if n == 0 {
        return Err("Nessun account riconosciuto nel file di Kaspersky".into());
    }
    Ok(n)
}
/// Puts the last added item in the app/other group named `title`, with the same key
/// the UI computes (src/groups.ts `deriveGroupKey`) and `title` as group name.
fn group_by_title(d: &mut V, src: &str, title: &str) {
    let key = format!(
        "{src}:{}",
        title
            .trim()
            .to_lowercase()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join("-")
    );
    if let Some(it) = arr(d, "items").last_mut() {
        it["src"] = json!(src);
        it["gk"] = json!(key);
    }
    if d["groups"].get(&key).is_none() {
        obj(d, "groups").insert(
            key,
            json!({"name": title.trim(), "src": src, "icon": "", "upd": now()}),
        );
    }
}
/// Adds one imported item (CSV, Kaspersky text) with its password history entry.
fn push_imported(d: &mut V, typ: &str, title: &str, folder: V, f: V, notes: &str) {
    let it = json!({"id":id(),"created":now(),"updated":now(),"trashed":null,"shared":false,"type":typ,"title":title,"folder":folder,"fav":false,"notes":notes,"f":f});
    arr(d, "items").push(it.clone());
    if let Some(sf) = secret(typ) {
        if !s(&it["f"], sf).is_empty() {
            link(d, &it, s(&it["f"], sf));
            if let Some(p) = arr(d, "passwords")
                .iter_mut()
                .find(|p| s(p, "item_id") == s(&it, "id") && p["active"] == true)
            {
                p["source"] = json!("imported")
            }
        }
    }
}
fn bits(p: &str) -> f64 {
    if p.is_empty() {
        return 0.;
    }
    let lower = p.to_ascii_lowercase();
    if [
        "password",
        "123456",
        "12345678",
        "qwerty",
        "abc123",
        "111111",
        "letmein",
        "admin",
        "welcome",
        "iloveyou",
        "password1",
        "123456789",
        "qwerty123",
        "dragon",
        "monkey",
        "123123",
        "000000",
        "passw0rd",
        "ciaociao",
        "juventus",
        "forzaroma",
    ]
    .contains(&lower.as_str())
    {
        return 4.;
    }
    let pool = (if p.chars().any(|c| c.is_ascii_lowercase()) {
        26
    } else {
        0
    }) + (if p.chars().any(|c| c.is_ascii_uppercase()) {
        26
    } else {
        0
    }) + (if p.chars().any(|c| c.is_ascii_digit()) {
        10
    } else {
        0
    }) + (if p.chars().any(|c| !c.is_ascii_alphanumeric()) {
        32
    } else {
        0
    });
    let unique = p.chars().collect::<HashSet<_>>().len() as f64;
    let count = p.chars().count() as f64;
    let seq = p
        .chars()
        .zip(p.chars().skip(1))
        .filter(|(a, b)| (*a as i64 - *b as i64).abs() == 1)
        .count() as f64;
    (((unique + 0.3 * (count - unique) - 0.7 * seq).max(1.)) * (pool.max(2) as f64).log2() * 10.)
        .round()
        / 10.
}
fn health(d: &V) -> V {
    let byid: HashMap<String, &V> = array(d, "items")
        .iter()
        .map(|i| (s(i, "id").to_string(), i))
        .collect();
    let active: Vec<&V> = array(d, "passwords")
        .iter()
        .filter(|p| {
            p["active"] == true
                && byid
                    .get(s(p, "item_id"))
                    .map(|i| i["trashed"].is_null())
                    .unwrap_or(false)
        })
        .collect();
    let reference = |p: &&V| json!({"pid":p["id"],"item_id":p["item_id"],"title":p["item_title"],"bits":bits(s(p,"value"))});
    let weak: Vec<_> = active
        .iter()
        .filter(|p| bits(s(p, "value")) < 60. || !long_enough(s(p, "value")))
        .map(reference)
        .collect();
    let mut groups: HashMap<String, Vec<V>> = HashMap::new();
    for p in &active {
        groups
            .entry(s(p, "value").into())
            .or_default()
            .push(reference(p))
    }
    let reused: Vec<Vec<V>> = groups.into_values().filter(|g| g.len() > 1).collect();
    let limit = now() - d["settings"]["old_days"].as_i64().unwrap_or(180) as f64 * 86400.;
    let old: Vec<_> = active
        .iter()
        .filter(|p| p["linked"].as_f64().unwrap_or(num(p, "created")) < limit)
        .map(|p| {
            let mut r = reference(p);
            r["since"] = json!(p["linked"].as_f64().unwrap_or(num(p, "created")));
            r
        })
        .collect();
    let bad: HashSet<String> = weak
        .iter()
        .chain(old.iter())
        .chain(reused.iter().flatten())
        .map(|x| s(x, "pid").to_string())
        .collect();
    let score = if active.is_empty() {
        100
    } else {
        (100. * (1. - bad.len() as f64 / active.len() as f64)).round() as i32
    };
    json!({"weak":weak,"reused":reused,"old":old,"total":active.len(),"score":score})
}
fn totp(secret: &str, t: u64) -> Res<String> {
    use hmac::{Hmac, Mac};
    use sha1::Sha1;
    let re = regex::Regex::new(r"secret=([A-Za-z2-7]+)").unwrap();
    let clean = re
        .captures(secret)
        .map(|m| m.get(1).unwrap().as_str())
        .unwrap_or(secret)
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_uppercase();
    let raw = data_encoding::BASE32_NOPAD
        .decode(clean.trim_end_matches('=').as_bytes())
        .map_err(|_| "Chiave TOTP non valida")?;
    let mut mac = <Hmac<Sha1> as Mac>::new_from_slice(&raw).map_err(err)?;
    mac.update(&(t / 30).to_be_bytes());
    let result = mac.finalize().into_bytes();
    let off = (result[19] & 15) as usize;
    let code = u32::from_be_bytes([
        result[off],
        result[off + 1],
        result[off + 2],
        result[off + 3],
    ]) & 0x7fffffff;
    Ok(format!("{:06}", code % 1_000_000))
}
fn breaches(d: &V) -> Res<Vec<V>> {
    use sha1::{Digest, Sha1};
    let byid: HashMap<String, &V> = array(d, "items")
        .iter()
        .map(|i| (s(i, "id").into(), i))
        .collect();
    let active: Vec<_> = array(d, "passwords")
        .iter()
        .filter(|p| {
            p["active"] == true
                && byid
                    .get(s(p, "item_id"))
                    .map(|i| i["trashed"].is_null())
                    .unwrap_or(false)
        })
        .collect();
    let hashes: Vec<String> = active
        .iter()
        .map(|p| hex::encode_upper(Sha1::digest(s(p, "value").as_bytes())))
        .collect();
    let prefixes: Vec<String> = hashes
        .iter()
        .map(|h| h[..5].to_string())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    // reqwest::blocking must not run on the Tauri async worker that executes the
    // `api` command: there, after about 128 requests, tokio's cooperative budget
    // stalls it and every later request times out. A plain thread avoids it.
    let ranges = std::thread::scope(|sc| sc.spawn(|| pwned_ranges(&prefixes)).join())
        .map_err(|_| "Impossibile contattare Pwned Passwords".to_string())??;
    Ok(active
        .iter()
        .zip(&hashes)
        .map(|(p, hash)| {
            let (prefix, suffix) = hash.split_at(5);
            let count = ranges.get(prefix).map_or(0, |r| pwned_count(r, suffix));
            json!({"pid":p["id"],"item_id":p["item_id"],"title":p["item_title"],"count":count})
        })
        .collect())
}
/// Downloads the k-anonymity ranges (only 5-character SHA-1 prefixes leave the
/// device). A request is retried twice before giving up, so one network hiccup
/// does not fail a check of hundreds of passwords.
fn pwned_ranges(prefixes: &[String]) -> Res<HashMap<String, String>> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(err)?;
    let mut out = HashMap::new();
    for prefix in prefixes {
        let mut body = None;
        for attempt in 0..3u64 {
            if attempt > 0 {
                std::thread::sleep(std::time::Duration::from_millis(400 * attempt));
            }
            let response = client
                .get(format!("https://api.pwnedpasswords.com/range/{prefix}"))
                .header("Add-Padding", "true")
                .header("User-Agent", "JesseArchive-Tauri")
                .send()
                .and_then(|r| r.error_for_status())
                .and_then(|r| r.text());
            if let Ok(text) = response {
                body = Some(text);
                break;
            }
        }
        let text = body.ok_or("Impossibile contattare Pwned Passwords")?;
        out.insert(prefix.clone(), text);
    }
    Ok(out)
}
/// Occurrences of a hash suffix in a range response ("SUFFIX:COUNT" lines; the
/// padding lines have count 0).
fn pwned_count(range: &str, suffix: &str) -> u64 {
    range
        .lines()
        .find_map(|l| {
            l.split_once(':')
                .filter(|(h, _)| h.eq_ignore_ascii_case(suffix))
                .and_then(|(_, n)| n.trim().parse::<u64>().ok())
        })
        .unwrap_or(0)
}
fn word(n: usize) -> String {
    let c = b"bdfgklmnprstvz";
    let v = b"aeiou";
    let mut rng = OsRng;
    let mut result = String::new();
    for _ in 0..n {
        result.push(*c.choose(&mut rng).unwrap() as char);
        result.push(*v.choose(&mut rng).unwrap() as char)
    }
    result
}
fn generate(b: &V) -> Res<Vec<V>> {
    let mode = s(b, "mode");
    let count = b["count"].as_u64().unwrap_or(5).clamp(1, 10);
    let mut out = Vec::new();
    let mut rng = OsRng;
    for _ in 0..count {
        let (value, entropy) = match mode {
            "pin" => {
                let len = b["pin_len"].as_u64().unwrap_or(6).clamp(4, 16) as usize;
                let val: String = (0..len)
                    .map(|_| (b'0' + (rng.next_u32() % 10) as u8) as char)
                    .collect();
                (val, (len as f64 * 10f64.log2() * 10.).round() / 10.)
            }
            "username" => (
                format!(
                    "{}{}{}",
                    capitalize(&word(2)),
                    word(2),
                    rng.next_u32() % 100
                ),
                33.,
            ),
            "passphrase" => {
                let n = b["words"].as_u64().unwrap_or(4).clamp(2, 12) as usize;
                let cap = b["cap"] != false;
                let mut ws: Vec<String> = (0..n)
                    .map(|_| {
                        let w = word(3);
                        if cap {
                            capitalize(&w)
                        } else {
                            w
                        }
                    })
                    .collect();
                let mut entropy = n as f64 * 3. * 70f64.log2();
                if b["add_number"] != false {
                    ws.push((rng.next_u32() % 100).to_string());
                    entropy += 100f64.log2()
                }
                let sep = b["sep"]
                    .as_str()
                    .unwrap_or("-")
                    .chars()
                    .take(3)
                    .collect::<String>();
                (ws.join(&sep), (entropy * 10.).round() / 10.)
            }
            _ => {
                let len = b["length"].as_u64().unwrap_or(20).clamp(4, 128) as usize;
                let excluded = s(b, "exclude").to_string()
                    + if b["ambiguous"] == true {
                        "0O1lI|`'\""
                    } else {
                        ""
                    };
                let min_digits = b["min_digits"].as_u64().unwrap_or(1) as usize;
                let min_symbols = b["min_symbols"].as_u64().unwrap_or(1) as usize;
                let symbol_set = b["symset"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .unwrap_or("!@#$%^&*");
                let sets = [
                    (b["lower"] != false, "abcdefghijklmnopqrstuvwxyz", 1usize),
                    (b["upper"] != false, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 1),
                    (b["digits"] != false, "0123456789", min_digits),
                    (b["symbols"] != false, symbol_set, min_symbols),
                ];
                let mut active = Vec::new();
                for (on, chars, m) in sets {
                    if on {
                        let clean: Vec<char> =
                            chars.chars().filter(|c| !excluded.contains(*c)).collect();
                        if !clean.is_empty() {
                            active.push((clean, m))
                        }
                    }
                }
                if active.is_empty() {
                    return Err("Seleziona almeno un tipo di caratteri".into());
                }
                let pool: Vec<char> = active
                    .iter()
                    .flat_map(|(s, _)| s.clone())
                    .collect::<HashSet<_>>()
                    .into_iter()
                    .collect();
                if b["unique"] == true && len > pool.len() {
                    return Err("Troppi caratteri unici richiesti".into());
                }
                let mut candidate = None;
                for _ in 0..1000 {
                    let mut ch = Vec::new();
                    for (set, m) in &active {
                        for _ in 0..*m {
                            if ch.len() < len {
                                ch.push(*set.choose(&mut rng).unwrap())
                            }
                        }
                    }
                    while ch.len() < len {
                        ch.push(*pool.choose(&mut rng).unwrap())
                    }
                    ch.shuffle(&mut rng);
                    if b["start_letter"] == true && !ch[0].is_alphabetic() {
                        if let Some(i) = ch.iter().position(|c| c.is_alphabetic()) {
                            ch.swap(0, i)
                        } else {
                            continue;
                        }
                    }
                    if b["unique"] == true && ch.iter().collect::<HashSet<_>>().len() != ch.len() {
                        continue;
                    }
                    candidate = Some(ch.into_iter().collect::<String>());
                    break;
                }
                let p = candidate.ok_or("Impossibile rispettare le opzioni")?;
                (
                    p,
                    (len as f64 * (pool.len() as f64).log2() * 10.).round() / 10.,
                )
            }
        };
        out.push(json!({"value":value,"bits":entropy}))
    }
    Ok(out)
}
fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(x) => x.to_uppercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}
#[cfg(windows)]
fn installed_apps() -> Vec<V> {
    let mut out = HashMap::new();
    let roots = [
        std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".into()),
        std::env::var("APPDATA").unwrap_or_default(),
    ];
    for root in roots {
        let p = PathBuf::from(root)
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs");
        walk_lnk(&p, &mut out, 0);
    }
    let mut v: Vec<_> = out.into_values().collect();
    v.sort_by_key(|x| s(x, "name").to_lowercase());
    v
}
#[cfg(windows)]
fn walk_lnk(p: &Path, out: &mut HashMap<String, V>, depth: usize) {
    if depth > 12 {
        return;
    }
    if let Ok(dir) = fs::read_dir(p) {
        for f in dir.flatten() {
            let path = f.path();
            if path.is_dir() {
                walk_lnk(&path, out, depth + 1)
            } else if path
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x.eq_ignore_ascii_case("lnk"))
                .unwrap_or(false)
            {
                let n = path
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                if ![
                    "uninstall",
                    "disinstall",
                    "readme",
                    "help",
                    "manual",
                    "license",
                    "documentation",
                    "release notes",
                    "website",
                    "sito web",
                ]
                .iter()
                .any(|x| n.to_lowercase().contains(x))
                {
                    out.entry(n.to_lowercase())
                        .or_insert(json!({"name":n,"path":path.to_string_lossy()}));
                }
            }
        }
    }
}
#[cfg(not(windows))]
fn installed_apps() -> Vec<V> {
    Vec::new()
}
/// Display name of an executable or shortcut: the file description or product name
/// from its version information ("Feather Launcher" for FeatherLauncher.exe), else
/// the file name without extension.
fn app_name(p: &str) -> Res<String> {
    let path = Path::new(p);
    if !path.is_file() {
        return Err("File non trovato".into());
    }
    let stem = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .trim()
        .to_string();
    #[cfg(windows)]
    {
        let ps = r#"$v=(Get-Item -LiteralPath $env:JA_PATH).VersionInfo;if($v.FileDescription){$v.FileDescription}elseif($v.ProductName){$v.ProductName}"#;
        use std::os::windows::process::CommandExt;
        // A shortcut keeps its own name: it is the one shown in the Start menu.
        if !p.to_ascii_lowercase().ends_with(".lnk") {
            if let Ok(out) = std::process::Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-Command", ps])
                .env("JA_PATH", p)
                .creation_flags(0x08000000)
                .output()
            {
                let name: String = String::from_utf8_lossy(&out.stdout)
                    .trim()
                    .chars()
                    .filter(|c| !c.is_control())
                    .take(80)
                    .collect();
                if !name.is_empty() {
                    return Ok(name);
                }
            }
        }
    }
    Ok(stem)
}
fn app_icon(p: &str) -> Res<String> {
    #[cfg(windows)]
    {
        if !Path::new(p).exists() {
            return Err("File non trovato".into());
        }
        let ps = r#"Add-Type -AssemblyName System.Drawing;$p=$env:JA_PATH;if($p -like '*.lnk'){try{$t=(New-Object -ComObject WScript.Shell).CreateShortcut($p).TargetPath;if($t -and (Test-Path $t)){$p=$t}}catch{}};$i=[System.Drawing.Icon]::ExtractAssociatedIcon($p);$m=New-Object IO.MemoryStream;$i.ToBitmap().Save($m,[System.Drawing.Imaging.ImageFormat]::Png);[Convert]::ToBase64String($m.ToArray())"#;
        use std::os::windows::process::CommandExt;
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", ps])
            .env("JA_PATH", p)
            .creation_flags(0x08000000)
            .output()
            .map_err(err)?;
        let b = String::from_utf8_lossy(&out.stdout).trim().to_string();
        Ok(if b.len() > 100 {
            format!("data:image/png;base64,{b}")
        } else {
            String::new()
        })
    }
    #[cfg(not(windows))]
    {
        let _ = p;
        Ok(String::new())
    }
}
#[cfg(windows)]
fn autostart_get() -> bool {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("reg")
        .creation_flags(0x08000000)
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
            "/v",
            "JesseArchive",
        ])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
#[cfg(not(windows))]
fn autostart_get() -> bool {
    false
}
#[cfg(windows)]
fn autostart_set(on: bool) -> Res<()> {
    use std::os::windows::process::CommandExt;
    let path = std::env::current_exe().map_err(err)?;
    let value = format!("\"{}\" --background", path.display());
    let mut cmd = std::process::Command::new("reg");
    cmd.creation_flags(0x08000000);
    cmd.args(if on {
        vec![
            "add",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
            "/v",
            "JesseArchive",
            "/t",
            "REG_SZ",
            "/d",
            &value,
            "/f",
        ]
    } else {
        vec![
            "delete",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
            "/v",
            "JesseArchive",
            "/f",
        ]
    });
    let result = cmd.output().map_err(err)?;
    if !result.status.success() && on {
        return Err("Impossibile modificare l'avvio automatico".into());
    }
    Ok(())
}
#[cfg(not(windows))]
fn autostart_set(_on: bool) -> Res<()> {
    Err("Solo Windows".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn kdf_legacy() {
        let salt = [0u8; 16];
        let v = kdf("testing-scrypt", &salt).unwrap();
        assert_eq!(v.len(), 32)
    }
    #[test]
    fn aes_roundtrip() {
        let k = rand_bytes::<32>();
        let plain = b"synthetic secret";
        assert_eq!(unseal(&k, &seal(&k, plain).unwrap()).unwrap(), plain);
        let mut bad = seal(&k, plain).unwrap();
        bad.push('a');
        assert!(unseal(&k, &bad).is_err())
    }
    #[test]
    fn merge_preserves_unknown() {
        let mut a = empty();
        a["items"] = json!([{"id":"first","created":1.,"updated":1.,"x_legacy":7}]);
        let mut b = empty();
        b["items"] = json!([{"id":"first","created":1.,"updated":2.,"x_legacy":8}]);
        assert!(merge_data(&mut a, &b));
        assert_eq!(a["items"][0]["x_legacy"], 8)
    }
    #[test]
    fn totp_rfc() {
        assert_eq!(
            totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59).unwrap(),
            "287082"
        )
    }
    #[test]
    fn pwned_range_counts() {
        let range = "0018A45C4D1DEF81644B54AB7F969B88D65:10\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\r\n";
        assert_eq!(
            pwned_count(range, "1E4C9B93F3F0682250B6CF8331B7EE68FD8"),
            3861493
        );
        assert_eq!(
            pwned_count(range, "1e4c9b93f3f0682250b6cf8331b7ee68fd8"),
            3861493
        );
        assert_eq!(pwned_count(range, "00D4F6E8FA6EECAD2A3AA415EEC418D38EC"), 0);
        assert_eq!(pwned_count(range, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"), 0);
    }
}
#[cfg(test)]
mod legacy_python_vectors {
    use super::*;
    #[test]
    fn decrypt_python_generated_v1() {
        let f: V =
            serde_json::from_str(include_str!("../../fixtures/legacy_v1_synthetic.json")).unwrap();
        let h = &f["header"];
        let got = kdf(s(&f, "password"), &decode(h, "salt").unwrap()).unwrap();
        assert_eq!(hex::encode(*got), s(&f, "expected_kdf_hex"));
        let dek = unseal(&got, s(h, "wrap")).unwrap();
        assert_eq!(hex::encode(&dek), s(&f, "expected_dek_hex"));
        let dek: [u8; 32] = dek.try_into().unwrap();
        let plain = unseal(&dek, s(h, "data")).unwrap();
        let d: V = serde_json::from_slice(&plain).unwrap();
        assert_eq!(d, f["expected_data"])
    }
}
#[cfg(test)]
mod vault_tests {
    use super::*;
    /// Synthetic vault in an isolated temporary directory; never touches real data.
    fn test_vault() -> (Vault, PathBuf) {
        let dir =
            std::env::temp_dir().join(format!("jesse-test-{}", hex::encode(rand_bytes::<6>())));
        fs::create_dir_all(&dir).unwrap();
        let v = Vault {
            path: dir.join("jesse_archive.vault"),
            config: dir.join("config.json"),
            key: None,
            header: V::Null,
            data: V::Null,
            last: now(),
            last_sync: 0.,
            signature: None,
            push: false,
            rev: 0,
            fails: 0,
        };
        (v, dir)
    }
    /// Second session ("another device") on the same vault file.
    fn second_session(v: &Vault) -> (Vault, PathBuf) {
        let (mut other, dir) = test_vault();
        other.path = v.path.clone();
        other.config = v.config.clone();
        (other, dir)
    }
    fn header_on_disk(v: &Vault) -> V {
        serde_json::from_slice(&fs::read(&v.path).unwrap()).unwrap()
    }
    fn opens(v: &mut Vault, body: V) -> bool {
        let _ = v.call("lock", json!({}));
        // Wrong attempts must not slow the next ones down in these tests.
        let _ = fs::remove_file(&v.config);
        v.fails = 0;
        let ok = v.call("unlock", body).is_ok();
        let _ = fs::remove_file(&v.config);
        v.fails = 0;
        ok
    }
    #[test]
    fn header_mac_survives_writing_and_reading_the_file() {
        // `hv` is a decimal: without exact float parsing (serde_json float_roundtrip)
        // some values came back one bit different and their mac failed at random.
        let dek = rand_bytes::<32>();
        for _ in 0..5000 {
            let hv = 1.7e9 + (u32::from_le_bytes(rand_bytes::<4>()) as f64) / 997.0;
            let mut h = json!({"v":1,"salt":"c2FsZQ==","wrap":"d3JhcA==","rsalt":"cg==","rwrap":"cnc=","hv":hv});
            h["mac"] = json!(header_mac(&dek, &h).unwrap());
            let back: V = serde_json::from_slice(&serde_json::to_vec(&h).unwrap()).unwrap();
            assert!(header_mac_ok(&dek, &back), "hv {hv}");
        }
    }
    #[test]
    fn forged_or_unsigned_headers_are_not_adopted() {
        let (mut v, dir) = test_vault();
        v.call("create", json!({"password": "password-uno"}))
            .unwrap();
        let old = header_on_disk(&v);
        assert!(header_mac_ok(v.key.as_ref().unwrap(), &old));
        v.call(
            "master",
            json!({"old": "password-uno", "new": "password-due"}),
        )
        .unwrap();
        // A copy with the old header (old password) and the current data, with an
        // inflated hv: with or without the old mac, it must not be adopted.
        let current = header_on_disk(&v);
        let copy = v.path.with_file_name("jesse_archive (copia).vault");
        for keep_mac in [true, false] {
            let mut forged = old.clone();
            forged["data"] = current["data"].clone();
            forged["hv"] = json!(num(&current, "hv") + 1e9);
            if !keep_mac {
                forged.as_object_mut().unwrap().remove("mac");
            }
            fs::write(&copy, serde_json::to_vec(&forged).unwrap()).unwrap();
            v.call("item", json!({"type": "note", "title": "dopo"}))
                .unwrap();
            assert!(!opens(&mut v, json!({"password": "password-uno"})));
            assert!(opens(&mut v, json!({"password": "password-due"})));
        }
        fs::remove_file(&copy).unwrap();
        // A real password change made by another device (same key, valid mac) is adopted.
        let (mut other, odir) = second_session(&v);
        other
            .call("unlock", json!({"password": "password-due"}))
            .unwrap();
        other
            .call(
                "master",
                json!({"old": "password-due", "new": "password-tre"}),
            )
            .unwrap();
        v.call("ping", json!({})).unwrap();
        v.call("item", json!({"type": "note", "title": "sync"}))
            .unwrap();
        assert!(opens(&mut v, json!({"password": "password-tre"})));
        fs::remove_dir_all(odir).unwrap();
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn rotating_the_key_retires_old_passwords_and_codes() {
        let (mut v, dir) = test_vault();
        let rec1 = v
            .call("create", json!({"password": "password-uno"}))
            .unwrap()["recovery"]
            .as_str()
            .unwrap()
            .to_string();
        v.call("item", json!({"type": "note", "title": "segreto"}))
            .unwrap();
        let before = header_on_disk(&v);
        let rec2 = v
            .call(
                "master",
                json!({"old": "password-uno", "new": "password-due", "rotate": true}),
            )
            .unwrap()["recovery"]
            .as_str()
            .unwrap()
            .to_string();
        assert_ne!(rec1, rec2);
        // Offline: the old password opens the old wrapped key, which no longer decrypts
        // the current data.
        let after = header_on_disk(&v);
        let old_dek: [u8; 32] = unseal(
            &kdf("password-uno", &decode(&before, "salt").unwrap()).unwrap(),
            s(&before, "wrap"),
        )
        .unwrap()
        .try_into()
        .unwrap();
        assert!(unseal(&old_dek, s(&after, "data")).is_err());
        // The data is all there under the new key.
        assert!(opens(&mut v, json!({"password": "password-due"})));
        assert!(array(&v.data, "items")
            .iter()
            .any(|i| s(i, "title") == "segreto"));
        assert!(!opens(&mut v, json!({"password": "password-uno"})));
        assert!(!opens(&mut v, json!({"recovery": rec1})));
        assert!(opens(&mut v, json!({"recovery": rec2.clone()})));
        // A new recovery code rotates the key too: the previous code stops working.
        let rec3 = v
            .call("recovery_new", json!({"password": "password-due"}))
            .unwrap()["recovery"]
            .as_str()
            .unwrap()
            .to_string();
        assert!(!opens(&mut v, json!({"recovery": rec2})));
        assert!(opens(&mut v, json!({"recovery": rec3})));
        assert!(opens(&mut v, json!({"password": "password-due"})));
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn another_open_session_locks_instead_of_overwriting_a_new_key() {
        let (mut a, dir) = test_vault();
        a.call("create", json!({"password": "password-uno"}))
            .unwrap();
        let (mut b, bdir) = second_session(&a);
        b.call("unlock", json!({"password": "password-uno"}))
            .unwrap();
        a.call(
            "master",
            json!({"old": "password-uno", "new": "password-due", "rotate": true}),
        )
        .unwrap();
        a.call(
            "item",
            json!({"type": "note", "title": "dopo la rotazione"}),
        )
        .unwrap();
        let written = fs::read(&a.path).unwrap();
        // B notices at its next synchronization and closes without writing.
        assert_eq!(b.call("ping", json!({})).unwrap_err(), REKEYED);
        assert!(!b.unlocked());
        assert!(b
            .call("item", json!({"type": "note", "title": "x"}))
            .is_err());
        assert_eq!(fs::read(&a.path).unwrap(), written);
        // With the new password it opens again and sees A's data.
        b.call("unlock", json!({"password": "password-due"}))
            .unwrap();
        assert!(array(&b.data, "items")
            .iter()
            .any(|i| s(i, "title") == "dopo la rotazione"));
        fs::remove_dir_all(bdir).unwrap();
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn unlock_wait_grows_and_is_capped() {
        for fails in 0..FREE_UNLOCK_ATTEMPTS {
            assert_eq!(unlock_wait(fails), 0.);
        }
        assert_eq!(unlock_wait(5), 30.);
        assert_eq!(unlock_wait(6), 60.);
        assert_eq!(unlock_wait(9), 480.);
        assert_eq!(unlock_wait(10), MAX_UNLOCK_WAIT);
        assert_eq!(unlock_wait(u32::MAX), MAX_UNLOCK_WAIT);
    }
    #[test]
    fn wrong_unlock_attempts_are_throttled_and_survive_a_restart() {
        let (mut v, dir) = test_vault();
        let good = json!({"password": "password-sintetica"});
        let bad = json!({"password": "sbagliata-sintetica"});
        v.call("create", good.clone()).unwrap();
        v.call("lock", json!({})).unwrap();
        for attempt in 1..=FREE_UNLOCK_ATTEMPTS {
            let e = v.call("unlock", bad.clone()).unwrap_err();
            assert_eq!(
                e.contains("riprova tra 30 secondi"),
                attempt == FREE_UNLOCK_ATTEMPTS,
                "{attempt}: {e}"
            );
        }
        // Even the right password waits, also after a restart (new Vault, same config).
        let e = v.call("unlock", good.clone()).unwrap_err();
        assert!(e.starts_with("Troppi tentativi errati: riprova tra"), "{e}");
        let (mut restarted, other) = test_vault();
        restarted.path = v.path.clone();
        restarted.config = v.config.clone();
        assert!(restarted.call("unlock", good.clone()).is_err());
        fs::remove_dir_all(other).unwrap();
        // A clock moved back never makes the wait longer than the current step.
        write_config_key(&v.config, "unlock_last_fail", json!(now() + 1e6)).unwrap();
        let e = v.call("unlock", good.clone()).unwrap_err();
        assert!(e.contains("riprova tra 30 secondi"), "{e}");
        // After the wait the right password works and clears the count.
        write_config_key(&v.config, "unlock_last_fail", json!(now() - 31.)).unwrap();
        v.call("unlock", good.clone()).unwrap();
        assert_eq!(read_config_key(&v.config, "unlock_fails"), json!(0));
        v.call("lock", json!({})).unwrap();
        assert!(v.call("unlock", bad).unwrap_err().ends_with("non corretti"));
        fs::remove_dir_all(dir).unwrap();
    }
    #[cfg(windows)]
    #[test]
    fn app_name_reads_the_file_description() {
        let windir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into());
        let notepad = format!("{windir}\\System32\\notepad.exe");
        let name = app_name(&notepad).unwrap();
        // The description ("Notepad", "Blocco note"…) rather than the bare file name.
        assert!(!name.is_empty() && name != "notepad", "{name}");
        assert!(app_name("C:\\percorso\\inesistente.exe").is_err());
    }
    #[test]
    fn import_preview_and_other_programs_through_the_vault() {
        let (mut v, dir) = test_vault();
        v.call("create", json!({"password": "password-sintetica"}))
            .unwrap();
        // Preview of an unknown CSV: nothing written, columns offered for mapping.
        let csv = "Sito web,Chi,Segreto\nesempio.it,utente,pw-csv\n";
        let preview = v.call("import_preview", json!({"text": csv})).unwrap();
        assert_eq!(preview["source"], "CSV");
        // No column recognized: nothing importable until the user maps them.
        assert_eq!(preview["count"], 0);
        assert_eq!(preview["columns"][2]["target"], "ignore");
        assert!(array(&v.data, "items").is_empty());
        // Import with the mapping chosen by the user.
        let mapping = json!({"Sito web": "url", "Chi": "username", "Segreto": "password"});
        assert_eq!(
            v.call("import_preview", json!({"text": csv, "mapping": mapping}))
                .unwrap()["count"],
            1
        );
        v.call("import", json!({"text": csv, "mapping": mapping}))
            .unwrap();
        let it = &array(&v.data, "items")[0];
        assert_eq!(s(&it["f"], "password"), "pw-csv");
        assert_eq!(s(it, "title"), "esempio.it");
        // Bitwarden JSON: folder created, favorite kept.
        let bw = r#"{"encrypted":false,"folders":[{"id":"f","name":"Social"}],"items":[{"type":1,"name":"BW","favorite":true,"folderId":"f","login":{"username":"u","password":"pw-bw","uris":[{"uri":"https://bw.example"}]}}]}"#;
        assert_eq!(
            v.call("import_preview", json!({"text": bw})).unwrap()["source"],
            "Bitwarden"
        );
        v.call("import", json!({"text": bw})).unwrap();
        let it = array(&v.data, "items")
            .iter()
            .find(|i| s(i, "title") == "BW")
            .unwrap()
            .clone();
        assert_eq!(it["fav"], true);
        let folder = array(&v.data, "folders")
            .iter()
            .find(|f| s(f, "name") == "Social")
            .unwrap();
        assert_eq!(s(&it, "folder"), s(folder, "id"));
        // KeePass XML.
        let xml = "<?xml version=\"1.0\"?><KeePassFile><Root><Group><Name>DB</Name><Group><Name>Email</Name><Entry><String><Key>Title</Key><Value>KP</Value></String><String><Key>Password</Key><Value>pw-kp</Value></String></Entry></Group></Group></Root></KeePassFile>";
        assert_eq!(v.call("import", json!({"text": xml})).unwrap()["count"], 1);
        assert!(array(&v.data, "folders")
            .iter()
            .any(|f| s(f, "name") == "Email"));
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn new_folders_are_kept() {
        let (mut v, dir) = test_vault();
        v.call("create", json!({"password": "password-sintetica"}))
            .unwrap();
        let item = v
            .call("item", json!({"type": "login", "title": "Sito", "f": {}}))
            .unwrap()["id"]
            .as_str()
            .unwrap()
            .to_string();
        let state = v.call("folder", json!({"name": "Lavoro"})).unwrap()["state"].clone();
        let folders = array(&state, "folders");
        assert_eq!(folders.len(), 1, "{state}");
        let fid = s(&folders[0], "id").to_string();
        v.call("bulk", json!({"ids": [item], "op": "move", "folder": fid}))
            .unwrap();
        v.call("lock", json!({})).unwrap();
        v.call("unlock", json!({"password": "password-sintetica"}))
            .unwrap();
        assert_eq!(array(&v.data, "folders").len(), 1);
        assert_eq!(s(&array(&v.data, "items")[0], "folder"), fid);
        fs::remove_dir_all(dir).unwrap();
    }
    /// Synthetic Kaspersky Password Manager text export (no real data).
    const KASPERSKY_EN: &str = "Websites\n\nWebsite name: Epic Games\nWebsite URL: https://www.epicgames.com/id/login\nLogin name: \nLogin: utente@example.com\nPassword: sëgreto-1🔑\nComment: prima riga\nseconda riga: con due punti\nhttps://example.com/aiuto\n\n---\n\nWebsite name: Epic Games\nWebsite URL: https://www.epicgames.com\nLogin name: Lavoro\nLogin: lavoro@example.com\nPassword: pw-2\nComment: \n\n---\n\nApplications\n\nApplication: Skype\nLogin name: \nLogin: utente.skype\nPassword: pw-3\nComment: \n\n---\n\nApplication: Feather Launcher\nLogin name: Principale\nLogin: uno@gmail.example\nPassword: pw-5\nComment: \n\n---\n\nApplication: Feather Launcher\nLogin name: Secondario\nLogin: due@outlook.example\nPassword: pw-6\nComment: \n\n---\n\nOther Accounts\n\nAccount name: Router di casa\nLogin name: \nLogin: admin\nPassword: pw-4\nComment: \n\n---\n\nNotes\n\nName: Codici Wi-Fi\nText: rete: casa\nseconda riga\n\n---\n";
    fn import_text(text: &str) -> (Vec<V>, Res<V>) {
        let (mut v, dir) = test_vault();
        v.call("create", json!({"password": "password-sintetica"}))
            .unwrap();
        let result = v.call("import", json!({"text": text}));
        let items = array(&v.data, "items").to_vec();
        fs::remove_dir_all(dir).unwrap();
        (items, result)
    }
    fn by_title<'a>(items: &'a [V], title: &str) -> &'a V {
        items
            .iter()
            .find(|i| s(i, "title") == title)
            .unwrap_or_else(|| panic!("{title} non importato"))
    }
    #[test]
    fn kaspersky_text_export_is_imported() {
        let (items, result) = import_text(KASPERSKY_EN);
        assert_eq!(result.unwrap()["count"], 7);
        let epic = by_title(&items, "Epic Games");
        assert_eq!(s(epic, "type"), "login");
        assert_eq!(s(&epic["f"], "url"), "https://www.epicgames.com/id/login");
        assert_eq!(s(&epic["f"], "username"), "utente@example.com");
        assert_eq!(s(&epic["f"], "password"), "sëgreto-1🔑");
        // Multi-line comment kept, including lines with ':' and URLs.
        assert_eq!(
            s(epic, "notes"),
            "prima riga\nseconda riga: con due punti\nhttps://example.com/aiuto"
        );
        // The login name is the title of that account; the site stays its group.
        let work = items
            .iter()
            .find(|i| s(&i["f"], "username") == "lavoro@example.com")
            .unwrap();
        assert_eq!(s(work, "title"), "Lavoro");
        assert_eq!(s(work, "notes"), "");
        assert_eq!(s(&work["f"], "url"), "https://www.epicgames.com");
        assert_eq!(s(&by_title(&items, "Skype")["f"], "password"), "pw-3");
        // Applications: one group per app name, never per email domain.
        // Titled by their login names, both in the group of the app.
        let feather: Vec<&V> = items
            .iter()
            .filter(|i| s(i, "gk") == "app:feather-launcher")
            .collect();
        assert_eq!(feather.len(), 2);
        for (it, title) in feather.iter().zip(["Principale", "Secondario"]) {
            assert_eq!(s(it, "title"), title);
            assert_eq!(s(it, "src"), "app");
        }
        assert_eq!(
            s(by_title(&items, "Router di casa"), "gk"),
            "other:router-di-casa"
        );
        // Websites with an address keep the normal grouping by site.
        assert_eq!(s(epic, "gk"), "");
        assert_eq!(
            s(&by_title(&items, "Router di casa")["f"], "username"),
            "admin"
        );
        let note = by_title(&items, "Codici Wi-Fi");
        assert_eq!(s(note, "type"), "note");
        assert_eq!(s(note, "notes"), "rete: casa\nseconda riga");
    }
    #[test]
    fn kaspersky_export_in_italian_or_unknown_labels() {
        let it = "Siti web\n\nNome sito web: Banca\nURL sito web: https://banca.example\nNome login: \nLogin: cliente\nPassword: pw-it\nCommento: nota\n\n---\n";
        let (items, result) = import_text(it);
        assert_eq!(result.unwrap()["count"], 1);
        let bank = by_title(&items, "Banca");
        assert_eq!(s(&bank["f"], "url"), "https://banca.example");
        assert_eq!(s(&bank["f"], "username"), "cliente");
        assert_eq!(s(bank, "notes"), "nota");
        // Labels of another language: password still recognized, the rest kept in notes.
        let other = "Websites\n\nSitio: Uno\nPassword: p1\nClave extra: a\n\n---\n\nSitio: Due\nPassword: p2\nClave extra: b\n\n---\n";
        let (items, result) = import_text(other);
        assert_eq!(result.unwrap()["count"], 2);
        let uno = items
            .iter()
            .find(|i| s(&i["f"], "password") == "p1")
            .unwrap();
        assert!(s(uno, "notes").contains("Sitio: Uno"));
        assert!(s(uno, "notes").contains("Clave extra: a"));
    }
    #[test]
    fn utf16_text_files_are_decoded_and_csv_is_not_mistaken() {
        let mut le = vec![0xff, 0xfe];
        le.extend(KASPERSKY_EN.encode_utf16().flat_map(u16::to_le_bytes));
        assert_eq!(decode_text(&le).unwrap(), KASPERSKY_EN);
        let mut be = vec![0xfe, 0xff];
        be.extend("ciao".encode_utf16().flat_map(u16::to_be_bytes));
        assert_eq!(decode_text(&be).unwrap(), "ciao");
        assert_eq!(decode_text("\u{feff}a,b".as_bytes()).unwrap(), "a,b");
        assert!(decode_text(&[0xff, 0xfe, 0x41]).is_err());
        assert!(decode_text(&[0xc3, 0x28]).is_err());
        let csv = "name,url,username,password\nSito,https://a.example,u,p\n";
        assert!(!is_kaspersky(csv));
        assert!(is_kaspersky(KASPERSKY_EN));
        let (items, result) = import_text(csv);
        assert_eq!(result.unwrap()["count"], 1);
        assert_eq!(s(&items[0]["f"], "password"), "p");
        // A text file that is neither: nothing is imported, the vault is unchanged.
        let (items, _) = import_text("solo testo\n---\nsenza campi\n");
        assert!(items.is_empty());
    }
    // 7 characters but 14 UTF-8 bytes, and 8 characters / 16 bytes.
    const SHORT_ACCENTED: &str = "àèìòùéç";
    const LONG_ACCENTED: &str = "àèìòùéçñ";
    #[test]
    fn length_policy_counts_characters() {
        assert!(!long_enough(SHORT_ACCENTED));
        assert!(long_enough(LONG_ACCENTED));
        let (mut v, dir) = test_vault();
        assert!(v
            .call("create", json!({"password": SHORT_ACCENTED}))
            .is_err());
        let rec = v
            .call("create", json!({"password": LONG_ACCENTED}))
            .unwrap()["recovery"]
            .as_str()
            .unwrap()
            .to_string();
        let master = json!({"old": LONG_ACCENTED, "new": SHORT_ACCENTED});
        assert!(v.call("master", master).is_err());
        assert!(v
            .call("pack", json!({"passphrase": SHORT_ACCENTED}))
            .is_err());
        v.call("lock", json!({})).unwrap();
        // A rejected new password must not leave the vault unlocked.
        let short = json!({"recovery": rec, "new_password": SHORT_ACCENTED});
        assert!(v.call("unlock", short).is_err());
        assert!(!v.unlocked());
        let reset = json!({"recovery": rec, "new_password": "nuova-master-1"});
        v.call("unlock", reset).unwrap();
        assert!(v.unlocked());
        v.call("lock", json!({})).unwrap();
        v.call("unlock", json!({"password": "nuova-master-1"}))
            .unwrap();
        fs::remove_dir_all(dir).unwrap();
    }

    fn unlocked_vault() -> (Vault, PathBuf) {
        let (mut v, dir) = test_vault();
        v.call("create", json!({"password": "password-sintetica"}))
            .unwrap();
        (v, dir)
    }
    fn item(id: &str) -> V {
        json!({"id": id, "type": "login", "title": "Esempio", "updated": 1.0,
               "f": {"url": "https://example.test", "username": "utente"}, "zz_unknown": 7})
    }
    #[test]
    fn import_rejects_invalid_payloads_without_changes() {
        let (mut v, dir) = unlocked_vault();
        let before = v.data.clone();
        let bad = [
            json!([1, 2]),
            json!({"items": "nope"}),
            json!({"items": [item("a"), 5]}),
            json!({"items": [{"type": "login", "title": "senza id"}]}),
            json!({"items": [{"id": "b", "type": "sconosciuto", "title": "x"}]}),
            json!({"items": [{"id": "c", "type": "login", "title": "x", "f": "testo"}]}),
            json!({"items": [item("d")], "passwords": [{"value": "senza id"}]}),
            json!({"folders": [{"id": "f1"}]}),
        ];
        for payload in bad {
            let text = payload.to_string();
            assert!(v.call("import", json!({"text": text})).is_err(), "{text}");
            assert_eq!(v.data, before, "{text}");
        }
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn import_roundtrip_keeps_unknown_fields() {
        let (mut v, dir) = unlocked_vault();
        let payload = json!({"kind": "jessamine-export", "folders": [], "items": [item("a")],
                             "passwords": [{"id": "p1", "value": "segreto-sintetico"}]});
        let r = v
            .call("import", json!({"text": payload.to_string()}))
            .unwrap();
        assert_eq!(r["count"], 1);
        let exported = v.call("export", json!({"format": "json"})).unwrap();
        let (mut other, dir2) = unlocked_vault();
        let text = exported["text"].as_str().unwrap();
        other.call("import", json!({"text": text})).unwrap();
        let items = array(&other.data, "items");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0]["zz_unknown"], 7);
        assert_eq!(array(&other.data, "passwords").len(), 1);
        fs::remove_dir_all(dir).unwrap();
        fs::remove_dir_all(dir2).unwrap();
    }
    #[test]
    fn failed_save_restores_memory() {
        let (mut v, dir) = unlocked_vault();
        let before = v.data.clone();
        // A file where the vault directory should be makes the write fail.
        fs::write(dir.join("blocco"), b"x").unwrap();
        v.path = dir.join("blocco").join("jesse_archive.vault");
        let payload = json!({"items": [item("a")]}).to_string();
        assert!(v.call("import", json!({"text": payload})).is_err());
        assert_eq!(v.data, before);
        let csv = "name,url,username,password\nEsempio,https://example.test,utente,pw-sintetica\n";
        assert!(v.call("import", json!({"text": csv})).is_err());
        assert_eq!(v.data, before);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn shape_is_completed_or_rejected() {
        let mut d = json!({"groups": null, "settings": {"autolock": 5}});
        ensure_shape(&mut d).unwrap();
        assert!(d["items"].is_array() && d["passwords"].is_array() && d["folders"].is_array());
        assert!(d["deleted"].is_object() && d["groups"].is_object());
        assert!(ensure_shape(&mut json!({"items": "x"})).is_err());
        assert!(ensure_shape(&mut json!({"items": [1]})).is_err());
        assert!(ensure_shape(&mut json!({"settings": 3})).is_err());
        assert!(ensure_shape(&mut json!([])).is_err());
    }

    #[test]
    fn idle_expiry_locks_on_every_command() {
        let (mut v, dir) = unlocked_vault();
        // ping reports the expiry and wipes the in-memory vault.
        v.last = now() - 6. * 60.;
        let r = v.call("ping", json!({})).unwrap();
        assert_eq!(r["unlocked"], false);
        assert!(v.key.is_none() && v.data.is_null() && v.header.is_null());
        // A protected command after expiry reports the expired session.
        v.call("unlock", json!({"password": "password-sintetica"}))
            .unwrap();
        v.last = now() - 6. * 60.;
        let err = v.call("state", json!({})).unwrap_err();
        assert!(err.contains("Sessione scaduta"));
        assert!(!v.unlocked());
        // The periodic check used by the background thread.
        v.call("unlock", json!({"password": "password-sintetica"}))
            .unwrap();
        assert!(!v.expire_if_idle());
        v.last = now() - 6. * 60.;
        assert!(v.expire_if_idle());
        assert!(!v.expire_if_idle());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn touch_extends_and_zero_disables_autolock() {
        let (mut v, dir) = unlocked_vault();
        v.last = now() - 4. * 60.;
        v.call("touch", json!({})).unwrap();
        assert!(now() - v.last < 5.);
        // ping must not count as user activity.
        v.last = now() - 4. * 60.;
        v.call("ping", json!({})).unwrap();
        assert!(now() - v.last > 3. * 60.);
        v.data["settings"]["autolock"] = json!(0);
        v.last = now() - 24. * 3600.;
        assert!(!v.expire_if_idle());
        assert!(v.unlocked());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn bulk_delete_only_removes_trashed_items() {
        // "Svuota cestino" relies on this: ids that are not in the trash survive.
        let (mut v, dir) = unlocked_vault();
        for title in ["kept", "gone"] {
            let it = json!({"type": "login", "title": title,
                            "f": {"password": format!("pw-sintetica-{title}")}});
            v.call("item", it).unwrap();
        }
        // New items get ids generated by the backend.
        let id_of = |v: &Vault, title: &str| {
            array(&v.data, "items")
                .iter()
                .find(|i| s(i, "title") == title)
                .map(|i| s(i, "id").to_string())
                .unwrap()
        };
        let (kept, gone) = (id_of(&v, "kept"), id_of(&v, "gone"));
        v.call("trash", json!({"id": gone})).unwrap();
        let r = v
            .call("bulk", json!({"ids": [kept, gone], "op": "delete"}))
            .unwrap();
        assert_eq!(r["count"], 1);
        let ids: Vec<&str> = array(&v.data, "items").iter().map(|i| s(i, "id")).collect();
        assert_eq!(ids, vec![kept.as_str()]);
        // The deleted item's password stays in the history as an orphan.
        assert!(array(&v.data, "passwords")
            .iter()
            .any(|p| s(p, "value") == "pw-sintetica-gone" && p["item_id"].is_null()));
        assert!(v.data["deleted"].get(&gone).is_some());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn dashboard_layout_is_stored_in_vault_settings_with_bounds() {
        let (mut v, dir) = unlocked_vault();
        let layout = json!({"version": 1, "active": "default", "layouts": {}});
        v.call("settings", json!({"dashboard": layout})).unwrap();
        assert_eq!(v.data["settings"]["dashboard"], layout);
        // Other settings are untouched; invalid or oversized layouts are refused.
        assert!(v.call("settings", json!({"dashboard": "x"})).is_err());
        let huge = json!({"pad": "x".repeat(40 * 1024)});
        assert!(v.call("settings", json!({"dashboard": huge})).is_err());
        assert_eq!(v.data["settings"]["dashboard"], layout);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn quick_search_recent_items_are_ids_saved_in_the_vault() {
        let (mut v, dir) = unlocked_vault();
        v.call(
            "settings",
            json!({"recent": ["qs-recent-alpha", "qs-recent-beta"]}),
        )
        .unwrap();
        assert_eq!(
            v.data["settings"]["recent"],
            json!(["qs-recent-alpha", "qs-recent-beta"])
        );
        // Saved inside the encrypted payload, never in clear in the file.
        let saved: V = serde_json::from_slice(&fs::read(&v.path).unwrap()).unwrap();
        assert!(!saved.to_string().contains("qs-recent-alpha"));
        for bad in [
            json!("qs-recent-alpha"),
            json!([1]),
            json!([""]),
            json!(vec!["x"; 13]),
        ] {
            assert!(v.call("settings", json!({"recent": bad})).is_err());
        }
        assert_eq!(
            v.data["settings"]["recent"],
            json!(["qs-recent-alpha", "qs-recent-beta"])
        );
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn backup_info_and_health_are_read_only_and_passive() {
        let (mut v, dir) = unlocked_vault();
        v.call(
            "item",
            json!({"type": "login", "title": "a", "f": {"password": "pw-sintetica-1"}}),
        )
        .unwrap();
        v.call(
            "item",
            json!({"type": "login", "title": "b", "f": {"password": "pw-sintetica-2"}}),
        )
        .unwrap();
        let info = v.call("backup_info", json!({})).unwrap();
        assert!(info["modified"].as_f64().is_some());
        assert_eq!(
            info["bak_exists"], true,
            "the second save keeps the previous file"
        );
        assert!(info["bak_modified"].as_f64().is_some());
        assert!(info.get("data").is_none() && !info.to_string().contains("pw-sintetica"));
        // Widgets refreshing by themselves must not keep the vault unlocked.
        v.last = now() - 4. * 60.;
        v.call("backup_info", json!({})).unwrap();
        v.call("health", json!({})).unwrap();
        assert!(now() - v.last > 3. * 60.);
        fs::remove_dir_all(dir).unwrap();
    }
}
