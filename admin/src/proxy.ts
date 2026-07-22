import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { isAdminUser } from '@/lib/admin';

/**
 * Auth-Guard (Next 16: proxy statt middleware): Session-Cookies auffrischen
 * und alles außer /login nur für Admins durchlassen. Die harte Autorisierung
 * bleibt in RLS (is_admin) — das hier ist die UX-Schicht davor.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname.startsWith('/login');
  const isAdmin = isAdminUser(user);

  if (!isAdmin && !isLogin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (isAdmin && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
};
