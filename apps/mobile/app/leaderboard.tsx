import { ALL_MODES, isMode, MODE_NAMES, utcDateKey, type Mode } from '@daily-duel/engine';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Card, ErrorBox, Loading, Row, Screen, Small } from '../src/components/ui';
import type { Leaderboard } from '../src/services/types';
import { useApp } from '../src/state/AppContext';
import { radius, space, useTheme } from '../src/theme';

export default function LeaderboardScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const t = useTheme();
  const { backend } = useApp();
  const [mode, setMode] = useState<Mode>(isMode(params.mode) ? params.mode : 'word-rush');
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = utcDateKey();

  const load = useCallback(async () => {
    setBoard(null);
    setError(null);
    try {
      setBoard(await backend.getLeaderboard(mode, today));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the leaderboard.");
    }
  }, [backend, mode, today]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <Row style={{ backgroundColor: t.surfaceAlt, borderRadius: radius.md, padding: 4 }}>
        {ALL_MODES.map((m) => (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: m === mode }}
            onPress={() => setMode(m)}
            style={{ flex: 1, paddingVertical: space(1), borderRadius: radius.sm, backgroundColor: m === mode ? t.surface : 'transparent', alignItems: 'center' }}
          >
            <Text style={{ color: t.ink, fontWeight: m === mode ? '800' : '500' }}>{MODE_NAMES[m]}</Text>
          </Pressable>
        ))}
      </Row>
      <Small>Today, {today} (UTC) · {board?.total ?? '…'} players</Small>

      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {!board && !error ? <Loading /> : null}

      {board?.you && board.you.rank > board.entries.length ? (
        <Card accent={t.you}>
          <Body>
            You're #{board.you.rank} · {board.you.scoreLabel}
          </Body>
        </Card>
      ) : null}

      {board ? (
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          {board.entries.length === 0 ? (
            <View style={{ padding: space(2) }}>
              <Body muted>No one has played yet today. Be first!</Body>
            </View>
          ) : (
            board.entries.map((e, i) => (
              <Row
                key={`${e.rank}-${e.name}-${i}`}
                style={{
                  paddingHorizontal: space(2),
                  paddingVertical: space(1.25),
                  backgroundColor: e.isYou ? t.youSoft : 'transparent',
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderColor: t.line,
                }}
              >
                <Text style={{ width: 36, color: t.muted, fontWeight: '700' }}>{medal(e.rank)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontWeight: e.isYou ? '800' : '600' }}>{e.isYou ? `${e.name} (you)` : e.name}</Text>
                  <Small>{e.tier}</Small>
                </View>
                <Text style={{ color: t.ink, fontWeight: '600' }}>{e.scoreLabel}</Text>
              </Row>
            ))
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
}
