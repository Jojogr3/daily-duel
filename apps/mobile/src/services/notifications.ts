/**
 * Daily reminders, scheduled on the device (no server needed).
 * We schedule one-off reminders for the next week at the player's chosen time
 * and skip today's once they've played, so nobody is nagged after playing.
 * Rescheduled every time the app opens and after each duel.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Settings } from './storage';

const DAYS_AHEAD = 7;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function message(streak: number): { title: string; body: string } {
  if (streak >= 2) {
    return { title: `Keep your ${streak}-day streak alive 🔥`, body: "Today's rival is waiting. One minute is all it takes." };
  }
  return { title: "Today's duel is ready ⚔️", body: 'A new puzzle and a new rival. Can you win?' };
}

export async function scheduleReminders(settings: Settings, playedToday: boolean, streak: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.remindersOn) return;
  const granted = (await Notifications.getPermissionsAsync()).granted;
  if (!granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily', {
      name: 'Daily reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const now = new Date();
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const at = new Date(now);
    at.setDate(now.getDate() + d);
    at.setHours(settings.reminderHour, settings.reminderMinute, 0, 0);
    if (at <= now) continue;
    if (d === 0 && playedToday) continue;
    // Future days: the streak will be one longer if they play today, so keep the copy generic-but-warm.
    const { title, body } = message(d === 0 ? streak : 0);
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'daily' },
    });
  }
}
