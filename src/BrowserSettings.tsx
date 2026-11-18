import { t, translateMessage } from './i18n';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
type Connection = { shortcut: string; connected: number; error: string; extension_id: string };
export default function BrowserSettings() {
  const [state, setState] = useState<Connection | null>(null),
    [shortcut, setShortcut] = useState('Ctrl+Alt+J'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [passkeys, setPasskeys] = useState(true);
  useEffect(() => {
    void invoke<{ enabled: boolean }>('passkey_settings')
      .then((s) => setPasskeys(s.enabled))
      .catch(() => {});
  }, []);
  const refresh = async () => {
    const s = await invoke<Connection>('browser_status');
    setState(s);
    return s;
  };
  useEffect(() => {
    void refresh()
      .then((s) => setShortcut(s.shortcut))
      .catch((e) => setMessage(translateMessage(e)));
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
      setMessage(translateMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="form-stack browser-settings">
      <h3>{t('Inserimento rapido nel browser')}</h3>
      <p>
        {t(
          'Chrome, Edge, Brave, Opera, Vivaldi e Firefox. Seleziona un campo di accesso sul sito e premi la scorciatoia.',
        )}
      </p>
      <label className="field">
        <span>{t('Scorciatoia globale')}</span>
        <input
          value={shortcut}
          onChange={(e) => setShortcut(e.target.value)}
          placeholder={t('Ctrl+Alt+J')}
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
        {t('Salva scorciatoia')}
      </button>
      {state?.error && (
        <p role="alert">
          {t('Scorciatoia non attiva:')} {state.error}
        </p>
      )}
      <label className="check-line">
        <input
          type="checkbox"
          checked={passkeys}
          onChange={(e) => {
            const enabled = e.target.checked;
            void run(
              async () => {
                await invoke('passkey_set_enabled', { enabled });
                setPasskeys(enabled);
              },
              enabled
                ? t('Passkey attivate')
                : t('Passkey disattivate: i siti useranno il browser'),
            );
          }}
        />
        {t('Usa Jesse’s Archive per le passkey dei siti (richiede l’estensione aggiornata)')}
      </label>
      <button
        className="primary"
        disabled={busy}
        onClick={() =>
          void run(() => invoke('browser_setup_show'), t('Configurazione browser aperta'))
        }
      >
        {t('Configura i browser')}
      </button>
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          void run(
            () => invoke('browser_install'),
            t('Collegamento registrato. Installa l’estensione e riavvia il browser.'),
          )
        }
      >
        {t('Ripara collegamento browser')}
      </button>
      <button
        className="secondary"
        onClick={() =>
          void run(() => invoke('browser_open_extensions'), t('Cartella estensioni aperta'))
        }
      >
        {t('Apri cartella estensioni')}
      </button>
      <p role="status">
        {state?.connected
          ? t('Collegamenti browser attivi: {n}', { n: state.connected })
          : t('Nessun browser collegato')}
      </p>
      <p className="helper">
        {t(
          'La procedura guidata rileva i browser, configura il collegamento e apre pagina e cartella corrette. Devi solo confermare il caricamento locale nel browser. Per Firefox il caricamento senza firma rimane temporaneo.',
        )}
      </p>
      {message && <p role="status">{message}</p>}
      <div className="divider" />
    </div>
  );
}
