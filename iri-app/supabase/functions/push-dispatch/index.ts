// IRI — Push-Verteiler (Session 12). Läuft alle 15 Min per pg_cron.
// Ein Durchlauf prüft alle Push-Arten (Konzept Kapitel 13):
//   broadcast · qa · trial · streak · meal_evening · water · weekly
// Regeln: Ruhezeiten aus gelerntem Rhythmus (Fallback 21–9 Uhr lokal),
// max. 1 Push je Art und Tag (push_log-Unique), Deep-Link in jedem Push,
// Irinas Ton (per Du, kein Druck). Secrets: CRON_SECRET.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

interface ProfileRow {
  id: string;
  display_name: string | null;
  timezone: string;
  kcal_goal: number | null;
  water_goal_ml: number;
  streak_count: number;
  push_broadcast: boolean;
  push_streak: boolean;
  push_meal_evening: boolean;
  push_water: boolean;
  push_weekly: boolean;
  reminder_evening_time: string | null; // 'HH:MM:SS'
}

interface PushMessage {
  to: string[];
  title: string;
  body: string;
  data: Record<string, string>;
  userId: string;
  kind: string;
  refId?: string;
}

/** Lokale Zeit einer Nutzerin (Stunde als Dezimalzahl, Wochentag, ISO-Datum) */
function localNow(tz: string): { hour: number; weekday: number; date: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      hour: Number(get('hour')) + Number(get('minute')) / 60,
      weekday: weekdays.indexOf(get('weekday')),
      date: `${get('year')}-${get('month')}-${get('day')}`,
    };
  } catch {
    return localNow('Europe/Berlin'); // unbekannte Zeitzone → Fallback
  }
}

/** 'HH:MM:SS' → Dezimalstunde */
function timeToHour(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + (m || 0) / 60;
}

/** Gelernte Schlafenszeit: Median der letzten Log-Stunden + 1 h, geklemmt auf 20–23.
 *  Ohne Historie gilt die Konzept-Regel 21 Uhr. */
function learnedBedtime(lastLogHours: number[]): number {
  if (lastLogHours.length < 3) return 21;
  const sorted = [...lastLogHours].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return Math.min(23, Math.max(20, median + 1));
}

/** Gelernte Abendessen-Zeit: Median der Dinner-Logs, Fallback 18:30 */
function learnedDinner(dinnerHours: number[]): number {
  if (dinnerHours.length < 3) return 18.5;
  const sorted = [...dinnerHours].sort((a, b) => a - b);
  return Math.min(21, Math.max(17, sorted[Math.floor(sorted.length / 2)]));
}

/** Expo Push API mit Chunking; entfernt tote Tokens (DeviceNotRegistered) */
async function sendExpoPushes(
  admin: SupabaseClient,
  messages: { to: string; title: string; body: string; data: Record<string, string>; sound: string; channelId: string }[],
) {
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) continue;
    const { data } = await res.json();
    if (Array.isArray(data)) {
      data.forEach((ticket, idx) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          dead.push(chunk[idx].to);
        }
      });
    }
  }
  if (dead.length) await admin.from('push_tokens').delete().in('token', dead);
}

