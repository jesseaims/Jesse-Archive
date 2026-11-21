import { locale, msg, t, tRich, translateMessage } from './i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import {
  Archive,
  ArrowDownToLine,
  ArrowRight,
  Check,
  Cloud,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileKey,
  Folder,
  FolderPlus,
  Instagram,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Palette,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Shuffle,
  Star,
  Trash2,
  Upload,
  UserRound,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  api,
  copyText,
  copyVaultSecret,
  clearSecretIfUnchanged,
  picker,
  readFile,
  saveFile,
} from './api';
import { paletteKeys, DEFAULT_CUSTOM, applyPalette } from './theme';
import { changeZoom, getZoom, ZOOM_MAX, ZOOM_MIN } from './zoom';
import { pickIconData } from './api';
import {
  categories,
  labels,
  type Category,
  type Item,
  type Page,
  type Password,
  type State,
  type Status,
} from './types';
import { CheckSquare, ChevronDown, Newspaper } from 'lucide-react';
import NewsPanel from './NewsPanel';
import BrowserSettings from './BrowserSettings';
import { groupFor, savedGroupKey } from './groups';
import GroupLogo from './GroupLogo';
import type { QuickOpen } from './quick-search/actions';
import QuickSearchSettings from './quick-search/QuickSearchSettings';
import LanguageMenu from './LanguageMenu';
import Dashboard from './dashboard/Dashboard';
import type { BreachResult, DashboardConfig } from './dashboard/model';
import { UpdateProgress, UpdateSettings, useAutoUpdate } from './Updater';

type Dict = Record<string, unknown>;
type Dialog =
  | 'item'
  | 'folder'
  | 'share'
  | 'import'
  | 'preview'
  | 'recover'
  | 'master'
  | 'recovery_new'
  | 'group'
  | null;
// Import preview (`import_preview` in core.rs): program recognized, items found and, for
// a CSV, the field of each column, which the user can change.
type ImportPreview = {
  text: string;
  source: string;
  count: number;
  columns: { header: string; target: string; sample: string }[] | null;
  mapping: Record<string, string>;
};
const IMPORT_TARGETS: [string, string][] = [
  ['title', msg('Nome')],
  ['url', msg('Indirizzo web')],
  ['username', msg('Username')],
  ['password', msg('Password')],
  ['notes', msg('Note')],
  ['notes+', msg('Aggiungi alle note')],
  ['totp', msg('Codice 2FA (TOTP)')],
  ['folder', msg('Cartella')],
  ['fav', msg('Preferito')],
  ['type', msg('Tipo')],
  ['email', msg('Email')],
  ['holder', msg('Titolare della carta')],
  ['number', msg('Numero della carta')],
  ['cvv', msg('CVV')],
  ['expiry', msg('Scadenza')],
  ['pin', msg('PIN')],
  ['fullname', msg('Nome completo')],
  ['phone', msg('Telefono')],
  ['address', msg('Indirizzo')],
  ['city', msg('Città')],
  ['zip', msg('CAP')],
  ['country', msg('Paese')],
  ['birthday', msg('Data di nascita')],
  ['platform', msg('Piattaforma')],
  ['seed', msg('Seed')],
  ['credential', msg('Credenziale')],
  ['app_group', msg('Gruppo (app o servizio senza sito)')],
  ['app_group_type', msg('Tipo di gruppo (app o altro)')],
  ['ignore', msg('Ignora')],
];

