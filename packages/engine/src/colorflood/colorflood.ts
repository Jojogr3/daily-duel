/**
 * Color Flood: the region connected to the top-left cell takes whichever colour
 * the player taps, swallowing touching cells of that colour. Fill the whole board
 * in as few taps as possible. Each board ships with a "par" found by a beam search.
 */
import { neighbors4 } from '../grid';
import { randInt, rngFromSeed } from '../rng';

export const COLOR_FLOOD_SIZE = 10;
export const COLOR_FLOOD_COLORS = 6;
/** A hard cap so attempts stay small; far above any sensible solve. */
export const COLOR_FLOOD_MAX_TAPS = 60;
export const COLOR_FLOOD_MAX_TIME_MS = 10 * 60_000;
/** Tap count recorded for an attempt that ran out of taps without finishing. */
export const COLOR_FLOOD_DNF_TAPS = COLOR_FLOOD_MAX_TAPS + 1;

export interface ColorFloodPuzzle {
  mode: 'color-flood';
  seed: string;
  size: number;
  colors: number;
  /** Colour index per cell, row by row. */
  cells: number[];
  /** Best tap count our solver found. Players can match it, and occasionally beat it. */
  par: number;
}

/** Cells in the flood region (connected to cell 0 and sharing its colour). */
export function floodRegion(cells: readonly number[], size: number): Set<number> {
  const color = cells[0];
  const region = new Set<number>([0]);
  const stack = [0];
  while (stack.length > 0) {
    const i = stack.pop() as number;
    for (const nb of neighbors4(i, size)) {
      if (!region.has(nb) && cells[nb] === color) {
        region.add(nb);
        stack.push(nb);
      }
    }
  }
  return region;
}

/** Apply one tap: recolour the flood region. Returns a new array. */
export function applyFlood(cells: readonly number[], size: number, color: number): number[] {
  const next = cells.slice();
  for (const i of floodRegion(cells, size)) next[i] = color;
  return next;
}

export function isSolved(cells: readonly number[]): boolean {
  const first = cells[0];
  for (const c of cells) if (c !== first) return false;
  return true;
}

function distinctOutside(cells: readonly number[], region: Set<number>): number {
  const seen = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    if (!region.has(i)) seen.add(cells[i] as number);
  }
  return seen.size;
}

/**
 * Beam search for a short solution. Not guaranteed optimal (the exact problem is
 * NP-hard) but close on boards this size. Returns the colour sequence.
 */
export function solveColorFlood(
  cells: readonly number[],
  size: number,
  colors: number,
  beamWidth = 120,
): number[] {
  interface Node {
    cells: number[];
    path: number[];
    regionSize: number;
    remaining: number;
  }
  const startRegion = floodRegion(cells, size);
  let beam: Node[] = [
    {
      cells: cells.slice(),
      path: [],
      regionSize: startRegion.size,
      remaining: distinctOutside(cells, startRegion),
    },
  ];
  if (isSolved(cells)) return [];

  for (let depth = 0; depth < COLOR_FLOOD_MAX_TAPS; depth++) {
    const nextBeam: Node[] = [];
    const seen = new Set<string>();
    for (const node of beam) {
      const current = node.cells[0];
      for (let c = 0; c < colors; c++) {
        if (c === current) continue;
        const next = applyFlood(node.cells, size, c);
        const region = floodRegion(next, size);
        if (region.size === node.regionSize) continue; // tap gained nothing
        const path = [...node.path, c];
        if (region.size === next.length) return path;
        const key = next.join('');
        if (seen.has(key)) continue;
        seen.add(key);
        nextBeam.push({ cells: next, path, regionSize: region.size, remaining: distinctOutside(next, region) });
      }
    }
    // Fewest colours left outside is the main lower bound; bigger region breaks ties.
    nextBeam.sort((a, b) => a.remaining - b.remaining || b.regionSize - a.regionSize);
    beam = nextBeam.slice(0, beamWidth);
    if (beam.length === 0) break;
  }
  throw new Error('solveColorFlood: no solution within the tap cap');
}

/** Beam width used when publishing a board's par: wider finds shorter solutions. */
export const PAR_BEAM_WIDTH = 600;

export interface ColorFloodQuality {
  minPar: number;
  maxPar: number;
}

export const DEFAULT_COLOR_FLOOD_QUALITY: ColorFloodQuality = { minPar: 14, maxPar: 20 };

export function generateColorFlood(
  seed: string,
  quality: ColorFloodQuality = DEFAULT_COLOR_FLOOD_QUALITY,
): ColorFloodPuzzle {
  const rng = rngFromSeed(`color-flood|${seed}`);
  const size = COLOR_FLOOD_SIZE;
  const colors = COLOR_FLOOD_COLORS;
  for (let attempt = 0; attempt < 200; attempt++) {
    const cells: number[] = [];
    for (let i = 0; i < size * size; i++) cells.push(randInt(rng, colors));
    const par = solveColorFlood(cells, size, colors, PAR_BEAM_WIDTH).length;
    if (par >= quality.minPar && par <= quality.maxPar) {
      return { mode: 'color-flood', seed, size, colors, cells, par };
    }
  }
  throw new Error(`generateColorFlood: no board met the quality bar for seed "${seed}"`);
}

/** One tap. `t` = ms since the round started. */
export interface ColorFloodMove {
  color: number;
  t: number;
}

export interface ColorFloodResult {
  mode: 'color-flood';
  taps: number;
  timeMs: number;
  /** Tap count at or under par. */
  parOrBetter: boolean;
}

export type FloodReplayOutcome = { ok: true; result: ColorFloodResult } | { ok: false; reason: string };

export function replayColorFlood(puzzle: ColorFloodPuzzle, moves: readonly ColorFloodMove[]): FloodReplayOutcome {
  if (moves.length === 0 || moves.length > COLOR_FLOOD_MAX_TAPS) return { ok: false, reason: 'bad-move-count' };
  let cells = puzzle.cells.slice();
  let lastT = 0;
  for (const move of moves) {
    if (!move || !Number.isInteger(move.color) || typeof move.t !== 'number') return { ok: false, reason: 'bad-move' };
    if (move.color < 0 || move.color >= puzzle.colors) return { ok: false, reason: 'bad-color' };
    if (move.color === cells[0]) return { ok: false, reason: 'no-op-tap' };
    if (move.t < lastT || move.t > COLOR_FLOOD_MAX_TIME_MS) return { ok: false, reason: 'bad-time' };
    lastT = move.t;
    if (isSolved(cells)) return { ok: false, reason: 'moves-after-solve' };
    cells = applyFlood(cells, puzzle.size, move.color);
  }
  if (!isSolved(cells)) {
    // Used every tap without finishing: a "did not finish", which loses to any solve.
    if (moves.length === COLOR_FLOOD_MAX_TAPS) {
      return { ok: true, result: { mode: 'color-flood', taps: COLOR_FLOOD_DNF_TAPS, timeMs: lastT, parOrBetter: false } };
    }
    return { ok: false, reason: 'not-solved' };
  }
  return {
    ok: true,
    result: { mode: 'color-flood', taps: moves.length, timeMs: lastT, parOrBetter: moves.length <= puzzle.par },
  };
}

/** Positive when a beats b. Fewer taps wins; time breaks ties. */
export function compareColorFlood(a: ColorFloodResult, b: ColorFloodResult): number {
  if (a.taps !== b.taps) return b.taps - a.taps;
  return b.timeMs - a.timeMs;
}
