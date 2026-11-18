import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { build, stop } from 'esbuild';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';

// Integration test of the real dashboard: React + the widget registry rendered in
// jsdom with a synthetic vault and a simulated Tauri backend (no real vault).
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('./fixtures/dashboard-harness.tsx', import.meta.url))],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'Harness',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'silent',
});
// The IIFE's top-level var does not become a jsdom window property by itself.
const code = `${bundle.outputFiles[0].text}\nwindow.Harness = Harness;`;
// Every jsdom window is closed at the end, also when an assertion fails.
const windows = [];
after(() => {
  windows.forEach((w) => w.close());
  stop();
});
const SECRETS = ['pw-sintetica-login-1', 'pw-sintetica-login-2', 'contenuto segreto della nota'];
const day = 86400;
const now = Math.floor(Date.now() / 1000);

function vault(extra = {}) {
  const items = [
    { id: 'l1', type: 'login', title: 'Banca', fav: true, created: now - 9 * day, updated: now - 9 * day, f: { password: SECRETS[0], username: 'mario' } },
    { id: 'l2', type: 'login', title: 'Email', fav: true, created: now - 2 * day, updated: now - day, f: { password: SECRETS[1] } },
    { id: 'l3', type: 'login', title: 'Forum', created: now - 5 * day, f: {} },
    { id: 'n1', type: 'note', title: 'Nota privata', notes: SECRETS[2], created: now - 3 * day, updated: now - 3 * day, f: {} },
    { id: 'p1', type: 'personal', title: 'Documento identità', created: now - 4 * day, f: {} },
    { id: 'c1', type: 'card', title: 'Carta', created: now - 6 * day, f: {} },
    { id: 'x1', type: 'login', title: 'Cestinato', trashed: now, created: now, f: {} },
  ];
  return { items, passwords: [{ id: 'pw1' }, { id: 'pw2' }], folders: [{ id: 'f1', name: 'Lavoro' }], settings: {}, path: 'C:/vault/jesse_archive.vault', synced_at: now - 60, prefs: {}, ...extra };
}

async function setup({ stored, confirm = true } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  windows.push(w);
  // React's scheduler needs setImmediate or MessageChannel (both missing in jsdom);
  // setImmediate does not keep the process alive after the tests.
  w.setImmediate = setImmediate;
  w.clearImmediate = clearImmediate;
  // act() queues work through MessageChannel: a minimal one on top of setImmediate.
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
  let state = vault(stored ? { settings: { dashboard: stored } } : {});
  w.__TAURI_INTERNALS__ = {
    invoke: async (cmd, args) => {
      calls.push([cmd, args]);
      if (cmd === 'update_settings') return { auto: true, configured: true };
      if (cmd === 'passkey_settings') return { enabled: true };
      if (cmd !== 'api') throw new Error(`unexpected ${cmd}`);
      const { name, body } = args;
      if (name === 'health')
        return { weak: [{ item_id: 'l2' }], reused: [], old: [{ item_id: 'l1' }], total: 3, score: 33 };
      if (name === 'backup_info')
        return { path: state.path, folder: 'C:/vault', modified: now - 30, bak_exists: true, bak_modified: now - 90, synced_at: now - 60 };
      if (name === 'generate') return { results: [{ value: 'Gen-Pass-Sintetica-123', bits: 96 }] };
      if (name === 'settings') {
        state = { ...state, settings: { ...state.settings, dashboard: body.dashboard } };
        return { state };
      }
      throw new Error(`unexpected api ${name}`);
    },
    transformCallback: () => 0,
  };
  w.eval(code);
  const H = w.Harness;
  const opened = [];
  const pages = [];
  const props = () => ({
    vault: state,
    breaches: null,
    recentIds: ['c1'],
    openItem: (it, type) => opened.push(it?.id ?? `new:${type}`),
    selectPage: (p) => pages.push(p),
    focusSearch: () => pages.push('search'),
    copy: async () => {},
    lock: () => pages.push('lock'),
    askConfirm: async () => confirm,
    saveDashboard: async (cfg) => {
      state = { ...state, settings: { ...state.settings, dashboard: cfg } };
      calls.push(['save', cfg]);
    },
  });
  await H.mount(w.document.getElementById('root'), props());
  const flush = (ms = 0) => H.act(() => new Promise((r) => setTimeout(r, ms)));
  await flush();
  const $ = (sel) => w.document.querySelector(sel);
  const $$ = (sel) => [...w.document.querySelectorAll(sel)];
  const text = () => w.document.body.textContent;
  const button = (label, root = w.document) =>
    [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === label || b.getAttribute('aria-label') === label);
  // Item rows show the title plus a detail line.
  const row = (title, root) => [...root.querySelectorAll('.dash-row')].find((b) => b.querySelector('strong')?.textContent === title);
  const click = async (el) => {
    assert.ok(el, 'element to click not found');
    await H.act(async () => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })));
    await flush();
  };
  const widgets = () => $$('.dash-widget').map((s) => s.getAttribute('aria-label'));
  const widget = (title) => $$('.dash-widget').find((s) => s.getAttribute('aria-label') === title);
  return { w, H, calls, opened, pages, props, state: () => state, flush, $, $$, text, button, row, click, widgets, widget, close: () => dom.window.close() };
}

