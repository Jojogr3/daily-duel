/**
 * An offline backend that runs entirely on the device. It uses the same engine
 * as the real server, with bot rivals and a simulated leaderboard, so the whole
 * game can be played and tested before Firebase is set up.
 */
import {
  ALL_MODES,
  canPlayMode,
  EMPTY_STREAK,
  generateColorFlood,
  generateWordRush,
  liveStreak,
  milestoneReached,
  newBotRival,
  nextRating,
  outcomeFromCompare,
  compareResults,
  puzzleId,
  puzzleSeed,
  rankKey,
  recordPlay,
  replayAny,
  scoreLine,
  simulateColorFloodBot,
  simulateWordRushBot,
  START_RATING,
  tierFor,
  utcDateKey,
  botInfo,
  rngFromSeed,
  type AnyMoves,
  type AnyPuzzle,
  type AnyResult,
  type Mode,
  type RivalInfo,
} from '@daily-duel/engine';
import { loadDictionary } from './dictionary';
import { getJSON, KEYS, setJSON } from './storage';
import type { Backend, DuelInfo, DuelSummary, Leaderboard, LeaderboardEntry, Profile, StartedDuel } from './types';

const SALT = 'local-dev';
const HISTORY_LIMIT = 60;
const FAKE_FIELD = 30;

interface LocalDuel {
  rival: RivalInfo;
  startedAt?: number;
  summary?: DuelSummary;
}

interface LocalState {
  profile: Profile;
  duels: Record<string, LocalDuel>;
}

function perMode<T>(value: T): Record<Mode, T> {
  return Object.fromEntries(ALL_MODES.map((m) => [m, value])) as Record<Mode, T>;
}

