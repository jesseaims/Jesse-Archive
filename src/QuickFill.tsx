import { t, tRich, translateMessage } from './i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Fingerprint,
  KeyRound,
  Lock,
  Search,
  ShieldCheck,
  Smartphone,
  UserPlus,
  X,
  ArrowRight,
} from 'lucide-react';
import { api } from './api';
import { applyPalette } from './theme';
type Account = { id: string; title: string; username: string };
type Snapshot = { available: boolean; unlocked?: boolean; domain?: string; accounts?: Account[] };
// WebAuthn request from a site (src-tauri/src/passkey.rs).
type Passkey = {
  active: boolean;
  op?: 'create' | 'get';
  rpId?: string;
  rpName?: string;
  userName?: string;
  userDisplay?: string;
  unlocked?: boolean;
  candidates?: Account[];
  existing?: boolean;
};
// Credentials submitted on a site, waiting for "save?" (src-tauri/src/browser_save.rs).
// The password stays in the backend: only the other fields reach this window.
type SaveField = { label: string; auto: string; type: string; value: string };
type SaveRequest = {
  active: boolean;
  site?: string;
  unlocked?: boolean;
  mode?: 'new' | 'update';
  title?: string;
  user?: number | null;
  fields?: SaveField[];
  expires?: number;
};
// Labels of the standard autocomplete tokens; other fields keep the page's label.
function fieldLabel(f: SaveField, index: number): string {
  const known: Record<string, string> = {
    username: t('Username'),
    email: t('Email'),
    name: t('Nome completo'),
    'given-name': t('Nome'),
    'additional-name': t('Secondo nome'),
    'family-name': t('Cognome'),
    nickname: t('Soprannome'),
    tel: t('Telefono'),
    bday: t('Data di nascita'),
    sex: t('Sesso'),
    'street-address': t('Indirizzo'),
    'address-line1': t('Indirizzo'),
    'address-level2': t('Città'),
    'postal-code': t('CAP'),
    country: t('Paese'),
    'country-name': t('Paese'),
    organization: t('Organizzazione'),
  };
  return (
    known[f.auto] || (f.type === 'email' ? t('Email') : f.label) || t('Campo {n}', { n: index + 1 })
  );
}
export default function QuickFill() {
  const [passkey, setPasskey] = useState<Passkey>({ active: false });
  const [save, setSave] = useState<SaveRequest>({ active: false }),
    [saveTitle, setSaveTitle] = useState(''),
    [saveUser, setSaveUser] = useState(''),
    [saveNotes, setSaveNotes] = useState<number[]>([]),
    saveKey = useRef('');
  const [state, setState] = useState<Snapshot>({ available: false }),
    [password, setPassword] = useState(''),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const active = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = useCallback(async () => {
    try {
      setState(await invoke<Snapshot>('browser_accounts'));
      setPasskey(await invoke<Passkey>('passkey_state'));
      const next = await invoke<SaveRequest>('browser_save_state');
      setSave(next);
      // New request (or just unlocked): start from the suggested values.
      const key = next.active && next.unlocked ? `${next.site}|${next.mode}|${next.title}` : '';
      if (key && key !== saveKey.current) {
        const fields = next.fields || [];
        const user = next.user ?? -1;
        setSaveTitle(next.title || next.site || '');
        setSaveUser(fields[user]?.value || '');
        setSaveNotes(fields.map((_, i) => i).filter((i) => i !== user));
      }
      saveKey.current = key;
    } catch (e) {
      setError(translateMessage(e));
    }
  }, []);
  const passkeyAction = async (command: string, args: Record<string, unknown> = {}) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await invoke(command, args);
      setPasskey({ active: false });
    } catch (e) {
      setError(translateMessage(e));
      void refresh();
    } finally {
      setBusy(false);
    }
  };
  const cancel = useCallback(() => {
    active.current = false;
    clearTimeout(timer.current);
    setState({ available: false });
    setPassword('');
    setQuery('');
    setError('');
    setNotice('');
    setBusy(false);
    void invoke('browser_cancel');
  }, []);
  useEffect(() => {
    applyPalette({ preset: 'night' });
    void refresh();
    const listeners = [
      listen('browser-dismissed', () => {
        active.current = false;
        clearTimeout(timer.current);
        setState({ available: false });
        setPassword('');
        setQuery('');
        setError('');
        setNotice('');
        setBusy(false);
      }),
      listen('browser-changed', () => {
        active.current = true;
        setPassword('');
        setQuery('');
        setSelected(0);
        setBusy(false);
        setError('');
        setNotice('');
        void refresh();
        clearTimeout(timer.current);
        timer.current = setTimeout(cancel, 120000);
      }),
      listen<{ ok: boolean; message: string }>('browser-result', (e) => {
        clearTimeout(timer.current);
        setBusy(false);
        if (e.payload.ok) {
          setNotice(e.payload.message);
          setState({ available: false });
          timer.current = setTimeout(cancel, 1800);
        } else {
          setError(e.payload.message || t('Compilazione non riuscita. Richiama il pannello.'));
          void refresh();
        }
      }),
      listen('vault-locked', () => {
        setPassword('');
        void refresh();
      }),
      listen('save-changed', () => {
        setPassword('');
        setError('');
        setBusy(false);
        void refresh();
      }),
      listen('passkey-changed', () => {
        setPassword('');
        setError('');
        setNotice('');
        setBusy(false);
        setSelected(0);
        void refresh();
      }),
    ];
    const interval = setInterval(() => {
      if (active.current) void refresh();
    }, 3000);
    return () => {
      listeners.forEach((p) => {
        void p.then((fn) => fn());
      });
      clearInterval(interval);
      clearTimeout(timer.current);
    };
  }, [refresh, cancel]);
  const unlock = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('unlock', { password });
      setPassword('');
      await refresh();
    } catch (err) {
      setError(translateMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const unlockForm = (
    <form className="quick-unlock" onSubmit={unlock}>
      <Lock size={28} />
      <h2>{t('Sblocca il vault')}</h2>
      <p>{t('La password principale rimane nell’app.')}</p>
      <input
        key={passkey.active ? passkey.rpId : save.active ? save.site : state.domain}
        autoFocus
        type="password"
        autoComplete="off"
        aria-label={t('Password principale')}
        placeholder={t('Password principale')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="primary wide" disabled={busy || !password}>
        {busy ? t('Sblocco…') : t('Sblocca e continua')}
        <ArrowRight size={17} />
      </button>
    </form>
  );
  // Built here, returned after the last hook below (hooks must keep their order).
  const passkeyView = (() => {
    if (!passkey.active) return null;
    const candidates = passkey.candidates || [];
    const pick = Math.min(selected, Math.max(0, candidates.length - 1));
    const account = passkey.userName || passkey.userDisplay || t('account senza nome');
    return (
      <main
        className="quick-fill"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            void passkeyAction('passkey_cancel');
          }
          if (passkey.unlocked && passkey.op === 'get' && e.key === 'ArrowDown') {
            e.preventDefault();
            setSelected((pick + 1) % Math.max(1, candidates.length));
          }
          if (passkey.unlocked && passkey.op === 'get' && e.key === 'ArrowUp') {
            e.preventDefault();
            setSelected((pick + candidates.length - 1) % Math.max(1, candidates.length));
          }
        }}
      >
        <header className="quick-heading">
          <span className="quick-emblem">
            <Fingerprint size={23} />
          </span>
          <div>
            <strong>{t('JesseArchive')}</strong>
            <small>{passkey.op === 'create' ? t('Nuova passkey') : t('Accesso con passkey')}</small>
          </div>
          <button
            className="icon-button"
            aria-label={t('Annulla')}
            onClick={() => void passkeyAction('passkey_cancel')}
          >
            <X size={19} />
          </button>
        </header>
        <div className="quick-domain">
          <ShieldCheck size={16} />
          <strong>{passkey.rpId}</strong>
          <span>{t('HTTPS')}</span>
        </div>
        {!passkey.unlocked ? (
          unlockForm
        ) : passkey.op === 'create' ? (
          <div className="quick-message">
            <Fingerprint size={32} />
            <h2>{t('Salvare una passkey?')}</h2>
            <p>
              {tRich(
                '{site} chiede di creare una passkey per {account}. Verrà salvata cifrata nel vault di Jesse’s Archive.',
                { site: passkey.rpName || passkey.rpId, account: <strong>{account}</strong> },
              )}
            </p>
            {passkey.existing && (
              <p className="quick-error">
                {t('Per questo account esiste già una passkey in Jesse’s Archive.')}
              </p>
            )}
            <button
              className="primary wide"
              autoFocus
              disabled={busy}
              onClick={() => void passkeyAction('passkey_approve')}
            >
              {t('Salva in Jesse’s Archive')}
              <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <div className="quick-accounts" role="listbox" aria-label={t('Passkey per il sito')}>
            {candidates.map((a, i) => (
              <button
                key={a.id}
                role="option"
                aria-selected={i === pick}
                autoFocus={i === pick}
                disabled={busy}
                className={`quick-account ${i === pick ? 'selected' : ''}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => void passkeyAction('passkey_approve', { id: a.id })}
              >
                <span className="quick-emblem">
                  <Fingerprint size={18} />
                </span>
                <span>
                  <strong>{a.title}</strong>
                  <small>{a.username || t('Account senza nome')}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
            {!candidates.length && (
              <p className="quick-empty">
                {t('Nessuna passkey di Jesse’s Archive per questo sito.')}
              </p>
            )}
          </div>
        )}
        <button
          className="secondary wide"
          disabled={busy}
          onClick={() => void passkeyAction('passkey_fallback')}
        >
          <Smartphone size={16} />
          {t('Usa un altro dispositivo (telefono, Windows Hello…)')}
        </button>
        {error && (
          <p className="quick-error" role="alert">
            {error}
          </p>
        )}
        <footer className="quick-footer">
          <span>{busy ? t('Elaborazione…') : t('Invio Conferma · Esc Annulla')}</span>
          <small>{t('Ogni uso richiede la tua conferma')}</small>
        </footer>
      </main>
    );
  })();
  const saveAction = async (command: string, args: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await invoke(command, args);
      setSave({ active: false });
      saveKey.current = '';
    } catch (e) {
      setError(translateMessage(e));
      void refresh();
    } finally {
      setBusy(false);
    }
  };
  const approveSave = () => {
    const fields = save.fields || [];
    void saveAction('browser_save_approve', {
      title: saveTitle,
      username: saveUser,
      notes: saveNotes.map((index) => ({ index, label: fieldLabel(fields[index], index) })),
    });
  };
  // Built here, returned after the last hook below (hooks must keep their order).
  const saveView = (() => {
    if (!save.active) return null;
    const fields = save.fields || [];
    // Values that can be the login username.
    const candidates = [
      ...new Set(
        fields
          .filter((f) => ['text', 'email', 'tel'].includes(f.type) && f.value)
          .map((f) => f.value),
      ),
    ];
    const update = save.mode === 'update';
    return (
      <main
        className="quick-fill quick-save"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            void saveAction('browser_save_dismiss', { never: false });
          }
        }}
      >
        <header className="quick-heading">
          <span className="quick-emblem">
            <UserPlus size={23} />
          </span>
          <div>
            <strong>{t('JesseArchive')}</strong>
            <small>{update ? t('Aggiorna password') : t('Nuovo account')}</small>
          </div>
          <button
            className="icon-button"
            aria-label={t('Non ora')}
            onClick={() => void saveAction('browser_save_dismiss', { never: false })}
          >
            <X size={19} />
          </button>
        </header>
        <div className="quick-domain">
          <ShieldCheck size={16} />
          <strong>{save.site}</strong>
          <span>{t('HTTPS')}</span>
        </div>
        {!save.unlocked ? (
          unlockForm
        ) : (
          <form
            className="quick-save-form"
            onSubmit={(e) => {
              e.preventDefault();
              approveSave();
            }}
          >
            <h2>{update ? t('Aggiornare la password?') : t('Salvare questo account?')}</h2>
            <p>
              {update
                ? tRich(
                    'La password inserita su {site} è diversa da quella salvata in {account}.',
                    { site: save.site, account: <strong>{save.title}</strong> },
                  )
                : tRich('Hai inserito delle credenziali su {site}: salvale cifrate nel vault.', {
                    site: <strong>{save.site}</strong>,
                  })}
            </p>
            {!update && (
              <>
                <label>
                  {t('Nome')}
                  <input
                    value={saveTitle}
                    maxLength={120}
                    onChange={(e) => setSaveTitle(e.target.value)}
                  />
                </label>
                <label>
                  {t('Username o email')}
                  {candidates.length > 1 ? (
                    <select
                      value={saveUser}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSaveUser(value);
                        // The field used as username is not repeated in the notes.
                        setSaveNotes(
                          fields.map((_, i) => i).filter((i) => fields[i].value !== value),
                        );
                      }}
                    >
                      {candidates.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={saveUser}
                      maxLength={256}
                      placeholder={t('Facoltativo')}
                      onChange={(e) => setSaveUser(e.target.value)}
                    />
                  )}
                </label>
                <p className="quick-save-password">
                  <KeyRound size={15} />
                  {t('Password: quella inserita nel modulo')}
                </p>
                {fields.some((f) => f.value !== saveUser) && (
                  <fieldset>
                    <legend>{t('Salva anche nelle note')}</legend>
                    {fields.map((f, i) =>
                      f.value === saveUser ? null : (
                        <label key={i} className="check-line">
                          <input
                            type="checkbox"
                            checked={saveNotes.includes(i)}
                            onChange={(e) =>
                              setSaveNotes((n) =>
                                e.target.checked ? [...n, i] : n.filter((x) => x !== i),
                              )
                            }
                          />
                          <span>
                            {fieldLabel(f, i)}: <strong>{f.value}</strong>
                          </span>
                        </label>
                      ),
                    )}
                  </fieldset>
                )}
              </>
            )}
            <button className="primary wide" autoFocus={update} disabled={busy}>
              {update ? t('Aggiorna password') : t('Salva in Jesse’s Archive')}
              <ArrowRight size={17} />
            </button>
            <div className="quick-save-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void saveAction('browser_save_dismiss', { never: false })}
              >
                {t('Non ora')}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void saveAction('browser_save_dismiss', { never: true })}
              >
                {t('Mai per questo sito')}
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="quick-error" role="alert">
            {error}
          </p>
        )}
        <footer className="quick-footer">
          <span>{busy ? t('Elaborazione…') : t('Invio Salva · Esc Non ora')}</span>
          <small>{t('Niente viene salvato senza la tua conferma')}</small>
        </footer>
      </main>
    );
  })();
  const accounts = (state.accounts || []).filter((a) =>
    `${a.title} ${a.username}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const index = Math.min(selected, Math.max(0, accounts.length - 1));
  useEffect(() => {
    document.querySelector('.quick-account.selected')?.scrollIntoView({ block: 'nearest' });
  }, [index]);
  // The backend drops an unanswered save request after a few minutes.
  const saveExpires = save.active ? save.expires : undefined;
  useEffect(() => {
    if (saveExpires === undefined) return;
    const timeout = setTimeout(() => void refresh(), (saveExpires + 1) * 1000);
    return () => clearTimeout(timeout);
  }, [saveExpires, refresh]);
  if (passkeyView) return passkeyView;
  if (saveView) return saveView;
  const fill = async (account: Account) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await invoke('browser_fill', { id: account.id });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setBusy(false);
        setError(t('Il browser non ha confermato. Richiama il pannello dal campo di accesso.'));
      }, 10000);
    } catch (e) {
      setError(translateMessage(e));
      setBusy(false);
      void refresh();
    }
  };
  return (
    <main
      className="quick-fill"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
        if (state.unlocked && e.key === 'ArrowDown') {
          e.preventDefault();
          setSelected((index + 1) % Math.max(1, accounts.length));
        }
        if (state.unlocked && e.key === 'ArrowUp') {
          e.preventDefault();
          setSelected((index + accounts.length - 1) % Math.max(1, accounts.length));
        }
        if (state.unlocked && e.key === 'Enter' && accounts[index]) {
          e.preventDefault();
          void fill(accounts[index]);
        }
      }}
    >
      <header className="quick-heading">
        <span className="quick-emblem">
          <KeyRound size={23} />
        </span>
        <div>
          <strong>{t('JesseArchive')}</strong>
          <small>{t('Inserimento rapido')}</small>
        </div>
        <button className="icon-button" aria-label={t('Chiudi')} onClick={cancel}>
          <X size={19} />
        </button>
      </header>
      {state.available && (
        <div className="quick-domain">
          <ShieldCheck size={16} />
          <strong>{state.domain}</strong>
          <span>{t('HTTPS')}</span>
        </div>
      )}
      {notice ? (
        <div className="quick-message" role="status">
          <ShieldCheck size={32} />
          <p>{notice}</p>
        </div>
      ) : !state.available ? (
        <div className="quick-message">
          <KeyRound size={32} />
          <h2>{t('Seleziona un campo di accesso')}</h2>
          <p>
            {t(
              'Apri un sito HTTPS nel browser collegato, seleziona username o password e premi la scorciatoia. Verifica l’estensione nelle Impostazioni se il browser non risponde.',
            )}
          </p>
        </div>
      ) : !state.unlocked ? (
        unlockForm
      ) : (
        <>
          <label className="quick-search">
            <Search size={17} />
            <input
              autoFocus
              aria-label={t('Cerca account')}
              placeholder={t('Cerca account…')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
              }}
            />
          </label>
          <div className="quick-accounts" role="listbox" aria-label={t('Account per il sito')}>
            {accounts.map((a, i) => (
              <button
                key={a.id}
                role="option"
                aria-selected={i === index}
                disabled={busy}
                className={`quick-account ${i === index ? 'selected' : ''}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => void fill(a)}
              >
                <span className="quick-emblem">
                  <KeyRound size={18} />
                </span>
                <span>
                  <strong>{a.title}</strong>
                  <small>{a.username || t('Username non impostato')}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
            {!accounts.length && (
              <p className="quick-empty">
                {t(
                  'Nessun account associato a questo sito. Verifica il dominio o il sito web salvato negli account di JesseArchive.',
                )}
              </p>
            )}
          </div>
        </>
      )}
      {error && (
        <p className="quick-error" role="alert">
          {error}
        </p>
      )}
      <footer className="quick-footer">
        <span>{busy ? t('Elaborazione…') : t('↑ ↓ Seleziona · Invio Inserisci · Esc Chiudi')}</span>
        <small>{t('Nessun invio automatico del login')}</small>
      </footer>
    </main>
  );
}
