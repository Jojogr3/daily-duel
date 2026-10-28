/**
 * The ranked daily duel: rival reveal → play → result.
 * Word Rush's clock runs from the server's start time, so leaving the app doesn't pause it.
 */
import { isMode, MODE_NAMES, utcDateKey, type AnyMoves, type Mode } from '@daily-duel/engine';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { GameHost } from '../../src/components/GameHost';
import { ResultView } from '../../src/components/ResultView';
import { Body, Button, Card, ErrorBox, Loading, Pill, Row, Screen, Small, Title } from '../../src/components/ui';
import { maybeShowInterstitial, noteDuelCompleted } from '../../src/services/ads';
import { scheduleReminders } from '../../src/services/notifications';
import type { DuelInfo, DuelSummary, StartedDuel } from '../../src/services/types';
import { useApp } from '../../src/state/AppContext';
import { space, useTheme } from '../../src/theme';

type Phase =
  | { kind: 'loading' }
  | { kind: 'reveal'; info: DuelInfo }
  | { kind: 'playing'; started: StartedDuel; clientStart: number }
  | { kind: 'submitting' }
  | { kind: 'result'; summary: DuelSummary }
  | { kind: 'error'; message: string };

export default function DuelScreen() {
  const params = useLocalSearchParams<{ mode: string }>();
  const mode: Mode = isMode(params.mode) ? params.mode : 'word-rush';
  const t = useTheme();
  const { backend, subscribed, settings, refreshProfile } = useApp();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [starting, setStarting] = useState(false);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const started = await backend.startDuel(mode, subscribed);
      // Convert server start time to this device's clock.
      const clientStart = started.startedAt + (Date.now() - started.serverNow);
      setPhase({ kind: 'playing', started, clientStart });
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'Could not start the duel.' });
    } finally {
      setStarting(false);
    }
  }, [backend, mode, subscribed]);

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' });
    try {
      const info = await backend.getDuelInfo(mode, subscribed);
      if (!info.canPlay) {
        router.replace('/paywall');
        return;
      }
      if (info.status === 'done' && info.summary) setPhase({ kind: 'result', summary: info.summary });
      else if (info.status === 'started') await start();
      else setPhase({ kind: 'reveal', info });
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : "Couldn't load the duel." });
    }
  }, [backend, mode, subscribed, start]);

  useEffect(() => {
    load();
  }, [load]);

  const finish = useCallback(
    async (moves: AnyMoves) => {
      setPhase({ kind: 'submitting' });
      try {
        const summary = await backend.submitDuel(mode, moves);
        await noteDuelCompleted();
        await maybeShowInterstitial(subscribed);
        setPhase({ kind: 'result', summary });
        const p = await refreshProfile();
        scheduleReminders(settings, true, p?.streak.current ?? summary.streak.current).catch(() => {});
      } catch (e) {
        setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'Could not submit your result.' });
      }
    },
    [backend, mode, subscribed, refreshProfile, settings],
  );

  const title = MODE_NAMES[mode];

  if (phase.kind === 'loading') return <Loading />;
  if (phase.kind === 'submitting') return <Loading label="Comparing with your rival…" />;

  return (
    <Screen scroll={phase.kind !== 'playing'}>
      <Stack.Screen options={{ title, headerBackVisible: phase.kind !== 'playing' }} />

      {phase.kind === 'error' ? <ErrorBox message={phase.message} onRetry={load} /> : null}

      {phase.kind === 'reveal' && phase.info.rival ? (
        <View style={{ flex: 1, justifyContent: 'center', gap: space(3) }}>
          <View style={{ alignItems: 'center', gap: space(1) }}>
            <Small>{utcDateKey()} · today's rival</Small>
            <Text style={{ fontSize: 64 }}>{phase.info.rival.isBot ? '🤖' : '⚔️'}</Text>
            <Title>{phase.info.rival.name}</Title>
            <Row>
              <Pill label={phase.info.rival.tier} color={t.rivalSoft} />
              <Pill label={`${phase.info.rival.rating}`} color={t.surfaceAlt} />
            </Row>
          </View>
          <Card>
            <Body>{rules(mode)}</Body>
            <Small>One ranked attempt per day. Your rival played this exact puzzle; their score stays hidden until you finish.</Small>
            {phase.info.rival.isBot ? <Small>Bots fill in when no player near your rank has played yet.</Small> : null}
          </Card>
          <Button label="Start duel" onPress={start} loading={starting} />
        </View>
      ) : null}

      {phase.kind === 'playing' ? (
        <GameHost puzzle={phase.started.puzzle} startedAt={phase.clientStart} onFinish={finish} />
      ) : null}

      {phase.kind === 'result' ? <ResultView summary={phase.summary} /> : null}
    </Screen>
  );
}

function rules(mode: Mode): string {
  return mode === 'word-rush'
    ? 'Drag across touching letters (diagonals count) to make words of 3+ letters. Longer words score more. You have 60 seconds, and the clock keeps running if you leave.'
    : 'Tap a colour to recolour your area in the top-left corner and absorb matching neighbours. Fill the whole board in as few taps as you can; time breaks ties.';
}
