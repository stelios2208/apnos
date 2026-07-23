-- Optional photo on a freediving dive (same idea as spearo catch photos), so a
-- shared dive can show an image in the community feed instead of only the
-- discipline gradient. Photos live in the existing public `catch-photos` bucket
-- (re-encoded client-side, EXIF stripped).
--
-- The `feed_dives` view is widened to expose `photo_url` — still a SAFE column
-- (a shareable image, no location/notes/wellness). The base table stays
-- owner-only; the view remains the sole cross-user surface. Idempotent.

alter table public.dives
  add column if not exists photo_url text;

create or replace view public.feed_dives as
  select
    id,
    user_id,
    discipline,
    result,
    dive_date,
    is_personal_best,
    photo_url,
    created_at
  from public.dives
  where shared_to_feed = true;

revoke all on public.feed_dives from anon, public;
grant select on public.feed_dives to authenticated;
