/**
 * Word Rush: find words of 3+ letters in a 4x4 letter grid by tracing
 * adjacent tiles (diagonals allowed, each tile used once per word). 60 seconds.
 */
import { isAdjacent8, neighbors8 } from '../grid';
import { pickWeighted, rngFromSeed, type Rng } from '../rng';
import { MIN_WORD_LENGTH, type Dictionary } from './trie';

export const WORD_RUSH_SIZE = 4;
export const WORD_RUSH_DURATION_MS = 60_000;
/** Allowance for network/clock jitter when the server checks move timestamps. */
export const WORD_RUSH_GRACE_MS = 2_000;

/** Tile faces and how often they appear. "qu" is one tile, as players expect. */
const TILE_WEIGHTS: ReadonlyArray<readonly [string, number]> = [
  ['e', 12], ['a', 9], ['i', 8], ['o', 8], ['n', 6.5], ['r', 6.5], ['t', 6.5],
  ['s', 5.5], ['l', 4.5], ['u', 3.5], ['d', 4], ['c', 3], ['m', 3], ['p', 3],
  ['h', 3], ['g', 3], ['b', 2], ['f', 2], ['y', 2], ['w', 2], ['k', 1.2],
  ['v', 1.1], ['x', 0.5], ['j', 0.4], ['z', 0.5], ['qu', 0.5],
];
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

export interface WordRushPuzzle {
  mode: 'word-rush';
  /** The seed this board came from; regenerating from it gives the same board. */
  seed: string;
  size: number;
  /** Tile faces, row by row. Lower case; "qu" is a single tile. */
  tiles: string[];
  durationMs: number;
}

/** Facts about a board that only the server needs (never sent before play). */
export interface WordRushSolution {
  words: string[];
  maxScore: number;
  longestWord: string;
}

export interface WordRushQuality {
  minWords: number;
  minLongest: number;
}

export const DEFAULT_WORD_RUSH_QUALITY: WordRushQuality = { minWords: 45, minLongest: 6 };

function rollTiles(rng: Rng, size: number): string[] {
  // Re-roll until the vowel count is playable (roughly a quarter to two fifths of tiles).
  const n = size * size;
  const minV = Math.round(n * 0.25);
  const maxV = Math.round(n * 0.45);
  for (;;) {
    const tiles: string[] = [];
    let vowels = 0;
    let rare = 0;
    for (let i = 0; i < n; i++) {
      const t = pickWeighted(rng, TILE_WEIGHTS);
      if (VOWELS.has(t)) vowels++;
      if (t === 'qu' || t === 'x' || t === 'j' || t === 'z') rare++;
      tiles.push(t);
    }
    if (vowels >= minV && vowels <= maxV && rare <= 1) return tiles;
  }
}

/** Points per word by letter count. */
export function scoreWord(word: string): number {
  const n = word.length;
  if (n < MIN_WORD_LENGTH) return 0;
  if (n <= 4) return 1;
  if (n === 5) return 2;
  if (n === 6) return 3;
  if (n === 7) return 5;
  return 11;
}

