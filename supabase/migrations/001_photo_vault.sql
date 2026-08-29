-- ---------------------------------------------------------------------
-- Photo vault, retention, and exercises people add themselves.
--
-- schema.sql is written with `create table if not exists`, which is exactly
-- wrong for a database that already has these tables: it skips them and the
-- new columns never arrive. This file is the part that has to be said out
-- loud. It is safe to run more than once.
--
-- Run it in the Supabase SQL editor, or against the connection string, in
-- either order relative to schema.sql.
-- ---------------------------------------------------------------------

-- --- progress photos become sealed blobs with a lifetime --------------

alter table progress_photos add column if not exists iv         text;
alter table progress_photos add column if not exists expires_at date;
alter table progress_photos add column if not exists purged_at  timestamptz;

-- A purged row keeps its date and weight and loses its bytes, so the path
-- has to be allowed to go away.
alter table progress_photos alter column path drop not null;

create index if not exists progress_photos_expiry_idx
  on progress_photos (expires_at) where path is not null;

-- Photos already stored were uploaded before the vault existed and are
-- therefore readable by whoever holds the bucket. Leaving them that way
-- silently would be the wrong default: give them six months from their own
-- date, the same as everything written from here on.
update progress_photos
   set expires_at = on_date + interval '180 days'
 where expires_at is null and path is not null;

-- --- the vault itself -------------------------------------------------

create table if not exists photo_vault (
  uid            text primary key,
  salt           text not null,
  verifier       text not null,
  retention_days smallint not null default 180
                 check (retention_days between 7 and 3650),
  created_at     timestamptz default now()
);

-- --- exercises people add themselves ----------------------------------

create table if not exists custom_exercises (
  id          uuid primary key default gen_random_uuid(),
  uid         text not null,
  name        text not null,
  primary_muscle text not null
    check (primary_muscle in ('chest','back','shoulders','quads','hamstrings',
                              'glutes','biceps','triceps','calves','core')),
  equipment   text not null default 'bodyweight'
    check (equipment in ('barbell','dumbbell','machine','cable','bodyweight')),
  rep_low     smallint not null default 8 check (rep_low between 1 and 100),
  rep_high    smallint not null default 12 check (rep_high between 1 and 200),
  note        text,
  created_at  timestamptz default now(),
  unique (uid, name)
);

create index if not exists custom_exercises_uid_idx on custom_exercises (uid, name);

-- --- and both are closed to the anon key ------------------------------
--
-- On with no policies means nobody reaches these through the public API.
-- Every read and write goes through a route holding the secret key, which
-- has already checked whose session it is.

alter table photo_vault      enable row level security;
alter table custom_exercises enable row level security;
