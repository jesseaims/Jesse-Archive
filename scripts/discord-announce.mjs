// Announces a published release in the Discord #announcements channel as the
// project's bot ("Jesse's Archive", with the project logo): the curated News entries
// of the version (Italian and English) and the download link. Called by
// Publish-Release.ps1 after the release; never blocks it.
// The bot token and the channel arrive on stdin as JSON ({"token": "...", "channel":
// "<id>"}), saved DPAPI-encrypted by scripts\Discord-Bot.ps1: never printed or written
// in clear.
// Usage: node scripts/discord-announce.mjs <version> [previous version] [--dry-run | --check]
//   --dry-run  prints the message that would be sent (no credentials needed)
//   --check    verifies the bot and the channel (nothing is posted)
// Requires Node >= 23.6 (TypeScript type stripping) to import the .ts modules.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REPOSITORY = 'jesseaims/Jesse-Archive';
const API = 'https://discord.com/api/v10';
const COLOR = 0xa97ee0; // the app's base purple
const TOKEN = /^[\w-]{20,100}\.[\w-]{4,20}\.[\w-]{20,100}$/;
const SNOWFLAKE = /^\d{15,25}$/;

const parse = (v) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
const compare = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
};
const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** News entries of <version> (or of every version after <previous>, up to <version>). */
export function entriesFor(entries, version, previous) {
  const range = previous && compare(previous, version) < 0;
  return entries.filter((e) => {
    // Old entries carry labels such as "v2": only real X.Y.Z versions are compared.
    const v = String(e.version || '').replace(/^Beta\s+/, '');
    if (!/^\d+\.\d+\.\d+$/.test(v)) return false;
    return range ? compare(v, previous) > 0 && compare(v, version) <= 0 : compare(v, version) === 0;
  });
}

/** The message: one Italian and one English embed per entry (Discord allows 10). */
export function buildMessage({ version, entries, english = {} }) {
  const url = `https://github.com/${REPOSITORY}/releases/tag/v${version}`;
  const shown = entries.slice(0, 4);
  const embeds = [];
  for (const e of shown) {
    const [enTitle, enText] = english[e.id] || [e.title, e.description];
    const mark = e.important ? '⭐ ' : '';
    embeds.push(
      {
        title: clip(`${mark}🇮🇹 ${e.title}`, 256),
        description: clip(e.description, 4000),
        color: COLOR,
        url,
      },
      {
        title: clip(`${mark}🇬🇧 ${enTitle}`, 256),
        description: clip(enText, 4000),
        color: COLOR,
        url,
      },
    );
  }
  const important = shown.some((e) => e.important);
  const lines = [
    important ? '**⭐ NOTIZIA IMPORTANTE · IMPORTANT NEWS**' : null,
    `🇮🇹 **Jesse's Archive ${version}** è disponibile: l'app si aggiorna da sola, oppure scarica il setup da https://jessearchive.it/download/`,
    `🇬🇧 **Jesse's Archive ${version}** is available: the app updates itself, or download the installer from https://jessearchive.it/en/download/`,
    entries.length > shown.length ? `Tutte le novità · All the news: ${url}` : null,
  ].filter(Boolean);
  return { content: clip(lines.join('\n'), 2000), embeds, allowed_mentions: { parse: [] } };
}

/** Bot token and announcements channel, or null when the bot is not configured. */
export function credentials(input) {
  let value;
  try {
    value = JSON.parse(input || '{}');
  } catch {
    throw new Error('Configurazione del bot Discord non leggibile.');
  }
  const token = String(value.token || '').trim();
  const channel = String(value.channel || '').trim();
  if (!token && !channel) return null;
  if (!TOKEN.test(token)) throw new Error('Token del bot Discord non valido.');
  if (!SNOWFLAKE.test(channel)) throw new Error('Canale Discord non valido.');
  return { token, channel };
}

async function discord(path, { token, method = 'GET', body, fetch = globalThis.fetch }) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (https://jessearchive.it, 1.0)',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`Discord ha risposto ${response.status} ${detail}`.trim());
  }
  return response.status === 204 ? null : response.json();
}

export async function announce({ token, channel, message, fetch }) {
  const sent = await discord(`/channels/${channel}/messages`, {
    token,
    method: 'POST',
    body: message,
    fetch,
  });
  // In an announcement channel, also send the message to the servers that follow it.
  try {
    const info = await discord(`/channels/${channel}`, { token, fetch });
    if (info?.type === 5)
      await discord(`/channels/${channel}/messages/${sent.id}/crosspost`, {
        token,
        method: 'POST',
        fetch,
      });
  } catch {
    // The announcement is already posted: following servers are a bonus.
  }
  return sent;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const check = args.includes('--check');
  const [version, previous] = args
    .filter((a) => !a.startsWith('--'))
    .map((v) => v.replace(/^v/, ''));
  const input = dryRun ? '' : readFileSync(0, 'utf8').replace(/^﻿/, '').trim();
  const creds = dryRun ? null : credentials(input);
  if (!dryRun && !creds) {
    console.log('Discord: bot non configurato, annuncio saltato (scripts\\Discord-Bot.ps1).');
    return;
  }
  if (check) {
    const me = await discord('/users/@me', { token: creds.token });
    const info = await discord(`/channels/${creds.channel}`, { token: creds.token });
    console.log(`Discord: bot «${me.username}» valido, canale #${info.name}.`);
    return;
  }
  if (!version)
    throw new Error('Uso: node scripts/discord-announce.mjs <versione> [versione precedente]');
  const { NEWS_ENTRIES } = await import('../src/news-changelog.ts');
  const { default: english } = await import('../src/locales/news/en.ts');
  const entries = entriesFor(
    NEWS_ENTRIES,
    version,
    previous ? previous.replace(/^Beta\s+/, '') : '',
  );
  if (!entries.length) {
    console.log(`Discord: nessuna voce News per la ${version}, annuncio saltato.`);
    return;
  }
  const message = buildMessage({ version, entries, english });
  if (dryRun) {
    console.log(JSON.stringify(message, null, 2));
    return;
  }
  await announce({ ...creds, message });
  console.log(`Discord: annuncio della ${version} pubblicato in #announcements.`);
}

if (
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(process.argv[1]).toLowerCase()
) {
  main().catch((error) => {
    console.error(`Discord: ${error.message}`);
    process.exit(1);
  });
}
