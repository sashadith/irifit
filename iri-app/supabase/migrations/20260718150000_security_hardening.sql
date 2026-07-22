-- IRI — Härtung nach Security-Advisor (Session 2)
-- 1) search_path der Helper-Funktionen fixieren (Lint 0011)
-- 2) citext-Extension aus public ins extensions-Schema (Lint 0014)
-- 3) anon darf die SECURITY-DEFINER-Helper nicht via RPC aufrufen (Lint 0028)
--    (authenticated behält EXECUTE — die RLS-Policies brauchen es)

create schema if not exists extensions;
alter extension citext set schema extensions;

alter function public.set_updated_at() set search_path = '';
alter function public.is_admin() set search_path = '';

revoke execute on function public.is_subscriber() from anon;
revoke execute on function public.has_legacy_access(uuid) from anon;
