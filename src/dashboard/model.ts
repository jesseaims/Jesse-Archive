/*
 * Customizable Dashboard: configuration model (no React, no Tauri — unit tested in
 * tests/dashboard.test.mjs).
 *
 * The configuration lives in the encrypted vault settings (`settings.dashboard`,
 * saved through the existing `settings` command). It only contains widget types,
 * sizes, grid positions, collapsed state and options such as item ids to pin: never
 * secrets.
 * Anything read back is normalized: unknown widgets, sizes or options are dropped
 * or replaced by defaults, so older, newer or damaged configurations never break
 * the screen.
 */

export const DASHBOARD_VERSION = 1;

export type WidgetSize = 's' | 'm' | 'l';
export type WidgetType =
  | 'security-score'
  | 'vault-overview'
  | 'quick-actions'
  | 'favorites'
  | 'recent-added'
  | 'recent-used'
  | 'security-audit'
  | 'backup-status'
  | 'secure-notes'
  | 'generator'
  | 'privacy'
  | 'identities'
  | 'documents';
export type WidgetCategory =
  'security' | 'vault' | 'privacy' | 'identity' | 'productivity' | 'system';
export type WidgetConfig = Record<string, unknown>;
export type WidgetInstance = {
  type: WidgetType;
  size: WidgetSize;
  collapsed: boolean;
  config: WidgetConfig;
  /** Column (0-based, 0..GRID_COLS - width) and tile row of the top-left corner. */
  x: number;
  y: number;
};
export type LayoutId = 'default' | 'minimal' | 'security' | 'productivity' | 'custom';
export type Layout = { widgets: WidgetInstance[] };
export type DashboardConfig = {
  version: typeof DASHBOARD_VERSION;
  active: LayoutId;
  layouts: Partial<Record<LayoutId, Layout>>;
};

export const LAYOUT_IDS: LayoutId[] = ['default', 'minimal', 'security', 'productivity', 'custom'];

export const QUICK_ACTIONS = [
  'add-login',
  'add-note',
  'add-personal',
  'add-card',
  'add-passkey',
  'add-crypto',
  'generate',
  'search',
  'security',
  'passwords',
  'lock',
] as const;
export type QuickAction = (typeof QUICK_ACTIONS)[number];

/** Data-level description of each widget; names, icons and UI are in registry.tsx. */
export type WidgetSpec = {
  category: WidgetCategory;
  sizes: WidgetSize[];
  defaultSize: WidgetSize;
  /** False when the program does not have the underlying feature yet. */
  available: boolean;
  defaults: WidgetConfig;
  normalize?: (config: WidgetConfig) => WidgetConfig;
};

const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(max, Math.max(min, Math.round(v)))
    : fallback;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const ids = (v: unknown, max: number) =>
  Array.isArray(v)
    ? [
        ...new Set(
          v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64),
        ),
      ].slice(0, max)
    : [];
const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