test('the default dashboard shows real data and never passwords or note text', async () => {
  const d = await setup();
  assert.deepEqual(d.widgets(), [
    'Punteggio di sicurezza',
    'Panoramica del vault',
    'Azioni rapide',
    'Preferiti',
    'Aggiunti di recente',
    'Analisi di sicurezza',
    'Stato del backup',
  ]);
  const score = d.widget('Punteggio di sicurezza');
  assert.match(score.textContent, /33/);
  assert.match(score.textContent, /Critico/);
  assert.match(score.textContent, /Password deboli: 1/);
  assert.match(score.textContent, /Password compromesse: non verificate/);
  const overview = d.widget('Panoramica del vault');
  assert.match(overview.textContent, /^.*6Elementi nel vault/, 'trashed item excluded');
  assert.match(overview.textContent, /3Account/);
  assert.match(overview.textContent, /Cartelle: 1 · Nel cestino: 1 · Password nello storico: 2/);
  const fav = d.widget('Preferiti').textContent;
  assert.ok(fav.indexOf('Banca') < fav.indexOf('Email'), 'favorites sorted by title');
  assert.ok(!fav.includes('Forum'));
  const recent = d.widget('Aggiunti di recente').textContent;
  assert.ok(recent.indexOf('Email') < recent.indexOf('Nota privata'), 'newest first');
  assert.match(d.widget('Analisi di sicurezza').textContent, /Problemi rilevati: 2/);
  assert.match(d.widget('Stato del backup').textContent, /Copia di sicurezza automatica presente/);
  for (const secret of SECRETS) assert.ok(!d.text().includes(secret), `secret visible: ${secret}`);
  // The view mode has no editing controls.
  assert.equal(d.$$('.dash-handle').length, 0);
  assert.ok(!d.button('Aggiungi widget'));
  await d.click(d.row('Banca', d.widget('Preferiti')));
  assert.deepEqual(d.opened, ['l1']);
  await d.click(d.button('Nuovo account', d.widget('Azioni rapide')) ?? d.$('.dash-action'));
  assert.equal(d.opened[1], 'new:login');
  await d.H.unmount();
  d.close();
});

test('customize: remove, add from the catalog, move, resize, configure; saved automatically', async () => {
  const d = await setup();
  await d.click(d.button('Personalizza dashboard'));
  assert.ok(d.$$('.dash-handle').length > 0, 'drag handles in customize mode');
  // Remove "Preferiti" from its menu.
  await d.click(d.widget('Preferiti').querySelector('[aria-haspopup="menu"]'));
  await d.click(d.button('Rimuovi dalla dashboard', d.widget('Preferiti')));
  assert.ok(!d.widgets().includes('Preferiti'));
  // Add the generator from the catalog; an unavailable widget cannot be added.
  await d.click(d.button('Aggiungi widget'));
  const catalog = d.$('.dash-catalog');
  const documents = [...catalog.querySelectorAll('.dash-catalog-item')].find((x) => x.textContent.includes('Documenti'));
  assert.ok(documents.classList.contains('unavailable'));
  assert.ok(!documents.querySelector('button'), 'no Add button for an unavailable widget');
  const generatorRow = [...catalog.querySelectorAll('.dash-catalog-item')].find((x) => x.textContent.includes('Generatore di password'));
  await d.click(d.button('Aggiungi', generatorRow));
  await d.click(d.button('Chiudi', catalog));
  assert.equal(d.widgets().at(-1), 'Generatore di password');
  // Move it first with the keyboard-accessible menu, then make it large.
  const gen = () => d.widget('Generatore di password');
  // The menu stays open, so the widget can be moved several steps in a row.
  await d.click(gen().querySelector('[aria-haspopup="menu"]'));
  for (let i = 0; i < 10 && !d.button('Sposta prima', gen())?.disabled; i++) {
    await d.click(d.button('Sposta prima', gen()));
  }
  assert.equal(d.widgets()[0], 'Generatore di password');
  await d.click(d.button('Grande', gen()));
  assert.ok(gen().classList.contains('size-l'));
  // Widget settings: passphrase mode (the menu is still open after resizing).
  const menu = gen().querySelector('[aria-haspopup="menu"]');
  if (menu.getAttribute('aria-expanded') !== 'true') await d.click(menu);
  await d.click(d.button('Impostazioni', gen()));
  const select = d.$('.dash-settings select');
  await d.H.act(async () => {
    select.value = 'passphrase';
    select.dispatchEvent(new d.w.Event('change', { bubbles: true }));
  });
  await d.click(d.button('Fine', d.$('.dash-settings')));
  // Debounced automatic save.
  await d.flush(700);
  const saved = d.calls.filter((c) => c[0] === 'save').at(-1)?.[1];
  assert.ok(saved, 'layout saved without a Save button');
  const layout = saved.layouts[saved.active].widgets;
  assert.equal(layout[0].type, 'generator');
  assert.equal(layout[0].size, 'l');
  assert.equal(layout[0].config.mode, 'passphrase');
  assert.ok(!layout.some((x) => x.type === 'favorites'));
  // Done leaves customize mode.
  await d.click(d.button('Fine'));
  assert.equal(d.$$('.dash-handle').length, 0);
  // The generator uses the backend generator and shows the value.
  await d.click(d.button('Genera', gen()));
  assert.match(gen().textContent, /Gen-Pass-Sintetica-123/);
  assert.ok(d.calls.some((c) => c[0] === 'api' && c[1].name === 'generate' && c[1].body.mode === 'passphrase'));
  await d.H.unmount();
  d.close();
});

