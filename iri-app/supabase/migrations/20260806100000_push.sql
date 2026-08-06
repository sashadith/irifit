-- Session 12: Push — Tokens, Präferenzen, Versand-Protokoll, Cron
-- Konzept Kapitel 13: granulare Opt-ins, Ruhezeiten, max. 1 Marketing-Push/Tag.

-- 1) Expo-Push-Tokens (mehrere Geräte pro Nutzerin möglich)
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own" on public.push_tokens
  for select using (auth.uid() = user_id);
create policy "push_tokens_insert_own" on public.push_tokens
  for insert with check (auth.uid() = user_id);
create policy "push_tokens_update_own" on public.push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_tokens_delete_own" on public.push_tokens
  for delete using (auth.uid() = user_id);

create trigger push_tokens_updated_at before update on public.push_tokens
  for each row execute function public.set_updated_at();

-- 2) Präferenzen + Zeitzone am Profil (granulare Opt-ins, Konzept 13)
alter table public.profiles
  add column if not exists timezone text not null default 'Europe/Berlin',
  add column if not exists push_broadcast boolean not null default true,   -- „Irinas Neuigkeiten" (Broadcast + Q&A-Antwort)
  add column if not exists push_streak boolean not null default true,      -- Streak-Schutz abends
  add column if not exists push_meal_evening boolean not null default true,-- Abend-Erinnerung bei Rest-Budget
  add column if not exists push_water boolean not null default true,       -- Wasser-Rückstand gegen Abend
  add column if not exists push_weekly boolean not null default true,      -- Wochenrückblick So-Abend
  -- Feste Abendzeit überschreibt den gelernten Rhythmus (null = lernen)
  add column if not exists reminder_evening_time time;

-- 3) Versand-Marker an Broadcasts/Fragen (Composer setzt send_push, Dispatch stempelt)
alter table public.broadcasts
  add column if not exists push_sent_at timestamptz;
alter table public.questions
  add column if not exists push_sent_at timestamptz;

-- 4) Versand-Protokoll: verhindert Doppel-Sends und begrenzt Marketing auf 1/Tag.
--    sent_on ist der LOKALE Kalendertag der Nutzerin (Dispatch berechnet ihn per Zeitzone).
create table public.push_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('broadcast', 'qa', 'trial', 'streak', 'meal_evening', 'water', 'weekly')),
  ref_id uuid,
  sent_at timestamptz not null default now(),
  sent_on date not null,
  unique (user_id, kind, sent_on)
);

create index push_log_user_day_idx on public.push_log (user_id, sent_on);

alter table public.push_log enable row level security;
-- Kein Client-Zugriff: schreibt und liest nur die Service-Role (Dispatch-Function).

-- 5) Cron: push-dispatch alle 15 Minuten. Das Function-Secret liegt im Vault
--    (Name: cron_secret) — Sascha legt es einmalig an, gleicher Wert wie das
--    Supabase-Function-Secret CRON_SECRET. Ohne Vault-Eintrag feuert der Job
--    ins Leere (401), richtet aber keinen Schaden an.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'irifit-push-dispatch',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://mzzonwvbacxlpwsmefrn.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), 'missing')
    ),
    body := '{}'::jsonb
  )
  $$
);
