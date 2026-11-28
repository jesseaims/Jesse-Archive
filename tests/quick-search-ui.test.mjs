import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { build, stop } from 'esbuild';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';

// Integration test of the real Quick Search window in jsdom, with a simulated Tauri
// backend (commands and events) and synthetic metadata: no real vault.
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('./fixtures/quick-search-harness.tsx', import.meta.url))],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'Harness',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'silent',
});
const code = `${bundle.outputFiles[0].text}\nwindow.Harness = Harness;`;
const windows = [];
after(() => {
  windows.forEach((w) => w.close());
  stop();
});

const PASSWORD = 'pw-sintetica-rivelata';
const SETTINGS = {
  enabled: true,
  shortcut: 'Ctrl+Shift+Space',
  close_after: true,
  favorites: true,
  recent: true,
  categories: true,
};
// What `quick_search_data` returns: metadata only.
const METADATA = {
  folders: [{ id: 'f1', name: 'Lavoro' }],
  groups: { 'web:epicgames.com': { name: 'Epic Games', icon: '' } },
  items: [
    {
      id: 'e1',
      type: 'login',
      title: 'Epic Games',
      f: { url: 'https://epicgames.com', username: 'uno@posta.test' },
      has_password: true,
    },
    {
      id: 'e2',
      type: 'login',
      title: 'Epic Games',
      f: { url: 'https://epicgames.com', username: 'due@posta.test' },
      has_password: true,
      fav: true,
    },
    {
      id: 'b1',
      type: 'login',
      title: 'Banca',
      f: { url: 'https://banca.test', username: 'cliente42' },
      has_password: true,
    },
    { id: 'n1', type: 'note', title: 'Nota privata', f: {} },
  ],
};

async function setup({ locked = false, settings = {}, recent = [], holdData = false } = {}) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/?quick-search',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  windows.push(w);
  w.setImmediate = setImmediate;
  w.clearImmediate = clearImmediate;
  w.MessageChannel = class {
    constructor() {
      const port1 = { onmessage: null },
        port2 = { onmessage: null };
      port1.postMessage = (data) => setImmediate(() => port2.onmessage?.({ data }));
      port2.postMessage = (data) => setImmediate(() => port1.onmessage?.({ data }));
      this.port1 = port1;
      this.port2 = port2;
    }
  };
  w.IS_REACT_ACT_ENVIRONMENT = true;
  const calls = [];
  const state = { locked, recent };
  // Tauri events: listen() registers a callback through transformCallback.
  const callbacks = new Map();
  const listeners = [];
  let nextId = 1;
  w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  w.__TAURI_INTERNALS__ = {
    transformCallback: (cb) => {
      const id = nextId++;
      callbacks.set(id, cb);
      return id;
    },
    invoke: async (cmd, args) => {
      calls.push([cmd, args]);
      switch (cmd) {
        case 'plugin:event|listen':
          listeners.push({ event: args.event, handler: args.handler });
          return nextId++;
        case 'plugin:event|unlisten':
          return null;
        case 'quick_search_data':
          // A real backend answers a moment later, after the shown event: with
          // holdData the answer waits for state.release().
          if (holdData) await new Promise((r) => (state.release = r));
          return state.locked
            ? { unlocked: false, settings: { ...SETTINGS, ...settings } }
            : {
                unlocked: true,
                settings: { ...SETTINGS, ...settings },
                ...structuredClone(METADATA),
                recent: state.recent,
              };
        case 'quick_search_copy':
          return { ok: true, clear_after: 30 };
        case 'quick_search_reveal':
          return { value: PASSWORD };
        case 'quick_search_open':
        case 'quick_search_open_url':
        case 'quick_search_hide':
          return null;
        case 'api':
          if (args.name === 'unlock') {
            if (args.body.password !== 'master-sintetica') throw 'Password principale non corretta';
            state.locked = false;
            return { ok: 1 };
          }
          throw new Error(`unexpected api ${args.name}`);
        default:
          throw new Error(`unexpected ${cmd}`);
      }
    },
  };
  w.eval(code);
  const H = w.Harness;
  await H.mount(w.document.getElementById('root'));
  const flush = (ms = 0) => H.act(() => new Promise((r) => setTimeout(r, ms)));
  await flush();
  const emit = async (event, payload = null) => {
    await H.act(async () => {
      for (const l of listeners.filter((x) => x.event === event))
        callbacks.get(l.handler)?.({ event, payload, id: l.handler });
    });
    await flush();
  };
  const $ = (sel) => w.document.querySelector(sel);
  const $$ = (sel) => [...w.document.querySelectorAll(sel)];
  const text = () => w.document.body.textContent;
  const input = () => $('.qs-head input');
  const type = async (value) => {
    const el = input();
    await H.act(async () => {
      // React tracks the value: use the native setter, then an input event.
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, value);
      el.dispatchEvent(new w.Event('input', { bubbles: true }));
    });
    await flush(5);
  };
  const key = async (k, mods = {}, target) => {
    const el = target ?? input() ?? $('.qs-window');
    await H.act(async () =>
      el.dispatchEvent(
        new w.KeyboardEvent('keydown', {
          key: k,
          code: k.length === 1 ? 'Key' + k.toUpperCase() : k,
          bubbles: true,
          cancelable: true,
          ...mods,
        }),
      ),
    );
    await flush(5);
  };
  const rows = () =>
    $$('.qs-row').map((r) => ({
      text: r.querySelector('strong')?.textContent,
      sub: r.querySelector('small')?.textContent,
      active: r.classList.contains('active'),
      nested: r.classList.contains('nested'),
    }));
  const active = () => rows().find((r) => r.active);
  const button = (label) =>
    [...w.document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
  const click = async (el) => {
    assert.ok(el, 'element to click not found');
    await H.act(async () => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })));
    await flush(5);
  };
  // Arguments come from the jsdom realm: a JSON copy compares as plain objects.
  const last = (cmd) => {
    const args = calls.filter((c) => c[0] === cmd).at(-1)?.[1];
    return args === undefined ? undefined : JSON.parse(JSON.stringify(args));
  };
  const count = (cmd) => calls.filter((c) => c[0] === cmd).length;
  return {
    w,
    H,
    calls,
    state,
    flush,
    emit,
    $,
    $$,
    text,
    input,
    type,
    key,
    rows,
    active,
    button,
    click,
    last,
    count,
  };
}

