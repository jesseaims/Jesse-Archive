import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { KeyRound, Lock, Search, ShieldCheck, X, ArrowRight } from 'lucide-react';
import { api } from './api';
import { applyPalette } from './theme';
type Account = { id: string; title: string; username: string };
type Snapshot = { available: boolean; unlocked?: boolean; domain?: string; accounts?: Account[] };
export default function QuickFill() {
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
    } catch (e) {
      setError(String(e));
    }
  }, []);
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
          setError(e.payload.message || 'Compilazione non riuscita. Richiama il pannello.');
          void refresh();
        }
      }),
      listen('vault-locked', () => {
        setPassword('');
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
  const accounts = (state.accounts || []).filter((a) =>
    `${a.title} ${a.username}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const index = Math.min(selected, Math.max(0, accounts.length - 1));
  useEffect(() => {
    document.querySelector('.quick-account.selected')?.scrollIntoView({ block: 'nearest' });
  }, [index]);
  const fill = async (account: Account) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await invoke('browser_fill', { id: account.id });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setBusy(false);
        setError('Il browser non ha confermato. Richiama il pannello dal campo di accesso.');
      }, 10000);
    } catch (e) {
      setError(String(e));
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
          <strong>JesseArchive</strong>
          <small>Inserimento rapido</small>
        </div>
        <button className="icon-button" aria-label="Chiudi" onClick={cancel}>
          <X size={19} />
        </button>
      </header>
      {state.available && (
        <div className="quick-domain">
          <ShieldCheck size={16} />
          <strong>{state.domain}</strong>
          <span>HTTPS</span>
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
          <h2>Seleziona un campo di accesso</h2>
          <p>
            Apri un sito HTTPS nel browser collegato, seleziona username o password e premi la
            scorciatoia. Verifica l’estensione nelle Impostazioni se il browser non risponde.
          </p>
        </div>
      ) : !state.unlocked ? (
        <form
          className="quick-unlock"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api('unlock', { password });
              setPassword('');
              await refresh();
            } catch (err) {
              setError(String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Lock size={28} />
          <h2>Sblocca il vault</h2>
          <p>La password principale rimane nell’app.</p>
          <input
            key={state.domain}
            autoFocus
            type="password"
            autoComplete="off"
            aria-label="Password principale"
            placeholder="Password principale"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="primary wide" disabled={busy || !password}>
            {busy ? 'Sblocco…' : 'Sblocca e continua'}
            <ArrowRight size={17} />
          </button>
        </form>
      ) : (
        <>
          <label className="quick-search">
            <Search size={17} />
            <input
              autoFocus
              aria-label="Cerca account"
              placeholder="Cerca account…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
              }}
            />
          </label>
          <div className="quick-accounts" role="listbox" aria-label="Account per il sito">
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
                  <small>{a.username || 'Username non impostato'}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
            {!accounts.length && (
              <p className="quick-empty">
                Nessun account associato a questo sito. Verifica il dominio o il sito web salvato
                negli account di JesseArchive.
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
        <span>{busy ? 'Elaborazione…' : '↑ ↓ Seleziona · Invio Inserisci · Esc Chiudi'}</span>
        <small>Nessun invio automatico del login</small>
      </footer>
    </main>
  );
}
