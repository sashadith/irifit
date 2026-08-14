import { MealSlot, toIsoDate } from '@/features/diary/useDiaryDay';
import { supabase } from '@/lib/supabase';

import { FoodItem, nutrientsForAmount } from './off';

export type FoodSource = 'barcode' | 'search' | 'favorite' | 'manual';

/**
 * Tag, auf den ein Eintrag gebucht wird. IMMER mitschicken: die Spalte
 * logged_on hat als Vorgabe current_date — also das SERVER-Datum in UTC. Wer
 * abends um 23:30 in Deutschland trackt, landete damit schon auf dem naechsten
 * Tag (aufgefallen 14.08. im Simulator, dessen Datum dem Mac hinterherhing).
 */
export const todayIso = (): string => toIsoDate(new Date());

/** Lebensmittel mit Menge in den gewählten Slot eintragen */
export async function logFood(
  userId: string,
  item: FoodItem,
  grams: number,
  slot: MealSlot,
  source: FoodSource,
  loggedOn: string = todayIso(),
): Promise<void> {
  const nutrients = nutrientsForAmount(item, grams);
  const { error } = await supabase.from('food_logs').insert({
    user_id: userId,
    logged_on: loggedOn,
    slot,
    source,
    title: item.brand ? `${item.name} (${item.brand})` : item.name,
    ...nutrients,
    details: { food: item, grams },
  });
  if (error) throw error;
}

export interface RecentEntry {
  title: string;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  slot: MealSlot;
  /** Original-FoodItem, falls der Eintrag aus Barcode/Suche stammt */
  food?: FoodItem;
  grams?: number;
  /** Wann zuletzt gegessen (ISO) — für die Datumsanzeige in „Nochmal essen" */
  loggedAt?: string;
}

/** „Nochmal essen": letzte Einträge, nach Titel dedupliziert */
export async function fetchRecentEntries(userId: string): Promise<RecentEntry[]> {
  const { data, error } = await supabase
    .from('food_logs')
    .select('title, kcal, protein_g, carbs_g, fat_g, slot, details, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;

  const seen = new Set<string>();
  const recents: RecentEntry[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.title)) continue;
    seen.add(row.title);
    const details = row.details as { food?: FoodItem; grams?: number } | null;
    recents.push({
      title: row.title,
      kcal: row.kcal,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
      slot: row.slot as MealSlot,
      food: details?.food,
      grams: details?.grams,
      loggedAt: row.created_at,
    });
    if (recents.length >= 12) break;
  }
  return recents;
}

export interface SlotMealDay {
  /** Tagesschlüssel aus food_logs.logged_on */
  loggedOn: string;
  entries: RecentEntry[];
  kcal: number;
}

/**
 * „Frühstück wie gestern" (Sascha 14.08., angestossen von Stephanies Feedback:
 * Yazio hat genau diese Funktion beim letzten Update verloren).
 *
 * Liefert die letzten Tage, an denen in DIESEM Slot etwas stand — heute
 * ausgenommen. Tage mit identischer Zusammenstellung werden übersprungen,
 * sonst stuenden „wie gestern" und „wie vorgestern" mit derselben Liste
 * untereinander.
 */
export async function fetchSlotHistory(
  userId: string,
  slot: MealSlot,
  maxDays = 3,
): Promise<SlotMealDay[]> {
  const today = todayIso();
  const { data, error } = await supabase
    .from('food_logs')
    .select('logged_on, title, kcal, protein_g, carbs_g, fat_g, slot, details, created_at')
    .eq('user_id', userId)
    .eq('slot', slot)
    .lt('logged_on', today)
    .order('logged_on', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(80);
  if (error) throw error;

  const byDay = new Map<string, RecentEntry[]>();
  for (const row of data ?? []) {
    const details = row.details as { food?: FoodItem; grams?: number } | null;
    const list = byDay.get(row.logged_on) ?? [];
    list.push({
      title: row.title,
      kcal: row.kcal,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
      slot: row.slot as MealSlot,
      food: details?.food,
      grams: details?.grams,
      loggedAt: row.created_at,
    });
    byDay.set(row.logged_on, list);
  }

  const days: SlotMealDay[] = [];
  const seenCombos = new Set<string>();
  for (const [loggedOn, entries] of byDay) {
    const combo = entries
      .map((e) => `${e.title}|${e.grams ?? ''}`)
      .sort()
      .join('#');
    if (seenCombos.has(combo)) continue;
    seenCombos.add(combo);
    days.push({ loggedOn, entries, kcal: entries.reduce((sum, e) => sum + e.kcal, 0) });
    if (days.length >= maxDays) break;
  }
  return days;
}

/** Mehrere frühere Einträge auf einmal in den heutigen Slot übernehmen */
export async function copyEntriesToSlot(
  userId: string,
  entries: readonly RecentEntry[],
  slot: MealSlot,
  loggedOn: string = todayIso(),
): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await supabase.from('food_logs').insert(
    entries.map((entry) => ({
      user_id: userId,
      logged_on: loggedOn,
      slot,
      source: 'manual' as FoodSource,
      title: entry.title,
      kcal: entry.kcal,
      protein_g: entry.protein_g,
      carbs_g: entry.carbs_g,
      fat_g: entry.fat_g,
      details: entry.food ? { food: entry.food, grams: entry.grams, relog: true } : { relog: true },
    })),
  );
  if (error) throw error;
}

/** Früheren Eintrag 1:1 erneut loggen */
export async function relogEntry(
  userId: string,
  entry: RecentEntry,
  slot: MealSlot,
  loggedOn: string = todayIso(),
): Promise<void> {
  const { error } = await supabase.from('food_logs').insert({
    user_id: userId,
    logged_on: loggedOn,
    slot,
    source: 'manual',
    title: entry.title,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    details: entry.food ? { food: entry.food, grams: entry.grams, relog: true } : { relog: true },
  });
  if (error) throw error;
}

export interface FoodFavorite {
  id: string;
  item: FoodItem;
}

export async function fetchFoodFavorites(userId: string): Promise<FoodFavorite[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('id, food_item')
    .eq('user_id', userId)
    .eq('kind', 'food')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.food_item)
    .map((row) => ({ id: row.id, item: row.food_item as FoodItem }));
}

/** Favoriten-Identität: Barcode, sonst Name+Marke */
export function foodKey(item: FoodItem): string {
  return item.barcode ?? `${item.name}|${item.brand ?? ''}`;
}

export async function addFoodFavorite(userId: string, item: FoodItem): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, kind: 'food', food_item: item });
  if (error) throw error;
}

export async function removeFoodFavorite(favoriteId: string): Promise<void> {
  const { error } = await supabase.from('favorites').delete().eq('id', favoriteId);
  if (error) throw error;
}
