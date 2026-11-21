// Store packages of the browser extension, in store/out/:
//   jesse-archive-chromium-<version>.zip  Chrome Web Store and Edge Add-ons
//   jesse-archive-firefox-<version>.zip   addons.mozilla.org
// Built from the generated copies in browser-extension/<browser>/ (run
// scripts/package-browser-extension.mjs first if the sources changed). The Chromium
// manifest drops "key": it only pins the ID of the unpacked extension, the store
// assigns its own. Zips use "/" separators (bsdtar, shipped with Windows 10+).
import {cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'store', 'out');
const work = join(out, 'work');
rmSync(work, {recursive: true, force: true});
mkdirSync(work, {recursive: true});

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });

for (const browser of ['chromium', 'firefox']) {
  const source = join(root, 'browser-extension', browser);
  const dir = join(work, browser);
  cpSync(source, dir, {recursive: true});
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  if (browser === 'chromium') delete manifest.key;
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const zip = join(out, `jesse-archive-${browser}-${manifest.version}.zip`);
  rmSync(zip, {force: true});
  const entries = files(dir).map((f) => relative(dir, f).split(sep).join('/'));
  // Windows' own bsdtar: another tar first in PATH (Git Bash) cannot write zips.
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'bsdtar';
  execFileSync(tar, ['-a', '-c', '-f', zip, '-C', dir, ...entries]);
  console.log(`${zip} (${entries.length} files)`);
}
rmSync(work, {recursive: true, force: true});
