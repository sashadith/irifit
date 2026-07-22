import type { User } from '@supabase/supabase-js';

/** Gleiche Prüfung wie is_admin() in Postgres: app_metadata.role = 'admin' */
export function isAdminUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin';
}
