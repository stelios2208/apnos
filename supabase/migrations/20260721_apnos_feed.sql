-- Apnos (freediving) community sharing: per-dive opt-in + sanitized feed view.
--
-- The freediving counterpart of the Spearo pieces in
-- 20260721_social_foundation.sql, following the exact same security model:
--
--   1. `dives.shared_to_feed` — per-dive opt-in share flag, default OFF.
--      The base table's OWNER-ONLY RLS is NOT touched; NO new row policy.
--   2. `feed_dives` view — the ONLY cross-user surface over dives. Standard
--      (definer-semantics) view exposing exclusively SAFE columns:
--      id, user_id, discipline, result, dive_date, is_personal_best,
--      created_at. NEVER `notes` (holds Rounds JSON + personal text),
--      NEVER `sleep_hours` / `food_notes` / `mental_state` (wellness),
--      NEVER gear or conditions columns.
--
-- Because a standard view runs with DEFINER semantics (the view owner
-- bypasses the base table's RLS), the view's column list + WHERE clause are
-- the entire exposure surface — which is exactly why `dives` can stay
-- owner-only with no policy changes.
--
-- Authenticated-only in this phase: explicit REVOKE from `anon` (and PUBLIC,
-- which `anon` inherits) on the view, mirroring `feed_catches`.
--
-- Idempotent: safe to paste into the hosted Supabase SQL editor and re-run by
-- hand (`if not exists` / `create or replace view`).

-- ── 1. dives.shared_to_feed ──────────────────────────────────────────────────
-- Per-dive opt-in, default OFF: nothing is shared unless the owner flips it.

alter table public.dives
  add column if not exists shared_to_feed boolean not null default false;

create index if not exists dives_feed_idx
  on public.dives (shared_to_feed, created_at desc);

-- ── 2. feed_dives view ───────────────────────────────────────────────────────
-- SAFE columns only — see the header note for the exhaustive exclusion list.

create or replace view public.feed_dives as
  select
    id,
    user_id,
    discipline,
    result,
    dive_date,
    is_personal_best,
    created_at
  from public.dives
  where shared_to_feed = true;

revoke all on public.feed_dives from anon, public;
grant select on public.feed_dives to authenticated;
