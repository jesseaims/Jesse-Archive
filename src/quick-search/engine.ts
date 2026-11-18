/*
 * Quick Search engine (no React, no Tauri — unit tested in tests/quick-search.test.mjs).
 *
 * Works on the metadata the backend sends (`quick_search_data`): titles, usernames or
 * emails, site addresses, categories, folders and group names. Passwords and other
 * secrets are not in the data, so they can never be searched or matched. The index
 * lives only in memory while the window is open; nothing is persisted.
 *
 * Reusable by other screens (Dashboard, a future command palette): build an index
 * once per data change with `buildIndex`, then call `search` for each query.
 */
import { domainOf, groupFor } from '../groups.ts';
import type { Category } from '../types.ts';

export type SearchItem = {
  id: string;
  type: Category;
  title: string;
  folder?: string | null;
  fav?: boolean;
  created?: number | null;
  updated?: number | null;
  gk?: string;
  src?: string;
  /** Only non-secret fields: url, username (login, passkey), email, platform. */
  f: Record<string, string>;
  has_password?: boolean;
};
export type SearchData = {
  items: SearchItem[];
  folders: { id: string; name: string }[];
  groups: Record<string, { name: string; icon: string }>;
};

export type Field = 'title' | 'service' | 'domain' | 'account' | 'url' | 'folder' | 'category';
export type Range = [start: number, end: number];

type Entry = {
  item: SearchItem;
  groupKey: string;
  service: string;
  icon: string;
  domain: string;
  /** Username or email shown to tell accounts apart. */
  account: string;
  folderName: string;
  categoryLabel: string;
  /** Normalized searchable text per field (same length as the shown text). */
  norm: Partial<Record<Field, string>>;
  words: Partial<Record<Field, string[]>>;
  /** Letters and digits only, to match "wifi" with "Wi-Fi". */
  compact: Partial<Record<Field, string>>;
};
export type SearchIndex = { entries: Entry[]; byId: Map<string, Entry> };

export type AccountResult = {
  item: SearchItem;
  score: number;
  groupKey: string;
  service: string;
  icon: string;
  domain: string;
  account: string;
  folderName: string;
  categoryLabel: string;
  /** Character ranges to highlight in the title and in the account. */
  highlight: { title: Range[]; account: Range[] };
};
export type ResultGroup = {
  key: string;
  service: string;
  icon: string;
  domain: string;
  score: number;
  accounts: AccountResult[];
};

export type IndexOptions = {
  /** Search the category and folder names too. */
  categories: boolean;
  categoryLabels: Record<Category, string>;
};

// --- Normalization ---------------------------------------------------------------------

/**
 * Lower case without accents, one output character per input character, so match
 * positions can highlight the original text.
 */
export function normalize(text: string): string {
  let out = '';
  for (const ch of text) {
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    // Keep exactly one UTF-16 unit per source unit so positions line up.
    const unit = base.length === ch.length ? base : base.slice(0, 1).padEnd(ch.length, ' ');
    out += unit;
  }
  return out;
}
const splitWords = (s: string) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const compactOf = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '');
export const tokens = (query: string) => splitWords(normalize(query.trim()));

/** Damerau–Levenshtein distance (adjacent transpositions), capped for speed. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    let best = max + 1;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Typos tolerated for a query word: none for short words. */
const allowedTypos = (length: number) => (length >= 8 ? 2 : length >= 4 ? 1 : 0);

// --- Index -----------------------------------------------------------------------------

const FIELD_WEIGHT: Record<Field, number> = {
  title: 1,
  service: 0.95,
  domain: 0.95,
  account: 0.85,
  url: 0.6,
  folder: 0.4,
  category: 0.35,
};
const KIND = { exact: 100, prefix: 80, wordPrefix: 65, substring: 45, fuzzy: 25 } as const;