test('drag and drop reorders widgets', async () => {
  const d = await setup();
  await d.click(d.button('Personalizza dashboard'));
  const before = d.widgets();
  const fire = async (el, type) => {
    const ev = new d.w.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: { setData() {}, effectAllowed: '' } });
    await d.H.act(async () => el.dispatchEvent(ev));
  };
  await fire(d.widget(before[3]).querySelector('.dash-handle'), 'dragstart');
  await fire(d.widget(before[0]), 'dragover');
  await fire(d.widget(before[0]), 'drop');
  await d.flush();
  assert.deepEqual(d.widgets(), [before[3], before[0], before[1], before[2], ...before.slice(4)]);
  await d.H.unmount();
  d.close();
});

test('layouts, reset with confirmation and persistence across restarts', async () => {
  const d = await setup();
  const select = d.$('.dash-layout-select select');
  await d.H.act(async () => {
    select.value = 'security';
    select.dispatchEvent(new d.w.Event('change', { bubbles: true }));
  });
  await d.flush();
  assert.deepEqual(d.widgets(), ['Punteggio di sicurezza', 'Analisi di sicurezza', 'Privacy', 'Stato del backup']);
  assert.match(d.widget('Privacy').textContent, /Telemetria.*Assente/);
  // Customize the security layout, then reset it (confirmed).
  await d.click(d.button('Personalizza dashboard'));
  await d.click(d.widget('Privacy').querySelector('[aria-haspopup="menu"]'));
  await d.click(d.button('Rimuovi dalla dashboard', d.widget('Privacy')));
  assert.ok(!d.widgets().includes('Privacy'));
  await d.flush(700);
  const saved = d.state().settings.dashboard;
  await d.H.unmount();
  d.close();

  // "Restart": a new dashboard reads the saved configuration.
  const again = await setup({ stored: saved });
  assert.deepEqual(again.widgets(), ['Punteggio di sicurezza', 'Analisi di sicurezza', 'Stato del backup']);
  await again.click(again.button('Personalizza dashboard'));
  await again.click(again.button('Ripristina layout'));
  assert.deepEqual(again.widgets(), ['Punteggio di sicurezza', 'Analisi di sicurezza', 'Privacy', 'Stato del backup']);
  await again.H.unmount();
  again.close();

  // Reset cancelled: nothing changes.
  const kept = await setup({ stored: saved, confirm: false });
  await kept.click(kept.button('Personalizza dashboard'));
  await kept.click(kept.button('Ripristina layout'));
  assert.ok(!kept.widgets().includes('Privacy'));
  await kept.H.unmount();
  kept.close();
});

test('widgets update when the vault changes, without reloading the app', async () => {
  const d = await setup();
  assert.match(d.widget('Panoramica del vault').textContent, /6Elementi nel vault/);
  const healthCalls = d.calls.filter((c) => c[1]?.name === 'health').length;
  const next = d.state();
  next.items = [...next.items, { id: 'l4', type: 'login', title: 'Nuovo', fav: true, created: now, f: {} }];
  await d.H.update({ ...d.props(), vault: { ...next, items: next.items } });
  await d.flush();
  assert.match(d.widget('Panoramica del vault').textContent, /7Elementi nel vault/);
  assert.match(d.widget('Preferiti').textContent, /Nuovo/);
  assert.equal(d.widget('Aggiunti di recente').querySelector('.dash-row strong').textContent, 'Nuovo', 'newest item listed first');
  assert.ok(d.calls.filter((c) => c[1]?.name === 'health').length > healthCalls, 'security data reloaded');
  await d.H.unmount();
  d.close();
});

test('a damaged stored configuration still opens a working dashboard', async () => {
  const d = await setup({ stored: { version: 99, active: 'nope', layouts: { default: { widgets: [{ type: '???' }] } } } });
  assert.equal(d.widgets().length, 0);
  assert.match(d.text(), /La dashboard è vuota/);
  await d.click(d.button('Aggiungi widget'));
  assert.ok(d.$('.dash-catalog'));
  await d.H.unmount();
  d.close();
});
