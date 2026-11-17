#!/usr/bin/env python3
"""Jesse's Archive - password manager locale, cifrato e portatile.

Avvio:  python jesse_archive.py
Il vault (cifrato AES-256-GCM, chiave derivata con scrypt) vive in ./dati/jesse_archive.vault:
copia l'intera cartella su un altro computer e hai tutto con te.
"""
import atexit, base64, copy, csv, hashlib, hmac, io, json, math, os, re, secrets, shutil, string
import plistlib, struct, subprocess, sys, tempfile, threading, time, urllib.error, urllib.request, uuid, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    sys.exit("Manca la libreria 'cryptography'. Installala con:  pip install cryptography")

FROZEN = getattr(sys, "frozen", False)  # True quando gira come .exe (PyInstaller)
BASE = Path(sys.executable).resolve().parent if FROZEN else Path(__file__).resolve().parent
RES = Path(getattr(sys, "_MEIPASS", BASE))  # risorse incluse nell'exe
CONFIG = BASE / "config.json"  # per-dispositivo: indica dove si trova il vault


def _cfg_get(k, default=None):
    try:
        return json.loads(CONFIG.read_text()).get(k, default)
    except Exception:
        return default


def _cfg_set(k, v):
    try:
        c = json.loads(CONFIG.read_text())
    except Exception:
        c = {}
    c[k] = v
    CONFIG.write_text(json.dumps(c))


def _cfg_vault():
    return _cfg_get("vault")


VAULT = Path(os.environ.get("JESSE_ARCHIVE_VAULT") or _cfg_vault() or BASE / "dati" / "jesse_archive.vault")
UI = RES / "ui" / "index.html"
ICON = RES / "jesse_archive.ico"
INST = Path(tempfile.gettempdir()) / "jesse_archive.instance"
_OLD = VAULT.with_name("jessamine.vault")  # migrazione dal vecchio nome
if _OLD.exists() and not VAULT.exists():
    _OLD.replace(VAULT)
    for _e in (".bak",):
        if _OLD.with_suffix(_e).exists():
            _OLD.with_suffix(_e).replace(VAULT.with_suffix(_e))
TOKEN = secrets.token_urlsafe(32)

# ---------------------------------------------------------------- crittografia
b64e = lambda b: base64.b64encode(b).decode()
b64d = base64.b64decode
now = lambda: round(time.time(), 3)
uid = lambda: uuid.uuid4().hex[:12]


class Err(Exception):
    pass


def kdf(secret: str, salt: bytes) -> bytes:
    return hashlib.scrypt(secret.encode(), salt=salt, n=2**15, r=8, p=1, maxmem=2**27, dklen=32)


def seal(key: bytes, data: bytes) -> str:
    n = os.urandom(12)
    return b64e(n + AESGCM(key).encrypt(n, data, None))


def unseal(key: bytes, s: str) -> bytes:
    raw = b64d(s)
    return AESGCM(key).decrypt(raw[:12], raw[12:], None)


def new_recovery() -> str:
    alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    c = "".join(secrets.choice(alpha) for _ in range(24))
    return "-".join(c[i:i + 4] for i in range(0, 24, 4))


norm = lambda c: re.sub(r"[^A-Z0-9]", "", c.upper())

# ---------------------------------------------------------------------- vault
FIELDS = {
    "login": ["url", "username", "password", "totp"],
    "card": ["holder", "number", "expiry", "cvv", "pin"],
    "note": [],
    "personal": ["fullname", "email", "phone", "address", "city", "zip", "country", "birthday"],
    "passkey": ["url", "username", "credential"],
    "crypto": ["platform", "address", "seed", "password"],
}
SECRET = {"login": "password", "card": "pin", "crypto": "password"}  # campo collegato all'archivio password


canon = lambda d: json.dumps(d, sort_keys=True)
_ts = lambda x: x.get("upd") or x.get("updated") or x.get("created") or 0


def normalize(d):
    """Rende coerenti i dati dopo una fusione. True se ha cambiato qualcosa."""
    ch = False
    fids = {f["id"] for f in d["folders"]}
    iids = {i["id"] for i in d["items"]}
    for p in d["passwords"]:
        if p["item_id"] and p["item_id"] not in iids:
            p.update(item_id=None, active=False, orphan_of=p.get("item_title"), upd=now())
            ch = True
    for it in d["items"]:
        if it.get("folder") and it["folder"] not in fids:
            it["folder"], ch = None, True
        sf = SECRET.get(it["type"])
        if not sf:
            continue
        val = it["f"].get(sf) or ""
        act = [p for p in d["passwords"] if p["item_id"] == it["id"] and p.get("active")]
        if (len(act) == 1 and act[0]["value"] == val) or (not val and not act):
            continue
        for p in act:
            p["active"], p["upd"] = False, now()
        link(it, val, d)
        ch = True
    return ch


def merge_data(a, b):
    """Fonde il vault remoto `b` in quello locale `a` (per singolo elemento, vince il più recente)."""
    ch = False
    tomb = a.setdefault("deleted", {})
    for k, v in b.get("deleted", {}).items():
        if v > tomb.get(k, 0):
            tomb[k], ch = v, True
    for coll in ("items", "passwords", "folders"):
        have = {x["id"]: x for x in a[coll]}
        for y in b.get(coll, []):
            x = have.get(y["id"])
            if x is None:
                a[coll].append(copy.deepcopy(y))
                ch = True
            elif _ts(y) > _ts(x):
                x.clear()
                x.update(copy.deepcopy(y))
                ch = True
        keep = [x for x in a[coll] if x["id"] not in tomb or tomb[x["id"]] < _ts(x)]
        if len(keep) != len(a[coll]):
            a[coll], ch = keep, True
    G = a.setdefault("groups", {})
    for k, y in b.get("groups", {}).items():
        if k not in G or _ts(y) > _ts(G[k]):
            G[k], ch = copy.deepcopy(y), True
    if b.get("settings_upd", 0) > a.get("settings_upd", 0):
        a["settings"], a["settings_upd"] = copy.deepcopy(b["settings"]), b["settings_upd"]
        ch = True
    return normalize(a) or ch


