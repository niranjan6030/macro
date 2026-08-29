-- =====================================================================
-- MACRO — Postgres schema
--
-- Run this once in the Supabase SQL editor. It is idempotent, so it is
-- safe to run again after an upgrade.
--
-- Two things shape the design:
--
--  1. Identity is Firebase's, not Supabase's. Every user-owned row is
--     keyed by the Firebase uid as text. Supabase's own auth.uid() is
--     never populated, so RLS cannot see who is asking — instead every
--     table is locked shut to the anon key and all access goes through
--     Next.js route handlers that verify the session cookie first and
--     then scope the query by uid themselves. The service-role key never
--     leaves the server.
--
--  2. The diary is append-only history, not current state. A logged
--     entry keeps its own copy of the nutrition it was logged with,
--     rather than pointing at a food row. Composition data gets
--     corrected upstream, and a correction in Open Food Facts must never
--     silently rewrite what someone ate in March.
-- =====================================================================

/*
 * No extensions required.
 *
 * The only thing this schema ever wanted pgcrypto for was gen_random_uuid(),
 * which has been part of core Postgres since version 13 — Supabase runs 15
 * and up. Requiring the extension gained nothing and made the schema
 * impossible to run anywhere that does not ship it, including the harness
 * that now tests it before you do.
 */

