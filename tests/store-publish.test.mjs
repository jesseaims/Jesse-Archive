// Store publishing (scripts/publish-store-extension.mjs) against simulated APIs:
// no network, synthetic keys generated here.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, createVerify, generateKeyPairSync} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  amoToken,
  chromeAssertion,
  chromeStoreId,
  contentHash,
  publishChrome,
  publishFirefox,
  FIREFOX_ID,
} from '../scripts/publish-store-extension.mjs';

const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const serviceAccount = {
  client_email: 'publisher@progetto-di-prova.iam.gserviceaccount.com',
  private_key: privateKey.export({type: 'pkcs8', format: 'pem'}),
  token_uri: 'https://oauth2.googleapis.com/token',
};
const parts = (jwt) => jwt.split('.').map((p, i) => (i < 2 ? JSON.parse(Buffer.from(p, 'base64url')) : p));
const zip = join(mkdtempSync(join(tmpdir(), 'store-')), 'ext.zip');
writeFileSync(zip, 'zip-sintetico');

/** Simulated fetch: answers from a list of [method, url pattern, status, body]. */
function fakeFetch(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    calls.push({method, url, init});
    const route = routes.find(([m, re]) => m === method && re.test(url));
    if (!route) throw new Error(`chiamata inattesa: ${method} ${url}`);
    const [, , status, body] = route;
    const value = typeof body === 'function' ? body(calls.filter((c) => c.method === method && route[1].test(c.url)).length) : body;
    return new Response(JSON.stringify(value), {status});
  };
  return {fetch, calls};
}
const token = ['POST', /oauth2\.googleapis\.com\/token/, 200, {access_token: 'token-sintetico'}];

test('the store ID comes from the list the app accepts', () => {
  assert.equal(chromeStoreId(), 'odgnlpapinmknnmibaiogdmbcamlajgf');
  assert.throws(() => chromeStoreId('nessun id qui'));
});

test('a release that only changes the version number is not a new submission', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ext-'));
  cpSync('browser-extension/chromium', dir, {recursive: true});
  const before = contentHash(dir);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({...manifest, version: '99.0.0'}, null, 2));
  assert.equal(contentHash(dir), before);
  writeFileSync(join(dir, 'background.js'), readFileSync(join(dir, 'background.js'), 'utf8') + '\n// cambio');
  assert.notEqual(contentHash(dir), before);
  rmSync(dir, {recursive: true, force: true});
});

test('the service account assertion is a valid RS256 JWT for the store scope', () => {
  const jwt = chromeAssertion(serviceAccount, 1_700_000_000_000);
  const [header, claims, signature] = parts(jwt);
  assert.deepEqual(header, {alg: 'RS256', typ: 'JWT'});
  assert.equal(claims.iss, serviceAccount.client_email);
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/chromewebstore');
  assert.equal(claims.exp - claims.iat, 3600);
  const verify = createVerify('RSA-SHA256').update(jwt.split('.').slice(0, 2).join('.'));
  assert.ok(verify.verify(publicKey, Buffer.from(signature, 'base64url')));
  assert.throws(() => chromeAssertion({client_email: 'x'}));
});

test('the AMO token is HS256, unique and valid well under five minutes', () => {
  const credentials = {issuer: 'user:1:2', secret: 'segreto-sintetico'};
  const a = amoToken(credentials, 1_700_000_000_000);
  const [header, claims, signature] = parts(a);
  assert.deepEqual(header, {alg: 'HS256', typ: 'JWT'});
  assert.equal(claims.iss, 'user:1:2');
  assert.ok(claims.exp - claims.iat <= 300);
  const expected = createHmac('sha256', 'segreto-sintetico').update(a.split('.').slice(0, 2).join('.')).digest('base64url');
  assert.equal(signature, expected);
  assert.notEqual(parts(amoToken(credentials))[1].jti, claims.jti);
  assert.throws(() => amoToken({issuer: 'solo'}));
});

