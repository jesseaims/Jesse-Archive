// Sends the browser extension to the stores after an app release, only when its
// code changed since the last submission (the version number alone does not count):
//   Chrome Web Store  API v2 with a service account (upload, then submit for review);
//                     skipped while the previous submission is still in review.
//   Firefox (AMO)     API v5 with JWT credentials (upload, validation, new version).
// The first version of each store is submitted by hand: the APIs only update items.
//
// Credentials come as JSON on stdin from Publish-Release.ps1 / Store-Keys.ps1, which
// keep them DPAPI-encrypted; they are never written to disk or printed:
//   {"chrome": {"serviceAccount": {...key JSON...}, "publisherId": "..."},
//    "firefox": {"issuer": "user:...", "secret": "..."}}
// Usage: node scripts/publish-store-extension.mjs --state <file> [--dry-run | --check | --mark chrome|firefox]
//   --dry-run  no network: says what would be sent
//   --check    read-only calls: verifies the credentials and shows each store's status
//   --mark     records the current code as already submitted (after a submission by
//              hand), so the next release does not send the same code again
// Exit code 1 only when a store call failed.
import {createHash, createHmac, createSign, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CWS = 'https://chromewebstore.googleapis.com';
const AMO = 'https://addons.mozilla.org/api/v5';
const CWS_SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
export const FIREFOX_ID = 'browser@jessearchive.local';

/** Chrome Web Store ID, read from the list the app accepts (browser_protocol.rs). */
export function chromeStoreId(source = readFileSync(join(root, 'src-tauri/src/browser_protocol.rs'), 'utf8')) {
  const id = source.match(/"([a-p]{32})",\s*\/\/\s*Chrome Web Store/)?.[1];
  if (!id) throw new Error('ID del Chrome Web Store non trovato in browser_protocol.rs');
  return id;
}

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });

/** Hash of the extension code for one browser, ignoring the version number and the
 *  "key" field: a release that only bumps the version is not a new submission. */
export function contentHash(dir) {
  const hash = createHash('sha256');
  for (const file of files(dir).sort()) {
    const rel = relative(dir, file).split(sep).join('/');
    let data = readFileSync(file);
    if (rel === 'manifest.json') {
      const manifest = JSON.parse(data.toString('utf8'));
      delete manifest.version;
      delete manifest.key;
      data = Buffer.from(JSON.stringify(manifest));
    }
    hash.update(rel).update('\0').update(data).update('\0');
  }
  return hash.digest('hex');
}

const b64url = (data) => Buffer.from(data).toString('base64url');

/** Signed JWT the service account exchanges for an access token (RS256). */
export function chromeAssertion(serviceAccount, now = Date.now()) {
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error('Chiave del service account non valida: mancano client_email o private_key');
  }
  const iat = Math.floor(now / 1000);
  const body = `${b64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}))}.${b64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: CWS_SCOPE,
      aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 3600,
    }),
  )}`;
  const signature = createSign('RSA-SHA256').update(body).sign(serviceAccount.private_key);
  return `${body}.${b64url(signature)}`;
}

/** AMO token (HS256): a new one for every request, valid one minute (limit: five). */
export function amoToken({issuer, secret}, now = Date.now()) {
  if (!issuer || !secret) throw new Error('Credenziali di addons.mozilla.org incomplete');
  const iat = Math.floor(now / 1000);
  const body = `${b64url(JSON.stringify({alg: 'HS256', typ: 'JWT'}))}.${b64url(
    JSON.stringify({iss: issuer, jti: randomUUID(), iat, exp: iat + 60}),
  )}`;
  return `${body}.${b64url(createHmac('sha256', secret).update(body).digest())}`;
}

