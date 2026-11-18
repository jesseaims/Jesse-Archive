import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sourceKeys, runtimeKeys } from '../scripts/i18n-keys.mjs';

// Every string shown by the app (t/msg/tRich in src/, plus backend and extension
// messages listed in src/locales/runtime-keys.mjs) must be translated in every
// language, with the same {placeholders}.
const LANGS = ['en', 'es', 'fr', 'de', 'pt', 'ru', 'zh', 'ja', 'ko'];
const keys = [...new Set([...sourceKeys(), ...(await runtimeKeys())])];
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('the sources use translatable strings', () => {
  assert.ok(keys.length > 500, `only ${keys.length} keys found`);
});

for (const lang of LANGS) {
  test(`${lang}: complete translation with the same placeholders`, async () => {
    const { default: dictionary } = await import(new URL(`../src/locales/${lang}.ts`, import.meta.url).href);
    const missing = keys.filter((k) => typeof dictionary[k] !== 'string' || !dictionary[k].trim());
    assert.deepEqual(missing, [], `${lang}: ${missing.length} missing translations`);
    const extra = Object.keys(dictionary).filter((k) => !keys.includes(k));
    assert.deepEqual(extra, [], `${lang}: translations for strings no longer used`);
    const wrong = keys.filter((k) => placeholders(k) !== placeholders(dictionary[k]));
    assert.deepEqual(wrong, [], `${lang}: placeholders differ`);
  });
}

test('frontend and backend offer the same languages', () => {
  const frontend = fs.readFileSync(new URL('../src/i18n.ts', import.meta.url), 'utf8');
  const codes = [...frontend.matchAll(/\{ code: '(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(codes, ['it', ...LANGS]);
  const backend = fs.readFileSync(new URL('../src-tauri/src/i18n.rs', import.meta.url), 'utf8');
  const rust = /LANGS: \[&str; \d+\] = \[([^\]]+)\]/.exec(backend)[1].match(/\w+/g);
  assert.deepEqual(rust, codes);
});

test('every News entry is translated in every language', async () => {
  const { NEWS_ENTRIES } = await import(new URL('../src/news-changelog.ts', import.meta.url).href);
  const ids = NEWS_ENTRIES.map((e) => e.id);
  for (const lang of LANGS) {
    const { default: news } = await import(new URL(`../src/locales/news/${lang}.ts`, import.meta.url).href);
    const missing = ids.filter((id) => !news[id]?.[0]?.trim() || !news[id]?.[1]?.trim());
    assert.deepEqual(missing, [], `${lang}: News without translation`);
    assert.deepEqual(Object.keys(news).filter((id) => !ids.includes(id)), [], `${lang}: unknown News ids`);
  }
});
