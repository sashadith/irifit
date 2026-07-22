import { toIsoDate } from '@/features/diary/useDiaryDay';
import { supabase } from '@/lib/supabase';

export interface WeekStats {
  loggedDays: number;
  avgKcal: number;
  /** Anteile an den kcal (0..1), aus 4/4/9 kcal pro Gramm */
  proteinShare: number;
  carbsShare: number;
  fatShare: number;
}

/** Wochenstatistik über die letzten 7 Tage (Konzept 5.5: Konsistenz schlägt Perfektion) */
export async function fetchWeekStats(userId: string): Promise<WeekStats | null> {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const { data, error } = await supabase
    .from('food_logs')
    .select('logged_on, kcal, protein_g, carbs_g, fat_g')
    .eq('user_id', userId)
    .gte('logged_on', toIsoDate(start));
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const days = new Set<string>();
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (const row of rows) {
    days.add(row.logged_on);
    kcal += row.kcal;
    protein += row.protein_g ?? 0;
    carbs += row.carbs_g ?? 0;
    fat += row.fat_g ?? 0;
  }

  const macroKcal = protein * 4 + carbs * 4 + fat * 9;
  return {
    loggedDays: days.size,
    avgKcal: Math.round(kcal / days.size),
    proteinShare: macroKcal > 0 ? (protein * 4) / macroKcal : 0,
    carbsShare: macroKcal > 0 ? (carbs * 4) / macroKcal : 0,
    fatShare: macroKcal > 0 ? (fat * 9) / macroKcal : 0,
  };
}