export const WIDGET_SPECS: Record<WidgetType, WidgetSpec> = {
  'security-score': {
    category: 'security',
    sizes: ['s', 'm'],
    defaultSize: 's',
    available: true,
    defaults: { mode: 'detailed', weak: true, reused: true, old: true, breaches: true },
    normalize: (c) => ({
      mode: oneOf(c.mode, ['detailed', 'compact'] as const, 'detailed'),
      weak: flag(c.weak, true),
      reused: flag(c.reused, true),
      old: flag(c.old, true),
      breaches: flag(c.breaches, true),
    }),
  },
  'security-audit': {
    category: 'security',
    sizes: ['m', 'l'],
    defaultSize: 'm',
    available: true,
    defaults: {},
  },
  'vault-overview': {
    category: 'vault',
    sizes: ['m', 'l'],
    defaultSize: 'm',
    available: true,
    defaults: {},
  },
  favorites: {
    category: 'vault',
    sizes: ['m', 'l'],
    defaultSize: 'm',
    available: true,
    defaults: { max: 6, sort: 'title' },
    normalize: (c) => ({
      max: int(c.max, 3, 12, 6),
      sort: oneOf(c.sort, ['title', 'recent'] as const, 'title'),
    }),
  },
  'recent-added': {
    category: 'vault',
    sizes: ['m', 'l'],
    defaultSize: 'm',
    available: true,
    defaults: { max: 5 },
    normalize: (c) => ({ max: int(c.max, 3, 12, 5) }),
  },
  'recent-used': {
    category: 'vault',
    sizes: ['m', 'l'],
    defaultSize: 'm',
    available: true,
    defaults: { max: 5 },
    normalize: (c) => ({ max: int(c.max, 3, 12, 5) }),
  },
  'secure-notes': {
    category: 'vault',
    sizes: ['m', 'l'],
    defaultSize: 'm',
    available: true,
    defaults: { max: 5, pinned: [] },
    normalize: (c) => ({ max: int(c.max, 3, 12, 5), pinned: ids(c.pinned, 12) }),
  },
  'quick-actions': {
    category: 'productivity',
    sizes: ['s', 'm', 'l'],
    defaultSize: 's',
    available: true,
    defaults: { actions: ['add-login', 'generate', 'add-note', 'search', 'security'] },
    normalize: (c) => {
      const actions = Array.isArray(c.actions)
        ? [
            ...new Set(
              c.actions.filter((a): a is QuickAction => QUICK_ACTIONS.includes(a as QuickAction)),
            ),
          ]
        : ['add-login', 'generate', 'add-note', 'search', 'security'];
      return { actions };
    },
  },
  generator: {
    category: 'productivity',
    sizes: ['m', 'l'],
    defaultSize: 'm',
    available: true,
    defaults: { mode: 'password', length: 20, words: 4 },
    normalize: (c) => ({
      mode: oneOf(c.mode, ['password', 'passphrase', 'pin'] as const, 'password'),
      length: int(c.length, 4, 64, 20),
      words: int(c.words, 3, 10, 4),
    }),
  },
  'backup-status': {
    category: 'system',
    sizes: ['m', 'l'],
    defaultSize: 'm',
    available: true,
    defaults: {},
  },
  privacy: {
    category: 'privacy',
    sizes: ['m', 'l'],
    defaultSize: 'm',
    available: true,
    defaults: {},
  },
  identities: {
    category: 'identity',
    sizes: ['m', 'l'],
    defaultSize: 'm',
    available: true,
    defaults: { max: 5 },
    normalize: (c) => ({ max: int(c.max, 3, 12, 5) }),
  },
  // The vault has no document category yet: listed in the catalog as unavailable.
  documents: {
    category: 'identity',
    sizes: ['m'],
    defaultSize: 'm',
    available: false,
    defaults: {},
  },
};

export const isWidgetType = (v: unknown): v is WidgetType =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(WIDGET_SPECS, v);

/** A new, not yet placed widget: `placeAll` gives it a position. */
export function newWidget(type: WidgetType, size?: WidgetSize): WidgetInstance {
  const spec = WIDGET_SPECS[type];
  return {
    type,
    size: size && spec.sizes.includes(size) ? size : spec.defaultSize,
    collapsed: false,
    config: normalizeWidgetConfig(type, spec.defaults),
    x: -1,
    y: -1,
  };
}

export function normalizeWidgetConfig(type: WidgetType, config: unknown): WidgetConfig {
  const spec = WIDGET_SPECS[type];
  const raw =
    config && typeof config === 'object' && !Array.isArray(config) ? (config as WidgetConfig) : {};
  return spec.normalize ? spec.normalize({ ...spec.defaults, ...raw }) : { ...spec.defaults };
}

const preset = (...entries: [WidgetType, WidgetSize?][]): Layout => ({
  widgets: placeAll(entries.map(([type, size]) => newWidget(type, size))),
});

/** Starting point of each layout; "Ripristina" goes back to it. */
export function presetLayout(id: LayoutId): Layout {
  switch (id) {
    case 'minimal':
      return preset(['quick-actions', 'm'], ['favorites', 'm']);
    case 'security':
      return preset(
        ['security-score', 'm'],
        ['security-audit', 'm'],
        ['privacy', 'm'],
        ['backup-status', 'm'],
      );
    case 'productivity':
      return preset(
        ['quick-actions', 'm'],
        ['generator', 'm'],
        ['recent-used', 'm'],
        ['recent-added', 'm'],
        ['favorites', 'm'],
        ['secure-notes', 'm'],
      );
    default:
      return preset(
        ['security-score', 's'],
        ['vault-overview', 'm'],
        ['quick-actions', 's'],
        ['favorites', 'm'],
        ['recent-added', 'm'],
        ['security-audit', 'm'],
        ['backup-status', 'm'],
      );
  }
}

export function defaultDashboard(): DashboardConfig {
  return {
    version: DASHBOARD_VERSION,
    active: 'default',
    layouts: { default: presetLayout('default') },
  };
}

