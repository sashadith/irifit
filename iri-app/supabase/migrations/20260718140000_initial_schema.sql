-- IRI — Initiales Schema (Session 2)
-- Quelle: IRI-App-Konzept-v1.docx Kapitel 8 (Datenmodell), Kapitel 5 (Screens), Kapitel 7 (AI-Scan)
-- Alle Tabellen mit Row Level Security: Nutzerinnen sehen nur eigene Daten,
-- Inhalte (Rezepte/Kurse/Broadcasts) sind für aktive Abonnentinnen lesbar,
-- Schreibzugriff auf Inhalte nur für Admin (Irina), Abos nur via Service Role (RevenueCat-Webhook).

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.goal_type as enum ('lose_weight', 'maintain', 'get_fit');
create type public.activity_level as enum ('low', 'medium', 'high');
create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.log_source as enum ('scan', 'barcode', 'search', 'recipe', 'favorite', 'manual');
create type public.content_status as enum ('draft', 'published', 'archived');
create type public.video_format as enum ('portrait', 'landscape');
create type public.question_status as enum ('new', 'answered', 'published');
create type public.subscription_status as enum ('trialing', 'active', 'in_grace', 'paused', 'cancelled', 'expired');

-- ---------------------------------------------------------------------------
-- Helper-Funktionen
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Admin = Irinas Rolle, gesetzt als app_metadata.role = 'admin' (nur serverseitig änderbar)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

-- ---------------------------------------------------------------------------
-- profiles — Nutzerin: Ziele, Basisdaten, Präferenzen, Streak
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  goal public.goal_type,
  birth_year int check (birth_year between 1920 and 2020),
  biological_sex text check (biological_sex in ('female', 'male')),
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  start_weight_kg numeric(5, 1) check (start_weight_kg between 30 and 350),
  target_weight_kg numeric(5, 1) check (target_weight_kg between 30 and 350),
  activity_level public.activity_level,
  diet_preference text,
  allergies text[] not null default '{}',
  -- Untergrenze 1.200 kcal (Produktentscheidung, Schutz vor Crash-Diät)
  kcal_goal int check (kcal_goal >= 1200),
  protein_goal_g int check (protein_goal_g > 0),
  carbs_goal_g int check (carbs_goal_g > 0),
  fat_goal_g int check (fat_goal_g > 0),
  water_goal_ml int not null default 2000 check (water_goal_ml between 500 and 10000),
  water_glass_ml int not null default 250 check (water_glass_ml between 100 and 1500),
  streak_count int not null default 0,
  streak_longest int not null default 0,
  streak_joker_used_on date,
  -- Art. 9 DSGVO: explizite Einwilligung zu Gesundheitsdaten im Onboarding
  health_consent_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_delete_own" on public.profiles
  for delete using (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- subscriptions — Abo-Status je Nutzerin (via RevenueCat-Webhook synchronisiert)
-- Schreibzugriff ausschließlich Service Role (kein Policy-Insert für Clients)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rc_customer_id text,
  status public.subscription_status not null default 'expired',
  product_id text,
  entitlement text not null default 'pro',
  will_renew boolean,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create policy "subscriptions_select_own" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

-- Aktive Abonnentin (oder Admin). SECURITY DEFINER, damit Policies anderer
-- Tabellen den Abo-Status prüfen können, ohne an der RLS von subscriptions zu hängen.
create or replace function public.is_subscriber()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status in ('trialing', 'active', 'in_grace')
      and (s.current_period_end is null or s.current_period_end > now())
  )
$$;

-- ---------------------------------------------------------------------------
-- food_logs — Tagebucheinträge
-- ---------------------------------------------------------------------------

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null default current_date,
  slot public.meal_slot not null,
  source public.log_source not null,
  title text not null,
  kcal int not null check (kcal between 0 and 10000),
  protein_g numeric(6, 1) check (protein_g >= 0),
  carbs_g numeric(6, 1) check (carbs_g >= 0),
  fat_g numeric(6, 1) check (fat_g >= 0),
  -- Scan-Details: Zutatenliste, Konfidenz, Korrekturen, Barcode, Portionsfaktor …
  details jsonb not null default '{}',
  recipe_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index food_logs_user_day_idx on public.food_logs (user_id, logged_on);

alter table public.food_logs enable row level security;

create trigger food_logs_updated_at before update on public.food_logs
  for each row execute function public.set_updated_at();

create policy "food_logs_own" on public.food_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- weights — Gewichtseinträge (1 pro Tag)
-- ---------------------------------------------------------------------------

create table public.weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5, 1) not null check (weight_kg between 30 and 350),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

