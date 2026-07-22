// IRI — Signierte Cloudflare-Stream-Wiedergabe (Session 9)
// Prüft serverseitig den Zugriff (Abo ODER Legacy-Kauf) und holt dann ein
// kurzlebiges Playback-Token von Cloudflare. Benötigte Secrets:
// CF_ACCOUNT_ID, CF_STREAM_TOKEN (Dashboard → Edge Functions → Secrets).
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

  const accountId = Deno.env.get('CF_ACCOUNT_ID');
  const cfToken = Deno.env.get('CF_STREAM_TOKEN');
  if (!accountId || !cfToken) {
    return new Response(JSON.stringify({ error: 'missing_cloudflare_secrets' }), { status: 500, headers: CORS });
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

  let body: { lessonId?: string; trainingId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS });
  }
  if (!body.lessonId && !body.trainingId) {
    return new Response(JSON.stringify({ error: 'missing_target' }), { status: 400, headers: CORS });
  }

  async function hasActiveSubscription(): Promise<boolean> {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();
    return (
      !!sub &&
      ['trialing', 'active', 'in_grace'].includes(sub.status) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date())
    );
  }

  let videoUid: string | null = null;

  if (body.trainingId) {
    // Spur 2: Trainings-Bibliothek — nur für Abonnentinnen
    const { data: training } = await admin
      .from('training_videos')
      .select('video_uid, status')
      .eq('id', body.trainingId)
      .maybeSingle();
    if (!training || training.status !== 'published' || !training.video_uid) {
      return new Response(JSON.stringify({ error: 'training_not_found' }), { status: 404, headers: CORS });
    }
    if (!(await hasActiveSubscription())) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS });
    }
    videoUid = training.video_uid;
  } else {
    // Spur 1: Kurs-Lektion (Service Role — Zugriffsprüfung machen wir selbst)
    const { data: lesson } = await admin
      .from('lessons')
      .select('id, video_uid, status, course_id, courses!inner(id, is_legacy, legacy_slug, status)')
      .eq('id', body.lessonId)
      .maybeSingle();
    if (!lesson || lesson.status !== 'published' || !lesson.video_uid) {
      return new Response(JSON.stringify({ error: 'lesson_not_found' }), { status: 404, headers: CORS });
    }
    const course = lesson.courses as unknown as {
      is_legacy: boolean;
      legacy_slug: string | null;
      status: string;
    };
    if (course.status !== 'published') {
      return new Response(JSON.stringify({ error: 'lesson_not_found' }), { status: 404, headers: CORS });
    }

    // Zugriff: aktive Abonnentin (nicht-Legacy-Kurse) ODER Legacy-Käuferin
    let allowed = false;
    if (!course.is_legacy) {
      allowed = await hasActiveSubscription();
    } else if (course.legacy_slug) {
      const { data: legacy } = await admin
        .from('legacy_customers')
        .select('purchased_course_slugs')
        .eq('claimed_by', userId)
        .maybeSingle();
      allowed = !!legacy && legacy.purchased_course_slugs.includes(course.legacy_slug);
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS });
    }
    videoUid = lesson.video_uid;
  }

  // Kurzlebiges Playback-Token bei Cloudflare holen (2 h)
  const tokenRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}/token`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 7200 }),
    },
  );
  const tokenJson = await tokenRes.json();
  if (!tokenJson.success) {
    return new Response(JSON.stringify({ error: 'token_failed' }), { status: 502, headers: CORS });
  }
  const signedToken = tokenJson.result.token as string;

  // HLS-URL aus den Video-Details ableiten (Kunden-Subdomain), UID → Token
  const videoRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}`,
    { headers: { Authorization: `Bearer ${cfToken}` } },
  );
  const videoJson = await videoRes.json();
  const hlsTemplate = videoJson?.result?.playback?.hls as string | undefined;
  if (!hlsTemplate) {
    return new Response(JSON.stringify({ error: 'playback_unavailable' }), { status: 502, headers: CORS });
  }
  const hlsUrl = hlsTemplate.replace(videoUid!, signedToken);
  // Poster: erster Frame ist bei den Kursvideos Greenscreen → Thumbnail bei 10 s.
  // Dasselbe signierte Token gilt auch für den Thumbnail-Endpunkt.
  const thumbnailUrl = hlsUrl.replace(
    '/manifest/video.m3u8',
    '/thumbnails/thumbnail.jpg?time=10s&width=1280',
  );

  return new Response(JSON.stringify({ hlsUrl, thumbnailUrl, expiresInSeconds: 7200 }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
