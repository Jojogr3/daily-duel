/** Calendar, mode and access rules shared by the app and the server. */

export type Mode = 'word-rush' | 'color-flood';

export const ALL_MODES: readonly Mode[] = ['word-rush', 'color-flood'];
export const FREE_MODE: Mode = 'word-rush';
export const PAID_MODES: readonly Mode[] = ALL_MODES.filter((m) => m !== FREE_MODE);

export const MODE_NAMES: Record<Mode, string> = {
  'word-rush': 'Word Rush',
  'color-flood': 'Color Flood',
};

/** Puzzles roll over at midnight UTC so everyone worldwide shares the same board. */
export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateKey: string, days: number): string {
  const ms = Date.parse(`${dateKey}T00:00:00Z`) + days * 86_400_000;
  return utcDateKey(new Date(ms));
}

export function puzzleId(mode: Mode, dateKey: string): string {
  return `${mode}_${dateKey}`;
}

/** The server combines its secret salt with the date so nobody can pre-compute tomorrow's board. */
export function puzzleSeed(salt: string, mode: Mode, dateKey: string): string {
  return `${salt}|${mode}|${dateKey}`;
}

/** Day of week, 0 = Sunday, in UTC. */
export function utcWeekday(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

/** Free players get one paid mode free each Saturday; the mode rotates week to week. */
export const BONUS_WEEKDAY = 6;

export function bonusModeFor(dateKey: string): Mode | null {
  if (PAID_MODES.length === 0 || utcWeekday(dateKey) !== BONUS_WEEKDAY) return null;
  const week = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / (7 * 86_400_000));
  return PAID_MODES[week % PAID_MODES.length] ?? null;
}

/** Can this player play `mode` ranked today? Share links are handled separately (always allowed). */
export function canPlayMode(mode: Mode, dateKey: string, subscribed: boolean): boolean {
  if (subscribed || mode === FREE_MODE) return true;
  return bonusModeFor(dateKey) === mode;
}
