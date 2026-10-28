/**
 * Pure game-server logic, kept free of Firestore so it can be unit tested.
 * index.ts reads/writes documents and calls these functions.
 */
import {
  ALL_MODES,
  compareResults,
  EMPTY_STREAK,
  liveStreak,
  milestoneReached,
  nextRating,
  outcomeFromCompare,
  rankKey,
  recordPlay,
  replayAny,
  START_RATING,
  tierFor,
  type AnyMoves,
  type AnyPuzzle,
  type AnyResult,
  type Dictionary,
  type Mode,
  type Outcome,
  type RivalInfo,
  type StreakState,
} from '@daily-duel/engine';

export interface UserDoc {
  name: string;
  ratings: Record<Mode, number>;
  duels: Record<Mode, number>;
  wins: Record<Mode, number>;
  streak: StreakState;
  /** ms since epoch; subscribed while in the future. */
  plusExpiresAt: number;
  /** "YYYY-MM" of the last monthly streak-freeze grant. */
  freezesMonth: string;
  createdAt: number;
}

export interface DuelDoc {
  uid: string;
  mode: Mode;
  dateKey: string;
  rival: RivalInfo;
  /** Id of the real attempt being duelled, when the rival is a player. */
  rivalAttemptId: string | null;
  startedAt: number | null;
  summary: DuelSummary | null;
}

export interface DuelSummary {
  mode: Mode;
  dateKey: string;
  you: AnyResult;
  rival: AnyResult;
  rivalInfo: RivalInfo;
  outcome: Outcome;
  ratingBefore: number;
  ratingAfter: number;
  streak: StreakState;
  milestone: number | null;
  rank: number | null;
  par?: number;
}

export interface AttemptDoc {
  uid: string;
  mode: Mode;
  dateKey: string;
  name: string;
  tier: string;
  rating: number;
  ratingBucket: number;
  result: AnyResult;
  rankKey: number;
  /** Random number for picking a random rival with an indexed query. */
  rand: number;
  createdAt: number;
}

export const PLUS_MONTHLY_FREEZES = 2;
export const MAX_FREEZES = 4;
/** Moves may claim at most this much more time than really passed on the server. */
export const CLOCK_TOLERANCE_MS = 5_000;

function perMode<T>(value: T): Record<Mode, T> {
  return Object.fromEntries(ALL_MODES.map((m) => [m, value])) as Record<Mode, T>;
}

export function newUser(now: number): UserDoc {
  return {
    name: 'Player',
    ratings: perMode(START_RATING),
    duels: perMode(0),
    wins: perMode(0),
    streak: EMPTY_STREAK,
    plusExpiresAt: 0,
    freezesMonth: '',
    createdAt: now,
  };
}

/** Fills in fields added after a user was created (e.g. a new mode's rating). */
export function normaliseUser(raw: Partial<UserDoc> | undefined, now: number): UserDoc {
  const base = newUser(now);
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    ratings: { ...base.ratings, ...raw.ratings },
    duels: { ...base.duels, ...raw.duels },
    wins: { ...base.wins, ...raw.wins },
    streak: { ...base.streak, ...raw.streak },
  };
}

export function isPlus(user: UserDoc, now: number): boolean {
  return user.plusExpiresAt > now;
}

/** Daily Duel+ includes streak freezes each month. Returns the user with any due grant applied. */
export function applyMonthlyPerks(user: UserDoc, now: number): UserDoc {
  const month = new Date(now).toISOString().slice(0, 7);
  if (!isPlus(user, now) || user.freezesMonth === month) return user;
  return {
    ...user,
    freezesMonth: month,
    streak: { ...user.streak, freezes: Math.min(MAX_FREEZES, user.streak.freezes + PLUS_MONTHLY_FREEZES) },
  };
}

export function ratingBucket(rating: number): number {
  return Math.floor(rating / 100);
}

/** Puzzles go to clients without their seed (it contains the secret salt). */
export function clientSafe(puzzle: AnyPuzzle): AnyPuzzle {
  return { ...puzzle, seed: '' };
}