class Vault:
    def __init__(s):
        s.fails = s.rev = 0
        s.lock()

    def lock(s):
        s.key = s.d = s.hdr = s.sig = None
        s.push = False
        s.last = s.last_sync = now()

    unlocked = property(lambda s: s.key is not None)

    def create(s, pw):
        if len(pw) < 8:
            raise Err("La password principale deve avere almeno 8 caratteri.")
        dek, rec = os.urandom(32), new_recovery()
        s.hdr = {"v": 1}
        s._wrap(pw, dek)
        s._wrap_rec(rec, dek)
        s.key = dek
        s.d = {"items": [], "passwords": [], "folders": [], "deleted": {}, "settings_upd": 0,
               "settings": {"autolock": 5, "clip": 30, "old_days": 180}}
        s.save()
        return rec

    def _wrap(s, pw, dek):
        salt = os.urandom(16)
        s.hdr.update(salt=b64e(salt), wrap=seal(kdf(pw, salt), dek), hv=now())

    def _wrap_rec(s, rec, dek):
        salt = os.urandom(16)
        s.hdr.update(rsalt=b64e(salt), rwrap=seal(kdf(norm(rec), salt), dek), hv=now())

    # --- file e sincronizzazione
    def _sig(s):
        try:
            st = VAULT.stat()
            return (st.st_mtime_ns, st.st_size)
        except OSError:
            return None

    def _read(s, path):
        h = json.loads(path.read_text())
        return h, json.loads(unseal(s.key, h["data"]))

    def _write(s):
        h = dict(s.hdr, data=seal(s.key, json.dumps(s.d).encode()))
        VAULT.parent.mkdir(parents=True, exist_ok=True)
        tmp = VAULT.with_suffix(".tmp")
        tmp.write_text(json.dumps(h))
        if VAULT.exists():
            shutil.copy(VAULT, VAULT.with_suffix(".bak"))
        os.replace(tmp, VAULT)
        s.sig, s.push = s._sig(), False

    def _adopt(s, h):
        if h.get("hv", 0) > s.hdr.get("hv", 0):
            s.hdr = {k: v for k, v in h.items() if k != "data"}

    def _pull(s):
        """Unisce ciò che altri dispositivi hanno scritto. True se i dati locali sono cambiati."""
        ch, sig = False, s._sig()
        if sig and sig != s.sig:
            try:
                h, rd = s._read(VAULT)
            except Exception:  # file a metà sincronizzazione: riprovo al prossimo giro
                h = rd = None
            if rd is not None:
                ch |= merge_data(s.d, rd)
                s._adopt(h)
                s.push |= canon(s.d) != canon(rd) or h.get("hv", 0) < s.hdr.get("hv", 0)
                s.sig = sig
        for f in sorted(VAULT.parent.glob("jesse_archive*.vault")):  # copie "in conflitto" del cloud
            if f.name == VAULT.name:
                continue
            try:
                h, rd = s._read(f)
            except Exception:
                continue
            ch |= merge_data(s.d, rd)
            s._adopt(h)
            s.push = True
            f.replace(f.with_suffix(".merged"))
        s.last_sync = now()
        return ch

    def save(s):
        s._pull()
        s._write()

    def refresh(s):
        if not s.unlocked:
            return
        ch = s._pull()
        if s.push:
            s._write()
        if ch:
            s.rev += 1

    def unlock(s, pw=None, rec=None, new=None):
        h = json.loads(VAULT.read_text())
        try:
            if rec:
                dek = unseal(kdf(norm(rec), b64d(h["rsalt"])), h["rwrap"])
            else:
                dek = unseal(kdf(pw or "", b64d(h["salt"])), h["wrap"])
            data = json.loads(unseal(dek, h["data"]))
        except Exception:
            s.fails += 1
            time.sleep(min(0.5 * s.fails, 5))
            raise Err("Password o codice di recupero non corretti.")
        s.fails, s.hdr, s.key, s.d, s.last = 0, {k: v for k, v in h.items() if k != "data"}, dek, data, now()
        s.d.setdefault("deleted", {})
        s.d.setdefault("settings_upd", 0)
        s.sig, s.push = s._sig(), False
        if rec and new:
            if len(new) < 8:
                raise Err("La nuova password deve avere almeno 8 caratteri.")
            s._wrap(new, dek)
            s.save()
        else:
            try:
                s.refresh()
            except Exception:
                pass

    def check_master(s, pw):
        try:
            unseal(kdf(pw or "", b64d(s.hdr["salt"])), s.hdr["wrap"])
        except Exception:
            raise Err("Password principale non corretta.")


V = Vault()

# ---------------------------------------------------------------- generatore
COMMON = {"password", "123456", "12345678", "qwerty", "abc123", "111111", "letmein", "admin", "welcome",
          "iloveyou", "password1", "123456789", "qwerty123", "dragon", "monkey", "123123", "000000",
          "passw0rd", "ciaociao", "juventus", "forzaroma"}


def bits(p: str) -> float:
    if not p:
        return 0
    if p.lower() in COMMON:
        return 4
    pool = ((26 if re.search("[a-z]", p) else 0) + (26 if re.search("[A-Z]", p) else 0)
            + (10 if re.search(r"\d", p) else 0) + (32 if re.search(r"[^A-Za-z0-9]", p) else 0))
    eff = len(set(p)) + 0.3 * (len(p) - len(set(p)))
    eff -= 0.7 * sum(1 for a, b in zip(p, p[1:]) if abs(ord(a) - ord(b)) == 1)
    return round(max(1, eff) * math.log2(max(pool, 2)), 1)


