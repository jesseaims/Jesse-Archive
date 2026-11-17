// Generate the static commit list during local builds, so installed apps work offline.
// The checked-in fallback is used if Git is not installed or the source lacks .git.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve('src/commits.generated.json');
try {
  const raw = execFileSync('git', ['log','--date=short','--format=%h%x1f%ad%x1f%s','--no-show-signature','-n','250'], {encoding:'utf8',maxBuffer:1024*1024,stdio:['ignore','pipe','ignore']});
  const commits = raw.trim().split('\n').filter(Boolean).map(line=>{
    const [hash,date,...rest] = line.split('\x1f');
    return {hash,date,subject:rest.join(' ').trim()};
  }).filter(row=>/^[a-f0-9]{7,}$/.test(row.hash)&&/^\d{4}-\d\d-\d\d$/.test(row.date));
  if(commits.length){writeFileSync(out,JSON.stringify(commits,null,2)+'\n'); console.log(`News: ${commits.length} commit loaded from Git`);}
  else console.warn('News: no Git commits; retaining checked-in list');
} catch {
  console.warn('News: Git unavailable; retaining checked-in commit list');
}
