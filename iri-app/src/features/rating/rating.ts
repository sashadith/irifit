import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

/**
 * Store-Bewertung (Session 24, Konzept „nur Glücksmomente"): Wir zeigen NUR
 * das native System-Popup (SKStoreReviewController / Play In-App Review) —
 * kein eigenes Vorfilter-Popup, das wäre Review-Gating und ist in beiden
 * Stores verboten. Der „Filter" ist der Auslöse-Moment:
 *   - Streak erreicht 7 Tage (Erfolgs-Sound spielte gerade)
 *   - erstes Mal ≥ 1 kg unter dem Startgewicht
 * Schutzbedingungen: ≥ 5 Nutzungstage, aktives Abo (keine Paywall-Frustrierten),
 * 60 Tage Abstand zwischen Prompts, jeder Anlass nur einmal.
 * iOS deckelt zusätzlich hart bei 3 Prompts pro Jahr.
 *
 * expo-store-review steckt erst ab Build 14 im Binary — weicher Import wie
 * bei HealthKit, damit ältere Clients nicht crashen.
 */
let storeReview: typeof import('expo-store-review') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  storeReview = require('expo-store-review') as typeof import('expo-store-review');
} catch {
  storeReview = null;
}

const KEY_USAGE_DAYS = 'rating.usageDays';
const KEY_LAST_PROMPT = 'rating.lastPromptAt';
const KEY_ASKED_PREFIX = 'rating.asked.';

const MIN_USAGE_DAYS = 5;
const COOLDOWN_DAYS = 60;

/** Bei jedem App-Start aufrufen — zählt eindeutige Nutzungstage (max. 30 gespeichert) */
export async function recordUsageDay(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = await AsyncStorage.getItem(KEY_USAGE_DAYS);
    const days: string[] = raw ? JSON.parse(raw) : [];
    if (!days.includes(today)) {
      days.push(today);
      await AsyncStorage.setItem(KEY_USAGE_DAYS, JSON.stringify(days.slice(-30)));
    }
  } catch {
    // Zählung ist Komfort — nie die App stören
  }
}

async function hasActiveSubscription(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['trialing', 'active', 'in_grace'])
    .maybeSingle();
  if (!data) return false;
  return data.current_period_end == null || new Date(data.current_period_end) > new Date();
}

/**
 * Zeigt das System-Bewertungspopup, wenn alle Bedingungen stimmen.
 * reason: eindeutiger Anlass ('streak7' | 'weightLoss') — feuert nur einmal.
 */
export async function maybeAskForReview(
  reason: 'streak7' | 'weightLoss',
  userId: string,
): Promise<void> {
  try {
    if (!storeReview) return;
    if (!(await storeReview.isAvailableAsync())) return;

    // Anlass schon verbraucht?
    if (await AsyncStorage.getItem(KEY_ASKED_PREFIX + reason)) return;

    // Abkühlphase zwischen Prompts
    const last = await AsyncStorage.getItem(KEY_LAST_PROMPT);
    if (last && Date.now() - Number(last) < COOLDOWN_DAYS * 24 * 3600 * 1000) return;

    // Genug Nutzungstage?
    const raw = await AsyncStorage.getItem(KEY_USAGE_DAYS);
    const days: string[] = raw ? JSON.parse(raw) : [];
    if (days.length < MIN_USAGE_DAYS) return;

    // Nur zahlende/testende Nutzerinnen — Paywall-Frust gehört nicht in den Store
    if (!(await hasActiveSubscription(userId))) return;

    await AsyncStorage.setItem(KEY_ASKED_PREFIX + reason, '1');
    await AsyncStorage.setItem(KEY_LAST_PROMPT, String(Date.now()));
    await storeReview.requestReview();
  } catch {
    // Bewertung ist nice-to-have — niemals einen Fehler nach oben reichen
  }
}
