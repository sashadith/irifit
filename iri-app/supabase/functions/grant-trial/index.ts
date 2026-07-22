// IRI — Beta-Trial anlegen (Session 8 Fix, abgelöst durch RevenueCat in S11).
// Die Paywall (Beta-Stub) ruft diese Function beim „3 Tage gratis starten"-Tap.
// subscriptions ist per RLS clientseitig nicht beschreibbar — nur die Service
// Role (hier bzw. später der RevenueCat-Webhook) darf das.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }

  // Beta: 30 Tage, damit Testerinnen nicht nach 3 Tagen aussperren.
  // Bestehende Abos nicht überschreiben (idempotent).
  const { data: existing } = await admin
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!existing || existing.status === 'expired') {
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);
    const { error } = await admin.from('subscriptions').upsert({
      user_id: userData.user.id,
      status: 'trialing',
      product_id: 'beta-trial',
      current_period_end: periodEnd.toISOString(),
      will_renew: false,
    });
    if (error) {
      return new Response(JSON.stringify({ error: 'grant_failed' }), { status: 500, headers: CORS });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
