import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Check, Languages } from 'lucide-react';
import { getLanguage, LANGUAGES, setLanguage, t } from './i18n';
import type { Lang } from './i18n';

/** "Lingua" button with the list of languages, each written in its own language. */
export default function LanguageMenu() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const current = getLanguage();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey, true);
    // Focus the current language so the arrow keys start from it.
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  const choose = (lang: Lang) => {
    setOpen(false);
    setError('');
    if (lang !== current) void setLanguage(lang).catch((e) => setError(String(e)));
  };
  const move = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [
      ...(root.current?.querySelectorAll<HTMLButtonElement>('.language-option') || []),
    ];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };
  return (
    <div className="language-menu" ref={root}>
      <button
        type="button"
        className="news-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('Cambia la lingua dell’interfaccia')}
        onClick={() => setOpen((v) => !v)}
      >
        <Languages size={16} />
        {t('Lingua')}
      </button>
      {open && (
        <div className="language-list" role="menu" aria-label={t('Lingua')} onKeyDown={move}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === current}
              lang={l.code}
              className={`language-option ${l.code === current ? 'active' : ''}`}
              onClick={() => choose(l.code)}
            >
              <span>{l.name}</span>
              {l.code === current && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
      {error && (
        <span className="language-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
