import {mkdirSync, readFileSync, writeFileSync, copyFileSync, cpSync, existsSync} from 'node:fs';
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
const shared={manifest_version:3,default_locale:'it',name:'__MSG_extName__',version:'1.5.0',description:'__MSG_extDescription__',permissions:['nativeMessaging','tabs','scripting'],host_permissions:['https://*/*'],icons:{16:'icons/icon-16.png',32:'icons/icon-32.png',48:'icons/icon-48.png',128:'icons/icon-128.png'},action:{default_title:'__MSG_actionTitle__',default_icon:{16:'icons/icon-16.png',32:'icons/icon-32.png'}},
  // Passkeys (WebAuthn): page hook in the MAIN world + isolated bridge, top frame of HTTPS pages.
  content_scripts:[{matches:['https://*/*'],js:['passkey-page.js'],run_at:'document_start',world:'MAIN'},{matches:['https://*/*'],js:['passkey-bridge.js'],run_at:'document_start'},
    // Offer to save submitted credentials: every frame (same-site login frames), isolated world.
    {matches:['https://*/*'],js:['save-capture.js'],run_at:'document_start',all_frames:true}]};
for (const browser of ['chromium','firefox']) {
  const dir=new URL(browser+'/',root); mkdirSync(dir,{recursive:true});
  const manifest=browser==='chromium'?{...shared,key,background:{service_worker:'background.js'}}:{...shared,background:{scripts:['background.js']},browser_specific_settings:{gecko:{id:'browser@jessearchive.local',strict_min_version:'128.0',data_collection_permissions:{required:['none']}}}};
  writeFileSync(new URL('manifest.json',dir),JSON.stringify(manifest,null,2)+'\n');
  for (const file of ['background.js','passkey-page.js','passkey-bridge.js','save-capture.js']) copyFileSync(new URL(file,root),new URL(file,dir));
  // Translated name, description and button title (one folder per browser locale).
  cpSync(new URL('_locales/',root),new URL('_locales/',dir),{recursive:true});
  // Project logo (from public/jesse-logo.png) for the toolbar and the extensions list.
  cpSync(new URL('icons/',root),new URL('icons/',dir),{recursive:true});
}
console.log(`Browser extensions prepared. Chromium ID: ${id}`);
