/**
 * Daily Duel backend (Firebase Cloud Functions, 2nd gen).
 *
 * Callable functions (used by the app):
 *   getProfile, setName, getDuelInfo, startDuel, submitDuel, getLeaderboard, getPuzzle
 * Scheduled:
 *   generatePuzzles — daily, keeps the next 60 days of puzzles generated
 * HTTP:
 *   revenuecatWebhook — keeps each player's Daily Duel+ status in sync
 *
 * Clients never read or write Firestore directly (see firestore.rules).
 */
import {
  addDays,
  ALL_MODES,
  canPlayMode,
  generateColorFlood,
  generateWordRush,
  isMode,
  newBotRival,
  puzzleId,
  puzzleSeed,
  rankKey,
  scoreLine,
  simulateColorFloodBot,
  simulateWordRushBot,
  utcDateKey,
  type AnyPuzzle,
  type AnyResult,
  type Mode,
} from '@daily-duel/engine';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type Transaction } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall, onRequest, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { blocklist, dictionary } from './dictionary';
import {
  applyMonthlyPerks,
  clientSafe,
  cleanName,
  DuelError,
  isPlus,
  normaliseUser,
  profileView,
  ratingBucket,
  resolveDuel,
  type AttemptDoc,
  type DuelDoc,
  type DuelSummary,
  type UserDoc,
} from './logic';

initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

setGlobalOptions({ region: 'us-central1', maxInstances: 20, memory: '512MiB' });

const PUZZLE_SALT = defineSecret('PUZZLE_SALT');
const REVENUECAT_WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH');
const REVENUECAT_API_KEY = defineSecret('REVENUECAT_API_KEY');

/** Placeholder value for secrets that haven't been configured yet (see SETUP.md). */
const UNSET = 'unset';
const DAYS_AHEAD = 60;
const HISTORY_LIMIT = 60;
const PLUS_ENTITLEMENT = 'plus';

// ---------- documents ----------

interface PuzzleDoc {
  mode: Mode;
  dateKey: string;
  puzzle: AnyPuzzle;
  /** Word Rush only: every valid word, used for bot rivals. Never sent to clients. */
  words: string[];
  createdAt: number;
}

const userRef = (uid: string) => db.collection('users').doc(uid);
const historyCol = (uid: string) => userRef(uid).collection('history');
const puzzleRef = (mode: Mode, dateKey: string) => db.collection('puzzles').doc(puzzleId(mode, dateKey));
const duelRef = (mode: Mode, dateKey: string, uid: string) => db.collection('duels').doc(`${puzzleId(mode, dateKey)}_${uid}`);
const attemptRef = (mode: Mode, dateKey: string, uid: string) => db.collection('attempts').doc(`${puzzleId(mode, dateKey)}_${uid}`);

// ---------- helpers ----------

function requireUid(req: CallableRequest<unknown>): string {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return uid;
}

function requireMode(data: unknown): Mode {
  const mode = (data as { mode?: unknown } | null)?.mode;
  if (!isMode(mode)) throw new HttpsError('invalid-argument', 'Unknown mode.');
  return mode;
}

function requireDate(data: unknown): string {
  const d = (data as { dateKey?: unknown } | null)?.dateKey;
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) {
    throw new HttpsError('invalid-argument', 'Bad date.');
  }
  return d;
}

function asHttps(e: unknown): never {
  if (e instanceof HttpsError) throw e;
  if (e instanceof DuelError) throw new HttpsError(e.code, e.message);
  logger.error(e);
  throw new HttpsError('internal', 'Something went wrong. Please try again.');
}

async function loadUser(uid: string, now: number): Promise<UserDoc> {
  const snap = await userRef(uid).get();
  return normaliseUser(snap.data() as Partial<UserDoc> | undefined, now);
}

/** Generates a puzzle if it doesn't exist yet. Safe to call concurrently (create fails if it exists). */
async function ensurePuzzle(mode: Mode, dateKey: string): Promise<PuzzleDoc> {
  const ref = puzzleRef(mode, dateKey);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as PuzzleDoc;
  const seed = puzzleSeed(PUZZLE_SALT.value(), mode, dateKey);
  let doc: PuzzleDoc;
  if (mode === 'word-rush') {
    const { puzzle, solution } = generateWordRush(seed, dictionary());
    doc = { mode, dateKey, puzzle, words: solution.words, createdAt: Date.now() };
  } else {
    doc = { mode, dateKey, puzzle: generateColorFlood(seed), words: [], createdAt: Date.now() };
  }
  try {
    await ref.create(doc);
  } catch {
    // Another instance created it first; theirs is identical (same seed).
  }
  return doc;
}

