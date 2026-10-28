/** Three quick cards, a name, and an optional reminder. Skippable at every step. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Body, Button, Screen, Small, Title } from '../src/components/ui';
import { ensurePermission } from '../src/services/notifications';
import { KEYS, setJSON } from '../src/services/storage';
import { useApp } from '../src/state/AppContext';
import { space, useTheme } from '../src/theme';

const CARDS = [
  { emoji: '🧩', title: 'One puzzle a day', body: 'Everyone in the world gets the same puzzle. It takes about a minute.' },
  { emoji: '⚔️', title: 'Beat your rival', body: "You're matched with a player near your rank who already played it. Their score stays hidden until you finish." },
  { emoji: '🔥', title: 'Keep the streak', body: 'Play every day to grow your streak, climb the tiers and share your wins.' },
];

export default function Onboarding() {
  const t = useTheme();
  const { backend, refreshProfile, updateSettings } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');

  const done = async () => {
    await setJSON(KEYS.onboarded, true);
    router.replace('/');
  };

  if (step < CARDS.length) {
    const c = CARDS[step]!;
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space(2) }}>
          <Text style={{ fontSize: 80 }}>{c.emoji}</Text>
          <Title style={{ textAlign: 'center' }}>{c.title}</Title>
          <Body muted style={{ textAlign: 'center' }}>
            {c.body}
          </Body>
        </View>
        <Button label="Next" onPress={() => setStep(step + 1)} />
        <Button label="Skip" kind="ghost" onPress={() => setStep(CARDS.length)} />
      </Screen>
    );
  }

  if (step === CARDS.length) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: space(2) }}>
          <Title>What should rivals call you?</Title>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={20}
            autoFocus
            placeholder="Display name"
            placeholderTextColor={t.muted}
            style={{ fontSize: 22, color: t.ink, borderBottomWidth: 2, borderColor: t.you, paddingVertical: space(1) }}
          />
          <Small>Shown on leaderboards. You can change it later.</Small>
        </View>
        <Button
          label="Continue"
          disabled={name.trim().length === 0}
          onPress={async () => {
            await backend.setName(name).catch(() => {});
            await refreshProfile();
            setStep(step + 1);
          }}
        />
        <Button label="Skip" kind="ghost" onPress={() => setStep(step + 1)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space(2) }}>
        <Text style={{ fontSize: 80 }}>⏰</Text>
        <Title style={{ textAlign: 'center' }}>Want a daily nudge?</Title>
        <Body muted style={{ textAlign: 'center' }}>
          One reminder in the evening, only if you haven't played yet. Change the time in Settings.
        </Body>
      </View>
      <Button
        label="Remind me"
        onPress={async () => {
          const ok = await ensurePermission();
          await updateSettings({ remindersOn: ok });
          await done();
        }}
      />
      <Button
        label="Not now"
        kind="ghost"
        onPress={async () => {
          await updateSettings({ remindersOn: false });
          await done();
        }}
      />
    </Screen>
  );
}