/** Every dictionary word that can be traced on the board. */
export function findAllWords(tiles: readonly string[], size: number, dict: Dictionary): string[] {
  const found = new Set<string>();
  const used = new Array<boolean>(tiles.length).fill(false);

  const dfs = (index: number, node: number, prefix: string): void => {
    const face = tiles[index];
    if (face === undefined) return;
    const next = dict.child(node, face);
    if (next < 0) return;
    const word = prefix + face;
    if (dict.isWord(next) && word.length >= MIN_WORD_LENGTH) found.add(word);
    used[index] = true;
    for (const nb of neighbors8(index, size)) {
      if (!used[nb]) dfs(nb, next, word);
    }
    used[index] = false;
  };

  for (let i = 0; i < tiles.length; i++) dfs(i, dict.root, '');
  return [...found].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

export function solveWordRush(puzzle: WordRushPuzzle, dict: Dictionary): WordRushSolution {
  const words = findAllWords(puzzle.tiles, puzzle.size, dict);
  let maxScore = 0;
  for (const w of words) maxScore += scoreWord(w);
  return { words, maxScore, longestWord: words[0] ?? '' };
}

/**
 * Generate a board from a seed. Boards that fail the quality bar are re-rolled
 * from the same seed stream, so the result is still fully deterministic.
 */
export function generateWordRush(
  seed: string,
  dict: Dictionary,
  quality: WordRushQuality = DEFAULT_WORD_RUSH_QUALITY,
): { puzzle: WordRushPuzzle; solution: WordRushSolution } {
  const rng = rngFromSeed(`word-rush|${seed}`);
  for (let attempt = 0; attempt < 500; attempt++) {
    const puzzle: WordRushPuzzle = {
      mode: 'word-rush',
      seed,
      size: WORD_RUSH_SIZE,
      tiles: rollTiles(rng, WORD_RUSH_SIZE),
      durationMs: WORD_RUSH_DURATION_MS,
    };
    const solution = solveWordRush(puzzle, dict);
    if (solution.words.length >= quality.minWords && solution.longestWord.length >= quality.minLongest) {
      return { puzzle, solution };
    }
  }
  throw new Error(`generateWordRush: no board met the quality bar for seed "${seed}"`);
}

/** True when the path is in bounds, uses each tile once and steps between touching tiles. */
export function isValidPath(path: readonly number[], size: number): boolean {
  if (path.length === 0) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (p === undefined || !Number.isInteger(p) || p < 0 || p >= size * size) return false;
    if (seen.has(p)) return false;
    seen.add(p);
    const prev = path[i - 1];
    if (i > 0 && prev !== undefined && !isAdjacent8(prev, p, size)) return false;
  }
  return true;
}

export function wordForPath(tiles: readonly string[], path: readonly number[]): string {
  let w = '';
  for (const p of path) w += tiles[p] ?? '';
  return w;
}

/** One accepted word, as the client records it. `t` = ms since the round started. */
export interface WordRushMove {
  path: number[];
  t: number;
}

export interface WordRushResult {
  mode: 'word-rush';
  score: number;
  words: string[];
  longest: number;
}

export type ReplayOutcome<R> = { ok: true; result: R } | { ok: false; reason: string };

/**
 * Recompute an attempt from its moves. The server trusts nothing else the client sends.
 * Any invalid move rejects the whole attempt: an honest client only submits accepted words.
 */
export function replayWordRush(
  puzzle: WordRushPuzzle,
  moves: readonly WordRushMove[],
  dict: Dictionary,
): ReplayOutcome<WordRushResult> {
  if (moves.length > 400) return { ok: false, reason: 'too-many-moves' };
  const words: string[] = [];
  const seen = new Set<string>();
  let lastT = 0;
  let score = 0;
  let longest = 0;
  for (const move of moves) {
    if (!move || !Array.isArray(move.path) || typeof move.t !== 'number') {
      return { ok: false, reason: 'bad-move' };
    }
    if (move.t < lastT || move.t > puzzle.durationMs + WORD_RUSH_GRACE_MS) {
      return { ok: false, reason: 'bad-time' };
    }
    lastT = move.t;
    if (!isValidPath(move.path, puzzle.size)) return { ok: false, reason: 'bad-path' };
    const word = wordForPath(puzzle.tiles, move.path);
    if (word.length < MIN_WORD_LENGTH || !dict.has(word)) return { ok: false, reason: 'not-a-word' };
    if (seen.has(word)) return { ok: false, reason: 'duplicate-word' };
    seen.add(word);
    words.push(word);
    score += scoreWord(word);
    longest = Math.max(longest, word.length);
  }
  return { ok: true, result: { mode: 'word-rush', score, words, longest } };
}

/** Positive when a beats b, negative when b beats a, 0 for a draw. */
export function compareWordRush(a: WordRushResult, b: WordRushResult): number {
  if (a.score !== b.score) return a.score - b.score;
  return a.longest - b.longest;
}