test('opens with the search field ready: favorites and quick actions, no secrets', async () => {
  const d = await setup();
  await d.emit('quick-search-shown');
  assert.ok(d.input(), 'search field');
  assert.equal(d.input().disabled, false);
  assert.match(d.text(), /Sbloccato/, 'vault state shown');
  const sections = d.$$('.qs-section').map((s) => s.textContent);
  assert.deepEqual(sections, ['Preferiti', 'Azioni rapide']);
  assert.equal(d.rows()[0].text, 'Epic Games');
  assert.equal(d.rows()[0].sub, 'due@posta.test', 'the favorite account');
  assert.ok(d.rows().some((r) => r.text === 'Genera password'));
  assert.ok(!d.text().includes(PASSWORD));
});

test('the search field takes the focus once the data arrives', async () => {
  const d = await setup({ holdData: true });
  await d.H.act(async () => d.state.release());
  await d.flush();
  // Hidden (the page drops the data, the field is disabled), then shown again.
  await d.emit('quick-search-hidden');
  await d.emit('quick-search-shown');
  // Still loading: the field cannot take the focus yet.
  assert.notEqual(d.w.document.activeElement, d.input());
  await d.H.act(async () => d.state.release());
  await d.flush();
  assert.equal(d.input().disabled, false);
  assert.equal(d.w.document.activeElement, d.input(), 'typing goes to the field at once');
});

test('opening after an unlock never shows the state read while hidden', async () => {
  // The window is created hidden at startup and reads the vault locked.
  const d = await setup({ locked: true, holdData: true });
  await d.H.act(async () => d.state.release());
  await d.flush();
  // Unlocked from the main window, then the shortcut: the answer is not there yet.
  d.state.locked = false;
  await d.emit('quick-search-shown');
  assert.doesNotMatch(d.text(), /Vault bloccato|Bloccato/, 'no stale locked state');
  assert.ok(d.$('.qs-state'), 'loading state');
  await d.H.act(async () => d.state.release());
  await d.flush();
  assert.match(d.text(), /Sbloccato/);
  assert.equal(d.input().disabled, false);
});

