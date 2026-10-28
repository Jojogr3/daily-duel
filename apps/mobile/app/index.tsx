import { ALL_MODES, bonusModeFor, FREE_MODE, MODE_NAMES, scoreLine, tierFor, utcDateKey, type Mode } from '@daily-duel/engine';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Card, ErrorBox, H2, Pill, Row, Screen, Small } from '../src/components/ui';
import { getJSON, KEYS } from '../src/services/storage';
import type { DuelInfo } from '../src/services/types';
import { useApp } from '../src/state/AppContext';
import { space, useTheme } from '../src/theme';

const BLURB: Record<Mode, string> = {
  'word-rush': 'Find as many words as you can in 60 seconds.',
  'color-flood': 'Flood the board with one colour in the fewest taps.',
};

export default function Home() {
  const t = useTheme();
  const { backend, profile, subscribed, refreshProfile } = useApp();
  const [infos, setInfos] = useState<Partial<Record<Mode, DuelInfo>>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      if (!(await getJSON<boolean>(KEYS.onboarded, false))) {
        router.replace('/onboarding');
        return;
      }
      const results = await Promise.all(ALL_MODES.map((m) => backend.getDuelInfo(m, subscribed)));
      setInfos(Object.fromEntries(results.map((r) => [r.mode, r])));
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load today's duels.");
    }
  }, [backend, subscribed, refreshProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = utcDateKey();
  const bonus = bonusModeFor(today);
  const streak = profile?.streak.current ?? 0;
  const bestRating = profile ? Math.max(...ALL_MODES.map((m) => profile.ratings[m])) : 0;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Small>Welcome back</Small>
          <H2>{profile?.name ?? 'Player'}</H2>
        </View>
        <Row style={{ gap: space(1.5) }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/profile')}>
            <Pill label={`🔥 ${streak}`} color={t.youSoft} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/profile')}>
            <Pill label={tierFor(bestRating).name} color={t.rivalSoft} />
          </Pressable>
        </Row>
      </Row>

      {error ? <ErrorBox message={error} onRetry={load} /> : null}

      {ALL_MODES.map((mode) => {
        const info = infos[mode];
        const locked = info ? !info.canPlay : mode !== FREE_MODE && !subscribed;
        const freeToday = !subscribed && bonus === mode;
        let status = 'Play';
        if (info?.status === 'done' && info.summary) {
          const o = info.summary.outcome;
          status = `${o === 'win' ? 'Won' : o === 'loss' ? 'Lost' : 'Tied'} · ${scoreLine(info.summary.you, info.summary.par)}`;
        } else if (info?.status === 'started') status = 'Resume';
        else if (locked) status = 'Daily Duel+';
        return (
          <Card
            key={mode}
            accent={info?.status === 'done' ? undefined : locked ? undefined : t.you}
            onPress={() => (locked ? router.push('/paywall') : router.push({ pathname: '/duel/[mode]', params: { mode } }))}
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <H2>{MODE_NAMES[mode]}</H2>
              {freeToday ? <Pill label="Free today" color={t.good} textColor="#FFFFFF" /> : locked ? <Text style={{ fontSize: 18 }}>🔒</Text> : null}
            </Row>
            <Body muted>{BLURB[mode]}</Body>
            <Row style={{ justifyContent: 'space-between', marginTop: space(0.5) }}>
              <Small>{info?.rival && info.status !== 'done' ? `Rival: ${info.rival.name}${info.rival.isBot ? ' 🤖' : ''}` : ' '}</Small>
              <Text style={{ color: info?.status === 'done' ? t.muted : t.you, fontWeight: '800' }}>{status} →</Text>
            </Row>
          </Card>
        );
      })}

      {!subscribed ? (
        <Card onPress={() => router.push('/paywall')} style={{ backgroundColor: t.surfaceAlt }}>
          <H2>Get every mode, every day</H2>
          <Body muted>Daily Duel+ unlocks all puzzles, the archive and unlimited practice, with no ads.</Body>
        </Card>
      ) : null}

      <Row style={{ justifyContent: 'space-around', marginTop: 'auto', paddingTop: space(2) }}>
        <Link href={{ pathname: '/leaderboard', params: { mode: FREE_MODE } }} style={{ color: t.ink, fontWeight: '600' }}>
          Leaderboard
        </Link>
        <Link href="/archive" style={{ color: t.ink, fontWeight: '600' }}>
          Practice & archive
        </Link>
        <Link href="/settings" style={{ color: t.ink, fontWeight: '600' }}>
          Settings
        </Link>
      </Row>
    </Screen>
  );
}