// Der Admin-Bereich ruft die Funktion aus dem Browser (andere Domain) auf
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405, headers: CORS });
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Zwei Wege herein (Session 28):
  //  1. der pg_cron-Job mit dem gemeinsamen Geheimnis — alle 15 Minuten
  //  2. eine Admin-Anmeldung aus dem Admin-Bereich, damit ein frisch
  //     veroeffentlichter Broadcast SOFORT rausgeht statt bis zu 15 Minuten auf
  //     den naechsten Cron-Lauf zu warten (Sascha 14.08.: „keine Push bekommen"
  //     — sie kam, nur 13 Minuten spaeter).
  // Der Weg ueber das Admin-Token spart ein weiteres Geheimnis auf dem Webserver.
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
  if (!viaCron && !viaAdmin) {
    return new Response('unauthorized', { status: 401, headers: CORS });
  }

  // Alle Nutzerinnen mit registrierten Geräten + Präferenzen laden
  const { data: tokens } = await admin.from('push_tokens').select('token, user_id');
  if (!tokens?.length) return Response.json({ ok: true, sent: 0 }, { headers: CORS });
  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens) {
    tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t.token]);
  }
  const userIds = [...tokensByUser.keys()];

  const { data: profiles } = await admin
    .from('profiles')
    .select(
      'id, display_name, timezone, kcal_goal, water_goal_ml, streak_count, push_broadcast, push_streak, push_meal_evening, push_water, push_weekly, reminder_evening_time',
    )
    .in('id', userIds);
  const profileById = new Map<string, ProfileRow>((profiles ?? []).map((p) => [p.id, p]));

  const queue: PushMessage[] = [];
  const vorname = (p: ProfileRow) => p.display_name?.trim() || 'du';

  // ── 1) Broadcast: Irina hat gesendet, Push noch offen ────────────────────
  const { data: pendingBroadcasts } = await admin
    .from('broadcasts')
    .select('id, body')
    .eq('send_push', true)
    .not('sent_at', 'is', null)
    .is('push_sent_at', null);
  let deferredBroadcasts = 0;
  for (const b of pendingBroadcasts ?? []) {
    let queued = 0;
    let deferred = 0;
    for (const [userId, p] of profileById) {
      if (!p.push_broadcast) continue;
      const { hour } = localNow(p.timezone);
      if (hour >= 21 || hour < 9) {
        // Nachts kein Push — der Broadcast ist in der App ohnehin schon sichtbar
        deferred++;
        continue;
      }
      queue.push({
        to: tokensByUser.get(userId)!,
        title: 'Neuigkeit von Irina 💌',
        body: b.body.length > 120 ? `${b.body.slice(0, 117)}…` : b.body,
        data: { route: '/(tabs)/coaching' },
        userId,
        kind: 'broadcast',
        refId: b.id,
      });
      queued++;
    }
    // Nur abhaken, wenn wirklich jemand erreicht wurde. Wurde ausschliesslich
    // wegen der Ruhezeit uebersprungen, bleibt push_sent_at offen und der
    // naechste Lauf ab 9 Uhr holt es nach.
    //
    // Vorher wurde hier IMMER abgehakt — ein Broadcast nach 21 Uhr galt damit
    // als zugestellt und erreichte nie jemanden (Sascha 14.08., 21:40: „Push an
    // 0 Geraete raus"). Wer niemanden hat, weil alle Push aus haben, wird
    // weiterhin abgehakt und nicht endlos wiederholt.
    if (queued > 0 || deferred === 0) {
      await admin.from('broadcasts').update({ push_sent_at: new Date().toISOString() }).eq('id', b.id);
    } else {
      deferredBroadcasts++;
    }
  }

  // ── 2) Q&A: Irinas Antwort ist da ────────────────────────────────────────
  const { data: answered } = await admin
    .from('questions')
    .select('id, user_id')
    .eq('send_push', true)
    .in('status', ['answered', 'published'])
    .is('push_sent_at', null);
  for (const q of answered ?? []) {
    const p = q.user_id ? profileById.get(q.user_id) : undefined;
    if (p && p.push_broadcast) {
      queue.push({
        to: tokensByUser.get(q.user_id)!,
        title: 'Irina hat dir geantwortet 💬',
        body: 'Deine Frage hat eine Antwort — schau mal rein.',
        data: { route: '/(tabs)/coaching' },
        userId: q.user_id,
        kind: 'qa',
        refId: q.id,
      });
    }
    await admin.from('questions').update({ push_sent_at: new Date().toISOString() }).eq('id', q.id);
  }

  // ── 3) Trial endet morgen — der ehrliche Push (Konzept 13, immer aktiv) ──
  const in18h = new Date(Date.now() + 18 * 3600e3).toISOString();
  const in42h = new Date(Date.now() + 42 * 3600e3).toISOString();
  const { data: trials } = await admin
    .from('subscriptions')
    .select('user_id, current_period_end')
    .eq('status', 'trialing')
    .gte('current_period_end', in18h)
    .lte('current_period_end', in42h)
    .in('user_id', userIds);
  for (const s of trials ?? []) {
    const p = profileById.get(s.user_id);
    if (!p) continue;
    const { hour } = localNow(p.timezone);
    if (hour >= 21 || hour < 9) continue;
    queue.push({
      to: tokensByUser.get(s.user_id)!,
      title: 'Dein Test endet morgen',
      body: 'Bleib dabei — oder kündige mit einem Tap. Ganz ohne Haken.',
      data: { route: 'manage-subscription' },
      userId: s.user_id,
      kind: 'trial',
    });
  }

  // ── 4) Tagesrhythmus je Nutzerin: Streak · Abend-Budget · Wasser · Weekly ─
  // Heutige Logs + Historie (14 Tage) für alle Kandidatinnen in zwei Queries.
  const since = new Date(Date.now() - 14 * 86400e3).toISOString();
  const { data: recentLogs } = await admin
    .from('food_logs')
    .select('user_id, logged_on, slot, kcal, created_at')
    .in('user_id', userIds)
    .gte('created_at', since);
  const { data: todayWater } = await admin
    .from('water_logs')
    .select('user_id, amount_ml, logged_on')
    .in('user_id', userIds)
    .gte('logged_on', new Date(Date.now() - 86400e3).toISOString().slice(0, 10));

  const logsByUser = new Map<string, NonNullable<typeof recentLogs>>();
  for (const l of recentLogs ?? []) {
    logsByUser.set(l.user_id, [...(logsByUser.get(l.user_id) ?? []), l]);
  }

  for (const [userId, p] of profileById) {
    const { hour, weekday, date } = localNow(p.timezone);
    const logs = logsByUser.get(userId) ?? [];
    const todays = logs.filter((l) => l.logged_on === date);

    // Rhythmus lernen: letzte Log-Stunde je Tag → Schlafenszeit; Dinner-Median
    const lastByDay = new Map<string, number>();
    const dinnerHours: number[] = [];
    for (const l of logs) {
      const h = timeToHour(
        new Intl.DateTimeFormat('de-DE', {
          timeZone: p.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(l.created_at)),
      );
      lastByDay.set(l.logged_on, Math.max(lastByDay.get(l.logged_on) ?? 0, h));
      if (l.slot === 'dinner') dinnerHours.push(h);
    }
    const bedtime = learnedBedtime([...lastByDay.values()]);
    if (hour >= bedtime || hour < 9) continue; // personalisierte Ruhezeit

    const eveningAt = p.reminder_evening_time
      ? timeToHour(p.reminder_evening_time)
      : learnedDinner(dinnerHours);

    // (a) Streak-Schutz: Serie läuft, heute noch kein Eintrag, Abend rückt näher
    if (p.push_streak && p.streak_count > 0 && todays.length === 0 && hour >= bedtime - 2) {
      queue.push({
        to: tokensByUser.get(userId)!,
        title: `Deine ${p.streak_count}-Tage-Serie 🔥`,
        body: 'Ein Eintrag genügt — ein Foto reicht schon.',
        data: { route: '/scan' },
        userId,
        kind: 'streak',
      });
    }

    // (b) Abend-Push bei Rest-Budget — NIE bei überschrittenem Budget
    if (p.push_meal_evening && p.kcal_goal && todays.length > 0 && hour >= eveningAt) {
      const eaten = todays.reduce((sum, l) => sum + (l.kcal ?? 0), 0);
      const rest = p.kcal_goal - eaten;
      if (rest >= 150) {
        queue.push({
          to: tokensByUser.get(userId)!,
          title: `Noch ca. ${rest} kcal übrig`,
          body: 'Falls du noch Hunger hast: Ich hätte da ein paar Ideen für dich. 😋',
          data: { route: '/(tabs)/rezepte' },
          userId,
          kind: 'meal_evening',
        });
      }
    }

    // (c) Wasser-Erinnerung bei Rückstand gegen Abend
    if (p.push_water && hour >= 18) {
      const water = (todayWater ?? []).find((w) => w.user_id === userId && w.logged_on === date);
      const ml = water?.amount_ml ?? 0;
      if (ml < p.water_goal_ml * 0.6) {
        queue.push({
          to: tokensByUser.get(userId)!,
          title: 'Kleiner Schluck gefällig? 💧',
          body: 'Du liegst heute noch unter deinem Wasserziel — ein Glas geht immer.',
          data: { route: '/(tabs)' },
          userId,
          kind: 'water',
        });
      }
    }

    // (d) Wochenrückblick: Sonntagabend
    if (p.push_weekly && weekday === 0 && hour >= 18) {
      const weekAgo = new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10);
      const daysLogged = new Set(logs.filter((l) => l.logged_on >= weekAgo).map((l) => l.logged_on)).size;
      queue.push({
        to: tokensByUser.get(userId)!,
        title: 'Dein Wochenrückblick 🌸',
        body: `${Math.min(daysLogged, 7)} Tage getrackt diese Woche — schau dir deinen Fortschritt an.`,
        data: { route: '/progress' },
        userId,
        kind: 'weekly',
      });
    }
  }

  // ── Versand: push_log reserviert (1× je Art und lokalem Tag), dann Expo ──
  const toSend: { to: string; title: string; body: string; data: Record<string, string>; sound: string; channelId: string }[] = [];
  let sent = 0;
  for (const msg of queue) {
    const p = profileById.get(msg.userId)!;
    const { date } = localNow(p.timezone);
    const { error } = await admin.from('push_log').insert({
      user_id: msg.userId,
      kind: msg.kind,
      ref_id: msg.refId ?? null,
      sent_on: date,
    });
    if (error) continue; // Unique-Konflikt: heute schon geschickt
    sent += 1;
    for (const token of msg.to) {
      // sound: iOS spielt push.wav aus dem Bundle; channelId: Androids iri-soft-Channel traegt denselben Ton
      toSend.push({ to: token, title: msg.title, body: msg.body, data: msg.data, sound: 'push.wav', channelId: 'iri-soft' });
    }
  }
  if (toSend.length) await sendExpoPushes(admin, toSend);

  return Response.json({ ok: true, sent, deferredBroadcasts }, { headers: CORS });
});
