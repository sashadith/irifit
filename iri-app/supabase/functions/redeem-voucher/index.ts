// IRI — Gutschein einlösen (Session 11).
// Serverseitige Prüfung + Freischaltung: schreibt subscriptions (freie Monate)
// und voucher_redemptions — beides per RLS clientseitig nicht beschreibbar.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user) return json({ error: 'unauthorized' }, 401);

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const code = body.code?.trim();
  if (!code) return json({ error: 'missing_code' }, 400);

  // Gutschein prüfen (citext: Groß-/Kleinschreibung egal)
  const { data: voucher } = await admin
    .from('vouchers')
    .select('id, free_months, active, valid_from, valid_until, max_redemptions, redemption_count')
    .eq('code', code)
    .maybeSingle();
  const now = new Date();
  const invalid =
    !voucher ||
    !voucher.active ||
    (voucher.valid_from && new Date(voucher.valid_from) > now) ||
    (voucher.valid_until && new Date(voucher.valid_until) < now);
  if (invalid) return json({ error: 'invalid_code' }, 404);

  // Bereits eingelöst? (unique voucher_id+user_id fängt Races zusätzlich ab)
  const { data: existing } = await admin
    .from('voucher_redemptions')
    .select('id')
    .eq('voucher_id', voucher.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return json({ error: 'already_redeemed' }, 409);

  // Kontingent atomar reservieren: Zähler nur erhöhen, wenn noch Platz ist
  const { data: reserved } = await admin
    .from('vouchers')
    .update({ redemption_count: voucher.redemption_count + 1 })
    .eq('id', voucher.id)
    .eq('redemption_count', voucher.redemption_count)
    .or(`max_redemptions.is.null,max_redemptions.gt.${voucher.redemption_count}`)
    .select('id')
    .maybeSingle();
  if (!reserved) return json({ error: 'exhausted' }, 410);

  const { error: redemptionError } = await admin
    .from('voucher_redemptions')
    .insert({ voucher_id: voucher.id, user_id: user.id });
  if (redemptionError) return json({ error: 'already_redeemed' }, 409);

  // Freischaltung: freie Monate ab jetzt (bzw. ab bestehendem Periodenende)
  const { data: sub } = await admin
    .from('subscriptions')
    .select('current_period_end, status')
    .eq('user_id', user.id)
    .maybeSingle();
  const base =
    sub?.current_period_end && new Date(sub.current_period_end) > now
      ? new Date(sub.current_period_end)
      : now;
  const end = new Date(base);
  end.setMonth(end.getMonth() + voucher.free_months);

  const { error: subError } = await admin.from('subscriptions').upsert(
    {
      user_id: user.id,
      status: 'active',
      product_id: 'voucher',
      entitlement: 'pro',
      will_renew: false,
      current_period_end: end.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (subError) return json({ error: 'grant_failed' }, 500);

  return json({ ok: true, free_months: voucher.free_months, active_until: end.toISOString() });
});
