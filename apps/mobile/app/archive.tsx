import { addDays, ALL_MODES, MODE_NAMES, utcDateKey, type Mode } from '@daily-duel/engine';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Card, H2, Row, Screen, Small } from '../src/components/ui';
import { FREE_PRACTICE_PER_DAY } from '../src/config';
import { useApp } from '../src/state/AppContext';
import { radius, space, useTheme } from '../src/theme';

const ARCHIVE_DAYS = 30;

export default function ArchiveScreen() {
  const t = useTheme();
  const { subscribed } = useApp();
  const [mode, setMode] = useState<Mode>('word-rush');
  const today = utcDateKey();
  const days = Array.from({ length: ARCHIVE_DAYS }, (_, i) => addDays(today, -(i + 1)));

  return (
    <Screen>
      <H2>Practice</H2>
      <Body muted>
        Fresh random boards, unranked. {subscribed ? 'Unlimited with Daily Duel+.' : `${FREE_PRACTICE_PER_DAY} free rounds a day.`}
      </Body>
      <Row>
        {ALL_MODES.map((m) => (
          <Button
            key={m}
            label={MODE_NAMES[m]}
            kind="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/play/[mode]', params: { mode: m, source: 'practice' } })}
          />
        ))}
      </Row>

      <H2 style={{ marginTop: space(2) }}>Archive</H2>
      {!subscribed ? (
        <Card onPress={() => router.push('/paywall')}>
          <Body>Replay every past daily puzzle with Daily Duel+.</Body>
          <Small>Tap to see plans</Small>
        </Card>
      ) : (
        <>
          <Row style={{ backgroundColor: t.surfaceAlt, borderRadius: radius.md, padding: 4 }}>
            {ALL_MODES.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                accessibilityRole="tab"
                accessibilityState={{ selected: m === mode }}
                style={{ flex: 1, paddingVertical: space(1), borderRadius: radius.sm, backgroundColor: m === mode ? t.surface : 'transparent', alignItems: 'center' }}
              >
                <Text style={{ color: t.ink, fontWeight: m === mode ? '800' : '500' }}>{MODE_NAMES[m]}</Text>
              </Pressable>
            ))}
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
            {days.map((d) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/play/[mode]', params: { mode, date: d, source: 'archive' } })}
                style={{ width: '31%', backgroundColor: t.surface, borderRadius: radius.md, padding: space(1.25), borderWidth: 1, borderColor: t.line }}
              >
                <Text style={{ color: t.ink, fontWeight: '700' }}>{d.slice(5)}</Text>
                <Small>{d.slice(0, 4)}</Small>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