def _pw(o):
    L = max(4, min(128, int(o.get("length", 20))))
    excl = set(o.get("exclude", "")) | (set("0O1lI|`'\"") if o.get("ambiguous") else set())
    spec = [(o.get("lower", True), string.ascii_lowercase, 1), (o.get("upper", True), string.ascii_uppercase, 1),
            (o.get("digits", True), string.digits, int(o.get("min_digits", 1))),
            (o.get("symbols", True), o.get("symset") or "!@#$%^&*", int(o.get("min_symbols", 1)))]
    sets = []
    for on, chars, m in spec:
        chars = "".join(c for c in dict.fromkeys(chars) if c not in excl)
        if on and chars:
            sets.append((chars, max(0, m)))
    if not sets:
        raise Err("Seleziona almeno un tipo di caratteri.")
    pool = "".join(dict.fromkeys("".join(c for c, _ in sets)))
    if o.get("unique") and L > len(pool):
        raise Err("Con 'caratteri unici' la lunghezza massima è %d." % len(pool))
    R = secrets.SystemRandom()
    for _ in range(500):
        ch = [R.choice(c) for c, m in sets for _ in range(m)][:L]
        ch += [R.choice(pool) for _ in range(L - len(ch))]
        R.shuffle(ch)
        if o.get("start_letter") and not ch[0].isalpha():
            idx = [i for i, c in enumerate(ch) if c.isalpha()]
            if not idx:
                continue
            j = R.choice(idx)
            ch[0], ch[j] = ch[j], ch[0]
        if o.get("unique") and len(set(ch)) < L:
            continue
        return "".join(ch), round(L * math.log2(len(pool)), 1)
    raise Err("Impossibile rispettare tutte le opzioni scelte.")


def _word(n=3):
    return "".join(secrets.choice("bdfgklmnprstvz") + secrets.choice("aeiou") for _ in range(n))


def _phrase(o):
    n = max(2, min(12, int(o.get("words", 4))))
    ws = [_word() for _ in range(n)]
    if o.get("cap", True):
        ws = [w.capitalize() for w in ws]
    sep = str(o.get("sep", "-"))[:3]
    b = n * 3 * math.log2(70)
    if o.get("add_number", True):
        ws.append(str(secrets.randbelow(100)))
        b += math.log2(100)
    return sep.join(ws), round(b, 1)


def generate(o):
    mode, out = o.get("mode", "password"), []
    for _ in range(max(1, min(10, int(o.get("count", 5))))):
        if mode == "passphrase":
            v, b = _phrase(o)
        elif mode == "pin":
            n = max(4, min(16, int(o.get("pin_len", 6))))
            v, b = "".join(secrets.choice(string.digits) for _ in range(n)), round(n * math.log2(10), 1)
        elif mode == "username":
            v, b = _word(2).capitalize() + _word(2) + str(secrets.randbelow(100)), 33
        else:
            v, b = _pw(o)
        out.append({"value": v, "bits": b})
    return out


