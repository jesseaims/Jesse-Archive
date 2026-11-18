/** Settings → "Ricerca rapida globale": a device preference saved by the backend. */
import { t, translateMessage } from '../i18n';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ShortcutInput from '../ShortcutInput';
import type { QuickSearchSettings as Settings } from './QuickSearch';

type Status = { settings: Settings; default_shortcut: string; active: boolean; error: string };

export default function QuickSearchSettings() {
  const [status, setStatus] = useState<Status | null>(null),
    [shortcut, setShortcut] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void invoke<Status>('quick_search_settings')
      .then((s) => {
        setStatus(s);
        setShortcut(s.settings.shortcut);
      })
      .catch((e) => setMessage(translateMessage(e)));
  }, []);
  if (!status) return message ? <p role="alert">{message}</p> : null;
  const settings = status.settings;

  /** Saves; on error (e.g. shortcut taken) nothing changes. */
  const save = async (patch: Partial<Settings>, success: string) => {
    setBusy(true);
    setMessage('');
    try {
      const next = await invoke<Status>('quick_search_configure', {
        settings: { ...settings, ...patch },
      });
      setStatus(next);
      setShortcut(next.settings.shortcut);
      setMessage(success);
    } catch (e) {
      setMessage(translateMessage(e));
      if (patch.shortcut === undefined) setShortcut(settings.shortcut);
    } finally {
      setBusy(false);
    }
  };
  const check = (key: keyof Settings, label: string) => (
    <label className="check-line">
      <input
        type="checkbox"
        disabled={busy || (key !== 'enabled' && !settings.enabled)}
        checked={!!settings[key]}
        onChange={(e) => void save({ [key]: e.target.checked }, t('Impostazioni salvate'))}
      />
      {label}
    </label>
  );

  return (
    <div className="form-stack quick-search-settings">
      <p>
        {t(
          'Una finestra di ricerca che si apre con una scorciatoia da qualsiasi applicazione, anche con Jesse’s Archive ridotto a icona o nell’area di notifica. Funziona solo con il vault sbloccato.',
        )}
      </p>
      {check('enabled', t('Attiva la ricerca rapida globale'))}
      <ShortcutInput
        label={t('Scorciatoia globale')}
        value={shortcut}
        onChange={setShortcut}
        placeholder={status.default_shortcut}
      />
      <div className="button-row">
        <button
          className="secondary"
          disabled={busy || !settings.enabled || !shortcut}
          onClick={() => void save({ shortcut }, t('Scorciatoia salvata'))}
        >
          {t('Salva scorciatoia')}
        </button>
        <button
          className="secondary"
          disabled={busy || !settings.enabled || settings.shortcut === status.default_shortcut}
          onClick={() =>
            void save(
              { shortcut: status.default_shortcut },
              t('Scorciatoia predefinita ripristinata'),
            )
          }
        >
          {t('Ripristina predefinita')}
        </button>
      </div>
      {settings.enabled &&
        (status.active ? (
          <p role="status">
            {t('Scorciatoia attiva: {shortcut}', { shortcut: settings.shortcut })}
          </p>
        ) : (
          <p role="alert">
            {t('Scorciatoia non attiva:')} {translateMessage(status.error)}
          </p>
        ))}
      {check('close_after', t('Chiudi la finestra dopo un’azione'))}
      {check('favorites', t('Mostra i preferiti quando la ricerca è vuota'))}
      {check('recent', t('Mostra gli elementi usati di recente'))}
      {check('categories', t('Cerca anche per categoria e cartella'))}
      <button
        className="secondary"
        disabled={busy || !settings.enabled || !settings.recent}
        onClick={() => {
          invoke('quick_search_clear_recent')
            .then(() => setMessage(t('Elenco degli usati di recente cancellato')))
            .catch((e) => setMessage(translateMessage(e)));
        }}
      >
        {t('Cancella gli usati di recente')}
      </button>
      <p className="helper">
        {t(
          'Gli elementi usati di recente sono salvati nel vault cifrato (solo quali elementi, mai le password), restano dopo il riavvio e sono gli stessi del widget «Usati di recente» della Dashboard. Per avere la ricerca rapida sempre pronta, attiva «Avvia con Windows» nella sezione Desktop.',
        )}
      </p>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
