import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type LogSource = 'scan' | 'barcode' | 'search' | 'recipe' | 'favorite' | 'manual';

export interface FoodLog {
  id: string;
  logged_on: string;
  slot: MealSlot;
  title: string;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: LogSource;
  created_at: string;
}

/** Lokales Datum als YYYY-MM-DD (bewusst nicht UTC — Tagebuch folgt der Gerätezeit) */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isToday(date: Date): boolean {
  return toIsoDate(date) === toIsoDate(new Date());
}

/** Tagebuch-Daten für einen Tag: Food-Logs, Wasser, Summen, Aktionen */
export function useDiaryDay() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [date, setDate] = useState(() => new Date());
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [loading, setLoading] = useState(true);

  const isoDate = toIsoDate(date);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [logsRes, waterRes] = await Promise.all([
      supabase
        .from('food_logs')
        .select('id, logged_on, slot, title, kcal, protein_g, carbs_g, fat_g, source, created_at')
        .eq('user_id', userId)
        .eq('logged_on', isoDate)
        .order('created_at'),
      supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_id', userId)
        .eq('logged_on', isoDate)
        .maybeSingle(),
    ]);
    if (!logsRes.error) setLogs((logsRes.data as FoodLog[]) ?? []);
    setWaterMl(waterRes.data?.amount_ml ?? 0);
    setLoading(false);
  }, [userId, isoDate]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const setWater = useCallback(
    async (amountMl: number) => {
      if (!userId) return;
      const previous = waterMl;
      setWaterMl(amountMl); // optimistisch
      const { error } = await supabase
        .from('water_logs')
        .upsert(
          { user_id: userId, logged_on: isoDate, amount_ml: amountMl },
          { onConflict: 'user_id,logged_on' },
        );
      if (error) setWaterMl(previous);
    },
    [userId, isoDate, waterMl],
  );

  const deleteLog = useCallback(
    async (id: string) => {
      const previous = logs;
      setLogs((l) => l.filter((x) => x.id !== id)); // optimistisch
      const { error } = await supabase.from('food_logs').delete().eq('id', id);
      if (error) setLogs(previous);
    },
    [logs],
  );

  const shiftDate = useCallback((days: number) => {
    setDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + days);
      // nicht in die Zukunft blättern
      return next > new Date() ? d : next;
    });
  }, []);

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, log) => ({
          kcal: acc.kcal + log.kcal,
          protein: acc.protein + (log.protein_g ?? 0),
          carbs: acc.carbs + (log.carbs_g ?? 0),
          fat: acc.fat + (log.fat_g ?? 0),
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [logs],
  );

  const logsBySlot = useMemo(() => {
    const map: Record<MealSlot, FoodLog[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const log of logs) map[log.slot].push(log);
    return map;
  }, [logs]);

  return {
    date,
    isoDate,
    isToday: isToday(date),
    loading,
    logs,
    logsBySlot,
    totals,
    waterMl,
    setWater,
    deleteLog,
    shiftDate,
    refresh,
  };
}
