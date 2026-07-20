-- Spearfishing catch log (Apnos Spearo).
--
-- Persistence for the `SpearoCatch` type in src/lib/spearo.ts. Columns map 1:1
-- to that type; `conditions`, `gear` and `spot` are JSONB blobs (see
-- SpearoConditions / SpearoGear).
--
-- SECURITY — SPOT SECRECY IS A HARD REQUIREMENT:
-- Unlike `competition_results`, this table has NO public / cross-user read
-- policy. The `spot` column holds private catch coordinates, and spot secrecy is
-- a non-negotiable expectation in spearfishing — a row here must NEVER be
-- readable by anyone but its owner. RLS below is OWNER-ONLY for all four
-- operations. Any future community/feed feature MUST serve a SEPARATE payload
-- that omits `spot` (and any other sensitive location data); it must never read
-- from this table directly or relax these policies.
--
-- Idempotent: safe to re-run by hand in the hosted Supabase SQL editor (there is
-- no local Supabase). `create table if not exists`, `create index if not
-- exists`, and `drop policy if exists` before each `create policy`.

create table if not exists public.spearo_catches (
  id               uuid        default gen_random_uuid() primary key,
  user_id          uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  caught_at        timestamptz,
  created_at       timestamptz not null default now(),
  species_code     text,
  species_custom   text,
  size_cm          numeric,
  weight_kg        numeric,
  quantity         integer     not null default 1,
  max_depth_m      numeric,
  conditions       jsonb,
  gear             jsonb,
  spot             jsonb,
  photo_url        text,
  notes            text,
  is_personal_best boolean     not null default false
);

alter table public.spearo_catches enable row level security;

-- Table-level privileges. Raw-SQL tables don't always inherit these, and without
-- them Postgres returns "permission denied for table" before RLS is even checked.
-- NOTE: no grant to `anon` — this table is owner-only (see spot-secrecy note).
grant select, insert, update, delete on public.spearo_catches to authenticated;

-- OWNER-ONLY policies. No public/cross-user read exists by design (spot secrecy).
drop policy if exists "read own spearo_catches" on public.spearo_catches;
create policy "read own spearo_catches"
  on public.spearo_catches for select
  using (auth.uid() = user_id);

drop policy if exists "insert own spearo_catches" on public.spearo_catches;
create policy "insert own spearo_catches"
  on public.spearo_catches for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own spearo_catches" on public.spearo_catches;
create policy "update own spearo_catches"
  on public.spearo_catches for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own spearo_catches" on public.spearo_catches;
create policy "delete own spearo_catches"
  on public.spearo_catches for delete
  using (auth.uid() = user_id);

create index if not exists spearo_catches_user_caught_idx
  on public.spearo_catches (user_id, caught_at desc);