def totp(secret, digits=6, step=30):
    m = re.search(r"secret=([A-Za-z2-7]+)", secret)
    s = re.sub(r"\s", "", m.group(1) if m else secret).upper()
    key = base64.b32decode(s + "=" * (-len(s) % 8))
    h = hmac.new(key, struct.pack(">Q", int(time.time()) // step), "sha1").digest()
    o = h[-1] & 15
    return str((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 10**digits).zfill(digits)


# ---------------------------------------------------------------------- API
ROUTES, OPEN = {}, {"status", "create", "unlock", "ping", "suggest", "loc_use", "show"}
LOCK = threading.RLock()


def route(name):
    def deco(f):
        ROUTES[name] = f
        return f
    return deco


RUNKEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
SHOW, NATIVE = None, False
_TRAY = {"icon": None}


def _tray_ok():
    try:
        import pystray  # noqa
        from PIL import Image  # noqa
        return True
    except Exception:
        return False


def _autostart_cmd():
    if FROZEN:
        return '"%s" --background' % sys.executable
    pw = Path(sys.executable).with_name("pythonw.exe")
    return '"%s" "%s" --background' % (pw if pw.exists() else sys.executable, Path(__file__).resolve())


def autostart_get():
    if sys.platform != "win32":
        return False
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUNKEY) as k:
            winreg.QueryValueEx(k, "JesseArchive")
            return True
    except OSError:
        return False


def autostart_set(on):
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUNKEY, 0, winreg.KEY_SET_VALUE) as k:
            if on:
                winreg.SetValueEx(k, "JesseArchive", 0, winreg.REG_SZ, _autostart_cmd())
            else:
                try:
                    winreg.DeleteValue(k, "JesseArchive")
                except FileNotFoundError:
                    pass
    except OSError as e:
        raise Err("Impossibile modificare l'avvio automatico: %s" % e)


def prefs():
    return {"close": _cfg_get("close_action", "quit"), "autostart": autostart_get(), "tray_ok": _tray_ok(),
            "native": NATIVE, "win": sys.platform == "win32"}


def state():
    return dict(V.d, path=str(VAULT.resolve()), synced_at=V.last_sync, prefs=prefs())


def find(iid):
    it = next((i for i in V.d["items"] if i["id"] == iid), None)
    if not it:
        raise Err("Elemento non trovato.")
    return it


def link(it, val, d=None):
    """Collega `val` come password attuale di `it`; la precedente resta nello storico."""
    P = (d or V.d)["passwords"]
    cur = next((p for p in P if p["item_id"] == it["id"] and p.get("active")), None)
    if cur and cur["value"] == val:
        return
    if cur:
        cur["active"], cur["retired"], cur["upd"] = False, now(), now()
    if not val:
        return
    p = next((p for p in P if p["value"] == val and p["item_id"] in (None, it["id"])), None)
    if not p:
        p = {"id": uid(), "value": val, "created": now(), "upd": now(), "source": "manual"}
        P.append(p)
    p.update(item_id=it["id"], active=True, linked=now(), upd=now(), retired=None, item_title=it["title"],
             item_type=it["type"])


@route("status")
def _(b):
    return {"exists": VAULT.exists(), "unlocked": V.unlocked, "path": str(VAULT.resolve())}


@route("ping")
def _(b):
    global LAST_PING
    LAST_PING = time.time()
    if V.unlocked:
        try:
            V.refresh()
        except Exception:
            pass
    return {"ok": 1, "unlocked": V.unlocked, "rev": V.rev}


@route("create")
def _(b):
    if VAULT.exists():
        raise Err("Esiste già un vault.")
    return {"recovery": V.create(b.get("password", ""))}


@route("unlock")
def _(b):
    if not VAULT.exists():
        raise Err("Nessun vault trovato.")
    V.unlock(b.get("password"), b.get("recovery"), b.get("new_password"))
    return {"ok": 1}


@route("touch")
def _(b):
    return {"ok": 1}


@route("lock")
def _(b):
    V.lock()
    return {"ok": 1}


@route("state")
def _(b):
    return state()


@route("item")
def _(b):
    d = V.d
    it = next((i for i in d["items"] if i["id"] == b.get("id")), None)
    if not it and b.get("type") not in FIELDS:
        raise Err("Tipo non valido.")
    if not it:
        it = {"id": uid(), "created": now(), "trashed": None, "shared": False, "f": {}}
        d["items"].append(it)
    for k in ("type", "title", "folder", "fav", "f", "notes"):
        if k in b:
            it[k] = b[k]
    it["title"] = (it.get("title") or "Senza titolo").strip()
    it["updated"] = now()
    g = b.get("group")
    if g and it["type"] == "login" and g.get("key"):
        key = str(g["key"])[:200]
        it["gk"], it["src"] = key, g.get("src", "web")
        G, cur, ic = d.setdefault("groups", {}), d.get("groups", {}).get(key), g.get("icon") or ""
        if not (ic.startswith("data:image/") and len(ic) < 250000):
            ic = ""
        if not cur:
            G[key] = {"name": str(g.get("name") or key)[:80], "icon": ic, "src": it["src"], "upd": now()}
        elif ic:
            cur["icon"], cur["upd"] = ic, now()
    sf = SECRET.get(it["type"])
    if sf:
        link(it, it["f"].get(sf) or "")
    for p in d["passwords"]:
        if p["item_id"] == it["id"]:
            p["item_title"], p["item_type"] = it["title"], it["type"]
    V.save()
    return {"id": it["id"], "state": state()}


@route("trash")
def _(b):
    it = find(b["id"])
    it["trashed"] = None if b.get("restore") else now()
    it["updated"] = now()
    V.save()
    return {"state": state()}


@route("delete")
def _(b):
    ids = {i["id"] for i in V.d["items"] if i["id"] == b.get("id") or (b.get("all") and i["trashed"])}
    for p in V.d["passwords"]:
        if p["item_id"] in ids:
            p.update(item_id=None, active=False, orphan_of=p.get("item_title"), upd=now())
    V.d["deleted"].update({i: now() for i in ids})
    V.d["items"] = [i for i in V.d["items"] if i["id"] not in ids]
    V.save()
    return {"state": state()}


@route("bulk")
def _(b):
    d, op = V.d, b.get("op")
    ids = set(b.get("ids") or [])
    items = [i for i in d["items"] if i["id"] in ids]
    if op in ("trash", "restore"):
        for i in items:
            i["trashed"], i["updated"] = (None if op == "restore" else now()), now()
    elif op == "move":
        f = b.get("folder") or None
        if f and not any(x["id"] == f for x in d["folders"]):
            raise Err("Cartella non trovata.")
        for i in items:
            i["folder"], i["updated"] = f, now()
    elif op == "delete":
        items = [i for i in items if i["trashed"]]  # si elimina in modo definitivo solo dal cestino
        dead = {i["id"] for i in items}
        for p in d["passwords"]:
            if p["item_id"] in dead:
                p.update(item_id=None, active=False, orphan_of=p.get("item_title"), upd=now())
        d["deleted"].update({i: now() for i in dead})
        d["items"] = [i for i in d["items"] if i["id"] not in dead]
    else:
        raise Err("Operazione non valida.")
    V.save()
    return {"state": state(), "count": len(items)}


@route("folder")
def _(b):
    F = V.d["folders"]
    if b.get("delete"):
        V.d["deleted"][b["id"]] = now()
        V.d["folders"] = [f for f in F if f["id"] != b["id"]]
        for i in V.d["items"]:
            if i.get("folder") == b["id"]:
                i["folder"], i["updated"] = None, now()
    else:
        name = (b.get("name") or "").strip()
        if not name:
            raise Err("Dai un nome alla cartella.")
        f = next((f for f in F if f["id"] == b.get("id")), None)
        if f:
            f["name"], f["upd"] = name, now()
        else:
            F.append({"id": uid(), "name": name, "upd": now()})
    V.save()
    return {"state": state()}


@route("generate")
def _(b):
    try:
        return {"results": generate(b)}
    except (ValueError, TypeError):
        raise Err("Opzioni non valide.")


@route("pw_save")
def _(b):
    v = b.get("value") or ""
    if not v:
        raise Err("Password vuota.")
    P = V.d["passwords"]
    if not any(p["value"] == v for p in P):
        P.append({"id": uid(), "value": v, "created": now(), "upd": now(), "source": b.get("source", "generated"),
                  "item_id": None, "active": False, "label": b.get("label", "")})
        V.save()
    return {"state": state()}


@route("pw_link")
def _(b):
    p = next((p for p in V.d["passwords"] if p["id"] == b["pid"]), None)
    it = find(b["item_id"])
    sf = SECRET.get(it["type"])
    if not p or not sf:
        raise Err("Questo tipo di elemento non ha un campo password collegabile.")
    it["f"][sf] = p["value"]
    it["updated"] = now()
    link(it, p["value"])
    V.save()
    return {"state": state()}


@route("prefs_set")
def _(b):
    if "close_action" in b:
        if b["close_action"] not in ("quit", "tray"):
            raise Err("Valore non valido.")
        _cfg_set("close_action", b["close_action"])
    if "autostart" in b:
        if sys.platform != "win32":
            raise Err("L'avvio automatico è disponibile solo su Windows.")
        autostart_set(bool(int(b["autostart"])))
    return {"state": state()}


@route("show")
def _(b):
    if SHOW:
        SHOW()
    return {"ok": 1}


@route("pw_del")
def _(b):
    p = next((p for p in V.d["passwords"] if p["id"] == b["pid"]), None)
    if p and p.get("active") and p["item_id"]:
        raise Err("È la password attuale di un elemento: modificala dall'elemento.")
    V.d["deleted"][b["pid"]] = now()
    V.d["passwords"] = [x for x in V.d["passwords"] if x["id"] != b["pid"]]
    V.save()
    return {"state": state()}


@route("pw_bulk")
def _(b):
    pids = set(b.get("pids") or [])
    dead = {p["id"] for p in V.d["passwords"] if p["id"] in pids and not (p.get("active") and p["item_id"])}
    V.d["deleted"].update({i: now() for i in dead})  # le password attuali di un account non si eliminano da qui
    V.d["passwords"] = [p for p in V.d["passwords"] if p["id"] not in dead]
    V.save()
    return {"state": state(), "count": len(dead), "skipped": len(pids) - len(dead)}


@route("health")
def _(b):
    d, byid = V.d, {i["id"]: i for i in V.d["items"]}
    act = [p for p in d["passwords"] if p.get("active") and p["item_id"] in byid and not byid[p["item_id"]]["trashed"]]
    ref = lambda p: {"pid": p["id"], "item_id": p["item_id"], "title": p["item_title"], "bits": bits(p["value"])}
    weak = [ref(p) for p in act if bits(p["value"]) < 60 or len(p["value"]) < 8]
    groups = {}
    for p in act:
        groups.setdefault(p["value"], []).append(ref(p))
    reused = [g for g in groups.values() if len(g) > 1]
    lim = now() - int(d["settings"].get("old_days", 180)) * 86400
    old = [ref(p) | {"since": p.get("linked", p["created"])} for p in act if p.get("linked", p["created"]) < lim]
    bad = len({r["pid"] for r in weak} | {r["pid"] for g in reused for r in g} | {r["pid"] for r in old})
    score = 100 if not act else round(100 * (1 - bad / len(act)))
    return {"weak": weak, "reused": reused, "old": old, "total": len(act), "score": score}


@route("breach")
def _(b):
    d, byid, out, cache = V.d, {i["id"]: i for i in V.d["items"]}, [], {}
    for p in d["passwords"]:
        if not (p.get("active") and p["item_id"] in byid and not byid[p["item_id"]]["trashed"]):
            continue
        h = hashlib.sha1(p["value"].encode()).hexdigest().upper()
        if h[:5] not in cache:
            try:
                req = urllib.request.Request("https://api.pwnedpasswords.com/range/" + h[:5],
                                             headers={"Add-Padding": "true", "User-Agent": "Jesse's Archive"})
                cache[h[:5]] = urllib.request.urlopen(req, timeout=8).read().decode()
            except Exception:
                raise Err("Impossibile contattare il servizio di verifica. Controlla la connessione a Internet.")
        cnt = next((int(l.split(":")[1]) for l in cache[h[:5]].splitlines() if l.startswith(h[5:])), 0)
        out.append({"pid": p["id"], "item_id": p["item_id"], "title": p["item_title"], "count": cnt})
    return {"results": out}


@route("totp")
def _(b):
    try:
        return {"code": totp(find(b["id"])["f"].get("totp", "")), "left": 30 - int(time.time()) % 30}
    except Exception:
        raise Err("Chiave TOTP non valida.")


@route("settings")
def _(b):
    for k in ("autolock", "clip", "old_days", "logos"):
        if k in b:
            V.d["settings"][k] = max(0, int(b[k]))
    if isinstance(b.get("theme"), dict):
        t, ok = b["theme"], re.compile(r"#[0-9a-fA-F]{6}")
        clean = {"preset": re.sub(r"[^a-z]", "", str(t.get("preset", "amethyst")))[:20] or "amethyst"}
        if isinstance(t.get("custom"), dict):
            clean["custom"] = {k: t["custom"][k] for k in ("am", "plum", "bg", "sf") if ok.fullmatch(str(t["custom"].get(k, "")))}
        V.d["settings"]["theme"] = clean
    V.d["settings_upd"] = now()
    V.save()
    return {"state": state()}


@route("master")
def _(b):
    V.check_master(b.get("old"))
    if len(b.get("new", "")) < 8:
        raise Err("La nuova password deve avere almeno 8 caratteri.")
    V._wrap(b["new"], V.key)
    V.save()
    return {"ok": 1}


@route("recovery_new")
def _(b):
    V.check_master(b.get("password"))
    rec = new_recovery()
    V._wrap_rec(rec, V.key)
    V.save()
    return {"recovery": rec}


@route("pack")
def _(b):
    pw = b.get("passphrase", "")
    if len(pw) < 8:
        raise Err("La passphrase deve avere almeno 8 caratteri.")
    d, ids = V.d, b.get("ids")
    items = [i for i in d["items"] if not ids or i["id"] in ids]
    iset = {i["id"] for i in items}
    if ids:
        for i in items:
            i["shared"] = True
        V.save()
    payload = {"folders": d["folders"], "items": items,
               "passwords": [p for p in d["passwords"] if p["item_id"] in iset or not ids and not p["item_id"]]}
    salt = os.urandom(16)
    blob = seal(kdf(pw, salt), json.dumps(payload).encode())
    return {"data": json.dumps({"jessamine": 1, "salt": b64e(salt), "blob": blob}), "state": state()}


def merge(pl):
    d = V.d
    fname = {f["id"]: f["name"] for f in pl.get("folders", [])}
    for n in set(fname.values()):
        if not any(f["name"] == n for f in d["folders"]):
            d["folders"].append({"id": uid(), "name": n, "upd": now()})
    local = {f["name"]: f["id"] for f in d["folders"]}
    have, n = {i["id"]: i for i in d["items"]}, 0
    for it in pl.get("items", []):
        it["folder"] = local.get(fname.get(it.get("folder")))
        if it["id"] in have:
            if it.get("updated", 0) > have[it["id"]].get("updated", 0):
                have[it["id"]].update(it)
                n += 1
        else:
            d["items"].append(it)
            n += 1
    ids = {p["id"] for p in d["passwords"]}
    d["passwords"] += [p for p in pl.get("passwords", []) if p["id"] not in ids]
    return n


@route("unpack")
def _(b):
    try:
        pkg = json.loads(b["data"])
        pl = json.loads(unseal(kdf(b.get("passphrase", ""), b64d(pkg["salt"])), pkg["blob"]))
    except Exception:
        raise Err("File non valido o passphrase errata.")
    n = merge(pl)
    V.save()
    return {"count": n, "state": state()}


@route("export")
def _(b):
    d = V.d
    if b.get("format") == "json":
        return {"text": json.dumps({"kind": "jessamine-export", **{k: d[k] for k in ("folders", "items", "passwords")}},
                                   indent=1)}
    keys = sorted({k for ks in FIELDS.values() for k in ks})
    fn = {f["id"]: f["name"] for f in d["folders"]}
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["name", "type", "folder", "notes"] + keys)
    for i in d["items"]:
        if not i["trashed"]:
            w.writerow([i["title"], i["type"], fn.get(i.get("folder"), ""), i.get("notes", "")]
                       + [i["f"].get(k, "") for k in keys])
    return {"text": out.getvalue()}


