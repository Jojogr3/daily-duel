/** Streaks: consecutive UTC days with at least one ranked duel played. */
import { addDays } from './daily';

export interface StreakState {
  current: number;
  best: number;
  /** Last UTC date (YYYY-MM-DD) a ranked duel was played, or null. */
  lastPlayed: string | null;
  /** Freezes in stock; one is spent automatically to cover a single missed day. */
  freezes: number;
}

export const EMPTY_STREAK: StreakState = { current: 0, best: 0, lastPlayed: null, freezes: 0 };

export const STREAK_MILESTONES: readonly number[] = [7, 30, 100, 365];

/** Update the streak for a duel played on `today`. */
export function recordPlay(state: StreakState, today: string): StreakState {
  if (state.lastPlayed === today) return state;
  let current: number;
  let freezes = state.freezes;
  if (state.lastPlayed === addDays(today, -1)) {
    current = state.current + 1;
  } else if (state.lastPlayed === addDays(today, -2) && freezes > 0) {
    freezes -= 1; // one missed day covered by a freeze
    current = state.current + 1;
  } else {
    current = 1;
  }
  return { current, best: Math.max(state.best, current), lastPlayed: today, freezes };
}

/** The streak as it stands on `today` (0 if it has already lapsed). */
export function liveStreak(state: StreakState, today: string): number {
  if (!state.lastPlayed) return 0;
  if (state.lastPlayed === today || state.lastPlayed === addDays(today, -1)) return state.current;
  if (state.lastPlayed === addDays(today, -2) && state.freezes > 0) return state.current;
  return 0;
}

/** A milestone reached exactly by this update, if any. */
export function milestoneReached(before: StreakState, after: StreakState): number | null {
  for (const m of STREAK_MILESTONES) if (before.current < m && after.current >= m) return m;
  return null;
}
