-- S11-Sicherheitscheckliste (d): Fair-Use-Zähler atomar (Audit 22.07. —
-- Read-then-Upsert verlor Zählungen bei parallelen Requests).
-- Nur die Service Role (analyze-food) darf das aufrufen.
create or replace function public.increment_scan_usage(p_user_id uuid, p_month text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.scan_usage (user_id, month, count, updated_at)
  values (p_user_id, p_month, 1, now())
  on conflict (user_id, month) do update
    set count = scan_usage.count + 1, updated_at = now()
  returning count;
$$;

revoke execute on function public.increment_scan_usage(uuid, text) from public, anon, authenticated;