ALIAS = {"name": "title", "title": "title", "login_uri": "url", "website": "url", "url": "url",
         "login_username": "username", "username": "username", "login_password": "password",
         "password": "password", "note": "notes", "notes": "notes", "extra": "notes", "login_totp": "totp",
         "totp": "totp", "cardholdername": "holder", "holder": "holder", "cardnumber": "number",
         "number": "number", "cvc": "cvv", "cvv": "cvv", "pin": "pin", "expirydate": "expiry",
         "expiry": "expiry", "full_name": "fullname", "fullname": "fullname", "phone_number": "phone",
         "phone": "phone", "email": "email", "address1": "address", "address": "address", "city": "city",
         "zip": "zip", "country": "country", "folder": "folder", "grouping": "folder", "type": "type",
         "platform": "platform", "seed": "seed", "credential": "credential", "birthday": "birthday"}


@route("import")
def _(b):
    text = (b.get("text") or "").lstrip("\ufeff")
    if text.lstrip().startswith("{"):
        try:
            n = merge(json.loads(text))
        except Exception:
            raise Err("File JSON non valido.")
        V.save()
        return {"count": n, "state": state()}
    d, n = V.d, 0
    for row in csv.DictReader(io.StringIO(text)):
        r = {}
        for k, v in row.items():
            a = ALIAS.get((k or "").strip().lower())
            if a and v and (a not in r):
                r[a] = v
        t = {"credit_card": "card", "secure_note": "note"}.get(r.get("type", ""), r.get("type", ""))
        if t not in FIELDS:
            t = "card" if r.get("number") else "login"
        title = r.get("title") or r.get("url") or r.get("username")
        if not title:
            continue
        fid = None
        if r.get("folder"):
            fid = next((f["id"] for f in d["folders"] if f["name"] == r["folder"]), None)
            if not fid:
                fid = uid()
                d["folders"].append({"id": fid, "name": r["folder"], "upd": now()})
        it = {"id": uid(), "created": now(), "updated": now(), "trashed": None, "shared": False, "type": t,
              "title": title, "folder": fid, "fav": False, "notes": r.get("notes", ""),
              "f": {k: r[k] for k in FIELDS[t] if k in r}}
        d["items"].append(it)
        sf = SECRET.get(t)
        if sf and it["f"].get(sf):
            link(it, it["f"][sf])
            next(p for p in d["passwords"] if p["item_id"] == it["id"] and p["active"])["source"] = "imported"
        n += 1
    V.save()
    return {"count": n, "state": state()}


