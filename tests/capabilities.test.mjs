// Each window may call only the native commands its own code uses (SEC-06).
// Reads the code of every window (its component and the local modules it imports),
// collects the commands it can invoke and compares them with its capability file in
// src-tauri/capabilities. Also checks that build.rs declares exactly the commands
// registered in lib.rs, so a new command cannot be added without a permission.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const WINDOWS = {
  main: 'src/App.tsx',
  'quick-fill': 'src/QuickFill.tsx',
  'browser-setup': 'src/BrowserInstaller.tsx',
  'quick-search': 'src/quick-search/QuickSearch.tsx',
};
// Vault commands (`api`) the other windows may send: lib.rs `api_allowed`.
const API_NAMES = { 'quick-fill': ['unlock'], 'quick-search': ['unlock'], 'browser-setup': [] };

const registered = read('src-tauri/src/lib.rs')
  .match(/generate_handler!\[([\s\S]*?)\]/)[1]
  .split(',')
  .map((c) => c.trim().split('::').pop())
  .filter(Boolean);
const declared = [
  ...read('src-tauri/build.rs')
    .match(/COMMANDS: &\[&str\] = &\[([\s\S]*?)\]/)[1]
    .matchAll(/"([a-z_]+)"/g),
].map((m) => m[1]);

// Helpers of src/api.ts: exported function name -> command it invokes.
const helpers = Object.fromEntries(
  [
    ...read('src/api.ts').matchAll(
      /export async function (\w+)[\s\S]*?invoke(?:<[^>]*>)?\('([a-z_]+)'/g,
    ),
  ].map((m) => [m[1], m[2]]),
);

function resolveImport(from, spec) {
  const base = resolve(dirname(join(root, from)), spec);
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    const f = base + ext;
    if (/\.(ts|tsx)$/.test(f) && existsSync(f))
      return f.slice(root.length + 1).replaceAll('\\', '/');
  }
  return null;
}
function filesOf(entry) {
  const seen = new Set();
  const visit = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    // `import type` brings no code into the window.
    for (const m of read(f).matchAll(/import\s+(type\s+)?[^;]*?from\s+'(\.[^']+)'/g)) {
      if (m[1]) continue;
      const next = resolveImport(f, m[2]);
      if (next) visit(next);
    }
  };
  visit(entry);
  return seen;
}
// main.tsx picks the window component; what else it imports runs in every window.
const shared = [...read('src/main.tsx').matchAll(/from\s+'(\.[^']+)'/g)]
  .map((m) => resolveImport('src/main.tsx', m[1]))
  .filter((f) => f && !Object.values(WINDOWS).includes(f));

function usage(window) {
  const files = new Set([...filesOf(WINDOWS[window]), ...shared.flatMap((f) => [...filesOf(f)])]);
  const commands = new Set();
  const apiNames = new Set();
  for (const f of files) {
    const code = read(f).replace(/^\s*\/\/.*$/gm, '');
    // api.ts only defines helpers: a window uses their commands by calling them.
    if (f === 'src/api.ts') continue;
    // Any quoted command name: covers invoke('x') and helpers like passkeyAction('x').
    for (const m of code.matchAll(/'([a-z_]+)'/g))
      if (registered.includes(m[1])) commands.add(m[1]);
    for (const [fn, cmd] of Object.entries(helpers))
      if (new RegExp(`\\b${fn}\\(`).test(code)) commands.add(cmd);
    for (const m of code.matchAll(/\bapi(?:<[^>]*>)?\(\s*'([a-z_]+)'/g)) apiNames.add(m[1]);
  }
  return { commands: [...commands].sort(), apiNames: [...apiNames].sort() };
}
function capability(window) {
  const c = JSON.parse(read(`src-tauri/capabilities/${window}.json`));
  assert.deepEqual(c.windows, [window], `${window}.json applies to its window only`);
  return c.permissions.filter((p) => !p.startsWith('core:'));
}

test('build.rs declares exactly the commands registered in lib.rs', () => {
  assert.ok(registered.length > 40);
  assert.deepEqual([...declared].sort(), [...registered].sort());
});

test('the old shared capability is gone', () => {
  assert.equal(existsSync(join(root, 'src-tauri/capabilities/default.json')), false);
});

for (const window of Object.keys(WINDOWS)) {
  test(`${window}: permissions match the commands its code uses`, () => {
    const { commands } = usage(window);
    const expected = commands.map((c) => 'allow-' + c.replaceAll('_', '-')).sort();
    assert.deepEqual([...capability(window)].sort(), expected);
  });
  if (window !== 'main')
    test(`${window}: vault commands allowed by api`, () => {
      const { commands, apiNames } = usage(window);
      const allowed = API_NAMES[window];
      assert.deepEqual(
        apiNames.filter((n) => !allowed.includes(n)),
        [],
      );
      assert.equal(commands.includes('api'), allowed.length > 0);
    });
}