const icons = {
  login: KeyRound,
  card: Wallet,
  note: FileKey,
  personal: UserRound,
  passkey: ShieldCheck,
  crypto: Archive,
};
const sectionLabels: Record<string, string> = {
  dashboard: msg('Dashboard'),
  all: msg('Tutti gli elementi'),
  favorites: msg('Preferiti'),
  passwords: msg('Archivio password'),
  security: msg('Centro sicurezza'),
  generator: msg('Generatore'),
  trash: msg('Cestino'),
  settings: msg('Impostazioni'),
  groups: msg('Gruppi'),
  login: msg('Account'),
  passkey: msg('Passkey'),
  note: msg('Note protette'),
  card: msg('Carte'),
  personal: msg('Identità'),
  crypto: msg('Asset crypto'),
  shared: msg('Condivisi'),
};
function date(n?: number) {
  return n
    ? new Date(n * 1000).toLocaleDateString(locale(), {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
}
const formatError = (e: unknown) =>
  typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
const itemBase = (type: Category = 'login'): Item => ({
  id: '',
  type,
  title: '',
  folder: null,
  f: {},
  notes: '',
  fav: false,
});
function Field({
  label,
  value,
  onChange,
  secret = false,
  placeholder = '',
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secret?: boolean;
  placeholder?: string;
  textarea?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-control">
        {textarea ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            placeholder={placeholder}
          />
        ) : (
          <input
            type={secret && !visible ? 'password' : 'text'}
            className={secret ? 'secret-input' : ''}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
          />
        )}
        {secret && (
          <button
            className="icon-button"
            type="button"
            title={visible ? t('Nascondi') : t('Mostra')}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
    </label>
  );
}

function AccountGroups({
  items,
  vault,
  openItem,
  copy,
  reveal,
  copySecret,
  onFavorite,
  onDeleteAccount,
  onDeleteGroup,
  selected,
  onSelect,
}: {
  items: Item[];
  vault: State;
  openItem: (i?: Item) => void;
  copy: (v: string) => Promise<void>;
  reveal: (id: string, field: string) => Promise<string | undefined>;
  copySecret: (id: string, field: string) => Promise<void>;
  onFavorite: (ids: string[], on: boolean) => Promise<unknown>;
  onDeleteAccount: (it: Item) => Promise<void>;
  onDeleteGroup: (key: string, label: string) => Promise<void>;
  // Multiple selection shared with the page's bulk bar (move, trash, restore).
  selected: string[];
  onSelect: (ids: string[], on: boolean) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items) {
      const key = groupFor(it);
      if (!key) continue;
      const rows = m.get(key) || [];
      rows.push(it);
      m.set(key, rows);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);
  const [pageBy, setPageBy] = useState<Record<string, number>>({});
  // Values shown on request (`state` has none): forgotten when the list changes.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  // Hide a previously revealed secret when the accounts shown change. Keyed on the
  // ids: `items` is a new array at every render of the page (busy, toasts).
  const shownIds = items.map((i) => i.id).join(',');
  useEffect(() => setRevealed({}), [shownIds]);
  return (
    <div className="account-groups">
      {groups.map(([key, rows]) => {
        const g = vault.groups?.[key];
        const first = rows[0];
        const label =
          g?.name ||
          (key.startsWith('web:') || key.startsWith('app:')
            ? key.slice(key.indexOf(':') + 1)
            : first.title);
        const index = Math.min(pageBy[key] || 0, rows.length - 1);
        const it = rows[index];
        const ids = rows.map((r) => r.id);
        const picked = ids.filter((id) => selected.includes(id)).length;
        return (
          <section className={`account-group ${picked ? 'picked' : ''}`} key={key}>
            <div className="account-group-head">
              <input
                type="checkbox"
                className="group-select"
                aria-label={t('Seleziona tutti gli account di {name}', { name: label })}
                title={t('Seleziona tutti gli account di {name}', { name: label })}
                checked={picked === ids.length}
                ref={(el) => {
                  if (el) el.indeterminate = picked > 0 && picked < ids.length;
                }}
                onChange={(e) => onSelect(ids, e.target.checked)}
              />
              <GroupLogo icon={g?.icon} groupKey={key} name={label} />
              <div className="group-title">
                <strong>{label}</strong>
                <small>{t('{n} account', { n: rows.length })}</small>
              </div>
              <button
                type="button"
                className={`icon-button favorite group-fav ${rows.every((r) => r.fav) ? 'on' : ''}`}
                title={
                  rows.every((r) => r.fav)
                    ? t('Rimuovi il gruppo {name} dai preferiti', { name: label })
                    : t('Aggiungi il gruppo {name} ai preferiti', { name: label })
                }
                aria-label={
                  rows.every((r) => r.fav)
                    ? t('Rimuovi il gruppo {name} dai preferiti', { name: label })
                    : t('Aggiungi il gruppo {name} ai preferiti', { name: label })
                }
                aria-pressed={rows.every((r) => r.fav)}
                onClick={() => void onFavorite(ids, !rows.every((r) => r.fav))}
              >
                <Star size={16} fill={rows.every((r) => r.fav) ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                className="icon-button danger group-delete"
                title={t("Elimina l'intero gruppo {name}", { name: label })}
                aria-label={t("Elimina l'intero gruppo {name}", { name: label })}
                onClick={() => void onDeleteGroup(key, label)}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="account-group-body">
              <div className="account-name-row">
                {rows.length > 1 && (
                  <input
                    type="checkbox"
                    aria-label={t("Seleziona l'account {name}", { name: it.title })}
                    title={t("Seleziona l'account {name}", { name: it.title })}
                    checked={selected.includes(it.id)}
                    onChange={(e) => onSelect([it.id], e.target.checked)}
                  />
                )}
                <button className="account-name" onClick={() => openItem(it)}>
                  {it.title}
                </button>
                <button
                  type="button"
                  className={`icon-button favorite account-fav ${it.fav ? 'on' : ''}`}
                  title={it.fav ? t('Rimuovi dai preferiti') : t('Aggiungi ai preferiti')}
                  aria-label={it.fav ? t('Rimuovi dai preferiti') : t('Aggiungi ai preferiti')}
                  aria-pressed={!!it.fav}
                  onClick={() => void onFavorite([it.id], !it.fav)}
                >
                  <Star size={15} fill={it.fav ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="group-credential">
                <span>{t('Utente')}</span>
                <strong title={it.f.username || ''}>{it.f.username || t('Non impostato')}</strong>
                {it.f.username && (
                  <button
                    title={t('Copia utente')}
                    className="icon-button"
                    onClick={() => void copy(it.f.username)}
                  >
                    <Copy size={14} />
                  </button>
                )}
              </div>
              <div className="group-credential">
                <span>{t('Password')}</span>
                <strong
                  className="group-password"
                  title={
                    revealed[key + ':' + it.id] !== undefined
                      ? t('Password visibile')
                      : t('Password nascosta')
                  }
                >
                  {revealed[key + ':' + it.id] ?? '••••••••••'}
                </strong>
                {it.has?.includes('password') && (
                  <>
                    <button
                      type="button"
                      title={
                        revealed[key + ':' + it.id] !== undefined
                          ? t('Nascondi password')
                          : t('Mostra password')
                      }
                      aria-label={
                        revealed[key + ':' + it.id] !== undefined
                          ? t('Nascondi password')
                          : t('Mostra password')
                      }
                      aria-pressed={revealed[key + ':' + it.id] !== undefined}
                      className="icon-button group-reveal"
                      onClick={async () => {
                        const k = key + ':' + it.id;
                        if (revealed[k] !== undefined) {
                          setRevealed(({ [k]: _, ...rest }) => rest);
                          return;
                        }
                        const value = await reveal(it.id, 'password');
                        if (value !== undefined) setRevealed((v) => ({ ...v, [k]: value }));
                      }}
                    >
                      {revealed[key + ':' + it.id] !== undefined ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} />
                      )}
                    </button>
                    <button
                      title={t('Copia password')}
                      aria-label={t('Copia password')}
                      className="icon-button"
                      onClick={() => void copySecret(it.id, 'password')}
                    >
                      <Copy size={14} />
                    </button>
                  </>
                )}
              </div>
              <div className="group-actions">
                <button
                  type="button"
                  className="secondary group-delete-account"
                  title={t("Elimina solo l'account {name}", { name: it.title })}
                  onClick={() => void onDeleteAccount(it)}
                >
                  <Trash2 size={14} /> {t('Elimina account')}
                </button>
                <button className="group-edit secondary" onClick={() => openItem(it)}>
                  {t('Apri account')} <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <div className="account-group-foot">
              <button
                aria-label={t('Account precedente {name}', { name: label })}
                disabled={index === 0}
                className="icon-button"
                onClick={() => {
                  setRevealed({});
                  setPageBy((p) => ({ ...p, [key]: index - 1 }));
                }}
              >
                ‹
              </button>
              <span>
                {index + 1} / {rows.length}
              </span>
              <button
                aria-label={t('Account successivo {name}', { name: label })}
                disabled={index >= rows.length - 1}
                className="icon-button"
                onClick={() => {
                  setRevealed({});
                  setPageBy((p) => ({ ...p, [key]: index + 1 }));
                }}
              >
                ›
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

type DecisionKind = 'confirm' | 'notice' | 'text';
type Decision = {
  kind: DecisionKind;
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  initial?: string;
};
type DialogAPI = {
  askConfirm: (
    message: string,
    opts?: { title?: string; danger?: boolean; confirmLabel?: string },
  ) => Promise<boolean>;
  showNotice: (message: string, title?: string, danger?: boolean) => Promise<void>;
  askText: (message: string, initial?: string) => Promise<string | null>;
};

function useAppDialogs(): DialogAPI & {
  decision: Decision | null;
  resolve: (value: boolean | string | null) => void;
} {
  const [decision, setDecision] = useState<Decision | null>(null);
  const resolver = useRef<((value: boolean | string | null) => void) | null>(null);
  const request = useCallback(
    (next: Decision): Promise<boolean | string | null> =>
      new Promise((resolve) => {
        // No operation is executed until this dialog is explicitly confirmed.
        if (resolver.current) {
          resolve(false);
          return;
        }
        resolver.current = resolve;
        setDecision(next);
      }),
    [],
  );
  const resolve = useCallback((value: boolean | string | null) => {
    const cb = resolver.current;
    resolver.current = null;
    setDecision(null);
    cb?.(value);
  }, []);
  const askConfirm = useCallback(
    async (
      message: string,
      opts: { title?: string; danger?: boolean; confirmLabel?: string } = {},
    ) =>
      (await request({
        kind: 'confirm',
        title: opts.title || t('Conferma operazione'),
        message,
        confirmLabel: opts.confirmLabel || t('Conferma'),
        danger: !!opts.danger,
      })) === true,
    [request],
  );
  const showNotice = useCallback(
    async (message: string, title = t('Informazione'), danger = false) => {
      await request({ kind: 'notice', title, message, confirmLabel: t('Ho capito'), danger });
    },
    [request],
  );
  const askText = useCallback(
    async (message: string, initial = '') => {
      const result = await request({
        kind: 'text',
        title: t('Modifica nome'),
        message,
        confirmLabel: t('Salva'),
        danger: false,
        initial,
      });
      return typeof result === 'string' ? result : null;
    },
    [request],
  );
  return { askConfirm, showNotice, askText, decision, resolve };
}

function DecisionModal({
  decision,
  resolve,
}: {
  decision: Decision;
  resolve: (value: boolean | string | null) => void;
}) {
  const [value, setValue] = useState(decision.initial || '');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolve(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resolve]);
  const submit = () => resolve(decision.kind === 'text' ? value : true);
  return (
    <div className="decision-backdrop" role="presentation">
      <section
        className="decision-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="decision-title"
        aria-describedby="decision-message"
      >
        <div className="decision-heading">
          <span className={`decision-emblem ${decision.danger ? 'danger' : ''}`}>
            {decision.danger ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
          </span>
          <button
            className="decision-close"
            title={t('Annulla')}
            aria-label={t('Chiudi dialogo')}
            onClick={() => resolve(false)}
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="decision-title">{decision.title}</h2>
        <p id="decision-message">{decision.message}</p>
        {decision.kind === 'text' && (
          <input
            className="decision-input"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
        )}
        <div className="decision-actions">
          {decision.kind !== 'notice' && (
            <button
              type="button"
              className="secondary"
              autoFocus={decision.kind === 'confirm'}
              onClick={() => resolve(false)}
            >
              {t('Annulla')}
            </button>
          )}
          <button
            type="button"
            className={decision.danger ? 'decision-danger primary' : 'primary'}
            onClick={submit}
            disabled={decision.kind === 'text' && !value.trim()}
          >
            {decision.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const { askConfirm, showNotice, askText, decision, resolve: resolveDecision } = useAppDialogs();
  const [newsOpen, setNewsOpen] = useState(false);
  // Session-only data shared with the dashboard: never saved, cleared on lock.
  const [breaches, setBreaches] = useState<BreachResult[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null),
    [vault, setVault] = useState<State | null>(null),
    [page, setPage] = useState<Page>('dashboard'),
    [folderId, setFolderId] = useState(''),
    [search, setSearch] = useState(''),
    [password, setPassword] = useState(''),
    [recovery, setRecovery] = useState(''),
    // The unlock screen asks for the recovery code instead of the master password.
    [recoveryMode, setRecoveryMode] = useState(false),
    [recoveryNew, setRecoveryNew] = useState(''),
    [rotateKey, setRotateKey] = useState(false),
    [viewRecovery, setViewRecovery] = useState(''),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<Dialog>(null),
    [draft, setDraft] = useState<Item>(itemBase()),
    [folderDraft, setFolderDraft] = useState({ id: '', name: '' }),
    [groupDraft, setGroupDraft] = useState({ key: '', name: '', icon: '' }),
    [multi, setMulti] = useState<string[]>([]),
    [sharePass, setSharePass] = useState(''),
    [shareImport, setShareImport] = useState(''),
    [importPreview, setImportPreview] = useState<ImportPreview | null>(null),
    // Password history values shown on request (id -> value): `state` has none.
    [showSecrets, setShowSecrets] = useState<Record<string, string>>({}),
    [mobileMenu, setMobileMenu] = useState(false),
    [appsList, setAppsList] = useState<{ name: string; path: string }[] | null>(null),
    [appsQuery, setAppsQuery] = useState(''),
    [groupIcon, setGroupIcon] = useState(''),
    [moveOpen, setMoveOpen] = useState(false),
    [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (!vault) applyPalette({ preset: 'night' });
  }, [!vault]);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 4000);
  };
  // Drops every piece of decrypted or secret UI state when the vault locks.
  // Child pages holding secrets unmount because they render only with a vault.
  const wipeSession = useCallback(() => {
    setVault(null);
    setBreaches(null);
    setPassword('');
    setRecovery('');
    setRecoveryNew('');
    setViewRecovery('');
    setSearch('');
    setDialog(null);
    setDraft(itemBase());
    setFolderDraft({ id: '', name: '' });
    setGroupDraft({ key: '', name: '', icon: '' });
    setMulti([]);
    setSharePass('');
    setShareImport('');
    setShowSecrets({});
    setNoteHits([]);
    setAppsList(null);
    setGroupIcon('');
  }, []);
  const run = useCallback(
    async <T,>(name: string, body: Dict = {}): Promise<T | undefined> => {
      setError('');
      setBusy(true);
      try {
        return await api<T>(name, body);
      } catch (e) {
        const message = formatError(e);
        if (/Vault bloccato|Sessione scaduta/.test(message)) wipeSession();
        setError(translateMessage(message));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [wipeSession],
  );
  const refresh = useCallback(async () => {
    try {
      const s = await api<Status>('status');
      setStatus(s);
      if (s.unlocked) {
        setVault(await api<State>('state'));
      } else {
        setVault(null);
      }
    } catch (e) {
      setError(translateMessage(formatError(e)));
    }
  }, []);
  // "Aggiorna" button: reloads the vault from disk (merging cloud/conflict copies
  // in the backend) and reports what happened in a themed popup.
  const manualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const before = vault;
    try {
      const s = await api<Status>('status');
      setStatus(s);
      if (!s.unlocked) {
        wipeSession();
        await showNotice(
          t(
            'Il vault risulta bloccato (per esempio per inattività), quindi non è stato possibile ricaricare i dati.\n\nSblocca di nuovo il vault con la password principale.',
          ),
          t('Vault bloccato'),
          true,
        );
        return;
      }
      const after = await api<State>('state');
      setVault(after);
      const key = (x: unknown) => JSON.stringify(x);
      const old = new Map((before?.items || []).map((i) => [i.id, key(i)]));
      const now = new Map(after.items.map((i) => [i.id, key(i)]));
      let added = 0,
        changed = 0,
        removed = 0;
      now.forEach((v, id) => {
        if (!old.has(id)) added++;
        else if (old.get(id) !== v) changed++;
      });
      old.forEach((_, id) => {
        if (!now.has(id)) removed++;
      });
      const changes: string[] = [];
      // Neutral "label: n" wording avoids plural forms that differ between languages.
      if (added) changes.push('• ' + t('Elementi nuovi: {n}', { n: added }));
      if (changed) changes.push('• ' + t('Elementi modificati: {n}', { n: changed }));
      if (removed) changes.push('• ' + t('Elementi rimossi: {n}', { n: removed }));
      if (key(before?.folders || []) !== key(after.folders))
        changes.push('• ' + t('le cartelle sono cambiate'));
      if ((before?.passwords.length ?? 0) !== after.passwords.length)
        changes.push('• ' + t('lo storico delle password è cambiato'));
      const summary = changes.length
        ? t(
            'Sono state trovate modifiche (per esempio da un altro dispositivo tramite la cartella cloud):',
          ) +
          '\n' +
          changes.join('\n')
        : t('Nessuna modifica trovata: i dati mostrati erano già aggiornati.');
      await showNotice(
        t(
          'Il vault è stato riletto dal file e confrontato con eventuali copie nella stessa cartella.',
        ) +
          '\n\n' +
          summary +
          '\n\n' +
          t('File: {path}', { path: after.path }),
        t('Aggiornamento completato'),
      );
    } catch (e) {
      const raw = formatError(e);
      // Backend messages are Italian: detect on the raw text, show the translation.
      const locked = /Vault bloccato|Sessione scaduta/.test(raw);
      const detail = translateMessage(raw);
      if (locked) wipeSession();
      await showNotice(
        locked
          ? t(
              'La sessione è scaduta e il vault è stato bloccato, quindi non è stato possibile aggiornare i dati.',
            ) +
              '\n\n' +
              t('Sblocca di nuovo il vault con la password principale.') +
              '\n\n' +
              t('Dettaglio: {detail}', { detail })
          : t('Non è stato possibile rileggere il vault dal file.') +
              '\n\n' +
              t(
                'Possibili cause: il file non è raggiungibile (cartella cloud non sincronizzata, disco scollegato, permessi), oppure è danneggiato. I dati già mostrati non sono stati modificati.',
              ) +
              '\n\n' +
              t('Dettaglio: {detail}', { detail }),
        t('Aggiornamento non riuscito'),
        true,
      );
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    applyPalette(vault?.settings.theme);
  }, [vault?.settings.theme]);
  useEffect(() => {
    if (!vault) return;
    const id = window.setInterval(() => {
      void api<{ unlocked: boolean; rev: number }>('ping')
        .then((r) => {
          if (!r.unlocked) {
            wipeSession();
            void refresh();
          }
        })
        .catch(() => {});
    }, 15000);
    return () => window.clearInterval(id);
  }, [vault, refresh, wipeSession]);
  // User interaction counts as activity for the auto-lock delay (backend `touch`),
  // throttled to one call every 30 seconds.
  const unlocked = !!vault;
  useEffect(() => {
    if (!unlocked) return;
    let lastTouch = Date.now();
    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouch < 30000) return;
      lastTouch = now;
      void api('touch').catch(() => {});
    };
    const events = ['keydown', 'pointerdown', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, [unlocked]);
  useEffect(() => {
    const stop = listen('vault-changed', () => {
      void refresh();
    });
    return () => {
      void stop.then((fn) => fn());
    };
  }, [refresh]);
  useEffect(() => {
    let stop: undefined | (() => void);
    void listen('vault-locked', () => {
      wipeSession();
      void refresh();
    }).then((fn) => {
      stop = fn;
    });
    return () => stop?.();
  }, [refresh, wipeSession]);
  const mutate = async (name: string, body: Dict = {}, message = t('Modifiche salvate')) => {
    const r = await run<{ state?: State; [key: string]: unknown }>(name, body);
    if (r) {
      if (r.state) setVault(r.state);
      else await refresh();
      notify(message);
    }
    return r;
  };
  // Bulk bar "Sposta in": moves the selection to a folder, or to a new one.
  const moveMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moveOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === 'Escape'
          : !moveMenuRef.current?.contains(e.target as Node)
      )
        setMoveOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [moveOpen]);
  const moveSelected = async (folder: string) => {
    setMoveOpen(false);
    const r = await mutate('bulk', { ids: multi, op: 'move', folder }, t('Elementi spostati'));
    if (r) setMulti([]);
  };
  // Folder actions shared by the sidebar context menu, the folder page and Settings.
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  useEffect(() => {
    if (!folderMenu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'mousedown' && (e.target as Element).closest?.('.context-menu')) return;
      setFolderMenu(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [folderMenu]);
  const renameFolder = async (f: { id: string; name: string }) => {
    setFolderMenu(null);
    const n = await askText(t('Nuovo nome della cartella'), f.name);
    if (n?.trim()) await mutate('folder', { id: f.id, name: n.trim() });
  };
  const deleteFolder = async (f: { id: string; name: string }) => {
    setFolderMenu(null);
    if (
      !(await askConfirm(
        t('Eliminare la cartella {name}? Gli elementi resteranno nel vault.', { name: f.name }),
        { title: t('Elimina cartella'), danger: true, confirmLabel: t('Elimina cartella') },
      ))
    )
      return;
    const r = await mutate('folder', { id: f.id, delete: true }, t('Cartella eliminata'));
    if (r && page === 'folder' && folderId === f.id) selectPage('all');
  };
  const moveToNewFolder = async () => {
    setMoveOpen(false);
    const name = (await askText(t('Nome della nuova cartella')))?.trim();
    if (!name) return;
    const before = new Set((vault?.folders || []).map((f) => f.id));
    const r = await mutate('folder', { name }, t('Cartella creata'));
    const created = r?.state?.folders.find((f) => !before.has(f.id));
    if (created) await moveSelected(created.id);
  };
  // "Usati di recente": item ids in the encrypted vault settings, shared with the
  // Global Quick Search. A convenience: a failed save changes nothing.
  const recentIds = vault?.settings.recent ?? [];
  const rememberItem = async (id: string) => {
    if (recentIds[0] === id) return;
    const recent = [id, ...recentIds.filter((x) => x !== id)].slice(0, 12);
    try {
      const r = await api<{ state: State }>('settings', { recent });
      setVault(r.state);
    } catch {
      /* Il vault resta com'è: l'elenco si aggiorna alla prossima apertura. */
    }
  };
  // Dashboard layout: saved in the encrypted vault settings (no toast: it saves often).
  const saveDashboard = async (dashboard: DashboardConfig) => {
    const r = await api<{ state: State }>('settings', { dashboard });
    setVault(r.state);
  };
  const copy = async (text: string) => {
    try {
      await copyText(text);
      notify(t('Copiato negli appunti'));
      const ttl = vault?.settings.clip ?? 30;
      if (ttl > 0)
        window.setTimeout(() => {
          void clearSecretIfUnchanged(text);
        }, ttl * 1000);
    } catch (e) {
      setError(translateMessage(formatError(e)));
    }
  };
  // Secrets are not in `state`: one value when the user asks to see it, copied in the
  // backend without passing through this window.
  const reveal = async (id: string, field: string) =>
    (await run<{ value: string }>('secret', { id, field }))?.value;
  const copySecret = async (id: string, field: string) => {
    try {
      await copyVaultSecret(id, field);
      notify(t('Copiato negli appunti'));
    } catch (e) {
      const message = formatError(e);
      if (/Vault bloccato|Sessione scaduta/.test(message)) wipeSession();
      setError(translateMessage(message));
    }
  };
  const lock = async () => {
    await run('lock');
    wipeSession();
    await refresh();
  };
  const selectPage = (p: Page, fid = '') => {
    setPage(p);
    setFolderId(fid);
    setSearch('');
    setMulti([]);
    setMobileMenu(false);
  };
  const [noteHits, setNoteHits] = useState<string[]>([]);
  useEffect(() => {
    const q = search.trim();
    if (!q || !vault) {
      setNoteHits([]);
      return;
    }
    const id = window.setTimeout(() => {
      void api<{ ids: string[] }>('search_notes', { q })
        .then((r) => setNoteHits(r.ids))
        .catch(() => setNoteHits([]));
    }, 200);
    return () => window.clearTimeout(id);
  }, [search, vault]);
  const filtered = useMemo(() => {
    if (!vault) return [];
    return vault.items
      .filter((it) => {
        if (page === 'trash') {
          if (!it.trashed) return false;
        } else if (it.trashed) return false;
        if (page === 'favorites' && !it.fav) return false;
        if (page === 'shared' && !it.shared) return false;
        if (
          ['login', 'passkey', 'note', 'card', 'personal', 'crypto'].includes(page) &&
          it.type !== page
        )
          return false;
        if (page === 'folder' && it.folder !== folderId) return false;
        const q = search.toLowerCase().trim();
        return (
          !q ||
          noteHits.includes(it.id) ||
          // `state` has no secrets: what is searched here is title, category and the
          // visible fields; the notes are searched in the backend (`noteHits`).
          [it.title, it.type, ...Object.values(it.f || {})].some((v) =>
            v?.toLowerCase().includes(q),
          )
        );
      })
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }, [vault, page, folderId, search, noteHits]);
  // Deleting moves items to the Cestino (backend `trash`/`bulk`), where they can be
  // restored or permanently deleted. Nothing happens before explicit confirmation.
  const deleteItem = async (it: Item) => {
    const isAccount = it.type === 'login';
    const detail = isAccount && it.f?.username ? ` (${it.f.username})` : '';
    const ok = await askConfirm(
      (isAccount
        ? t('Spostare nel cestino l\'account "{name}"{detail}?', { name: it.title, detail })
        : t('Spostare nel cestino l\'elemento "{name}"{detail}?', { name: it.title, detail })) +
        '\n\n' +
        t('Gli altri elementi non vengono toccati. Potrai ripristinarlo dalla sezione Cestino.'),
      {
        title: isAccount
          ? t('Elimina account')
          : t('Elimina: {category}', { category: t(categories[it.type].label) }),
        danger: true,
        confirmLabel: t('Sposta nel cestino'),
      },
    );
    if (ok)
      await mutate(
        'trash',
        { id: it.id },
        isAccount ? t('Account spostato nel cestino') : t('Elemento spostato nel cestino'),
      );
  };
  const deleteGroup = async (key: string, label: string) => {
    if (!vault) return;
    // The whole group, not only the accounts matching the current search.
    const members = vault.items.filter(
      (i) => i.type === 'login' && !i.trashed && groupFor(i) === key,
    );
    if (members.length === 0) return;
    const shown = members
      .slice(0, 8)
      .map((i) => `• ${i.title}${i.f?.username ? ` (${i.f.username})` : ''}`)
      .join('\n');
    const more = members.length > 8 ? '\n' + t('…e altri {n}', { n: members.length - 8 }) : '';
    const n = members.length;
    const first = await askConfirm(
      t('Stai per eliminare l\'INTERO gruppo "{name}", non un singolo account.', { name: label }) +
        '\n\n' +
        t('Account del gruppo che verranno spostati nel cestino: {n}', { n }) +
        '\n' +
        shown +
        more,
      {
        title: t('Eliminare il gruppo {name}?', { name: label }),
        danger: true,
        confirmLabel: t('Continua'),
      },
    );
    if (!first) return;
    const second = await askConfirm(
      t(
        'Ultima conferma: tutti gli account di "{name}" ({n}) verranno spostati nel cestino insieme.',
        { name: label, n },
      ) +
        '\n\n' +
        t(
          'Se volevi eliminare un solo account, premi Annulla e usa "Elimina account" dentro il gruppo.',
        ),
      {
        title: t('Conferma eliminazione del gruppo'),
        danger: true,
        confirmLabel: t('Elimina il gruppo ({n} account)', { n }),
      },
    );
    if (!second) return;
    await mutate(
      'bulk',
      { ids: members.map((i) => i.id), op: 'trash' },
      t('Gruppo {name} spostato nel cestino', { name: label }),
    );
  };
  // "Svuota cestino": permanent deletion of exactly the trashed items listed in the
  // popups (bulk/delete only removes ids that are still in the trash), after two
  // confirmations.
  const emptyTrash = async () => {
    if (!vault) return;
    const trashed = vault.items.filter((i) => i.trashed);
    const n = trashed.length;
    if (n === 0) return;
    const shown = trashed
      .slice(0, 8)
      .map((i) => `• ${i.title} (${t(categories[i.type].label)})`)
      .join('\n');
    const more = n > 8 ? '\n' + t('…e altri {n}', { n: n - 8 }) : '';
    const first = await askConfirm(
      t(
        'Stai per svuotare il cestino: gli elementi ({n}) verranno eliminati DEFINITIVAMENTE e non potranno più essere ripristinati.',
        { n },
      ) +
        '\n\n' +
        shown +
        more,
      { title: t('Svuotare il cestino?'), danger: true, confirmLabel: t('Continua') },
    );
    if (!first) return;
    const second = await askConfirm(
      t('Ultima conferma: elementi da eliminare per sempre dal vault: {n}.', { n }) +
        '\n\n' +
        t(
          'Verranno eliminate anche le loro password nell’Archivio password. Se vuoi tenerne qualcuno, premi Annulla e ripristinalo prima.',
        ),
      {
        title: t('Conferma svuotamento del cestino'),
        danger: true,
        confirmLabel: t('Elimina definitivamente ({n})', { n }),
      },
    );
    if (!second) return;
    await mutate(
      'bulk',
      { ids: trashed.map((i) => i.id), op: 'delete' },
      t('Cestino svuotato'),
    ).then(() => setMulti([]));
  };
  const openItem = (it?: Item, type: Category = 'login') => {
    setGroupIcon('');
    setAppsList(null);
    if (!it?.id) {
      setDraft(it ? structuredClone(it) : itemBase(type));
      setDialog('item');
      return;
    }
    void rememberItem(it.id);
    // The editor needs the secrets of this item only (`state` has none).
    void run<{ item: Item }>('item_full', { id: it.id }).then((r) => {
      if (!r) return;
      setDraft(r.item);
      setDialog('item');
    });
  };
  // Closing the editor forgets the secrets it loaded.
  useEffect(() => {
    if (dialog !== 'item') setDraft(itemBase());
  }, [dialog]);
  // When creating from a category, preselect that category; generic views keep the default editable type.
  const openNewItem = () => {
    const currentCategory: Category =
      page === 'login' ||
      page === 'passkey' ||
      page === 'note' ||
      page === 'card' ||
      page === 'personal' ||
      page === 'crypto'
        ? page
        : 'login';
    openItem(undefined, currentCategory);
  };
  // Global Quick Search: asks this window to open an item, a quick action or a page
  // (src/quick-search/actions.ts). The ref keeps the listener on the current state.
  const quickOpen = useRef<(p: QuickOpen) => void>(() => {});
  quickOpen.current = (p) => {
    if (p.kind === 'item') {
      // Fresh state: the item may have been added since this window last loaded.
      void api<State>('state')
        .then((s) => {
          setVault(s);
          const it = s.items.find((i) => i.id === p.id && !i.trashed);
          if (it) openItem(it);
        })
        .catch(() => void refresh());
    } else if (p.kind === 'action') {
      if (p.action === 'add-login') openItem(undefined, 'login');
      else if (p.action === 'add-note') openItem(undefined, 'note');
      else if (p.action === 'add-personal') openItem(undefined, 'personal');
      else if (p.action === 'generate') selectPage('generator');
      else selectPage(p.action);
    } else if (p.kind === 'page') selectPage(p.page);
    else void refresh();
  };
  useEffect(() => {
    const stop = listen<QuickOpen>('quick-search-open', (e) => quickOpen.current(e.payload));
    return () => {
      void stop.then((fn) => fn());
    };
  }, []);
  const saveItem = async () => {
    if (!draft.title.trim()) {
      setError(t('Inserisci un nome per l’elemento'));
      return;
    }
    // Recomputed on every save: changing the site (or the title of app/other
    // accounts) moves the account to the matching group.
    const groupKey = draft.type === 'login' ? savedGroupKey(draft) : draft.gk || '';
    let icon = groupIcon;
    if (draft.type === 'login' && draft.src === 'app' && !icon) {
      try {
        const installed = await api<{ apps: { name: string; path: string }[] }>('apps');
        const name = draft.title.trim().toLocaleLowerCase('it');
        const found = installed.apps.find((a) => a.name.trim().toLocaleLowerCase('it') === name);
        if (found) {
          const fetched = await api<{ icon: string }>('app_icon', { path: found.path });
          icon = fetched.icon || '';
        }
      } catch {
        /* Se l'app non è riconosciuta, mostra iniziali e consenti il caricamento manuale. */
      }
    }
    const group = groupKey
      ? {
          key: groupKey,
          name:
            (vault?.groups || {})[groupKey]?.name ||
            (groupKey.startsWith('web:') ? groupKey.slice(4) : draft.title),
          src: draft.src || 'web',
          icon,
        }
      : undefined;
    const r = await mutate('item', { ...draft, group }, t('Account salvato'));
    if (r) {
      setDialog(null);
      if (groupKey.startsWith('web:') && vault?.settings.logos !== 0 && !groupIcon) {
        void api<{ state?: State }>('group_logo', { key: groupKey })
          .then((v) => {
            if (v.state) setVault(v.state);
          })
          .catch(() => {});
      }
    }
  };
  const exportData = async (format: 'json' | 'csv') => {
    const r = await run<{ text: string }>('export', { format });
    if (r) {
      const success = await saveFile(`jesse-archive-export.${format}`, r.text).catch((e) => {
        setError(translateMessage(formatError(e)));
        return false;
      });
      if (success) notify(t('Esportazione completata. ATTENZIONE: file non cifrato.'));
    }
  };
  const importData = async () => {
    const p = await picker('import');
    if (!p) return;
    const text = await readFile(p);
    if (p.toLowerCase().endsWith('.jshare')) {
      setShareImport(text);
      setDialog('import');
      return;
    }
    // Preview first: which program, how many items, and the CSV columns to check.
    const r = await run<Omit<ImportPreview, 'text' | 'mapping'>>('import_preview', { text });
    if (!r) return;
    setImportPreview({ ...r, text, mapping: {} });
    setDialog('preview');
  };
  const remapColumn = async (header: string, target: string) => {
    if (!importPreview) return;
    const mapping = { ...importPreview.mapping, [header]: target };
    const r = await run<Omit<ImportPreview, 'text' | 'mapping'>>('import_preview', {
      text: importPreview.text,
      mapping,
    });
    if (r) setImportPreview({ ...importPreview, ...r, mapping });
  };
  useAutoUpdate(!!vault, { askConfirm, showNotice });
  if (!status)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <span className="brand-icon">
            <img src="/jesse-logo.png" alt={t('Jesse Archive')} />
          </span>
          <h1>{t("Jesse's Archive")}</h1>
          <p>{t('Caricamento del vault locale…')}</p>
          {error && <div className="alert">{error}</div>}
        </div>
      </div>
    );
  if (!vault)
    return (
      <div className="auth-screen">
        <div className="auth-language">
          <LanguageMenu />
        </div>
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="auth-card">
          <span className="brand-icon">
            <img src="/jesse-logo.png" alt={t('Jesse Archive')} />
          </span>
          <div className="eyebrow">{t("JESSE'S ARCHIVE")}</div>
          <h1>{status.exists ? t('Bentornato.') : t('Il tuo spazio sicuro.')}</h1>
          <p>
            {status.exists
              ? t('Sblocca il tuo archivio cifrato per accedere ai dati.')
              : t('Crea il tuo vault locale con cifratura AES-256-GCM.')}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (status.exists) {
                const r = await run<{ rollback?: boolean }>('unlock', {
                  password: recoveryMode ? '' : password,
                  recovery: recoveryMode ? recovery : '',
                  new_password: recoveryNew,
                });
                if (r) {
                  setPassword('');
                  setRecovery('');
                  setRecoveryNew('');
                  setRecoveryMode(false);
                  await refresh();
                  // The file is older than the newest write seen on this PC (core.rs).
                  if (r.rollback)
                    await showNotice(
                      t(
                        "Il file del vault è più vecchio dell'ultima versione aperta o salvata su questo PC: potrebbe essere stato sostituito con una copia precedente (per esempio nella cartella cloud) e le modifiche più recenti potrebbero mancare. Se hai ripristinato tu un backup, puoi ignorare questo avviso. Altrimenti, prima di fare modifiche, controlla la cronologia delle versioni del tuo servizio cloud: finché non modifichi qualcosa il file resta com'è.",
                      ),
                      t('Copia del vault più vecchia'),
                      true,
                    );
                }
              } else {
                const r = await run<{ recovery: string }>('create', { password });
                if (r) {
                  setViewRecovery(r.recovery);
                  setDialog('recover');
                  setPassword('');
                  await refresh();
                }
              }
            }}
          >
            <Field
              label={recoveryMode ? t('Codice di recupero') : t('Password principale')}
              value={recoveryMode ? recovery : password}
              onChange={(v) => (recoveryMode ? setRecovery(v) : setPassword(v))}
              secret={!recoveryMode}
              placeholder={
                recoveryMode ? 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX' : t('Inserisci la tua password')
              }
            />
            {recoveryMode && (
              <Field
                label={t('Nuova password principale (facoltativa)')}
                value={recoveryNew}
                onChange={setRecoveryNew}
                secret
              />
            )}
            <button className="primary wide" disabled={busy} type="submit">
              <Lock size={17} />
              {busy
                ? t('Elaborazione…')
                : status.exists
                  ? t('Sblocca il vault')
                  : t('Crea vault cifrato')}
              <ArrowRight size={17} />
            </button>
          </form>
          {status.exists && (
            <button
              className="subtle link-btn"
              onClick={() => {
                setRecovery('');
                setRecoveryNew('');
                setPassword('');
                setRecoveryMode(!recoveryMode);
              }}
            >
              {recoveryMode ? t('Torna alla password') : t('Usa il codice di recupero')}
            </button>
          )}
          <button
            className="secondary wide"
            style={{ marginTop: 14 }}
            onClick={async () => {
              const f = await picker('vault_folder');
              if (f) {
                const result = await run('loc_use', { folder: f });
                if (result) await refresh();
              }
            }}
          >
            <Folder size={16} />
            {t('Collega vault esistente')}
          </button>
          <span className="vault-location">
            {t('Vault locale ·')} {status.path}
          </span>
          {error && <div className="alert">{error}</div>}
          {viewRecovery && (
            <div className="recovery-panel">
              <strong>{t('Salva ora il codice di recupero')}</strong>
              <p>{t("È l'unico modo per recuperare il vault senza la password.")}</p>
              <code>{viewRecovery}</code>
              <button className="secondary" onClick={() => copy(viewRecovery)}>
                {t('Copia codice')}
              </button>
              <button className="primary" onClick={() => setViewRecovery('')}>
                {t('Ho conservato il codice')}
              </button>
            </div>
          )}
          {!status.exists && (
            <div className="auth-footnote">
              {t('Nessuna sincronizzazione online automatica. I dati rimangono nel file locale.')}
            </div>
          )}
        </div>
      </div>
    );
  const folderName = vault.folders.find((f) => f.id === folderId)?.name || t('Cartella');
  return (
    <div className="shell">
      <aside className={`sidebar ${mobileMenu ? 'mobile-show' : ''}`}>
        <div className="sidebar-head">
          <span className="brand-icon small">
            <img src="/jesse-logo.png" alt={t('Jesse Archive')} />
          </span>
          <div className="sidebar-brand">
            <b>{t("Jesse's Archive")}</b>
            <small>{t('SECURE VAULT')}</small>
            <div className="brand-credit">
              <span>{t('Made by')}</span>
              <Instagram size={12} aria-hidden="true" />
              <span>samu.vaccc</span>
            </div>
          </div>
          <button className="mobile-only icon-button" onClick={() => setMobileMenu(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-label">{t('WORKSPACE')}</div>
        <nav>
          <Nav
            active={page === 'dashboard'}
            icon={LayoutDashboard}
            title={t('Dashboard')}
            onClick={() => selectPage('dashboard')}
          />
          <Nav
            active={page === 'all'}
            icon={LayoutGrid}
            title={t('Tutti gli elementi')}
            onClick={() => selectPage('all')}
            count={vault.items.filter((i) => !i.trashed).length}
          />
          <Nav
            active={page === 'favorites'}
            icon={Star}
            title={t('Preferiti')}
            onClick={() => selectPage('favorites')}
          />
          <Nav
            active={page === 'passwords'}
            icon={KeyRound}
            title={t('Archivio password')}
            onClick={() => selectPage('passwords')}
          />
          <Nav
            active={page === 'groups'}
            icon={Cloud}
            title={t('Gruppi e accessi')}
            onClick={() => selectPage('groups')}
          />
        </nav>
        <div className="sidebar-label">{t('CATEGORIE')}</div>
        <nav>
          {(['login', 'passkey', 'note', 'card', 'personal', 'crypto'] as const).map((cat) => {
            const Icon = icons[cat];
            return (
              <Nav
                key={cat}
                active={page === cat}
                icon={Icon}
                title={t(sectionLabels[cat])}
                onClick={() => selectPage(cat)}
              />
            );
          })}
          <Nav
            active={page === 'shared'}
            icon={Cloud}
            title={t('Elementi condivisi')}
            onClick={() => selectPage('shared')}
          />
        </nav>
        <div className="sidebar-label folders-label">
          {t('CARTELLE')}{' '}
          <button
            className="icon-button"
            title={t('Nuova cartella')}
            onClick={() => {
              setFolderDraft({ id: '', name: '' });
              setDialog('folder');
            }}
          >
            <Plus size={15} />
          </button>
        </div>
        <nav className="folder-nav">
          {vault.folders.map((f) => (
            <Nav
              key={f.id}
              active={page === 'folder' && folderId === f.id}
              icon={Folder}
              title={f.name}
              onClick={() => selectPage('folder', f.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setFolderMenu({ x: e.clientX, y: e.clientY, id: f.id });
              }}
            />
          ))}
        </nav>
        {folderMenu &&
          (() => {
            const f = vault.folders.find((x) => x.id === folderMenu.id);
            if (!f) return null;
            return (
              <div
                className="context-menu"
                role="menu"
                style={{
                  left: Math.min(folderMenu.x, window.innerWidth - 220),
                  top: Math.min(folderMenu.y, window.innerHeight - 110),
                }}
              >
                <button role="menuitem" onClick={() => void renameFolder(f)}>
                  <SettingsIcon size={15} />
                  {t('Rinomina')}
                </button>
                <button role="menuitem" className="danger" onClick={() => void deleteFolder(f)}>
                  <Trash2 size={15} />
                  {t('Elimina cartella')}
                </button>
              </div>
            );
          })()}
        <div className="sidebar-label">{t('STRUMENTI')}</div>
        <nav>
          <Nav
            active={page === 'security'}
            icon={ShieldCheck}
            title={t('Centro sicurezza')}
            onClick={() => selectPage('security')}
          />
          <Nav
            active={page === 'generator'}
            icon={Shuffle}
            title={t('Generatore')}
            onClick={() => selectPage('generator')}
          />
          <Nav
            active={page === 'trash'}
            icon={Trash2}
            title={t('Cestino')}
            onClick={() => selectPage('trash')}
          />
          <Nav
            active={page === 'settings'}
            icon={SettingsIcon}
            title={t('Impostazioni')}
            onClick={() => selectPage('settings')}
          />
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-safe">
            <span className="safe-dot" />
            {t('Vault sbloccato')} <span className="safe-status">{t('AES-256')}</span>
          </div>
          <button className="nav-item" onClick={lock}>
            <LogOut size={18} /> {t('Blocca archivio')}
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="mobile-only icon-button" onClick={() => setMobileMenu(!mobileMenu)}>
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            {t('IL TUO ARCHIVIO')} <span>/</span>{' '}
            <strong>{page === 'folder' ? folderName : t(sectionLabels[page])}</strong>
          </div>
          <div className="top-actions">
            <span className="desktop-only sync-label">
              <span className="safe-dot" />
              {t('Protetto localmente')}
            </span>
            <button
              type="button"
              className="news-trigger"
              title={t('Novità e cronologia commit')}
              onClick={() => setNewsOpen(true)}
            >
              <Newspaper size={16} />
              {t('News')}
            </button>
            <button
              className="icon-button"
              title={t('Aggiorna: rileggi il vault dal file')}
              aria-label={t('Aggiorna')}
              aria-busy={refreshing}
              disabled={refreshing}
              onClick={() => void manualRefresh()}
            >
              <RefreshCw size={18} className={refreshing ? 'spin' : undefined} />
            </button>
            <LanguageMenu />
            <button
              className="avatar"
              title={t('Impostazioni')}
              onClick={() => selectPage('settings')}
            >
              JA
            </button>
          </div>
        </header>
        <div className="workspace">
          {[
            'all',
            'favorites',
            'folder',
            'trash',
            'login',
            'passkey',
            'note',
            'card',
            'personal',
            'crypto',
            'shared',
          ].includes(page) ? (
            <>
              <div className="heading-row">
                <div>
                  <div className="eyebrow">{t('PASSWORD MANAGEMENT')}</div>
                  <h1>{page === 'folder' ? folderName : t(sectionLabels[page])}</h1>
                  <p>{t('Organizza i tuoi dati sensibili in uno spazio privato e cifrato.')}</p>
                </div>
                <div className="heading-actions">
                  {page === 'folder' &&
                    (() => {
                      const f = vault.folders.find((x) => x.id === folderId);
                      return (
                        f && (
                          <>
                            <button className="secondary" onClick={() => void renameFolder(f)}>
                              <SettingsIcon size={16} />
                              {t('Rinomina')}
                            </button>
                            <button
                              className="secondary danger-soft"
                              onClick={() => void deleteFolder(f)}
                            >
                              <Trash2 size={16} />
                              {t('Elimina cartella')}
                            </button>
                          </>
                        )
                      );
                    })()}
                  <button className="primary" onClick={openNewItem}>
                    <Plus size={18} />
                    {t('Nuovo elemento')}
                  </button>
                </div>
              </div>
              <div className="stats-grid">
                <Stat
                  icon={KeyRound}
                  title={t('Account')}
                  value={vault.items.filter((i) => i.type === 'login' && !i.trashed).length}
                />
                <Stat
                  icon={Wallet}
                  title={t('Carte')}
                  value={vault.items.filter((i) => i.type === 'card' && !i.trashed).length}
                />
                <Stat
                  icon={FileKey}
                  title={t('Note protette')}
                  value={vault.items.filter((i) => i.type === 'note' && !i.trashed).length}
                />
                <Stat
                  icon={Star}
                  title={t('Preferiti')}
                  value={vault.items.filter((i) => i.fav && !i.trashed).length}
                />
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h2>
                    {page === 'trash' ? t('Elementi eliminati') : t('La tua raccolta')}{' '}
                    <span className="counter">{filtered.length}</span>
                  </h2>
                  <div className="toolbar">
                    {page === 'trash' && (
                      <button
                        className="secondary danger-soft"
                        disabled={!vault.items.some((i) => i.trashed)}
                        title={t('Elimina definitivamente tutti gli elementi nel cestino')}
                        onClick={() => void emptyTrash()}
                      >
                        <Trash2 size={16} />
                        {t('Svuota cestino')}
                      </button>
                    )}
                    <div className="search-box">
                      <Search size={17} />
                      <input
                        id="vault-search"
                        placeholder={t('Cerca nel vault...')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    {filtered.length > 0 && (
                      <button
                        className="secondary"
                        onClick={() =>
                          setMulti(
                            filtered.every((i) => multi.includes(i.id))
                              ? []
                              : filtered.map((i) => i.id),
                          )
                        }
                      >
                        <CheckSquare size={16} />
                        {filtered.every((i) => multi.includes(i.id))
                          ? t('Deseleziona tutti')
                          : t('Seleziona tutti')}
                      </button>
                    )}
                    <button className="secondary" onClick={openNewItem}>
                      <Plus size={17} />
                    </button>
                  </div>
                </div>
                {multi.length > 0 && (
                  <div className="bulkbar">
                    <strong>{t('Selezionati: {n}', { n: multi.length })}</strong>
                    <div className="bulkbar-actions">
                      {page === 'trash' ? (
                        <>
                          <button
                            className="secondary"
                            onClick={() =>
                              void mutate('bulk', { ids: multi, op: 'restore' }).then(() =>
                                setMulti([]),
                              )
                            }
                          >
                            <RefreshCw size={16} />
                            {t('Ripristina')}
                          </button>
                          <button
                            className="secondary danger-soft"
                            onClick={async () => {
                              if (
                                await askConfirm(
                                  t('Eliminare definitivamente gli elementi selezionati?') +
                                    '\n\n' +
                                    t(
                                      'Verranno eliminate anche le loro password nell’Archivio password.',
                                    ),
                                  {
                                    title: t('Eliminazione definitiva'),
                                    danger: true,
                                    confirmLabel: t('Elimina definitivamente'),
                                  },
                                )
                              )
                                await mutate('bulk', { ids: multi, op: 'delete' }).then(() =>
                                  setMulti([]),
                                );
                            }}
                          >
                            <Trash2 size={16} />
                            {t('Elimina')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="icon-button danger bulk-trash"
                            title={t('Sposta nel cestino')}
                            aria-label={t('Sposta nel cestino')}
                            onClick={async () => {
                              // Moving many items at once is confirmed with the count.
                              if (
                                multi.length > 1 &&
                                !(await askConfirm(
                                  t('Spostare nel cestino {n} elementi selezionati?', {
                                    n: multi.length,
                                  }),
                                  { title: t('Nel cestino'), confirmLabel: t('Nel cestino') },
                                ))
                              )
                                return;
                              await mutate('bulk', { ids: multi, op: 'trash' }).then(() =>
                                setMulti([]),
                              );
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                          <div className="bulk-move" ref={moveMenuRef}>
                            <button
                              className="secondary"
                              aria-haspopup="menu"
                              aria-expanded={moveOpen}
                              onClick={() => setMoveOpen((o) => !o)}
                            >
                              <Folder size={16} />
                              {t('Sposta in')}
                              <ChevronDown size={15} />
                            </button>
                            {moveOpen && (
                              <div className="bulk-move-menu" role="menu">
                                {vault.folders.map((f) => (
                                  <button
                                    key={f.id}
                                    role="menuitem"
                                    onClick={() => void moveSelected(f.id)}
                                  >
                                    <Folder size={15} />
                                    <span>{f.name}</span>
                                  </button>
                                ))}
                                {!vault.folders.length && (
                                  <p className="bulk-move-empty">{t('Nessuna cartella')}</p>
                                )}
                                <button
                                  role="menuitem"
                                  className="bulk-move-new"
                                  onClick={() => void moveToNewFolder()}
                                >
                                  <FolderPlus size={15} />
                                  <span>{t('Nuova cartella…')}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      <button className="secondary" onClick={() => setMulti([])}>
                        {t('Annulla')}
                      </button>
                    </div>
                  </div>
                )}
                {(page === 'all' || page === 'login') && (
                  <AccountGroups
                    items={filtered.filter((i) => i.type === 'login')}
                    vault={vault}
                    openItem={openItem}
                    copy={copy}
                    reveal={reveal}
                    copySecret={copySecret}
                    onFavorite={(ids, on) => mutate('bulk', { ids, op: 'fav', fav: on })}
                    onDeleteAccount={deleteItem}
                    onDeleteGroup={deleteGroup}
                    selected={multi}
                    onSelect={(ids, on) =>
                      setMulti((x) =>
                        on ? [...new Set([...x, ...ids])] : x.filter((id) => !ids.includes(id)),
                      )
                    }
                  />
                )}
                <div className="items-list">
                  {filtered
                    .filter((it) => !((page === 'all' || page === 'login') && it.type === 'login'))
                    .map((it) => {
                      const Icon = icons[it.type];
                      return (
                        <div className="item-row" key={it.id}>
                          <input
                            aria-label={t('Seleziona')}
                            type="checkbox"
                            checked={multi.includes(it.id)}
                            onChange={(e) =>
                              setMulti((x) =>
                                e.target.checked ? [...x, it.id] : x.filter((id) => id !== it.id),
                              )
                            }
                          />
                          <div className={`item-avatar ${it.type}`}>
                            <Icon size={20} />
                          </div>
                          <button className="item-body" onClick={() => openItem(it)}>
                            <strong>{it.title}</strong>
                            <span>
                              {it.type === 'login'
                                ? it.f?.username || it.f?.url || t('Account')
                                : t(categories[it.type].label)}
                              {it.shared ? t(' · Condiviso') : ''}
                            </span>
                          </button>
                          <div className="item-date">{date(it.updated || it.created)}</div>
                          {page !== 'trash' && (
                            <button
                              className={`icon-button favorite ${it.fav ? 'on' : ''}`}
                              title={t('Preferito')}
                              onClick={() => void mutate('item', { id: it.id, fav: !it.fav })}
                            >
                              <Star size={18} fill={it.fav ? 'currentColor' : 'none'} />
                            </button>
                          )}
                          {page === 'trash' ? (
                            <>
                              <button
                                className="icon-button"
                                title={t('Ripristina')}
                                onClick={() => void mutate('trash', { id: it.id, restore: true })}
                              >
                                <RefreshCw size={18} />
                              </button>
                              <button
                                className="icon-button danger"
                                title={t('Elimina definitivamente')}
                                onClick={async () => {
                                  if (
                                    await askConfirm(
                                      t('Eliminare definitivamente questo elemento?') +
                                        '\n\n' +
                                        t(
                                          'Verranno eliminate anche le loro password nell’Archivio password.',
                                        ),
                                      {
                                        title: t('Eliminazione definitiva'),
                                        danger: true,
                                        confirmLabel: t('Elimina definitivamente'),
                                      },
                                    )
                                  )
                                    await mutate('delete', { id: it.id });
                                }}
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="icon-button danger"
                                title={'Elimina ' + it.title}
                                aria-label={'Elimina ' + it.title}
                                onClick={() => void deleteItem(it)}
                              >
                                <Trash2 size={18} />
                              </button>
                              <button className="icon-button" onClick={() => openItem(it)}>
                                <MoreHorizontal size={20} />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  {filtered.length === 0 && (
                    <div className="empty">
                      <div>
                        <Archive size={30} />
                      </div>
                      <h3>{t('Nessun elemento trovato')}</h3>
                      <p>{t('Prova a cambiare ricerca oppure aggiungi il tuo primo elemento.')}</p>
                      <button className="secondary" onClick={openNewItem}>
                        <Plus size={16} />
                        {t('Crea elemento')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
          {page === 'dashboard' && (
            <Dashboard
              vault={vault}
              breaches={breaches}
              recentIds={recentIds}
              openItem={openItem}
              selectPage={selectPage}
              focusSearch={() => {
                selectPage('all');
                window.setTimeout(() => document.getElementById('vault-search')?.focus(), 0);
              }}
              copy={copy}
              lock={() => void lock()}
              askConfirm={askConfirm}
              saveDashboard={saveDashboard}
            />
          )}
          {page === 'passwords' && (
            <PasswordPage
              askConfirm={askConfirm}
              showNotice={showNotice}
              vault={vault}
              mutate={mutate}
              showSecrets={showSecrets}
              setShowSecrets={setShowSecrets}
              reveal={reveal}
              copySecret={copySecret}
              openItem={openItem}
            />
          )}
          {page === 'generator' && <GeneratorPage copy={copy} run={run} mutate={mutate} />}
          {page === 'security' && (
            <SecurityPage
              askConfirm={askConfirm}
              vault={vault}
              run={run}
              openItem={openItem}
              breaches={breaches}
              setBreaches={setBreaches}
            />
          )}
          {page === 'groups' && (
            <>
              <div className="heading-row">
                <div>
                  <div className="eyebrow">{t('ORGANIZZAZIONE')}</div>
                  <h1>{t('Gruppi e applicazioni')}</h1>
                  <p>{t("Raggruppa gli account in base al sito o all'applicazione.")}</p>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h2>{t('Gruppi personalizzati')}</h2>
                </div>
                {Object.entries(vault.groups || {}).map(([key, g]) => (
                  <div className="item-row" key={key}>
                    <div className="item-avatar login">
                      {g.icon ? <img src={g.icon} alt="" /> : <Cloud size={19} />}
                    </div>
                    <div className="item-body static">
                      <strong>{g.name || key}</strong>
                      <span>
                        {key} ·{' '}
                        {t('{n} account', {
                          n: vault.items.filter((i) => !i.trashed && groupFor(i) === key).length,
                        })}
                      </span>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => {
                        setGroupDraft({ key, name: g.name, icon: g.icon });
                        setDialog('group');
                      }}
                    >
                      {t('Modifica')}
                    </button>
                    <button
                      className="icon-button"
                      title={t('Cerca logo online')}
                      onClick={() => void mutate('group_logo', { key }, t('Logo aggiornato'))}
                    >
                      <RefreshCw size={17} />
                    </button>
                  </div>
                ))}
                {!Object.keys(vault.groups || {}).length && (
                  <div className="empty">
                    <Cloud size={28} />
                    <h3>{t('Nessun gruppo presente')}</h3>
                    <p>{t("Puoi assegnare un gruppo nell'editor di un accesso.")}</p>
                  </div>
                )}
              </div>
            </>
          )}
          {page === 'settings' && (
            <SettingsPage
              askConfirm={askConfirm}
              showNotice={showNotice}
              askText={askText}
              vault={vault}
              mutate={mutate}
              run={run}
              setDialog={setDialog}
              exportData={exportData}
              importData={importData}
              selectPage={selectPage}
            />
          )}
        </div>
      </main>
      {toast && (
        <div className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
      {error && (
        <div className="error-toast">
          <ShieldAlert size={18} />
          <span>{error}</span>
          <button className="icon-button" onClick={() => setError('')}>
            <X size={17} />
          </button>
        </div>
      )}
      {dialog && (
        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && dialog !== 'recover') setDialog(null);
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <h2>
                {t(
                  (
                    {
                      item: draft.id ? msg('Modifica elemento') : msg('Nuovo elemento'),
                      folder: msg('Cartella'),
                      share: msg('Condivisione cifrata'),
                      import: msg('Importa pacchetto cifrato'),
                      preview: msg('Importa dati nel vault'),
                      recover: msg('Codice di recupero'),
                      master: msg('Cambia password principale'),
                      recovery_new: msg('Nuovo codice di recupero'),
                      group: msg('Modifica gruppo'),
                    } as Record<Exclude<Dialog, null>, string>
                  )[dialog],
                )}
              </h2>
              {dialog !== 'recover' && (
                <button
                  className="icon-button"
                  onClick={() => setDialog(null)}
                  aria-label={t('Chiudi')}
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <div className="modal-content">
              {dialog === 'item' && (
                <>
                  <label className="field">
                    <span>{t('Categoria')}</span>
                    <select
                      value={draft.type}
                      // A WebAuthn passkey keeps its private key in f.webauthn (never sent
                      // to this window): changing the category would discard it.
                      disabled={!!draft.has?.includes('webauthn')}
                      title={
                        draft.has?.includes('webauthn')
                          ? t('Passkey WebAuthn: categoria non modificabile')
                          : undefined
                      }
                      onChange={(e) =>
                        setDraft((x) => ({ ...x, type: e.target.value as Category, f: {} }))
                      }
                    >
                      {Object.entries(categories).map(([k, c]) => (
                        <option key={k} value={k}>
                          {t(c.label)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label={t('Titolo')}
                    value={draft.title}
                    onChange={(v) => setDraft((x) => ({ ...x, title: v }))}
                    placeholder={t('es. Account principale')}
                  />
                  <label className="field">
                    <span>{t('Cartella')}</span>
                    <select
                      value={draft.folder || ''}
                      onChange={(e) => setDraft((x) => ({ ...x, folder: e.target.value || null }))}
                    >
                      <option value="">{t('Nessuna cartella')}</option>
                      {vault.folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {categories[draft.type].fields.map((k) => (
                    <div className="field-with-copy" key={k}>
                      <Field
                        label={t(labels[k] || k)}
                        secret={['password', 'pin', 'cvv', 'seed', 'credential', 'number'].includes(
                          k,
                        )}
                        value={draft.f?.[k] || ''}
                        onChange={(v) => setDraft((x) => ({ ...x, f: { ...x.f, [k]: v } }))}
                      />
                      {draft.f?.[k] && (
                        <button
                          className="icon-button"
                          title={t('Copia')}
                          onClick={() => copy(draft.f[k])}
                        >
                          <Copy size={17} />
                        </button>
                      )}
                    </div>
                  ))}
                  {draft.type === 'login' && (
                    <>
                      <label className="field">
                        <span>{t('Tipo di account')}</span>
                        <select
                          value={
                            draft.src ||
                            (draft.gk?.startsWith('app:')
                              ? 'app'
                              : draft.gk?.startsWith('other:')
                                ? 'other'
                                : 'web')
                          }
                          onChange={(e) => {
                            const src = e.target.value;
                            setDraft((x) => ({ ...x, src, gk: '' }));
                            setGroupIcon('');
                          }}
                        >
                          <option value="web">{t('Sito web / Email')}</option>
                          <option value="app">{t('Applicazione')}</option>
                          <option value="other">{t('Altro')}</option>
                        </select>
                      </label>
                      {(draft.src || 'web') === 'web' && (
                        <p className="helper">
                          {t(
                            "Inserisci l'URL del sito o un indirizzo email: gli accessi allo stesso dominio verranno raggruppati e sarà cercato il logo del sito, se attivato nelle impostazioni.",
                          )}
                        </p>
                      )}
                      {(draft.src || 'web') === 'app' && (
                        <p className="helper">
                          {t(
                            "Seleziona un'app installata oppure inserisci il suo nome come titolo dell'account. Puoi assegnare un logo dal PC.",
                          )}
                        </p>
                      )}
                      {(draft.src || 'web') === 'other' && (
                        <p className="helper">
                          {t(
                            "Gli account con lo stesso titolo saranno raccolti in un gruppo. Scegli un'immagine dal PC come logo.",
                          )}
                        </p>
                      )}
                      {(draft.src || 'web') !== 'web' && (
                        <button
                          className="secondary"
                          type="button"
                          onClick={async () => {
                            try {
                              const icon = await pickIconData();
                              if (icon) {
                                setGroupIcon(icon);
                                setError('');
                              }
                            } catch (e) {
                              setError(translateMessage(formatError(e)));
                            }
                          }}
                        >
                          <Upload size={16} />
                          {t('Seleziona logo dal PC')}
                        </button>
                      )}
                      {groupIcon && (
                        <div className="chosen-group-icon">
                          <GroupLogo
                            icon={groupIcon}
                            groupKey={draft.gk || ''}
                            name={draft.title}
                          />
                          <span>{t('Logo selezionato, verrà salvato nel vault cifrato')}</span>
                        </div>
                      )}
                      <div className="helper">
                        {t('Gruppo associato:')} {savedGroupKey(draft)}
                      </div>
                      {(draft.src || 'web') === 'app' && (
                        <button
                          className="secondary"
                          onClick={async () => {
                            const r = await run<{ apps: { name: string; path: string }[] }>('apps');
                            if (r) {
                              setAppsQuery('');
                              setAppsList(r.apps);
                            }
                          }}
                        >
                          <Folder size={16} />
                          {t('Associa applicazione installata')}
                        </button>
                      )}
                      {appsList && (
                        <div className="apps-picker">
                          <div className="apps-picker-top">
                            <input
                              autoFocus
                              className="apps-picker-search"
                              aria-label={t('Cerca applicazione')}
                              placeholder={t('Cerca applicazione…')}
                              value={appsQuery}
                              onChange={(e) => setAppsQuery(e.target.value)}
                            />
                            <button
                              type="button"
                              className="secondary"
                              title={t('Scegli il file .exe o il collegamento dell’applicazione')}
                              onClick={async () => {
                                const path = await picker('app');
                                if (!path) return;
                                const r = await run<{ name: string; icon: string }>('app_info', {
                                  path,
                                });
                                if (!r) return;
                                setGroupIcon(r.icon || '');
                                setDraft((x) => ({
                                  ...x,
                                  gk: 'app:' + r.name.toLowerCase().trim().replace(/\s+/g, '-'),
                                  src: 'app',
                                  title: x.title || r.name,
                                }));
                                setAppsList(null);
                              }}
                            >
                              <Folder size={15} />
                              {t('Sfoglia…')}
                            </button>
                          </div>
                          <p className="apps-picker-hint">
                            {t(
                              'Elenco delle applicazioni del menu Start. Se manca, scegli il suo file con «Sfoglia…».',
                            )}
                          </p>
                          <div className="apps-picker-list" role="listbox">
                            {appsList.length ? (
                              appsList
                                .filter((a) =>
                                  a.name
                                    .toLocaleLowerCase()
                                    .includes(appsQuery.trim().toLocaleLowerCase()),
                                )
                                .slice(0, 300)
                                .map((a) => (
                                  <button
                                    key={a.path}
                                    onClick={async () => {
                                      const r = await run<{ icon: string }>('app_icon', {
                                        path: a.path,
                                      });
                                      setGroupIcon(r?.icon || '');
                                      setDraft((x) => ({
                                        ...x,
                                        gk:
                                          'app:' + a.name.toLowerCase().trim().replace(/\s+/g, '-'),
                                        src: 'app',
                                        title: x.title || a.name,
                                      }));
                                      setAppsList(null);
                                    }}
                                    title={a.name}
                                    role="option"
                                    aria-selected={false}
                                  >
                                    <span>{a.name}</span>
                                  </button>
                                ))
                            ) : (
                              <span>{t('Nessuna applicazione individuata')}</span>
                            )}
                          </div>
                        </div>
                      )}
                      {draft.f.totp && (
                        <button
                          className="secondary"
                          onClick={async () => {
                            const r = await run<{ code: string; left: number }>('totp', {
                              id: draft.id,
                            });
                            if (r)
                              notify(
                                t('Codice TOTP: {code} · {left}s', { code: r.code, left: r.left }),
                              );
                          }}
                        >
                          {t('Genera codice TOTP')}
                        </button>
                      )}
                    </>
                  )}
                  <Field
                    label={t('Note')}
                    value={draft.notes || ''}
                    onChange={(v) => setDraft((x) => ({ ...x, notes: v }))}
                    textarea
                  />
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={!!draft.fav}
                      onChange={(e) => setDraft((x) => ({ ...x, fav: e.target.checked }))}
                    />
                    {t('Aggiungi ai preferiti')}
                  </label>
                </>
              )}
              {dialog === 'folder' && (
                <Field
                  label={t('Nome cartella')}
                  value={folderDraft.name}
                  onChange={(v) => setFolderDraft((x) => ({ ...x, name: v }))}
                />
              )}
              {dialog === 'group' && (
                <>
                  <Field
                    label={t('Nome gruppo')}
                    value={groupDraft.name}
                    onChange={(v) => setGroupDraft((x) => ({ ...x, name: v }))}
                  />
                  <div className="chosen-group-icon">
                    <GroupLogo
                      icon={groupDraft.icon}
                      groupKey={groupDraft.key}
                      name={groupDraft.name}
                    />
                    <button
                      className="secondary"
                      onClick={async () => {
                        try {
                          const icon = await pickIconData();
                          if (icon) setGroupDraft((x) => ({ ...x, icon }));
                        } catch (e) {
                          setError(translateMessage(formatError(e)));
                        }
                      }}
                    >
                      {t('Scegli immagine')}
                    </button>
                  </div>
                </>
              )}
              {dialog === 'share' && (
                <Field
                  label={t('Passphrase di condivisione (minimo 8 caratteri)')}
                  value={sharePass}
                  onChange={setSharePass}
                  secret
                />
              )}
              {dialog === 'preview' && importPreview && (
                <div className="import-preview">
                  <p>
                    {tRich('Formato riconosciuto: {source}', {
                      source: <strong>{importPreview.source}</strong>,
                    })}
                  </p>
                  <p className={importPreview.count ? '' : 'import-preview-empty'}>
                    {importPreview.count
                      ? t('Elementi da importare: {n}', { n: importPreview.count })
                      : t(
                          'Nessun elemento riconosciuto: scegli a quale campo corrisponde ogni colonna.',
                        )}
                  </p>
                  {importPreview.columns && (
                    <div className="import-columns" role="table">
                      <div className="import-column head" role="row">
                        <span>{t('Colonna del file')}</span>
                        <span>{t('Esempio')}</span>
                        <span>{t('Campo in Jesse’s Archive')}</span>
                      </div>
                      {importPreview.columns.map((c) => (
                        <div className="import-column" role="row" key={c.header}>
                          <strong title={c.header}>{c.header}</strong>
                          <span title={c.sample}>{c.sample || '—'}</span>
                          <select
                            aria-label={t('Campo per la colonna {name}', { name: c.header })}
                            value={c.target}
                            disabled={busy}
                            onChange={(e) => void remapColumn(c.header, e.target.value)}
                          >
                            {IMPORT_TARGETS.map(([value, label]) => (
                              <option key={value} value={value}>
                                {t(label)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="helper">
                    {t('Prima della scrittura viene creato un backup del vault.')}
                  </p>
                </div>
              )}
              {dialog === 'import' && (
                <>
                  <p>
                    {t(
                      'Il contenuto verrà decifrato e unito al tuo vault. Usa la passphrase che ha protetto il file.',
                    )}
                  </p>
                  <Field label={t('Passphrase')} value={sharePass} onChange={setSharePass} secret />
                </>
              )}
              {dialog === 'master' && (
                <>
                  <Field
                    label={t('Password principale attuale')}
                    value={password}
                    onChange={setPassword}
                    secret
                  />
                  <Field
                    label={t('Nuova password principale')}
                    value={recoveryNew}
                    onChange={setRecoveryNew}
                    secret
                  />
                  <label className="check-line rotate-key">
                    <input
                      type="checkbox"
                      checked={rotateKey}
                      onChange={(e) => setRotateKey(e.target.checked)}
                    />
                    <span>
                      <strong>{t('La vecchia password potrebbe essere stata scoperta')}</strong>
                      <small>
                        {t(
                          'Cambia anche la chiave che cifra i dati: la vecchia password non aprirà più il vault nemmeno da una sua copia. Riceverai un nuovo codice di recupero da salvare. Se usi il vault su altri PC, aggiornali a questa versione: quelli aperti si bloccheranno e chiederanno la nuova password.',
                        )}
                      </small>
                    </span>
                  </label>
                </>
              )}
              {dialog === 'recovery_new' && (
                <>
                  <p className="helper">
                    {t(
                      'Il vecchio codice di recupero smetterà di funzionare: anche la chiave che cifra i dati viene cambiata.',
                    )}
                  </p>
                  <Field
                    label={t('Conferma password principale')}
                    value={password}
                    onChange={setPassword}
                    secret
                  />
                </>
              )}
              {dialog === 'recover' && (
                <div className="recovery-panel">
                  <p>{t('Conserva questo codice offline. Non sarà più visualizzato.')}</p>
                  <code>{viewRecovery}</code>
                  <button className="secondary" onClick={() => copy(viewRecovery)}>
                    <Copy size={16} /> {t('Copia')}
                  </button>
                </div>
              )}
            </div>
            <div className="modal-foot">
              {dialog !== 'recover' && (
                <button className="secondary" onClick={() => setDialog(null)}>
                  {t('Annulla')}
                </button>
              )}
              <button
                className="primary"
                disabled={busy || (dialog === 'preview' && !importPreview?.count)}
                onClick={async () => {
                  if (dialog === 'preview' && importPreview) {
                    const r = await run<{ state: State; count: number }>('import', {
                      text: importPreview.text,
                      mapping: importPreview.mapping,
                    });
                    if (r) {
                      setVault(r.state);
                      // Items already in the vault with the same data are not imported again.
                      notify(
                        r.count
                          ? t('Elementi importati: {n}', { n: r.count })
                          : t('Nessun elemento importato: quelli del file sono già nel vault.'),
                      );
                      setDialog(null);
                      setImportPreview(null);
                    }
                    return;
                  }
                  if (dialog === 'recover') {
                    setViewRecovery('');
                    setDialog(null);
                    notify(t('Codice di recupero confermato'));
                    return;
                  }
                  let r;
                  if (dialog === 'item') {
                    await saveItem();
                    return;
                  }
                  if (dialog === 'folder')
                    r = await mutate('folder', folderDraft, t('Cartella salvata'));
                  if (dialog === 'group')
                    r = await mutate('group_edit', groupDraft, t('Gruppo aggiornato'));
                  if (dialog === 'master') {
                    r = await run<{ recovery?: string }>('master', {
                      old: password,
                      new: recoveryNew,
                      rotate: rotateKey,
                    });
                    if (r) {
                      setPassword('');
                      setRecoveryNew('');
                      setRotateKey(false);
                      notify(t('Password principale aggiornata'));
                      // New data key: the new recovery code must be saved now.
                      if (r.recovery) {
                        setViewRecovery(r.recovery);
                        setDialog('recover');
                        return;
                      }
                    }
                  }
                  if (dialog === 'recovery_new') {
                    r = await run<{ recovery: string }>('recovery_new', { password });
                    if (r) {
                      setPassword('');
                      setViewRecovery(r.recovery);
                      setDialog('recover');
                      return;
                    }
                  }
                  if (dialog === 'share') {
                    r = await run<{ data: string }>('pack', {
                      passphrase: sharePass,
                      ids: multi.length ? multi : undefined,
                    });
                    if (r) {
                      await saveFile('jesse-archive-share.jshare', r.data);
                      notify(t('Pacchetto cifrato creato'));
                    }
                  }
                  if (dialog === 'import') {
                    r = await mutate(
                      'unpack',
                      { passphrase: sharePass, data: shareImport },
                      t('Pacchetto importato'),
                    );
                  }
                  if (r) {
                    setDialog(null);
                    setSharePass('');
                    setMulti([]);
                  }
                }}
              >
                <Check size={17} />
                {dialog === 'recover'
                  ? t('Ho salvato il codice')
                  : dialog === 'preview'
                    ? t('Importa')
                    : dialog === 'share'
                      ? t('Esporta pacchetto')
                      : t('Conferma')}
              </button>
            </div>
          </div>
        </div>
      )}
      {decision && (
        // Keyed so a follow-up confirmation remounts and refocuses "Annulla".
        <DecisionModal
          key={decision.title + decision.message}
          decision={decision}
          resolve={resolveDecision}
        />
      )}
      {newsOpen && <NewsPanel onClose={() => setNewsOpen(false)} />}
      <UpdateProgress />
    </div>
  );
}
function Nav({
  icon: Icon,
  title,
  active,
  onClick,
  count,
  onContextMenu,
}: {
  icon: typeof LayoutGrid;
  title: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <Icon size={18} />
      <span>{title}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
    </button>
  );
}
function Stat({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof KeyRound;
  title: string;
  value: number;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        <Icon size={19} />
      </div>
      <div className="stat-copy">
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function PasswordPage({
  askConfirm,
  showNotice,
  vault,
  mutate,
  showSecrets,
  setShowSecrets,
  reveal,
  copySecret,
  openItem,
}: {
  askConfirm: DialogAPI['askConfirm'];
  showNotice: DialogAPI['showNotice'];
  vault: State;
  mutate: (n: string, b?: Dict, m?: string) => Promise<unknown>;
  showSecrets: Record<string, string>;
  setShowSecrets: Dispatch<SetStateAction<Record<string, string>>>;
  reveal: (id: string, field: string) => Promise<string | undefined>;
  copySecret: (id: string, field: string) => Promise<void>;
  openItem: (it?: Item, type?: Category) => void;
}) {
  const [filter, setFilter] = useState('');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [linkPid, setLinkPid] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');
  const [linking, setLinking] = useState(false);
  const list = vault.passwords.filter((p) =>
    [p.item_title, p.label, p.source].some((v) => v?.toLowerCase().includes(filter.toLowerCase())),
  );
  // The current password of an account is changed in the account, so it can't be
  // selected for deletion here.
  const deletable = list.filter((p) => !(p.active && p.item_id));
  const allSelected = deletable.length > 0 && deletable.every((p) => selected.includes(p.id));
  const eligible = vault.items.filter((i) => !i.trashed && i.type === 'login');
  const source = linkPid ? vault.passwords.find((p) => p.id === linkPid) : undefined;
  const target = vault.items.find((i) => i.id === targetId);
  const closeLink = () => {
    if (!linking) {
      setLinkPid(null);
      setTargetId('');
    }
  };
  const beginLink = async (pid: string) => {
    if (!eligible.length) {
      await showNotice(
        t(
          'Non hai ancora creato un Account. Crea un Account prima di assegnargli una password dello storico.',
        ),
        t('Nessun account disponibile'),
      );
      return;
    }
    setTargetId('');
    setLinkPid(pid);
  };
  const applyLink = async () => {
    if (!source || !target || linking) return;
    setLinking(true);
    try {
      const confirmed = await askConfirm(
        t(
          "Impostare la password selezionata come password attuale di «{name}»? Questa operazione modifica la credenziale salvata in JesseArchive, NON la password sul sito o nell'app. La precedente password rimarrà nello storico.",
          { name: target.title },
        ),
        { title: t('Sostituire la password dell’account?'), confirmLabel: t('Imposta password') },
      );
      if (!confirmed) return;
      const result = await mutate(
        'pw_link',
        { pid: source.id, item_id: target.id },
        t('Password attiva aggiornata'),
      );
      if (result) {
        setLinkPid(null);
        setTargetId('');
      }
    } finally {
      setLinking(false);
    }
  };
  return (
    <>
      <div className="heading-row">
        <div>
          <div className="eyebrow">{t('PASSWORD HISTORY')}</div>
          <h1>{t('Archivio password')}</h1>
          <p>
            {t(
              'Qui trovi le password attuali, quelle precedenti e quelle salvate manualmente. Se vuoi riutilizzarne una in un account, premi «Usa per account» accanto alla password.',
            )}
          </p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>
            {t('Le tue password')} <span className="counter">{list.length}</span>
          </h2>
          {selected.length > 0 && (
            <button
              className="secondary"
              onClick={async () => {
                if (
                  await askConfirm(
                    t('Eliminare le password non attive selezionate ({n})?', {
                      n: selected.length,
                    }),
                    {
                      title: t('Elimina password dallo storico'),
                      danger: true,
                      confirmLabel: t('Elimina selezionate'),
                    },
                  )
                ) {
                  const r = await mutate(
                    'pw_bulk',
                    { pids: selected },
                    t('Password eliminate: {n}', { n: selected.length }),
                  );
                  if (r) setSelected([]);
                }
              }}
            >
              <Trash2 size={16} />
              {t('Elimina selezionate ({n})', { n: selected.length })}
            </button>
          )}
          {deletable.length > 0 && (
            <button
              className="secondary"
              title={t(
                'Le password attuali degli account non si selezionano: si cambiano nell’account.',
              )}
              onClick={() =>
                setSelected(
                  allSelected
                    ? selected.filter((id) => !deletable.some((p) => p.id === id))
                    : [...new Set([...selected, ...deletable.map((p) => p.id)])],
                )
              }
            >
              <CheckSquare size={16} />
              {allSelected ? t('Deseleziona tutti') : t('Seleziona tutti')}
            </button>
          )}
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder={t('Cerca...')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="inline-form">
          <input
            placeholder={t('Nuova password da salvare')}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <input
            placeholder={t('Etichetta (facoltativa)')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button
            className="primary"
            onClick={async () => {
              if (value) {
                const r = await mutate('pw_save', { value, label, source: 'manual' });
                if (r) {
                  setValue('');
                  setLabel('');
                }
              }
            }}
          >
            {t('Salva')}
          </button>
        </div>
        {list.map((p: Password) => (
          <div className="item-row" key={p.id}>
            <input
              type="checkbox"
              aria-label={t('Seleziona password')}
              disabled={!!(p.active && p.item_id)}
              title={
                p.active && p.item_id
                  ? t(
                      'Le password attuali degli account non si selezionano: si cambiano nell’account.',
                    )
                  : undefined
              }
              checked={selected.includes(p.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id),
                )
              }
            />
            <div className="item-avatar login">
              <KeyRound size={18} />
            </div>
            <div className="item-body static">
              <strong>{p.item_title || p.label || t('Password salvata')}</strong>
              <span>
                {p.active
                  ? t('Password attuale')
                  : p.item_id
                    ? t('Password precedente')
                    : t('Password non collegata')}{' '}
                · {date(p.created)}
              </span>
            </div>
            <code className="password-value">{showSecrets[p.id] ?? '••••••••••••'}</code>
            <button
              title={t('Mostra/Nascondi')}
              aria-label={t('Mostra o nascondi password')}
              className="icon-button"
              onClick={async () => {
                if (showSecrets[p.id] !== undefined) {
                  setShowSecrets(({ [p.id]: _, ...rest }) => rest);
                  return;
                }
                const value = await reveal(p.id, 'history');
                if (value !== undefined) setShowSecrets((x) => ({ ...x, [p.id]: value }));
              }}
            >
              {showSecrets[p.id] !== undefined ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
            <button
              title={t('Copia')}
              className="icon-button"
              onClick={() => void copySecret(p.id, 'history')}
            >
              <Copy size={17} />
            </button>
            {p.item_id ? (
              <button
                className="icon-button"
                title={t('Apri elemento')}
                onClick={() => openItem(vault.items.find((i) => i.id === p.item_id))}
              >
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                className="icon-button danger"
                title={t('Elimina')}
                onClick={async () => {
                  if (
                    await askConfirm(t('Eliminare questa password?'), {
                      title: t('Elimina password'),
                      danger: true,
                      confirmLabel: t('Elimina password'),
                    })
                  )
                    await mutate('pw_del', { pid: p.id });
                }}
              >
                <Trash2 size={17} />
              </button>
            )}
            {!p.active && (
              <button
                className="secondary password-assign"
                title={t('Scegli l’account in cui usare questa password')}
                onClick={() => void beginLink(p.id)}
              >
                <ArrowRight size={15} />
                {t('Usa per account')}
              </button>
            )}
          </div>
        ))}
        {!list.length && <div className="empty">{t('Nessuna password in archivio.')}</div>}
        <div className="password-help">
          <ShieldCheck size={17} />
          <span>
            {t(
              "Questa funzione modifica soltanto la password salvata nel vault: non cambia la password sul sito web o nell'applicazione esterna.",
            )}
          </span>
        </div>
      </div>
      {source && (
        <div className="overlay" role="presentation">
          <section
            className="modal password-link-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-link-title"
            aria-describedby="password-link-description"
          >
            <div className="modal-head">
              <h2 id="password-link-title">{t('Usa una password dello storico')}</h2>
              <button
                className="icon-button"
                aria-label={t('Chiudi')}
                onClick={closeLink}
                disabled={linking}
              >
                <X size={19} />
              </button>
            </div>
            <div className="modal-content">
              <p id="password-link-description">
                {t(
                  "Scegli l'account del vault in cui vuoi impostare questa password. La password attuale di quell'account verrà sostituita, ma resterà nello storico.",
                )}
              </p>
              <div className="password-link-source">
                <KeyRound size={18} />
                <div>
                  <strong>{t('Password selezionata')}</strong>
                  <small>
                    {source.item_title || source.label || t('Password salvata')} ·{' '}
                    {date(source.created)}
                  </small>
                </div>
              </div>
              <label className="field">
                <span>{t('Account da aggiornare')}</span>
                <select autoFocus value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">{t('Seleziona un account...')}</option>
                  {eligible.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                      {i.f?.username ? ' — ' + i.f.username : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="password-link-warning">
                <ShieldAlert size={18} />
                <span>
                  {t(
                    'Attenzione: JesseArchive aggiornerà soltanto la credenziale locale. Se la password del sito è diversa, dovrai aggiornarla anche sul sito.',
                  )}
                </span>
              </div>
            </div>
            <div className="modal-foot">
              <button className="secondary" disabled={linking} onClick={closeLink}>
                {t('Annulla')}
              </button>
              <button
                className="primary"
                disabled={!targetId || linking}
                onClick={() => void applyLink()}
              >
                {linking ? t('Aggiornamento...') : t('Continua')}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function GeneratorPage({
  copy,
  run,
  mutate,
}: {
  copy: (v: string) => Promise<void>;
  run: <T>(name: string, body?: Dict) => Promise<T | undefined>;
  mutate: (n: string, b?: Dict, m?: string) => Promise<unknown>;
}) {
  const [mode, setMode] = useState('password'),
    [length, setLength] = useState(20),
    [count, setCount] = useState(5),
    [words, setWords] = useState(4),
    [symset, setSymset] = useState('!@#$%^&*'),
    [flags, setFlags] = useState({
      lower: true,
      upper: true,
      digits: true,
      symbols: true,
      ambiguous: true,
      unique: false,
      start_letter: false,
      cap: true,
      add_number: true,
    }),
    [results, setResults] = useState<{ value: string; bits: number }[]>([]);
  const generate = async () => {
    const r = await run<{ results: { value: string; bits: number }[] }>('generate', {
      mode,
      length,
      pin_len: length,
      count,
      words,
      symset,
      ...flags,
    });
    if (r) setResults(r.results);
  };
  return (
    <>
      <div className="heading-row">
        <div>
          <div className="eyebrow">{t('CRYPTOGRAPHIC GENERATOR')}</div>
          <h1>{t('Generatore sicuro')}</h1>
          <p>{t('Password, passphrase, PIN e username casuali.')}</p>
        </div>
        <button className="primary generator-generate-button" onClick={generate}>
          <Shuffle size={21} />
          {t('Genera')}
        </button>
      </div>
      <div className="two-cols">
        <section className="panel settings-panel">
          <div className="panel-head">
            <h2>{t('Opzioni')}</h2>
          </div>
          <div className="form-stack">
            <label className="field">
              <span>{t('Modalità')}</span>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="password">{t('Password')}</option>
                <option value="passphrase">{t('Passphrase')}</option>
                <option value="pin">{t('PIN')}</option>
                <option value="username">{t('Username')}</option>
              </select>
            </label>
            {['password', 'pin'].includes(mode) && (
              <label className="field">
                <span>
                  {t('Lunghezza')} {length}
                </span>
                <input
                  type="range"
                  min={4}
                  max={mode === 'pin' ? 16 : 64}
                  value={length}
                  onChange={(e) => setLength(+e.target.value)}
                />
              </label>
            )}
            {mode === 'passphrase' && (
              <label className="field">
                <span>{t('Numero di parole')}</span>
                <input
                  type="number"
                  value={words}
                  min={2}
                  max={12}
                  onChange={(e) => setWords(+e.target.value)}
                />
              </label>
            )}
            <label className="field">
              <span>{t('Numero risultati')}</span>
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(+e.target.value)}
              />
            </label>
            {mode === 'password' && (
              <>
                <Field label={t('Simboli utilizzabili')} value={symset} onChange={setSymset} />
                {(
                  [
                    'lower',
                    'upper',
                    'digits',
                    'symbols',
                    'ambiguous',
                    'unique',
                    'start_letter',
                  ] as const
                ).map((k) => (
                  <label className="check-line" key={k}>
                    <input
                      type="checkbox"
                      checked={flags[k]}
                      onChange={(e) => setFlags((f) => ({ ...f, [k]: e.target.checked }))}
                    />
                    {t(
                      {
                        lower: msg('Minuscole'),
                        upper: msg('Maiuscole'),
                        digits: msg('Numeri'),
                        symbols: msg('Simboli'),
                        ambiguous: msg('Escludi caratteri ambigui'),
                        unique: msg('Caratteri unici'),
                        start_letter: msg('Inizia con una lettera'),
                      }[k],
                    )}
                  </label>
                ))}
              </>
            )}
            {mode === 'passphrase' &&
              (['cap', 'add_number'] as const).map((k) => (
                <label key={k} className="check-line">
                  <input
                    type="checkbox"
                    checked={flags[k]}
                    onChange={(e) => setFlags((f) => ({ ...f, [k]: e.target.checked }))}
                  />
                  {k === 'cap' ? t('Iniziali maiuscole') : t('Aggiungi numero')}
                </label>
              ))}
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-head">
            <h2>{t('Risultati')}</h2>
          </div>
          {results.length ? (
            results.map((r, i) => (
              <div className="generated-row" key={i}>
                <div>
                  <code>{r.value}</code>
                  <small>
                    {r.bits} {t('bit stimati')}
                  </small>
                </div>
                <div className="inline-actions">
                  <button title={t('Copia')} className="icon-button" onClick={() => copy(r.value)}>
                    <Copy size={17} />
                  </button>
                  <button
                    title={t('Salva nello storico')}
                    className="icon-button"
                    onClick={() => void mutate('pw_save', { value: r.value, source: 'generated' })}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">
              <Zap size={25} />
              <h3>{t('Pronto a generare')}</h3>
              <p>{t('Configura le opzioni e crea le nuove credenziali.')}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
function SecurityPage({
  askConfirm,
  vault,
  run,
  openItem,
  breaches,
  setBreaches,
}: {
  askConfirm: DialogAPI['askConfirm'];
  vault: State;
  run: <T>(name: string, body?: Dict) => Promise<T | undefined>;
  openItem: (it?: Item, type?: Category) => void;
  breaches: BreachResult[] | null;
  setBreaches: (b: BreachResult[] | null) => void;
}) {
  const [health, setHealth] = useState<{
    weak: { item_id: string; title: string; bits: number }[];
    reused: { item_id: string; title: string }[][];
    old: { item_id: string; title: string }[];
    total: number;
    score: number;
  } | null>(null);
  useEffect(() => {
    void run<typeof health>('health').then((r) => {
      if (r) setHealth(r);
    });
  }, [vault.items.length]);
  return (
    <>
      <div className="heading-row">
        <div>
          <div className="eyebrow">{t('VAULT HEALTH')}</div>
          <h1>{t('Centro sicurezza')}</h1>
          <p>{t('Analizza password deboli, riutilizzate e datate.')}</p>
        </div>
        <button
          className="secondary"
          onClick={() =>
            void run<typeof health>('health').then((r) => {
              if (r) setHealth(r);
            })
          }
        >
          <RefreshCw size={17} />
          {t('Ricalcola')}
        </button>
      </div>
      <div className="stats-grid">
        <Stat icon={ShieldCheck} title={t('Punteggio')} value={health?.score ?? 0} />
        <Stat icon={KeyRound} title={t('Attive')} value={health?.total ?? 0} />
        <Stat icon={ShieldAlert} title={t('Deboli')} value={health?.weak.length ?? 0} />
        <Stat icon={RefreshCw} title={t('Da aggiornare')} value={health?.old.length ?? 0} />
      </div>
      <div className="two-cols">
        <section className="panel settings-panel">
          <div className="panel-head">
            <h2>{t('Rischi rilevati')}</h2>
          </div>
          {health && (
            <div className="security-stack">
              <Risk
                title={t('Password deboli')}
                items={health.weak}
                vault={vault}
                openItem={openItem}
              />
              <Risk
                title={t('Password riutilizzate')}
                items={health.reused.flat()}
                vault={vault}
                openItem={openItem}
              />
              <Risk
                title={t('Password datate')}
                items={health.old}
                vault={vault}
                openItem={openItem}
              />
            </div>
          )}
        </section>
        <section className="panel settings-panel">
          <div className="panel-head">
            <h2>{t('Verifica violazioni')}</h2>
          </div>
          <div className="form-stack">
            <p>
              {t(
                "Controllo tramite Pwned Passwords: viene inviato solo un prefisso dell'hash SHA-1, non la password completa.",
              )}
            </p>
            <button
              className="secondary"
              onClick={async () => {
                if (
                  await askConfirm(
                    t(
                      'Controllare online le password attive? Verranno inviate soltanto le prime cinque cifre esadecimali dell’hash SHA-1 di ogni password.',
                    ),
                    { title: t('Verifica account compromessi'), confirmLabel: t('Avvia verifica') },
                  )
                ) {
                  const r = await run<{ results: typeof breaches }>('breach');
                  if (r) setBreaches(r.results);
                }
              }}
            >
              <Shield size={17} />
              {t('Verifica account compromessi')}
            </button>
            {breaches?.map((b, i) => (
              <div className="risk-row" key={i}>
                <strong>{b.title}</strong>
                <span className={b.count > 0 ? 'bad' : 'good'}>
                  {b.count > 0
                    ? t('Segnalazioni: {n}', { n: b.count })
                    : t('Nessuna corrispondenza')}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function Risk({
  title,
  items,
  vault,
  openItem,
}: {
  title: string;
  items: { item_id: string; title: string }[];
  vault: State;
  openItem: (it?: Item, type?: Category) => void;
}) {
  return (
    <div className="risk-group">
      <div>
        <strong>{title}</strong>
        <span className="counter">{items.length}</span>
      </div>
      {items.slice(0, 8).map((it, i) => (
        <button
          key={`${it.item_id}-${i}`}
          onClick={() => openItem(vault.items.find((x) => x.id === it.item_id))}
        >
          {it.title}
          <ArrowRight size={15} />
        </button>
      ))}
      {!items.length && <p className="good">{t('Nessun problema rilevato')}</p>}
    </div>
  );
}
function SettingsPage({
  askConfirm,
  showNotice,
  askText,
  vault,
  mutate,
  run,
  setDialog,
  exportData,
  importData,
  selectPage,
}: {
  askConfirm: DialogAPI['askConfirm'];
  showNotice: DialogAPI['showNotice'];
  askText: DialogAPI['askText'];
  vault: State;
  mutate: (n: string, b?: Dict, m?: string) => Promise<unknown>;
  run: <T>(name: string, body?: Dict) => Promise<T | undefined>;
  setDialog: (d: Dialog) => void;
  exportData: (f: 'json' | 'csv') => Promise<void>;
  importData: () => Promise<void>;
  selectPage: (p: Page) => void;
}) {
  const [autolock, setAutolock] = useState(vault.settings.autolock ?? 5),
    [clip, setClip] = useState(vault.settings.clip ?? 30),
    [oldDays, setOldDays] = useState(vault.settings.old_days ?? 180),
    [logos, setLogos] = useState(vault.settings.logos ?? 1),
    [close, setClose] = useState(vault.prefs.close),
    [auto, setAuto] = useState(vault.prefs.autostart),
    [preset, setPreset] = useState(vault.settings.theme?.preset || 'night'),
    [customPalette, setCustomPalette] = useState<Record<string, string>>({
      ...DEFAULT_CUSTOM,
      ...(vault.settings.theme?.custom || {}),
    }),
    [suggestions, setSuggestions] = useState<string[]>([]),
    [cloudSearchStatus, setCloudSearchStatus] = useState(''),
    [cloudSearching, setCloudSearching] = useState(false),
    [appVersion, setAppVersion] = useState(''),
    [zoom, setZoom] = useState(1),
    [zoomDraft, setZoomDraft] = useState('100');
  // The typed value follows the real zoom (buttons, shortcuts, other windows).
  useEffect(() => setZoomDraft(String(Math.round(zoom * 100))), [zoom]);
  // Applies the typed percentage: invalid input is reverted, out-of-range values
  // are clamped to the allowed limits.
  const applyZoomDraft = () => {
    const typed = Number.parseInt(zoomDraft, 10);
    const current = Math.round(zoom * 100);
    if (!Number.isFinite(typed)) {
      setZoomDraft(String(current));
      return;
    }
    const percent = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, typed));
    setZoomDraft(String(percent));
    if (percent !== current)
      void changeZoom('set', percent / 100)
        .then(setZoom)
        .catch(() => setZoomDraft(String(current)));
  };
  // Interface zoom is a per-device preference, applied immediately (not part of
  // "Salva aspetto"); keyboard shortcuts in any window keep this control in sync.
  useEffect(() => {
    void getZoom()
      .then(setZoom)
      .catch(() => {});
    const stop = listen<number>('zoom-changed', (e) => setZoom(e.payload));
    return () => {
      void stop.then((fn) => fn());
    };
  }, []);
  useEffect(() => {
    let active = true;
    getVersion()
      .then((version) => {
        if (active) setAppVersion(version);
      })
      .catch(() => {
        if (active) setAppVersion('—');
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <div className="heading-row">
        <div>
          <div className="eyebrow">{t('PREFERENCES')}</div>
          <h1>{t('Impostazioni')}</h1>
          <p>{t('Gestisci sicurezza, dati, aspetto e integrazioni.')}</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="panel-head">
            <h2>
              <Lock size={18} />
              {t('Protezione')}
            </h2>
          </div>
          <div className="form-stack">
            <label className="field">
              <span>{t('Blocco automatico (minuti, 0 = disattivato)')}</span>
              <input
                type="number"
                min={0}
                value={autolock}
                onChange={(e) => setAutolock(+e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('Pulizia appunti dopo (secondi, 0 = disattivata)')}</span>
              <input
                type="number"
                min={0}
                value={clip}
                onChange={(e) => setClip(+e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('Segnala password vecchie dopo (giorni)')}</span>
              <input
                type="number"
                min={0}
                value={oldDays}
                onChange={(e) => setOldDays(+e.target.value)}
              />
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                checked={!!logos}
                onChange={(e) => setLogos(e.target.checked ? 1 : 0)}
              />
              {t('Scarica favicon dei siti (rete)')}
            </label>
            <button
              className="primary"
              onClick={() =>
                void mutate('settings', {
                  autolock,
                  clip,
                  old_days: oldDays,
                  logos,
                })
              }
            >
              {t('Salva impostazioni')}
            </button>
            <button className="secondary" onClick={() => setDialog('master')}>
              {t('Modifica password principale')}
            </button>
            <button className="secondary" onClick={() => setDialog('recovery_new')}>
              {t('Rigenera codice di recupero')}
            </button>
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-head">
            <h2>
              <Palette size={18} />
              {t('Aspetto')}
            </h2>
          </div>
          <div className="form-stack">
            <div className="field">
              <span>{t('Dimensione interfaccia')}</span>
              <div className="zoom-control">
                <button
                  type="button"
                  className="secondary"
                  title={t('Zoom minimo ({n}%)', { n: ZOOM_MIN })}
                  aria-label={t('Imposta lo zoom al minimo, {n}%', { n: ZOOM_MIN })}
                  disabled={zoom <= ZOOM_MIN / 100}
                  onClick={() => void changeZoom('set', ZOOM_MIN / 100).then(setZoom)}
                >
                  <span className="zoom-icon">
                    <ZoomOut size={16} />
                    <span className="zoom-badge" aria-hidden="true">
                      +
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="secondary"
                  title={t('Riduci (Ctrl + − oppure Ctrl + F11)')}
                  aria-label={t('Riduci dimensione interfaccia')}
                  disabled={zoom <= ZOOM_MIN / 100}
                  onClick={() => void changeZoom('out').then(setZoom)}
                >
                  <ZoomOut size={16} />
                </button>
                <label className="zoom-input" title={t('Scrivi la percentuale e premi Invio')}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={ZOOM_MIN}
                    max={ZOOM_MAX}
                    step={1}
                    aria-label={t('Zoom in percentuale, da {min} a {max}', {
                      min: ZOOM_MIN,
                      max: ZOOM_MAX,
                    })}
                    value={zoomDraft}
                    onChange={(e) => setZoomDraft(e.target.value)}
                    onBlur={applyZoomDraft}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyZoomDraft();
                      } else if (e.key === 'Escape') {
                        setZoomDraft(String(Math.round(zoom * 100)));
                      }
                    }}
                  />
                  <span>%</span>
                </label>
                <button
                  type="button"
                  className="secondary"
                  title={t('Ingrandisci (Ctrl + + oppure Ctrl + F12)')}
                  aria-label={t('Ingrandisci dimensione interfaccia')}
                  disabled={zoom >= ZOOM_MAX / 100}
                  onClick={() => void changeZoom('in').then(setZoom)}
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  className="secondary"
                  title={t('Zoom massimo ({n}%)', { n: ZOOM_MAX })}
                  aria-label={t('Imposta lo zoom al massimo, {n}%', { n: ZOOM_MAX })}
                  disabled={zoom >= ZOOM_MAX / 100}
                  onClick={() => void changeZoom('set', ZOOM_MAX / 100).then(setZoom)}
                >
                  <span className="zoom-icon">
                    <ZoomIn size={16} />
                    <span className="zoom-badge" aria-hidden="true">
                      +
                    </span>
                  </span>
                </button>
              </div>
              <p className="helper">
                {t(
                  'Scrivi una percentuale da {min} a {max} e premi Invio, oppure usa i pulsanti. Si applica subito a tutte le finestre e viene ricordata su questo PC. Scorciatoie: Ctrl + + / Ctrl + − (anche Ctrl + F12 / Ctrl + F11 o Ctrl + rotella), Ctrl + 0 per tornare al 100%.',
                  { min: ZOOM_MIN, max: ZOOM_MAX },
                )}
              </p>
            </div>
            <label className="field">
              <span>{t('Tema colore')}</span>
              <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                {Object.entries({
                  amethyst: t('Ametista'),
                  night: t('Notte'),
                  ocean: t('Oceano'),
                  forest: t('Foresta'),
                  sunset: t('Tramonto'),
                  rose: t('Rosa'),
                  graphite: t('Grafite'),
                  mint: t('Menta scuro'),
                  custom: t('Personalizzato'),
                }).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {preset === 'custom' && (
              <>
                <p className="helper">
                  {t(
                    "Personalizza tutti i colori dell'interfaccia. Le modifiche vengono applicate dopo il salvataggio.",
                  )}
                </p>
                <div className="theme-editor">
                  {paletteKeys.map(([k, label]) => (
                    <label className="color-row" key={k}>
                      <span>{t(label)}</span>
                      <input
                        type="color"
                        value={customPalette[k] || DEFAULT_CUSTOM[k]}
                        onChange={(e) => setCustomPalette((x) => ({ ...x, [k]: e.target.value }))}
                      />
                      <code>{customPalette[k] || DEFAULT_CUSTOM[k]}</code>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setCustomPalette({ ...DEFAULT_CUSTOM })}
                >
                  {t('Ripristina colori predefiniti')}
                </button>
              </>
            )}
            <button
              className="primary"
              onClick={() =>
                void mutate(
                  'settings',
                  { theme: { preset, custom: customPalette } },
                  t('Aspetto salvato'),
                )
              }
            >
              {t('Salva aspetto')}
            </button>
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-head">
            <h2>
              <ArrowDownToLine size={18} />
              {t('Dati e backup')}
            </h2>
          </div>
          <div className="form-stack">
            <p className="sensitive-warning">
              {t(
                'Attenzione: le esportazioni JSON e CSV contengono segreti in chiaro. Non salvarle in percorsi pubblici.',
              )}{' '}
              {t(
                'Non aprire il CSV direttamente con Excel o un altro foglio di calcolo: i valori che iniziano con =, +, - o @ verrebbero eseguiti come formule.',
              )}
            </p>
            <div className="split-actions">
              <button className="secondary" onClick={() => void exportData('json')}>
                <Download size={16} />
                {t('Esporta JSON')}
              </button>
              <button className="secondary" onClick={() => void exportData('csv')}>
                <Download size={16} />
                {t('Esporta CSV')}
              </button>
            </div>
            <button className="secondary" onClick={() => void importData()}>
              <Upload size={16} />
              {t('Importa da un altro password manager o da un file')}
            </button>
            <button className="secondary" onClick={() => setDialog('share')}>
              <ShieldCheck size={16} />
              {t('Esporta pacchetto cifrato')}
            </button>
            <div className="divider" />
            <div className="path-info">
              <strong>{t('Posizione vault')}</strong>
              <code>{vault.path}</code>
            </div>
            <button
              className="secondary"
              disabled={cloudSearching}
              onClick={async () => {
                setCloudSearching(true);
                setSuggestions([]);
                setCloudSearchStatus(t('Ricerca delle cartelle cloud configurate sul computer…'));
                try {
                  const r = await run<{ dirs: string[] }>('suggest');
                  if (!r) {
                    setCloudSearchStatus(
                      t('Ricerca non riuscita. Puoi scegliere manualmente una cartella.'),
                    );
                    return;
                  }
                  const dirs = Array.isArray(r.dirs) ? r.dirs : [];
                  setSuggestions(dirs);
                  setCloudSearchStatus(
                    dirs.length
                      ? t(
                          'Cartelle cloud trovate: {n}. Seleziona una destinazione per copiare il vault.',
                          { n: dirs.length },
                        )
                      : t(
                          'Nessuna cartella cloud locale rilevata. Puoi selezionarla manualmente con «Copia vault in cartella / cloud».',
                        ),
                  );
                } finally {
                  setCloudSearching(false);
                }
              }}
            >
              <Search size={16} />
              {cloudSearching ? t('Ricerca in corso…') : t('Cerca cartelle cloud locali')}
            </button>
            {cloudSearchStatus && (
              <p className="cloud-search-status" role="status" aria-live="polite">
                {cloudSearchStatus}
              </p>
            )}
            {suggestions.length > 0 && (
              <div className="cloud-suggestions">
                {suggestions.map((path) => (
                  <button
                    key={path}
                    title={path}
                    onClick={async () => {
                      if (
                        await askConfirm(t('Copiare il vault in {path}?', { path }), {
                          title: t('Copia vault'),
                          confirmLabel: t('Copia vault'),
                        })
                      )
                        await mutate('loc_move', { folder: path }, t('Vault copiato'));
                    }}
                  >
                    {path}
                  </button>
                ))}
              </div>
            )}
            <button
              className="secondary"
              onClick={async () => {
                const p = await picker('vault_folder');
                if (
                  p &&
                  (await askConfirm(
                    t(
                      'Copiare il vault nella cartella selezionata? L’originale non viene eliminato.',
                    ),
                    { title: t('Copia vault'), confirmLabel: t('Copia vault') },
                  ))
                )
                  await mutate('loc_move', { folder: p }, t('Vault copiato e collegato'));
              }}
            >
              <Cloud size={16} />
              {t('Copia vault in cartella / cloud')}
            </button>
            <button
              className="secondary"
              onClick={async () => {
                const p = await picker('vault_folder');
                if (
                  p &&
                  (await askConfirm(
                    t('Bloccare il vault corrente e collegare quello nella cartella selezionata?'),
                    { title: t('Collega vault'), confirmLabel: t('Collega vault') },
                  ))
                ) {
                  const r = await run('loc_use', { folder: p });
                  if (r) window.location.reload();
                }
              }}
            >
              <Folder size={16} />
              {t('Collega vault esistente')}
            </button>
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-head">
            <h2>
              <Search size={18} />
              {t('Ricerca rapida globale')}
            </h2>
          </div>
          <QuickSearchSettings />
        </section>
        <section className="panel settings-panel">
          <div className="panel-head">
            <h2>
              <SettingsIcon size={18} />
              {t('Desktop')}
            </h2>
          </div>
          <BrowserSettings />
          <div className="form-stack">
            <label className="field">
              <span>{t('Alla chiusura della finestra')}</span>
              <select value={close} onChange={(e) => setClose(e.target.value as 'quit' | 'tray')}>
                <option value="quit">{t("Esci dall'applicazione")}</option>
                <option value="tray">{t("Nascondi nell'area di notifica")}</option>
              </select>
            </label>
            <label className="check-line">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              {t('Avvia con Windows')}
            </label>
            <button
              className="primary"
              onClick={() =>
                void mutate(
                  'prefs_set',
                  { close_action: close, autostart: auto },
                  t('Preferenze Windows salvate'),
                )
              }
            >
              {t('Salva preferenze')}
            </button>
            <p>{t("La chiusura nell'area di notifica blocca il vault.")}</p>
          </div>
        </section>
        <UpdateSettings askConfirm={askConfirm} showNotice={showNotice} />
        <section className="panel settings-panel">
          <div className="panel-head">
            <h2>
              <FolderPlus size={18} />
              {t('Cartelle')}
            </h2>
          </div>
          <div className="form-stack">
            {vault.folders.map((f) => (
              <div className="folder-setting" key={f.id}>
                <Folder size={17} />
                <span>{f.name}</span>
                <button
                  className="icon-button"
                  title={t('Rinomina')}
                  onClick={async () => {
                    const n = await askText(t('Nuovo nome della cartella'), f.name);
                    if (n?.trim()) await mutate('folder', { id: f.id, name: n.trim() });
                  }}
                >
                  <SettingsIcon size={16} />
                </button>
                <button
                  className="icon-button danger"
                  title={t('Elimina cartella')}
                  onClick={async () => {
                    if (
                      await askConfirm(
                        t('Eliminare la cartella {name}? Gli elementi resteranno nel vault.', {
                          name: f.name,
                        }),
                        {
                          title: t('Elimina cartella'),
                          danger: true,
                          confirmLabel: t('Elimina cartella'),
                        },
                      )
                    )
                      await mutate('folder', { id: f.id, delete: true });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button className="secondary" onClick={() => selectPage('all')}>
              <LayoutGrid size={16} />
              {t('Vai agli elementi')}
            </button>
          </div>
        </section>
      </div>
      <div className="settings-footer">
        <span>{t("Jesse's Archive · Tauri 2 + Rust · Vault AES-256-GCM v1")}</span>
        <span className="app-version">
          {t('Version: Beta')} {appVersion || '…'}
        </span>
      </div>
    </>
  );
}