# ------------------------------------------------------- gruppi, loghi, app
def _fetch_logo(dom):
    """Logo del sito (DuckDuckGo). '' = nessun logo, None = errore di rete."""
    req = urllib.request.Request("https://icons.duckduckgo.com/ip3/%s.ico" % dom, headers={"User-Agent": "Mozilla/5.0"})
    try:
        r = urllib.request.urlopen(req, timeout=6)
        data, ct = r.read(200001), r.headers.get_content_type()
    except urllib.error.HTTPError:
        return ""
    except Exception:
        return None
    if not 100 < len(data) <= 200000:
        return ""
    return "data:%s;base64,%s" % (ct if ct.startswith("image/") else "image/x-icon", b64e(data))


@route("group_logo")
def _(b):
    key, dom = str(b.get("key", "")), str(b.get("key", ""))[4:]
    if V.d["settings"].get("logos", 1) == 0 or not key.startswith("web:") or not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,}", dom):
        return {"found": False}
    g = V.d.setdefault("groups", {}).setdefault(key, {"name": dom, "icon": "", "src": "web", "upd": now()})
    if g.get("icon") or now() - g.get("tried", 0) < 7 * 86400:
        return {"found": False}
    ic = _fetch_logo(dom)
    if ic is None:  # offline: riprova più tardi
        return {"found": False}
    g["tried"], g["upd"] = now(), now()
    if ic:
        g["icon"] = ic
    V.save()
    return {"found": bool(ic), "state": state()}


