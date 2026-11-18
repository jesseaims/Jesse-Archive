/*
 * Quick actions of the Quick Search. Adding one = one entry here (and, for a new
 * main-window action, its id in `ACTIONS` of src-tauri/src/quick_search.rs and a
 * case in `runQuickOpen` of App.tsx). The search engine does not change.
 */
import type { LucideIcon } from 'lucide-react';
import {
  FileKey,
  KeyRound,
  LayoutDashboard,
  ShieldAlert,
  Shuffle,
  Star,
  UserRound,
} from 'lucide-react';
import { msg } from '../i18n';
import { normalize } from './engine';

/** What the main window is asked to open (`quick-search-open` event). */
export type QuickOpen =
  | { kind: 'item'; id: string }
  | {
      kind: 'action';
      action: 'add-login' | 'add-note' | 'add-personal' | 'generate' | 'security' | 'passwords';
    }
  | { kind: 'page'; page: 'dashboard' | 'favorites' }
  | { kind: 'unlock' };

export type QuickAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** In the main window, or here in the Quick Search ('favorites' filter). */
  target: Exclude<QuickOpen, { kind: 'item' } | { kind: 'unlock' }> | { kind: 'local' };
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'favorites',
    label: msg('Cerca nei preferiti'),
    icon: Star,
    target: { kind: 'local' },
  },
  {
    id: 'generate',
    label: msg('Genera password'),
    icon: Shuffle,
    target: { kind: 'action', action: 'generate' },
  },
  {
    id: 'add-login',
    label: msg('Nuovo account'),
    icon: KeyRound,
    target: { kind: 'action', action: 'add-login' },
  },
  {
    id: 'add-note',
    label: msg('Nuova nota protetta'),
    icon: FileKey,
    target: { kind: 'action', action: 'add-note' },
  },
  {
    id: 'add-personal',
    label: msg('Nuova identità'),
    icon: UserRound,
    target: { kind: 'action', action: 'add-personal' },
  },
  {
    id: 'security',
    label: msg('Centro sicurezza'),
    icon: ShieldAlert,
    target: { kind: 'action', action: 'security' },
  },
  {
    id: 'dashboard',
    label: msg('Apri la dashboard'),
    icon: LayoutDashboard,
    target: { kind: 'page', page: 'dashboard' },
  },
];

/** Actions whose (translated) label starts a word with the query. */
export function matchActions(
  actions: QuickAction[],
  query: string,
  translate: (s: string) => string,
) {
  const q = normalize(query.trim());
  if (!q) return actions;
  return actions.filter(
    (a) =>
      normalize(translate(a.label))
        .split(/\s+/)
        .some((word) => word.startsWith(q)) || normalize(translate(a.label)).startsWith(q),
  );
}
