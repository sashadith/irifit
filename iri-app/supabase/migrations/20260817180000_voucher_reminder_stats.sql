-- Session 20: Gutschein-Ablauf (Sascha 17.08.)
--
-- Zwei Dinge:
--   1. Eine neue Push-Art 'voucher_end' — "Dein Gratismonat endet morgen".
--      Die bestehende Trial-Erinnerung greift nur bei status = 'trialing';
--      Gutschein-Zugaenge stehen auf 'active' und liefen bisher kommentarlos
--      aus. Beim Trial waere Schweigen unfair (es wird danach abgebucht), beim
--      Gutschein ist es nur unelegant — und eine verschenkte Verkaufschance.
--   2. Eine Auswertung fuer den Admin-Bereich: Wer hat welchen Gutschein wann
--      eingeloest, und bis wann laeuft der Zugang. Als security-definer-
--      Funktion mit Admin-Pruefung, weil die E-Mail-Adresse in auth.users
--      liegt und dorthin bewusst keine Client-Policy fuehrt.

-- ---------------------------------------------------------------------------
-- 1) Push-Art erweitern
-- ---------------------------------------------------------------------------

alter table public.push_log drop constraint push_log_kind_check;
alter table public.push_log add constraint push_log_kind_check check (kind in (
  'broadcast', 'qa', 'trial', 'voucher_end', 'streak', 'meal_evening', 'water', 'weekly'
));

-- ---------------------------------------------------------------------------
-- 2) Einloesungen je Gutschein, fuer die aufklappbare Zeile im Admin
--
-- zugang_bis ist der AKTUELLE Stand der Abo-Zeile, nicht der historische
-- Endwert der Einloesung: Kauft jemand nach dem Gutschein ein Abo, steht hier
-- das Abo-Ende — genau das will man am lebenden Konto wissen. noch_aktiv sagt,
-- ob der Zugang gerade gilt.
-- ---------------------------------------------------------------------------

create or replace function public.stats_voucher_redemptions(p_voucher_id uuid)
returns table (
  email text,
  name text,
  eingeloest timestamptz,
  zugang_bis timestamptz,
  noch_aktiv boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  return query
    select
      u.email::text,
      p.display_name,
      r.redeemed_at,
      s.current_period_end,
      coalesce(
        s.status in ('trialing', 'active', 'in_grace')
          and (s.current_period_end is null or s.current_period_end > now()),
        false
      )
    from public.voucher_redemptions r
    join auth.users u on u.id = r.user_id
    left join public.profiles p on p.id = r.user_id
    left join public.subscriptions s on s.user_id = r.user_id
    where r.voucher_id = p_voucher_id
    order by r.redeemed_at desc;
end;
$$;

revoke execute on function public.stats_voucher_redemptions(uuid) from public, anon;
grant execute on function public.stats_voucher_redemptions(uuid) to authenticated;