export class DuelError extends Error {
  constructor(
    readonly code: 'failed-precondition' | 'invalid-argument' | 'not-found',
    message: string,
  ) {
    super(message);
  }
}

export interface ResolveInput {
  user: UserDoc;
  duel: DuelDoc;
  puzzle: AnyPuzzle;
  dict: Dictionary | null;
  moves: unknown;
  /** The rival's result: a real attempt's, or a simulated bot's. */
  rivalResult: AnyResult;
  now: number;
}

export interface ResolveOutput {
  summary: DuelSummary;
  user: UserDoc;
  attempt: AttemptDoc;
}

/** Score an attempt, settle the duel and work out every document change. */
export function resolveDuel(input: ResolveInput): ResolveOutput {
  const { duel, puzzle, now } = input;
  const user = applyMonthlyPerks(input.user, now);
  if (duel.summary) throw new DuelError('failed-precondition', 'This duel is already finished.');
  if (duel.startedAt === null) throw new DuelError('failed-precondition', 'This duel was never started.');

  const replay = replayAny(puzzle, input.moves, input.dict);
  if (!replay.ok) throw new DuelError('invalid-argument', `Attempt rejected: ${replay.reason}.`);
  const moves = input.moves as AnyMoves;
  const last = moves[moves.length - 1];
  const claimed = last ? last.t : 0;
  if (claimed > now - duel.startedAt + CLOCK_TOLERANCE_MS) {
    throw new DuelError('invalid-argument', 'Attempt rejected: clock mismatch.');
  }

  const you = replay.result;
  const mode = duel.mode;
  const cmp = compareResults(you, input.rivalResult);
  const ratingBefore = user.ratings[mode];
  const ratingAfter = nextRating(ratingBefore, duel.rival.rating, outcomeFromCompare(cmp), user.duels[mode]);
  const streak = recordPlay(user.streak, duel.dateKey);

  const summary: DuelSummary = {
    mode,
    dateKey: duel.dateKey,
    you,
    rival: input.rivalResult,
    rivalInfo: duel.rival,
    outcome: cmp > 0 ? 'win' : cmp < 0 ? 'loss' : 'draw',
    ratingBefore,
    ratingAfter,
    streak,
    milestone: milestoneReached(user.streak, streak),
    rank: null,
    ...(puzzle.mode === 'color-flood' ? { par: puzzle.par } : {}),
  };

  const nextUser: UserDoc = {
    ...user,
    ratings: { ...user.ratings, [mode]: ratingAfter },
    duels: { ...user.duels, [mode]: user.duels[mode] + 1 },
    wins: { ...user.wins, [mode]: user.wins[mode] + (cmp > 0 ? 1 : 0) },
    streak,
  };

  const attempt: AttemptDoc = {
    uid: duel.uid,
    mode,
    dateKey: duel.dateKey,
    name: user.name,
    tier: tierFor(ratingAfter).name,
    // Matchmaking pairs future players by the rating this player had going in.
    rating: ratingBefore,
    ratingBucket: ratingBucket(ratingBefore),
    result: you,
    rankKey: rankKey(you),
    rand: Math.random(),
    createdAt: now,
  };

  return { summary, user: nextUser, attempt };
}

/** The profile as the app sees it: streak shown as it stands today. */
export function profileView(uid: string, user: UserDoc, history: DuelSummary[], today: string) {
  return {
    uid,
    name: user.name,
    ratings: user.ratings,
    duels: user.duels,
    wins: user.wins,
    streak: { ...user.streak, current: liveStreak(user.streak, today) },
    history,
  };
}

/** Display names: 1–20 visible characters, nothing from the blocklist. */
export function cleanName(raw: unknown, blocklist: ReadonlySet<string>): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  if (name.length === 0) return null;
  const squashed = name.toLowerCase().replace(/[^a-z]/g, '');
  for (const bad of blocklist) {
    if (bad.length >= 4 ? squashed.includes(bad) : squashed === bad) return null;
  }
  return name;
}
