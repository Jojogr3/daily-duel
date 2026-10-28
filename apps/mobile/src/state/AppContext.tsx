import { utcDateKey } from '@daily-duel/engine';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { initAds } from '../services/ads';
import { createBackend } from '../services/backend';
import { scheduleReminders } from '../services/notifications';
import { initPurchases, isSubscribed, onSubscriptionChange } from '../services/purchases';
import { getSettings, saveSettings, type Settings, DEFAULT_SETTINGS } from '../services/storage';
import type { Backend, Profile } from '../services/types';

interface AppState {
  ready: boolean;
  error: string | null;
  backend: Backend;
  profile: Profile | null;
  subscribed: boolean;
  settings: Settings;
  refreshProfile(): Promise<Profile | null>;
  refreshSubscription(): Promise<boolean>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  retry(): void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const backendRef = useRef<Backend>(createBackend());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [attempt, setAttempt] = useState(0);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await backendRef.current.getProfile();
      setProfile(p);
      return p;
    } catch {
      return null;
    }
  }, []);

  const refreshSubscription = useCallback(async () => {
    const s = await isSubscribed();
    setSubscribed(s);
    return s;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const backend = backendRef.current;
        await backend.init();
        const [p, s] = await Promise.all([backend.getProfile(), getSettings()]);
        if (cancelled) return;
        setProfile(p);
        setSettings(s);
        await initPurchases(p.uid);
        await refreshSubscription();
        setReady(true);
        // Non-blocking extras.
        initAds().catch(() => {});
        const today = utcDateKey();
        scheduleReminders(s, p.streak.lastPlayed === today, p.streak.current).catch(() => {});
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not start the game.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, refreshSubscription]);

  useEffect(() => onSubscriptionChange(setSubscribed), [ready]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await saveSettings(next);
      const today = utcDateKey();
      await scheduleReminders(next, profile?.streak.lastPlayed === today, profile?.streak.current ?? 0).catch(() => {});
    },
    [settings, profile],
  );

  const value = useMemo<AppState>(
    () => ({
      ready,
      error,
      backend: backendRef.current,
      profile,
      subscribed,
      settings,
      refreshProfile,
      refreshSubscription,
      updateSettings,
      retry: () => setAttempt((n) => n + 1),
    }),
    [ready, error, profile, subscribed, settings, refreshProfile, refreshSubscription, updateSettings],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
