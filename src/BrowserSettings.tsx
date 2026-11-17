import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
type Connection = { shortcut: string; connected: number; error: string; extension_id: string };
export default function BrowserSettings() {
  const [state, setState] = useState<Connection | null>(null),
    [shortcut, setShortcut] = useState('Ctrl+Alt+J'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    const s = await invoke<Connection>('browser_status');
    setState(s);
    return s;
  };
  useEffect(() => {
    void refresh()
      .then((s) => setShortcut(s.shortcut))
      .catch((e) => setMessage(String(e)));
    const timer = setInterval(() => {
      void refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, []);
  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      await refresh();
      setMessage(success);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="form-stack browser-settings">
      <h3>Inserimento rapido nel browser</h3>
      <p>
        Chrome, Edge, Brave, Opera, Vivaldi e Firefox. Seleziona un campo di accesso sul sito e
        premi la scorciatoia.
      </p>
      <label className="field">
        <span>Scorciatoia globale</span>
        <input
          value={shortcut}
          onChange={(e) => setShortcut(e.target.value)}
          placeholder="Ctrl+Alt+J"
          onKeyDown={(e) => {
            if (['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'Backspace', 'Delete'].includes(e.key))
              return;
            if (e.ctrlKey || e.altKey || e.metaKey) {
              e.preventDefault();
              setShortcut(
                [
                  e.ctrlKey && 'Ctrl',
                  e.altKey && 'Alt',
                  e.shiftKey && 'Shift',
                  e.metaKey && 'Super',
                  e.code.startsWith('Key') ? e.code.slice(3) : e.code,
                ]
                  .filter(Boolean)
                  .join('+'),
              );
            }
          }}
        />
      </label>
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          void run(() => invoke('browser_shortcut', { shortcut }), 'Scorciatoia salvata')
        }
      >
        Salva scorciatoia
      </button>
      {state?.error && <p role="alert">Scorciatoia non attiva: {state.error}</p>}
      <button
        className="primary"
        disabled={busy}
        onClick={() =>
          void run(() => invoke('browser_setup_show'), 'Configurazione browser aperta')
        }
      >
        Configura i browser
      </button>
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          void run(
            () => invoke('browser_install'),
            'Collegamento registrato. Installa l’estensione e riavvia il browser.',
          )
        }
      >
        Ripara collegamento browser
      </button>
      <button
        className="secondary"
        onClick={() =>
          void run(() => invoke('browser_open_extensions'), 'Cartella estensioni aperta')
        }
      >
        Apri cartella estensioni
      </button>
      <p role="status">
        {state?.connected
          ? `${state.connected} collegamenti browser attivi`
          : 'Nessun browser collegato'}
      </p>
      <p className="helper">
        La procedura guidata rileva i browser, configura il collegamento e apre pagina e cartella
        corrette. Devi solo confermare il caricamento locale nel browser. Per Firefox il caricamento
        senza firma rimane temporaneo.
      </p>
      {message && <p role="status">{message}</p>}
      <div className="divider" />
    </div>
  );
}
