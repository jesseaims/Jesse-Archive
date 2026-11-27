import { useEffect, useState } from 'react';
import { ArchiveRestore, Download, History, X } from 'lucide-react';
import { api, saveFile } from './api';
import { locale, t, translateMessage } from './i18n';
import { categories, type Item } from './types';

type Copy = { name: string; size: number | null; modified: number | null };
type Found = Item & { present?: boolean };

const when = (seconds: number | null) =>
  seconds
    ? new Date(seconds * 1000).toLocaleString(locale(), {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
const kb = (bytes: number | null) =>
  bytes == null ? '' : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(locale())} KB`;

/**
 * Settings → Data and backup: the daily copies of the encrypted vault kept on this PC
 * (`backups_list`). A copy can be saved elsewhere, or opened with the master password it
 * had to recover chosen items, which are added as new items (`backup_restore`): the
 * vault is never replaced, so synchronization cannot undo or mix the recovery.
 */
export default function BackupHistory({
  restore,
}: {
  /** `backup_restore` through the window's `mutate`: new state and notice; undefined on error. */
  restore: (body: { name: string; password: string; ids: string[] }) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [copies, setCopies] = useState<Copy[] | null>(null),
    [days, setDays] = useState(14),
    [chosen, setChosen] = useState<Copy | null>(null),
    [password, setPassword] = useState(''),
    [found, setFound] = useState<Found[] | null>(null),
    [ids, setIds] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');

  const load = () =>
    api<{ backups: Copy[]; days: number }>('backups_list')
      .then((r) => {
        setCopies(r.backups);
        setDays(r.days);
      })
      .catch((e) => setError(translateMessage(e)));
  useEffect(() => {
    void load();
  }, []);
  // The password typed for a copy is kept only while its dialog is open.
  const close = () => {
    setOpen(false);
    setChosen(null);
    setPassword('');
    setFound(null);
    setIds([]);
    setError('');
  };
  const task = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(translateMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openCopy = (copy: Copy) =>
    task(async () => {
      const r = await api<{ items: Found[] }>('backup_open', { name: copy.name, password });
      setFound(r.items);
    });

  return (
    <>
      <button
        className="secondary"
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        <History size={16} />
        {copies?.length
          ? t('Copie di sicurezza giornaliere ({n})', { n: copies.length })
          : t('Copie di sicurezza giornaliere')}
      </button>
      {open && (
        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h2>{chosen ? t('Recupera elementi') : t('Copie di sicurezza giornaliere')}</h2>
              <button className="icon-button" onClick={close} aria-label={t('Chiudi')}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              {!chosen && (
                <>
                  <p className="helper">
                    {t(
                      'Ogni giorno, al primo salvataggio, l’app conserva una copia cifrata del vault su questo PC, fuori dalla cartella del vault. Restano le ultime {n} giornate.',
                      { n: days },
                    )}
                  </p>
                  {copies && !copies.length && (
                    <p className="helper">
                      {t('Nessuna copia ancora: la prima verrà creata al prossimo salvataggio.')}
                    </p>
                  )}
                  <ul className="backup-list">
                    {copies?.map((c) => (
                      <li key={c.name}>
                        <span>
                          <strong>{when(c.modified)}</strong>
                          <small>{kb(c.size)}</small>
                        </span>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            void task(async () => {
                              const r = await api<{ text: string }>('backup_read', {
                                name: c.name,
                              });
                              await saveFile(`jesse_archive-${c.name}`, r.text);
                            })
                          }
                        >
                          <Download size={15} />
                          {t('Salva una copia altrove')}
                        </button>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => {
                            setChosen(c);
                            setError('');
                          }}
                        >
                          <ArchiveRestore size={15} />
                          {t('Recupera elementi')}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="helper">
                    {t(
                      'Le copie si aprono con la password principale che il vault aveva quel giorno. Quando cambi la chiave dei dati (password scoperta o nuovo codice di recupero) vengono eliminate.',
                    )}
                  </p>
                </>
              )}
              {chosen && !found && (
                <>
                  <p className="helper">
                    {t(
                      'Copia del {date}. Inserisci la password principale che usavi quel giorno.',
                      {
                        date: when(chosen.modified),
                      },
                    )}
                  </p>
                  <label className="field">
                    <span>{t('Password principale della copia')}</span>
                    <input
                      type="password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && password && !busy) void openCopy(chosen);
                      }}
                    />
                  </label>
                </>
              )}
              {chosen && found && (
                <>
                  <p className="helper">
                    {t(
                      'Scegli gli elementi da recuperare: vengono aggiunti al vault come elementi nuovi, senza toccare quelli attuali.',
                    )}
                  </p>
                  {!found.length && (
                    <p className="helper">{t('La copia non contiene elementi.')}</p>
                  )}
                  <ul className="backup-items">
                    {found.map((it) => (
                      <li key={it.id}>
                        <label className="check-line">
                          <input
                            type="checkbox"
                            checked={ids.includes(it.id)}
                            onChange={(e) =>
                              setIds((now) =>
                                e.target.checked ? [...now, it.id] : now.filter((x) => x !== it.id),
                              )
                            }
                          />
                          <span>
                            <strong>{it.title}</strong>
                            <small>
                              {categories[it.type] ? t(categories[it.type].label) : it.type}
                              {it.f?.username ? ` · ${it.f.username}` : ''}
                              {it.present ? ` · ${t('già nel vault')}` : ''}
                            </small>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {error && (
                <p className="alert" role="alert">
                  {error}
                </p>
              )}
            </div>
            {chosen && (
              <div className="modal-foot">
                <button
                  className="secondary"
                  onClick={() => {
                    setChosen(null);
                    setPassword('');
                    setFound(null);
                    setIds([]);
                    setError('');
                  }}
                >
                  {t('Indietro')}
                </button>
                {!found ? (
                  <button
                    className="primary"
                    disabled={busy || !password}
                    onClick={() => void openCopy(chosen)}
                  >
                    {t('Apri copia')}
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={busy || !ids.length}
                    onClick={() =>
                      void task(async () => {
                        if (await restore({ name: chosen.name, password, ids })) close();
                      })
                    }
                  >
                    {t('Recupera ({n})', { n: ids.length })}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
