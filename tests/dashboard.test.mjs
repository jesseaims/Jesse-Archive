import { test } from 'node:test';
import assert from 'node:assert/strict';

const m = await import(new URL('../src/dashboard/model.ts', import.meta.url).href);
const plain = (v) => JSON.parse(JSON.stringify(v));
const types = (config) => m.activeLayout(config).widgets.map((w) => w.type);
const widget = (config, type) => m.activeLayout(config).widgets.find((w) => w.type === type);
const grid = (config) =>
  Object.fromEntries(m.activeLayout(config).widgets.map((w) => [w.type, [w.x, w.y]]));

test('the main window lets the page handle drag and drop', async () => {
  // With Tauri's file drop handler on (the default), WebView2 on Windows blocks HTML5
  // drag and drop inside the page and widgets cannot be moved.
  const { readFile } = await import('node:fs/promises');
  const conf = JSON.parse(
    await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  );
  assert.equal(conf.app.windows[0].dragDropEnabled, false);
});

test('missing, damaged or foreign configurations fall back to a valid dashboard', () => {
  for (const raw of [undefined, null, 'x', 42, [], { layouts: 'x' }, { active: 'nope' }]) {
    const config = m.normalizeDashboard(raw);
    assert.equal(config.version, m.DASHBOARD_VERSION);
    assert.ok(m.LAYOUT_IDS.includes(config.active));
    assert.ok(types(config).length > 0);
  }
});

test('normalization drops unknown or unavailable widgets, duplicates and bad options', () => {
  const config = m.normalizeDashboard({
    version: 1,
    active: 'default',
    layouts: {
      default: {
        widgets: [
          { type: 'favorites', size: 'xl', config: { max: 999, sort: 'random', extra: 'drop me' } },
          { type: 'favorites', size: 'm' },
          { type: 'teleporter', size: 'm' },
          { type: 'documents', size: 'm' },
          {
            type: 'quick-actions',
            collapsed: true,
            config: { actions: ['lock', 'format-disk', 'lock', 'generate'] },
          },
          'garbage',
        ],
      },
      bogus: { widgets: [] },
    },
  });
  assert.deepEqual(types(config), ['favorites', 'quick-actions']);
  const [favorites, actions] = m.activeLayout(config).widgets;
  assert.equal(favorites.size, 'm', 'unsupported size replaced by the default');
  assert.deepEqual(plain(favorites.config), { max: 12, sort: 'title' });
  assert.equal(actions.collapsed, true);
  assert.deepEqual(plain(actions.config.actions), ['lock', 'generate']);
  assert.equal(config.layouts.bogus, undefined);
});

test('older single-layout shape is migrated without losing widgets', () => {
  const config = m.normalizeDashboard({
    widgets: [{ type: 'generator', size: 'l' }, { type: 'privacy' }],
  });
  assert.equal(config.active, 'default');
  assert.deepEqual(types(config), ['generator', 'privacy']);
  assert.equal(m.activeLayout(config).widgets[0].size, 'l');
});

test('layout operations: add once, move, resize, collapse, configure, remove', () => {
  let c = m.normalizeDashboard({ layouts: { default: { widgets: [] } } });
  c = m.addWidget(c, 'favorites');
  c = m.addWidget(c, 'favorites');
  c = m.addWidget(c, 'documents');
  c = m.addWidget(c, 'generator');
  c = m.addWidget(c, 'privacy');
  // New widgets take the first free space: favorites | generator, then privacy below.
  assert.deepEqual(grid(c), { favorites: [0, 0], generator: [2, 0], privacy: [0, 1] });
  // Menu move: privacy takes the place of favorites, which takes the one privacy left.
  c = m.moveWidget(c, 2, 0);
  assert.deepEqual(grid(c), { privacy: [0, 0], generator: [2, 0], favorites: [0, 1] });
  assert.deepEqual(grid(m.moveWidget(c, 0, 9)), grid(c), 'out-of-range moves are ignored');
  // Growing in place: generator becomes full width; only privacy, which it now
  // covers, moves to free space; favorites stays where it was.
  c = m.patchWidget(c, 'generator', { size: 'l', collapsed: true, config: { length: 2 } });
  assert.deepEqual(grid(c), { generator: [0, 0], favorites: [0, 1], privacy: [2, 1] });
  const generator = widget(c, 'generator');
  assert.equal(generator.size, 'l');
  assert.equal(generator.collapsed, true);
  assert.equal(generator.config.length, 4, 'clamped to the generator minimum');
  assert.equal(widget(m.patchWidget(c, 'privacy', { size: 's' }), 'privacy').size, 'm');
  // Removing leaves the others in place.
  c = m.removeWidget(c, 'favorites');
  assert.deepEqual(grid(c), { generator: [0, 0], privacy: [2, 1] });
});

