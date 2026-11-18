/** Site/app groups of accounts, shared by the main list and the Quick Search so both
 * group (and show logos) the same way. Pure: tested in Node. */
import type { Item } from './types';

/** The fields grouping needs; metadata from the Quick Search has them too. */
export type Groupable = Pick<Item, 'type' | 'title' | 'gk' | 'src'> & {
  f?: Record<string, string>;
};

// Gruppi di sola presentazione: i vecchi elementi restano leggibili anche senza gk.
export function domainOf(value: string): string {
  try {
    const h = new URL(value.includes('://') ? value : 'https://' + value).hostname
      .toLowerCase()
      .replace(/^www\./, '');
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) ? h : '';
  } catch {
    return '';
  }
}
export function sourceOf(it: Groupable): 'web' | 'app' | 'other' {
  if (it.src === 'app' || it.src === 'other' || it.src === 'web') return it.src;
  return it.gk?.startsWith('app:') ? 'app' : it.gk?.startsWith('other:') ? 'other' : 'web';
}
// Group key computed from the item's current data: web accounts follow their
// current URL (or email domain), the others their current title.
export function deriveGroupKey(it: Groupable): string {
  const src = sourceOf(it);
  if (src === 'web') {
    const host = domainOf(it.f?.url || '') || domainOf((it.f?.username || '').split('@')[1] || '');
    if (host) return 'web:' + host;
  }
  return (
    (src === 'app' ? 'app:' : 'other:') +
    (it.title || '').toLocaleLowerCase('it').trim().replace(/\s+/g, '-')
  );
}
// Key used when saving: an explicitly associated installed app keeps its key,
// everything else is recomputed so editing the site or title regroups the account.
export function savedGroupKey(it: Groupable): string {
  if (sourceOf(it) === 'app' && it.gk?.startsWith('app:')) return it.gk;
  return deriveGroupKey(it);
}
export function groupFor(it: Groupable) {
  if (it.type !== 'login') return it.gk || '';
  // Web accounts are grouped by their current site even if an older save stored a
  // stale key; app/other accounts keep their saved key.
  if (sourceOf(it) === 'web') {
    const key = deriveGroupKey(it);
    if (key.startsWith('web:')) return key;
  }
  return it.gk || deriveGroupKey(it);
}
