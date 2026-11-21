import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../browser-extension/background.js',import.meta.url),'utf8');
function page(html,url='https://example.com/login') {
 const dom=new JSDOM(html,{url,runScripts:'outside-only'});
 const w=dom.window;
 w.chrome={runtime:{getManifest:()=>({version:'1.0.0'}),reload:()=>{w.reloaded=(w.reloaded||0)+1},connectNative:()=>({postMessage(){},onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),onStartup:{addListener(){}},onInstalled:{addListener(){}},onMessage:{addListener(){}}},action:{onClicked:{addListener(){}}}};
 w.HTMLInputElement.prototype.getClientRects=function(){return this.hidden?[]:[{}]};
 w.document.hasFocus=()=>true;
 w.eval(source+'\n globalThis.testFill=fillFields;globalThis.testCapture=captureContext;globalThis.receiveTest=receive;globalThis.testTarget=value=>{target=value};globalThis.testTransport=value=>{port=value};');
 const capture=id=>{w.document.getElementById(id).focus();w.testCapture()};
 return {w,capture,fill:(u='utente日本語',p='sëgreto🔑')=>w.testFill(url,u,p)};
}
test('fills username and password, dispatches input, never submits',()=>{
 const {w,capture,fill}=page('<form><input id="u" autocomplete="username"><input id="p" type="password"></form>');
 let submitted=0,inputs=0;w.document.querySelector('form').addEventListener('submit',()=>submitted++);w.document.addEventListener('input',()=>inputs++);
 capture('u');assert.equal(fill().ok,true);assert.equal(w.document.getElementById('u').value,'utente日本語');assert.equal(w.document.getElementById('p').value,'sëgreto🔑');assert.equal(inputs,2);assert.equal(submitted,0);w.close();
});
test('fills fields inside open shadow roots (web components such as Reddit)',()=>{
 for(const start of ['u','p']){
  const {w}=page('<form><x-field id="hu"></x-field><x-field id="hp"></x-field><button>Accedi</button></form>');
  const field=(id,type)=>{const root=w.document.getElementById(id).attachShadow({mode:'open'});const i=w.document.createElement('input');i.type=type;root.appendChild(i);return i;};
  const u=field('hu','text'),p=field('hp','password');
  (start==='u'?u:p).focus();w.testCapture();
  assert.equal(w.testFill('https://example.com/login','utente','segreto').ok,true,start);
  assert.equal(u.value,'utente');assert.equal(p.value,'segreto');w.close();
 }
});
test('supports username-only and password-only steps',()=>{
 for(const [html,id,value] of [['<input id="u">','u','utente日本語'],['<input id="p" type="password">','p','sëgreto🔑']]) {
  const {w,capture,fill}=page(html);capture(id);assert.equal(fill().ok,true);assert.equal(w.document.getElementById(id).value,value);w.close();
 }
});
test('does not fill new-password or ambiguous registration forms',()=>{
 for(const html of ['<input id="u"><input type="password"><input type="password">','<input id="u" type="password" autocomplete="new-password">']){
  const {w,capture,fill}=page(html);capture('u');assert.equal(fill().ok,false);assert.ok([...w.document.querySelectorAll('input')].every(i=>!i.value));w.close();
 }
});
test('rejects stale URL, replaced fields, readonly fields and replay',()=>{
 for(const change of [w=>w.history.replaceState({},'', '/other'),w=>w.document.getElementById('u').remove(),w=>w.document.getElementById('u').readOnly=true]){
  const {w,capture,fill}=page('<input id="u"><input id="p" type="password">');capture('u');change(w);assert.equal(fill().ok,false);assert.equal(w.document.getElementById('p').value,'');w.close();
 }
 const {w,capture,fill}=page('<input id="p" type="password">');capture('p');assert.equal(fill().ok,true);assert.equal(fill().ok,false);w.close();
});
test('does not write a password if username handler replaces the form',()=>{
 const {w,capture,fill}=page('<form><input id="u"><input id="p" type="password"></form>');capture('u');
 w.document.getElementById('u').addEventListener('input',()=>w.document.getElementById('p').remove());
 assert.equal(fill().ok,false);w.close();
});
test('native target rejects tab navigation before sending credentials to page',async()=>{
 const {w}=page('<input id="u">');const sent=[];
 w.chrome.tabs={get:async()=>({url:'https://example.com/changed',active:true})};
 w.testTarget({request:'r',tabId:1,frameId:0,url:'https://example.com/login',top:'https://example.com/login',captured:Date.now()});
 w.testTransport({postMessage:m=>sent.push(m)});
 await w.receiveTest({kind:'fill',request:'r',url:'https://example.com/login',top:'https://example.com/login',username:'u',password:'p'});
 assert.equal(sent[0].kind,'filled');assert.equal(sent[0].ok,false);w.close();
});
test('greets the app with its version and reloads itself when the app asks',async()=>{
 const dom=new JSDOM('',{url:'https://extension.invalid/',runScripts:'outside-only'});const w=dom.window;
 const sent=[];let onPort,reloads=0;
 w.chrome={runtime:{getManifest:()=>({version:'1.2.3'}),reload:()=>reloads++,connectNative:()=>({postMessage:m=>sent.push(m),onMessage:{addListener:fn=>onPort=fn},onDisconnect:{addListener(){}}}),onStartup:{addListener(){}},onInstalled:{addListener(){}},onMessage:{addListener(){}}},action:{onClicked:{addListener(){}}}};
 w.eval(source);
 assert.deepEqual(sent.map(m=>[m.kind,m.version]),[['hello','1.2.3']]);
 assert.equal(reloads,0);
 onPort({kind:'reload'});await new Promise(r=>setTimeout(r,0));
 assert.equal(reloads,1);w.close();
});
test('manifests ask only for the permissions the extension uses (SEC-08)',()=>{
 const read=b=>JSON.parse(readFileSync(new URL(`../browser-extension/${b}/manifest.json`,import.meta.url),'utf8'));
 const generator=readFileSync(new URL('../scripts/package-browser-extension.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(generator,/'tabs'/);
 for (const b of ['chromium','firefox']) {
  const m=read(b);
  // No "tabs": the URL of HTTPS tabs comes with the host permission; with "tabs" the
  // extension could read the address and title of every tab, also non-HTTPS ones.
  assert.deepEqual(m.permissions,['nativeMessaging','scripting'],b);
  assert.deepEqual(m.host_permissions,['https://*/*'],b);
  assert.ok(m.content_scripts.every(c=>c.matches.every(x=>x==='https://*/*')),b);
 }
 // The code never relies on a permission it does not have.
 for (const f of ['background.js','save-capture.js','passkey-bridge.js','passkey-page.js'])
  assert.doesNotMatch(readFileSync(new URL(`../browser-extension/${f}`,import.meta.url),'utf8'),/\b(api|chrome|browser)\.(history|cookies|webRequest|storage|downloads)\b/,f);
});