-- ---------------------------------------------------------------------
-- Profile: who they are and what they are aiming at
-- ---------------------------------------------------------------------
create table if not exists profiles (
  uid              text primary key,            -- Firebase uid
  display_name     text,
  email            text,
  sex              text check (sex in ('male','female')),
  birth_date       date,
  height_cm        numeric(5,1) check (height_cm between 80 and 260),
  activity         text default 'sedentary'
                     check (activity in ('sedentary','light','moderate','active','very_active')),
  goal             text default 'maintain' check (goal in ('lose','maintain','gain')),
  target_weight_kg numeric(5,1) check (target_weight_kg between 25 and 400),
  training_days    smallint default 3 check (training_days between 0 and 7),
  split            text,                        -- null = let the app choose
  -- Overrides. Null means "use the computed target"; a number means the
  -- person has deliberately taken control, and the app must not quietly
  -- recompute over it.
  kcal_override    integer check (kcal_override between 800 and 8000),
  protein_override integer,
  carbs_override   integer,
  fat_override     integer,
  units            text default 'metric' check (units in ('metric','imperial')),
  timezone         text default 'Asia/Kolkata',
  onboarded_at     timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Food diary
--
-- `nutrients` is the frozen per-entry panel, already scaled to `grams`.
-- `per_100g` is kept alongside it so the entry can be re-scaled if the
-- person corrects the weight without needing to hit the network again.
-- ---------------------------------------------------------------------
create table if not exists diary_entries (
  id           uuid primary key default gen_random_uuid(),
  uid          text not null,
  -- The user's local date, not a timestamp. "What did I eat on Tuesday"
  -- must not change when they fly to another timezone.
  on_date      date not null,
  meal         text not null default 'snack'
                 check (meal in ('breakfast','lunch','dinner','snack')),
  name         text not null,
  brand        text,
  grams        numeric(7,1) not null check (grams > 0 and grams <= 5000),
  source       text not null default 'custom'
                 check (source in ('openfoodfacts','usda','custom','estimate','photo')),
  source_id    text,
  confidence   text check (confidence in ('label','measured','estimated')),
  nutrients    jsonb not null,
  per_100g     jsonb,
  -- Set when the entry came from a photo, so the meal can be shown back.
  photo_path   text,
  logged_at    timestamptz default now()
);

create index if not exists diary_uid_date_idx on diary_entries (uid, on_date desc);

-- ---------------------------------------------------------------------
-- The day itself
--
-- One row per person per day, holding everything that is true of the day
-- rather than of a single entry: bodyweight, rest, and the two switches
-- that stop an honest tracker from becoming a guilt machine.
-- ---------------------------------------------------------------------
create table if not exists days (
  uid          text not null,
  on_date      date not null,
  weight_kg    numeric(5,1) check (weight_kg between 25 and 400),
  -- Rest and cheat days are recorded, never hidden. A cheat day still
  -- logs its food; the flag only changes how the streak and the weekly
  -- average treat it, because one planned high day inside a good week is
  -- not a failure and the app should not call it one.
  rest_day     boolean default false,
  cheat_day    boolean default false,
  steps        integer check (steps >= 0),
  sleep_hours  numeric(3,1) check (sleep_hours between 0 and 24),
  water_ml     integer default 0 check (water_ml >= 0),
  mood         smallint check (mood between 1 and 5),
  note         text,
  updated_at   timestamptz default now(),
  primary key (uid, on_date)
);

-- ---------------------------------------------------------------------
-- Training
-- ---------------------------------------------------------------------
create table if not exists workouts (
  id           uuid primary key default gen_random_uuid(),
  uid          text not null,
  on_date      date not null,
  -- "Push A", "Legs". Free text: people rename their own sessions.
  name         text not null,
  split        text,
  started_at   timestamptz,
  finished_at  timestamptz,
  note         text,
  created_at   timestamptz default now()
);

create index if not exists workouts_uid_date_idx on workouts (uid, on_date desc);

-- Every set, individually.
--
-- One row per set rather than "3x12 @ 40kg" in a text column, because the
-- whole progression engine depends on knowing that the third set dropped
-- to 9 reps. A summary string cannot answer that.
create table if not exists workout_sets (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references workouts(id) on delete cascade,
  uid          text not null,
  exercise_id  text not null,               -- into the exercise library
  exercise_name text not null,              -- frozen, so a renamed library entry
                                            -- does not rewrite old history
  set_index    smallint not null check (set_index >= 1),
  weight_kg    numeric(6,2) not null default 0 check (weight_kg >= 0),
  reps         smallint not null check (reps >= 0),
  -- Reps in reserve. Null when they did not say, which is common and fine.
  rir          smallint check (rir between 0 and 10),
  -- For planks and carries, where reps are meaningless.
  seconds      smallint check (seconds >= 0),
  warmup       boolean default false,
  logged_at    timestamptz default now()
);

create index if not exists sets_uid_exercise_idx
  on workout_sets (uid, exercise_id, logged_at desc);
create index if not exists sets_workout_idx on workout_sets (workout_id, set_index);

-- ---------------------------------------------------------------------
-- Progress photos
--
-- Only the storage path lives here; the image itself is in a private
-- Supabase Storage bucket and is served through short-lived signed URLs.
-- Progress photos are about as personal as data gets and must never sit
-- behind a guessable public URL.
-- ---------------------------------------------------------------------
create table if not exists progress_photos (
  id          uuid primary key default gen_random_uuid(),
  uid         text not null,
  on_date     date not null,
  pose        text default 'front' check (pose in ('front','side','back')),
  path        text not null,
  weight_kg   numeric(5,1),
  note        text,
  created_at  timestamptz default now()
);

create index if not exists photos_uid_date_idx on progress_photos (uid, on_date);

-- ---------------------------------------------------------------------
-- Body measurements
-- ---------------------------------------------------------------------
create table if not exists measurements (
  id          uuid primary key default gen_random_uuid(),
  uid         text not null,
  on_date     date not null,
  body_fat_pct numeric(4,1) check (body_fat_pct between 2 and 70),
  -- Centimetres.
  neck_cm     numeric(5,1),
  chest_cm    numeric(5,1),
  waist_cm    numeric(5,1),
  hips_cm     numeric(5,1),
  thigh_cm    numeric(5,1),
  arm_cm      numeric(5,1),
  created_at  timestamptz default now(),
  unique (uid, on_date)
);

-- ---------------------------------------------------------------------
-- Foods the person entered themselves
--
-- Home recipes and local shop food that no database will ever carry.
-- ---------------------------------------------------------------------
create table if not exists custom_foods (
  id          uuid primary key default gen_random_uuid(),
  uid         text not null,
  name        text not null,
  brand       text,
  barcode     text,
  per_100g    jsonb not null,
  serving_g   numeric(6,1),
  serving_label text,
  created_at  timestamptz default now()
);

create index if not exists custom_foods_uid_idx on custom_foods (uid, name);

-- ---------------------------------------------------------------------
-- Coach notes
--
-- Cached AI reviews, so opening the coach tab twice in a day does not
-- pay for the model twice.
-- ---------------------------------------------------------------------
create table if not exists coach_notes (
  id          uuid primary key default gen_random_uuid(),
  uid         text not null,
  on_date     date not null,
  kind        text not null default 'weekly' check (kind in ('daily','weekly','milestone')),
  body        text not null,
  created_at  timestamptz default now(),
  unique (uid, on_date, kind)
);

-- ---------------------------------------------------------------------
-- Row-level security
--
-- Every table is closed. There is no policy granting the anon key
-- anything, on purpose: the browser never talks to Postgres directly.
-- Reads and writes go through route handlers holding the service-role
-- key, which bypasses RLS, having first verified the Firebase session
-- cookie and scoped the query to that uid.
--
-- If you later move identity to Supabase Auth, this is where the
-- `auth.uid()::text = uid` policies would go.
-- ---------------------------------------------------------------------
/*
 * Written out one table at a time, on purpose.
 *
 * This used to be a loop over an array of table names, executing `alter
 * table` through `format()`. It worked, but no static analyser can see
 * through dynamic SQL — so Supabase's own linter reported the schema as
 * creating nine tables with row-level security switched off, which is the
 * single most alarming thing it could have said about it and was not true.
 *
 * A reviewer had the same problem. Nine explicit lines are longer and answer
 * the question at a glance.
 */
alter table profiles enable row level security;
alter table diary_entries enable row level security;
alter table days enable row level security;
alter table workouts enable row level security;
alter table workout_sets enable row level security;
alter table progress_photos enable row level security;
alter table measurements enable row level security;
alter table custom_foods enable row level security;
alter table coach_notes enable row level security;

-- ---------------------------------------------------------------------
-- Daily totals
--
-- Kept as a view rather than a maintained column so it can never drift
-- from the entries it summarises.
-- ---------------------------------------------------------------------
create or replace view daily_totals as
select
  uid,
  on_date,
  count(*)                                            as entries,
  round(sum((nutrients->>'kcal')::numeric))           as kcal,
  round(sum((nutrients->>'protein')::numeric), 1)     as protein,
  round(sum((nutrients->>'carbs')::numeric), 1)       as carbs,
  round(sum((nutrients->>'fat')::numeric), 1)         as fat,
  round(sum((nutrients->>'fibre')::numeric), 1)       as fibre
from diary_entries
group by uid, on_date;

-- ---------------------------------------------------------------------
-- Storage
--
-- Create a PRIVATE bucket named `progress` in the Supabase dashboard
-- (Storage → New bucket → uncheck "Public bucket"). Photos are written
-- and read with the service-role key and handed to the browser as
-- signed URLs that expire in minutes.
-- ---------------------------------------------------------------------
