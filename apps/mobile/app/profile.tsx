import { addDays, ALL_MODES, MODE_NAMES, scoreLine, STREAK_MILESTONES, tierFor, utcDateKey } from '@daily-duel/engine';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Body, Button, Card, H2, Pill, Row, Screen, Small } from '../src/components/ui';
import { useApp } from '../src/state/AppContext';
import { radius, space, useTheme } from '../src/theme';

const CALENDAR_DAYS = 28;

export default function ProfileScreen() {
  const t = useTheme();
  const { backend, profile, refreshProfile } = useApp();
  const [name, setName] = useState(profile?.name ?? '');
  const [saving, setSaving] = useState(false);
  if (!profile) return null;

  const playedDays = new Set(profile.history.map((h) => h.dateKey));
  const today = utcDateKey();
  const days = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(today, i - CALENDAR_DAYS + 1));
  const badges = STREAK_MILESTONES.filter((m) => profile.streak.best >= m);

  const save = async () => {
    setSaving(true);
    try {
      await backend.setName(name);
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Small>Display name</Small>
        <Row>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={20}
            placeholder="Your name"
            placeholderTextColor={t.muted}
            style={{ flex: 1, fontSize: 18, color: t.ink, paddingVertical: space(1), borderBottomWidth: 1, borderColor: t.line }}
          />
          <Button label="Save" kind="secondary" onPress={save} loading={saving} disabled={name.trim() === profile.name} />
        </Row>
      </Card>

      <Card>
        <H2>Streak</H2>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body>🔥 {profile.streak.current} current</Body>
          <Body muted>Best {profile.streak.best}</Body>
          <Body muted>❄️ {profile.streak.freezes}</Body>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space(1) }}>
          {days.map((d) => (
            <View
              key={d}
              accessibilityLabel={`${d}: ${playedDays.has(d) ? 'played' : 'not played'}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.sm,
                backgroundColor: playedDays.has(d) ? t.you : t.surfaceAlt,
                borderWidth: d === today ? 2 : 0,
                borderColor: t.ink,
              }}
            />
          ))}
        </View>
        {badges.length > 0 ? (
          <Row style={{ flexWrap: 'wrap', marginTop: space(1) }}>
            {badges.map((b) => (
              <Pill key={b} label={`🏅 ${b}-day`} color={t.surfaceAlt} />
            ))}
          </Row>
        ) : (
          <Small>First badge at {STREAK_MILESTONES[0]} days.</Small>
        )}
      </Card>

      {ALL_MODES.map((m) => {
        const r = profile.ratings[m];
        const played = profile.duels[m];
        return (
          <Card key={m}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2>{MODE_NAMES[m]}</H2>
              <Pill label={tierFor(r).name} color={t.rivalSoft} />
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body muted>Rating {r}</Body>
              <Body muted>
                {profile.wins[m]}W / {played} played
              </Body>
            </Row>
          </Card>
        );
      })}

      <H2>Recent duels</H2>
      {profile.history.length === 0 ? <Body muted>Your duels will show up here.</Body> : null}
      {profile.history.slice(0, 20).map((h) => (
        <Row key={`${h.mode}-${h.dateKey}`} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
          <View>
            <Text style={{ color: t.ink, fontWeight: '600' }}>
              {h.outcome === 'win' ? '🏆' : h.outcome === 'draw' ? '🤝' : '⚔️'} {MODE_NAMES[h.mode]}
            </Text>
            <Small>
              {h.dateKey} · vs {h.rivalInfo.name}
            </Small>
          </View>
          <Small>{scoreLine(h.you, h.par)}</Small>
        </Row>
      ))}
    </Screen>
  );
}
