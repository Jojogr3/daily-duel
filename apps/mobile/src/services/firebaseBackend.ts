/**
 * The real backend: anonymous Firebase Auth plus callable Cloud Functions.
 * All scoring, matchmaking and ratings happen on the server (see /functions).
 */
import type { AnyMoves, AnyPuzzle, Mode } from '@daily-duel/engine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { Platform } from 'react-native';
import { config } from '../config';
import type { Backend, DuelInfo, DuelSummary, Leaderboard, Profile, StartedDuel } from './types';

type Persistence = FirebaseAuth.Persistence;
// getReactNativePersistence only exists in Firebase's React Native build, so it isn't in the web typings.
const getReactNativePersistence = (FirebaseAuth as unknown as { getReactNativePersistence?: (s: typeof AsyncStorage) => Persistence })
  .getReactNativePersistence;

export class FirebaseBackend implements Backend {
  readonly kind = 'firebase' as const;
  private app!: FirebaseApp;
  private functions!: Functions;
  private auth!: FirebaseAuth.Auth;

  async init(): Promise<void> {
    const { apiKey, authDomain, projectId, appId, functionsRegion } = config.firebase;
    this.app = getApps()[0] ?? initializeApp({ apiKey, authDomain, projectId, appId });
    if (Platform.OS === 'web' || !getReactNativePersistence) {
      this.auth = FirebaseAuth.getAuth(this.app);
    } else {
      try {
        this.auth = FirebaseAuth.initializeAuth(this.app, { persistence: getReactNativePersistence(AsyncStorage) });
      } catch {
        this.auth = FirebaseAuth.getAuth(this.app); // already initialised (fast refresh)
      }
    }
    await this.auth.authStateReady();
    if (!this.auth.currentUser) await FirebaseAuth.signInAnonymously(this.auth);
    this.functions = getFunctions(this.app, functionsRegion);
  }

  get uid(): string {
    return this.auth.currentUser?.uid ?? '';
  }

  private async call<Req, Res>(name: string, data: Req): Promise<Res> {
    const fn = httpsCallable<Req, Res>(this.functions, name);
    const res = await fn(data);
    return res.data;
  }

  getProfile(): Promise<Profile> {
    return this.call<Record<string, never>, Profile>('getProfile', {});
  }

  async setName(name: string): Promise<void> {
    await this.call('setName', { name });
  }

  // `subscribed` is ignored here: the server trusts its own subscription record (RevenueCat webhook).
  getDuelInfo(mode: Mode): Promise<DuelInfo> {
    return this.call('getDuelInfo', { mode });
  }

  startDuel(mode: Mode): Promise<StartedDuel> {
    return this.call('startDuel', { mode });
  }

  submitDuel(mode: Mode, moves: AnyMoves): Promise<DuelSummary> {
    return this.call('submitDuel', { mode, moves });
  }

  getLeaderboard(mode: Mode, dateKey: string): Promise<Leaderboard> {
    return this.call('getLeaderboard', { mode, dateKey });
  }

  getPuzzle(mode: Mode, dateKey: string): Promise<AnyPuzzle> {
    return this.call('getPuzzle', { mode, dateKey });
  }
}
