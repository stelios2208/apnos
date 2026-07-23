-- Community posts for Apnos: general, free-form posts (title + text + optional
-- photo) that are NOT tied to a fish catch or a dive result. This is the
-- Facebook-style "what's on your mind?" surface — the crew wanted to post
-- adventures, questions and shout-outs without being forced through the catch
-- or dive log.
--
-- One table, public-by-default (the community is small and members kept
-- forgetting to opt in). There is NO sensitive column here — title/body/photo
-- ARE the shared content — so unlike catches this table is read directly
-- (public rows) rather than through a sanitizing view. Photos live in the
-- existing public `catch-photos` bucket (reused as a generic image store; the
-- client re-encodes through a canvas first, stripping all EXIF/GPS).
--
-- AUTHENTICATED-ONLY, matching the rest of the social layer: no grant to
-- `anon`. Idempotent — safe to paste into the hosted Supabase SQL editor and
-- re-run (`if not exists`, `drop policy if exists`).

create table if not exists public.community_posts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  title      text,
  body       text,
  photo_url  text,
  is_public  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;

-- Raw-SQL tables don't always inherit table privileges. No grant to `anon` —
-- posts are visible to signed-in users only in this phase.
grant select, insert, update, delete on public.community_posts to authenticated;

-- SELECT: a post is readable when it is public, or when it is your own (so the
-- author can always see their own private drafts).
drop policy if exists "read public or own post" on public.community_posts;
create policy "read public or own post"
  on public.community_posts for select
  using (is_public = true or auth.uid() = user_id);

-- Writes: owner-only, all three operations.
drop policy if exists "insert own post" on public.community_posts;
create policy "insert own post"
  on public.community_posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own post" on public.community_posts;
create policy "update own post"
  on public.community_posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own post" on public.community_posts;
create policy "delete own post"
  on public.community_posts for delete
  using (auth.uid() = user_id);

-- Feed listing ("what's public") sorts newest-first.
create index if not exists community_posts_public_created_idx
  on public.community_posts (is_public, created_at desc);
