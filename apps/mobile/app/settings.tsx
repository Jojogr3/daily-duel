import { router } from 'expo-router';
import { Linking, Pressable, Switch, Text } from 'react-native';
import { Body, Button, Card, H2, Row, Screen, Small } from '../src/components/ui';
import { config } from '../src/config';
import { ensurePermission } from '../src/services/notifications';
import { purchasesAvailable, resetDevUnlock, restorePurchases } from '../src/services/purchases';
import { setJSON, KEYS } from '../src/services/storage';
import { useApp } from '../src/state/AppContext';
import { space, useTheme } from '../src/theme';

function formatTime(h: number, m: number): string {
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export default function SettingsScreen() {
  const t = useTheme();
  const { settings, updateSettings, backend, refreshSubscription, profile } = useApp();

  const toggleReminders = async (on: boolean) => {
    if (on && !(await ensurePermission())) {
      await updateSettings({ remindersOn: false });
      return;
    }
    await updateSettings({ remindersOn: on });
  };

  const shiftTime = (minutes: number) => {
    const total = (settings.reminderHour * 60 + settings.reminderMinute + minutes + 1440) % 1440;
    updateSettings({ reminderHour: Math.floor(total / 60), reminderMinute: total % 60 });
  };

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body>Daily reminder</Body>
          <Switch value={settings.remindersOn} onValueChange={toggleReminders} />
        </Row>
        {settings.remindersOn ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Button label="−30m" kind="secondary" onPress={() => shiftTime(-30)} />
            <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700' }}>{formatTime(settings.reminderHour, settings.reminderMinute)}</Text>
            <Button label="+30m" kind="secondary" onPress={() => shiftTime(30)} />
          </Row>
        ) : null}
        <Small>Only sent if you haven't played yet that day.</Small>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body>Haptics</Body>
          <Switch value={settings.haptics} onValueChange={(v) => updateSettings({ haptics: v })} />
        </Row>
      </Card>

      <Card>
        <H2>Account</H2>
        <Button label="Daily Duel+" kind="secondary" onPress={() => router.push('/paywall')} />
        <Button
          label="Restore purchases"
          kind="secondary"
          onPress={async () => {
            await restorePurchases();
            await refreshSubscription();
          }}
        />
      </Card>

      <Card>
        <H2>Help</H2>
        <Pressable onPress={() => Linking.openURL(`mailto:${config.supportEmail}`)}>
          <Body>Contact support</Body>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(config.privacyUrl)}>
          <Body>Privacy policy</Body>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(config.termsUrl)}>
          <Body>Terms of use</Body>
        </Pressable>
      </Card>

      {backend.kind === 'local' || !purchasesAvailable() ? (
        <Card style={{ borderColor: t.warn }}>
          <H2>Testing tools</H2>
          <Small>
            Shown because the app is running without {backend.kind === 'local' ? 'the live server' : 'store billing'}. Hidden in production builds.
          </Small>
          {!purchasesAvailable() ? (
            <Button
              label="Turn off simulated Daily Duel+"
              kind="secondary"
              onPress={async () => {
                await resetDevUnlock();
                await refreshSubscription();
              }}
            />
          ) : null}
          <Button
            label="Show onboarding again"
            kind="secondary"
            onPress={async () => {
              await setJSON(KEYS.onboarded, false);
              router.replace('/onboarding');
            }}
          />
        </Card>
      ) : null}

      <Small style={{ textAlign: 'center', marginTop: space(2) }} selectable>
        Daily Duel · World Runner Games{'\n'}Player ID: {profile?.uid ?? '—'}
      </Small>
    </Screen>
  );
}
