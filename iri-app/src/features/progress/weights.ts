import { toIsoDate } from '@/features/diary/useDiaryDay';
import { supabase } from '@/lib/supabase';

export interface WeightEntry {
  measured_on: string;
  weight_kg: number;
}

export async function fetchWeights(userId: string): Promise<WeightEntry[]> {
  const { data, error } = await supabase
    .from('weights')
    .select('measured_on, weight_kg')
    .eq('user_id', userId)
    .order('measured_on', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WeightEntry[];
}

/** Heutiges Gewicht eintragen (1 Eintrag pro Tag — Upsert) */
export async function addWeightToday(userId: string, weightKg: number): Promise<void> {
  const { error } = await supabase.from('weights').upsert(
    { user_id: userId, measured_on: toIsoDate(new Date()), weight_kg: weightKg },
    { onConflict: 'user_id,measured_on' },
  );
  if (error) throw error;
}
