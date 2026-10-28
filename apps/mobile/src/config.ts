/**
 * Runtime configuration from EXPO_PUBLIC_* environment variables.
 * These must be read with the full `process.env.EXPO_PUBLIC_...` name so Expo can inline them.
 * See apps/mobile/.env.example. With no Firebase keys set, the app runs on a local,
 * offline backend so it can be played and tested before any accounts exist.
 */
import { Platform } from 'react-native';

export const config = {
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
    functionsRegion: process.env.EXPO_PUBLIC_FIREBASE_REGION ?? 'us-central1',
  },
  revenueCatKey:
    Platform.OS === 'ios'
      ? (process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '')
      : Platform.OS === 'android'
        ? (process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '')
        : '',
  ads: {
    // Empty strings fall back to Google's test ad units (see services/ads.ts).
    banner: Platform.OS === 'ios' ? (process.env.EXPO_PUBLIC_AD_BANNER_IOS ?? '') : (process.env.EXPO_PUBLIC_AD_BANNER_ANDROID ?? ''),
    interstitial:
      Platform.OS === 'ios' ? (process.env.EXPO_PUBLIC_AD_INTERSTITIAL_IOS ?? '') : (process.env.EXPO_PUBLIC_AD_INTERSTITIAL_ANDROID ?? ''),
    rewarded: Platform.OS === 'ios' ? (process.env.EXPO_PUBLIC_AD_REWARDED_IOS ?? '') : (process.env.EXPO_PUBLIC_AD_REWARDED_ANDROID ?? ''),
  },
  linkBase: process.env.EXPO_PUBLIC_LINK_BASE ?? 'https://dailyduel.app',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://dailyduel.app/privacy',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://dailyduel.app/terms',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@dailyduel.app',
};

export const useFirebaseBackend = config.firebase.apiKey.length > 0;

/** RevenueCat entitlement that unlocks Daily Duel+. */
export const PLUS_ENTITLEMENT = 'plus';

/** Free players' practice runs per day. */
export const FREE_PRACTICE_PER_DAY = 3;

/** No interstitial ads before a player's first few duels. */
export const ADS_AFTER_DUELS = 3;
