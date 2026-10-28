import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  applyFlood,
  bonusModeFor,
  buildDictionary,
  canPlayMode,
  compareColorFlood,
  compareWordRush,
  EMPTY_STREAK,
  findAllWords,
  floodRegion,
  generateColorFlood,
  isSolved,
  isValidPath,
  liveStreak,
  milestoneReached,
  nextRating,
  recordPlay,
  replayColorFlood,
  replayWordRush,
  rngFromSeed,
  scoreWord,
  shareText,
  solveColorFlood,
  tierFor,
  wordForPath,
  type WordRushPuzzle,
} from '../src/index';
import { testDict } from './fixtures';

// A hand-made board:  c a t s
//                     r e a t
//                     e s t r
//                     qu i e e
const BOARD: WordRushPuzzle = {
  mode: 'word-rush',
  seed: 'fixed',
  size: 4,
  tiles: ['c', 'a', 't', 's', 'r', 'e', 'a', 't', 'e', 's', 't', 'r', 'qu', 'i', 'e', 'e'],
  durationMs: 60_000,
};

test('rng is deterministic per seed and differs between seeds', () => {
  const a = rngFromSeed('x');
  const b = rngFromSeed('x');
  const c = rngFromSeed('y');
  const sa = [a(), a(), a()];
  assert.deepEqual(sa, [b(), b(), b()]);
  assert.notDeepEqual(sa, [c(), c(), c()]);
  for (const v of sa) assert.ok(v >= 0 && v < 1);
});

test('dictionary filters bad entries', () => {
  const d = buildDictionary('Cat\nab\nhello-world\nzebra\n\nCAT');
  assert.equal(d.size, 2);
  assert.ok(d.has('cat') && d.has('zebra'));
  assert.ok(!d.has('ab'));
});

test('word scoring', () => {
  assert.equal(scoreWord('ab'), 0);
  assert.equal(scoreWord('cat'), 1);
  assert.equal(scoreWord('cats'), 1);
  assert.equal(scoreWord('stare'), 2);
  assert.equal(scoreWord('crates'), 3);
  assert.equal(scoreWord('reacted'), 5);
  assert.equal(scoreWord('creators'), 11);
});

test('path validation', () => {
  assert.ok(isValidPath([0, 1, 2], 4)); // c-a-t across the top
  assert.ok(isValidPath([0, 5, 10], 4)); // diagonal
  assert.ok(!isValidPath([0, 2], 4)); // not adjacent
  assert.ok(!isValidPath([0, 1, 0], 4)); // reuses a tile
  assert.ok(!isValidPath([3, 4], 4)); // wraps around a row edge
  assert.ok(!isValidPath([16], 4)); // out of bounds
  assert.ok(!isValidPath([], 4));
  assert.equal(wordForPath(BOARD.tiles, [12, 13, 10]), 'quit');
});

test('finds words on a fixed board, including the qu tile', () => {
  const words = findAllWords(BOARD.tiles, 4, testDict);
  for (const w of ['cat', 'cats', 'rate', 'eat', 'quit']) assert.ok(words.includes(w), `missing ${w}`);
  // Every found word must really be traceable: replaying it through the dictionary agrees.
  for (const w of words) assert.ok(testDict.has(w));
});

test('replayWordRush scores honest attempts and rejects tampering', () => {
  const ok = replayWordRush(
    BOARD,
    [
      { path: [0, 1, 2], t: 1000 }, // cat
      { path: [0, 1, 2, 3], t: 4000 }, // cats
      { path: [12, 13, 10], t: 9000 }, // quit
    ],
    testDict,
  );
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.result.score, 3);
    assert.deepEqual(ok.result.words, ['cat', 'cats', 'quit']);
    assert.equal(ok.result.longest, 4);
  }
  const dupe = replayWordRush(BOARD, [{ path: [0, 1, 2], t: 1 }, { path: [0, 1, 2], t: 2 }], testDict);
  assert.deepEqual(dupe, { ok: false, reason: 'duplicate-word' });
  const late = replayWordRush(BOARD, [{ path: [0, 1, 2], t: 70_000 }], testDict);
  assert.deepEqual(late, { ok: false, reason: 'bad-time' });
  const fake = replayWordRush(BOARD, [{ path: [0, 1], t: 5 }], testDict);
  assert.deepEqual(fake, { ok: false, reason: 'not-a-word' });
  const jump = replayWordRush(BOARD, [{ path: [0, 2, 3], t: 5 }], testDict);
  assert.deepEqual(jump, { ok: false, reason: 'bad-path' });
});

test('compareWordRush uses score then longest word', () => {
  const a = { mode: 'word-rush' as const, score: 10, words: [], longest: 5 };
  assert.ok(compareWordRush(a, { ...a, score: 9 }) > 0);
  assert.ok(compareWordRush(a, { ...a, longest: 6 }) < 0);
  assert.equal(compareWordRush(a, { ...a }), 0);
});