function normalizeLayout(raw: unknown): Layout {
  const list =
    raw && typeof raw === 'object' && Array.isArray((raw as Layout).widgets)
      ? (raw as Layout).widgets
      : [];
  const seen = new Set<WidgetType>();
  const widgets: WidgetInstance[] = [];
  for (const w of list.slice(0, 40)) {
    if (!w || typeof w !== 'object' || !isWidgetType(w.type) || seen.has(w.type)) continue;
    const spec = WIDGET_SPECS[w.type];
    if (!spec.available) continue;
    seen.add(w.type);
    const size = spec.sizes.includes(w.size) ? w.size : spec.defaultSize;
    const x = Number.isInteger(w.x) ? w.x : -1;
    const y = Number.isInteger(w.y) ? w.y : -1;
    const valid = x >= 0 && x + WIDTH[size] <= GRID_COLS && y >= 0 && y < 200;
    widgets.push({
      type: w.type,
      size,
      collapsed: w.collapsed === true,
      config: normalizeWidgetConfig(w.type, w.config),
      x: valid ? x : -1,
      y: valid ? y : -1,
    });
  }
  // Widgets without a position (older configurations), out of range or overlapping
  // go to the first free space; the others keep their place.
  return { widgets: placeAll(widgets) };
}

/**
 * Turns whatever is stored (missing, older schema, damaged, edited by hand) into a
 * valid configuration. Version 0 / missing version is the same shape as version 1.
 */
export function normalizeDashboard(raw: unknown): DashboardConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultDashboard();
  const source = raw as Partial<DashboardConfig> & { widgets?: unknown };
  const layouts: Partial<Record<LayoutId, Layout>> = {};
  const stored = source.layouts && typeof source.layouts === 'object' ? source.layouts : {};
  for (const id of LAYOUT_IDS) {
    if (Object.prototype.hasOwnProperty.call(stored, id)) layouts[id] = normalizeLayout(stored[id]);
  }
  // Early single-layout shape {widgets: [...]} becomes the default layout.
  if (!layouts.default && Array.isArray(source.widgets)) layouts.default = normalizeLayout(source);
  const active = oneOf(source.active, LAYOUT_IDS, 'default');
  if (!layouts[active]) layouts[active] = presetLayout(active);
  return { version: DASHBOARD_VERSION, active, layouts };
}

export const activeLayout = (config: DashboardConfig): Layout =>
  config.layouts[config.active] ?? presetLayout(config.active);

/** Returns a new configuration with the active layout transformed by `change`. */
export function updateLayout(
  config: DashboardConfig,
  change: (widgets: WidgetInstance[]) => WidgetInstance[],
): DashboardConfig {
  return {
    ...config,
    layouts: {
      ...config.layouts,
      [config.active]: { widgets: change([...activeLayout(config).widgets]) },
    },
  };
}

export function switchLayout(config: DashboardConfig, id: LayoutId): DashboardConfig {
  return {
    ...config,
    active: id,
    // Layouts keep their own customization; a new one starts from its preset
    // ("custom" starts from the current layout).
    layouts: {
      ...config.layouts,
      [id]:
        config.layouts[id] ??
        (id === 'custom' ? structuredClone(activeLayout(config)) : presetLayout(id)),
    },
  };
}

export const resetLayout = (config: DashboardConfig): DashboardConfig => ({
  ...config,
  layouts: {
    ...config.layouts,
    [config.active]: presetLayout(config.active === 'custom' ? 'default' : config.active),
  },
});

// --- Grid placement ------------------------------------------------------------------
//
// The grid has GRID_COLS columns and tile rows of the same height. Each widget keeps
// an explicit position, so a change only moves the widgets it directly involves:
// nothing is re-flowed. Narrow windows show the same widgets in reading order.

export const GRID_COLS = 4;
export const WIDTH: Record<WidgetSize, number> = { s: 1, m: 2, l: GRID_COLS };

type Cell = { x: number; y: number; w: number };
const cellOf = (w: WidgetInstance): Cell => ({ x: w.x, y: w.y, w: WIDTH[w.size] });
const overlaps = (a: Cell, b: Cell) => a.y === b.y && a.x < b.x + b.w && b.x < a.x + a.w;
const clampX = (x: number, w: number) => Math.min(GRID_COLS - w, Math.max(0, Math.round(x)));
const placed = (w: WidgetInstance) => w.x >= 0 && w.y >= 0;

