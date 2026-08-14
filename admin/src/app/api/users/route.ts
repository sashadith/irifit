import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { isAdminUser } from '@/lib/admin';
import { matchesSearch } from '@/lib/search';
import { supabaseServer } from '@/lib/supabase/server';
import type { AdminUser } from '@/lib/types';

/**
 * Nutzerverwaltung (Session 14): E-Mail-Liste, Admin-Rolle, Sperren laufen über
 * die Auth-Admin-API — das geht NUR mit dem Service-Role-Key, der ausschließlich
 * serverseitig in .env.local liegt (SUPABASE_SERVICE_ROLE_KEY, nie NEXT_PUBLIC_).
 * Alles andere im Admin bleibt bewusst service-role-frei über RLS.
 */

async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return { userId: user!.id };
}

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = serviceClient();
  if (!admin) return NextResponse.json({ error: 'service_role_missing' }, { status: 500 });

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  // Beta-Maßstab: eine Seite mit 1000 reicht weit; Pagination folgt bei Bedarf
  const { data: userList, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return NextResponse.json({ error: listError.message }, { status: 502 });

  const ids = userList.users.map((u) => u.id);
  const [{ data: profiles }, { data: subs }, { data: legacy }] = await Promise.all([
    admin.from('profiles').select('id, display_name, streak_count, onboarding_completed_at').in('id', ids),
    admin.from('subscriptions').select('user_id, status, current_period_end').in('user_id', ids),
    admin.from('legacy_customers').select('claimed_by').not('claimed_by', 'is', null),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));
  const legacySet = new Set((legacy ?? []).map((l) => l.claimed_by as string));

  let users: AdminUser[] = userList.users.map((u) => {
    const profile = profileById.get(u.id);
    const sub = subByUser.get(u.id);
    const banned = (u as { banned_until?: string | null }).banned_until ?? null;
    return {
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at,
      banned_until: banned && new Date(banned) > new Date() ? banned : null,
      is_admin: u.app_metadata?.role === 'admin',
      display_name: profile?.display_name ?? null,
      streak_count: profile?.streak_count ?? null,
      onboarding_completed_at: profile?.onboarding_completed_at ?? null,
      subscription_status: sub?.status ?? null,
      subscription_period_end: sub?.current_period_end ?? null,
      is_legacy: legacySet.has(u.id),
    };
  });

  if (q) {
    // Gleiche verzeihende Suche wie bei den Rezepten — „müller" findet auch
    // „Mueller", und „anna mue" reicht als Eingabe
    users = users.filter((u) => matchesSearch(q, u.email, u.display_name));
  }
  users.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = serviceClient();
  if (!admin) return NextResponse.json({ error: 'service_role_missing' }, { status: 500 });

  const { action, userId } = (await request.json()) as { action?: string; userId?: string };
  if (!action || !userId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // Selbstschutz: sich selbst sperren oder degradieren sperrt den Admin aus
  if (userId === auth.userId && (action === 'ban' || action === 'revoke-admin')) {
    return NextResponse.json({ error: 'cannot_target_self' }, { status: 400 });
  }

  let result;
  switch (action) {
    case 'grant-admin':
      result = await admin.auth.admin.updateUserById(userId, { app_metadata: { role: 'admin' } });
      break;
    case 'revoke-admin':
      result = await admin.auth.admin.updateUserById(userId, { app_metadata: { role: null } });
      break;
    case 'ban':
      // ~100 Jahre — praktisch dauerhaft, per "unban" umkehrbar
      result = await admin.auth.admin.updateUserById(userId, { ban_duration: '876600h' });
      break;
    case 'unban':
      result = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
      break;
    default:
      return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
