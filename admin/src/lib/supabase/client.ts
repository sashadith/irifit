'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Browser-Client — Session liegt in Cookies, damit auch der Server sie sieht */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