test('fixed grid: a drop moves only the widgets it involves', () => {
  // Three large widgets on the left, four small ones on the right.
  const at = (type, size, x, y) => ({ ...m.newWidget(type, size), x, y });
  const start = [
    at('favorites', 'm', 0, 0),
    at('security-score', 's', 2, 0),
    at('quick-actions', 's', 3, 0),
    at('recent-added', 'm', 0, 1),
    at('backup-status', 'm', 2, 1),
    at('secure-notes', 'm', 0, 2),
  ];
  const pos = (list) => Object.fromEntries(list.map((w) => [w.type, [w.x, w.y]]));
  const unchanged = (list, except) =>
    Object.entries(pos(start))
      .filter(([t]) => !except.includes(t))
      .forEach(([t, p]) => assert.deepEqual(pos(list)[t], p, `${t} did not move`));

  // Large onto small: the large takes the place of the two small ones, and they take
  // the place it left. Nothing else moves.
  let r = m.placeWidget(start, 'favorites', 2, 0);
  assert.deepEqual(pos(r).favorites, [2, 0]);
  assert.deepEqual(pos(r)['security-score'], [0, 0]);
  assert.deepEqual(pos(r)['quick-actions'], [1, 0]);
  unchanged(r, ['favorites', 'security-score', 'quick-actions']);

  // Same size: a plain swap.
  r = m.placeWidget(start, 'recent-added', 2, 1);
  assert.deepEqual(pos(r)['recent-added'], [2, 1]);
  assert.deepEqual(pos(r)['backup-status'], [0, 1]);
  unchanged(r, ['recent-added', 'backup-status']);

  // Into free space next to a large widget: only the dragged widget moves.
  r = m.placeWidget(start, 'quick-actions', 2, 2);
  assert.deepEqual(pos(r)['quick-actions'], [2, 2]);
  unchanged(r, ['quick-actions']);

  // Small onto large: the large one cannot fit in the single cell left, so only it
  // goes to the first free space; the others stay.
  r = m.placeWidget(start, 'quick-actions', 0, 1);
  assert.deepEqual(pos(r)['quick-actions'], [0, 1]);
  assert.ok(
    !r.some((a, i) =>
      r.some(
        (b, j) =>
          i !== j && a.y === b.y && a.x < b.x + m.WIDTH[b.size] && b.x < a.x + m.WIDTH[a.size],
      ),
    ),
    'no overlaps',
  );
  unchanged(r, ['quick-actions', 'recent-added']);

  // Off-grid coordinates are clamped; invalid ones ignored.
  assert.deepEqual(pos(m.placeWidget(start, 'favorites', 9, 2)).favorites, [2, 2]);
  assert.equal(m.placeWidget(start, 'favorites', NaN, 0), start);
});

test('stored positions are kept; overlapping or missing ones get a free place', () => {
  const config = m.normalizeDashboard({
    layouts: {
      default: {
        widgets: [
          { type: 'privacy', size: 'm', x: 2, y: 0 },
          { type: 'generator', size: 'm', x: 3, y: 0 },
          { type: 'favorites', size: 'm' },
          { type: 'backup-status', size: 'm', x: 0, y: 7 },
        ],
      },
    },
  });
  // generator would leave the grid and favorites has no position: both go to free space.
  // The empty rows above backup-status collapse.
  assert.deepEqual(grid(config), {
    generator: [0, 0],
    privacy: [2, 0],
    favorites: [0, 1],
    'backup-status': [0, 2],
  });
});

test('each layout keeps its own customization; reset goes back to the preset', () => {
  let c = m.defaultDashboard();
  c = m.removeWidget(c, 'vault-overview');
  c = m.switchLayout(c, 'security');
  assert.deepEqual(types(c), types({ ...c, layouts: { security: m.presetLayout('security') } }));
  c = m.addWidget(c, 'generator');
  c = m.switchLayout(c, 'default');
  assert.ok(!types(c).includes('vault-overview'), 'default customization kept');
  c = m.switchLayout(c, 'security');
  assert.ok(types(c).includes('generator'), 'security customization kept');
  c = m.resetLayout(c);
  assert.deepEqual(
    types(c),
    m.presetLayout('security').widgets.map((w) => w.type),
  );
  c = m.switchLayout(c, 'custom');
  assert.deepEqual(
    types(c),
    m.presetLayout('security').widgets.map((w) => w.type),
    'custom starts from the current layout',
  );
  // A full round trip through JSON (what the vault stores) is stable.
  assert.deepEqual(plain(m.normalizeDashboard(plain(c))), plain(c));
});

test('the security score uses only verifiable data', () => {
  const health = {
    weak: [{ item_id: 'a' }],
    reused: [[{ item_id: 'b' }, { item_id: 'c' }]],
    old: [{ item_id: 'a' }],
    total: 10,
    score: 70,
  };
  assert.equal(m.securityScore(health, null), 70, 'backend score while breaches are unchecked');
  assert.equal(m.securityScore(health, [{ item_id: 'x', title: 'x', count: 0 }]), 70);
  assert.equal(m.securityScore(health, [{ item_id: 'd', title: 'd', count: 3 }]), 60);
  assert.equal(m.scoreLevel(95, 4), 'excellent');
  assert.equal(m.scoreLevel(75, 4), 'good');
  assert.equal(m.scoreLevel(50, 4), 'fair');
  assert.equal(m.scoreLevel(10, 4), 'critical');
  assert.equal(m.scoreLevel(100, 0), 'empty');
});

test('the stored configuration never contains vault secrets', () => {
  const c = m.patchWidget(m.addWidget(m.defaultDashboard(), 'secure-notes'), 'secure-notes', {
    config: { pinned: ['note-id-1'], content: 'top secret note text', password: 'hunter2' },
  });
  const json = JSON.stringify(c);
  assert.ok(json.includes('note-id-1'));
  assert.ok(!json.includes('top secret') && !json.includes('hunter2'));
});
