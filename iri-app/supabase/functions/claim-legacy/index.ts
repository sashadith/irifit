// IRI — Legacy-Zugang beanspruchen (Session 10).
// Nach dem Magic-Link/OTP-Login gleicht diese Function die Login-E-Mail mit
// legacy_customers ab und setzt claimed_by (nur die Service Role darf das —
// clientseitig ist die Tabelle bewusst nicht beschreibbar).
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
  if (userError || !user?.email) return json({ error: 'unauthorized' }, 401);
  // S11-Sicherheitscheckliste (c): Claim nur mit bestätigter E-Mail — sonst
  // könnte ein fremdes Konto mit unbestätigter Kauf-E-Mail den Zugang kapern
  if (!user.email_confirmed_at) return json({ error: 'email_unconfirmed' }, 403);

  // citext-Spalte matcht case-insensitiv; eq reicht
  const { data: row, error: rowError } = await admin
    .from('legacy_customers')
    .select('id, claimed_by, purchased_course_slugs')
    .eq('email', user.email)
    .maybeSingle();
  if (rowError) return json({ error: 'lookup_failed' }, 500);
  if (!row) return json({ error: 'not_found' }, 404);

  if (row.claimed_by && row.claimed_by !== user.id) {
    // Kauf-E-Mail wurde bereits von einem anderen Account beansprucht
    return json({ error: 'already_claimed' }, 409);
  }

  if (!row.claimed_by) {
    const { error: claimError } = await admin
      .from('legacy_customers')
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('claimed_by', null);
    if (claimError) return json({ error: 'claim_failed' }, 500);
  }

  return json({ ok: true, slugs: row.purchased_course_slugs });
});
