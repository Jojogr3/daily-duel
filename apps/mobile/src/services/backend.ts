import { useFirebaseBackend } from '../config';
import { FirebaseBackend } from './firebaseBackend';
import { LocalBackend } from './localBackend';
import type { Backend } from './types';

/** Firebase when its keys are configured, otherwise the offline local backend. */
export function createBackend(): Backend {
  return useFirebaseBackend ? new FirebaseBackend() : new LocalBackend();
}
