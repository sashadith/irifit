import { toIsoDate } from '@/features/diary/useDiaryDay';
import { supabase } from '@/lib/supabase';

import { computeStreak } from './streakCore';

export { computeStreak } from './streakCore';

/**
 * Streak aus der Log-Historie neu berechnen und im Profil persistieren.
 * Liefert true, wenn sich etwas geändert hat (→ Profil neu laden).
 */
export async function updateStreak(
  userId: string,
): Promise<{ changed: boolean; streak: number }> {
  const since = new Date();
  since.setDate(since.getDate() - 400);
  const { data, error } = await supabase
    .from('food_logs')
    .select('logged_on')
    .eq('user_id', userId)
    .gte('logged_on', toIsoDate(since));
  if (error) return { changed: false, streak: 0 };

  const days = new Set((data ?? []).map((r) => r.logged_on as string));
  const { streak, lastJokerUsedOn } = computeStreak(days);

  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_count, streak_longest')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return { changed: false, streak };

  const longest = Math.max(profile.streak_longest ?? 0, streak);
  if (profile.streak_count === streak && profile.streak_longest === longest) return { changed: false, streak };

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      streak_count: streak,
      streak_longest: longest,
      streak_joker_used_on: lastJokerUsedOn,
    })
    .eq('id', userId);
  return { changed: !updateError, streak };
}
