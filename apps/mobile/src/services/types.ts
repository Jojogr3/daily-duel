import type { AnyMoves, AnyPuzzle, AnyResult, Mode, Outcome, RivalInfo, StreakState } from '@daily-duel/engine';

export type { RivalInfo };

export type DuelStatus = 'new' | 'started' | 'done';

export interface DuelInfo {
  mode: Mode;
  dateKey: string;
  /** False when the mode needs Daily Duel+ today. */
  canPlay: boolean;
  status: DuelStatus;
  /** Shown before the start, without their score. */
  rival: RivalInfo | null;
  summary: DuelSummary | null;
}

export interface StartedDuel {
  puzzle: AnyPuzzle;
  /** Server time the duel started, ms. Word Rush's 60s clock runs from here even if the app closes. */
  startedAt: number;
  /** Server "now" when this response was made, so the client can correct for clock skew. */
  serverNow: number;
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
  /** Position on today's leaderboard, 1-based. */
  rank: number | null;
  par?: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  tier: string;
  scoreLabel: string;
  isYou: boolean;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  you: LeaderboardEntry | null;
  total: number;
}

export interface Profile {
  uid: string;
  name: string;
  ratings: Record<Mode, number>;
  duels: Record<Mode, number>;
  wins: Record<Mode, number>;
  streak: StreakState;
  /** Most recent first. */
  history: DuelSummary[];
}

/** Everything the app needs from a server. Implemented by Firebase and by an offline local version. */
export interface Backend {
  readonly kind: 'firebase' | 'local';
  init(): Promise<void>;
  getProfile(): Promise<Profile>;
  setName(name: string): Promise<void>;
  getDuelInfo(mode: Mode, subscribed: boolean): Promise<DuelInfo>;
  startDuel(mode: Mode, subscribed: boolean): Promise<StartedDuel>;
  submitDuel(mode: Mode, moves: AnyMoves): Promise<DuelSummary>;
  getLeaderboard(mode: Mode, dateKey: string): Promise<Leaderboard>;
  /** Any past or current daily puzzle, for share links and the archive. Unranked. */
  getPuzzle(mode: Mode, dateKey: string): Promise<AnyPuzzle>;
}
