-- Session-14-Feedback: Push-Übergabepunkt für Q&A-Antworten (Versand kommt in S12,
-- analog broadcasts.send_push — der Cron/Edge-Versand liest das Flag)
alter table public.questions
  add column if not exists send_push boolean not null default false;
