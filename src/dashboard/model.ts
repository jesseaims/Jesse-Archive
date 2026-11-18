/*
 * Customizable Dashboard: configuration model (no React, no Tauri — unit tested in
 * tests/dashboard.test.mjs).
 *
 * The configuration lives in the encrypted vault settings (`settings.dashboard`,
 * saved through the existing `settings` command). It only contains widget types,
 * sizes, collapsed state and options such as item ids to pin: never secrets.
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

export function newWidget(type: WidgetType, size?: WidgetSize): WidgetInstance {
  const spec = WIDGET_SPECS[type];
  return {
    type,
    size: size && spec.sizes.includes(size) ? size : spec.defaultSize,
    collapsed: false,
    config: normalizeWidgetConfig(type, spec.defaults),
  };
}

export function normalizeWidgetConfig(type: WidgetType, config: unknown): WidgetConfig {
  const spec = WIDGET_SPECS[type];
  const raw =
    config && typeof config === 'object' && !Array.isArray(config) ? (config as WidgetConfig) : {};
  return spec.normalize ? spec.normalize({ ...spec.defaults, ...raw }) : { ...spec.defaults };
}

const preset = (...entries: [WidgetType, WidgetSize?][]): Layout => ({
  widgets: entries.map(([type, size]) => newWidget(type, size)),
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
    widgets.push({
      type: w.type,
      size: spec.sizes.includes(w.size) ? w.size : spec.defaultSize,
      collapsed: w.collapsed === true,
      config: normalizeWidgetConfig(w.type, w.config),
    });
  }
  return { widgets };
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

export const moveWidget = (config: DashboardConfig, from: number, to: number) =>
  updateLayout(config, (widgets) => {
    if (from < 0 || from >= widgets.length || to < 0 || to >= widgets.length || from === to)
      return widgets;
    const [moved] = widgets.splice(from, 1);
    widgets.splice(to, 0, moved);
    return widgets;
  });

export const addWidget = (config: DashboardConfig, type: WidgetType) =>
  updateLayout(config, (widgets) =>
    widgets.some((w) => w.type === type) || !WIDGET_SPECS[type].available
      ? widgets
      : [...widgets, newWidget(type)],
  );

/** Removing a widget only changes the layout: vault data is never touched. */
export const removeWidget = (config: DashboardConfig, type: WidgetType) =>
  updateLayout(config, (widgets) => widgets.filter((w) => w.type !== type));

export const patchWidget = (
  config: DashboardConfig,
  type: WidgetType,
  patch: Partial<WidgetInstance>,
) =>
  updateLayout(config, (widgets) =>
    widgets.map((w) => {
      if (w.type !== type) return w;
      const next = { ...w, ...patch };
      return {
        ...next,
        size: WIDGET_SPECS[type].sizes.includes(next.size) ? next.size : w.size,
        config: normalizeWidgetConfig(type, next.config),
      };
    }),
  );

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