alter table public.weights enable row level security;

create policy "weights_own" on public.weights
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- water_logs — Wasser pro Tag (aggregierte Menge in ml)
-- ---------------------------------------------------------------------------

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null default current_date,
  amount_ml int not null default 0 check (amount_ml between 0 and 20000),
  updated_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

alter table public.water_logs enable row level security;

create trigger water_logs_updated_at before update on public.water_logs
  for each row execute function public.set_updated_at();

create policy "water_logs_own" on public.water_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- progress_photos — privat, nur die Nutzerin selbst (Fotos im privaten Bucket)
-- ---------------------------------------------------------------------------

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  taken_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index progress_photos_user_idx on public.progress_photos (user_id, taken_on);

alter table public.progress_photos enable row level security;

create policy "progress_photos_own" on public.progress_photos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- recipes — Irinas Rezepte (Import-IDs aus Excel bleiben stabil)
-- ---------------------------------------------------------------------------

create table public.recipes (
  id bigint generated by default as identity primary key,
  title text not null,
  category text not null,
  description text,
  -- [{ "name": "...", "menge_anzeige": "25 g", "gramm": 25 }, …]
  ingredients jsonb not null default '[]',
  instructions text,
  servings int not null default 1 check (servings between 1 and 50),
  servings_note text,
  kcal_total int check (kcal_total >= 0),
  kcal_per_serving int not null check (kcal_per_serving >= 0),
  protein_per_serving_g numeric(6, 1) check (protein_per_serving_g >= 0),
  carbs_per_serving_g numeric(6, 1) check (carbs_per_serving_g >= 0),
  fat_per_serving_g numeric(6, 1) check (fat_per_serving_g >= 0),
  -- Rechenweg aus der Excel (Annahmen: Milch 1,5 %, 1 EL Öl = 10 g …)
  nutrition_note text,
  tags text[] not null default '{}',
  image_path text,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_category_idx on public.recipes (category) where status = 'published';

alter table public.recipes enable row level security;

create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create policy "recipes_select_subscribers" on public.recipes
  for select using (status = 'published' and public.is_subscriber());
create policy "recipes_admin_all" on public.recipes
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.food_logs
  add constraint food_logs_recipe_fk foreign key (recipe_id)
  references public.recipes (id) on delete set null;

-- ---------------------------------------------------------------------------
-- favorites — Nutzerin ↔ Rezept oder Lebensmittel (Barcode/Suche, ab Session 6)
-- ---------------------------------------------------------------------------

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'recipe' check (kind in ('recipe', 'food')),
  recipe_id bigint references public.recipes (id) on delete cascade,
  food_item jsonb,
  created_at timestamptz not null default now(),
  check (
    (kind = 'recipe' and recipe_id is not null and food_item is null)
    or (kind = 'food' and food_item is not null and recipe_id is null)
  )
);

create unique index favorites_user_recipe_idx on public.favorites (user_id, recipe_id)
  where recipe_id is not null;
create index favorites_user_idx on public.favorites (user_id);

alter table public.favorites enable row level security;

create policy "favorites_own" on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- courses / lessons — Ernährungskurs & Trainings; legacy = alte Digistore24-Kurse
-- ---------------------------------------------------------------------------

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sort_order int not null default 0,
  is_legacy boolean not null default false,
  -- verbindet legacy-Kurse mit legacy_customers.purchased_course_slugs
  legacy_slug text unique,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_legacy or legacy_slug is not null)
);

alter table public.courses enable row level security;

create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- legacy_customers — Import aus Digistore24 (E-Mail → Magic-Link → Legacy-Zugang)
-- Claim (claimed_by setzen) erfolgt serverseitig per Edge Function (Service Role)
-- ---------------------------------------------------------------------------

create table public.legacy_customers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  digistore_order_ids text[] not null default '{}',
  purchased_course_slugs text[] not null default '{}',
  imported_at timestamptz not null default now(),
  claimed_by uuid unique references auth.users (id) on delete set null,
  claimed_at timestamptz
);

alter table public.legacy_customers enable row level security;

create policy "legacy_customers_select_own" on public.legacy_customers
  for select using (claimed_by = auth.uid() or public.is_admin());
create policy "legacy_customers_admin_write" on public.legacy_customers
  for all using (public.is_admin()) with check (public.is_admin());

-- Zugriff auf einen Legacy-Kurs: Nutzerin hat ihn bei Digistore24 gekauft
create or replace function public.has_legacy_access(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    join public.legacy_customers lc on lc.claimed_by = auth.uid()
    where c.id = p_course_id
      and c.is_legacy
      and c.legacy_slug = any (lc.purchased_course_slugs)
  )
