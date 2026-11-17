import {mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync} from 'node:fs';
import {generateKeyPairSync, createHash} from 'node:crypto';
const root = new URL('../browser-extension/', import.meta.url);
const keyFile = new URL('public-key.txt', root);
// Only the public key is persisted; it fixes the unpacked Chromium extension ID.
if (!existsSync(keyFile)) {
  const {publicKey} = generateKeyPairSync('rsa', {modulusLength:2048});
  writeFileSync(keyFile, publicKey.export({type:'spki',format:'der'}).toString('base64')+'\n');
}
const key=readFileSync(keyFile,'utf8').trim();
const id=[...createHash('sha256').update(Buffer.from(key,'base64')).digest().subarray(0,16)].map(b=>String.fromCharCode(97+(b>>4),97+(b&15))).join('');
writeFileSync(new URL('chromium-id.txt',root),id+'\n');
const shared={manifest_version:3,name:'JesseArchive · Inserimento rapido',version:'1.1.1',description:'Seleziona dal vault locale gli account per il sito corrente.',permissions:['nativeMessaging','tabs','scripting'],host_permissions:['https://*/*'],action:{default_title:'Apri JesseArchive per questo campo'}};
for (const browser of ['chromium','firefox']) {
  const dir=new URL(browser+'/',root); mkdirSync(dir,{recursive:true});
  const manifest=browser==='chromium'?{...shared,key,background:{service_worker:'background.js'}}:{...shared,background:{scripts:['background.js']},browser_specific_settings:{gecko:{id:'browser@jessearchive.local',strict_min_version:'115.0',data_collection_permissions:{required:['none']}}}};
  writeFileSync(new URL('manifest.json',dir),JSON.stringify(manifest,null,2)+'\n');
  copyFileSync(new URL('background.js',root),new URL('background.js',dir));
}
console.log(`Browser extensions prepared. Chromium ID: ${id}`);
