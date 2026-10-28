#!/usr/bin/env node
/**
 * Weekly metrics from Firestore, printed as Markdown.
 * Run by .github/workflows/weekly-report.yml, which posts it as a GitHub issue.
 * Revenue lives in RevenueCat and ad earnings in AdMob; this covers players and play.
 *
 * Needs Google credentials (GOOGLE_APPLICATION_CREDENTIALS) and FIREBASE_PROJECT_ID.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const DAY = 86_400_000;
const key = (ms) => new Date(ms).toISOString().slice(0, 10);
const today = Date.now();
const days = Array.from({ length: 7 }, (_, i) => key(today - (7 - i) * DAY)); // last 7 full days

async function playersOn(dateKey) {
  const snap = await db.collection('attempts').where('dateKey', '==', dateKey).select('uid', 'mode').get();
  const uids = new Set();
  const byMode = {};
  for (const d of snap.docs) {
    const a = d.data();
    uids.add(a.uid);
    byMode[a.mode] = (byMode[a.mode] ?? 0) + 1;
  }
  return { uids, duels: snap.size, byMode };
}

const perDay = {};
for (const d of days) perDay[d] = await playersOn(d);

// New players per day, from user creation time.
const since = today - 15 * DAY;
const newUsers = await db.collection('users').where('createdAt', '>=', since).select('createdAt').get();
const cohorts = {};
for (const u of newUsers.docs) {
  const k = key(u.data().createdAt);
  (cohorts[k] ??= []).push(u.id);
}

// Day-1 retention: of players who joined on day X, how many played on X+1.
async function retention(offset) {
  let joined = 0;
  let returned = 0;
  for (const d of days) {
    const cohort = cohorts[d] ?? [];
    const later = key(Date.parse(d) + offset * DAY);
    if (cohort.length === 0 || Date.parse(later) >= today - DAY) continue;
    const played = perDay[later]?.uids ?? (await playersOn(later)).uids;
    joined += cohort.length;
    returned += cohort.filter((uid) => played.has(uid)).length;
  }
  return joined ? `${Math.round((100 * returned) / joined)}% (${returned}/${joined})` : 'n/a';
}

const subs = await db.collection('users').where('plusExpiresAt', '>', today).count().get();
const totalUsers = await db.collection('users').count().get();

const rows = days
  .map((d) => {
    const p = perDay[d];
    const modes = Object.entries(p.byMode).map(([m, n]) => `${m} ${n}`).join(', ') || '–';
    return `| ${d} | ${(cohorts[d] ?? []).length} | ${p.uids.size} | ${p.duels} | ${modes} |`;
  })
  .join('\n');

const avgDaily = Math.round(days.reduce((s, d) => s + perDay[d].uids.size, 0) / days.length);

console.log(`## Daily Duel weekly report — week ending ${days[days.length - 1]}

**Daily players (avg):** ${avgDaily} · **Total players:** ${totalUsers.data().count} · **Active Daily Duel+ subscribers:** ${subs.data().count}

**Day-1 retention:** ${await retention(1)} · **Day-7 retention:** ${await retention(7)}

| Day (UTC) | New players | Daily players | Duels | By mode |
| --- | --- | --- | --- | --- |
${rows}

Revenue: see the RevenueCat dashboard. Ad earnings: see AdMob.
`);
