import { msg } from './i18n';
export type Category = 'login' | 'card' | 'note' | 'personal' | 'passkey' | 'crypto';
export type Item = {
  id: string;
  type: Category;
  title: string;
  folder?: string | null;
  fav?: boolean;
  notes?: string;
  f: Record<string, string>;
  trashed?: number | null;
  created?: number;
  updated?: number;
  shared?: boolean;
  gk?: string;
  src?: string;
};
export type Password = {
  id: string;
  value: string;
  item_id?: string | null;
  item_title?: string;
  item_type?: string;
  label?: string;
  source?: string;
  created: number;
  linked?: number;
  retired?: number | null;
  active: boolean;
};
export type Folder = { id: string; name: string; upd?: number };
export type Group = { name: string; icon: string; src: string; upd?: number };
export type Settings = {
  autolock?: number;
  clip?: number;
  old_days?: number;
  logos?: number;
  theme?: { preset: string; custom?: Record<string, string> };
  /** Dashboard layout (src/dashboard/model.ts); normalized when read. */
  dashboard?: unknown;
  /** Recently used item ids, newest first (Dashboard and Global Quick Search). */
  recent?: string[];
};
export type State = {
  items: Item[];
  passwords: Password[];
  folders: Folder[];
  groups?: Record<string, Group>;
  settings: Settings;
  path: string;
  synced_at: number;
  prefs: {
    close: 'quit' | 'tray';
    autostart: boolean;
    win: boolean;
    tray_ok: boolean;
    native: boolean;
  };
};
export type Status = { exists: boolean; unlocked: boolean; path: string };
export type Page =
  | 'dashboard'
  | 'all'
  | 'favorites'
  | 'passwords'
  | 'security'
  | 'generator'
  | 'trash'
  | 'settings'
  | 'groups'
  | 'folder'
  | 'login'
  | 'passkey'
  | 'note'
  | 'card'
  | 'personal'
  | 'crypto'
  | 'shared';
export const categories: Record<Category, { label: string; fields: string[]; secret?: string }> = {
  login: {
    label: msg('Account'),
    fields: ['url', 'username', 'password', 'totp'],
    secret: 'password',
  },
  card: {
    label: msg('Carta'),
    fields: ['holder', 'number', 'expiry', 'cvv', 'pin'],
    secret: 'pin',
  },
  note: { label: msg('Nota protetta'), fields: [] },
  personal: {
    label: msg('Identità'),
    fields: ['fullname', 'email', 'phone', 'address', 'city', 'zip', 'country', 'birthday'],
  },
  passkey: { label: msg('Passkey'), fields: ['url', 'username', 'credential'] },
  crypto: {
    label: msg('Wallet crypto'),
    fields: ['platform', 'address', 'seed', 'password'],
    secret: 'password',
  },
};
export const labels: Record<string, string> = {
  url: msg('Sito web / URL'),
  username: msg('Nome utente'),
  password: msg('Password'),
  totp: msg('Codice TOTP (secret)'),
  holder: msg('Titolare'),
  number: msg('Numero carta'),
  expiry: msg('Scadenza'),
  cvv: msg('CVV'),
  pin: msg('PIN'),
  fullname: msg('Nome completo'),
  email: msg('Email'),
  phone: msg('Telefono'),
  address: msg('Indirizzo'),
  city: msg('Città'),
  zip: msg('CAP'),
  country: msg('Paese'),
  birthday: msg('Data di nascita'),
  credential: msg('Credenziale salvata'),
  platform: msg('Piattaforma'),
  seed: msg('Seed phrase'),
};
