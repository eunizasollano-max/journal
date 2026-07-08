-- Adds cloud sync for Daily Routines (previously local-only / IndexedDB
-- only). Mirrors the existing entries/goals/recap pattern: one encrypted
-- `data` jsonb column per row, RLS restricted to the owning user.
--
-- This project has no Supabase CLI project linked in this repo (no prior
-- migrations, no service-role access from the app), so this file was
-- never run automatically — copy it into the Supabase SQL editor
-- (Dashboard → SQL Editor → New query) and run it once.
--
-- Sanity-check first: confirm your existing `goals` table really has
-- columns (user_id uuid, month_key text, data jsonb, updated_at
-- timestamptz) via Table Editor — these statements assume that shape.

-- One row per routine item (checklist entries + recurrence rules).
create table if not exists public.routines (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  routine_id text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, routine_id)
);

alter table public.routines enable row level security;

create policy "Users manage their own routines"
  on public.routines
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One row per date — which routines were checked off that day.
create table if not exists public.routine_log (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  date       text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.routine_log enable row level security;

create policy "Users manage their own routine log"
  on public.routine_log
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Single row per user — section names/colors (localStorage is the local
-- source of truth; this is just what a second device pulls down).
create table if not exists public.routine_sections (
  user_id    uuid        not null references auth.users(id) on delete cascade primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.routine_sections enable row level security;

create policy "Users manage their own routine sections"
  on public.routine_sections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