$$;

create policy "courses_select_subscribers" on public.courses
  for select using (
    status = 'published'
    and (
      (not is_legacy and public.is_subscriber())
      or public.has_legacy_access(id)
    )
  );
create policy "courses_admin_all" on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  summary text,
  -- Cloudflare Stream Video-UID (Wiedergabe über signierte URLs)
  video_uid text,
  video_format public.video_format not null default 'portrait',
  duration_seconds int check (duration_seconds > 0),
  sort_order int not null default 0,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_course_idx on public.lessons (course_id, sort_order);

alter table public.lessons enable row level security;

create trigger lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

-- Sichtbarkeit erbt vom Kurs: Subquery läuft unter der RLS von courses
create policy "lessons_select_visible_course" on public.lessons
  for select using (
    status = 'published'
    and exists (select 1 from public.courses c where c.id = lessons.course_id)
  );
create policy "lessons_admin_all" on public.lessons
  for all using (public.is_admin()) with check (public.is_admin());

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.lesson_progress enable row level security;

create policy "lesson_progress_own" on public.lesson_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- broadcasts / broadcast_reactions — Irina sendet, Emoji-Reaktionen, KEIN Chat
-- ---------------------------------------------------------------------------

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  image_path text,
  audio_path text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  send_push boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index broadcasts_sent_idx on public.broadcasts (sent_at desc) where sent_at is not null;

alter table public.broadcasts enable row level security;

create trigger broadcasts_updated_at before update on public.broadcasts
  for each row execute function public.set_updated_at();

create policy "broadcasts_select_subscribers" on public.broadcasts
  for select using (sent_at is not null and sent_at <= now() and public.is_subscriber());
create policy "broadcasts_admin_all" on public.broadcasts
  for all using (public.is_admin()) with check (public.is_admin());

create table public.broadcast_reactions (
  broadcast_id uuid not null references public.broadcasts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🔥', '💪', '😂', '👏')),
  created_at timestamptz not null default now(),
  primary key (broadcast_id, user_id, emoji)
);

alter table public.broadcast_reactions enable row level security;

-- Zählerstände sind für alle Abonnentinnen sichtbar
create policy "broadcast_reactions_select_subscribers" on public.broadcast_reactions
  for select using (public.is_subscriber());
create policy "broadcast_reactions_insert_own" on public.broadcast_reactions
  for insert with check (
    user_id = auth.uid()
    and public.is_subscriber()
    and exists (select 1 from public.broadcasts b where b.id = broadcast_id)
  );
create policy "broadcast_reactions_delete_own" on public.broadcast_reactions
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- questions — Q&A-Einsendungen (neu → beantwortet → veröffentlicht)
-- ---------------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  body text not null,
  status public.question_status not null default 'new',
  answer text,
  answered_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index questions_status_idx on public.questions (status, created_at desc);

alter table public.questions enable row level security;

create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

create policy "questions_select_own_or_published" on public.questions
  for select using (
    user_id = auth.uid()
    or (status = 'published' and public.is_subscriber())
    or public.is_admin()
  );
create policy "questions_insert_own" on public.questions
  for insert with check (user_id = auth.uid() and public.is_subscriber());
-- Zurückziehen/Ändern nur solange unbeantwortet
create policy "questions_update_own_new" on public.questions
  for update using (user_id = auth.uid() and status = 'new')
  with check (user_id = auth.uid() and status = 'new');
create policy "questions_delete_own_new" on public.questions
  for delete using (user_id = auth.uid() and status = 'new');
create policy "questions_admin_all" on public.questions
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- vouchers / voucher_redemptions — Gutscheine (Einlösung via Edge Function)
-- Kein Client-Lesezugriff auf Codes; Einlösung schreibt die Service Role
-- ---------------------------------------------------------------------------

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  description text,
  free_months int not null default 1 check (free_months between 1 and 24),
  valid_from timestamptz,
  valid_until timestamptz,
  max_redemptions int check (max_redemptions > 0),
  redemption_count int not null default 0 check (redemption_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vouchers enable row level security;

create trigger vouchers_updated_at before update on public.vouchers
  for each row execute function public.set_updated_at();

create policy "vouchers_admin_all" on public.vouchers
  for all using (public.is_admin()) with check (public.is_admin());

create table public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (voucher_id, user_id)
);

alter table public.voucher_redemptions enable row level security;

create policy "voucher_redemptions_select_own" on public.voucher_redemptions
  for select using (user_id = auth.uid() or public.is_admin());
