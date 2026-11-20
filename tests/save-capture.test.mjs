import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

// jsdom cannot create trusted events: the content script's isTrusted checks are
// replaced, and "typed by the user" means an input event was dispatched on the field.
const captureSource = readFileSync(
  new URL('../browser-extension/save-capture.js', import.meta.url),
  'utf8',
).replaceAll('e.isTrusted', 'true');
const backgroundSource = readFileSync(
  new URL('../browser-extension/background.js', import.meta.url),
  'utf8',
);
const plain = (v) => JSON.parse(JSON.stringify(v));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function page(html, url = 'https://www.example.com/register') {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const w = dom.window;
  const sent = [];
  w.chrome = { runtime: { sendMessage: async (m) => void sent.push(plain(m)) } };
  w.HTMLInputElement.prototype.getClientRects = function () {
    return this.hidden ? [] : [{}];
  };
  w.Element.prototype.getClientRects = function () {
    return [{}];
  };
  w.eval(captureSource);
  const type = (id, value) => {
    const el = typeof id === 'string' ? w.document.getElementById(id) : id;
    el.value = value;
    el.dispatchEvent(new w.Event('input', { bubbles: true, composed: true }));
  };
  const submit = (form = w.document.querySelector('form')) =>
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  return { w, sent, type, submit };
}

test('sign-up: email as username, other fields offered, password confirmed', () => {
  const { w, sent, type, submit } = page(`<form>
    <label for="n">Nome visualizzato</label><input id="n" name="displayName">
    <input id="e" type="email" name="email">
    <input id="b" name="birth" autocomplete="bday">
    <input id="p" type="password"><input id="c" type="password"></form>`);
  type('n', 'Jesse');
  type('e', 'jesse@example.com');
  type('b', '2000-01-02');
  type('p', 'sëgreto🔑');
  type('c', 'sëgreto🔑');
  submit();
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.equal(m.kind, 'save');
  assert.equal(m.password, 'sëgreto🔑');
  assert.equal(m.signup, true);
  assert.equal(m.old, '');
  assert.deepEqual(
    m.fields.map((f) => [f.label, f.value]),
    [
      ['Nome visualizzato', 'Jesse'],
      ['email', 'jesse@example.com'],
      ['birth', '2000-01-02'],
    ],
  );
  assert.equal(m.fields[m.user].value, 'jesse@example.com');
  assert.equal(m.fields[2].auto, 'bday');
  w.close();
});

test('login: declared username wins, no confirmation means not a sign-up', () => {
  const { w, sent, type, submit } = page(
    '<form><input id="e" type="email"><input id="u" autocomplete="username"><input id="p" type="password"></form>',
  );
  type('e', 'a@example.com');
  type('u', 'utente');
  type('p', 'pw');
  submit();
  assert.equal(sent[0].signup, false);
  assert.equal(sent[0].fields[sent[0].user].value, 'utente');
  w.close();
});

test('nothing is sent unless the user typed the password', () => {
  const { w, sent, type, submit } = page(
    '<form><input id="u"><input id="p" type="password"></form>',
  );
  type('u', 'utente');
  // Set by a page script or by Jesse's Archive's own fill: no trusted input.
  w.document.getElementById('p').value = 'pw';
  submit();
  assert.equal(sent.length, 0);
  w.close();
});

test('payment data, one-time codes, hidden and search fields are never offered', () => {
  const { w, sent, type, submit } = page(`<form>
    <input id="u" autocomplete="username">
    <input id="cc" autocomplete="cc-number"><input id="cvv" name="cvv">
    <input id="otp" name="otp"><input id="code" autocomplete="one-time-code">
    <input id="s" type="search"><input id="h" type="hidden" value="secret">
    <input id="x" hidden><input id="p" type="password"></form>`);
  for (const [id, v] of [
    ['u', 'utente'],
    ['cc', '4111111111111111'],
    ['cvv', '123'],
    ['otp', '999999'],
    ['code', '111111'],
    ['s', 'cerca'],
    ['x', 'nascosto'],
    ['p', 'pw'],
  ])
    type(id, v);
  submit();
  assert.deepEqual(
    sent[0].fields.map((f) => f.value),
    ['utente'],
  );
  w.close();
});

test('mismatched confirmation or ambiguous pairs are ignored; change forms carry the old password', () => {
  for (const values of [
    ['a', 'b'],
    ['a', 'b', 'c'],
  ]) {
    const { w, sent, type, submit } = page(
      `<form>${values.map((_, i) => `<input id="p${i}" type="password">`).join('')}</form>`,
    );
    values.forEach((v, i) => type(`p${i}`, v));
    submit();
    assert.equal(sent.length, 0, values.join());
    w.close();
  }
  const { w, sent, type, submit } = page(
    '<form><input id="a" type="password"><input id="b" type="password"><input id="c" type="password"></form>',
  );
  type('a', 'vecchia');
  type('b', 'nuova');
  type('c', 'nuova');
  submit();
  assert.equal(sent[0].old, 'vecchia');
  assert.equal(sent[0].password, 'nuova');
  assert.equal(sent[0].signup, false);
  // Unchanged password: nothing to save.
  const same = page(
    '<form><input id="a" type="password" autocomplete="current-password"><input id="b" type="password" autocomplete="new-password"></form>',
  );
  same.type('a', 'x');
  same.type('b', 'x');
  same.submit();
  assert.equal(same.sent.length, 0);
  w.close();
  same.w.close();
});

