-- IRI — Fair-Use-Zähler für AI-Scans (Session 5)
-- 300 Scans/Monat als Ausreißer-Schutz (Konzept Kap. 7).
-- Geschrieben wird ausschließlich von der Edge Function (Service Role);
-- die Nutzerin darf ihren eigenen Stand lesen (Anzeige im Profil später).

create table public.scan_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Kalendermonat als 'YYYY-MM'
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  count int not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.scan_usage enable row level security;

create policy "scan_usage_select_own" on public.scan_usage
  for select using (user_id = auth.uid() or public.is_admin());
