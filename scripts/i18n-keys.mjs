// Collects the Italian source strings passed to t('…') and msg('…') in src/.
// Used by tests/i18n.test.mjs and to list missing translations:
//   node scripts/i18n-keys.mjs [lang]   -> keys (or only those missing in <lang>)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function sourceKeys() {
  const keys = new Set();
  // Every source file under src/ (subfolders too), except the translations themselves.
  const files = fs
    .readdirSync(path.join(root, 'src'), { recursive: true })
    .map(String)
    .filter((name) => /\.(tsx?|mts)$/.test(name) && !/^locales[\/]/.test(name) && name !== 'i18n.ts')
    .map((name) => path.join(root, 'src', name));
  for (const file of files) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ['t', 'msg', 'tRich'].includes(node.expression.text) &&
        node.arguments[0] &&
        (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
      )
        keys.add(node.arguments[0].text);
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return [...keys].sort((a, b) => a.localeCompare(b, 'it'));
}

/** Extra keys translated at runtime (backend and extension messages). */
export async function runtimeKeys() {
  const { RUNTIME_KEYS } = await import(pathToFileURL(path.join(root, 'src', 'locales', 'runtime-keys.mjs')).href);
  return RUNTIME_KEYS;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const all = [...sourceKeys(), ...(await runtimeKeys())];
  const lang = process.argv[2];
  let missing = all;
  if (lang) {
    const file = pathToFileURL(path.join(root, 'src', 'locales', `${lang}.ts`)).href;
    const { default: dictionary } = await import(file);
    missing = all.filter((k) => typeof dictionary[k] !== 'string');
  }
  process.stdout.write(JSON.stringify(missing, null, 1) + '\n');
  console.error(`${missing.length} chiavi`);
}