/** Reads a JSON answer, turning HTTP errors into messages without credentials. */
async function json(response, what) {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {}
  if (!response.ok) {
    const detail = data?.error?.message || data?.detail || data?.error || text.slice(0, 300);
    const error = new Error(`${what}: HTTP ${response.status} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    error.status = response.status;
    throw error;
  }
  return data ?? {};
}

export async function chromeToken(serviceAccount, {fetch = globalThis.fetch, now} = {}) {
  const response = await fetch(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: chromeAssertion(serviceAccount, now),
    }),
  });
  const data = await json(response, 'Accesso al Chrome Web Store');
  if (!data.access_token) throw new Error('Accesso al Chrome Web Store: nessun token ricevuto');
  return data.access_token;
}

export async function chromeStatus({token, publisherId, itemId, fetch = globalThis.fetch}) {
  const response = await fetch(`${CWS}/v2/publishers/${publisherId}/items/${itemId}:fetchStatus`, {
    headers: {Authorization: `Bearer ${token}`},
  });
  return json(response, 'Stato sul Chrome Web Store');
}

/** Uploads and submits a new Chrome package; 'pending' while the previous one is in review. */
export async function publishChrome({credentials, itemId, zip, fetch = globalThis.fetch, sleep, now, log = () => {}}) {
  const wait = sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const {serviceAccount, publisherId} = credentials ?? {};
  if (!publisherId) throw new Error('Publisher ID del Chrome Web Store mancante');
  const token = await chromeToken(serviceAccount, {fetch, now});
  const auth = {Authorization: `Bearer ${token}`};
  const item = `publishers/${publisherId}/items/${itemId}`;
  const status = await chromeStatus({token, publisherId, itemId, fetch});
  if (status.submittedItemRevisionStatus?.state === 'PENDING_REVIEW') {
    log('Chrome: la versione precedente è ancora in revisione, riprovo alla prossima release.');
    return {result: 'pending'};
  }
  const upload = await json(
    await fetch(`${CWS}/upload/v2/${item}:upload`, {
      method: 'POST',
      headers: {...auth, 'Content-Type': 'application/zip'},
      body: readFileSync(zip),
    }),
    'Caricamento sul Chrome Web Store',
  );
  let state = upload.uploadState;
  for (let i = 0; state === 'IN_PROGRESS' && i < 36; i++) {
    await wait(5000);
    state = (await chromeStatus({token, publisherId, itemId, fetch})).lastAsyncUploadState;
  }
  if (state !== 'SUCCEEDED') {
    throw new Error(`Caricamento sul Chrome Web Store non riuscito (stato ${state ?? 'sconosciuto'})`);
  }
  const published = await json(
    await fetch(`${CWS}/v2/${item}:publish`, {
      method: 'POST',
      headers: {...auth, 'Content-Type': 'application/json'},
      body: '{}',
    }),
    'Invio alla revisione del Chrome Web Store',
  );
  for (const w of published.warningInfo?.warnings ?? []) log(`Chrome, avviso: ${w.description || w.reason}`);
  log(`Chrome: inviata alla revisione (stato ${published.state ?? 'sconosciuto'}).`);
  return {result: 'submitted', state: published.state};
}

/** Uploads a Firefox package, waits for validation and creates the new listed version. */
export async function publishFirefox({credentials, zip, fetch = globalThis.fetch, sleep, now, log = () => {}}) {
  const wait = sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const auth = () => ({Authorization: `JWT ${amoToken(credentials ?? {}, now?.() ?? Date.now())}`});
  const form = new FormData();
  form.append('upload', new Blob([readFileSync(zip)], {type: 'application/zip'}), zip.split(/[\\/]/).pop());
  form.append('channel', 'listed');
  let upload = await json(
    await fetch(`${AMO}/addons/upload/`, {method: 'POST', headers: auth(), body: form}),
    'Caricamento su addons.mozilla.org',
  );
  for (let i = 0; !upload.processed && i < 120; i++) {
    await wait(5000);
    upload = await json(await fetch(`${AMO}/addons/upload/${upload.uuid}/`, {headers: auth()}), 'Validazione su addons.mozilla.org');
  }
  if (!upload.processed) throw new Error('addons.mozilla.org: validazione non terminata in tempo, riprovo alla prossima release');
  if (!upload.valid) {
    const errors = (upload.validation?.messages ?? []).filter((m) => m.type === 'error').map((m) => m.message);
    throw new Error(`addons.mozilla.org ha rifiutato il pacchetto: ${errors.join('; ') || 'validazione non superata'}`);
  }
  try {
    const version = await json(
      await fetch(`${AMO}/addons/addon/${encodeURIComponent(FIREFOX_ID)}/versions/`, {
        method: 'POST',
        headers: {...auth(), 'Content-Type': 'application/json'},
        body: JSON.stringify({upload: upload.uuid}),
      }),
      'Nuova versione su addons.mozilla.org',
    );
    log(`Firefox: versione ${version.version ?? ''} inviata alla revisione.`);
    return {result: 'submitted'};
  } catch (error) {
    if (error.status === 404) {
      throw new Error('addons.mozilla.org: estensione non trovata. La prima versione va pubblicata a mano dal sito.');
    }
    throw error;
  }
}

function readState(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  const args = process.argv.slice(2);
  const statePath = args[args.indexOf('--state') + 1];
  const dryRun = args.includes('--dry-run');
  const check = args.includes('--check');
  if (!args.includes('--state') || !statePath) throw new Error('Uso: --state <file> [--dry-run | --check | --mark chrome|firefox]');
  if (args.includes('--mark')) {
    const name = args[args.indexOf('--mark') + 1];
    if (!['chrome', 'firefox'].includes(name)) throw new Error('--mark vuole chrome o firefox');
    const browser = name === 'chrome' ? 'chromium' : 'firefox';
    const state = readState(statePath);
    const version = JSON.parse(readFileSync(join(root, 'browser-extension', browser, 'manifest.json'), 'utf8')).version;
    state[name] = {hash: contentHash(join(root, 'browser-extension', browser)), version, submittedAt: new Date().toISOString(), manual: true};
    mkdirSync(dirname(statePath), {recursive: true});
    writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log(`${name === 'chrome' ? 'Chrome' : 'Firefox'}: versione ${version} segnata come già inviata.`);
    return;
  }
  // Windows PowerShell may prefix what it pipes with a BOM.
  const input = dryRun ? '' : readFileSync(0, 'utf8').replace(/^\uFEFF/, '').trim();
  const credentials = input ? JSON.parse(input) : {};
  const log = (m) => console.log(m);
  const itemId = chromeStoreId();
  if (check) {
    if (credentials.chrome) {
      const token = await chromeToken(credentials.chrome.serviceAccount);
      const s = await chromeStatus({token, publisherId: credentials.chrome.publisherId, itemId});
      const published = s.publishedItemRevisionStatus?.distributionChannels?.[0]?.crxVersion ?? 'nessuna';
      log(`Chrome: credenziali valide. Pubblicata: ${published}; in revisione: ${s.submittedItemRevisionStatus?.state ?? 'no'}.`);
    } else log('Chrome: credenziali non configurate.');
    if (credentials.firefox) {
      const r = await fetch(`${AMO}/addons/addon/${encodeURIComponent(FIREFOX_ID)}/`, {
        headers: {Authorization: `JWT ${amoToken(credentials.firefox)}`},
      });
      if (r.status === 404) log('Firefox: credenziali valide, ma l\'estensione non è ancora su addons.mozilla.org (prima versione a mano).');
      else {
        const a = await json(r, 'Stato su addons.mozilla.org');
        log(`Firefox: credenziali valide. Stato: ${a.status ?? 'sconosciuto'}; versione: ${a.current_version?.version ?? 'nessuna'}.`);
      }
    } else log('Firefox: credenziali non configurate.');
    return;
  }
  const state = readState(statePath);
  const version = JSON.parse(readFileSync(join(root, 'browser-extension/chromium/manifest.json'), 'utf8')).version;
  const pending = [];
  for (const browser of ['chromium', 'firefox']) {
    const name = browser === 'chromium' ? 'chrome' : 'firefox';
    const hash = contentHash(join(root, 'browser-extension', browser));
    if (state[name]?.hash === hash) {
      log(`${name === 'chrome' ? 'Chrome' : 'Firefox'}: estensione invariata dall'ultimo invio (${state[name].version}), nulla da inviare.`);
    } else if (!credentials[name] && !dryRun) {
      log(`${name === 'chrome' ? 'Chrome' : 'Firefox'}: credenziali non configurate, invio saltato (scripts\\Store-Keys.ps1).`);
    } else pending.push({name, browser, hash});
  }
  if (!pending.length) return;
  if (dryRun) {
    for (const p of pending) log(`Prova: invierei la versione ${version} su ${p.name === 'chrome' ? 'Chrome Web Store' : 'addons.mozilla.org'}.`);
    return;
  }
  execFileSync(process.execPath, [join(root, 'scripts/package-store-extension.mjs')], {stdio: 'ignore'});
  let failed = false;
  for (const p of pending) {
    const zip = join(root, 'store', 'out', `jesse-archive-${p.browser}-${version}.zip`);
    try {
      const outcome =
        p.name === 'chrome'
          ? await publishChrome({credentials: credentials.chrome, itemId, zip, log})
          : await publishFirefox({credentials: credentials.firefox, zip, log});
      if (outcome.result === 'submitted') {
        state[p.name] = {hash: p.hash, version, submittedAt: new Date().toISOString()};
        mkdirSync(dirname(statePath), {recursive: true});
        writeFileSync(statePath, JSON.stringify(state, null, 2));
      }
    } catch (error) {
      failed = true;
      console.error(`${p.name === 'chrome' ? 'Chrome' : 'Firefox'}: ${error.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

// Run only as a command, not when the tests import the functions.
if (process.argv[1] && resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(process.argv[1]).toLowerCase()) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
