-- IRI — Trainings-Bibliothek (Session 9, Zwei-Spuren-Modell, Entscheidung 20.07.)
-- Spur 2: wachsende flache Bibliothek für Irinas neue Hochformat-Videos.
-- tags[] ab Tag 1 (Admin pflegt sie), Filter-Chips erscheinen in der App erst
-- ab ≥2 Tags mit je ≥3 Videos (progressive disclosure — Logik clientseitig).

create table public.training_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_uid text,
  video_format public.video_format not null default 'portrait',
  duration_seconds int check (duration_seconds > 0),
  tags text[] not null default '{}',
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index training_videos_published_idx on public.training_videos (published_at desc)
  where status = 'published';

alter table public.training_videos enable row level security;

create trigger training_videos_updated_at before update on public.training_videos
  for each row execute function public.set_updated_at();

create policy "training_videos_select_subscribers" on public.training_videos
  for select using (status = 'published' and public.is_subscriber());
create policy "training_videos_admin_all" on public.training_videos
  for all using (public.is_admin()) with check (public.is_admin());
