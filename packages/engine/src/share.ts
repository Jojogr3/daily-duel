/** Spoiler-free share text for a finished duel. */
import { MODE_NAMES, type Mode } from './daily';

/** Day 1 of Daily Duel; puzzle numbers count from here. Change before launch. */
export const LAUNCH_DATE_KEY = '2027-01-01';

export function puzzleNumber(dateKey: string): number {
  const days = Math.round((Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${LAUNCH_DATE_KEY}T00:00:00Z`)) / 86_400_000);
  return days + 1;
}

export interface ShareInput {
  mode: Mode;
  dateKey: string;
  outcome: 'win' | 'loss' | 'draw';
  rivalTier: string;
  /** e.g. "34 pts · 18 words" or "17 taps · par 18". */
  scoreLine: string;
  streak: number;
  /** Base URL for share links, e.g. "https://dailyduel.app". */
  linkBase: string;
}

export function shareLink(linkBase: string, mode: Mode, dateKey: string): string {
  return `${linkBase.replace(/\/$/, '')}/p/${mode}/${dateKey}`;
}

export function shareText(input: ShareInput): string {
  const head = `Daily Duel #${puzzleNumber(input.dateKey)} · ${MODE_NAMES[input.mode]}`;
  const verdict =
    input.outcome === 'win'
      ? `🏆 Beat a ${input.rivalTier} rival`
      : input.outcome === 'draw'
        ? `🤝 Tied a ${input.rivalTier} rival`
        : `⚔️ Lost to a ${input.rivalTier} rival`;
  const lines = [head, verdict, input.scoreLine];
  if (input.streak > 1) lines.push(`🔥 ${input.streak}-day streak`);
  lines.push(`Can you beat it? ${shareLink(input.linkBase, input.mode, input.dateKey)}`);
  return lines.join('\n');
}
