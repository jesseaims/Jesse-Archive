import { test } from 'node:test';
import assert from 'node:assert/strict';

// Search engine of the Global Quick Search, on synthetic metadata (what the backend
// sends: no passwords at all).
const e = await import(new URL('../src/quick-search/engine.ts', import.meta.url).href);

const labels = {
  login: 'Account',
  note: 'Nota protetta',
  card: 'Carta',
  personal: 'Identità',
  passkey: 'Passkey',
  crypto: 'Crypto',
};
const data = {
  folders: [{ id: 'f1', name: 'Lavoro' }],
  groups: { 'web:epicgames.com': { name: 'Epic Games', icon: 'data:image/png;base64,AA==' } },
  items: [
    {
      id: 'e1',
      type: 'login',
      title: 'Epic Games',
      f: { url: 'https://www.epicgames.com', username: 'uno@posta.test' },
      has_password: true,
    },
    {
      id: 'e2',
      type: 'login',
      title: 'Epic Games',
      f: { url: 'epicgames.com/login', username: 'due@posta.test' },
      has_password: true,
      fav: true,
    },
    {
      id: 'g1',
      type: 'login',
      title: 'Gmail',
      f: { username: 'mario@gmail.com' },
      has_password: true,
    },
    {
      id: 'g2',
      type: 'login',
      title: 'Gmail lavoro',
      f: { username: 'ufficio@gmail.com' },
      folder: 'f1',
      has_password: true,
    },
    {
      id: 'g3',
      type: 'login',
      title: 'Gmail vecchio',
      f: { username: 'old@gmail.com' },
      has_password: true,
    },
    {
      id: 'b1',
      type: 'login',
      title: 'Banca Sintetica',
      f: { url: 'https://banca.test', username: 'cliente42' },
      has_password: true,
    },
    { id: 'n1', type: 'note', title: 'Wi-Fi casa', f: {} },
    { id: 'p1', type: 'personal', title: 'Documento', f: { email: 'persona@example.test' } },
    { id: 'c1', type: 'crypto', title: 'Wallet', f: { platform: 'Ledger' }, has_password: true },
  ],
};
const index = e.buildIndex(data, { categories: true, categoryLabels: labels });
const ids = (groups) => groups.flatMap((g) => g.accounts.map((a) => a.item.id));
const services = (groups) => groups.map((g) => g.service);

test('finds by name, username, email, domain and URL, case and accents ignored', () => {
  assert.deepEqual(ids(e.search(index, 'banca sintetica')), ['b1'], 'name');
  assert.deepEqual(ids(e.search(index, 'CLIENTE42')), ['b1'], 'username, any case');
  assert.deepEqual(ids(e.search(index, 'persona@example')), ['p1'], 'email of an identity');
  assert.deepEqual(ids(e.search(index, 'banca.test')), ['b1'], 'domain');
  assert.deepEqual(ids(e.search(index, 'login')).sort(), ['e2'], 'URL path');
  assert.deepEqual(ids(e.search(index, 'ledger')), ['c1'], 'crypto platform');
  assert.deepEqual(ids(e.search(index, 'documénto')), ['p1'], 'accents ignored');
  assert.deepEqual(ids(e.search(index, 'wifi')), ['n1'], 'letters without separators');
});

test('partial words, several words and small typos', () => {
  assert.deepEqual(ids(e.search(index, 'ban')), ['b1'], 'prefix');
  assert.deepEqual(ids(e.search(index, 'gmail lav')), ['g2'], 'every word must match');
  assert.deepEqual(ids(e.search(index, 'epci')).sort(), ['e1', 'e2'], 'transposed letters');
  assert.deepEqual(
    ids(e.search(index, 'gmial')).sort(),
    ['g1', 'g2', 'g3'],
    'typo in a longer word',
  );
  // Typo matches only when nothing matches as typed: "gmail" does not also bring
  // accounts whose email is on "posta".
  assert.ok(!ids(e.search(index, 'gmail')).includes('e1'));
  assert.deepEqual(e.search(index, 'xyzxyz'), []);
  assert.deepEqual(e.search(index, '   '), [], 'empty query');
});

