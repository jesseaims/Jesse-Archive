import { test } from 'node:test';
import assert from 'node:assert/strict';

const m = await import(new URL('../src/dashboard/model.ts', import.meta.url).href);
const plain = (v) => JSON.parse(JSON.stringify(v));
const types = (config) => m.activeLayout(config).widgets.map((w) => w.type);

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
          { type: 'quick-actions', collapsed: true, config: { actions: ['lock', 'format-disk', 'lock', 'generate'] } },
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
  const config = m.normalizeDashboard({ widgets: [{ type: 'generator', size: 'l' }, { type: 'privacy' }] });
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
  assert.deepEqual(types(c), ['favorites', 'generator', 'privacy']);
  c = m.moveWidget(c, 2, 0);
  assert.deepEqual(types(c), ['privacy', 'favorites', 'generator']);
  assert.deepEqual(types(m.moveWidget(c, 0, 9)), types(c), 'out-of-range moves are ignored');
  c = m.patchWidget(c, 'generator', { size: 'l', collapsed: true, config: { length: 2 } });
  const generator = m.activeLayout(c).widgets[2];
  assert.equal(generator.size, 'l');
  assert.equal(generator.collapsed, true);
  assert.equal(generator.config.length, 4, 'clamped to the generator minimum');
  assert.equal(m.activeLayout(m.patchWidget(c, 'privacy', { size: 's' })).widgets[0].size, 'm');
  c = m.removeWidget(c, 'favorites');
  assert.deepEqual(types(c), ['privacy', 'generator']);
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
  assert.deepEqual(types(c), m.presetLayout('security').widgets.map((w) => w.type));
  c = m.switchLayout(c, 'custom');
  assert.deepEqual(types(c), m.presetLayout('security').widgets.map((w) => w.type), 'custom starts from the current layout');
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