@route("group_edit")
def _(b):
    key = str(b.get("key", ""))
    g = V.d.setdefault("groups", {}).setdefault(key, {"name": key, "icon": "", "src": key.split(":")[0]})
    if (b.get("name") or "").strip():
        g["name"] = b["name"].strip()[:80]
    ic = b.get("icon") or ""
    if ic == "-":
        g["icon"], g["tried"] = "", 0
    elif ic.startswith("data:image/") and len(ic) < 250000:
        g["icon"] = ic
    g["upd"] = now()
    V.save()
    return {"state": state()}


@route("apps")
def _(b):
    out = {}
    if sys.platform == "win32":
        bad = re.compile(r"uninstall|disinstall|readme|help|manual|license|documentation|release notes|website|sito web", re.I)
        for root in (Path(os.environ.get("ProgramData", "C:/ProgramData")) / "Microsoft/Windows/Start Menu/Programs",
                     Path(os.environ.get("APPDATA", "")) / "Microsoft/Windows/Start Menu/Programs"):
            if root.is_dir():
                for f in root.rglob("*.lnk"):
                    if not bad.search(f.stem):
                        out.setdefault(f.stem.lower(), {"name": f.stem, "path": str(f)})
    elif sys.platform == "darwin":
        for d in ("/Applications", "/System/Applications", str(Path.home() / "Applications")):
            for f in Path(d).glob("*.app"):
                out.setdefault(f.stem.lower(), {"name": f.stem, "path": str(f)})
    else:
        for d in ("/usr/share/applications", str(Path.home() / ".local/share/applications")):
            for f in Path(d).glob("*.desktop"):
                try:
                    m = re.search(r"^Name=(.+)$", f.read_text(errors="ignore"), re.M)
                    if m and "NoDisplay=true" not in f.read_text(errors="ignore"):
                        out.setdefault(m.group(1).lower(), {"name": m.group(1), "path": str(f)})
                except OSError:
                    pass
    return {"apps": sorted(out.values(), key=lambda a: a["name"].lower())}


_PS = ("Add-Type -AssemblyName System.Drawing;$p=$env:JA_PATH;"
       "if($p -like '*.lnk'){try{$t=(New-Object -ComObject WScript.Shell).CreateShortcut($p).TargetPath;if($t -and (Test-Path $t)){$p=$t}}catch{}};"
       "$i=[System.Drawing.Icon]::ExtractAssociatedIcon($p);$m=New-Object IO.MemoryStream;"
       "$i.ToBitmap().Save($m,[System.Drawing.Imaging.ImageFormat]::Png);[Convert]::ToBase64String($m.ToArray())")


@route("app_icon")
def _(b):
    p = str(b.get("path", "")).strip().strip('"')
    if not p or not Path(p).exists():
        raise Err("File o app non trovati.")
    try:
        if sys.platform == "win32":
            r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", _PS], capture_output=True,
                               text=True, timeout=20, env=dict(os.environ, JA_PATH=p), creationflags=0x08000000)
            png = r.stdout.strip()
        elif sys.platform == "darwin":
            icn = plistlib.load(open(p + "/Contents/Info.plist", "rb")).get("CFBundleIconFile", "")
            src = Path(p) / "Contents/Resources" / (icn if icn.endswith(".icns") else icn + ".icns")
            tmp = tempfile.mktemp(suffix=".png")
            subprocess.run(["sips", "-s", "format", "png", "-Z", "128", str(src), "--out", tmp], check=True,
                           capture_output=True, timeout=15)
            png = b64e(Path(tmp).read_bytes())
            os.unlink(tmp)
        else:
            png = ""
    except Exception:
        png = ""
    return {"icon": "data:image/png;base64," + png if len(png) > 100 else ""}


# ---------------------------------------------------- posizione / sincronizzazione
def _vault_in(folder):
    for c in (folder, folder / "JesseArchive"):
        if (c / "jesse_archive.vault").exists():
            return c / "jesse_archive.vault"


def _use_vault(path):
    global VAULT
    VAULT = Path(path)
    V.sig = None
    _cfg_set("vault", str(VAULT))


@route("suggest")
def _(b):
    h, c = Path.home(), []
    for n in ("OneDrive", "Dropbox", "iCloudDrive", "Google Drive", "My Drive", "Nextcloud", "pCloudDrive", "Sync",
              "Library/Mobile Documents/com~apple~CloudDocs"):
        c.append(h / n)
    c += list(h.glob("OneDrive*")) + [Path(os.environ[k]) for k in ("OneDrive", "OneDriveConsumer") if k in os.environ]
    return {"dirs": [str(p) for p in dict.fromkeys(c) if p.is_dir()]}


@route("loc_move")
def _(b):
    f = Path(os.path.expanduser((b.get("folder") or "").strip().strip('"')))
    if not str(f).strip() or str(f) == ".":
        raise Err("Indica una cartella.")
    if not f.is_dir():
        raise Err("La cartella non esiste.")
    dest = f if f.name == "JesseArchive" else f / "JesseArchive"
    if (dest / "jesse_archive.vault").exists():
        raise Err("In quella cartella c'è già un vault. Per usarlo, blocca il programma e scegli «Collega un vault esistente».")
    V.save()
    dest.mkdir(exist_ok=True)
    for ext in (".vault", ".bak"):
        src = VAULT.with_suffix(ext)
        if src.exists():
            shutil.move(str(src), str(dest / ("jesse_archive" + ext)))
    _use_vault(dest / "jesse_archive.vault")
    V.sig = V._sig()
    return {"state": state()}


