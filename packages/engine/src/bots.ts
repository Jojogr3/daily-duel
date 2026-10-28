/**
 * Bot rivals fill in when there aren't enough real attempts near a player's
 * rating (mainly at launch). Bots are always labelled as bots in the app.
 * Their results are simulated from the puzzle's solution, scaled by rating.
 */
import type { ColorFloodResult } from './colorflood/colorflood';
import { tierFor } from './rating';
import { rngFromSeed, type Rng } from './rng';
import { scoreWord, type WordRushResult } from './wordrush/wordrush';

export interface RivalInfo {
  name: string;
  tier: string;
  rating: number;
  isBot: boolean;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** A bot rating near the player's, so duels are close. */
export function botRating(rng: Rng, playerRating: number): number {
  return Math.max(500, Math.round(playerRating + (rng() - 0.5) * 200));
}

export function botInfo(rating: number): RivalInfo {
  const tier = tierFor(rating).name;
  return { name: `${tier} Bot`, tier, rating, isBot: true };
}

/** How often a bot of this rating spots a word of this length. */
function findChance(rating: number, length: number): number {
  const base = clamp(0.06 + (rating - 600) / 3000, 0.04, 0.5);
  const byLength = length <= 4 ? 1.3 : length === 5 ? 1 : length === 6 ? 0.6 : 0.35;
  return clamp(base * byLength, 0, 0.95);
}

export function simulateWordRushBot(seed: string, rating: number, solutionWords: readonly string[]): WordRushResult {
  const rng = rngFromSeed(`bot|word-rush|${seed}|${rating}`);
  const words: string[] = [];
  let score = 0;
  let longest = 0;
  for (const w of solutionWords) {
    if (rng() < findChance(rating, w.length)) {
      words.push(w);
      score += scoreWord(w);
      longest = Math.max(longest, w.length);
    }
  }
  return { mode: 'word-rush', score, words, longest };
}

export function simulateColorFloodBot(seed: string, rating: number, par: number): ColorFloodResult {
  const rng = rngFromSeed(`bot|color-flood|${seed}|${rating}`);
  const extra = Math.max(0, Math.round((1700 - rating) / 180 + rng() * 2.5 - 0.5));
  const taps = par + extra;
  const timeMs = Math.round(20_000 + extra * 1_500 + rng() * 30_000);
  return { mode: 'color-flood', taps, timeMs, parOrBetter: taps <= par };
}

export function newBotRival(seed: string, playerRating: number): RivalInfo {
  return botInfo(botRating(rngFromSeed(`bot-rating|${seed}`), playerRating));
}
