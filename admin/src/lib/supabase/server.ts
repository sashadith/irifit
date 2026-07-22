import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/** Server-Client für Server Components und Route Handler (liest Session-Cookies) */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) cookieStore.set(name, value, options);
          } catch {
            // Server Components dürfen keine Cookies setzen — Refresh übernimmt der Proxy
          }
        },
      },
    },
  );
}
