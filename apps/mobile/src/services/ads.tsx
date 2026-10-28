/**
 * AdMob ads via react-native-google-mobile-ads. Where the native module isn't
 * available (web, Expo Go) every call quietly does nothing.
 *
 * Rules (from the design doc): no ad ever interrupts a puzzle; no interstitial
 * before a player's first few duels; Daily Duel+ players see no ads.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ADS_AFTER_DUELS, config } from '../config';
import { getJSON, KEYS, setJSON } from './storage';

type AdsModule = typeof import('react-native-google-mobile-ads');
let Ads: AdsModule | null = null;
let ready = false;

function load(): AdsModule | null {
  if (Ads) return Ads;
  try {
    Ads = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    Ads = null;
  }
  return Ads;
}

/** Ask for consent where the law requires it (EEA/UK via Google's UMP), then start the SDK. */
export async function initAds(): Promise<void> {
  const mod = load();
  if (!mod || ready) return;
  try {
    await mod.AdsConsent.gatherConsent();
  } catch {
    // Consent form failed to load; the SDK still serves non-personalised ads only where allowed.
  }
  try {
    await mod.default().initialize();
    ready = true;
  } catch {
    ready = false;
  }
}

function unit(kind: 'banner' | 'interstitial' | 'rewarded'): string | null {
  const mod = load();
  if (!mod) return null;
  const configured = config.ads[kind];
  if (configured) return configured;
  return kind === 'banner' ? mod.TestIds.BANNER : kind === 'interstitial' ? mod.TestIds.INTERSTITIAL : mod.TestIds.REWARDED;
}

/** Counts finished duels so interstitials wait until the player is settled in. */
export async function noteDuelCompleted(): Promise<number> {
  const n = (await getJSON<number>(KEYS.duelsCompleted, 0)) + 1;
  await setJSON(KEYS.duelsCompleted, n);
  return n;
}

/** Shows an interstitial after a duel for free players. Resolves once it closes (or immediately if none). */
export async function maybeShowInterstitial(subscribed: boolean): Promise<void> {
  const mod = load();
  const id = unit('interstitial');
  if (!mod || !ready || !id || subscribed) return;
  if ((await getJSON<number>(KEYS.duelsCompleted, 0)) <= ADS_AFTER_DUELS) return;
  await new Promise<void>((resolve) => {
    const ad = mod.InterstitialAd.createForAdRequest(id);
    const offs: Array<() => void> = [];
    const done = () => {
      offs.forEach((off) => off());
      resolve();
    };
    offs.push(ad.addAdEventListener(mod.AdEventType.LOADED, () => ad.show().catch(done)));
    offs.push(ad.addAdEventListener(mod.AdEventType.CLOSED, done));
    offs.push(ad.addAdEventListener(mod.AdEventType.ERROR, done));
    ad.load();
    setTimeout(done, 8_000); // never block the player on a slow ad
  });
}

/** Shows a rewarded ad. Resolves true only if the player earned the reward. */
export async function showRewarded(): Promise<boolean> {
  const mod = load();
  const id = unit('rewarded');
  if (!mod || !ready || !id) return false;
  return new Promise<boolean>((resolve) => {
    const ad = mod.RewardedAd.createForAdRequest(id);
    let earned = false;
    const offs: Array<() => void> = [];
    const done = () => {
      offs.forEach((off) => off());
      resolve(earned);
    };
    offs.push(ad.addAdEventListener(mod.RewardedAdEventType.LOADED, () => ad.show().catch(done)));
    offs.push(ad.addAdEventListener(mod.RewardedAdEventType.EARNED_REWARD, () => (earned = true)));
    offs.push(ad.addAdEventListener(mod.AdEventType.CLOSED, done));
    offs.push(ad.addAdEventListener(mod.AdEventType.ERROR, done));
    ad.load();
  });
}

export function adsAvailable(): boolean {
  return load() !== null;
}

/** Banner for result screens. Renders nothing for subscribers or where ads aren't available. */
export function AdBanner({ hidden }: { hidden: boolean }) {
  const [mod, setMod] = useState<AdsModule | null>(null);
  useEffect(() => setMod(load()), []);
  const id = unit('banner');
  if (hidden || !mod || !id) return null;
  const { BannerAd, BannerAdSize } = mod;
  return (
    <View style={{ alignItems: 'center', marginTop: 12 }}>
      <BannerAd unitId={id} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}
