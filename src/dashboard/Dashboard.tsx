import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  LayoutDashboard,
  MoreVertical,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api';
import { msg, t, translateMessage } from '../i18n';
import {
  activeLayout,
  addWidget,
  LAYOUT_IDS,
  byPosition,
  GRID_COLS,
  moveWidget,
  moveWidgetTo,
  normalizeDashboard,
  patchWidget,
  removeWidget,
  resetLayout,
  switchLayout,
  WIDTH,
  WIDGET_SPECS,
} from './model';
import type {
  DashboardConfig,
  HealthReport,
  LayoutId,
  WidgetCategory,
  WidgetInstance,
  WidgetType,
} from './model';
import { CATEGORY_LABELS, SIZE_LABELS, WIDGETS } from './widgets';
import type { BackupInfo, DashboardContext } from './widgets';

/*
 * Customizable dashboard. The layout is read from the vault settings and every
 * change is saved automatically (debounced) through `settings`; health and backup
 * data come from read-only backend commands that do not postpone the auto-lock.
 */

const LAYOUT_LABELS: Record<LayoutId, string> = {
  default: msg('Predefinito'),
  minimal: msg('Essenziale'),
  security: msg('Sicurezza'),
  productivity: msg('Produttività'),
  custom: msg('Personale'),
};
const CATEGORY_ORDER: WidgetCategory[] = [
  'security',
  'vault',
  'privacy',
  'identity',
  'productivity',
  'system',
];
const SAVE_DELAY = 600;

type Props = Omit<DashboardContext, 'health' | 'healthError' | 'backup' | 'backupError'> & {
  askConfirm: (
    message: string,
    opts?: { title?: string; danger?: boolean; confirmLabel?: string },
  ) => Promise<boolean>;
  saveDashboard: (config: DashboardConfig) => Promise<void>;
};

