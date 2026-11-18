import { createElement, Fragment, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import de from './locales/de';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import ja from './locales/ja';
import ko from './locales/ko';
import pt from './locales/pt';
import ru from './locales/ru';
import zh from './locales/zh';

/*
 * Interface translations.
 *
 * The Italian text is the key: `t('Impostazioni')`. Every other language maps the
 * Italian key to its translation; a missing entry falls back to Italian, and the
 * test `tests/i18n.test.mjs` fails if any key used in the sources is missing.
 * Variables use `{name}` placeholders: `t('Copiare il vault in {path}?', { path })`.
 * Strings defined in constant tables are marked with `msg()` (no-op) and
 * translated where they are rendered with `t(value)`.
 *
 * The language is a per-device preference (`lang` in the device config, like the
 * zoom), so the lock screen and every window use it; the backend gets it too for
 * the tray menu. A change is broadcast to all windows with `language-changed`.
 */

export const LANGUAGES = [
  { code: 'it', name: 'Italiano', locale: 'it-IT' },
  { code: 'en', name: 'English', locale: 'en-US' },
  { code: 'es', name: 'Español', locale: 'es-ES' },
  { code: 'fr', name: 'Français', locale: 'fr-FR' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
  { code: 'pt', name: 'Português (Brasil)', locale: 'pt-BR' },
  { code: 'ru', name: 'Русский', locale: 'ru-RU' },
  { code: 'zh', name: '简体中文', locale: 'zh-CN' },
  { code: 'ja', name: '日本語', locale: 'ja-JP' },
  { code: 'ko', name: '한국어', locale: 'ko-KR' },
] as const;
export type Lang = (typeof LANGUAGES)[number]['code'];
export type Dictionary = Record<string, string>;

const DICTIONARIES: Record<Lang, Dictionary> = { it: {}, en, es, fr, de, pt, ru, zh, ja, ko };

let current: Lang = 'it';
const listeners = new Set<(lang: Lang) => void>();

export const isLang = (value: unknown): value is Lang =>
  typeof value === 'string' && LANGUAGES.some((l) => l.code === value);

/** Language from the Windows/WebView locale, used until the user picks one. */
export function detectLanguage(candidates: readonly string[] = navigator.languages || []): Lang {
  for (const tag of candidates) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

export const getLanguage = () => current;
/** BCP 47 locale for dates and numbers in the current language. */
export const locale = () => LANGUAGES.find((l) => l.code === current)?.locale || 'it-IT';

function interpolate(text: string, vars?: Record<string, unknown>) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name] ?? '') : match,
  );
}

/** Translates an Italian source string. */
export function t(key: string, vars?: Record<string, unknown>): string {
  return interpolate(DICTIONARIES[current][key] ?? key, vars);
}

/**
 * Translates a sentence whose {placeholders} are React elements (for example bold
 * button names), so each language can place them where its word order needs.
 */
export function tRich(key: string, parts: Record<string, ReactNode>): ReactNode[] {
  return t(key)
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((segment, i) => {
      const name = /^\{(\w+)\}$/.exec(segment)?.[1];
      return createElement(Fragment, { key: i }, name && name in parts ? parts[name] : segment);
    });
}

/** Marks a constant for extraction; translate it where it is shown with `t()`. */
export const msg = (key: string) => key;

// Messages produced elsewhere (Rust backend, browser extension) arrive already
// formatted. Keys with {placeholders} are matched as patterns to recover the
// variables, then the translated template is filled in.
const patterns = new Map<string, RegExp>();
function pattern(key: string) {
  let re = patterns.get(key);
  if (!re) {
    const source = key
      .split(/(\{\w+\})/)
      .map((part) =>
        /^\{\w+\}$/.test(part)
          ? `(?<${part.slice(1, -1)}>[\\s\\S]*?)`
          : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('');
    re = new RegExp(`^${source}$`);
    patterns.set(key, re);
  }
  return re;
}

/** Translates a message from the backend or the extension (exact or patterned). */
export function translateMessage(message: unknown): string {
  const text = String(message ?? '').replace(/^Error:\s*/, '');
  const dictionary = DICTIONARIES[current];
  if (current === 'it' || !text) return text;
  if (dictionary[text]) return dictionary[text];
  for (const [key, value] of Object.entries(dictionary)) {
    if (!key.includes('{')) continue;
    const found = pattern(key).exec(text);
    if (found) return interpolate(value, found.groups);
  }
  return text;
}

function apply(lang: Lang) {
  current = lang;
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}

/** Loads the saved language (or detects it) before the first render. */
export async function initLanguage() {
  let saved: unknown = null;
  try {
    saved = await invoke('language_get');
  } catch {
    // Older backend or no config: fall back to detection.
  }
  if (isLang(saved)) apply(saved);
  else {
    // First start: remember the detected language so the tray menu uses it too.
    apply(detectLanguage());
    void invoke('language_set', { lang: current }).catch(() => {});
  }
  void listen<string>('language-changed', (e) => {
    if (isLang(e.payload) && e.payload !== current) apply(e.payload);
  });
}

/** Saves the language for this device and switches every window. */
export async function setLanguage(lang: Lang) {
  apply(lang);
  await invoke('language_set', { lang });
}

/** Re-renders the calling component (the window root) when the language changes. */
export function useLanguage(): Lang {
  const [lang, setLang] = useState(current);
  useEffect(() => {
    listeners.add(setLang);
    return () => {
      listeners.delete(setLang);
    };
  }, []);
  return lang;
}
