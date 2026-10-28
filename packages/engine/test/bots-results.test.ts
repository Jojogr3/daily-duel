import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDictionary,
  generateColorFlood,
  generateWordRush,
  newBotRival,
  outcomeOf,
  rankKey,
  scoreLine,
  simulateColorFloodBot,
  simulateWordRushBot,
} from '../src/index';

test('bots are labelled, near the player, and deterministic', () => {
  const r = newBotRival('s1', 1200);
  assert.ok(r.isBot);
  assert.match(r.name, /Bot$/);
  assert.ok(Math.abs(r.rating - 1200) <= 100);
  assert.deepEqual(newBotRival('s1', 1200), r);
});

test('stronger bots score better on average', () => {
  const words = Array.from({ length: 120 }, (_, i) => 'abcdefgh'.slice(0, 3 + (i % 6)) + i);
  let weak = 0;
  let strong = 0;
  for (let k = 0; k < 30; k++) {
    weak += simulateWordRushBot(`w${k}`, 700, words).score;
    strong += simulateWordRushBot(`w${k}`, 1700, words).score;
  }
  assert.ok(strong > weak * 1.5, `strong ${strong} weak ${weak}`);
  const flood = simulateColorFloodBot('f', 1800, 16);
  assert.ok(flood.taps >= 16);
  assert.ok(simulateColorFloodBot('f', 700, 16).taps > flood.taps);
});

test('outcomes, rank keys and score lines', () => {
  const a = { mode: 'color-flood' as const, taps: 17, timeMs: 30_000, parOrBetter: false };
  const b = { ...a, taps: 18 };
  assert.equal(outcomeOf(a, b), 'win');
  assert.equal(outcomeOf(b, a), 'loss');
  assert.equal(outcomeOf(a, { ...a }), 'draw');
  assert.ok(rankKey(a) > rankKey(b));
  assert.equal(scoreLine(a, 16), '17 taps (par 16) · 30s');
  const w = { mode: 'word-rush' as const, score: 12, words: ['cat'], longest: 3 };
  assert.equal(scoreLine(w), '12 pts · 1 word');
  assert.ok(rankKey({ ...w, score: 13 }) > rankKey(w));
});

// Runs once the real word list is downloaded (npm run words). Skipped otherwise.
const WORDS = join(import.meta.dirname, '..', 'data', 'words.txt');
test('real dictionary: boards meet the quality bar and generate quickly', { skip: !existsSync(WORDS) }, () => {
  const t0 = Date.now();
  const dict = buildDictionary(readFileSync(WORDS, 'utf8'));
  const buildMs = Date.now() - t0;
  assert.ok(dict.size > 100_000, `dictionary size ${dict.size}`);
  assert.ok(dict.has('puzzle') && !dict.has('qzxv'));
  const t1 = Date.now();
  for (let d = 0; d < 30; d++) {
    const { puzzle, solution } = generateWordRush(`salt|word-rush|day${d}`, dict);
    assert.equal(puzzle.tiles.length, 16);
    assert.ok(solution.words.length >= 45);
    assert.ok(solution.longestWord.length >= 6);
  }
  const genMs = (Date.now() - t1) / 30;
  assert.ok(buildMs < 5_000 && genMs < 2_000, `build ${buildMs}ms, ${genMs}ms per board`);
  // Color Flood needs no dictionary, but check it alongside for a timing baseline.
  generateColorFlood('timing');
});
