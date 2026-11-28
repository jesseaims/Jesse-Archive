// Prints the GitHub release notes (Markdown) for one version, built from the
// curated News entries in src/news-changelog.ts.
// Usage: node scripts/release-notes.mjs <version> [previous released version]
// With a previous version, every entry newer than it (up to <version>) is
// included, so versions merged together but never released are not lost.
// Requires Node >= 23.6 (TypeScript type stripping) to import the .ts module.
const [version, previous] = process.argv.slice(2).map((v) => v?.replace(/^v/, ''));
if (!version) {
  console.error('Uso: node scripts/release-notes.mjs <versione> [versione precedente]');
  process.exit(1);
}
const parse = (v) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
const compare = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
};

let entries = [];
try {
  const { NEWS_ENTRIES } = await import('../src/news-changelog.ts');
  // A previous version that is not older than <version> (e.g. a manual re-run)
  // would give an empty range: fall back to the exact version.
  const range = previous && compare(previous, version) < 0;
  entries = NEWS_ENTRIES.filter((e) => {
    const v = e.version.replace(/^Beta\s+/, '');
    return range ? compare(v, previous) > 0 && compare(v, version) <= 0 : compare(v, version) === 0;
  });
} catch (error) {
  console.error(`Novità non leggibili, note generiche: ${error.message}`);
}

const lines = [];
if (entries.length) {
  lines.push('## Novità', '');
  for (const e of entries) lines.push(`### ${e.title} (${e.version})`, '', e.description, '');
} else {
  lines.push(`Aggiornamento ${version}.`, '');
}
lines.push(
  '## Installazione',
  '',
  '1. Scarica **JesseArchive-Setup.exe** qui sotto e avvialo: aggiorna la versione già installata, i dati del vault restano dove sono.',
  '2. Il setup non è firmato digitalmente: se Windows SmartScreen mostra un avviso, scegli **Ulteriori informazioni → Esegui comunque**.',
  '',
  '_Il progetto non è stato sottoposto a un audit di sicurezza indipendente: il modello di sicurezza e i limiti noti sono descritti in docs/SECURITY.md._',
);
console.log(lines.join('\n'));
