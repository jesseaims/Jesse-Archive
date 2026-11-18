/*
 * Global Quick Search window (label "quick-search", opened by the global shortcut).
 *
 * It only holds metadata from `quick_search_data`; passwords are copied by the
 * backend, and one is shown here only after "Mostra password", for a few seconds.
 * Everything is dropped when the window hides or the vault locks.
 */
import { t, translateMessage } from '../i18n';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  AppWindow,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Lock,
  Search,
  Star,
  X,
} from 'lucide-react';
import { api } from '../api';
import { applyPalette } from '../theme';
import GroupLogo from '../GroupLogo';
import { categories } from '../types';
import type { Category } from '../types';
import { buildIndex, favoriteIds, highlightParts, listItems, search } from './engine';
import type { AccountResult, Range, ResultGroup, SearchData } from './engine';
import { matchActions, QUICK_ACTIONS } from './actions';
import type { QuickAction } from './actions';

export type QuickSearchSettings = {
  enabled: boolean;
  shortcut: string;
  close_after: boolean;
  favorites: boolean;
  recent: boolean;
  categories: boolean;
};
type Payload = Partial<SearchData> & {
  unlocked: boolean;
  settings: QuickSearchSettings;
  recent?: string[];
  theme?: { preset: string; custom?: Record<string, string> } | null;
};
type Row =
  | { kind: 'section'; label: string }
  | { kind: 'group'; group: ResultGroup; expanded: boolean }
  | { kind: 'account'; account: AccountResult; nested: boolean }
  | { kind: 'action'; action: QuickAction };

/** A revealed password disappears by itself after this many milliseconds. */
const REVEAL_MS = 15000;
const SHOWN_FAVORITES = 8;

const categoryLabels = () =>
  Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, t(v.label)])) as Record<
    Category,
    string
  >;

