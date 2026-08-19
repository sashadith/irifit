// IRI — Telegram-Tagesbericht (Sascha 16.08., Punkt 14).
//
// Laeuft einmal taeglich per pg_cron (18:00 UTC) und schickt einen Ueberblick in
// den Bot-Chat: wer kam dazu, wer war aktiv, wie viele Zugaenge, was laeuft aus,
// was liegt offen. Die Sofortmeldungen (Abo, Kuendigung, Gutschein, neue Frage)
// kommen woanders her — hier steht das Bild des Tages.
//
// Absichtlich ohne Namen und ohne E-Mail-Adressen: siehe _shared/telegram.ts.
//
// Zwei Wege herein, wie bei push-dispatch:
//   1. der Cron-Job mit x-cron-secret
//   2. eine Admin-Anmeldung — damit Sascha den Bericht jederzeit anfordern kann
//
// Zum Pruefen der Einrichtung: mit { "dry": true } aufrufen. Dann antwortet die
// Funktion mit dem Text, ohne ihn zu senden.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { notifyTelegram } from '../_shared/telegram.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

interface Bericht {
  anmeldungen_heute: number;
  aktive_heute: number;
  eintraege_heute: number;
  mit_zugang: number;
  im_test: number;
  laeuft_aus_7_tage: number;
  offene_fragen: number;
  scans_heute: number;
}

/** "3 Frauen" / "1 Frau" — der Bericht wird gelesen, nicht ausgewertet. */
function frauen(n: number): string {
  return n === 1 ? '1 Frau' : `${n} Frauen`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const secret = Deno.env.get('CRON_SECRET');
  const viaCron = Boolean(secret) && req.headers.get('x-cron-secret') === secret;
  let viaAdmin = false;
  if (!viaCron) {
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    if (jwt) {
      const { data } = await admin.auth.getUser(jwt);
      viaAdmin = data.user?.app_metadata?.role === 'admin';
    }
  }
  if (!viaCron && !viaAdmin) return json({ error: 'unauthorized' }, 401);

  let body: { dry?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // leerer Body ist der Normalfall beim Cron-Aufruf
  }

  const { data, error } = await admin.rpc('stats_tagesbericht');
  if (error) return json({ error: 'stats_failed', detail: error.message }, 500);
  const b = (data as Bericht[] | null)?.[0];
  if (!b) return json({ error: 'no_data' }, 500);

  // Suchbegriffe ohne Treffer von heute — die Arbeitsliste fuer die
  // Lebensmitteldatenbank, gleich mit im Bericht statt in einem eigenen Report.
  const seitMitternacht = new Date();
  seitMitternacht.setUTCHours(0, 0, 0, 0);
  const { data: luecken } = await admin
    .from('app_events')
    .select('props')
    .eq('name', 'search_no_hit')
    .gte('created_at', seitMitternacht.toISOString())
    .limit(200);
  const begriffe = new Map<string, number>();
  for (const e of luecken ?? []) {
    const term = String((e.props as Record<string, unknown>)?.term ?? '')
      .trim()
      .toLowerCase();
    if (term) begriffe.set(term, (begriffe.get(term) ?? 0) + 1);
  }
  const topLuecken = [...begriffe.entries()]
    .sort((a, b2) => b2[1] - a[1])
    .slice(0, 5)
    .map(([t, n]) => (n > 1 ? `${t} (${n}×)` : t));

  const datum = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Berlin',
  });

  const zeilen = [
    `📊 <b>IriFit — ${datum}</b>`,
    '',
    `Neu angemeldet: <b>${b.anmeldungen_heute}</b>`,
    `Heute aktiv: <b>${frauen(b.aktive_heute)}</b> (${b.eintraege_heute} Einträge)`,
    `Mit Zugang: <b>${b.mit_zugang}</b>, davon ${b.im_test} im Test`,
  ];
  if (b.scans_heute > 0) zeilen.push(`Foto-Scans heute: ${b.scans_heute}`);
  if (b.laeuft_aus_7_tage > 0) {
    zeilen.push(`⏳ Läuft in 7 Tagen aus, ohne Verlängerung: <b>${b.laeuft_aus_7_tage}</b>`);
  }
  if (b.offene_fragen > 0) zeilen.push(`💬 Offene Fragen: <b>${b.offene_fragen}</b>`);
  if (topLuecken.length > 0) {
    zeilen.push('', `🔍 Ohne Treffer gesucht: ${topLuecken.join(', ')}`);
  }
  if (b.aktive_heute === 0 && b.anmeldungen_heute === 0) {
    zeilen.push('', 'Heute war es still.');
  }

  const text = zeilen.join('\n');
  if (body.dry) return json({ ok: true, dry: true, text });

  const ergebnis = await notifyTelegram(text);
  return json({ ok: ergebnis.ok, grund: ergebnis.grund, text });
});
