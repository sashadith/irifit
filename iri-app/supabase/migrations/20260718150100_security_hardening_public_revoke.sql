-- Nachtrag: EXECUTE steckt im Default-Grant an PUBLIC — dort ebenfalls entziehen.
-- authenticated behält EXECUTE bewusst: die RLS-Policies werten die Funktionen
-- mit den Rechten der anfragenden Rolle aus.

revoke execute on function public.is_subscriber() from public, anon;
revoke execute on function public.has_legacy_access(uuid) from public, anon;
grant execute on function public.is_subscriber() to authenticated;
grant execute on function public.has_legacy_access(uuid) to authenticated;