test('a lock while hidden drops the state until the window opens again', async () => {
  const d = await setup({ holdData: true });
  await d.H.act(async () => d.state.release());
  await d.flush();
  const before = d.count('quick_search_data');
  d.state.locked = true;
  await d.emit('vault-locked');
  assert.equal(d.count('quick_search_data'), before, 'nothing read while hidden');
  await d.emit('quick-search-shown');
  assert.doesNotMatch(d.text(), /Sbloccato/);
  await d.H.act(async () => d.state.release());
  await d.flush();
  assert.match(d.text(), /Vault bloccato/);
});

test('recently used items saved in the vault are listed when the search is empty', async () => {
  const d = await setup({ recent: ['b1', 'eliminato'] });
  await d.emit('quick-search-shown');
  assert.match(d.text(), /Usati di recente/);
  assert.ok(
    d.rows().some((r) => r.text === 'Banca'),
    'the recent item',
  );
  const off = await setup({ recent: ['b1'], settings: { recent: false } });
  await off.emit('quick-search-shown');
  assert.doesNotMatch(off.text(), /Usati di recente/, 'hidden when turned off');
});

test('search by name, username, domain and typo; same-service accounts grouped', async () => {
  const d = await setup();
  await d.emit('quick-search-shown');
  await d.type('cliente');
  assert.deepEqual(
    d.rows().map((r) => r.text),
    ['Banca'],
  );
  assert.equal(d.$('.qs-row mark')?.textContent, 'cliente', 'match highlighted');
  await d.type('banca.test');
  assert.equal(d.rows()[0].text, 'Banca');
  await d.type('epci');
  // One matching service: the group opens by itself and shows both accounts.
  assert.deepEqual(
    d.rows().map((r) => [r.text, r.nested]),
    [
      ['Epic Games', false],
      ['Epic Games', true],
      ['Epic Games', true],
    ],
  );
  assert.equal(d.$('.qs-count').textContent, '2', 'number of accounts');
  await d.type('nessuna corrispondenza');
  assert.match(d.text(), /Nessun risultato per «nessuna corrispondenza»/);
});

test('keyboard: arrows, Enter copies the password, Ctrl+C, Ctrl+Shift+C, Alt/Ctrl+Enter, Esc', async () => {
  const d = await setup({ settings: { close_after: false } });
  await d.emit('quick-search-shown');
  await d.type('epic');
  assert.equal(d.active().nested, false, 'the group row is selected first');
  await d.key('ArrowDown');
  assert.equal(d.active().sub, 'due@posta.test');
  await d.key('ArrowDown');
  assert.equal(d.active().sub, 'uno@posta.test');
  await d.key('ArrowUp');
  assert.equal(d.active().sub, 'due@posta.test');
  await d.key('Enter');
  assert.deepEqual(d.last('quick_search_copy'), { id: 'e2', field: 'password' });
  assert.match(d.text(), /Password copiata: gli appunti si svuotano tra 30 s/);
  await d.key('c', { ctrlKey: true });
  assert.deepEqual(d.last('quick_search_copy'), { id: 'e2', field: 'username' });
  await d.key('C', { ctrlKey: true, shiftKey: true });
  assert.deepEqual(d.last('quick_search_copy'), { id: 'e2', field: 'password' });
  await d.key('Enter', { altKey: true });
  assert.deepEqual(d.last('quick_search_open_url'), { id: 'e2' });
  await d.key('Enter', { ctrlKey: true });
  assert.deepEqual(d.last('quick_search_open'), { target: { kind: 'item', id: 'e2' } });
  // Queries are never sent anywhere to be remembered (there is no search history).
  assert.ok(!d.calls.some(([cmd]) => cmd === 'quick_search_remember'));
  const hides = d.count('quick_search_hide');
  await d.key('Escape');
  assert.equal(d.count('quick_search_hide'), hides + 1, 'Esc closes');
});

test('selecting with the mouse keeps the keyboard in the window', async () => {
  const d = await setup();
  await d.emit('quick-search-shown');
  await d.type('banca');
  const row = d.$('.qs-row');
  const down = new d.w.MouseEvent('mousedown', { bubbles: true, cancelable: true });
  row.dispatchEvent(down);
  assert.ok(down.defaultPrevented, 'the search field does not lose the focus');
  // A click on a non-focusable part focuses the window itself, where the keys are read.
  assert.equal(d.$('.qs-window').tabIndex, -1);
  await d.key('C', { ctrlKey: true, shiftKey: true }, d.$('.qs-window'));
  assert.deepEqual(d.last('quick_search_copy'), { id: 'b1', field: 'password' });
});