function Marked({ text, ranges }: { text: string; ranges: Range[] }) {
  return (
    <>
      {highlightParts(text, ranges).map((p, i) =>
        p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}

const selectable = (r: Row) => r.kind !== 'section';

export default function QuickSearch() {
  const [payload, setPayload] = useState<Payload | null>(null),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(''),
    [favoritesOnly, setFavoritesOnly] = useState(false),
    [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [selected, setSelected] = useState(0),
    [revealed, setRevealed] = useState<{ id: string; value: string } | null>(null),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const shown = useRef(false);
  const revealTimer = useRef<number | undefined>(undefined);
  const deferred = useDeferredValue(query);

  const hideReveal = useCallback(() => {
    window.clearTimeout(revealTimer.current);
    setRevealed(null);
  }, []);
  /** Drops every piece of vault data held by the page. */
  const wipe = useCallback(() => {
    hideReveal();
    setPayload((p) => (p ? { unlocked: false, settings: p.settings } : null));
    setQuery('');
    setFavoritesOnly(false);
    setExpanded(new Set());
    setSelected(0);
    setNotice('');
    setError('');
    setPassword('');
  }, [hideReveal]);
  const load = useCallback(async () => {
    try {
      const data = await invoke<Payload>('quick_search_data');
      setPayload(data);
      if (data.unlocked) applyPalette(data.theme ?? { preset: 'night' });
      setError('');
    } catch (e) {
      setError(translateMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  const focusInput = () =>
    window.setTimeout(() => {
      input.current?.focus();
      input.current?.select();
    }, 0);

  useEffect(() => {
    applyPalette({ preset: 'night' });
    void load();
    const listeners = [
      listen('quick-search-shown', () => {
        shown.current = true;
        setLoading(true);
        void load();
        focusInput();
      }),
      listen('quick-search-hidden', () => {
        shown.current = false;
        wipe();
        setPayload(null);
      }),
      listen('vault-locked', () => {
        wipe();
        void load();
      }),
      listen('vault-changed', () => {
        if (shown.current) void load();
      }),
    ];
    return () => {
      listeners.forEach((p) => void p.then((fn) => fn()));
      window.clearTimeout(revealTimer.current);
    };
  }, [load, wipe]);

  const settings = payload?.settings;
  const unlocked = !!payload?.unlocked;
  const index = useMemo(
    () =>
      unlocked && payload?.items
        ? buildIndex(
            { items: payload.items, folders: payload.folders ?? [], groups: payload.groups ?? {} },
            { categories: settings?.categories ?? true, categoryLabels: categoryLabels() },
          )
        : null,
    [unlocked, payload, settings?.categories],
  );

  const rows = useMemo<Row[]>(() => {
    if (!index) return [];
    const out: Row[] = [];
    const pushGroups = (groups: ResultGroup[]) => {
      for (const group of groups) {
        if (group.accounts.length === 1) {
          out.push({ kind: 'account', account: group.accounts[0], nested: false });
          continue;
        }
        // A single matching service opens by itself.
        const open = expanded.has(group.key) || (groups.length === 1 && !!deferred.trim());
        out.push({ kind: 'group', group, expanded: open });
        if (open)
          for (const account of group.accounts)
            out.push({ kind: 'account', account, nested: true });
      }
    };
    const q = deferred.trim();
    if (favoritesOnly) {
      const ids = new Set(favoriteIds(index));
      const groups = q
        ? search(index, q)
            .map((g) => ({ ...g, accounts: g.accounts.filter((a) => ids.has(a.item.id)) }))
            .filter((g) => g.accounts.length)
        : listItems(index, [...ids]);
      if (groups.length) out.push({ kind: 'section', label: t('Preferiti') });
      pushGroups(groups);
      return out;
    }
    if (!q) {
      if (settings?.favorites) {
        const favorites = listItems(index, favoriteIds(index).slice(0, SHOWN_FAVORITES));
        if (favorites.length) {
          out.push({ kind: 'section', label: t('Preferiti') });
          pushGroups(favorites);
        }
      }
      if (settings?.recent && payload?.recent?.length) {
        const recent = listItems(index, payload.recent);
        if (recent.length) {
          out.push({ kind: 'section', label: t('Usati di recente') });
          pushGroups(recent);
        }
      }
      out.push({ kind: 'section', label: t('Azioni rapide') });
      for (const action of QUICK_ACTIONS) out.push({ kind: 'action', action });
      return out;
    }
    const groups = search(index, q);
    if (groups.length) {
      out.push({ kind: 'section', label: t('Risultati') });
      pushGroups(groups);
    }
    const actions = matchActions(QUICK_ACTIONS, q, t);
    if (actions.length) {
      out.push({ kind: 'section', label: t('Azioni') });
      for (const action of actions) out.push({ kind: 'action', action });
    }
    return out;
  }, [index, deferred, favoritesOnly, expanded, settings, payload?.recent]);

  // Keep the selection on a selectable row and in view.
  const selectableRows = rows.map((r, i) => (selectable(r) ? i : -1)).filter((i) => i >= 0);
  const current = selectableRows.includes(selected) ? selected : (selectableRows[0] ?? -1);
  const row = current >= 0 ? rows[current] : undefined;
  useEffect(() => {
    list.current?.querySelector(`[data-row="${current}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [current]);
  useEffect(() => setSelected(0), [deferred, favoritesOnly]);
  const account = row?.kind === 'account' ? row.account : undefined;
  useEffect(() => hideReveal(), [account?.item.id, hideReveal]);

  const move = (step: number) => {
    if (!selectableRows.length) return;
    const pos = Math.max(0, selectableRows.indexOf(current));
    const next = (pos + step + selectableRows.length) % selectableRows.length;
    setSelected(selectableRows[next]);
  };

  /** Runs an action; afterwards closes the window or shows the outcome. */
  const run = async (fn: () => Promise<string | void>, close = true) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const done = await fn();
      if (close && settings?.close_after) void invoke('quick_search_hide');
      else if (done) setNotice(done);
    } catch (e) {
      setError(translateMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const copyUsername = (a: AccountResult) =>
    run(async () => {
      await invoke('quick_search_copy', { id: a.item.id, field: 'username' });
      return t('Username copiato');
    });
  const copyPassword = (a: AccountResult) =>
    run(async () => {
      const r = await invoke<{ clear_after: number }>('quick_search_copy', {
        id: a.item.id,
        field: 'password',
      });
      return r.clear_after
        ? t('Password copiata: gli appunti si svuotano tra {n} s', { n: r.clear_after })
        : t('Password copiata');
    });
  const reveal = (a: AccountResult) =>
    run(async () => {
      if (revealed?.id === a.item.id) return hideReveal();
      const r = await invoke<{ value: string }>('quick_search_reveal', { id: a.item.id });
      setRevealed({ id: a.item.id, value: r.value });
      window.clearTimeout(revealTimer.current);
      revealTimer.current = window.setTimeout(hideReveal, REVEAL_MS);
    }, false);
  const openSite = (a: AccountResult) =>
    run(async () => {
      await invoke('quick_search_open_url', { id: a.item.id });
      return t('Sito aperto nel browser');
    });
  const openInVault = (a: AccountResult) =>
    run(() => invoke('quick_search_open', { target: { kind: 'item', id: a.item.id } }), false);
  const runAction = (action: QuickAction) => {
    if (action.target.kind === 'local') {
      setFavoritesOnly(true);
      setQuery('');
      focusInput();
      return;
    }
    void run(() => invoke('quick_search_open', { target: action.target }), false);
  };
  const toggleGroup = (key: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  /** Enter: the most useful action of the selected row. */
  const primary = (r: Row | undefined) => {
    if (!r) return;
    if (r.kind === 'group') toggleGroup(r.group.key);
    else if (r.kind === 'action') runAction(r.action);
    else if (r.kind === 'account') {
      const a = r.account;
      if (a.item.has_password) void copyPassword(a);
      else if (a.account) void copyUsername(a);
      else void openInVault(a);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (revealed) hideReveal();
      else void invoke('quick_search_hide');
      return;
    }
    if (!unlocked) return;
    const onButton = (e.target as HTMLElement).tagName === 'BUTTON';
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(e.key === 'ArrowDown' ? 1 : -1);
      if (onButton) input.current?.focus();
      return;
    }
    if (e.key === 'Backspace' && favoritesOnly && !query) {
      setFavoritesOnly(false);
      return;
    }
    if (e.key === 'Enter' && !onButton) {
      e.preventDefault();
      if (account && e.ctrlKey) void openInVault(account);
      else if (account && e.altKey) void openSite(account);
      else primary(row);
      return;
    }
    if (e.code === 'KeyC' && (e.ctrlKey || e.metaKey) && account) {
      const field = input.current;
      const textSelected =
        document.activeElement === field && field && field.selectionStart !== field.selectionEnd;
      if (e.shiftKey) {
        e.preventDefault();
        void copyPassword(account);
      } else if (!textSelected) {
        e.preventDefault();
        void copyUsername(account);
      }
    }
  };

  const unlock = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('unlock', { password });
      setPassword('');
      await load();
      focusInput();
    } catch (err) {
      setError(translateMessage(err));
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (loading && !payload) {
    body = (
      <div className="qs-state" role="status">
        <LoaderCircle className="spin" size={22} />
        <span>{t('Caricamento…')}</span>
      </div>
    );
  } else if (!unlocked) {
    body = (
      <form className="qs-locked" onSubmit={unlock}>
        <Lock size={26} />
        <h2>{t('Vault bloccato')}</h2>
        <p>{t('Sblocca il vault per cercare tra i tuoi account.')}</p>
        <input
          autoFocus
          type="password"
          autoComplete="off"
          aria-label={t('Password principale')}
          placeholder={t('Password principale')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="primary wide" disabled={busy || !password}>
          {busy ? t('Sblocco…') : t('Sblocca')}
          <ArrowRight size={16} />
        </button>
        <button
          type="button"
          className="secondary wide"
          onClick={() =>
            void run(() => invoke('quick_search_open', { target: { kind: 'unlock' } }), false)
          }
        >
          <AppWindow size={16} />
          {t('Apri Jesse’s Archive')}
        </button>
      </form>
    );
  } else {
    body = (
      <div className="qs-main">
        <div className="qs-list" ref={list} role="listbox" aria-label={t('Risultati')}>
          {rows.length === 0 || !rows.some(selectable) ? (
            <div className="qs-state">
              <Search size={22} />
              <span>
                {deferred.trim()
                  ? t('Nessun risultato per «{q}»', { q: deferred.trim() })
                  : t('Nessun preferito.')}
              </span>
            </div>
          ) : (
            rows.map((r, i) =>
              r.kind === 'section' ? (
                <div key={'s' + i} className="qs-section">
                  {r.label}
                </div>
              ) : (
                <div
                  key={i}
                  data-row={i}
                  role="option"
                  aria-selected={i === current}
                  className={`qs-row ${i === current ? 'active' : ''} ${r.kind === 'account' && r.nested ? 'nested' : ''}`}
                  onMouseMove={() => i !== current && setSelected(i)}
                  // An account is selected by a click and used by a double click (or
                  // the buttons on the right); the other rows act on a click.
                  onClick={() => {
                    setSelected(i);
                    if (r.kind !== 'account') primary(r);
                  }}
                  onDoubleClick={() => r.kind === 'account' && primary(r)}
                >
                  <RowContent row={r} />
                </div>
              ),
            )
          )}
        </div>
        <aside className="qs-preview">
          {account ? (
            <Preview
              account={account}
              revealed={revealed?.id === account.item.id ? revealed.value : ''}
              busy={busy}
              onCopyUsername={() => void copyUsername(account)}
              onCopyPassword={() => void copyPassword(account)}
              onReveal={() => void reveal(account)}
              onOpenSite={() => void openSite(account)}
              onOpenVault={() => void openInVault(account)}
            />
          ) : row?.kind === 'group' ? (
            <div className="qs-preview-group">
              <GroupLogo icon={row.group.icon} groupKey={row.group.key} name={row.group.service} />
              <strong>{row.group.service}</strong>
              <span>{t('{n} account', { n: row.group.accounts.length })}</span>
              <p>{t('Premi Invio per vedere gli account.')}</p>
            </div>
          ) : (
            <div className="qs-preview-group">
              <KeyRound size={22} />
              <p>{t('Cerca per nome, username, email o sito.')}</p>
            </div>
          )}
        </aside>
      </div>
    );
  }

  return (
    <main className="qs-window" onKeyDown={onKeyDown}>
      <header className="qs-head">
        <label className="qs-field">
          <Search size={20} />
          {favoritesOnly && (
            <button
              type="button"
              className="qs-scope"
              title={t('Cerca in tutto il vault')}
              onClick={() => {
                setFavoritesOnly(false);
                input.current?.focus();
              }}
            >
              <Star size={13} />
              {t('Preferiti')}
              <X size={13} />
            </button>
          )}
          <input
            ref={input}
            autoFocus
            disabled={!unlocked}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={unlocked ? t('Cerca account, siti, email…') : t('Vault bloccato')}
            aria-label={t('Ricerca rapida')}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <span className={`qs-status ${unlocked ? 'open' : 'closed'}`}>
          {unlocked ? t('Sbloccato') : t('Bloccato')}
        </span>
      </header>
      {(error || notice) && (
        <div className={`qs-feedback ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
          {error || notice}
        </div>
      )}
      {body}
      {unlocked && (
        <footer className="qs-foot">
          <span>
            <kbd>↵</kbd> {account?.item.has_password ? t('Copia password') : t('Apri')}
          </span>
          <span>
            <kbd>Ctrl</kbd>
            <kbd>C</kbd> {t('Username')}
          </span>
          <span>
            <kbd>Ctrl</kbd>
            <kbd>Shift</kbd>
            <kbd>C</kbd> {t('Password')}
          </span>
          <span>
            <kbd>Alt</kbd>
            <kbd>↵</kbd> {t('Sito')}
          </span>
          <span>
            <kbd>Ctrl</kbd>
            <kbd>↵</kbd> {t('Vault')}
          </span>
          <span>
            <kbd>Esc</kbd> {t('Chiudi')}
          </span>
        </footer>
      )}
    </main>
  );
}

function RowContent({ row }: { row: Row }) {
  if (row.kind === 'group')
    return (
      <>
        <GroupLogo icon={row.group.icon} groupKey={row.group.key} name={row.group.service} />
        <span className="qs-row-text">
          <strong>{row.group.service}</strong>
          <small>{row.group.domain || t('{n} account', { n: row.group.accounts.length })}</small>
        </span>
        <span className="qs-count">{row.group.accounts.length}</span>
        {row.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </>
    );
  if (row.kind === 'account') {
    const a = row.account;
    return (
      <>
        {row.nested ? (
          <span className="qs-dot" aria-hidden="true" />
        ) : (
          <GroupLogo icon={a.icon} groupKey={a.groupKey} name={a.service} />
        )}
        <span className="qs-row-text">
          <strong>
            <Marked
              text={a.item.title || a.service}
              ranges={a.item.title ? a.highlight.title : []}
            />
          </strong>
          <small>
            {a.account ? <Marked text={a.account} ranges={a.highlight.account} /> : a.domain}
          </small>
        </span>
        {a.item.fav && <Star className="qs-fav" size={13} fill="currentColor" />}
        <span className="qs-category">{a.categoryLabel}</span>
      </>
    );
  }
  if (row.kind === 'action') {
    const Icon = row.action.icon;
    return (
      <>
        <span className="qs-icon">
          <Icon size={16} />
        </span>
        <span className="qs-row-text">
          <strong>{t(row.action.label)}</strong>
        </span>
      </>
    );
  }
  return null;
}

function Preview(p: {
  account: AccountResult;
  revealed: string;
  busy: boolean;
  onCopyUsername: () => void;
  onCopyPassword: () => void;
  onReveal: () => void;
  onOpenSite: () => void;
  onOpenVault: () => void;
}) {
  const a = p.account;
  const url = a.item.f.url;
  return (
    <div className="qs-preview-account">
      <div className="qs-preview-head">
        <GroupLogo icon={a.icon} groupKey={a.groupKey} name={a.service} />
        <div>
          <strong>{a.item.title || a.service}</strong>
          <small>{a.service !== a.item.title ? a.service : a.categoryLabel}</small>
        </div>
      </div>
      <dl>
        {a.account && (
          <>
            <dt>{a.item.f.email && !a.item.f.username ? t('Email') : t('Username')}</dt>
            <dd>{a.account}</dd>
          </>
        )}
        {a.item.has_password && (
          <>
            <dt>{t('Password')}</dt>
            <dd className="qs-secret">{p.revealed || '••••••••••••'}</dd>
          </>
        )}
        {url && (
          <>
            <dt>{t('Sito')}</dt>
            <dd>{a.domain || url}</dd>
          </>
        )}
        <dt>{t('Categoria')}</dt>
        <dd>
          {a.categoryLabel}
          {a.folderName ? ` · ${a.folderName}` : ''}
        </dd>
      </dl>
      <div className="qs-actions">
        {a.account && (
          <button type="button" className="secondary" disabled={p.busy} onClick={p.onCopyUsername}>
            <Copy size={15} />
            {t('Copia username')}
          </button>
        )}
        {a.item.has_password && (
          <>
            <button type="button" className="primary" disabled={p.busy} onClick={p.onCopyPassword}>
              <Copy size={15} />
              {t('Copia password')}
            </button>
            <button type="button" className="secondary" disabled={p.busy} onClick={p.onReveal}>
              {p.revealed ? <EyeOff size={15} /> : <Eye size={15} />}
              {p.revealed ? t('Nascondi password') : t('Mostra password')}
            </button>
          </>
        )}
        {url && (
          <button type="button" className="secondary" disabled={p.busy} onClick={p.onOpenSite}>
            <ExternalLink size={15} />
            {t('Apri sito')}
          </button>
        )}
        <button type="button" className="secondary" disabled={p.busy} onClick={p.onOpenVault}>
          <AppWindow size={15} />
          {t('Apri nel vault')}
        </button>
      </div>
    </div>
  );
}
