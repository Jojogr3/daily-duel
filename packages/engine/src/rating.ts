/**
 * Duel rating. Elo-style: beating a stronger rival gains more. Only the live
 * player's rating moves; the rival is a recorded attempt and isn't penalised
 * for a game they weren't present for.
 */

export const START_RATING = 900;

export interface Tier {
  name: string;
  min: number;
}

export const TIERS: readonly Tier[] = [
  { name: 'Grandmaster', min: 1800 },
  { name: 'Diamond', min: 1600 },
  { name: 'Platinum', min: 1400 },
  { name: 'Gold', min: 1200 },
  { name: 'Silver', min: 1000 },
  { name: 'Bronze', min: 0 },
];

export function tierFor(rating: number): Tier {
  for (const t of TIERS) if (rating >= t.min) return t;
  return TIERS[TIERS.length - 1] as Tier;
}

/** Outcome from the player's side: 1 win, 0.5 draw, 0 loss. */
export type DuelOutcome = 0 | 0.5 | 1;

export function outcomeFromCompare(cmp: number): DuelOutcome {
  if (cmp > 0) return 1;
  if (cmp < 0) return 0;
  return 0.5;
}

export function expectedScore(player: number, rival: number): number {
  return 1 / (1 + 10 ** ((rival - player) / 400));
}

/** New players move faster so they reach their level quickly. */
export function kFactor(duelsPlayed: number): number {
  return duelsPlayed < 20 ? 40 : 24;
}

export function nextRating(player: number, rival: number, outcome: DuelOutcome, duelsPlayed: number): number {
  const delta = kFactor(duelsPlayed) * (outcome - expectedScore(player, rival));
  return Math.max(0, Math.round(player + delta));
}