@route("loc_use")
def _(b):
    f = Path(os.path.expanduser((b.get("folder") or "").strip().strip('"')))
    v = _vault_in(f) if f.is_dir() else None
    if not v:
        raise Err("In questa cartella non trovo nessun vault (jesse_archive.vault). Aspetta che il cloud lo scarichi.")
    V.lock()
    _use_vault(v)
    return {"ok": 1}


# ------------------------------------------------------------------- server
LAST_PING = None


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'self' 'unsafe-inline'; img-src 'self' data:")
        self.end_headers()
        self.wfile.write(data)

    def _host_ok(self):
        return self.headers.get("Host", "").split(":")[0] in ("127.0.0.1", "localhost")

    def do_GET(self):
        if not self._host_ok():
            return self._send(403, {"error": "host non consentito"})
        if self.path.split("?")[0] == "/":
            html = UI.read_text("utf-8").replace("__TOKEN__", TOKEN)
            return self._send(200, html.encode(), "text/html")
        self._send(404, {"error": "non trovato"})

    def do_POST(self):
        if not self._host_ok() or not hmac.compare_digest(self.headers.get("X-Token", ""), TOKEN):
            return self._send(403, {"error": "non autorizzato"})
        name = self.path[5:] if self.path.startswith("/api/") else ""
        fn = ROUTES.get(name)
        if not fn:
            return self._send(404, {"error": "non trovato"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            LOCK.acquire()
            if V.unlocked:
                lim = V.d["settings"].get("autolock", 5) * 60
                if lim and now() - V.last > lim:
                    V.lock()
            if name not in OPEN and not V.unlocked:
                return self._send(401, {"error": "Vault bloccato", "locked": True})
            if name not in ("ping", "status"):
                V.last = now()
            self._send(200, fn(body))
        except Err as e:
            self._send(400, {"error": str(e)})
        except Exception as e:  # noqa
            self._send(500, {"error": "Errore interno: %s" % e})
        finally:
            try:
                LOCK.release()
            except RuntimeError:
                pass


def _single_instance():
    if sys.platform != "win32":
        return True
    import ctypes
    _single_instance.h = ctypes.windll.kernel32.CreateMutexW(None, False, "Local\\JesseArchiveSingleton")
    return ctypes.windll.kernel32.GetLastError() != 183  # ERROR_ALREADY_EXISTS


def _notify_running():
    """Chiede all'istanza già aperta (magari nel tray) di mostrare la finestra."""
    try:
        i = json.loads(INST.read_text())
        req = urllib.request.Request("http://127.0.0.1:%d/api/show" % i["port"], b"{}", {"X-Token": i["token"]})
        urllib.request.urlopen(req, timeout=3)
    except Exception:
        pass


def main():
    global SHOW, NATIVE
    if not _single_instance():
        return _notify_running()
    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    port = srv.server_address[1]
    url = "http://127.0.0.1:%d/" % port
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        INST.write_text(json.dumps({"port": port, "token": TOKEN}))
        atexit.register(lambda: INST.unlink(missing_ok=True))
    except OSError:
        pass
    if not FROZEN:
        print("Jesse's Archive in esecuzione su", url, "\nVault:", VAULT.resolve())
    if autostart_get():  # tiene aggiornato il percorso se hai spostato il programma
        try:
            autostart_set(True)
        except Err:
            pass
    bg = "--background" in sys.argv
    try:
        import webview  # finestra nativa (pip install pywebview)
    except ImportError:
        webview = None
    if webview:
        NATIVE = True
        webview.settings["ALLOW_DOWNLOADS"] = True
        tray_ok, quitting = _tray_ok(), [False]
        win = webview.create_window("Jesse's Archive", url, width=1280, height=820, min_size=(900, 600),
                                    hidden=bg and tray_ok)

        def show():
            try:
                win.show()
                win.restore()
                win.evaluate_js("boot()")
            except Exception:
                pass

        def to_tray():
            V.lock()  # nel tray il vault resta bloccato
            win.hide()

        def quit_():
            quitting[0] = True
            if _TRAY["icon"]:
                _TRAY["icon"].stop()
            win.destroy()

        def ensure_tray():
            if _TRAY["icon"] or not tray_ok:
                return
            import pystray
            from PIL import Image
            menu = pystray.Menu(pystray.MenuItem("Apri Jesse's Archive", lambda *a: show(), default=True),
                                pystray.MenuItem("Blocca il vault", lambda *a: V.lock()),
                                pystray.MenuItem("Esci", lambda *a: quit_()))
            _TRAY["icon"] = pystray.Icon("JesseArchive", Image.open(ICON), "Jesse's Archive", menu)
            _TRAY["icon"].run_detached()

        def on_closing():
            if not quitting[0] and tray_ok and _cfg_get("close_action") == "tray":
                ensure_tray()
                threading.Thread(target=to_tray, daemon=True).start()
                return False  # annulla la chiusura: la finestra va nel tray

        win.events.closing += on_closing
        SHOW = lambda: threading.Thread(target=show, daemon=True).start()
        if bg and tray_ok:
            ensure_tray()
        webview.start()
        V.lock()
        if _TRAY["icon"]:
            _TRAY["icon"].stop()
        return
    webbrowser.open(url)
    start = time.time()
    try:
        while True:  # si chiude da solo quando la scheda del browser viene chiusa
            time.sleep(2)
            if (LAST_PING and time.time() - LAST_PING > 40) or (not LAST_PING and time.time() - start > 180):
                break
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
