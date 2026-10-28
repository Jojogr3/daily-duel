import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Body, Button, Card, ErrorBox, Loading, Row, Screen, Small, Title } from '../src/components/ui';
import { config } from '../src/config';
import { buyPlan, getPlans, purchasesAvailable, restorePurchases, type Plan } from '../src/services/purchases';
import { useApp } from '../src/state/AppContext';
import { space, useTheme } from '../src/theme';

const PERKS = [
  ['🧩', 'Every puzzle mode, every day'],
  ['🚫', 'No ads'],
  ['📚', 'The full puzzle archive'],
  ['♾️', 'Unlimited practice'],
  ['❄️', '2 streak freezes a month'],
  ['📈', 'Lifetime stats'],
] as const;

export default function Paywall() {
  const t = useTheme();
  const { refreshSubscription, subscribed } = useApp();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlans()
      .then((p) => {
        setPlans(p);
        setSelected(p.find((x) => x.period === 'annual')?.id ?? p[0]?.id ?? null);
      })
      .catch(() => setError('Plans are unavailable right now. Please try again later.'));
  }, []);

  const buy = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      if (await buyPlan(selected)) {
        await refreshSubscription();
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The purchase did not go through.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const ok = await restorePurchases();
      await refreshSubscription();
      if (ok) router.back();
      else setError('No previous purchase found for this account.');
    } finally {
      setBusy(false);
    }
  };

  if (subscribed) {
    return (
      <Screen>
        <Title>You're on Daily Duel+ 🎉</Title>
        <Body muted>Thanks for supporting the game. Manage or cancel any time in your App Store or Google Play subscriptions.</Body>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Daily Duel+</Title>
      <View style={{ gap: space(1) }}>
        {PERKS.map(([icon, text]) => (
          <Row key={text}>
            <Text style={{ fontSize: 20, width: 32 }}>{icon}</Text>
            <Body>{text}</Body>
          </Row>
        ))}
      </View>

      {error ? <ErrorBox message={error} /> : null}
      {!plans && !error ? <Loading /> : null}

      {plans?.map((p) => (
        <Card key={p.id} accent={p.id === selected ? t.you : undefined} onPress={() => setSelected(p.id)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ fontWeight: '800' }}>{p.title}</Body>
            <Body style={{ fontWeight: '800' }}>
              {p.price}
              <Text style={{ color: t.muted, fontWeight: '400' }}>{p.period === 'annual' ? ' / year' : p.period === 'monthly' ? ' / month' : ''}</Text>
            </Body>
          </Row>
          {p.trial ? <Small>{p.trial}, then {p.price}</Small> : null}
        </Card>
      ))}

      <Button label={plans?.find((p) => p.id === selected)?.trial ? 'Start free trial' : 'Subscribe'} onPress={buy} loading={busy} disabled={!selected} />
      {!purchasesAvailable() ? <Small style={{ textAlign: 'center' }}>Test mode: purchases are simulated until store billing is set up.</Small> : null}

      <Small style={{ textAlign: 'center' }}>
        Subscriptions renew automatically until cancelled. Cancel any time at least 24 hours before renewal in your store account settings.
      </Small>
      <Row style={{ justifyContent: 'center', gap: space(3) }}>
        <Pressable onPress={restore}>
          <Text style={{ color: t.ink, fontWeight: '600' }}>Restore</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(config.termsUrl)}>
          <Text style={{ color: t.ink, fontWeight: '600' }}>Terms</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(config.privacyUrl)}>
          <Text style={{ color: t.ink, fontWeight: '600' }}>Privacy</Text>
        </Pressable>
      </Row>
    </Screen>
  );
}
