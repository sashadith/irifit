import { supabase } from '@/lib/supabase';

/**
 * Abo-Zustand fuer die Anzeige im Profil (Sascha 20.08.).
 *
 * Warum ueberhaupt: Wer nicht weiss, wann und wieviel abgebucht wird, kuendigt
 * vorsichtshalber — und fragt vorher bei Irina nach. Beides kostet mehr als
 * diese Zeile. Besonders die Gutschein-Kundinnen muessen das Ende ihres
 * Gratismonats sehen, sonst fuehlt sich der erste Abbuchungsversuch wie eine
 * Ueberraschung an.
 *
 * Gelesen wird die EIGENE Zeile (Policy subscriptions_select_own). Geschrieben
 * wird hier nichts — subscriptions gehoert dem Webhook.
 */

export type SubKind = 'yearly' | 'monthly' | 'voucher' | 'other';

export interface SubStatus {
  /** Roher Status aus der Datenbank */
  status: 'trialing' | 'active' | 'in_grace' | 'paused' | 'cancelled' | 'expired';
  kind: SubKind;
  /** Ende der laufenden Periode; null = unbefristet (kommt bei Alt-Zeilen vor) */
  endsAt: Date | null;
  /** false = gekuendigt bzw. laeuft aus, Zugang bleibt bis endsAt */
  willRenew: boolean;
  /** Gilt der Zugang gerade? Spiegelt public.is_subscriber() */
  active: boolean;
}

function kindOf(productId: string | null): SubKind {
  if (productId === 'irifit_yearly') return 'yearly';
  if (productId === 'irifit_monthly') return 'monthly';
  if (productId === 'voucher') return 'voucher';
  return 'other';
}

/** null = diese Nutzerin hatte noch nie ein Abo (frische Konten ohne Zeile) */
export async function loadSubStatus(userId: string): Promise<SubStatus | null> {
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('status, product_id, current_period_end, will_renew')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return null;

    const endsAt = data.current_period_end ? new Date(data.current_period_end) : null;
    const statusOk = ['trialing', 'active', 'in_grace'].includes(data.status);
    return {
      status: data.status,
      kind: kindOf(data.product_id),
      endsAt,
      willRenew: data.will_renew !== false,
      active: statusOk && (endsAt == null || endsAt > new Date()),
    };
  } catch {
    return null;
  }
}