function newUid(): string {
  return `local-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function emptyState(): LocalState {
  return {
    profile: {
      uid: newUid(),
      name: 'You',
      ratings: perMode(START_RATING),
      duels: perMode(0),
      wins: perMode(0),
      streak: EMPTY_STREAK,
      history: [],
    },
    duels: {},
  };
}

export class LocalBackend implements Backend {
  readonly kind = 'local' as const;
  private state: LocalState = emptyState();
  private puzzles = new Map<string, { puzzle: AnyPuzzle; words: string[] }>();

  async init(): Promise<void> {
    this.state = await getJSON<LocalState>(KEYS.local, emptyState());
  }

  private save(): Promise<void> {
    return setJSON(KEYS.local, this.state);
  }

  private async puzzleFor(mode: Mode, dateKey: string): Promise<{ puzzle: AnyPuzzle; words: string[] }> {
    const id = puzzleId(mode, dateKey);
    const cached = this.puzzles.get(id);
    if (cached) return cached;
    const seed = puzzleSeed(SALT, mode, dateKey);
    let entry: { puzzle: AnyPuzzle; words: string[] };
    if (mode === 'word-rush') {
      const { puzzle, solution } = generateWordRush(seed, await loadDictionary());
      entry = { puzzle, words: solution.words };
    } else {
      entry = { puzzle: generateColorFlood(seed), words: [] };
    }
    this.puzzles.set(id, entry);
    return entry;
  }

  private simulate(mode: Mode, seed: string, rating: number, entry: { puzzle: AnyPuzzle; words: string[] }): AnyResult {
    if (mode === 'word-rush') return simulateWordRushBot(seed, rating, entry.words);
    const par = entry.puzzle.mode === 'color-flood' ? entry.puzzle.par : 16;
    return simulateColorFloodBot(seed, rating, par);
  }

  async getProfile(): Promise<Profile> {
    const p = this.state.profile;
    const today = utcDateKey();
    return { ...p, streak: { ...p.streak, current: liveStreak(p.streak, today) } };
  }

  async setName(name: string): Promise<void> {
    this.state.profile.name = name.trim().slice(0, 20) || 'You';
    await this.save();
  }

  private duel(mode: Mode, dateKey: string): LocalDuel {
    const id = puzzleId(mode, dateKey);
    let d = this.state.duels[id];
    if (!d) {
      d = { rival: newBotRival(`${SALT}|${id}|${this.state.profile.uid}`, this.state.profile.ratings[mode]) };
      this.state.duels[id] = d;
    }
    return d;
  }

  async getDuelInfo(mode: Mode, subscribed: boolean): Promise<DuelInfo> {
    const dateKey = utcDateKey();
    const d = this.duel(mode, dateKey);
    await this.save();
    return {
      mode,
      dateKey,
      canPlay: canPlayMode(mode, dateKey, subscribed),
      status: d.summary ? 'done' : d.startedAt ? 'started' : 'new',
      rival: d.rival,
      summary: d.summary ?? null,
    };
  }

  async startDuel(mode: Mode, subscribed: boolean): Promise<StartedDuel> {
    const dateKey = utcDateKey();
    if (!canPlayMode(mode, dateKey, subscribed)) throw new Error('This mode needs Daily Duel+ today.');
    const d = this.duel(mode, dateKey);
    if (d.summary) throw new Error('You already played this duel today.');
    const { puzzle } = await this.puzzleFor(mode, dateKey);
    d.startedAt ??= Date.now();
    await this.save();
    return { puzzle, startedAt: d.startedAt, serverNow: Date.now() };
  }

  async submitDuel(mode: Mode, moves: AnyMoves): Promise<DuelSummary> {
    const p = this.state.profile;
    // Use the date the duel started on, so a round that crosses midnight still counts.
    const dateKey = Object.entries(this.state.duels).find(
      ([id, d]) => id.startsWith(`${mode}_`) && d.startedAt && !d.summary,
    )?.[0].slice(mode.length + 1);
    if (!dateKey) throw new Error('No duel in progress.');
    const d = this.duel(mode, dateKey);
    const entry = await this.puzzleFor(mode, dateKey);
    const dict = mode === 'word-rush' ? await loadDictionary() : null;
    const replay = replayAny(entry.puzzle, moves, dict);
    if (!replay.ok) throw new Error(`Attempt rejected (${replay.reason}).`);

    const you = replay.result;
    const rival = this.simulate(mode, `${SALT}|${puzzleId(mode, dateKey)}|rival`, d.rival.rating, entry);
    const cmp = compareResults(you, rival);
    const ratingBefore = p.ratings[mode];
    const ratingAfter = nextRating(ratingBefore, d.rival.rating, outcomeFromCompare(cmp), p.duels[mode]);
    const streakBefore = p.streak;
    const streak = recordPlay(streakBefore, dateKey);

    p.ratings[mode] = ratingAfter;
    p.duels[mode] += 1;
    if (cmp > 0) p.wins[mode] += 1;
    p.streak = streak;

    const field = await this.field(mode, dateKey);
    const rank = 1 + field.filter((f) => rankKey(f.result) > rankKey(you)).length;

    const summary: DuelSummary = {
      mode,
      dateKey,
      you,
      rival,
      rivalInfo: d.rival,
      outcome: cmp > 0 ? 'win' : cmp < 0 ? 'loss' : 'draw',
      ratingBefore,
      ratingAfter,
      streak,
      milestone: milestoneReached(streakBefore, streak),
      rank,
      par: entry.puzzle.mode === 'color-flood' ? entry.puzzle.par : undefined,
    };
    d.summary = summary;
    p.history = [summary, ...p.history].slice(0, HISTORY_LIMIT);
    await this.save();
    return summary;
  }

  /** A deterministic field of bot players for the offline leaderboard. */
  private async field(mode: Mode, dateKey: string): Promise<{ info: RivalInfo; result: AnyResult }[]> {
    const entry = await this.puzzleFor(mode, dateKey);
    const rng = rngFromSeed(`field|${mode}|${dateKey}`);
    const out: { info: RivalInfo; result: AnyResult }[] = [];
    for (let i = 0; i < FAKE_FIELD; i++) {
      const rating = Math.round(650 + rng() * 1300);
      out.push({ info: botInfo(rating), result: this.simulate(mode, `field|${dateKey}|${i}`, rating, entry) });
    }
    return out;
  }

  async getLeaderboard(mode: Mode, dateKey: string): Promise<Leaderboard> {
    const entry = await this.puzzleFor(mode, dateKey);
    const par = entry.puzzle.mode === 'color-flood' ? entry.puzzle.par : undefined;
    const rows = (await this.field(mode, dateKey)).map((f) => ({
      name: f.info.name,
      tier: f.info.tier,
      result: f.result,
      isYou: false,
    }));
    const mine = this.state.duels[puzzleId(mode, dateKey)]?.summary;
    if (mine) {
      rows.push({
        name: this.state.profile.name,
        tier: tierFor(mine.ratingAfter).name,
        result: mine.you,
        isYou: true,
      });
    }
    rows.sort((a, b) => rankKey(b.result) - rankKey(a.result));
    const entries: LeaderboardEntry[] = rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      tier: r.tier,
      scoreLabel: scoreLine(r.result, par),
      isYou: r.isYou,
    }));
    return { entries: entries.slice(0, 100), you: entries.find((e) => e.isYou) ?? null, total: entries.length };
  }

  async getPuzzle(mode: Mode, dateKey: string): Promise<AnyPuzzle> {
    if (dateKey > utcDateKey()) throw new Error('That puzzle is not out yet.');
    return (await this.puzzleFor(mode, dateKey)).puzzle;
  }
}