test('Chrome: while the previous version is in review nothing is uploaded', async () => {
  const {fetch, calls} = fakeFetch([
    token,
    ['GET', /:fetchStatus$/, 200, {submittedItemRevisionStatus: {state: 'PENDING_REVIEW'}}],
  ]);
  const out = await publishChrome({credentials: {serviceAccount, publisherId: 'pub'}, itemId: 'id', zip, fetch});
  assert.equal(out.result, 'pending');
  assert.ok(!calls.some((c) => /:upload|:publish/.test(c.url)));
});

test('Chrome: upload, wait for processing, then submit for review', async () => {
  const {fetch, calls} = fakeFetch([
    token,
    ['GET', /:fetchStatus$/, 200, (n) => (n === 1 ? {publishedItemRevisionStatus: {state: 'PUBLISHED'}} : {lastAsyncUploadState: 'SUCCEEDED'})],
    ['POST', /\/upload\/v2\/publishers\/pub\/items\/id:upload$/, 200, {uploadState: 'IN_PROGRESS'}],
    ['POST', /\/v2\/publishers\/pub\/items\/id:publish$/, 200, {state: 'PENDING_REVIEW'}],
  ]);
  const out = await publishChrome({credentials: {serviceAccount, publisherId: 'pub'}, itemId: 'id', zip, fetch, sleep: async () => {}});
  assert.deepEqual(out, {result: 'submitted', state: 'PENDING_REVIEW'});
  const upload = calls.find((c) => c.url.endsWith(':upload'));
  assert.equal(upload.init.headers.Authorization, 'Bearer token-sintetico');
  assert.equal(String(upload.init.body), 'zip-sintetico');
});

test('Chrome: a failed upload is reported and nothing is submitted', async () => {
  const {fetch, calls} = fakeFetch([
    token,
    ['GET', /:fetchStatus$/, 200, {}],
    ['POST', /:upload$/, 200, {uploadState: 'FAILED'}],
  ]);
  await assert.rejects(
    publishChrome({credentials: {serviceAccount, publisherId: 'pub'}, itemId: 'id', zip, fetch}),
    /non riuscito \(stato FAILED\)/,
  );
  assert.ok(!calls.some((c) => c.url.endsWith(':publish')));
});

test('Firefox: upload, wait for validation, then create the listed version', async () => {
  const credentials = {issuer: 'user:1:2', secret: 'segreto-sintetico'};
  const {fetch, calls} = fakeFetch([
    ['POST', /\/addons\/upload\/$/, 201, {uuid: 'u1', processed: false}],
    ['GET', /\/addons\/upload\/u1\/$/, 200, (n) => (n < 2 ? {uuid: 'u1', processed: false} : {uuid: 'u1', processed: true, valid: true})],
    ['POST', /\/addons\/addon\/browser%40jessearchive\.local\/versions\/$/, 201, {version: '1.9.6'}],
  ]);
  const out = await publishFirefox({credentials, zip, fetch, sleep: async () => {}});
  assert.equal(out.result, 'submitted');
  const upload = calls[0];
  assert.match(upload.init.headers.Authorization, /^JWT /);
  assert.equal(upload.init.body.get('channel'), 'listed');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {upload: 'u1'});
  assert.equal(FIREFOX_ID, 'browser@jessearchive.local');
});

test('Firefox: a package rejected by validation stops with its errors', async () => {
  const {fetch, calls} = fakeFetch([
    ['POST', /\/addons\/upload\/$/, 201, {uuid: 'u2', processed: true, valid: false, validation: {messages: [{type: 'error', message: 'manifest non valido'}, {type: 'warning', message: 'avviso'}]}}],
  ]);
  await assert.rejects(publishFirefox({credentials: {issuer: 'i', secret: 's'}, zip, fetch}), /manifest non valido/);
  assert.equal(calls.length, 1);
});

test('Firefox: before the first manual publication the error says so', async () => {
  const {fetch} = fakeFetch([
    ['POST', /\/addons\/upload\/$/, 201, {uuid: 'u3', processed: true, valid: true}],
    ['POST', /\/versions\/$/, 404, {detail: 'Not found.'}],
  ]);
  await assert.rejects(publishFirefox({credentials: {issuer: 'i', secret: 's'}, zip, fetch}), /prima versione va pubblicata a mano/);
});