/**
 * Is this player on Daily Duel+? Trusts our webhook-fed record, and double-checks
 * with RevenueCat's API when the record says no (covers a delayed or missed webhook).
 */
async function checkPlus(uid: string, user: UserDoc, now: number): Promise<boolean> {
  if (isPlus(user, now)) return true;
  const key = REVENUECAT_API_KEY.value();
  if (!key || key === UNSET) return false;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as {
      subscriber?: { entitlements?: Record<string, { expires_date: string | null }> };
    };
    const ent = body.subscriber?.entitlements?.[PLUS_ENTITLEMENT];
    if (!ent) return false;
    const expires = ent.expires_date ? Date.parse(ent.expires_date) : Number.MAX_SAFE_INTEGER;
    if (expires > now) {
      await userRef(uid).set({ plusExpiresAt: expires }, { merge: true });
      return true;
    }
  } catch (e) {
    logger.warn('RevenueCat check failed', e);
  }
  return false;
}

/** Find a real player's attempt near this rating, or fall back to a bot. */
async function pickRival(mode: Mode, dateKey: string, uid: string, rating: number): Promise<Pick<DuelDoc, 'rival' | 'rivalAttemptId'>> {
  const bucket = ratingBucket(rating);
  const buckets = [bucket - 1, bucket, bucket + 1];
  const base = db
    .collection('attempts')
    .where('mode', '==', mode)
    .where('dateKey', '==', dateKey)
    .where('ratingBucket', 'in', buckets);
  const r = Math.random();
  let snap = await base.orderBy('rand').startAt(r).limit(5).get();
  if (snap.empty) snap = await base.orderBy('rand').limit(5).get();
  const pick = snap.docs.find((d) => (d.data() as AttemptDoc).uid !== uid);
  if (pick) {
    const a = pick.data() as AttemptDoc;
    return { rival: { name: a.name, tier: a.tier, rating: a.rating, isBot: false }, rivalAttemptId: pick.id };
  }
  return { rival: newBotRival(`${puzzleId(mode, dateKey)}|${uid}`, rating), rivalAttemptId: null };
}