function serviceName(key: string, groups: SearchData['groups'], first: SearchItem) {
  const named = groups[key]?.name;
  if (named) return named;
  if (key.startsWith('web:') || key.startsWith('app:')) return key.slice(key.indexOf(':') + 1);
  return first.title;
}

export function buildIndex(data: SearchData, options: IndexOptions): SearchIndex {
  const folders = new Map(data.folders.map((f) => [f.id, f.name]));
  const entries: Entry[] = [];
  const firstOfGroup = new Map<string, SearchItem>();
  for (const item of data.items) {
    const key = groupFor(item) || 'item:' + item.id;
    if (!firstOfGroup.has(key)) firstOfGroup.set(key, item);
  }
  for (const item of data.items) {
    const groupKey = groupFor(item) || 'item:' + item.id;
    const service = groupKey.startsWith('item:')
      ? item.title
      : serviceName(groupKey, data.groups, firstOfGroup.get(groupKey) ?? item);
    const account = item.f.username || item.f.email || item.f.platform || '';
    const domain = domainOf(item.f.url || '') || domainOf(account.split('@')[1] || '');
    const folderName = (item.folder && folders.get(item.folder)) || '';
    const categoryLabel = options.categoryLabels[item.type] || '';
    const text: Partial<Record<Field, string>> = {
      title: item.title,
      service: service === item.title ? '' : service,
      domain,
      account,
      url: item.f.url || '',
    };
    if (options.categories) {
      text.folder = folderName;
      text.category = categoryLabel;
    }
    const norm: Entry['norm'] = {};
    const words: Entry['words'] = {};
    const compact: Entry['compact'] = {};
    for (const [field, value] of Object.entries(text) as [Field, string][]) {
      if (!value) continue;
      norm[field] = normalize(value);
      words[field] = splitWords(norm[field]!);
      compact[field] = compactOf(norm[field]!);
    }
    entries.push({
      item,
      groupKey,
      service,
      icon: data.groups[groupKey]?.icon || '',
      domain,
      account,
      folderName,
      categoryLabel,
      norm,
      words,
      compact,
    });
  }
  return { entries, byId: new Map(entries.map((e) => [e.item.id, e])) };
}

// --- Matching --------------------------------------------------------------------------

type FieldHit = { score: number; range?: Range; typo?: boolean };

function matchField(
  text: string,
  words: string[],
  compact: string,
  token: string,
): FieldHit | null {
  if (text === token) return { score: KIND.exact, range: [0, text.length] };
  if (text.startsWith(token)) return { score: KIND.prefix, range: [0, token.length] };
  const at = text.indexOf(token);
  if (at >= 0) {
    const boundary = !/[\p{L}\p{N}]/u.test(text[at - 1] ?? '');
    return {
      score: boundary ? KIND.wordPrefix : KIND.substring,
      range: [at, at + token.length],
    };
  }
  // Same letters without separators ("wifi" in "Wi-Fi"): no position to highlight.
  if (token.length >= 3 && compact.includes(token)) return { score: KIND.substring };
  const typos = allowedTypos(token.length);
  if (!typos) return null;
  for (const word of words) {
    // Whole word, or the beginning of a word while it is still being typed.
    const candidates = [word, word.slice(0, token.length)];
    if (candidates.some((c) => c.length >= 3 && editDistance(token, c, typos) <= typos))
      return { score: KIND.fuzzy, typo: true };
  }
  return null;
}

function scoreEntry(entry: Entry, words: string[], phrase: string) {
  let total = 0;
  let typo = false;
  const highlight: AccountResult['highlight'] = { title: [], account: [] };
  for (const token of words) {
    let best = 0;
    let bestTypo = 0;
    for (const field of Object.keys(entry.norm) as Field[]) {
      const hit = matchField(entry.norm[field]!, entry.words[field]!, entry.compact[field]!, token);
      if (!hit) continue;
      if (hit.typo) {
        bestTypo = Math.max(bestTypo, hit.score * FIELD_WEIGHT[field]);
        continue;
      }
      best = Math.max(best, hit.score * FIELD_WEIGHT[field]);
      if (hit.range && (field === 'title' || field === 'account')) highlight[field].push(hit.range);
    }
    if (!best && !bestTypo) return null; // every word must match somewhere
    if (!best) typo = true;
    total += best || bestTypo;
  }
  // Priorities: the whole query equal to the name, then to the domain or service.
  if (entry.norm.title === phrase) total += 100;
  else if (entry.norm.domain === phrase || entry.norm.service === phrase) total += 90;
  else if (entry.norm.domain?.split('.')[0] === phrase) total += 60;
  if (entry.item.fav) total += 3;
  return { total, highlight, typo };
}

