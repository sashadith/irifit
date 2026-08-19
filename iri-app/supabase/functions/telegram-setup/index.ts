// IRI — Telegram-Einrichtungshilfe (Sascha 17.08., Punkt 14).
//
// Beantwortet genau eine Frage: "Welche Chat-IDs sieht mein Bot?"
//
// Warum als Function und nicht von Hand: Die Chat-ID steht bei Telegram in
// einer verschachtelten JSON-Antwort, die man nur ueber eine URL MIT DEM TOKEN
// DARIN abrufen kann. Diese URL landet dann in der Browser-History, in
// Screenshots und schlimmstenfalls in einem Chat. Hier bleibt der Token, wo er
// hingehoert — im Supabase-Secret — und heraus kommt nur eine Liste.
//
// Wird nach der Einrichtung nicht mehr gebraucht, ausser Telegram wandelt die
// Gruppe irgendwann in eine Supergruppe um. Dann aendert sich die ID, und
// dieselbe Abfrage nennt die neue.
//
// Zugang wie bei push-dispatch: Cron-Geheimnis oder Admin-Anmeldung.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

interface Chat {
  id: number;
  title?: string;
  type: string;
  first_name?: string;
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

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) {
    return json({
      error: 'kein_token',
      hinweis:
        'TELEGRAM_BOT_TOKEN ist nicht gesetzt. Dashboard → Project Settings → ' +
        'Edge Functions → Secrets.',
    }, 400);
  }

  // Wer ist der Bot? Bestaetigt gleich, dass der Token stimmt.
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = await meRes.json().catch(() => null);
  if (!me?.ok) {
    return json({
      error: 'token_ungueltig',
      hinweis: 'Telegram kennt diesen Token nicht. Bei @BotFather mit /mybots pruefen.',
    }, 400);
  }

  const updRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const upd = await updRes.json().catch(() => null);
  if (!upd?.ok) return json({ error: 'getupdates_fehlgeschlagen' }, 502);

  /* Jede Update-Art traegt den Chat woanders: eine normale Nachricht unter
     message.chat, das Hinzufuegen des Bots zu einer Gruppe unter
     my_chat_member.chat. Beide einsammeln und nach ID entdoppeln. */
  const chats = new Map<number, Chat>();
  for (const u of upd.result ?? []) {
    const c: Chat | undefined =
      u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat ?? u.edited_message?.chat;
    if (c?.id != null) chats.set(c.id, c);
  }

  const liste = [...chats.values()].map((c) => ({
    chat_id: c.id,
    name: c.title ?? c.first_name ?? '(ohne Namen)',
    art: c.type,
    // Genau das ist die Entscheidungshilfe: Gruppen sind negativ, der private
    // Chat mit dem Bot ist positiv und meist NICHT gemeint.
    empfehlung:
      c.type === 'private'
        ? 'privater Chat mit dir — nur nehmen, wenn niemand sonst mitlesen soll'
        : 'Gruppe/Kanal — das ist normalerweise die richtige',
  }));

  return json({
    bot: `@${me.result.username}`,
    gefundene_chats: liste,
    hinweis: liste.length
      ? 'Die passende chat_id als TELEGRAM_CHAT_ID eintragen.'
      : 'Telegram meldet keine Chats. Schreib in der Gruppe einmal /start@' +
        me.result.username +
        ' und ruf das hier erneut auf. Wichtig: Nachrichten aelter als 24 Stunden zeigt Telegram nicht mehr an.',
  });
});