test('accounts of the same service are grouped and counted', () => {
  const epic = e.search(index, 'epic');
  assert.equal(epic.length, 1);
  assert.equal(epic[0].service, 'Epic Games', 'group name from the vault groups');
  assert.equal(epic[0].icon, 'data:image/png;base64,AA==', 'logo of the group');
  assert.equal(epic[0].accounts.length, 2);
  assert.deepEqual(
    epic[0].accounts.map((a) => a.account).sort(),
    ['due@posta.test', 'uno@posta.test'],
    'accounts told apart by username',
  );
  // Any service: Gmail accounts grouped by the email domain, with no URL saved.
  const gmail = e.search(index, 'gmail');
  assert.equal(gmail[0].key, 'web:gmail.com');
  assert.equal(gmail[0].accounts.length, 3);
});

test('ranking: exact name, then exact domain, then username, then partial', () => {
  const extra = e.buildIndex(
    {
      folders: [],
      groups: {},
      items: [
        { id: 'a', type: 'login', title: 'Steam', f: { username: 'x' } },
        {
          id: 'b',
          type: 'login',
          title: 'Giochi',
          f: { url: 'https://steam.test', username: 'y' },
        },
        { id: 'c', type: 'login', title: 'Forum', f: { username: 'steam' } },
        { id: 'd', type: 'login', title: 'Steamworks', f: { username: 'z' } },
        { id: 'e', type: 'login', title: 'Altro', f: {}, folder: 'steam' },
      ],
    },
    { categories: true, categoryLabels: labels },
  );
  assert.deepEqual(ids(e.search(extra, 'steam')), ['a', 'b', 'c', 'd']);
  // Category search can be turned off.
  const noCategories = e.buildIndex(data, { categories: false, categoryLabels: labels });
  assert.ok(ids(e.search(index, 'lavoro')).includes('g2'), 'title');
  assert.deepEqual(ids(e.search(index, 'nota protetta')), ['n1'], 'category label');
  assert.deepEqual(ids(e.search(noCategories, 'nota protetta')), []);
});

test('highlighting marks the matched part of the title and of the username', () => {
  const [g] = e.search(index, 'cliente');
  const a = g.accounts[0];
  assert.deepEqual(a.highlight.account, [[0, 7]]);
  assert.deepEqual(e.highlightParts('cliente42', a.highlight.account), [
    { text: 'cliente', mark: true },
    { text: '42', mark: false },
  ]);
  assert.deepEqual(e.highlightParts('abc', []), [{ text: 'abc', mark: false }]);
});

test('favorites and recently used keep their order; unknown ids are ignored', () => {
  assert.deepEqual(e.favoriteIds(index), ['e2']);
  assert.deepEqual(ids(e.listItems(index, ['b1', 'missing', 'n1', 'b1'])), ['b1', 'n1']);
});

test('the index has no secret: only metadata fields are searchable', () => {
  const leaked = e.buildIndex(
    {
      folders: [],
      groups: {},
      // Even if a password slipped into the data, it is not a searchable field.
      items: [
        { id: 'z', type: 'login', title: 'Sito', f: { password: 'segreto-xyz', username: 'u' } },
      ],
    },
    { categories: true, categoryLabels: labels },
  );
  assert.deepEqual(e.search(leaked, 'segreto'), []);
});

test('edit distance counts transpositions as one change', () => {
  assert.equal(e.editDistance('gmail', 'gmial'), 1);
  assert.equal(e.editDistance('epic', 'epci'), 1);
  assert.equal(e.editDistance('abc', 'xyz', 1), 2, 'capped above the maximum');
});

test('the quick-search window may call the backend (Tauri capability)', async () => {
  // Without its label here every invoke from the window is refused in the real app.
  const { readFile } = await import('node:fs/promises');
  const cap = JSON.parse(
    await readFile(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8'),
  );
  assert.ok(cap.windows.includes('quick-search'));
});