const toResult = (e: Entry, score: number, highlight: AccountResult['highlight']) => ({
  item: e.item,
  score,
  groupKey: e.groupKey,
  service: e.service,
  icon: e.icon,
  domain: e.domain,
  account: e.account,
  folderName: e.folderName,
  categoryLabel: e.categoryLabel,
  highlight,
});

function groupResults(results: AccountResult[], limit: number): ResultGroup[] {
  const groups = new Map<string, ResultGroup>();
  for (const r of results) {
    const g = groups.get(r.groupKey) ?? {
      key: r.groupKey,
      service: r.service,
      icon: r.icon,
      domain: r.domain,
      score: 0,
      accounts: [],
    };
    g.accounts.push(r);
    g.score = Math.max(g.score, r.score);
    groups.set(r.groupKey, g);
  }
  const byTitle = (a: AccountResult, b: AccountResult) =>
    b.score - a.score ||
    a.item.title.localeCompare(b.item.title) ||
    a.account.localeCompare(b.account);
  return [...groups.values()]
    .map((g) => ({ ...g, accounts: g.accounts.sort(byTitle) }))
    .sort((a, b) => b.score - a.score || a.service.localeCompare(b.service))
    .slice(0, limit);
}

/**
 * Ranked results grouped by service (same groups as the main list). Accounts of the
 * same site share a group, ordered by relevance.
 */
export function search(index: SearchIndex, query: string, limit = 50): ResultGroup[] {
  const words = tokens(query);
  if (!words.length) return [];
  const phrase = words.join(' ');
  const exact: AccountResult[] = [];
  const typos: AccountResult[] = [];
  for (const entry of index.entries) {
    const hit = scoreEntry(entry, words, phrase);
    if (hit) (hit.typo ? typos : exact).push(toResult(entry, hit.total, hit.highlight));
  }
  // Matches that need a typo correction only when nothing matches as typed.
  return groupResults(exact.length ? exact : typos, limit);
}

/** Items by id (favorites, recently used), grouped like search results. */
export function listItems(index: SearchIndex, ids: string[], limit = 50): ResultGroup[] {
  const seen = new Set<string>();
  const results: AccountResult[] = [];
  ids.forEach((id, i) => {
    const e = index.byId.get(id);
    if (!e || seen.has(id)) return;
    seen.add(id);
    // Keep the given order: earlier ids rank higher.
    results.push(toResult(e, ids.length - i, { title: [], account: [] }));
  });
  return groupResults(results, limit);
}

/** Favorites, alphabetical. */
export const favoriteIds = (index: SearchIndex) =>
  index.entries
    .filter((e) => e.item.fav)
    .sort((a, b) => a.item.title.localeCompare(b.item.title))
    .map((e) => e.item.id);

/** Splits `text` into plain and highlighted parts. */
export function highlightParts(text: string, ranges: Range[]) {
  const marks = [...ranges].sort((a, b) => a[0] - b[0]);
  const parts: { text: string; mark: boolean }[] = [];
  let pos = 0;
  for (const [start, end] of marks) {
    const s = Math.max(start, pos);
    if (s >= end) continue;
    if (s > pos) parts.push({ text: text.slice(pos, s), mark: false });
    parts.push({ text: text.slice(s, end), mark: true });
    pos = end;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), mark: false });
  return parts;
}
