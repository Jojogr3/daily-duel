/** Mode-agnostic helpers so the app and server don't need a switch per mode everywhere. */
import { compareColorFlood, type ColorFloodMove, type ColorFloodPuzzle, type ColorFloodResult, replayColorFlood } from './colorflood/colorflood';
import type { Mode } from './daily';
import type { Dictionary } from './wordrush/trie';
import { compareWordRush, replayWordRush, type WordRushMove, type WordRushPuzzle, type WordRushResult } from './wordrush/wordrush';

export type AnyPuzzle = WordRushPuzzle | ColorFloodPuzzle;
export type AnyResult = WordRushResult | ColorFloodResult;
export type AnyMoves = WordRushMove[] | ColorFloodMove[];

export type Outcome = 'win' | 'loss' | 'draw';

/** Positive when a beats b. Both results must be the same mode. */
export function compareResults(a: AnyResult, b: AnyResult): number {
  if (a.mode === 'word-rush' && b.mode === 'word-rush') return compareWordRush(a, b);
  if (a.mode === 'color-flood' && b.mode === 'color-flood') return compareColorFlood(a, b);
  throw new Error('compareResults: mode mismatch');
}

export function outcomeOf(you: AnyResult, rival: AnyResult): Outcome {
  const c = compareResults(you, rival);
  return c > 0 ? 'win' : c < 0 ? 'loss' : 'draw';
}

export type ReplayAny = { ok: true; result: AnyResult } | { ok: false; reason: string };

export function replayAny(puzzle: AnyPuzzle, moves: unknown, dict: Dictionary | null): ReplayAny {
  if (!Array.isArray(moves)) return { ok: false, reason: 'bad-moves' };
  if (puzzle.mode === 'word-rush') {
    if (!dict) throw new Error('replayAny: Word Rush needs a dictionary');
    return replayWordRush(puzzle, moves as WordRushMove[], dict);
  }
  return replayColorFlood(puzzle, moves as ColorFloodMove[]);
}

/** One line for result screens, leaderboards and share cards. */
export function scoreLine(result: AnyResult, par?: number): string {
  if (result.mode === 'word-rush') {
    const n = result.words.length;
    return `${result.score} pts · ${n} word${n === 1 ? '' : 's'}`;
  }
  const secs = Math.round(result.timeMs / 1000);
  return par !== undefined ? `${result.taps} taps (par ${par}) · ${secs}s` : `${result.taps} taps · ${secs}s`;
}

/** Bigger is better; used to sort leaderboards in one query. */
export function rankKey(result: AnyResult): number {
  if (result.mode === 'word-rush') return result.score * 100 + result.longest;
  // Fewer taps first, then faster. Time capped at 10 minutes.
  return -(result.taps * 1_000_000 + Math.min(result.timeMs, 999_999));
}

export function isMode(x: unknown): x is Mode {
  return x === 'word-rush' || x === 'color-flood';
}