test('forms without <form> and fields in open shadow roots, sent once for click + submit', () => {
  const { w, sent, type } = page(
    '<div id="box"><x-a id="ha"></x-a><x-a id="hp"></x-a><button id="go">Registrati</button></div>',
  );
  const field = (id, kind) => {
    const input = w.document.createElement('input');
    input.type = kind;
    w.document.getElementById(id).attachShadow({ mode: 'open' }).appendChild(input);
    return input;
  };
  const u = field('ha', 'email');
  const p = field('hp', 'password');
  type(u, 'jesse@example.com');
  type(p, 'pw');
  const go = w.document.getElementById('go');
  go.click();
  go.click();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].fields[sent[0].user].value, 'jesse@example.com');
  w.close();
});

test('first step of a two-step login sends only the identifier', () => {
  const { w, sent, type, submit } = page(
    '<form><input id="e" type="email"><button>Avanti</button></form>',
  );
  type('e', 'jesse@example.com');
  submit();
  assert.deepEqual(sent, [{ kind: 'save-user', value: 'jesse@example.com' }]);
  w.close();
  // A search box or any other text field is never remembered.
  const search = page('<form><input id="q" name="q"><button>Cerca</button></form>');
  search.type('q', 'regali di natale');
  search.submit();
  assert.deepEqual(search.sent, []);
  search.w.close();
});

// Background script: what reaches the app.
function background() {
  const dom = new JSDOM('', { url: 'https://example.com/', runScripts: 'outside-only' });
  const w = dom.window;
  const native = [];
  const listeners = [];
  w.chrome = {
    runtime: {
      id: 'ext',
      getManifest: () => ({ version: '1.0.0' }),
      connectNative: () => ({
        postMessage: (m) => native.push(plain(m)),
        onMessage: { addListener() {} },
        onDisconnect: { addListener() {} },
      }),
      onStartup: { addListener() {} },
      onInstalled: { addListener() {} },
      onMessage: { addListener: (fn) => listeners.push(fn) },
    },
    action: { onClicked: { addListener() {} } },
  };
  w.eval(backgroundSource + '\n globalThis.receiveTest = receive;');
  const deliver = (message, sender) => listeners.forEach((fn) => fn(message, sender, () => {}));
  const sender = (
    url = 'https://accounts.example.com/signup',
    top = 'https://www.example.com/',
  ) => ({
    id: 'ext',
    url,
    frameId: 1,
    tab: { id: 7, url: top },
  });
  return { w, native, deliver, sender, saves: () => native.filter((m) => m.kind === 'save') };
}
const message = {
  kind: 'save',
  password: 'pw',
  old: '',
  signup: true,
  user: 0,
  fields: [{ label: 'Email', auto: 'email', type: 'email', value: 'a@example.com' }],
};

test('background forwards only when the app enabled saving, with browser-provided addresses', async () => {
  const b = background();
  b.deliver(message, b.sender());
  assert.equal(b.saves().length, 0, 'config not received yet: queued');
  await b.w.receiveTest({ kind: 'config', save: true });
  assert.equal(b.saves().length, 1);
  const sent = b.saves()[0];
  assert.equal(sent.url, 'https://accounts.example.com/signup');
  assert.equal(sent.top, 'https://www.example.com/');
  assert.equal(sent.password, 'pw');
  // Other extensions, plain HTTP pages and pages outside a tab are ignored.
  b.deliver(message, { ...b.sender(), id: 'other' });
  b.deliver(message, b.sender('http://example.com/'));
  b.deliver(message, { ...b.sender(), tab: undefined });
  assert.equal(b.saves().length, 1);
  await b.w.receiveTest({ kind: 'config', save: false });
  b.deliver(message, b.sender());
  assert.equal(b.saves().length, 1);
  b.w.close();
});

test('background drops a queued save when the app has saving off', async () => {
  const b = background();
  b.deliver(message, b.sender());
  await b.w.receiveTest({ kind: 'config', save: false });
  await tick();
  assert.equal(b.saves().length, 0);
  b.w.close();
});

test('background joins the two steps of a login on the same site', async () => {
  const b = background();
  await b.w.receiveTest({ kind: 'config', save: true });
  b.deliver({ kind: 'save-user', value: 'jesse@example.com' }, b.sender());
  b.deliver({ ...message, signup: false, user: -1, fields: [] }, b.sender());
  const sent = b.saves()[0];
  assert.equal(sent.user, 0);
  assert.equal(sent.fields[0].value, 'jesse@example.com');
  // Remembered for one save only, and never across sites.
  b.deliver({ kind: 'save-user', value: 'x@example.com' }, b.sender());
  b.deliver(
    { ...message, user: -1, fields: [] },
    b.sender('https://other.test/', 'https://other.test/'),
  );
  assert.equal(b.saves()[1].user, -1);
  b.w.close();
});
