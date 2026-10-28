#!/usr/bin/env node
/**
 * Downloads the Word Rush dictionary and writes it where the app and backend read it.
 *
 * - Word list: ENABLE (public domain), the list most word games use.
 * - Blocklist: LDNOOBW English list (CC BY 4.0) so slurs and obscenities never
 *   count as words or show up in bot word lists. Extra words can be added to
 *   packages/engine/data/blocklist-extra.txt, one per line.
 *
 * Usage: node scripts/fetch-words.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORDS_URL = 'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt';
const BLOCK_URL =
  'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en';

const OUTPUTS = [
  join(ROOT, 'packages/engine/data/words.txt'),
  join(ROOT, 'apps/mobile/assets/words.txt'),
  join(ROOT, 'functions/data/words.txt'),
];

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

const lines = (text) => text.split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter(Boolean);

const [wordsText, blockText] = await Promise.all([get(WORDS_URL), get(BLOCK_URL)]);
const blocked = new Set(lines(blockText).filter((w) => /^[a-z]+$/.test(w)));
const extraPath = join(ROOT, 'packages/engine/data/blocklist-extra.txt');
if (existsSync(extraPath)) for (const w of lines(readFileSync(extraPath, 'utf8'))) if (!w.startsWith('#')) blocked.add(w);

const words = [...new Set(lines(wordsText))]
  .filter((w) => /^[a-z]{3,16}$/.test(w) && !blocked.has(w))
  .sort();

if (words.length < 150_000) throw new Error(`Word list looks wrong: only ${words.length} words`);

const body = words.join('\n') + '\n';
for (const out of OUTPUTS) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, body);
}
// The server also uses the blocklist to reject offensive display names.
const blockOut = join(ROOT, 'functions/data/blocklist.txt');
mkdirSync(dirname(blockOut), { recursive: true });
writeFileSync(blockOut, [...blocked].sort().join('\n') + '\n');

console.log(`Wrote ${words.length} words (${blocked.size} blocked) to:\n  ${OUTPUTS.join('\n  ')}`);