/** Reading order: by row, then column. Also the order of narrow windows and the keyboard. */
export const byPosition = (widgets: WidgetInstance[]) =>
  [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);

/** First free cell for a width, scanning rows from `fromY`, left to right. */
function firstFree(widgets: WidgetInstance[], w: number, fromY = 0): { x: number; y: number } {
  for (let y = Math.max(0, fromY); ; y++)
    for (let x = 0; x + w <= GRID_COLS; x++)
      if (!widgets.some((o) => placed(o) && overlaps({ x, y, w }, cellOf(o)))) return { x, y };
}

/** Rows left completely empty collapse, so the rows below move up together. */
function dropEmptyRows(widgets: WidgetInstance[]): WidgetInstance[] {
  const rows = [...new Set(widgets.map((w) => w.y))].sort((a, b) => a - b);
  return byPosition(widgets.map((w) => ({ ...w, y: rows.indexOf(w.y) })));
}

/** Keeps valid, non-overlapping positions and places the rest in the first free space. */
function placeAll(widgets: WidgetInstance[]): WidgetInstance[] {
  const out: WidgetInstance[] = [];
  for (const w of widgets)
    out.push(
      placed(w) && !out.some((o) => placed(o) && overlaps(cellOf(w), cellOf(o)))
        ? w
        : { ...w, x: -1, y: -1 },
    );
  for (let i = 0; i < out.length; i++)
    if (!placed(out[i])) out[i] = { ...out[i], ...firstFree(out, WIDTH[out[i].size]) };
  return dropEmptyRows(out);
}

/** Puts the widgets in `moving` in the first free spaces, starting from row `fromY`. */
function rehome(rest: WidgetInstance[], moving: WidgetInstance[], fromY: number) {
  const out = [...rest];
  for (const w of byPosition(moving)) out.push({ ...w, ...firstFree(out, WIDTH[w.size], fromY) });
  return out;
}

/**
 * Swap: the covered widgets go, left to right, into the cells the moving widget left
 * (those not taken by its new place). Null when they do not all fit there.
 */
function packInto(vacated: Cell, target: Cell, hit: WidgetInstance[], stay: WidgetInstance[]) {
  const taken = [target, ...stay.map(cellOf)];
  const out: WidgetInstance[] = [];
  for (const o of [...hit].sort((a, b) => a.x - b.x)) {
    const w = WIDTH[o.size];
    let spot: Cell | null = null;
    for (let x = vacated.x; x + w <= vacated.x + vacated.w && !spot; x++) {
      const cell = { x, y: vacated.y, w };
      if (!taken.some((c) => overlaps(cell, c))) spot = cell;
    }
    if (!spot) return null;
    taken.push(spot);
    out.push({ ...o, x: spot.x, y: spot.y });
  }
  return out;
}

/**
 * Moves a widget to column `x`, row `y` (clamped to the grid). On free space it just
 * goes there. Over other widgets: those take the place the widget left (a swap); if
 * they do not fit there, only they move to the first free space from that row. No
 * other widget changes place.
 */
export function placeWidget(widgets: WidgetInstance[], type: WidgetType, x: number, y: number) {
  const moving = widgets.find((w) => w.type === type);
  if (!moving || !Number.isFinite(x) || !Number.isFinite(y)) return widgets;
  const width = WIDTH[moving.size];
  const target: Cell = { x: clampX(x, width), y: Math.max(0, Math.round(y)), w: width };
  if (target.x === moving.x && target.y === moving.y) return widgets;
  const others = widgets.filter((w) => w !== moving);
  const hit = others.filter((o) => overlaps(target, cellOf(o)));
  const stay = others.filter((o) => !hit.includes(o));
  const moved = { ...moving, x: target.x, y: target.y };
  const swapped = packInto(cellOf(moving), target, hit, stay);
  return dropEmptyRows(
    swapped
      ? [...stay, moved, ...swapped]
      : rehome([...stay, moved], hit, Math.min(moving.y, target.y)),
  );
}

export const moveWidgetTo = (config: DashboardConfig, type: WidgetType, x: number, y: number) =>
  updateLayout(config, (widgets) => placeWidget(widgets, type, x, y));