export default function Dashboard(props: Props) {
  const { vault, askConfirm, saveDashboard } = props;
  const stored = vault.settings.dashboard;
  const [config, setConfig] = useState<DashboardConfig>(() => normalizeDashboard(stored));
  const [editing, setEditing] = useState(false),
    [catalog, setCatalog] = useState(false),
    [settingsFor, setSettingsFor] = useState<WidgetType | null>(null),
    [menuFor, setMenuFor] = useState<WidgetType | null>(null),
    [dragFrom, setDragFrom] = useState<WidgetType | null>(null),
    [dropAt, setDropAt] = useState<{ x: number; y: number } | null>(null),
    [saveError, setSaveError] = useState('');
  const [health, setHealth] = useState<HealthReport | null>(null),
    [healthError, setHealthError] = useState(''),
    [backup, setBackup] = useState<BackupInfo | null>(null),
    [backupError, setBackupError] = useState('');
  const pending = useRef<number | undefined>(undefined);
  const dirty = useRef(false);

  // Adopt a layout changed elsewhere (another window or a synced copy) unless a
  // local change is waiting to be saved.
  useEffect(() => {
    if (!dirty.current) setConfig(normalizeDashboard(stored));
  }, [stored]);

  const change = (next: DashboardConfig) => {
    setConfig(next);
    dirty.current = true;
    window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      void saveDashboard(next)
        .then(() => setSaveError(''))
        .catch((e) => setSaveError(translateMessage(e)))
        .finally(() => {
          dirty.current = false;
        });
    }, SAVE_DELAY);
  };
  // Save a pending change when leaving the dashboard.
  useEffect(
    () => () => {
      if (dirty.current) {
        window.clearTimeout(pending.current);
        void saveDashboard(configRef.current).catch(() => {});
      }
    },
    [],
  );
  const configRef = useRef(config);
  configRef.current = config;

  const layout = activeLayout(config);
  const types = new Set(layout.widgets.map((w) => w.type));
  const needsHealth = types.has('security-score') || types.has('security-audit');
  const needsBackup = types.has('backup-status');

  // Read-only data, reloaded only when the vault data it depends on changes.
  const loadHealth = () =>
    void api<HealthReport>('health')
      .then((r) => {
        setHealth(r);
        setHealthError('');
      })
      .catch((e) => setHealthError(translateMessage(e)));
  const loadBackup = () =>
    void api<BackupInfo>('backup_info')
      .then((r) => {
        setBackup(r);
        setBackupError('');
      })
      .catch((e) => setBackupError(translateMessage(e)));
  useEffect(() => {
    if (needsHealth) loadHealth();
  }, [needsHealth, vault.passwords, vault.items, vault.settings.old_days]);
  useEffect(() => {
    if (needsBackup) loadBackup();
  }, [needsBackup, vault]);

  const ctx: DashboardContext = { ...props, health, healthError, backup, backupError };

  const narrow = useNarrow();
  const widgets = byPosition(layout.widgets);
  const rows = widgets.reduce((n, w) => Math.max(n, w.y + 1), 0);
  const moving = widgets.find((w) => w.type === dragFrom);

  // Where the dragged widget would land: on a widget, that widget's place (they swap);
  // on free space (wide grid only), the cell under the pointer.
  const targetFor = (e: DragEvent<HTMLElement>) => {
    if (!moving) return null;
    const width = WIDTH[moving.size];
    const clamp = (x: number) => Math.min(GRID_COLS - width, Math.max(0, x));
    const overType = (e.target as HTMLElement)
      .closest?.('[data-widget]')
      ?.getAttribute('data-widget');
    const over = widgets.find((w) => w.type === overType && w.type !== moving.type);
    if (over) return { x: clamp(over.x), y: over.y };
    if (narrow) return null;
    const r = e.currentTarget.getBoundingClientRect();
    const col = Math.floor(((e.clientX - r.left) / (r.width + GRID_GAP)) * GRID_COLS);
    const row = Math.floor((e.clientY - r.top) / (TILE_HEIGHT + GRID_GAP));
    if (!(r.width > 0) || !Number.isFinite(col) || !Number.isFinite(row)) return null;
    return { x: clamp(col - Math.floor((width - 1) / 2)), y: Math.min(rows, Math.max(0, row)) };
  };
  // The widgets the drop would move: highlighted while dragging.
  const hit = new Set(
    moving && dropAt
      ? widgets
          .filter(
            (w) =>
              w !== moving &&
              w.y === dropAt.y &&
              w.x < dropAt.x + WIDTH[moving.size] &&
              dropAt.x < w.x + WIDTH[w.size],
          )
          .map((w) => w.type)
      : [],
  );
  const endDrag = () => {
    setDragFrom(null);
    setDropAt(null);
  };
  const reset = async () => {
    setMenuFor(null);
    if (
      await askConfirm(
        t(
          'Ripristinare il layout «{name}» com’era all’inizio? I dati del vault non vengono toccati.',
          {
            name: t(LAYOUT_LABELS[config.active]),
          },
        ),
        { title: t('Ripristina layout'), confirmLabel: t('Ripristina') },
      )
    )
      change(resetLayout(config));
  };

  return (
    <div className={`dashboard ${editing ? 'editing' : ''}`}>
      <div className="heading-row">
        <div>
          <div className="eyebrow">{t('CONTROL CENTER')}</div>
          <h1>{t('Dashboard')}</h1>
          <p>{t('Il tuo centro di controllo: sicurezza, dati e azioni rapide.')}</p>
        </div>
        <div className="dash-toolbar">
          <label className="dash-layout-select">
            <span>{t('Layout')}</span>
            <select
              value={config.active}
              onChange={(e) => change(switchLayout(config, e.target.value as LayoutId))}
            >
              {LAYOUT_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(LAYOUT_LABELS[id])}
                </option>
              ))}
            </select>
          </label>
          {editing ? (
            <>
              <button type="button" className="secondary" onClick={() => setCatalog(true)}>
                <Plus size={16} />
                {t('Aggiungi widget')}
              </button>
              <button type="button" className="secondary" onClick={() => void reset()}>
                <RotateCcw size={16} />
                {t('Ripristina layout')}
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setEditing(false);
                  setMenuFor(null);
                }}
              >
                <Check size={16} />
                {t('Fine')}
              </button>
            </>
          ) : (
            <button type="button" className="secondary" onClick={() => setEditing(true)}>
              <SlidersHorizontal size={16} />
              {t('Personalizza dashboard')}
            </button>
          )}
        </div>
      </div>
      {saveError && (
        <p className="dash-error" role="alert">
          {t('Layout non salvato: {detail}', { detail: saveError })}
        </p>
      )}
      {editing && (
        <p className="dash-hint">
          {t(
            'Trascina i widget dalla maniglia per riordinarli; usa ⋮ per dimensioni, impostazioni e rimozione. Le modifiche si salvano da sole.',
          )}
        </p>
      )}
      {layout.widgets.length === 0 ? (
        <div className="dash-blank">
          <LayoutDashboard size={30} />
          <h2>{t('La dashboard è vuota')}</h2>
          <p>{t('Aggiungi i widget che vuoi vedere qui.')}</p>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setEditing(true);
              setCatalog(true);
            }}
          >
            <Plus size={16} />
            {t('Aggiungi widget')}
          </button>
        </div>
      ) : (
        <div
          className="dash-grid"
          style={{ '--rows': rows + (editing ? 1 : 0) } as CSSProperties}
          onDragOver={(e) => {
            if (!editing || !moving) return;
            const target = targetFor(e);
            if (!target) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (target.x !== dropAt?.x || target.y !== dropAt?.y) setDropAt(target);
          }}
          onDrop={(e) => {
            if (!editing || !moving) return;
            e.preventDefault();
            const target = targetFor(e) ?? dropAt;
            if (target) change(moveWidgetTo(config, moving.type, target.x, target.y));
            endDrag();
          }}
        >
          {widgets.map((w, index) => (
            <WidgetFrame
              key={w.type}
              widget={w}
              index={index}
              count={widgets.length}
              ctx={ctx}
              editing={editing}
              menuOpen={menuFor === w.type}
              dragging={dragFrom === w.type}
              dropTarget={hit.has(w.type)}
              onMenu={(open) => setMenuFor(open ? w.type : null)}
              onPatch={(patch) => change(patchWidget(config, w.type, patch))}
              onMove={(to) => change(moveWidget(config, index, to))}
              onRemove={() => {
                setMenuFor(null);
                change(removeWidget(config, w.type));
              }}
              onSettings={() => {
                setMenuFor(null);
                setSettingsFor(w.type);
              }}
              onRefresh={() => (WIDGETS[w.type].refresh === 'health' ? loadHealth() : loadBackup())}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', w.type);
                // Drag the whole card, not just the small handle icon.
                const card = (e.currentTarget as HTMLElement).closest('.dash-widget');
                if (card) e.dataTransfer.setDragImage(card, 24, 24);
                setMenuFor(null);
                setDragFrom(w.type);
              }}
              onDragEnd={endDrag}
            />
          ))}
          {moving && dropAt && !narrow && (
            <div className="dash-ghost" aria-hidden="true" style={cellStyle(dropAt, moving)} />
          )}
        </div>
      )}
      {catalog && (
        <Catalog
          active={types}
          onAdd={(type) => change(addWidget(config, type))}
          onRemove={(type) => change(removeWidget(config, type))}
          onClose={() => setCatalog(false)}
        />
      )}
      {settingsFor && (
        <SettingsDialog
          widget={layout.widgets.find((w) => w.type === settingsFor)}
          ctx={ctx}
          onChange={(c) => change(patchWidget(config, settingsFor, { config: c }))}
          onClose={() => setSettingsFor(null)}
        />
      )}
    </div>
  );
}

