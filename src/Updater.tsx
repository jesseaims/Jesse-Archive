import { t, translateMessage } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Download, RefreshCw } from 'lucide-react';

// Automatic updates: the backend (src-tauri/src/updater.rs) verifies the Ed25519
// signature, version, size and SHA-256; the UI only asks for confirmation.
type UpdateSettingsState = { current: string; auto: boolean; configured: boolean };
export type UpdateInfo = {
  available: boolean;
  current: string;
  version: string;
  size?: number;
  notes?: string;
};
type Dialogs = {
  askConfirm: (
    message: string,
    opts?: { title?: string; danger?: boolean; confirmLabel?: string },
  ) => Promise<boolean>;
  showNotice: (message: string, title?: string, danger?: boolean) => Promise<void>;
};

const DAY = 24 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY = 15 * 1000;
const IDLE_EVENT = 'jesse-update-idle';

const megabytes = (bytes = 0) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

// Release notes (scripts/release-notes.mjs) are Markdown, shown here as plain text:
// only the "Novità" part (the "Installazione" steps are for manual downloads), with
// headings, bold, italics and links reduced to their text.
export function summary(notes = '') {
  const news = /^##\s+Novità\s*$([\s\S]*?)(?=^##\s|$(?![\s\S]))/m.exec(notes);
  const text = (news ? news[1] : notes)
    .replace(/^#+\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/(^|[\s(«"'])[_*]([^_*\n]+?)[_*](?=$|[\s.,;:!?)»"'])/gm, '$1$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > 1200 ? `${text.slice(0, 1200).trimEnd()}…` : text;
}

/** Asks for confirmation and installs: the app closes and the installer restarts it. */
export async function offerUpdate(info: UpdateInfo, { askConfirm, showNotice }: Dialogs) {
  const notes = summary(info.notes);
  const ok = await askConfirm(
    t("È disponibile Jesse's Archive {version} (installata: {current}).", {
      version: info.version,
      current: info.current,
    }) +
      // Release notes come from GitHub as written by the author (Italian).
      (notes ? '\n\n' + t('Novità:') + '\n' + notes : '') +
      '\n\n' +
      t(
        "Download: {size}. Il setup è firmato e verificato prima dell'installazione. Il vault verrà bloccato, Windows chiederà l'autorizzazione e l'app si riaprirà al termine.",
        { size: megabytes(info.size) },
      ),
    { title: t('Aggiornamento disponibile'), confirmLabel: t('Aggiorna ora') },
  );
  if (!ok) return false;
  try {
    await invoke('update_install', { version: info.version });
    return true;
  } catch (e) {
    window.dispatchEvent(new Event(IDLE_EVENT));
    await showNotice(translateMessage(e), t('Aggiornamento non riuscito'), true);
    return false;
  }
}

/**
 * Checks at startup (after a short delay) and then once a day, if enabled on this
 * device. An available version is offered only while the vault is unlocked (the
 * dialogs live in the main interface) and at most once per version per session.
 */
export function useAutoUpdate(unlocked: boolean, dialogs: Dialogs) {
  const [pending, setPending] = useState<UpdateInfo | null>(null);
  const offered = useRef(new Set<string>());
  const dialogsRef = useRef(dialogs);
  dialogsRef.current = dialogs;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let daily: ReturnType<typeof setInterval> | undefined;
    const check = () =>
      void invoke<UpdateInfo>('update_check')
        .then((info) => setPending(info.available ? info : null))
        .catch(() => {});
    void invoke<UpdateSettingsState>('update_settings')
      .then((s) => {
        if (!s.auto || !s.configured) return;
        timer = setTimeout(check, FIRST_CHECK_DELAY);
        daily = setInterval(check, DAY);
      })
      .catch(() => {});
    return () => {
      clearTimeout(timer);
      clearInterval(daily);
    };
  }, []);
  useEffect(() => {
    if (!pending || !unlocked || offered.current.has(pending.version)) return;
    offered.current.add(pending.version);
    void offerUpdate(pending, dialogsRef.current);
  }, [pending, unlocked]);
}

/** Download progress, shown above every page until the app closes. */
export function UpdateProgress() {
  const [progress, setProgress] = useState<{ received: number; total: number } | null>(null);
  useEffect(() => {
    const stop = listen<{ received: number; total: number }>('update-progress', (e) =>
      setProgress(e.payload),
    );
    const reset = () => setProgress(null);
    window.addEventListener(IDLE_EVENT, reset);
    return () => {
      void stop.then((fn) => fn());
      window.removeEventListener(IDLE_EVENT, reset);
    };
  }, []);
  if (!progress) return null;
  const percent = progress.total ? Math.floor((progress.received / progress.total) * 100) : 0;
  return (
    <div className="update-progress" role="status" aria-live="polite">
      <Download size={16} />
      {percent < 100
        ? t('Download aggiornamento: {percent}% ({received} di {total})', {
            percent,
            received: megabytes(progress.received),
            total: megabytes(progress.total),
          })
        : t('Verifica completata: avvio dell’installazione…')}
      <span className="update-progress-bar" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** "Aggiornamenti" panel in the settings. */
export function UpdateSettings(dialogs: Dialogs) {
  const [state, setState] = useState<UpdateSettingsState | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    void invoke<UpdateSettingsState>('update_settings')
      .then(setState)
      .catch((e) => setMessage(translateMessage(e)));
  }, []);
  const toggle = async (auto: boolean) => {
    try {
      await invoke('update_set_auto', { enabled: auto });
      setState((s) => (s ? { ...s, auto } : s));
      setMessage(
        auto ? t('Controllo automatico attivato.') : t('Controllo automatico disattivato.'),
      );
    } catch (e) {
      setMessage(translateMessage(e));
    }
  };
  const checkNow = async () => {
    setBusy(true);
    setMessage('');
    try {
      const info = await invoke<UpdateInfo>('update_check');
      if (info.available) await offerUpdate(info, dialogs);
      else setMessage(t("Hai già l'ultima versione ({version}).", { version: info.current }));
    } catch (e) {
      setMessage(translateMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel settings-panel">
      <div className="panel-head">
        <h2>
          <Download size={18} />
          {t('Aggiornamenti')}
        </h2>
      </div>
      <div className="form-stack">
        <label className="check-line">
          <input
            type="checkbox"
            checked={!!state?.auto}
            disabled={!state?.configured}
            onChange={(e) => void toggle(e.target.checked)}
          />
          {t("Controlla automaticamente (all'avvio e una volta al giorno)")}
        </label>
        <button
          className="secondary"
          disabled={busy || !state?.configured}
          onClick={() => void checkNow()}
        >
          <RefreshCw size={16} className={busy ? 'spin' : undefined} />
          {t('Cerca aggiornamenti')}
        </button>
        {message && <p>{message}</p>}
        <p>
          {state && !state.configured
            ? t('Aggiornamento automatico non disponibile in questa build.')
            : t(
                "Le nuove versioni vengono chieste a GitHub. Si installano solo dopo la tua conferma e solo se la firma dell'autore è valida.",
              )}
        </p>
      </div>
    </section>
  );
}
