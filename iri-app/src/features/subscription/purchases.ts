import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * RevenueCat-Anbindung (Session 11) — bewusst LAZY:
 * Expo Go enthält das native Modul nicht, deshalb wird react-native-purchases
 * nie beim App-Start importiert, sondern erst hier per require(), und nur
 * außerhalb von Expo Go. In Expo Go zeigt die Paywall statische Preise.
 *
 * Entitlement-Identifier ist exakt 'pro' (NICHT die Wizard-Altlast „IriFit pro").
 */

const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
// iOS folgt nach der Apple-Freischaltung (S17): EXPO_PUBLIC_REVENUECAT_IOS_KEY
const IOS_KEY: string | undefined = undefined;

export const ENTITLEMENT_ID = 'pro';

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export interface PlanOffer {
  identifier: string;
  /** Lokalisierter Store-Preis, z. B. "6,99 €" */
  priceString: string;
  hasFreeTrial: boolean;
}

export interface Offers {
  monthly: PlanOffer | null;
  yearly: PlanOffer | null;
}

// Typ nur fürs Nötigste — das echte Modul wird lazy geladen
interface RcPackage {
  identifier: string;
  product: {
    priceString: string;
    defaultOption?: { freePhase?: unknown } | null;
    introPrice?: unknown | null;
  };
}

let configured = false;

async function getPurchases() {
  if (isExpoGo) return null;
  const apiKey = Platform.OS === 'android' ? ANDROID_KEY : IOS_KEY;
  if (!apiKey) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Purchases = require('react-native-purchases').default;
  if (!configured) {
    const { data } = await supabase.auth.getUser();
    // appUserID = Supabase-UUID → der Webhook kann Events direkt zuordnen
    Purchases.configure({ apiKey, appUserID: data.user?.id });
    configured = true;
  }
  return Purchases;
}

function toPlanOffer(pkg: RcPackage | null | undefined): PlanOffer | null {
  if (!pkg) return null;
  return {
    identifier: pkg.identifier,
    priceString: pkg.product.priceString,
    hasFreeTrial: pkg.product.defaultOption?.freePhase != null || pkg.product.introPrice != null,
  };
}

/** default-Offering laden; null = kein Store verfügbar (Expo Go / iOS vorerst) */
export async function fetchOffers(): Promise<Offers | null> {
  const Purchases = await getPurchases();
  if (!Purchases) return null;
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return {
    monthly: toPlanOffer(current.monthly),
    yearly: toPlanOffer(current.annual),
  };
}

export type PurchaseOutcome = 'success' | 'cancelled' | 'failed';

/** Kauf starten; 'success' sobald das pro-Entitlement aktiv ist */
export async function purchasePlan(plan: 'monthly' | 'yearly'): Promise<PurchaseOutcome> {
  const Purchases = await getPurchases();
  if (!Purchases) return 'failed';
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = plan === 'monthly' ? offerings.current?.monthly : offerings.current?.annual;
    if (!pkg) return 'failed';
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[ENTITLEMENT_ID] ? 'success' : 'failed';
  } catch (e) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return 'cancelled';
    return 'failed';
  }
}

/** Käufe wiederherstellen (Gerätewechsel, Neuinstallation) */
export async function restorePurchases(): Promise<boolean> {
  const Purchases = await getPurchases();
  if (!Purchases) return false;
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
  } catch {
    return false;
  }
}

/**
 * Nach Kauf/Restore: kurz warten, bis der RevenueCat-Webhook die
 * subscriptions-Zeile geschrieben hat (RLS-Inhalte hängen daran).
 * Kein harter Blocker — nach dem Timeout geht es trotzdem weiter.
 */
export async function waitForSubscriptionRow(userId: string, timeoutMs = 10000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .in('status', ['trialing', 'active', 'in_grace'])
      .maybeSingle();
    if (data) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

/** Gutschein serverseitig einlösen */
export async function redeemVoucher(code: string): Promise<{ ok: boolean; error?: string; months?: number }> {
  const { data, error } = await supabase.functions.invoke('redeem-voucher', { body: { code } });
  if (data?.ok) return { ok: true, months: data.free_months as number };
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (typeof body?.error === 'string') return { ok: false, error: body.error };
    } catch {
      // Body nicht lesbar
    }
  }
  if (data && typeof data.error === 'string') return { ok: false, error: data.error };
  return { ok: false, error: 'unknown' };
}
