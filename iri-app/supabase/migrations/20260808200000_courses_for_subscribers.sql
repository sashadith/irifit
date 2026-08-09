-- Kurse gehören zum Abo (Entscheidung Sascha 08.08.)
--
-- Vorher gab die Policy Kurse nur an Legacy-Käuferinnen: die Bedingung
-- `not is_legacy and is_subscriber()` konnte für die bestehenden Kurse nie
-- greifen, weil alle fünf als is_legacy markiert sind. Abonnentinnen sahen
-- deshalb einen leeren Coaching-Tab — im Widerspruch zur Paywall, die
-- „Irinas Ernährungskurs" ausdrücklich verspricht.
--
-- WICHTIG: is_legacy bleibt true. Das Flag markiert die Herkunft und wird von
-- has_legacy_access() ausgewertet — ein Umschalten auf false würde die 436
-- Digistore-Käuferinnen aussperren, weil die Funktion selbst darauf prüft.
-- Stattdessen darf is_subscriber() jetzt ALLE veröffentlichten Kurse sehen.

drop policy if exists "courses_select_subscribers" on public.courses;

create policy "courses_select_subscribers" on public.courses
  for select using (
    status = 'published'
    and (
      public.is_subscriber()          -- Abo (schließt Admins ein) → alle Kurse
      or public.has_legacy_access(id) -- Legacy-Kauf → die gekauften Kurse
    )
  );