test('close after an action, quick actions and favorites-only search', async () => {
  const d = await setup();
  await d.emit('quick-search-shown');
  await d.type('banca');
  await d.key('Enter');
  assert.deepEqual(d.last('quick_search_copy'), { id: 'b1', field: 'password' });
  assert.equal(d.count('quick_search_hide'), 1, 'closed after copying');
  await d.type('genera');
  assert.equal(d.active().text, 'Genera password');
  await d.key('Enter');
  assert.deepEqual(d.last('quick_search_open'), {
    target: { kind: 'action', action: 'generate' },
  });
  await d.type('preferiti');
  await d.key('Enter');
  assert.ok(d.$('.qs-scope'), 'favorites scope');
  await d.type('epic');
  assert.deepEqual(
    d.rows().map((r) => r.sub),
    ['due@posta.test'],
    'only favorite accounts',
  );
});

test('show password on request only; hidden again when the window hides', async () => {
  const d = await setup({ settings: { close_after: false } });
  await d.emit('quick-search-shown');
  await d.type('banca');
  assert.ok(!d.text().includes(PASSWORD));
  assert.equal(d.count('quick_search_reveal'), 0, 'no password fetched before a request');
  await d.click(d.button('Mostra password'));
  assert.ok(d.$('.qs-secret').textContent.includes(PASSWORD));
  await d.click(d.button('Nascondi password'));
  assert.ok(!d.text().includes(PASSWORD));
  await d.click(d.button('Mostra password'));
  await d.emit('quick-search-hidden');
  assert.ok(!d.text().includes(PASSWORD), 'revealed password dropped');
  assert.ok(!d.text().includes('cliente42'), 'results dropped');
});

test('vault locked while open: results and revealed password wiped, unlock form', async () => {
  const d = await setup({ settings: { close_after: false } });
  await d.emit('quick-search-shown');
  await d.type('banca');
  await d.click(d.button('Mostra password'));
  d.state.locked = true;
  await d.emit('vault-locked');
  assert.ok(!d.text().includes(PASSWORD));
  assert.ok(!d.text().includes('cliente42'), 'no username after the lock');
  assert.equal(d.rows().length, 0);
  assert.match(d.text(), /Vault bloccato/);
  assert.equal(d.input().disabled, true, 'no search while locked');
  // Unlock with the same vault command as the main window.
  const pw = d.$('.qs-locked input');
  await d.H.act(async () => {
    Object.getOwnPropertyDescriptor(d.w.HTMLInputElement.prototype, 'value').set.call(
      pw,
      'sbagliata',
    );
    pw.dispatchEvent(new d.w.Event('input', { bubbles: true }));
  });
  await d.H.act(async () =>
    d.$('.qs-locked').dispatchEvent(new d.w.Event('submit', { bubbles: true, cancelable: true })),
  );
  await d.flush(5);
  assert.match(d.text(), /Password principale non corretta/);
  await d.H.act(async () => {
    Object.getOwnPropertyDescriptor(d.w.HTMLInputElement.prototype, 'value').set.call(
      pw,
      'master-sintetica',
    );
    pw.dispatchEvent(new d.w.Event('input', { bubbles: true }));
  });
  await d.H.act(async () =>
    d.$('.qs-locked').dispatchEvent(new d.w.Event('submit', { bubbles: true, cancelable: true })),
  );
  await d.flush(5);
  assert.deepEqual(d.last('api'), { name: 'unlock', body: { password: 'master-sintetica' } });
  assert.equal(d.input().disabled, false);
  assert.ok(d.rows().length > 0, 'search available again');
});

test('starts locked: nothing from the vault is shown', async () => {
  const d = await setup({ locked: true });
  await d.emit('quick-search-shown');
  assert.match(d.text(), /Vault bloccato/);
  assert.ok(!d.text().includes('Epic'));
  assert.equal(d.count('quick_search_copy'), 0);
  // Keyboard actions do nothing while locked.
  await d.key('c', { ctrlKey: true }, d.$('.qs-window'));
  await d.key('Enter', {}, d.$('.qs-window'));
  assert.equal(d.count('quick_search_copy'), 0);
});
