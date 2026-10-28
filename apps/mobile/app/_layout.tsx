import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Body, Button, Loading } from '../src/components/ui';
import { AppProvider, useApp } from '../src/state/AppContext';
import { space, useTheme } from '../src/theme';
import { View } from 'react-native';

function Gate() {
  const { ready, error, retry } = useApp();
  const t = useTheme();
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: space(3), gap: space(2), backgroundColor: t.bg }}>
        <Body>Couldn't connect: {error}</Body>
        <Button label="Try again" onPress={retry} />
      </View>
    );
  }
  if (!ready) return <Loading label="Getting today's duel ready…" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.ink,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: t.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Daily Duel' }} />
      <Stack.Screen name="duel/[mode]" options={{ title: '', gestureEnabled: false }} />
      <Stack.Screen name="play/[mode]" options={{ title: '' }} />
      <Stack.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="archive" options={{ title: 'Archive' }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal', title: 'Daily Duel+' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="p/[mode]/[date]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="auto" />
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