test('flood mechanics', () => {
  // 3x3:  0 0 1
  //       2 0 1
  //       2 2 1
  const cells = [0, 0, 1, 2, 0, 1, 2, 2, 1];
  assert.deepEqual([...floodRegion(cells, 3)].sort(), [0, 1, 4]);
  const after = applyFlood(cells, 3, 2);
  assert.deepEqual(after, [2, 2, 1, 2, 2, 1, 2, 2, 1]);
  assert.ok(!isSolved(after));
  assert.ok(isSolved(applyFlood(after, 3, 1)));
  assert.deepEqual(solveColorFlood(cells, 3, 3).length, 2);
});

test('color flood generation is deterministic, in range, and its par replays', () => {
  const p1 = generateColorFlood('test-seed');
  const p2 = generateColorFlood('test-seed');
  assert.deepEqual(p1, p2);
  assert.ok(p1.par >= 14 && p1.par <= 20, `par ${p1.par}`);
  const solution = solveColorFlood(p1.cells, p1.size, p1.colors, 600);
  const moves = solution.map((color, i) => ({ color, t: (i + 1) * 1500 }));
  const replay = replayColorFlood(p1, moves);
  assert.ok(replay.ok);
  if (replay.ok) {
    assert.equal(replay.result.taps, p1.par);
    assert.ok(replay.result.parOrBetter);
  }
  assert.deepEqual(replayColorFlood(p1, moves.slice(0, -1)), { ok: false, reason: 'not-solved' });
  assert.deepEqual(replayColorFlood(p1, [{ color: p1.cells[0] as number, t: 1 }]), { ok: false, reason: 'no-op-tap' });
  // Running out of taps is a recorded did-not-finish, not a rejected attempt.
  const start = p1.cells[0] as number;
  const a = (start + 1) % p1.colors;
  const b = (start + 2) % p1.colors;
  const wasted = Array.from({ length: 60 }, (_, i) => ({ color: i % 2 === 0 ? a : b, t: i + 1 }));
  const dnf = replayColorFlood(p1, wasted);
  assert.ok(dnf.ok && dnf.result.taps === 61 && !dnf.result.parOrBetter);
});

test('compareColorFlood uses taps then time', () => {
  const a = { mode: 'color-flood' as const, taps: 18, timeMs: 40_000, parOrBetter: true };
  assert.ok(compareColorFlood(a, { ...a, taps: 19 }) > 0);
  assert.ok(compareColorFlood(a, { ...a, timeMs: 30_000 }) < 0);
});

test('calendar and access rules', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-03-01', -1), '2027-02-28');
  // 2026-10-31 is a Saturday: the bonus mode is the (only) paid mode.
  assert.equal(bonusModeFor('2026-10-31'), 'color-flood');
  assert.equal(bonusModeFor('2026-10-30'), null);
  assert.ok(canPlayMode('word-rush', '2026-10-30', false));
  assert.ok(!canPlayMode('color-flood', '2026-10-30', false));
  assert.ok(canPlayMode('color-flood', '2026-10-31', false));
  assert.ok(canPlayMode('color-flood', '2026-10-30', true));
});

test('rating and tiers', () => {
  const up = nextRating(900, 1100, 1, 0);
  const small = nextRating(900, 700, 1, 0);
  assert.ok(up > small && small > 900);
  assert.ok(nextRating(900, 900, 0, 50) < 900);
  assert.equal(nextRating(900, 900, 0.5, 50), 900);
  assert.equal(tierFor(900).name, 'Bronze');
  assert.equal(tierFor(1250).name, 'Gold');
  assert.equal(tierFor(2000).name, 'Grandmaster');
});

test('streaks, freezes and milestones', () => {
  let s = recordPlay(EMPTY_STREAK, '2026-11-01');
  s = recordPlay(s, '2026-11-02');
  s = recordPlay(s, '2026-11-02'); // same day twice counts once
  assert.equal(s.current, 2);
  const gap = recordPlay(s, '2026-11-04'); // missed one day, no freeze
  assert.equal(gap.current, 1);
  assert.equal(gap.best, 2);
  const frozen = recordPlay({ ...s, freezes: 1 }, '2026-11-04');
  assert.equal(frozen.current, 3);
  assert.equal(frozen.freezes, 0);
  assert.equal(liveStreak(s, '2026-11-03'), 2);
  assert.equal(liveStreak(s, '2026-11-04'), 0);
  assert.equal(milestoneReached({ ...s, current: 6 }, { ...s, current: 7 }), 7);
  assert.equal(milestoneReached({ ...s, current: 7 }, { ...s, current: 8 }), null);
});

test('share text has no spoilers and carries the link', () => {
  const text = shareText({
    mode: 'word-rush',
    dateKey: '2027-01-10',
    outcome: 'win',
    rivalTier: 'Gold',
    scoreLine: '34 pts · 18 words',
    streak: 5,
    linkBase: 'https://dailyduel.app/',
  });
  assert.match(text, /Daily Duel #10 · Word Rush/);
  assert.match(text, /Beat a Gold rival/);
  assert.match(text, /https:\/\/dailyduel\.app\/p\/word-rush\/2027-01-10$/);
});
