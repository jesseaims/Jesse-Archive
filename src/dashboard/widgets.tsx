import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Clock,
  Copy,
  EyeOff,
  FileKey,
  FileText,
  Fingerprint,
  HardDrive,
  History,
  KeyRound,
  LayoutGrid,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  Star,
  UserRound,
  Wallet,
  Zap,
} from 'lucide-react';
import { api } from '../api';
import { locale, msg, t } from '../i18n';
import { categories } from '../types';
import type { Category, Item, Page, State } from '../types';
import { QUICK_ACTIONS, scoreLevel, securityScore } from './model';
import type {
  BreachResult,
  HealthReport,
  QuickAction,
  WidgetCategory,
  WidgetConfig,
  WidgetInstance,
  WidgetType,
} from './model';

/*
 * Widget registry: everything the dashboard needs to show, add and configure a
 * widget. Adding a widget = one entry here plus its spec in model.ts; the dashboard
 * itself does not change. Widgets only read data the app already has (vault state,
 * backend `health`, `backup_info`, `generate`) and never show passwords or note text.
 */

export type BackupInfo = {
  path: string;
  folder: string | null;
  modified: number | null;
  bak_exists: boolean;
  bak_modified: number | null;
  synced_at: number;
};
export type DashboardContext = {
  vault: State;
  health: HealthReport | null;
  healthError: string;
  backup: BackupInfo | null;
  backupError: string;
  breaches: BreachResult[] | null;
  recentIds: string[];
  openItem: (it?: Item, type?: Category) => void;
  selectPage: (page: Page) => void;
  focusSearch: () => void;
  copy: (text: string) => Promise<void>;
  lock: () => void;
};
export type WidgetProps = { ctx: DashboardContext; instance: WidgetInstance };
export type SettingsProps = {
  instance: WidgetInstance;
  ctx: DashboardContext;
  onChange: (config: WidgetConfig) => void;
};
export type WidgetDefinition = {
  type: WidgetType;
  name: string;
  description: string;
  icon: typeof KeyRound;
  Component?: (props: WidgetProps) => ReactNode;
  Settings?: (props: SettingsProps) => ReactNode;
  /** Data the widget can reload from its menu. */
  refresh?: 'health' | 'backup';
  /** Why the widget cannot be used yet (unavailable widgets only). */
  unavailableReason?: string;
};

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  security: msg('Sicurezza'),
  vault: msg('Vault'),
  privacy: msg('Privacy'),
  identity: msg('Identità digitale'),
  productivity: msg('Produttività'),
  system: msg('Sistema'),
};
export const SIZE_LABELS = { s: msg('Piccolo'), m: msg('Medio'), l: msg('Grande') } as const;

const CATEGORY_ICONS: Record<Category, typeof KeyRound> = {
  login: KeyRound,
  card: Wallet,
  note: FileKey,
  personal: UserRound,
  passkey: ShieldCheck,
  crypto: Archive,
};

