/**
 * Daily Duel+ subscription via RevenueCat. Without a RevenueCat key (web, Expo Go,
 * or before setup) this falls back to a local "dev unlock" switch for testing.
 */
import { config, PLUS_ENTITLEMENT } from '../config';
import { getJSON, setJSON } from './storage';

export interface Plan {
  id: string;
  title: string;
  price: string;
  period: 'monthly' | 'annual' | 'other';
  trial: string | null;
}

type PurchasesModule = typeof import('react-native-purchases').default;
let Purchases: PurchasesModule | null = null;
const DEV_KEY = 'dd.dev-plus.v1';

export function purchasesAvailable(): boolean {
  return Purchases !== null;
}

export async function initPurchases(appUserId: string): Promise<void> {
  if (!config.revenueCatKey) return;
  try {
    const mod = require('react-native-purchases') as { default: PurchasesModule };
    mod.default.configure({ apiKey: config.revenueCatKey, appUserID: appUserId });
    Purchases = mod.default;
  } catch {
    Purchases = null; // native module missing (e.g. Expo Go)
  }
}

export async function isSubscribed(): Promise<boolean> {
  if (!Purchases) return getJSON<boolean>(DEV_KEY, false);
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[PLUS_ENTITLEMENT] !== undefined;
  } catch {
    return false;
  }
}

export function onSubscriptionChange(cb: (subscribed: boolean) => void): () => void {
  if (!Purchases) return () => {};
  const listener = (info: { entitlements: { active: Record<string, unknown> } }) =>
    cb(info.entitlements.active[PLUS_ENTITLEMENT] !== undefined);
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases?.removeCustomerInfoUpdateListener(listener);
}

export async function getPlans(): Promise<Plan[]> {
  if (!Purchases) {
    return [
      { id: 'dev-annual', title: 'Annual', price: '$19.99', period: 'annual', trial: '7-day free trial' },
      { id: 'dev-monthly', title: 'Monthly', price: '$2.99', period: 'monthly', trial: '7-day free trial' },
    ];
  }
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return pkgs.map((p) => {
    const intro = p.product.introPrice;
    // packageType is a string enum; compare its string value.
    const kind = String(p.packageType);
    return {
      id: p.identifier,
      title: kind === 'ANNUAL' ? 'Annual' : kind === 'MONTHLY' ? 'Monthly' : p.product.title,
      price: p.product.priceString,
      period: kind === 'ANNUAL' ? 'annual' : kind === 'MONTHLY' ? 'monthly' : 'other',
      trial: intro && intro.price === 0 ? `${intro.periodNumberOfUnits}-${intro.periodUnit.toLowerCase()} free trial` : null,
    };
  });
}

/** Returns true when the purchase unlocked Daily Duel+. False if the player cancelled. */
export async function buyPlan(planId: string): Promise<boolean> {
  if (!Purchases) {
    await setJSON(DEV_KEY, true);
    return true;
  }
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages.find((p) => p.identifier === planId);
  if (!pkg) throw new Error('That plan is not available right now.');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[PLUS_ENTITLEMENT] !== undefined;
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!Purchases) return getJSON<boolean>(DEV_KEY, false);
  const info = await Purchases.restorePurchases();
  return info.entitlements.active[PLUS_ENTITLEMENT] !== undefined;
}

/** Testing only: clears the dev unlock when RevenueCat isn't configured. */
export async function resetDevUnlock(): Promise<void> {
  await setJSON(DEV_KEY, false);
}
