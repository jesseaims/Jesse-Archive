import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const pageSource = readFileSync(
  new URL('../browser-extension/passkey-page.js', import.meta.url),
  'utf8',
);
const backgroundSource = readFileSync(
  new URL('../browser-extension/background.js', import.meta.url),
  'utf8',
);
const ORIGIN = 'https://login.example.com';
// Objects created inside jsdom belong to another realm: compare plain copies.
const plain = (v) => JSON.parse(JSON.stringify(v));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const b64u = (text) => Buffer.from(text).toString('base64url');

// Page with WebAuthn stubs. jsdom's postMessage sets neither source nor origin,
// so it is replaced by a browser-like version before the hook captures it.
function page({ reply = () => ({ action: 'fallback' }) } = {}) {
  const dom = new JSDOM('', { url: `${ORIGIN}/account`, runScripts: 'outside-only' });
  const w = dom.window;
  w.postMessage = (data) =>
    queueMicrotask(() =>
      w.dispatchEvent(new w.MessageEvent('message', { data, origin: ORIGIN, source: w })),
    );
  w.PublicKeyCredential = class PublicKeyCredential {};
  w.AuthenticatorAttestationResponse = class AuthenticatorAttestationResponse {};
  w.AuthenticatorAssertionResponse = class AuthenticatorAssertionResponse {};
  const native = [];
  Object.defineProperty(w.navigator, 'credentials', {
    value: {
      create: async (o) => (native.push(['create', o]), 'native-create'),
      get: async (o) => (native.push(['get', o]), 'native-get'),
    },
  });
  const requests = [];
  // Fake bridge: answers each request like the extension would.
  w.addEventListener('message', (e) => {
    if (e.data?.jesseArchivePasskey !== 'request') return;
    requests.push(e.data);
    if (e.data.op === 'cancel') return;
    const result = reply(e.data);
    if (result) w.postMessage({ jesseArchivePasskey: 'response', id: e.data.id, result });
  });
  w.eval(pageSource);
  return { w, native, requests };
}

const createOptions = (w, extra = {}) => ({
  publicKey: {
    rp: { id: 'example.com', name: 'Example' },
    user: { id: new w.Uint8Array([1, 2, 3]), name: 'mario', displayName: 'Mario' },
    challenge: new w.Uint8Array([9, 8, 7]).buffer,
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    excludeCredentials: [{ type: 'public-key', id: new w.Uint8Array([5]) }],
    extensions: { credProps: true },
    ...extra,
  },
});

test('create: serialises options and builds a PublicKeyCredential from the app result', async () => {
  const { w, requests, native } = page({
    reply: () => ({
      action: 'result',
      op: 'create',
      id: b64u('cred'),
      clientDataJSON: b64u('{"type":"webauthn.create"}'),
      attestationObject: b64u('att'),
      authenticatorData: b64u('auth'),
      publicKey: b64u('spki'),
      publicKeyAlgorithm: -7,
      transports: ['internal'],
      extensions: { credProps: { rk: true } },
    }),
  });
  const credential = await w.navigator.credentials.create(createOptions(w));
  const sent = requests[0];
  assert.equal(sent.op, 'create');
  assert.equal(sent.options.challenge, Buffer.from([9, 8, 7]).toString('base64url'));
  assert.equal(sent.options.user.id, Buffer.from([1, 2, 3]).toString('base64url'));
  assert.deepEqual(sent.options.excludeCredentials, [Buffer.from([5]).toString('base64url')]);
  assert.equal(sent.options.credProps, true);
  assert.ok(credential instanceof w.PublicKeyCredential);
  assert.ok(credential.response instanceof w.AuthenticatorAttestationResponse);
  assert.equal(credential.id, b64u('cred'));
  assert.equal(Buffer.from(credential.rawId).toString(), 'cred');
  assert.equal(Buffer.from(credential.response.attestationObject).toString(), 'att');
  assert.equal(credential.response.getPublicKeyAlgorithm(), -7);
  assert.deepEqual(plain(credential.getClientExtensionResults()), { credProps: { rk: true } });
  assert.equal(credential.toJSON().response.attestationObject, b64u('att'));
  assert.equal(native.length, 0);
  w.close();
});

test('get: assertion result, fallback to the browser and app errors', async () => {
  const replies = [
    {
      action: 'result',
      op: 'get',
      id: b64u('c'),
      clientDataJSON: b64u('cd'),
      authenticatorData: b64u('ad'),
      signature: b64u('sig'),
      userHandle: b64u('u'),
    },
    { action: 'fallback' },
    { action: 'error', name: 'NotAllowedError', message: 'Operazione annullata.' },
  ];
  const { w, native } = page({ reply: () => replies.shift() });
  const options = { publicKey: { challenge: new w.Uint8Array([1]), rpId: 'example.com' } };
  const assertion = await w.navigator.credentials.get(options);
  assert.ok(assertion.response instanceof w.AuthenticatorAssertionResponse);
  assert.equal(Buffer.from(assertion.response.signature).toString(), 'sig');
  assert.equal(Buffer.from(assertion.response.userHandle).toString(), 'u');
  assert.equal(await w.navigator.credentials.get(options), 'native-get');
  assert.equal(native[0][1], options, 'fallback passes the original options to the browser');
  await assert.rejects(w.navigator.credentials.get(options), (e) => e.name === 'NotAllowedError');
  w.close();
});

