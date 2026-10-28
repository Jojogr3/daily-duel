import type { ExpoConfig } from 'expo/config';

// Google's public test app IDs. Replace with your AdMob app IDs via env vars before release.
const ADMOB_TEST_ANDROID = 'ca-app-pub-3940256099942544~3347511713';
const ADMOB_TEST_IOS = 'ca-app-pub-3940256099942544~1458002511';

const config: ExpoConfig = {
  name: 'Daily Duel',
  slug: 'daily-duel',
  owner: process.env.EXPO_OWNER || undefined,
  version: '0.1.0',
  scheme: 'dailyduel',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: 'com.worldrunnergames.dailyduel',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.worldrunnergames.dailyduel',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FBF7F0',
    },
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    output: 'single',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    [
      'expo-splash-screen',
      { image: './assets/splash.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: '#FBF7F0' },
    ],
    ['expo-notifications', { color: '#FF5A4E' }],
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: process.env.ADMOB_ANDROID_APP_ID || ADMOB_TEST_ANDROID,
        iosAppId: process.env.ADMOB_IOS_APP_ID || ADMOB_TEST_IOS,
      },
    ],
  ],
  // Over-the-air updates: JavaScript-only fixes ship in minutes without a store review.
  runtimeVersion: { policy: 'appVersion' },
  updates: process.env.EAS_PROJECT_ID ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` } : undefined,
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID || undefined,
    },
  },
};

export default config;
