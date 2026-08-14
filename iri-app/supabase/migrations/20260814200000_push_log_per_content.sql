-- Push-Sperre: pro Beitrag statt pro Tag (Sascha 14.08.)
--
-- Bisher galt `unique (user_id, kind, sent_on)` — ein Broadcast-Push pro Person
-- und Tag, EGAL welcher Broadcast. Folge: Irina sendete am 14.08. um 13:02 und
-- um 18:39; der zweite Push wurde bei allen vier Empfaengerinnen still in den
-- Unique-Konflikt geschickt und nie zugestellt. Im Admin stand nur „Push an 0
-- Geraete raus", ohne Grund.
--
-- Neue Regel, getrennt nach Art des Pushes:
--   * inhaltsgetrieben (broadcast, qa) — sie tragen eine ref_id: einmal je
--     Beitrag. Zwei Broadcasts am Tag ergeben zwei Pushes.
--   * automatisch (streak, water, meal_evening, weekly, trial) — ohne ref_id:
--     weiterhin hoechstens einmal je Art und Tag, damit die App nicht nervt.
--
-- Umgesetzt mit zwei partiellen Unique-Indizes; die alte Regel faellt weg.

alter table public.push_log drop constraint if exists push_log_user_id_kind_sent_on_key;

create unique index if not exists push_log_content_uniq
  on public.push_log (user_id, kind, ref_id)
  where ref_id is not null;

create unique index if not exists push_log_daily_uniq
  on public.push_log (user_id, kind, sent_on)
  where ref_id is null;