test('conditional, non-WebAuthn and malformed requests go straight to the browser', async () => {
  const { w, native, requests } = page();
  assert.equal(
    await w.navigator.credentials.get({
      publicKey: { challenge: new w.Uint8Array([1]) },
      mediation: 'conditional',
    }),
    'native-get',
  );
  assert.equal(await w.navigator.credentials.get({ password: true }), 'native-get');
  assert.equal(
    await w.navigator.credentials.create({ publicKey: { challenge: 'not-a-buffer' } }),
    'native-create',
  );
  await tick();
  assert.equal(requests.length, 0);
  assert.equal(native.length, 3);
  w.close();
});

test('aborting cancels the request in the app and rejects with AbortError', async () => {
  const { w, requests } = page({ reply: () => null });
  const controller = new w.AbortController();
  const pending = w.navigator.credentials.create({
    ...createOptions(w),
    signal: controller.signal,
  });
  await tick();
  controller.abort();
  await assert.rejects(pending, (e) => e.name === 'AbortError');
  await tick();
  assert.deepEqual(
    requests.map((r) => r.op),
    ['create', 'cancel'],
  );
  assert.equal(requests[1].id, requests[0].id);
  w.close();
});

// Background script with a fake native port.
function background() {
  const dom = new JSDOM('', { url: 'https://extension.invalid/', runScripts: 'outside-only' });
  const w = dom.window;
  const sent = [];
  let onMessage, onPortMessage, onDisconnect;
  w.chrome = {
    runtime: {
      id: 'ext',
      getManifest: () => ({ version: '1.0.0' }),
      connectNative: () => ({
        // The connection greeting (version check) is covered in browser-extension.test.mjs.
        postMessage: (m) => m.kind !== 'hello' && sent.push(m),
        onMessage: { addListener: (fn) => (onPortMessage = fn) },
        onDisconnect: { addListener: (fn) => (onDisconnect = fn) },
      }),
      onStartup: { addListener() {} },
      onInstalled: { addListener() {} },
      onMessage: { addListener: (fn) => (onMessage = fn) },
    },
    action: { onClicked: { addListener() {} } },
    tabs: { get: async () => ({ windowId: 1 }) },
    windows: { update: async () => ({}) },
  };
  w.eval(backgroundSource);
  const call = (message, sender) =>
    new Promise((resolve) => {
      const async = onMessage(message, { id: 'ext', ...sender }, resolve);
      if (!async) setTimeout(() => resolve('sync'), 0);
    });
  return {
    w,
    sent,
    call,
    port: () => ({ onPortMessage, onDisconnect }),
    onMessage: () => onMessage,
  };
}

test('background takes the origin from the browser and only for HTTPS top frames', async () => {
  const { w, sent, call, port } = background();
  for (const sender of [
    { tab: { id: 1 }, frameId: 2, url: `${ORIGIN}/a` },
    { tab: { id: 1 }, frameId: 0, url: 'http://login.example.com/a' },
    { frameId: 0, url: `${ORIGIN}/a` },
  ]) {
    assert.deepEqual(
      plain(await call({ kind: 'passkey', op: 'get', pageRequest: 'p', options: {} }, sender)),
      { action: 'fallback' },
    );
  }
  assert.equal(sent.length, 0);
  const result = call(
    {
      kind: 'passkey',
      op: 'get',
      pageRequest: 'p',
      origin: 'https://evil.test',
      options: { rpId: 'example.com' },
    },
    { tab: { id: 1 }, frameId: 0, url: `${ORIGIN}/a?x=1` },
  );
  await tick();
  assert.equal(sent[0].kind, 'passkey');
  assert.equal(sent[0].origin, ORIGIN, 'origin from sender.url, not from the page');
  port().onPortMessage({
    kind: 'passkey-result',
    request: sent[0].request,
    result: { action: 'fallback', from: 'app' },
  });
  assert.deepEqual(plain(await result), { action: 'fallback', from: 'app' });
  w.close();
});

test('background: page abort notifies the app, disconnect falls back to the browser', async () => {
  const { w, sent, call, port, onMessage } = background();
  const sender = { tab: { id: 7 }, frameId: 0, url: `${ORIGIN}/` };
  let answered;
  onMessage()(
    { kind: 'passkey', op: 'create', pageRequest: 'page-1', options: {} },
    { id: 'ext', ...sender },
    (r) => (answered = r),
  );
  await call({ kind: 'passkey', op: 'cancel', pageRequest: 'page-1' }, sender);
  assert.deepEqual(
    sent.map((m) => m.kind),
    ['passkey', 'passkey-cancel'],
  );
  assert.equal(sent[1].request, sent[0].request);
  const pending = call({ kind: 'passkey', op: 'get', pageRequest: 'page-2', options: {} }, sender);
  await tick();
  port().onDisconnect();
  assert.deepEqual(plain(await pending), { action: 'fallback' });
  assert.equal(answered, undefined, 'the aborted request is not answered again');
  w.close();
});