async function getOrCreateDuel(mode: Mode, dateKey: string, uid: string, user: UserDoc): Promise<DuelDoc> {
  const ref = duelRef(mode, dateKey, uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as DuelDoc;
  const picked = await pickRival(mode, dateKey, uid, user.ratings[mode]);
  const duel: DuelDoc = { uid, mode, dateKey, ...picked, startedAt: null, summary: null };
  try {
    await ref.create(duel);
    return duel;
  } catch {
    return (await ref.get()).data() as DuelDoc; // created concurrently
  }
}

// ---------- callable functions ----------

const callOpts = { secrets: [PUZZLE_SALT, REVENUECAT_API_KEY] };

export const getProfile = onCall(callOpts, async (req) => {
  try {
    const uid = requireUid(req);
    const now = Date.now();
    let user = await loadUser(uid, now);
    const perked = applyMonthlyPerks(user, now);
    if (perked !== user) {
      user = perked;
      await userRef(uid).set(user, { merge: true });
    }
    const hist = await historyCol(uid).orderBy('dateKey', 'desc').limit(HISTORY_LIMIT).get();
    return profileView(uid, user, hist.docs.map((d) => d.data() as DuelSummary), utcDateKey(new Date(now)));
  } catch (e) {
    asHttps(e);
  }
});

export const setName = onCall(callOpts, async (req) => {
  try {
    const uid = requireUid(req);
    const name = cleanName((req.data as { name?: unknown } | null)?.name, blocklist());
    if (!name) throw new HttpsError('invalid-argument', "That name can't be used. Try another.");
    const now = Date.now();
    const user = await loadUser(uid, now);
    await userRef(uid).set({ ...user, name }, { merge: true });
    return { ok: true };
  } catch (e) {
    asHttps(e);
  }
});

export const getDuelInfo = onCall(callOpts, async (req) => {
  try {
    const uid = requireUid(req);
    const mode = requireMode(req.data);
    const now = Date.now();
    const dateKey = utcDateKey(new Date(now));
    const user = await loadUser(uid, now);
    const plus = await checkPlus(uid, user, now);
    const canPlay = canPlayMode(mode, dateKey, plus);
    const duel = canPlay ? await getOrCreateDuel(mode, dateKey, uid, user) : null;
    return {
      mode,
      dateKey,
      canPlay,
      status: duel?.summary ? 'done' : duel?.startedAt ? 'started' : 'new',
      rival: duel?.rival ?? null,
      summary: duel?.summary ?? null,
    };
  } catch (e) {
    asHttps(e);
  }
});

export const startDuel = onCall(callOpts, async (req) => {
  try {
    const uid = requireUid(req);
    const mode = requireMode(req.data);
    const now = Date.now();
    const dateKey = utcDateKey(new Date(now));
    const user = await loadUser(uid, now);
    if (!canPlayMode(mode, dateKey, await checkPlus(uid, user, now))) {
      throw new HttpsError('permission-denied', 'This mode needs Daily Duel+ today.');
    }
    await getOrCreateDuel(mode, dateKey, uid, user);
    const { puzzle } = await ensurePuzzle(mode, dateKey);
    const ref = duelRef(mode, dateKey, uid);
    const startedAt = await db.runTransaction(async (tx: Transaction) => {
      const d = (await tx.get(ref)).data() as DuelDoc;
      if (d.summary) throw new HttpsError('failed-precondition', 'You already played this duel today.');
      if (d.startedAt !== null) return d.startedAt; // resume: the clock keeps running
      tx.update(ref, { startedAt: now });
      return now;
    });
    return { puzzle: clientSafe(puzzle), startedAt, serverNow: Date.now() };
  } catch (e) {
    asHttps(e);
  }
});

async function rivalResultFor(duel: DuelDoc, puzzleDoc: PuzzleDoc): Promise<AnyResult> {
  if (duel.rivalAttemptId) {
    const snap = await db.collection('attempts').doc(duel.rivalAttemptId).get();
    if (snap.exists) return (snap.data() as AttemptDoc).result;
  }
  const seed = `${puzzleId(duel.mode, duel.dateKey)}|${duel.uid}|rival`;
  if (puzzleDoc.puzzle.mode === 'word-rush') return simulateWordRushBot(seed, duel.rival.rating, puzzleDoc.words);
  return simulateColorFloodBot(seed, duel.rival.rating, puzzleDoc.puzzle.par);
}

export const submitDuel = onCall(callOpts, async (req) => {
  try {
    const uid = requireUid(req);
    const mode = requireMode(req.data);
    const moves = (req.data as { moves?: unknown } | null)?.moves;
    const now = Date.now();
    // The open duel is normally today's, but may have started yesterday (a round that crossed midnight UTC).
    const today = utcDateKey(new Date(now));
    const open = async (dateKey: string) => {
      const ref = duelRef(mode, dateKey, uid);
      const snap = await ref.get();
      const d = snap.data() as DuelDoc | undefined;
      return d && d.startedAt !== null && !d.summary ? { ref, duel: d, dateKey } : null;
    };
    const found = (await open(today)) ?? (await open(addDays(today, -1)));
    if (!found) throw new HttpsError('failed-precondition', 'No duel in progress.');
    const { ref, dateKey } = found;

    const puzzleDoc = await ensurePuzzle(mode, dateKey);
    const rivalResult = await rivalResultFor(found.duel, puzzleDoc);
    const dict = mode === 'word-rush' ? dictionary() : null;

    const summary = await db.runTransaction(async (tx: Transaction) => {
      const [duelSnap, userSnap] = await Promise.all([tx.get(ref), tx.get(userRef(uid))]);
      const duel = duelSnap.data() as DuelDoc;
      const user = normaliseUser(userSnap.data() as Partial<UserDoc> | undefined, now);
      const out = resolveDuel({ user, duel, puzzle: puzzleDoc.puzzle, dict, moves, rivalResult, now });
      tx.set(userRef(uid), out.user, { merge: true });
      tx.set(attemptRef(mode, dateKey, uid), out.attempt);
      tx.update(ref, { summary: out.summary });
      tx.set(historyCol(uid).doc(puzzleId(mode, dateKey)), out.summary);
      return out.summary;
    });

    // Leaderboard position (outside the transaction; counts are eventually consistent anyway).
    const ahead = await db
      .collection('attempts')
      .where('mode', '==', mode)
      .where('dateKey', '==', dateKey)
      .where('rankKey', '>', rankKey(summary.you))
      .count()
      .get();
    const withRank: DuelSummary = { ...summary, rank: ahead.data().count + 1 };
    await Promise.all([ref.update({ summary: withRank }), historyCol(uid).doc(puzzleId(mode, dateKey)).set(withRank)]);
    return withRank;
  } catch (e) {
    asHttps(e);
  }
});

export const getLeaderboard = onCall(callOpts, async (req) => {
  try {
    const uid = requireUid(req);
    const mode = requireMode(req.data);
    const dateKey = requireDate(req.data);
    const base = db.collection('attempts').where('mode', '==', mode).where('dateKey', '==', dateKey);
    const [top, total, mine, puzzleSnap] = await Promise.all([
      base.orderBy('rankKey', 'desc').limit(100).get(),
      base.count().get(),
      attemptRef(mode, dateKey, uid).get(),
      puzzleRef(mode, dateKey).get(),
    ]);
    const p = puzzleSnap.data() as PuzzleDoc | undefined;
    const par = p?.puzzle.mode === 'color-flood' ? p.puzzle.par : undefined;
    const entries = top.docs.map((d, i) => {
      const a = d.data() as AttemptDoc;
      return { rank: i + 1, name: a.name, tier: a.tier, scoreLabel: scoreLine(a.result, par), isYou: a.uid === uid };
    });
    let you = entries.find((e) => e.isYou) ?? null;
    if (!you && mine.exists) {
      const a = mine.data() as AttemptDoc;
      const ahead = await base.where('rankKey', '>', a.rankKey).count().get();
      you = { rank: ahead.data().count + 1, name: a.name, tier: a.tier, scoreLabel: scoreLine(a.result, par), isYou: true };
    }
    return { entries, you, total: total.data().count };
  } catch (e) {
    asHttps(e);
  }
});

/** Any past or current daily puzzle: share links (free, any mode) and the archive. Unranked. */
export const getPuzzle = onCall(callOpts, async (req) => {
  try {
    requireUid(req);
    const mode = requireMode(req.data);
    const dateKey = requireDate(req.data);
    if (dateKey > utcDateKey()) throw new HttpsError('failed-precondition', 'That puzzle is not out yet.');
    return clientSafe((await ensurePuzzle(mode, dateKey)).puzzle);
  } catch (e) {
    asHttps(e);
  }
});

// ---------- scheduled ----------

/** Runs daily: makes sure every puzzle for the next 60 days exists, so nothing is generated at the last second. */
export const generatePuzzles = onSchedule(
  { schedule: '15 0 * * *', timeZone: 'UTC', secrets: [PUZZLE_SALT], timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    const today = utcDateKey();
    let created = 0;
    for (let i = 0; i <= DAYS_AHEAD; i++) {
      const dateKey = addDays(today, i);
      for (const mode of ALL_MODES) {
        const exists = (await puzzleRef(mode, dateKey).get()).exists;
        if (!exists) {
          await ensurePuzzle(mode, dateKey);
          created++;
        }
      }
    }
    logger.info(`generatePuzzles: created ${created} puzzles through ${addDays(today, DAYS_AHEAD)}`);
  },
);

// ---------- RevenueCat webhook ----------

/**
 * RevenueCat → Firestore subscription sync. Configure in RevenueCat:
 * Integrations > Webhooks, URL = this function's URL, Authorization header = REVENUECAT_WEBHOOK_AUTH.
 */
export const revenuecatWebhook = onRequest({ secrets: [REVENUECAT_WEBHOOK_AUTH] }, async (req, res) => {
  const expected = REVENUECAT_WEBHOOK_AUTH.value();
  if (req.method !== 'POST' || !expected || expected === UNSET || req.get('Authorization') !== expected) {
    res.status(401).send('unauthorized');
    return;
  }
  const event = (req.body as { event?: Record<string, unknown> } | undefined)?.event;
  const uid = typeof event?.app_user_id === 'string' ? event.app_user_id : null;
  const type = typeof event?.type === 'string' ? event.type : '';
  if (!event || !uid || uid.startsWith('$RCAnonymousID')) {
    res.status(200).send('ignored');
    return;
  }
  const entitlements = Array.isArray(event.entitlement_ids) ? (event.entitlement_ids as string[]) : [];
  if (entitlements.length > 0 && !entitlements.includes(PLUS_ENTITLEMENT)) {
    res.status(200).send('ignored');
    return;
  }
  const expires = typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : null;
  let plusExpiresAt: number | null = null;
  if (type === 'EXPIRATION') plusExpiresAt = 0;
  // CANCELLATION keeps access until the paid period ends, so it just records the same expiry.
  else if (expires !== null) plusExpiresAt = expires;
  if (plusExpiresAt !== null) {
    await userRef(uid).set({ plusExpiresAt }, { merge: true });
    logger.info(`revenuecat ${type} for ${uid}: plus until ${new Date(plusExpiresAt).toISOString()}`);
  }
  res.status(200).send('ok');
});
