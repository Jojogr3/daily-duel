/** Loads the word list and name blocklist once per server instance. */
import { buildDictionary, type Dictionary } from '@daily-duel/engine';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The bundle lives in lib/, the data in data/ next to it.
const DATA_DIR = join(__dirname, '..', 'data');

let dict: Dictionary | null = null;
let blocked: Set<string> | null = null;

export function dictionary(): Dictionary {
  if (!dict) dict = buildDictionary(readFileSync(join(DATA_DIR, 'words.txt'), 'utf8'));
  return dict;
}

export function blocklist(): ReadonlySet<string> {
  if (!blocked) {
    const path = join(DATA_DIR, 'blocklist.txt');
    blocked = new Set(
      existsSync(path)
        ? readFileSync(path, 'utf8')
            .split(/\r?\n/)
            .map((w) => w.trim().toLowerCase())
            .filter(Boolean)
        : [],
    );
  }
  return blocked;
}