/** Keyboard/menu move: takes the place of the previous or next widget in reading order. */
export const moveWidget = (config: DashboardConfig, from: number, to: number) =>
  updateLayout(config, (widgets) => {
    const order = byPosition(widgets);
    if (from < 0 || from >= order.length || to < 0 || to >= order.length || from === to)
      return widgets;
    return placeWidget(widgets, order[from].type, order[to].x, order[to].y);
  });

/** A new widget goes in the first free space: nothing else moves. */
export const addWidget = (config: DashboardConfig, type: WidgetType) =>
  updateLayout(config, (widgets) =>
    widgets.some((w) => w.type === type) || !WIDGET_SPECS[type].available
      ? widgets
      : placeAll([...widgets, newWidget(type)]),
  );

/** Removing a widget only changes the layout: vault data is never touched. */
export const removeWidget = (config: DashboardConfig, type: WidgetType) =>
  updateLayout(config, (widgets) => dropEmptyRows(widgets.filter((w) => w.type !== type)));

/**
 * Options, collapsed state and size. A widget that grows stays where it is (moved left
 * if it would leave the grid); only the widgets it now covers move to free space.
 */
export const patchWidget = (
  config: DashboardConfig,
  type: WidgetType,
  patch: Partial<Omit<WidgetInstance, 'type' | 'x' | 'y'>>,
) =>
  updateLayout(config, (widgets) => {
    const current = widgets.find((w) => w.type === type);
    if (!current) return widgets;
    const next = { ...current, ...patch };
    const size = WIDGET_SPECS[type].sizes.includes(next.size) ? next.size : current.size;
    const updated: WidgetInstance = {
      ...next,
      type,
      size,
      x: clampX(current.x, WIDTH[size]),
      y: current.y,
      config: normalizeWidgetConfig(type, next.config),
    };
    const others = widgets.filter((w) => w !== current);
    const hit = others.filter((o) => overlaps(cellOf(updated), cellOf(o)));
    if (!hit.length) return widgets.map((w) => (w === current ? updated : w));
    return dropEmptyRows(
      rehome([...others.filter((o) => !hit.includes(o)), updated], hit, updated.y),
    );
  });

// --- Security score ------------------------------------------------------------------

export type HealthReport = {
  weak: { item_id: string }[];
  reused: { item_id: string }[][];
  old: { item_id: string }[];
  total: number;
  score: number;
};
export type BreachResult = { item_id: string; title: string; count: number };

/**
 * Score from verifiable data only: share of items with an active password that have
 * no weak, reused or old password (the backend `health` rules) and, when the user ran
 * the online check in this session, no breached password.
 */
export function securityScore(health: HealthReport, breaches: BreachResult[] | null) {
  const breached = (breaches ?? []).filter((b) => b.count > 0).map((b) => b.item_id);
  if (!breached.length) return health.score;
  if (health.total === 0) return 100;
  const bad = new Set([
    ...health.weak.map((x) => x.item_id),
    ...health.old.map((x) => x.item_id),
    ...health.reused.flat().map((x) => x.item_id),
    ...breached,
  ]);
  return Math.max(0, Math.round(100 * (1 - bad.size / health.total)));
}

export type ScoreLevel = 'excellent' | 'good' | 'fair' | 'critical' | 'empty';
export function scoreLevel(score: number, total: number): ScoreLevel {
  if (total === 0) return 'empty';
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 40) return 'fair';
  return 'critical';
}

// --- Scrolling while dragging --------------------------------------------------------

/** Distance from the scroll area's edge (px) where dragging starts to scroll. */
export const AUTO_SCROLL_EDGE = 80;
/** Fastest scroll per animation frame (px). */
export const AUTO_SCROLL_MAX = 22;

/**
 * Pixels to scroll this frame for a pointer at `y` while dragging over an area from
 * `top` to `bottom` (viewport coordinates). WebView2 blocks the mouse wheel during a
 * native drag, so this is the only way to reach widgets out of view: negative scrolls
 * up, positive down, faster closer to the edge or beyond it (over the app header).
 */
export function autoScrollStep(y: number, top: number, bottom: number): number {
  if (!Number.isFinite(y) || !(bottom > top)) return 0;
  const edge = Math.min(AUTO_SCROLL_EDGE, (bottom - top) / 4);
  const depth = y < top + edge ? y - (top + edge) : y > bottom - edge ? y - (bottom - edge) : 0;
  if (!depth) return 0;
  const speed = Math.min(AUTO_SCROLL_MAX, Math.ceil((Math.abs(depth) / edge) * AUTO_SCROLL_MAX));
  return Math.sign(depth) * speed;
}
