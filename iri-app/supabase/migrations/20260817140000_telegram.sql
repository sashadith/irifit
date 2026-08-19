-- Session 20: Telegram-Meldungen (Sascha 16.08., Punkt 14)
--
-- Zwei Wege in den Chat:
--
--   1. Sofortmeldungen aus den Edge Functions selbst — neues Abo, Kuendigung,
--      Zahlungsproblem (revenuecat-webhook), Gutschein (redeem-voucher), neue
--      Frage (push-dispatch, alle 15 Minuten). Dafuer braucht es hier nur die
--      Spalte, die verhindert, dass dieselbe Frage zweimal gemeldet wird.
--   2. Ein Tagesbericht, ausgeloest von pg_cron.
--
-- Die Zugangsdaten des Bots liegen als Function-Secrets (TELEGRAM_BOT_TOKEN,
-- TELEGRAM_CHAT_ID), nicht in der Datenbank. Fehlen sie, meldet der Bot nichts
-- und alles andere laeuft unveraendert weiter.

-- ---------------------------------------------------------------------------
-- Doppelmeldungen verhindern
-- ---------------------------------------------------------------------------

-- questions.push_sent_at gibt es schon, das ist aber der Push AN die Nutzerin,
-- wenn Irina geantwortet hat. Hier geht es um die Gegenrichtung: die Meldung an
-- Irina, dass eine Frage hereinkam. Zwei Ereignisse, zwei Stempel.
alter table public.questions
  add column if not exists telegram_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- Tagesbericht um 18:00 UTC
--
-- Das sind im Sommer 20 Uhr, im Winter 19 Uhr deutscher Zeit. Bewusst kein
-- Umschalten: Der Bericht deckt "heute" ab, und eine Stunde Verschiebung im
-- Winter aendert daran nichts. pg_cron rechnet in der Zeitzone der Datenbank,
-- und die ist bei Supabase UTC.
-- ---------------------------------------------------------------------------

select cron.schedule(
  'irifit-telegram-digest',
  '0 18 * * *',
  $$
  select net.http_post(
    url := 'https://mzzonwvbacxlpwsmefrn.supabase.co/functions/v1/telegram-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), 'missing')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- ---------------------------------------------------------------------------
-- Kennzahlen fuer den Tagesbericht
--
-- Eine Funktion statt zehn Abfragen aus der Edge Function: ein Roundtrip, und
-- die Definition von "heute" (Europe/Berlin) steht an einer Stelle.
-- Aufrufbar nur mit der Service Role — der Bericht geht an Irina und Sascha,
-- nicht an Nutzerinnen.
-- ---------------------------------------------------------------------------

create or replace function public.stats_tagesbericht()
returns table (
  anmeldungen_heute int,
  aktive_heute int,
  eintraege_heute int,
  mit_zugang int,
  im_test int,
  laeuft_aus_7_tage int,
  offene_fragen int,
  scans_heute int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  heute date := (now() at time zone 'Europe/Berlin')::date;
  beginn timestamptz := heute::timestamp at time zone 'Europe/Berlin';
begin
  return query
    select
      (select count(*) from auth.users u where u.created_at >= beginn)::int,
      (select count(distinct fl.user_id) from public.food_logs fl where fl.logged_on = heute)::int,
      (select count(*) from public.food_logs fl where fl.logged_on = heute)::int,
      (select count(*) from public.subscriptions s
        where s.status in ('trialing', 'active', 'in_grace'))::int,
      (select count(*) from public.subscriptions s where s.status = 'trialing')::int,
      -- Wessen Zugang in den naechsten sieben Tagen endet, ohne sich zu
      -- verlaengern: die Liste, aus der Kuendigungen werden.
      (select count(*) from public.subscriptions s
        where s.status in ('trialing', 'active')
          and s.will_renew is not true
          and s.current_period_end between now() and now() + interval '7 days')::int,
      (select count(*) from public.questions q where q.status = 'new')::int,
      (select count(*) from public.app_events e
        where e.name = 'scan_started' and e.created_at >= beginn)::int;
end;
$$;

revoke execute on function public.stats_tagesbericht() from public, anon, authenticated;
