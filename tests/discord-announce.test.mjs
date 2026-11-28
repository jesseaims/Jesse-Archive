// Discord release announcement (scripts/discord-announce.mjs): no network, fake fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { announce, buildMessage, credentials, entriesFor } from '../scripts/discord-announce.mjs';

const entries = [
  { id: 'c', version: '2.1.0', title: 'Terza', description: 'Novità tre', important: true },
  { id: 'b', version: '2.0.1', title: 'Seconda', description: 'Novità due' },
  { id: 'a', version: 'Beta 2.0.0', title: 'Prima', description: 'Novità uno' },
  { id: 'old', version: 'v2', title: 'Etichetta storica', description: 'Non è una versione' },
];

test('picks the entries of the version, or of every version since the previous release', () => {
  assert.deepEqual(
    entriesFor(entries, '2.0.1').map((e) => e.id),
    ['b'],
  );
  assert.deepEqual(
    entriesFor(entries, '2.1.0', '2.0.0').map((e) => e.id),
    ['c', 'b'],
  );
  assert.deepEqual(
    entriesFor(entries, '2.0.0').map((e) => e.id),
    ['a'],
    'Beta prefix accepted, "v2" ignored',
  );
});

test('the message has an Italian and an English embed per entry and no mentions', () => {
  const english = { c: ['Third', 'News three'], b: ['Second', 'News two'] };
  const m = buildMessage({
    version: '2.1.0',
    entries: entriesFor(entries, '2.1.0', '2.0.0'),
    english,
  });
  assert.match(m.content, /NOTIZIA IMPORTANTE · IMPORTANT NEWS/);
  assert.match(m.content, /Jesse's Archive 2\.1\.0/);
  assert.deepEqual(
    m.embeds.map((e) => e.title),
    ['⭐ 🇮🇹 Terza', '⭐ 🇬🇧 Third', '🇮🇹 Seconda', '🇬🇧 Second'],
  );
  assert.ok(m.embeds.every((e) => e.url.endsWith('/releases/tag/v2.1.0')));
  assert.deepEqual(m.allowed_mentions, { parse: [] });
  const many = Array.from({ length: 7 }, (_, i) => ({
    id: `n${i}`,
    version: '3.0.0',
    title: `T${i}`,
    description: 'x'.repeat(5000),
  }));
  const big = buildMessage({ version: '3.0.0', entries: many });
  assert.equal(big.embeds.length, 8, 'at most 4 entries (Discord allows 10 embeds)');
  assert.ok(big.embeds.every((e) => e.description.length <= 4000));
  assert.match(big.content, /Tutte le novità/);
});

const TOKEN = 'sintetico_non_valido_xxxxxxxxx.prova.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyy';

test('only a well-formed bot token and channel are accepted', () => {
  assert.equal(credentials('{}'), null);
  assert.deepEqual(credentials(JSON.stringify({ token: TOKEN, channel: '1576061237618282526' })), {
    token: TOKEN,
    channel: '1576061237618282526',
  });
  assert.throws(
    () => credentials(JSON.stringify({ token: 'non-un-token', channel: '1576061237618282526' })),
    /Token/,
  );
  assert.throws(
    () => credentials(JSON.stringify({ token: TOKEN, channel: '../../users/@me' })),
    /Canale/,
  );
  assert.throws(() => credentials('non json'), /non leggibile/);
});

test('posts as the bot, crossposts in an announcement channel and reports errors', async () => {
  const calls = [];
  let fail = false;
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (fail) return new Response('{"message":"Missing Access"}', { status: 403 });
    const body = url.endsWith('/messages')
      ? { id: '42' }
      : url.endsWith('/crosspost')
        ? { id: '42' }
        : { type: 5 };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  await announce({
    token: TOKEN,
    channel: '123456789012345678',
    message: { content: 'ciao' },
    fetch,
  });
  assert.equal(calls[0].url, 'https://discord.com/api/v10/channels/123456789012345678/messages');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, `Bot ${TOKEN}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), { content: 'ciao' });
  assert.ok(calls.some((c) => c.url.endsWith('/messages/42/crosspost')));
  fail = true;
  await assert.rejects(
    announce({ token: TOKEN, channel: '123456789012345678', message: { content: 'ciao' }, fetch }),
    /Discord ha risposto 403/,
  );
});
