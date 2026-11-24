import { t, tRich, translateMessage } from './i18n';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Check, Copy, ExternalLink, Globe, ShieldCheck, Wrench } from 'lucide-react';
import { copyText } from './api';
import { applyPalette } from './theme';
type Browser = {
  id: string;
  name: string;
  page: string;
  installed: boolean;
  folder: string | null;
};
type Status = { helper: boolean; browsers: Browser[] };
export default function BrowserInstaller() {
  const [status, setStatus] = useState<Status | null>(null),
    [registered, setRegistered] = useState(false),
    [selected, setSelected] = useState<Browser | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [pageCopied, setPageCopied] = useState(false),
    [store, setStore] = useState(''),
    [storeCopied, setStoreCopied] = useState(false),
    [manual, setManual] = useState(false);
  useEffect(() => {
    applyPalette({ preset: 'night' });
    void invoke<Status>('browser_setup_status')
      .then(setStatus)
      .catch((e) => setError(translateMessage(e)));
    void invoke('browser_install')
      .then(() => setRegistered(true))
      .catch((e) => setError(translateMessage(e)));
  }, []);
  // Store page of the extension (Chrome Web Store or addons.mozilla.org) in the chosen browser.
  const openStore = async (browser: Browser) => {
    setBusy(true);
    setError('');
    setStoreCopied(false);
    setSelected(browser);
    setManual(false);
    try {
      const opened = await invoke<{ url: string }>('browser_store_open', { id: browser.id });
      setStore(opened.url);
      setRegistered(true);
    } catch (e) {
      setError(translateMessage(e));
    } finally {
      setBusy(false);
    }
  };
  // Manual installation: extensions page and the extension folder of the app.
  const open = async (browser: Browser) => {
    setBusy(true);
    setError('');
    setCopied(false);
    setPageCopied(false);
    setSelected(browser);
    try {
      await invoke('browser_setup_open', { id: browser.id });
      setSelected(browser);
      setRegistered(true);
      if (browser.folder) {
        try {
          await copyText(
            browser.id === 'firefox' ? browser.folder + '\\manifest.json' : browser.folder,
          );
          setCopied(true);
        } catch {
          /* The folder remains visible and the copy button can be retried. */
        }
      }
    } catch (e) {
      setError(translateMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const installPath = selected?.folder
    ? selected.id === 'firefox'
      ? selected.folder + '\\manifest.json'
      : selected.folder
    : '';
  return (
    <main className="browser-wizard">
      <header>
        <span className="quick-emblem">
          <Globe size={25} />
        </span>
        <div>
          <h1>{t('Collega i tuoi browser')}</h1>
          <p>{t('Configura una volta l’estensione per inserire le credenziali dal vault.')}</p>
        </div>
      </header>
      <section className="browser-wizard-step">
        <ShieldCheck size={22} />
        <div>
          <h2>{t('1. Collegamento con JesseArchive')}</h2>
          <p role="status">
            {registered
              ? t('Configurato automaticamente per il tuo utente Windows.')
              : t('Preparazione del collegamento locale…')}
          </p>
          {registered && (
            <span className="browser-ready">
              <Check size={14} />
              {t('Pronto')}
            </span>
          )}
        </div>
      </section>
      <section className="browser-wizard-step">
        <Globe size={22} />
        <div>
          <h2>{t('2. Scegli il browser')}</h2>
          <p>{t('Apriamo la pagina dell’estensione nello store ufficiale del browser scelto.')}</p>
          <div className="browser-choices">
            {status?.browsers.map((b) => (
              <button
                className="secondary"
                key={b.id}
                disabled={busy || !b.installed || !status.helper}
                onClick={() => void openStore(b)}
              >
                {b.name}
                {b.installed ? <ExternalLink size={14} /> : <small>{t('Non rilevato')}</small>}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="browser-wizard-step">
        <Check size={22} />
        <div>
          <h2>
            {t('3. Aggiungi l’estensione')}
            {selected ? ` · ${selected.name}` : ''}
          </h2>
          <p>
            {tRich('Nella pagina dello store premi {button} e conferma.', {
              button: (
                <strong>
                  {selected?.id === 'firefox' ? t('Aggiungi a Firefox') : t('Aggiungi a Chrome')}
                </strong>
              ),
            })}
          </p>
          {selected?.id === 'edge' && (
            <p className="browser-note">
              {t('Edge può chiedere di consentire le estensioni da altri store: accetta.')}
            </p>
          )}
          {selected?.id === 'opera' && (
            <p className="browser-note">
              {t(
                'Opera può chiedere di installare prima il supporto per le estensioni del Chrome Web Store: accetta.',
              )}
            </p>
          )}
          <p className="helper">
            {t(
              'Se avevi caricato l’estensione a mano, rimuovila dalla pagina delle estensioni del browser, così non restano due copie.',
            )}
          </p>
          {selected && store && (
            <div className="browser-folder">
              <code>{store}</code>
              <button
                className="secondary"
                onClick={() =>
                  void copyText(store)
                    .then(() => setStoreCopied(true))
                    .catch((e) => setError(translateMessage(e)))
                }
              >
                <Copy size={14} />
                {storeCopied ? t('Copiato') : t('Copia indirizzo pagina')}
              </button>
            </div>
          )}
        </div>
      </section>
      {selected && (
        <section className="browser-wizard-step">
          <Wrench size={22} />
          <div>
            <h2>{t('Installazione manuale (senza store)')}</h2>
            {!manual ? (
              <>
                <p>
                  {t(
                    'In alternativa puoi caricare l’estensione dalla cartella dell’app. Si aggiorna insieme all’app.',
                  )}
                </p>
                <div className="browser-folder">
                  <button
                    className="secondary"
                    disabled={busy || !selected.folder}
                    onClick={() => {
                      setManual(true);
                      void open(selected);
                    }}
                  >
                    {t('Apri pagina estensioni')}
                  </button>
                </div>
              </>
            ) : selected.id === 'firefox' ? (
              <>
                <p>
                  {tRich(
                    'In «Questo Firefox» premi {button} e seleziona {file} nella cartella aperta.',
                    {
                      button: <strong>{t('Carica componente aggiuntivo temporaneo')}</strong>,
                      file: <strong>manifest.json</strong>,
                    },
                  )}
                </p>
                <p className="browser-note">
                  {t(
                    'Questa versione Firefox deve essere caricata di nuovo al riavvio del browser. Per renderla permanente serve la firma Mozilla.',
                  )}
                </p>
              </>
            ) : (
              <p>
                {tRich(
                  'Attiva {developer}, premi {load} e seleziona la cartella {folder} che abbiamo aperto.',
                  {
                    developer: <strong>{t('Modalità sviluppatore')}</strong>,
                    load: <strong>{t('Carica estensione non pacchettizzata')}</strong>,
                    folder: <strong>chromium</strong>,
                  },
                )}
              </p>
            )}
            {manual && (
              <div className="browser-folder">
                <code>{selected.page}</code>
                <button
                  className="secondary"
                  onClick={() =>
                    void copyText(selected.page)
                      .then(() => setPageCopied(true))
                      .catch((e) => setError(translateMessage(e)))
                  }
                >
                  <Copy size={14} />
                  {pageCopied ? t('Copiato') : t('Copia indirizzo pagina')}
                </button>
                <button className="secondary" disabled={busy} onClick={() => void open(selected)}>
                  {t('Apri pagina estensioni')}
                </button>
              </div>
            )}
            {manual && selected.folder && (
              <div className="browser-folder">
                <code>{installPath}</code>
                <button
                  className="secondary"
                  onClick={() =>
                    void copyText(installPath)
                      .then(() => setCopied(true))
                      .catch((e) => setError(translateMessage(e)))
                  }
                >
                  <Copy size={14} />
                  {copied ? t('Copiato') : t('Copia percorso')}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <footer>
        <strong>{t('Ora seleziona un campo di accesso e premi Ctrl+Alt+J.')}</strong>
        <p>
          {t(
            'Puoi cambiare la scorciatoia nelle Impostazioni. JesseArchive deve rimanere aperto, anche nell’area di notifica.',
          )}
        </p>
        <p className="helper">
          {t(
            'La copia dello store si aggiorna dallo store; quella caricata a mano si aggiorna con l’app.',
          )}
        </p>
        <button
          className="primary browser-finish"
          disabled={busy}
          onClick={() => {
            setError('');
            void invoke('browser_setup_finish').catch((e) => setError(translateMessage(e)));
          }}
        >
          <Check size={16} />
          {t('Ho installato l’estensione: apri Jesse’s Archive')}
        </button>
      </footer>
    </main>
  );
}