const active = (vault: State) => vault.items.filter((i) => !i.trashed);
const dateLabel = (seconds?: number | null) =>
  seconds
    ? new Date(seconds * 1000).toLocaleString(locale(), {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

function Empty({ children }: { children: ReactNode }) {
  return <p className="dash-empty">{children}</p>;
}

/** Item row: icon, title and a non-sensitive detail; opens the item editor. */
function ItemList({
  items,
  ctx,
  detail,
}: {
  items: Item[];
  ctx: DashboardContext;
  detail: (it: Item) => string;
}) {
  return (
    <ul className="dash-list">
      {items.map((it) => {
        const Icon = CATEGORY_ICONS[it.type];
        return (
          <li key={it.id}>
            <button type="button" className="dash-row" onClick={() => ctx.openItem(it)}>
              <span className={`dash-row-icon ${it.type}`}>
                <Icon size={15} />
              </span>
              <span className="dash-row-copy">
                <strong>{it.title}</strong>
                <small>{detail(it)}</small>
              </span>
              <ArrowRight size={14} className="dash-row-go" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MaxSetting({ instance, onChange, label }: SettingsProps & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={3}
        max={12}
        value={Number(instance.config.max)}
        onChange={(e) => onChange({ ...instance.config, max: Number(e.target.value) })}
      />
    </label>
  );
}

// --- Security --------------------------------------------------------------------------

const LEVEL_LABELS = {
  excellent: msg('Ottimo'),
  good: msg('Buono'),
  fair: msg('Da migliorare'),
  critical: msg('Critico'),
  empty: msg('Nessuna password da valutare'),
} as const;

function SecurityScore({ ctx, instance }: WidgetProps) {
  const { health, breaches } = ctx;
  if (ctx.healthError) return <p className="dash-error">{ctx.healthError}</p>;
  if (!health) return <div className="dash-loading" aria-busy="true" />;
  const score = securityScore(health, breaches);
  const level = scoreLevel(score, health.total);
  const c = instance.config;
  const breached = breaches?.filter((b) => b.count > 0).length ?? 0;
  const issues = [
    c.weak && { label: t('Password deboli'), n: health.weak.length },
    c.reused && { label: t('Password riutilizzate'), n: health.reused.flat().length },
    c.old && { label: t('Password datate'), n: health.old.length },
    c.breaches && { label: t('Password compromesse'), n: breaches ? breached : null },
  ].filter(Boolean) as { label: string; n: number | null }[];
  return (
    <button type="button" className="dash-score" onClick={() => ctx.selectPage('security')}>
      <span
        className={`dash-gauge ${level}`}
        style={{ '--score': `${health.total ? score : 100}` } as CSSProperties}
        aria-label={t('Punteggio di sicurezza: {n} su 100', { n: score })}
      >
        <strong>{health.total ? score : '—'}</strong>
      </span>
      <span className="dash-score-copy">
        <strong className={`dash-level ${level}`}>{t(LEVEL_LABELS[level])}</strong>
        {c.mode === 'detailed' && (
          <span className="dash-issues">
            {issues.map((i) => (
              <span key={i.label}>
                {i.label}:{' '}
                <b className={i.n ? 'bad' : i.n === 0 ? 'good' : ''}>
                  {i.n ?? t('non verificate')}
                </b>
              </span>
            ))}
          </span>
        )}
        <small className="dash-link">
          {t('Report completo')} <ArrowRight size={12} />
        </small>
      </span>
    </button>
  );
}

function SecurityScoreSettings({ instance, onChange }: SettingsProps) {
  const c = instance.config;
  const toggle = (key: string, label: string) => (
    <label className="check-line" key={key}>
      <input
        type="checkbox"
        checked={!!c[key]}
        onChange={(e) => onChange({ ...c, [key]: e.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <>
      <label className="field">
        <span>{t('Visualizzazione')}</span>
        <select value={String(c.mode)} onChange={(e) => onChange({ ...c, mode: e.target.value })}>
          <option value="detailed">{t('Dettagliata')}</option>
          <option value="compact">{t('Compatta')}</option>
        </select>
      </label>
      {c.mode === 'detailed' && (
        <>
          {toggle('weak', t('Password deboli'))}
          {toggle('reused', t('Password riutilizzate'))}
          {toggle('old', t('Password datate'))}
          {toggle('breaches', t('Password compromesse'))}
        </>
      )}
    </>
  );
}

function SecurityAudit({ ctx }: WidgetProps) {
  const { health, breaches } = ctx;
  if (ctx.healthError) return <p className="dash-error">{ctx.healthError}</p>;
  if (!health) return <div className="dash-loading" aria-busy="true" />;
  const breached = breaches?.filter((b) => b.count > 0).length;
  const rows = [
    {
      label: t('Password compromesse'),
      n: breaches ? (breached ?? 0) : null,
      severity: 'critical',
      sev: t('Critica'),
    },
    {
      label: t('Password riutilizzate'),
      n: health.reused.flat().length,
      severity: 'high',
      sev: t('Alta'),
    },
    { label: t('Password deboli'), n: health.weak.length, severity: 'high', sev: t('Alta') },
    { label: t('Password datate'), n: health.old.length, severity: 'medium', sev: t('Media') },
  ];
  const total = rows.reduce((sum, r) => sum + (r.n ?? 0), 0);
  return (
    <div className="dash-audit">
      <p className="dash-audit-summary">
        {total ? t('Problemi rilevati: {n}', { n: total }) : t('Nessun problema rilevato')}
        <small>{t('Password attive analizzate: {n}', { n: health.total })}</small>
      </p>
      <ul>
        {rows.map((r) => (
          <li key={r.label}>
            <button
              type="button"
              className="dash-audit-row"
              onClick={() => ctx.selectPage('security')}
            >
              <span className={`dash-severity ${r.n ? r.severity : 'ok'}`}>
                {r.n ? r.sev : t('OK')}
              </span>
              <span>{r.label}</span>
              <strong>{r.n ?? '—'}</strong>
            </button>
          </li>
        ))}
      </ul>
      {!breaches && (
        <small className="dash-note">
          {t(
            'Le password compromesse si verificano su richiesta nel Centro sicurezza (servizio online).',
          )}
        </small>
      )}
    </div>
  );
}

// --- Vault -------------------------------------------------------------------------------

function VaultOverview({ ctx }: WidgetProps) {
  const items = active(ctx.vault);
  const cells: [Category, string][] = [
    ['login', t('Account')],
    ['passkey', t('Passkey')],
    ['note', t('Note protette')],
    ['card', t('Carte')],
    ['personal', t('Identità')],
    ['crypto', t('Asset crypto')],
  ];
  return (
    <div className="dash-overview">
      <div className="dash-total">
        <strong>{items.length}</strong>
        <span>{t('Elementi nel vault')}</span>
      </div>
      <div className="dash-cells">
        {cells.map(([type, label]) => {
          const Icon = CATEGORY_ICONS[type];
          return (
            <button
              key={type}
              type="button"
              className="dash-cell"
              onClick={() => ctx.selectPage(type)}
            >
              <Icon size={15} />
              <strong>{items.filter((i) => i.type === type).length}</strong>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <small className="dash-note">
        {t('Cartelle: {folders} · Nel cestino: {trash} · Password nello storico: {history}', {
          folders: ctx.vault.folders.length,
          trash: ctx.vault.items.length - items.length,
          history: ctx.vault.passwords.length,
        })}
      </small>
    </div>
  );
}

function Favorites({ ctx, instance }: WidgetProps) {
  const c = instance.config;
  const list = active(ctx.vault)
    .filter((i) => i.fav)
    .sort((a, b) =>
      c.sort === 'recent'
        ? (b.updated || 0) - (a.updated || 0)
        : a.title.localeCompare(b.title, locale()),
    )
    .slice(0, Number(c.max));
  if (!list.length)
    return (
      <Empty>{t('Nessun preferito. Usa la stella su un elemento per aggiungerlo qui.')}</Empty>
    );
  return <ItemList items={list} ctx={ctx} detail={(it) => t(categories[it.type].label)} />;
}

function FavoritesSettings(props: SettingsProps) {
  const c = props.instance.config;
  return (
    <>
      <MaxSetting {...props} label={t('Numero massimo di elementi')} />
      <label className="field">
        <span>{t('Ordinamento')}</span>
        <select
          value={String(c.sort)}
          onChange={(e) => props.onChange({ ...c, sort: e.target.value })}
        >
          <option value="title">{t('Alfabetico')}</option>
          <option value="recent">{t('Modificati di recente')}</option>
        </select>
      </label>
    </>
  );
}

function RecentAdded({ ctx, instance }: WidgetProps) {
  const list = active(ctx.vault)
    .filter((i) => i.created)
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .slice(0, Number(instance.config.max));
  if (!list.length)
    return <Empty>{t('Il vault è vuoto: gli elementi aggiunti compariranno qui.')}</Empty>;
  return (
    <ItemList
      items={list}
      ctx={ctx}
      detail={(it) => `${t(categories[it.type].label)} · ${dateLabel(it.created)}`}
    />
  );
}

function RecentUsed({ ctx, instance }: WidgetProps) {
  const byId = new Map(active(ctx.vault).map((i) => [i.id, i]));
  const list = ctx.recentIds
    .map((id) => byId.get(id))
    .filter((i): i is Item => !!i)
    .slice(0, Number(instance.config.max));
  return (
    <>
      {list.length ? (
        <ItemList items={list} ctx={ctx} detail={(it) => t(categories[it.type].label)} />
      ) : (
        <Empty>{t('Gli elementi che apri compariranno qui.')}</Empty>
      )}
      <small className="dash-note">
        {t('Solo per questa sessione: nulla viene salvato e la lista si svuota al blocco.')}
      </small>
    </>
  );
}

function SecureNotes({ ctx, instance }: WidgetProps) {
  const notes = active(ctx.vault).filter((i) => i.type === 'note');
  const pinned = (instance.config.pinned as string[]) || [];
  const list = [
    ...pinned.map((id) => notes.find((n) => n.id === id)).filter((n): n is Item => !!n),
    ...notes
      .filter((n) => !pinned.includes(n.id))
      .sort((a, b) => (b.updated || 0) - (a.updated || 0)),
  ].slice(0, Number(instance.config.max));
  return (
    <>
      {list.length ? (
        <ItemList
          items={list}
          ctx={ctx}
          detail={(it) =>
            pinned.includes(it.id)
              ? t('Fissata')
              : t('Modificata: {date}', { date: dateLabel(it.updated) })
          }
        />
      ) : (
        <Empty>{t('Nessuna nota protetta.')}</Empty>
      )}
      <button
        type="button"
        className="secondary dash-inline"
        onClick={() => ctx.openItem(undefined, 'note')}
      >
        <Plus size={15} />
        {t('Nuova nota protetta')}
      </button>
    </>
  );
}

function SecureNotesSettings(props: SettingsProps) {
  const notes = active(props.ctx.vault).filter((i) => i.type === 'note');
  const pinned = (props.instance.config.pinned as string[]) || [];
  return (
    <>
      <MaxSetting {...props} label={t('Numero massimo di note')} />
      <div className="field">
        <span>{t('Note fissate in cima (solo il titolo è mostrato)')}</span>
        {notes.length ? (
          notes.map((n) => (
            <label className="check-line" key={n.id}>
              <input
                type="checkbox"
                checked={pinned.includes(n.id)}
                onChange={(e) =>
                  props.onChange({
                    ...props.instance.config,
                    pinned: e.target.checked
                      ? [...pinned, n.id]
                      : pinned.filter((id) => id !== n.id),
                  })
                }
              />
              {n.title}
            </label>
          ))
        ) : (
          <small className="dash-note">{t('Nessuna nota protetta.')}</small>
        )}
      </div>
    </>
  );
}

function Identities({ ctx, instance }: WidgetProps) {
  const list = active(ctx.vault)
    .filter((i) => i.type === 'personal')
    .sort((a, b) => a.title.localeCompare(b.title, locale()))
    .slice(0, Number(instance.config.max));
  return (
    <>
      {list.length ? (
        <ItemList items={list} ctx={ctx} detail={() => t('Identità')} />
      ) : (
        <Empty>{t('Nessuna identità salvata.')}</Empty>
      )}
      <button
        type="button"
        className="secondary dash-inline"
        onClick={() => ctx.openItem(undefined, 'personal')}
      >
        <Plus size={15} />
        {t('Nuova identità')}
      </button>
    </>
  );
}

// --- Productivity ------------------------------------------------------------------------

type ActionDef = { label: string; icon: typeof KeyRound; run: (ctx: DashboardContext) => void };
export const ACTIONS: Record<QuickAction, ActionDef> = {
  'add-login': {
    label: msg('Nuovo account'),
    icon: KeyRound,
    run: (c) => c.openItem(undefined, 'login'),
  },
  'add-note': {
    label: msg('Nuova nota protetta'),
    icon: FileKey,
    run: (c) => c.openItem(undefined, 'note'),
  },
  'add-personal': {
    label: msg('Nuova identità'),
    icon: UserRound,
    run: (c) => c.openItem(undefined, 'personal'),
  },
  'add-card': {
    label: msg('Nuova carta'),
    icon: Wallet,
    run: (c) => c.openItem(undefined, 'card'),
  },
  'add-passkey': {
    label: msg('Nuova passkey'),
    icon: ShieldCheck,
    run: (c) => c.openItem(undefined, 'passkey'),
  },
  'add-crypto': {
    label: msg('Nuovo wallet crypto'),
    icon: Archive,
    run: (c) => c.openItem(undefined, 'crypto'),
  },
  generate: { label: msg('Genera password'), icon: Shuffle, run: (c) => c.selectPage('generator') },
  search: { label: msg('Cerca nel vault'), icon: Search, run: (c) => c.focusSearch() },
  security: {
    label: msg('Centro sicurezza'),
    icon: ShieldAlert,
    run: (c) => c.selectPage('security'),
  },
  passwords: {
    label: msg('Archivio password'),
    icon: History,
    run: (c) => c.selectPage('passwords'),
  },
  lock: { label: msg('Blocca il vault'), icon: Lock, run: (c) => c.lock() },
};

function QuickActions({ ctx, instance }: WidgetProps) {
  const list = (instance.config.actions as QuickAction[]) || [];
  if (!list.length)
    return (
      <Empty>
        {t('Nessuna azione selezionata: scegline alcune nelle impostazioni del widget.')}
      </Empty>
    );
  return (
    <div className="dash-actions">
      {list.map((id) => {
        const a = ACTIONS[id];
        return (
          <button key={id} type="button" className="dash-action" onClick={() => a.run(ctx)}>
            <a.icon size={16} />
            <span>{t(a.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

function QuickActionsSettings({ instance, onChange }: SettingsProps) {
  const chosen = (instance.config.actions as QuickAction[]) || [];
  const set = (actions: QuickAction[]) => onChange({ ...instance.config, actions });
  const move = (index: number, delta: number) => {
    const next = [...chosen];
    const [x] = next.splice(index, 1);
    next.splice(index + delta, 0, x);
    set(next);
  };
  return (
    <div className="dash-action-settings">
      <span className="dash-settings-label">{t('Azioni mostrate, nell’ordine')}</span>
      {chosen.map((id, i) => (
        <div className="dash-order-row" key={id}>
          <label className="check-line">
            <input type="checkbox" checked onChange={() => set(chosen.filter((x) => x !== id))} />
            {t(ACTIONS[id].label)}
          </label>
          <button
            type="button"
            className="icon-button"
            disabled={i === 0}
            aria-label={t('Sposta su')}
            onClick={() => move(i, -1)}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={i === chosen.length - 1}
            aria-label={t('Sposta giù')}
            onClick={() => move(i, 1)}
          >
            <ArrowDown size={14} />
          </button>
        </div>
      ))}
      {QUICK_ACTIONS.filter((id) => !chosen.includes(id)).map((id) => (
        <label className="check-line" key={id}>
          <input type="checkbox" checked={false} onChange={() => set([...chosen, id])} />
          {t(ACTIONS[id].label)}
        </label>
      ))}
    </div>
  );
}

// Same defaults as the generator page; generation stays in the backend.
const GENERATOR_FLAGS = {
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  ambiguous: true,
  unique: false,
  start_letter: false,
  cap: true,
  add_number: true,
  symset: '!@#$%^&*',
};

function Generator({ ctx, instance }: WidgetProps) {
  const [value, setValue] = useState(''),
    [bits, setBits] = useState(0),
    [error, setError] = useState('');
  const c = instance.config;
  const generate = async () => {
    setError('');
    try {
      const r = await api<{ results: { value: string; bits: number }[] }>('generate', {
        ...GENERATOR_FLAGS,
        mode: c.mode,
        length: c.length,
        pin_len: c.length,
        words: c.words,
        count: 1,
      });
      setValue(r.results[0]?.value || '');
      setBits(r.results[0]?.bits || 0);
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <div className="dash-generator">
      <output className={`dash-generated ${value ? '' : 'placeholder'}`}>
        {value || t('Premi Genera')}
      </output>
      {value && (
        <small className="dash-note">{t('{n} bit stimati', { n: Math.round(bits) })}</small>
      )}
      {error && <p className="dash-error">{error}</p>}
      <div className="dash-buttons">
        <button type="button" className="primary" onClick={() => void generate()}>
          <Shuffle size={15} />
          {t('Genera')}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!value}
          onClick={() => void ctx.copy(value)}
        >
          <Copy size={15} />
          {t('Copia')}
        </button>
        <button type="button" className="secondary" onClick={() => ctx.selectPage('generator')}>
          {t('Altre opzioni')}
        </button>
      </div>
    </div>
  );
}

function GeneratorSettings({ instance, onChange }: SettingsProps) {
  const c = instance.config;
  return (
    <>
      <label className="field">
        <span>{t('Modalità')}</span>
        <select value={String(c.mode)} onChange={(e) => onChange({ ...c, mode: e.target.value })}>
          <option value="password">{t('Password')}</option>
          <option value="passphrase">{t('Passphrase')}</option>
          <option value="pin">{t('PIN')}</option>
        </select>
      </label>
      {c.mode === 'passphrase' ? (
        <label className="field">
          <span>{t('Numero di parole')}</span>
          <input
            type="number"
            min={3}
            max={10}
            value={Number(c.words)}
            onChange={(e) => onChange({ ...c, words: Number(e.target.value) })}
          />
        </label>
      ) : (
        <label className="field">
          <span>{t('Lunghezza')}</span>
          <input
            type="number"
            min={4}
            max={64}
            value={Number(c.length)}
            onChange={(e) => onChange({ ...c, length: Number(e.target.value) })}
          />
        </label>
      )}
    </>
  );
}

// --- System and privacy ---------------------------------------------------------------------

function BackupStatus({ ctx }: WidgetProps) {
  const b = ctx.backup;
  if (ctx.backupError) return <p className="dash-error">{ctx.backupError}</p>;
  if (!b) return <div className="dash-loading" aria-busy="true" />;
  const ok = b.bak_exists && !!b.modified;
  return (
    <div className="dash-kv">
      <p className={`dash-status ${ok ? 'good' : 'warn'}`}>
        {ok ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
        {ok
          ? t('Copia di sicurezza automatica presente')
          : t('Nessuna copia di sicurezza ancora: verrà creata al prossimo salvataggio')}
      </p>
      <dl>
        <dt>{t('Ultimo salvataggio del vault')}</dt>
        <dd>{dateLabel(b.modified)}</dd>
        <dt>{t('Copia precedente (.bak)')}</dt>
        <dd>{b.bak_exists ? dateLabel(b.bak_modified) : t('Assente')}</dd>
        <dt>{t('Ultima lettura delle copie nella cartella')}</dt>
        <dd>{dateLabel(b.synced_at)}</dd>
        <dt>{t('Destinazione')}</dt>
        <dd className="dash-path" title={b.path}>
          {b.folder || b.path}
        </dd>
      </dl>
      <button
        type="button"
        className="secondary dash-inline"
        onClick={() => ctx.selectPage('settings')}
      >
        <HardDrive size={15} />
        {t('Copia vault in cartella / cloud')}
      </button>
    </div>
  );
}

function Privacy({ ctx }: WidgetProps) {
  const s = ctx.vault.settings;
  const [updates, setUpdates] = useState<boolean | null>(null),
    [passkeys, setPasskeys] = useState<boolean | null>(null);
  useEffect(() => {
    void invoke<{ auto: boolean }>('update_settings')
      .then((r) => setUpdates(r.auto))
      .catch(() => setUpdates(null));
    void invoke<{ enabled: boolean }>('passkey_settings')
      .then((r) => setPasskeys(r.enabled))
      .catch(() => setPasskeys(null));
  }, []);
  const rows: [string, string, boolean | null][] = [
    [t('Dati'), t('Solo nel file locale cifrato, nessun account online'), true],
    [t('Telemetria'), t('Assente'), true],
    [
      t('Loghi dei siti'),
      (s.logos ?? 1) ? t('Scaricati da DuckDuckGo (rete)') : t('Disattivati'),
      !(s.logos ?? 1),
    ],
    [
      t('Controllo aggiornamenti'),
      updates === null
        ? '—'
        : updates
          ? t('GitHub, all’avvio e una volta al giorno')
          : t('Disattivato'),
      updates === false,
    ],
    [t('Verifica violazioni'), t('Solo su richiesta, con prefisso dell’hash'), true],
    [
      t('Blocco automatico'),
      (s.autolock ?? 5) ? t('Dopo {n} minuti', { n: s.autolock ?? 5 }) : t('Disattivato'),
      (s.autolock ?? 5) > 0,
    ],
    [
      t('Pulizia appunti'),
      (s.clip ?? 30) ? t('Dopo {n} secondi', { n: s.clip ?? 30 }) : t('Disattivata'),
      (s.clip ?? 30) > 0,
    ],
    [
      t('Passkey nel browser'),
      passkeys === null ? '—' : passkeys ? t('Attive, con conferma') : t('Disattivate'),
      true,
    ],
  ];
  return (
    <ul className="dash-privacy">
      {rows.map(([label, value, good]) => (
        <li key={label}>
          <span className={`dash-dot ${good ? 'good' : 'info'}`} />
          <span>{label}</span>
          <strong>{value}</strong>
        </li>
      ))}
    </ul>
  );
}

// --- Registry ----------------------------------------------------------------------------

export const WIDGETS: Record<WidgetType, WidgetDefinition> = {
  'security-score': {
    type: 'security-score',
    name: msg('Punteggio di sicurezza'),
    description: msg('Valutazione complessiva delle password, con i problemi rilevati.'),
    icon: ShieldCheck,
    Component: SecurityScore,
    Settings: SecurityScoreSettings,
    refresh: 'health',
  },
  'security-audit': {
    type: 'security-audit',
    name: msg('Analisi di sicurezza'),
    description: msg('Problemi trovati nelle password, per gravità.'),
    icon: ShieldAlert,
    Component: SecurityAudit,
    refresh: 'health',
  },
  'vault-overview': {
    type: 'vault-overview',
    name: msg('Panoramica del vault'),
    description: msg('Quanti elementi hai per ogni categoria.'),
    icon: LayoutGrid,
    Component: VaultOverview,
  },
  favorites: {
    type: 'favorites',
    name: msg('Preferiti'),
    description: msg('Accesso rapido agli elementi con la stella.'),
    icon: Star,
    Component: Favorites,
    Settings: FavoritesSettings,
  },
  'recent-added': {
    type: 'recent-added',
    name: msg('Aggiunti di recente'),
    description: msg('Gli ultimi elementi creati.'),
    icon: Clock,
    Component: RecentAdded,
    Settings: (p) => <MaxSetting {...p} label={t('Numero di elementi')} />,
  },
  'recent-used': {
    type: 'recent-used',
    name: msg('Usati di recente'),
    description: msg('Gli elementi aperti in questa sessione, senza salvare nessuna cronologia.'),
    icon: History,
    Component: RecentUsed,
    Settings: (p) => <MaxSetting {...p} label={t('Numero di elementi')} />,
  },
  'secure-notes': {
    type: 'secure-notes',
    name: msg('Note protette'),
    description: msg('Le tue note, con quelle fissate in cima. Mostra solo i titoli.'),
    icon: FileKey,
    Component: SecureNotes,
    Settings: SecureNotesSettings,
  },
  'quick-actions': {
    type: 'quick-actions',
    name: msg('Azioni rapide'),
    description: msg('Le operazioni che usi di più, nell’ordine che preferisci.'),
    icon: Zap,
    Component: QuickActions,
    Settings: QuickActionsSettings,
  },
  generator: {
    type: 'generator',
    name: msg('Generatore di password'),
    description: msg('Crea una password con il generatore dell’app e copiala.'),
    icon: Shuffle,
    Component: Generator,
    Settings: GeneratorSettings,
  },
  'backup-status': {
    type: 'backup-status',
    name: msg('Stato del backup'),
    description: msg('Ultimo salvataggio, copia di sicurezza e cartella del vault.'),
    icon: HardDrive,
    Component: BackupStatus,
    refresh: 'backup',
  },
  privacy: {
    type: 'privacy',
    name: msg('Privacy'),
    description: msg('Quali funzioni usano la rete e quali protezioni sono attive.'),
    icon: EyeOff,
    Component: Privacy,
  },
  identities: {
    type: 'identities',
    name: msg('Identità digitali'),
    description: msg('Le schede Identità salvate, solo per titolo.'),
    icon: Fingerprint,
    Component: Identities,
    Settings: (p) => <MaxSetting {...p} label={t('Numero di elementi')} />,
  },
  documents: {
    type: 'documents',
    name: msg('Documenti'),
    description: msg('Documenti personali archiviati nel vault.'),
    icon: FileText,
    unavailableReason: msg('Non disponibile: il vault non ha ancora una categoria Documenti.'),
  },
};
