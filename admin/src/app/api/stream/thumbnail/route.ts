import { NextResponse } from 'next/server';

import { isAdminUser } from '@/lib/admin';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Kleines Standbild aus einem Trainings-Video (Sascha 15.08.).
 *
 * Die Videos laufen mit `requiresignedurls` — eine nackte Cloudflare-URL
 * liefert 401. Deshalb signiert diese Route und reicht das JPEG selbst durch:
 * so taucht weder Token noch Kunden-Subdomain im Browser auf.
 *
 * Solange Cloudflare noch kodiert, gibt es kein Standbild — dann kommt 409
 * zurueck und die Oberflaeche fragt spaeter noch einmal nach.
 */
export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const uid = new URL(request.url).searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'uid_required' }, { status: 400 });

  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_STREAM_TOKEN;
  if (!account || !token) {
    return NextResponse.json({ error: 'cf_env_missing' }, { status: 500 });
  }
  const auth = { Authorization: `Bearer ${token}` };

  const detail = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/stream/${uid}`, {
    headers: auth,
  });
  const detailJson = await detail.json();
  const template = detailJson?.result?.thumbnail as string | undefined;
  if (!detailJson?.result?.readyToStream || !template) {
    return NextResponse.json({ error: 'encoding' }, { status: 409 });
  }

  const tokenRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/stream/${uid}/token`,
    {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300 }),
    },
  );
  const tokenJson = await tokenRes.json();
  if (!tokenJson?.success) {
    return NextResponse.json({ error: 'token_failed' }, { status: 502 });
  }

  // Sekunde 1 statt Frame 0: der erste Frame ist oft noch schwarz
  const url = `${template.replace(uid, tokenJson.result.token as string)}?time=1s&width=360`;
  const image = await fetch(url);
  if (!image.ok || !image.body) {
    return NextResponse.json({ error: 'thumbnail_unavailable' }, { status: 409 });
  }

  return new NextResponse(image.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      // Privat und kurz: das Bild gehoert zu einem kostenpflichtigen Video
      'Cache-Control': 'private, max-age=300',
    },
  });
}
