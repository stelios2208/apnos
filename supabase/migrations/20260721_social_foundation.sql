-- Social foundation for Apnos Spearo: opt-in public profiles + community feed.
--
-- Four pieces, in dependency order:
--   1. `profiles` — dedicated public-profile table (opt-in via `is_public`,
--      default OFF). Social features read ONLY this table; the freediving
--      athlete profile keeps living in auth user_metadata untouched.
--   2. `spearo_catches.shared_to_feed` — per-catch opt-in share flag,
--      default OFF. The base table's OWNER-ONLY RLS is NOT touched.
--   3. `feed_catches` view — the ONLY public surface over catches. Standard
--      (definer-semantics) view that selects exclusively SAFE columns.
--   4. `avatars` storage bucket — public read, owner-only write/delete.
--
-- SECURITY — SPOT SECRECY IS A HARD REQUIREMENT (see 20260720_spearo_catches.sql):
-- `spearo_catches` keeps its owner-only RLS; NO new row policy is added to it.
-- Cross-user exposure happens ONLY through the `feed_catches` view below, which
-- never selects `spot` or `notes` (or any other sensitive column). Because a
-- standard view runs with DEFINER semantics (the view owner bypasses the base
-- table's RLS), the view's column list + WHERE clause are the entire exposure
-- surface — which is exactly why the base table can stay owner-only.
--
-- Feed & public profiles are AUTHENTICATED-ONLY in this phase: `anon` gets no
-- grant on `profiles` and an explicit REVOKE on `feed_catches`.
--
-- Idempotent: safe to paste into the hosted Supabase SQL editor and re-run by
-- hand (`if not exists` everywhere, `drop policy if exists` before each policy,
-- `create or replace view`, `on conflict do nothing` for the bucket).

-- ── 1. profiles ──────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  user_id      uuid        primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  bio          text,
  country      text,
  is_public    boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Table-level privileges (raw-SQL tables don't always inherit these).
-- NOTE: no grant to `anon` — public profiles are visible to signed-in users only
-- in this phase.
grant select, insert, update, delete on public.profiles to authenticated;

-- SELECT: a profile is readable when it is public, or when it is your own
-- (so the owner can always see/edit their row before opting in).
drop policy if exists "read public or own profile" on public.profiles;
create policy "read public or own profile"
  on public.profiles for select
  using (is_public = true or auth.uid() = user_id);

-- Writes: owner-only, all three operations.
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own profile" on public.profiles;
create policy "delete own profile"
  on public.profiles for delete
  using (auth.uid() = user_id);

-- Directory listing ("who is public") sorts newest-first.
create index if not exists profiles_public_created_idx
  on public.profiles (is_public, created_at desc);

-- ── 2. spearo_catches.shared_to_feed ─────────────────────────────────────────
-- Per-catch opt-in, default OFF: nothing is shared unless the owner flips it.
-- No RLS change on the base table — its policies remain owner-only.

alter table public.spearo_catches
  add column if not exists shared_to_feed boolean not null default false;

create index if not exists spearo_catches_feed_idx
  on public.spearo_catches (shared_to_feed, created_at desc);

-- ── 3. feed_catches view ─────────────────────────────────────────────────────
-- The ONLY cross-user read surface over catches. SAFE columns only:
-- NO `spot`, NO `notes`, NO `conditions`/`gear` blobs. Definer semantics
-- (standard view) deliberately bypass the base table's owner-only RLS — the
-- WHERE clause restricts rows to explicitly shared catches, and the column
-- list restricts what those rows reveal.

create or replace view public.feed_catches as
  select
    id,
    user_id,
    species_code,
    species_custom,
    weight_kg,
    size_cm,
    max_depth_m,
    photo_url,
    caught_at,
    created_at
  from public.spearo_catches
  where shared_to_feed = true;

-- Authenticated-only in this phase: strip any default grants from `anon` (and
-- PUBLIC, which `anon` inherits), then grant signed-in users read access.
revoke all on public.feed_catches from anon, public;
grant select on public.feed_catches to authenticated;

-- ── 4. avatars storage bucket ────────────────────────────────────────────────
-- Files live at:  <uid>/avatar.jpg
-- Public read (so <img> tags can render avatars via getPublicUrl); only the
-- owner may upload / overwrite / delete their own file. Mirrors
-- 20260703_voice_cues_storage.sql / 20260720_catch_photos_bucket.sql exactly.
-- Avatars are re-encoded client-side through a canvas before upload (see
-- src/lib/profiles.ts), which strips ALL EXIF/GPS metadata from the image.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars owner list" on storage.objects;
create policy "avatars owner list"
  on storage.objects for select
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
