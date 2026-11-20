import { getLanguage, locale, t } from './i18n';
import { localizedNews } from './locales/news';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import {
  Archive,
  Check,
  Cloud,
  Code2,
  Folder,
  GitCommitHorizontal,
  KeyRound,
  Newspaper,
  Package,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { NEWS_ENTRIES } from './news-changelog';
import gitCommits from './commits.generated.json';

type Tab = 'updates' | 'commits';
type Commit = { hash: string; date: string; timestamp?: string; subject: string };
const icons = {
  sparkles: Sparkles,
  shield: ShieldCheck,
  palette: Palette,
  folder: Folder,
  package: Package,
  wrench: Wrench,
  key: KeyRound,
  cloud: Cloud,
};

function italianDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
}
function EntryTimestamp({
  timestamp,
  date,
  source,
}: {
  timestamp?: string;
  date?: string;
  source?: 'git';
}) {
  const parsed = timestamp ? new Date(timestamp) : null;
  const valid = parsed !== null && !Number.isNaN(parsed.valueOf());
  const label = valid
    ? parsed.toLocaleString(locale(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
    : `${date ? italianDate(date) + ' · ' : ''}${t('Ora non disponibile')}`;
  const title = valid
    ? `${source === 'git' ? t('Prima registrazione della novità in Git') : t('Data di registrazione')}: ${parsed.toLocaleString(locale(), { timeZoneName: 'short' })}`
    : t('Il timestamp completo non è disponibile per questa voce');
  return (
    <time className="news-timestamp" dateTime={valid ? timestamp : date} title={title}>
      {label}
    </time>
  );
}

export default function NewsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('updates');
  const [version, setVersion] = useState('1.4.0');
  const [query, setQuery] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    void getVersion()
      .then(setVersion)
      .catch(() => {});
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onEscape, true);
    return () => document.removeEventListener('keydown', onEscape, true);
  }, [onClose]);
  const lang = getLanguage();
  // Search the text in the language shown (lang is a dependency on purpose).
  const updates = useMemo(
    () =>
      NEWS_ENTRIES.filter((n) => {
        const text = localizedNews(n);
        return `${n.version} ${text.title} ${text.description}`
          .toLowerCase()
          .includes(query.toLowerCase().trim());
      }),
    [query, lang],
  );
  const commits = useMemo(
    () =>
      (gitCommits as Commit[]).filter((c) =>
        `${c.date} ${c.subject} ${c.hash}`.toLowerCase().includes(query.toLowerCase().trim()),
      ),
    [query],
  );
  let lastDate = '';
  return (
    <div
      className="news-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="news-window" role="dialog" aria-modal="true" aria-labelledby="news-title">
        <div className="news-heading">
          <div className="news-heading-copy">
            <h2 id="news-title">
              {t('Novità di JesseArchive')}{' '}
              <span className="news-version">
                {t('Beta')} {version}
              </span>
            </h2>
            <p>{t('Tutte le evoluzioni del tuo archivio sicuro')}</p>
          </div>
          <button
            ref={closeRef}
            className="news-close"
            type="button"
            title={t('Chiudi')}
            aria-label={t('Chiudi novità')}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <div className="news-toolbar">
          <div className="news-tabs" role="tablist" aria-label={t('Sezioni novità')}>
            <button
              type="button"
              role="tab"
              id="tab-updates"
              aria-controls="panel-updates"
              aria-selected={tab === 'updates'}
              className={tab === 'updates' ? 'active' : ''}
              onClick={() => {
                setTab('updates');
                setQuery('');
              }}
            >
              <Newspaper size={15} />
              {t('Novità')}
            </button>
            <button
              type="button"
              role="tab"
              id="tab-commits"
              aria-controls="panel-commits"
              aria-selected={tab === 'commits'}
              className={tab === 'commits' ? 'active' : ''}
              onClick={() => {
                setTab('commits');
                setQuery('');
              }}
            >
              <GitCommitHorizontal size={15} />
              {t('Commit')} <span className="news-tab-count">{gitCommits.length}</span>
            </button>
          </div>
          <label className="news-search">
            <Search size={15} />
            <input
              aria-label={tab === 'updates' ? t('Cerca tra le novità') : t('Cerca tra i commit')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Cerca…')}
            />
          </label>
        </div>
        <div
          className="news-body"
          role="tabpanel"
          id={tab === 'updates' ? 'panel-updates' : 'panel-commits'}
          aria-labelledby={tab === 'updates' ? 'tab-updates' : 'tab-commits'}
          tabIndex={0}
          key={tab}
        >
          {tab === 'updates' ? (
            <div className="news-updates">
              {updates.map((entry, index) => {
                const Icon = icons[entry.icon];
                const text = localizedNews(entry);
                return (
                  <article className="news-entry" key={entry.id}>
                    <div className="news-entry-symbol">
                      <Icon size={19} />
                    </div>
                    <div className="news-entry-copy">
                      <div className="news-entry-title">
                        <h3>{text.title}</h3>
                        <span className="news-entry-tag">{entry.version}</span>
                      </div>
                      <p>{text.description}</p>
                    </div>
                    {index === 0 && !query && (
                      <span className="news-new-tag">{t('Ultima modifica')}</span>
                    )}
                    <EntryTimestamp timestamp={entry.addedAt} source={entry.dateSource} />
                  </article>
                );
              })}
              {updates.length === 0 && (
                <div className="news-empty">{t('Nessuna novità corrisponde alla ricerca.')}</div>
              )}
            </div>
          ) : (
            <div className="news-commits">
              <p className="news-git-note">
                <Code2 size={14} />
                {t(
                  'Cronologia ricostruita dagli archivi di sviluppo; i commit più recenti vengono aggiornati da Git durante la build.',
                )}
              </p>
              {commits.map((commit) => {
                const showDate = commit.date !== lastDate;
                lastDate = commit.date;
                const match = commit.subject.match(/^([^:]+):\s*(.*)$/);
                const area = match?.[1] || 'project';
                const description = match?.[2] || commit.subject;
                return (
                  <div key={commit.hash}>
                    {showDate && (
                      <div className="news-commit-date">
                        <strong>{italianDate(commit.date)}</strong>
                        <span />
                      </div>
                    )}
                    <article className="news-commit">
                      <div className="news-commit-dot">
                        <GitCommitHorizontal size={15} />
                      </div>
                      <div className="news-commit-body">
                        <h3>{description}</h3>
                        <div className="news-commit-meta">
                          <span className="news-commit-area">{area}</span>
                          <code>{commit.hash}</code>
                        </div>
                        <EntryTimestamp timestamp={commit.timestamp} date={commit.date} />
                      </div>
                    </article>
                  </div>
                );
              })}
              {commits.length === 0 && (
                <div className="news-empty">{t('Nessun commit corrisponde alla ricerca.')}</div>
              )}
            </div>
          )}
        </div>
        <div className="news-footer">
          <span>
            <Archive size={13} /> {t("Jesse's Archive")}
          </span>
          <span>
            <Check size={13} /> {t('Cronologia locale · Nessuna connessione richiesta')}
          </span>
        </div>
      </section>
    </div>
  );
}
