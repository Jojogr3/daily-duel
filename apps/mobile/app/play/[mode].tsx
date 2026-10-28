/**
 * Unranked play: share links (any mode, free), the archive (Daily Duel+) and practice.
 * Results here never touch ratings or streaks.
 */
import {
  generateColorFlood,
  generateWordRush,
  isMode,
  MODE_NAMES,
  replayAny,
  scoreLine,
  utcDateKey,
  type AnyMoves,
  type AnyPuzzle,
  type AnyResult,
  type Mode,
} from '@daily-duel/engine';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { GameHost } from '../../src/components/GameHost';
import { Body, Button, Card, ErrorBox, Loading, Screen, Small, Title } from '../../src/components/ui';
import { FREE_PRACTICE_PER_DAY } from '../../src/config';
import { adsAvailable, showRewarded } from '../../src/services/ads';
import { loadDictionary } from '../../src/services/dictionary';
import { getJSON, KEYS, setJSON } from '../../src/services/storage';
import { useApp } from '../../src/state/AppContext';
import { space } from '../../src/theme';

type Source = 'share' | 'archive' | 'practice';

type Phase =
  | { kind: 'loading' }
  | { kind: 'limit' }
  | { kind: 'ready'; puzzle: AnyPuzzle }
  | { kind: 'playing'; puzzle: AnyPuzzle; startedAt: number }
  | { kind: 'done'; puzzle: AnyPuzzle; result: AnyResult }
  | { kind: 'error'; message: string };

interface PracticeCount {
  date: string;
  used: number;
  bonus: number;
}

async function practiceState(): Promise<PracticeCount> {
  const s = await getJSON<PracticeCount>(KEYS.practice, { date: '', used: 0, bonus: 0 });
  return s.date === utcDateKey() ? s : { date: utcDateKey(), used: 0, bonus: 0 };
}

export default function PlayScreen() {
  const params = useLocalSearchParams<{ mode: string; date?: string; source?: string }>();
  const mode: Mode = isMode(params.mode) ? params.mode : 'word-rush';
  const source: Source = params.source === 'archive' ? 'archive' : params.source === 'practice' ? 'practice' : 'share';
  const { backend, subscribed } = useApp();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' });
    try {
      if (source === 'archive' && !subscribed) {
        router.replace('/paywall');
        return;
      }
      if (source === 'practice') {
        const s = await practiceState();
        if (!subscribed && s.used >= FREE_PRACTICE_PER_DAY + s.bonus) {
          setPhase({ kind: 'limit' });
          return;
        }
        const seed = `practice|${Date.now()}|${Math.random()}`;
        const puzzle: AnyPuzzle =
          mode === 'word-rush' ? generateWordRush(seed, await loadDictionary()).puzzle : generateColorFlood(seed);
        setPhase({ kind: 'ready', puzzle });
        return;
      }
      const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : utcDateKey();
      setPhase({ kind: 'ready', puzzle: await backend.getPuzzle(mode, date) });
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : "Couldn't load that puzzle." });
    }
  }, [backend, mode, params.date, source, subscribed]);

  useEffect(() => {
    load();
  }, [load]);

  const begin = async (puzzle: AnyPuzzle) => {
    if (source === 'practice') {
      const s = await practiceState();
      await setJSON(KEYS.practice, { ...s, used: s.used + 1 });
    }
    setPhase({ kind: 'playing', puzzle, startedAt: Date.now() });
  };

  const finish = async (puzzle: AnyPuzzle, moves: AnyMoves) => {
    const dict = puzzle.mode === 'word-rush' ? await loadDictionary() : null;
    const replay = replayAny(puzzle, moves, dict);
    if (replay.ok) setPhase({ kind: 'done', puzzle, result: replay.result });
    else setPhase({ kind: 'error', message: 'Something went wrong scoring that round.' });
  };

  const watchForExtra = async () => {
    if (await showRewarded()) {
      const s = await practiceState();
      await setJSON(KEYS.practice, { ...s, bonus: s.bonus + 1 });
      load();
    }
  };

  const heading =
    source === 'practice' ? `${MODE_NAMES[mode]} practice` : `${MODE_NAMES[mode]} · ${params.date ?? utcDateKey()}`;

  if (phase.kind === 'loading') return <Loading />;

  return (
    <Screen scroll={phase.kind !== 'playing'}>
      <Stack.Screen options={{ title: heading }} />
      {phase.kind === 'error' ? <ErrorBox message={phase.message} onRetry={load} /> : null}

      {phase.kind === 'limit' ? (
        <Card>
          <Title>That's today's practice</Title>
          <Body muted>Free players get {FREE_PRACTICE_PER_DAY} practice rounds a day.</Body>
          {adsAvailable() ? <Button label="Watch an ad for one more" kind="secondary" onPress={watchForExtra} /> : null}
          <Button label="Get unlimited practice" onPress={() => router.push('/paywall')} />
        </Card>
      ) : null}

      {phase.kind === 'ready' ? (
        <View style={{ flex: 1, justifyContent: 'center', gap: space(2) }}>
          <Title>{heading}</Title>
          <Body muted>
            {source === 'share'
              ? "A friend sent you this puzzle. It's unranked: play it free and see how you compare."
              : source === 'archive'
                ? 'An archived daily puzzle. Unranked.'
                : 'A fresh random board. Unranked, so experiment freely.'}
          </Body>
          <Button label="Start" onPress={() => begin(phase.puzzle)} />
        </View>
      ) : null}

      {phase.kind === 'playing' ? (
        <GameHost puzzle={phase.puzzle} startedAt={phase.startedAt} onFinish={(m) => finish(phase.puzzle, m)} />
      ) : null}

      {phase.kind === 'done' ? (
        <View style={{ gap: space(2), paddingTop: space(2) }}>
          <View style={{ alignItems: 'center', gap: space(1) }}>
            <Text style={{ fontSize: 52 }}>✅</Text>
            <Title>Nice round</Title>
            <Body>{scoreLine(phase.result, phase.puzzle.mode === 'color-flood' ? phase.puzzle.par : undefined)}</Body>
            {phase.result.mode === 'word-rush' && phase.result.words.length > 0 ? (
              <Small style={{ textAlign: 'center' }}>{phase.result.words.map((w) => w.toUpperCase()).join(' · ')}</Small>
            ) : null}
          </View>
          {source === 'practice' ? <Button label="Play another" onPress={load} /> : null}
          {source === 'share' ? (
            <Button label="Play today's ranked duel" onPress={() => router.replace({ pathname: '/duel/[mode]', params: { mode: 'word-rush' } })} />
          ) : null}
          <Button label="Home" kind="secondary" onPress={() => router.dismissTo('/')} />
        </View>
      ) : null}
    </Screen>
  );
}
