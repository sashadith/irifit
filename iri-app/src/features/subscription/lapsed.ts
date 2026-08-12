import { supabase } from '@/lib/supabase';

/**
 * Abgelaufenes Abo erkennen (Session 24): true NUR, wenn es mal ein Abo gab
 * und es nicht mehr gilt — wer nie eines hatte (frische Beta-Konten ohne
 * Zeile), bekommt keine Verlängerungs-Aufforderung. Spiegelt die Logik von
 * public.is_subscriber() in der Datenbank.
 */
export async function isSubscriptionLapsed(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return false;
    const activeStatus = ['trialing', 'active', 'in_grace'].includes(data.status);
    const dateOk =
      data.current_period_end == null || new Date(data.current_period_end) > new Date();
    return !(activeStatus && dateOk);
  } catch {
    return false;
  }
}
