/** Small typed wrapper around AsyncStorage for JSON values. */
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: settings fall back to defaults next launch.
  }
}

export const KEYS = {
  settings: 'dd.settings.v1',
  practice: 'dd.practice.v1',
  local: 'dd.local-backend.v1',
  onboarded: 'dd.onboarded.v1',
  duelsCompleted: 'dd.duels-completed.v1',
};

export interface Settings {
  reminderHour: number;
  reminderMinute: number;
  remindersOn: boolean;
  sound: boolean;
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  reminderHour: 19,
  reminderMinute: 0,
  remindersOn: true,
  sound: true,
  haptics: true,
};

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await getJSON<Partial<Settings>>(KEYS.settings, {})) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await setJSON(KEYS.settings, s);
}
