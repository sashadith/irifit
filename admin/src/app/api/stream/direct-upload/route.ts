import { NextResponse } from 'next/server';

import { isAdminUser } from '@/lib/admin';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Cloudflare "Direct Creator Upload" (tus): Der Browser bekommt eine
 * Einmal-Upload-URL und lädt direkt zu Cloudflare hoch — der Stream-Token
 * bleibt ausschließlich hier auf dem Server (nie im Client).
 */
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { size, name } = (await request.json()) as { size?: number; name?: string };
  if (!size || size <= 0) {
    return NextResponse.json({ error: 'size_required' }, { status: 400 });
  }

  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_STREAM_TOKEN;
  if (!account || !token) {
    return NextResponse.json({ error: 'cf_env_missing' }, { status: 500 });
  }

  // tus-Metadata: base64-Werte; requiresignedurls als reines Flag
  const metadata = [
    'requiresignedurls',
    name ? `name ${Buffer.from(name, 'utf8').toString('base64')}` : null,
  ]
    .filter(Boolean)
    .join(',');

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/stream?direct_user=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(size),
        'Upload-Metadata': metadata,
      },
    },
  );

  const uploadUrl = cfRes.headers.get('location');
  const uid = cfRes.headers.get('stream-media-id');
  if (!cfRes.ok || !uploadUrl || !uid) {
    return NextResponse.json({ error: 'cloudflare_failed', status: cfRes.status }, { status: 502 });
  }

  return NextResponse.json({ uploadUrl, uid });
}
