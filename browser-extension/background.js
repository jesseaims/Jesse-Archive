/* Native channel is never exposed to page scripts or content-script messages. */
const api = globalThis.browser || chrome;
let port;
let target = null;
let retry;
function connect() {
  if (port) return;
  port = api.runtime.connectNative('com.jessearchive.browser');
  port.onMessage.addListener(message => { void receive(message).catch(() => {}); });
  port.onDisconnect.addListener(() => {
    void api.runtime.lastError;
    port = null; target = null;
    // App closed or host missing: the browser handles pending passkey requests.
    for (const request of [...passkeys.keys()]) finishPasskey(request, {action:'fallback'});
    clearTimeout(retry); retry = setTimeout(connect, 10000);
  });
}
/* WebAuthn requests from passkey-bridge.js. The origin comes from the browser
 * (sender), only for HTTPS top-level frames; the page cannot choose it. */
const passkeys = new Map();
function finishPasskey(request, result) {
  const pending = passkeys.get(request);
  if (!pending) return;
  passkeys.delete(request);
  clearTimeout(pending.timer);
  // The browser's own dialog (fallback) and the page need the window focused again.
  api.tabs.get(pending.tabId).then(tab => api.windows.update(tab.windowId, {focused: true})).catch(() => {})
    .finally(() => pending.respond(result));
}
function onPasskeyMessage(message, sender, respond) {
  if (message?.kind !== 'passkey' || sender.id !== api.runtime.id) return false;
  const url = sender.url || '';
  if (!sender.tab?.id || sender.frameId !== 0 || !url.startsWith('https://')) { respond({action:'fallback'}); return false; }
  if (message.op === 'cancel') {
    for (const [request, pending] of passkeys) {
      if (pending.tabId === sender.tab.id && pending.pageRequest === message.pageRequest) {
        send({kind:'passkey-cancel', request});
        passkeys.delete(request); clearTimeout(pending.timer);
      }
    }
    return false;
  }
  if (message.op !== 'create' && message.op !== 'get') { respond({action:'fallback'}); return false; }
  connect();
  if (!port) { respond({action:'fallback'}); return false; }
  const request = crypto.randomUUID();
  const timeout = Math.min(Math.max(Number(message.timeout) || 300000, 30000), 600000);
  const timer = setTimeout(() => {
    send({kind:'passkey-cancel', request});
    finishPasskey(request, {action:'error', name:'NotAllowedError', message:'Tempo scaduto.'});
  }, timeout);
  passkeys.set(request, {respond, timer, tabId: sender.tab.id, pageRequest: message.pageRequest});
  send({kind:'passkey', request, op: message.op, origin: new URL(url).origin, options: message.options});
  return true;
}
api.runtime.onMessage.addListener(onPasskeyMessage);
function send(message) { port?.postMessage(message); }
async function receive(message) {
  if (message.kind === 'passkey-result') { finishPasskey(message.request, message.result); return; }
  if (message.kind === 'context') {
    const win = await api.windows.getLastFocused();
    if (!win.focused) return;
    const [tab] = await api.tabs.query({active: true, windowId: win.id});
    if (!tab?.id || !tab.url?.startsWith('https://')) return;
    const frames = await api.scripting.executeScript({target: {tabId: tab.id, allFrames: true}, func: captureContext});
    const frame = frames.find(f => f.result?.focused);
    // A login frame of another origin (connect.example.com inside example.com) is sent too:
    // the app accepts it only on the same registrable domain as the tab (PSL check).
    if (!frame || !frame.result.url.startsWith('https://')) return;
    target = {request: message.request, tabId: tab.id, frameId: frame.frameId, url: frame.result.url, top: tab.url, captured: Date.now()};
    send({kind: 'context', request: target.request, url: target.url, top: target.top});
  }
  if (message.kind === 'fill') {
    const saved = target; target = null;
    try {
      if (!saved || saved.request !== message.request || saved.url !== message.url || saved.top !== message.top || Date.now() - saved.captured > 120000) throw Error('Richiesta scaduta: richiama il pannello dal campo di accesso.');
      const tab = await api.tabs.get(saved.tabId);
      if (tab.url !== saved.top || !tab.active) throw Error('La pagina è cambiata. Richiama il pannello.');
      const results = await api.scripting.executeScript({target: {tabId: saved.tabId, frameIds: [saved.frameId]}, func: fillFields, args: [saved.url, message.username || '', message.password || '']});
      const result = results[0]?.result;
      if (!result?.ok) throw Error(result?.message || 'Nessun campo compilabile trovato.');
      await api.windows.update(tab.windowId, {focused: true});
      send({kind: 'filled', request: message.request, ok: true, message: result.message});
    } catch (error) { send({kind: 'filled', request: message.request, ok: false, message: error.message}); }
  }
}
function captureContext() {
  // Sites built with web components (Reddit) keep the input inside open shadow roots.
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  const editable = el instanceof HTMLInputElement && ['text','email','password','tel'].includes(el.type);
  // Save only a DOM reference in an isolated extension world, never any secret.
  globalThis.__jesseArchiveField = editable ? el : null;
  return {focused: document.hasFocus() && editable, url: location.href};
}
function fillFields(expectedUrl, username, password) {
  if (location.href !== expectedUrl || location.protocol !== 'https:') return {ok:false, message:'La pagina è cambiata.'};
  const focused = globalThis.__jesseArchiveField;
  delete globalThis.__jesseArchiveField;
  if (!(focused instanceof HTMLInputElement) || !focused.isConnected) return {ok:false, message:'Seleziona nuovamente il campo di accesso.'};
  const visible = el => !el.disabled && !el.readOnly && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  if (!visible(focused)) return {ok:false, message:'Il campo selezionato non è modificabile.'};
  // Inputs in document order, also inside open shadow roots; the form is searched across them.
  const deepInputs = root => {
    const out = [];
    const walk = node => { for (const el of node.querySelectorAll('*')) { if (el instanceof HTMLInputElement) out.push(el); if (el.shadowRoot) walk(el.shadowRoot); } };
    walk(root); return out;
  };
  let scope = focused.form;
  for (let n = focused; !scope && n; n = n.parentNode || n.host) if (n instanceof HTMLFormElement) scope = n;
  const inputs = deepInputs(scope || document).filter(visible);
  const passwords = inputs.filter(el => el.type === 'password' && el.autocomplete !== 'new-password');
  if (passwords.length > 1 || focused.autocomplete === 'new-password') return {ok:false, message:'Modulo ambiguo o registrazione: usa la copia manuale dall’app.'};
  const passwordField = focused.type === 'password' ? focused : passwords[0];
  const texts = inputs.filter(el => ['text','email','tel'].includes(el.type) && !/one-time-code/.test(el.autocomplete));
  const usernameField = focused.type !== 'password' ? focused : texts.find(el => el.autocomplete === 'username') || texts.filter(el => inputs.indexOf(el) < inputs.indexOf(passwordField)).at(-1);
  if (!passwordField && (!usernameField || !username)) return {ok:false, message:'Nessuna credenziale adatta al campo selezionato.'};
  if (passwordField && !password) return {ok:false, message:'Questo account non ha una password salvata.'};
  const setValue = (el, value) => {
    el.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true}));
  };
  if (usernameField && username) setValue(usernameField, username);
  // Resolve again after username input handlers: never write to a detached/replaced password field.
  if (passwordField) {
    if (!passwordField.isConnected || !visible(passwordField) || location.href !== expectedUrl) return {ok:false, message:'Il modulo è cambiato: richiama il pannello sul campo password.'};
    if (usernameField) { usernameField.dispatchEvent(new KeyboardEvent('keydown', {key:'Tab',bubbles:true})); usernameField.dispatchEvent(new KeyboardEvent('keyup', {key:'Tab',bubbles:true})); }
    setValue(passwordField, password);
  }
  return {ok:true, message:passwordField ? 'Credenziali inserite. Il login non è stato inviato.' : 'Username inserito. Continua sul sito e richiama il pannello per la password.'};
}
api.action.onClicked.addListener(() => {
  connect(); send({kind:'open'});
});
api.runtime.onStartup.addListener(connect);
api.runtime.onInstalled.addListener(connect);
connect();
