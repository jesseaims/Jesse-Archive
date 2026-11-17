import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../browser-extension/background.js',import.meta.url),'utf8');
function page(html,url='https://example.com/login') {
 const dom=new JSDOM(html,{url,runScripts:'outside-only'});
 const w=dom.window;
 w.chrome={runtime:{connectNative:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),onStartup:{addListener(){}},onInstalled:{addListener(){}}},action:{onClicked:{addListener(){}}}};
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
