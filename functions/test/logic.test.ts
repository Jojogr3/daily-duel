import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateColorFlood, solveColorFlood, type ColorFloodResult } from '@daily-duel/engine';
import {
  applyMonthlyPerks,
  cleanName,
  clientSafe,
  DuelError,
  newUser,
  normaliseUser,
  resolveDuel,
  type DuelDoc,
} from '../src/logic';

const NOW = Date.parse('2027-01-10T12:00:00Z');
const puzzle = generateColorFlood('server-test');
const solution = solveColorFlood(puzzle.cells, puzzle.size, puzzle.colors, 600);
const honestMoves = solution.map((color, i) => ({ color, t: (i + 1) * 2000 }));

function duel(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    uid: 'u1',
    mode: 'color-flood',
    dateKey: '2027-01-10',
    rival: { name: 'Gold Bot', tier: 'Gold', rating: 1250, isBot: true },
    rivalAttemptId: null,
    startedAt: NOW - 120_000,
    summary: null,
    ...overrides,
  };
}

const weakRival: ColorFloodResult = { mode: 'color-flood', taps: puzzle.par + 6, timeMs: 90_000, parOrBetter: false };

test('an honest solve beats a weaker rival and updates rating, streak and stats', () => {
  const out = resolveDuel({ user: newUser(NOW), duel: duel(), puzzle, dict: null, moves: honestMoves, rivalResult: weakRival, now: NOW });
  assert.equal(out.summary.outcome, 'win');
  assert.ok(out.summary.ratingAfter > out.summary.ratingBefore);
  assert.equal(out.user.duels['color-flood'], 1);
  assert.equal(out.user.wins['color-flood'], 1);
  assert.equal(out.user.streak.current, 1);
  assert.equal(out.summary.par, puzzle.par);
  assert.equal(out.attempt.rating, out.summary.ratingBefore);
  assert.equal(out.attempt.ratingBucket, Math.floor(out.summary.ratingBefore / 100));
});

test('rejects replays, unstarted duels and impossible clocks', () => {
  const base = { user: newUser(NOW), puzzle, dict: null, rivalResult: weakRival, now: NOW };
  assert.throws(() => resolveDuel({ ...base, duel: duel({ startedAt: null }), moves: honestMoves }), DuelError);
  const done = resolveDuel({ ...base, duel: duel(), moves: honestMoves }).summary;
  assert.throws(() => resolveDuel({ ...base, duel: duel({ summary: done }), moves: honestMoves }), /already finished/);
  assert.throws(() => resolveDuel({ ...base, duel: duel(), moves: honestMoves.slice(0, 2) }), /not-solved/);
  // Started 10 seconds ago but claims the last tap came much later.
  assert.throws(() => resolveDuel({ ...base, duel: duel({ startedAt: NOW - 10_000 }), moves: honestMoves }), /clock mismatch/);
  assert.throws(() => resolveDuel({ ...base, duel: duel(), moves: 'nope' }), DuelError);
});

test('Daily Duel+ grants two streak freezes once per month, capped', () => {
  const plus = { ...newUser(NOW), plusExpiresAt: NOW + 365 * 86_400_000 };
  const once = applyMonthlyPerks(plus, NOW);
  assert.equal(once.streak.freezes, 2);
  assert.equal(applyMonthlyPerks(once, NOW), once); // same month: unchanged object
  const nextMonth = applyMonthlyPerks(once, NOW + 31 * 86_400_000);
  assert.equal(nextMonth.streak.freezes, 4);
  const capped = applyMonthlyPerks(nextMonth, NOW + 62 * 86_400_000);
  assert.equal(capped.streak.freezes, 4);
  const free = newUser(NOW);
  assert.equal(applyMonthlyPerks(free, NOW), free);
});

test('old user docs get new fields filled in', () => {
  const u = normaliseUser({ name: 'Jo', ratings: { 'word-rush': 1300 } as never }, NOW);
  assert.equal(u.name, 'Jo');
  assert.equal(u.ratings['word-rush'], 1300);
  assert.equal(u.ratings['color-flood'], 900);
  assert.equal(u.streak.current, 0);
});

test('puzzles reach clients without the secret seed', () => {
  assert.equal(clientSafe({ ...puzzle, seed: 'SECRET|color-flood|2027-01-10' }).seed, '');
});

test('display names are trimmed and filtered', () => {
  const block = new Set(['badword', 'xyz']);
  assert.equal(cleanName('  Jo   Gr  ', block), 'Jo Gr');
  assert.equal(cleanName('', block), null);
  assert.equal(cleanName(42, block), null);
  assert.equal(cleanName('B.a.d-Word99', block), null);
  assert.equal(cleanName('xyz', block), null);
  assert.equal(cleanName('xyzzy', block), 'xyzzy'); // short entries only match whole names
  assert.equal(cleanName('a'.repeat(40), block)?.length, 20);
});