type FrameProps = {
  widget: WidgetInstance;
  index: number;
  count: number;
  ctx: DashboardContext;
  editing: boolean;
  menuOpen: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onMenu: (open: boolean) => void;
  onPatch: (patch: Partial<Omit<WidgetInstance, 'type' | 'x' | 'y'>>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onSettings: () => void;
  onRefresh: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
};

// Fixed grid: GRID_COLS columns, tiles of the same height, explicit positions (see
// model.ts). Keep TILE_HEIGHT and GRID_GAP in sync with .dash-grid in style.css.
const TILE_HEIGHT = 320;
const GRID_GAP = 16;
// Below this width the grid has 2 or 1 columns and shows widgets in reading order.
const NARROW_QUERY = '(max-width: 1180px)';

const cellStyle = (at: { x: number; y: number }, w: WidgetInstance) =>
  ({ '--x': at.x + 1, '--y': at.y + 1, '--w': WIDTH[w.size] }) as CSSProperties;

function useNarrow() {
  const query = typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null;
  const [narrow, setNarrow] = useState(query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const update = () => setNarrow(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}

function WidgetFrame(p: FrameProps) {
  const def = WIDGETS[p.widget.type];
  const spec = WIDGET_SPECS[p.widget.type];
  const Body = def.Component;
  const title = t(def.name);
  return (
    <section
      data-widget={p.widget.type}
      style={{ ...cellStyle(p.widget, p.widget), order: p.index }}
      className={`dash-widget size-${p.widget.size} ${p.widget.collapsed ? 'collapsed' : ''} ${p.dragging ? 'dragging' : ''} ${p.dropTarget ? 'drop-target' : ''}`}
      aria-label={title}
    >
      <header className="dash-widget-head">
        {p.editing && (
          <span
            className="dash-handle"
            draggable
            role="button"
            tabIndex={-1}
            aria-label={t('Trascina per spostare')}
            title={t('Trascina per spostare')}
            onDragStart={p.onDragStart}
            onDragEnd={p.onDragEnd}
          >
            <GripVertical size={16} />
          </span>
        )}
        <h2>
          <def.icon size={16} />
          {title}
        </h2>
        <div className="dash-widget-actions">
          {!p.editing && def.refresh && !p.widget.collapsed && (
            <button
              type="button"
              className="icon-button"
              title={t('Aggiorna')}
              aria-label={t('Aggiorna')}
              onClick={p.onRefresh}
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-expanded={!p.widget.collapsed}
            title={p.widget.collapsed ? t('Espandi') : t('Riduci a icona')}
            aria-label={p.widget.collapsed ? t('Espandi') : t('Riduci a icona')}
            onClick={() => p.onPatch({ collapsed: !p.widget.collapsed })}
          >
            {p.widget.collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          {p.editing && (
            <div className="dash-menu-wrap">
              <button
                type="button"
                className="icon-button"
                aria-haspopup="menu"
                aria-expanded={p.menuOpen}
                aria-label={t('Opzioni del widget {name}', { name: title })}
                onClick={() => p.onMenu(!p.menuOpen)}
              >
                <MoreVertical size={15} />
              </button>
              {p.menuOpen && (
                <div className="dash-menu" role="menu" onMouseLeave={() => p.onMenu(false)}>
                  {def.Settings && (
                    <button type="button" role="menuitem" onClick={p.onSettings}>
                      <Settings2 size={14} />
                      {t('Impostazioni')}
                    </button>
                  )}
                  {spec.sizes.length > 1 && (
                    <div className="dash-menu-sizes" role="group" aria-label={t('Dimensione')}>
                      {spec.sizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          role="menuitemradio"
                          aria-checked={p.widget.size === size}
                          className={p.widget.size === size ? 'active' : ''}
                          onClick={() => p.onPatch({ size })}
                        >
                          {t(SIZE_LABELS[size])}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={p.index === 0}
                    onClick={() => p.onMove(p.index - 1)}
                  >
                    <ArrowUp size={14} />
                    {t('Sposta prima')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={p.index === p.count - 1}
                    onClick={() => p.onMove(p.index + 1)}
                  >
                    <ArrowDown size={14} />
                    {t('Sposta dopo')}
                  </button>
                  {def.refresh && (
                    <button type="button" role="menuitem" onClick={p.onRefresh}>
                      <RefreshCw size={14} />
                      {t('Aggiorna')}
                    </button>
                  )}
                  <button type="button" role="menuitem" className="danger" onClick={p.onRemove}>
                    <Trash2 size={14} />
                    {t('Rimuovi dalla dashboard')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      {!p.widget.collapsed && Body && (
        <div className="dash-widget-body">
          <Body ctx={p.ctx} instance={p.widget} />
        </div>
      )}
    </section>
  );
}

function Catalog({
  active,
  onAdd,
  onRemove,
  onClose,
}: {
  active: Set<WidgetType>;
  onAdd: (type: WidgetType) => void;
  onRemove: (type: WidgetType) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal dash-catalog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-catalog-title"
      >
        <div className="modal-head">
          <h2 id="dash-catalog-title">{t('Aggiungi widget')}</h2>
          <button type="button" className="icon-button" aria-label={t('Chiudi')} onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="modal-content">
          <p className="dash-note">{t('Rimuovere un widget non cancella mai i dati del vault.')}</p>
          {CATEGORY_ORDER.map((category) => {
            const list = Object.values(WIDGETS).filter(
              (w) => WIDGET_SPECS[w.type].category === category,
            );
            if (!list.length) return null;
            return (
              <section key={category} className="dash-catalog-group">
                <h3>{t(CATEGORY_LABELS[category])}</h3>
                {list.map((w) => {
                  const spec = WIDGET_SPECS[w.type];
                  const on = active.has(w.type);
                  return (
                    <div
                      key={w.type}
                      className={`dash-catalog-item ${spec.available ? '' : 'unavailable'}`}
                    >
                      <span className="dash-catalog-icon">
                        <w.icon size={18} />
                      </span>
                      <span className="dash-catalog-copy">
                        <strong>{t(w.name)}</strong>
                        <small>
                          {spec.available ? t(w.description) : t(w.unavailableReason || '')}
                        </small>
                        {spec.available && (
                          <small className="dash-catalog-sizes">
                            {t('Dimensioni: {sizes}', {
                              sizes: spec.sizes.map((s) => t(SIZE_LABELS[s])).join(', '),
                            })}
                          </small>
                        )}
                      </span>
                      {spec.available ? (
                        on ? (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => onRemove(w.type)}
                          >
                            <Check size={15} />
                            {t('Rimuovi')}
                          </button>
                        ) : (
                          <button type="button" className="primary" onClick={() => onAdd(w.type)}>
                            <Plus size={15} />
                            {t('Aggiungi')}
                          </button>
                        )
                      ) : (
                        <span className="dash-badge">{t('In arrivo')}</span>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SettingsDialog({
  widget,
  ctx,
  onChange,
  onClose,
}: {
  widget?: WidgetInstance;
  ctx: DashboardContext;
  onChange: (config: WidgetInstance['config']) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  if (!widget) return null;
  const def = WIDGETS[widget.type];
  const Settings = def.Settings;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal dash-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-settings-title"
      >
        <div className="modal-head">
          <h2 id="dash-settings-title">{t('Impostazioni: {name}', { name: t(def.name) })}</h2>
          <button type="button" className="icon-button" aria-label={t('Chiudi')} onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="modal-content form-stack">
          {Settings ? <Settings instance={widget} ctx={ctx} onChange={onChange} /> : null}
          <p className="dash-note">{t('Le modifiche si salvano da sole.')}</p>
          <button type="button" className="primary" onClick={onClose}>
            <Check size={16} />
            {t('Fine')}
          </button>
        </div>
      </div>
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
}
