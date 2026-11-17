import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdirSync,writeFileSync,readFileSync,existsSync,mkdtempSync} from 'node:fs';
import {resolve,join} from 'node:path';
const exe=resolve('src-tauri/target/release/jesse_browser_host.exe');
const id=readFileSync('browser-extension/chromium-id.txt','utf8').trim();
const frame=value=>{const data=Buffer.from(JSON.stringify(value));const size=Buffer.alloc(4);size.writeUInt32LE(data.length);return Buffer.concat([size,data])};
function messages(stream){
 let buffered=Buffer.alloc(0),waiting=[],queue=[];
 stream.on('data',data=>{buffered=Buffer.concat([buffered,data]);while(buffered.length>=4&&buffered.length>=4+buffered.readUInt32LE(0)){const size=buffered.readUInt32LE(0);const value=JSON.parse(buffered.subarray(4,4+size));buffered=buffered.subarray(4+size);if(waiting.length)waiting.shift()(value);else queue.push(value)}});
 return ()=>queue.length?Promise.resolve(queue.shift()):new Promise(resolve=>waiting.push(resolve));
}
test('native host authenticates and forwards framed messages in both directions',{skip:!existsSync(exe),timeout:10000},async()=>{
 const root=resolve('src-tauri/target/host-tests');mkdirSync(root,{recursive:true});const appdata=mkdtempSync(join(root,'profile-'));
 const dir=join(appdata,'JesseArchive/browser');mkdirSync(dir,{recursive:true});
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 writeFileSync(join(dir,'connection.json'),JSON.stringify({port:server.address().port,token:'synthetic-test-token'}));
 const connection=once(server,'connection');
 const child=spawn(exe,[`chrome-extension://${id}/`],{env:{...process.env,APPDATA:appdata},windowsHide:true});
 try {
  const output=messages(child.stdout);const [socket]=await connection;const input=messages(socket);
  socket.on('error',error=>{if(error.code!=='ECONNRESET')throw error});
  assert.equal((await input()).token,'synthetic-test-token');
  child.stdin.write(frame({kind:'open'}));assert.equal((await input()).kind,'open');
  const reply={kind:'context',request:'synthetic-日本語'};socket.write(frame(reply));assert.deepEqual(await output(),reply);
  socket.end();await once(child,'exit');
 } finally {child.kill();server.close();}
});
test('native host rejects a caller outside the extension allowlist',{skip:!existsSync(exe),timeout:5000},async()=>{
 const child=spawn(exe,['chrome-extension://unauthorized/'],{windowsHide:true});const next=messages(child.stdout);const exit=once(child,'exit');
 assert.equal((await next()).kind,'error');await exit;
});
