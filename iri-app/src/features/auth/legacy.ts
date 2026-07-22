import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Legacy-Zugang (Session 10): Digistore24-Käuferinnen melden sich per
// E-Mail-Code an; der Claim läuft serverseitig über die claim-legacy-Function.
// ---------------------------------------------------------------------------

export interface LegacyAccess {
  purchased_course_slugs: string[];
}

/** Eigener Legacy-Datensatz (RLS: nur die beanspruchende Nutzerin sieht ihn) */
export async function fetchMyLegacyAccess(userId: string): Promise<LegacyAccess | null> {
  const { data, error } = await supabase
    .from('legacy_customers')
    .select('purchased_course_slugs')
    .eq('claimed_by', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export type ClaimResult = 'claimed' | 'not_found' | 'already_claimed';

/** Login-E-Mail serverseitig mit der Käuferinnen-Liste abgleichen */
export async function claimLegacyAccess(): Promise<ClaimResult> {
  const { data, error } = await supabase.functions.invoke('claim-legacy', { body: {} });
  if (data?.ok) return 'claimed';
  const code = await extractErrorCode(error, data);
  if (code === 'not_found') return 'not_found';
  if (code === 'already_claimed') return 'already_claimed';
  throw new Error(code ?? 'claim_failed');
}

async function extractErrorCode(error: unknown, data: unknown): Promise<string | null> {
  if (data && typeof data === 'object' && 'error' in data) {
    return String((data as { error: unknown }).error);
  }
  // FunctionsHttpError: Antwort-Body steckt im context-Response
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body && typeof body.error === 'string') return body.error;
    } catch {
      // Body nicht lesbar → generischer Fehler
    }
  }
  return null;
}
