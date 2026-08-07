// IRI — Account-Löschung (Session 15, Art. 17 DSGVO + Store-Pflicht).
// Die Nutzerin löscht ihren Account selbst: erst alle Storage-Objekte
// (progress-photos ist der einzige nutzereigene Bucket), dann der Auth-User —
// alle Tabellenzeilen hängen per ON DELETE CASCADE an auth.users.
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
  const userId = userData.user.id;

  // 1) Fortschrittsfotos aus dem privaten Bucket (Pfade stehen in der Tabelle)
  const { data: photos } = await admin
    .from('progress_photos')
    .select('storage_path')
    .eq('user_id', userId);
  if (photos?.length) {
    await admin.storage.from('progress-photos').remove(photos.map((p) => p.storage_path));
  }

  // 2) Auth-User löschen → CASCADE räumt profiles, food_logs, weights, water_logs,
  //    progress_photos, favorites, lesson_progress, questions, push_tokens, push_log,
  //    subscriptions, voucher_redemptions … (Schema: alle FKs auf auth.users)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return new Response(JSON.stringify({ error: 'delete_failed' }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
});
