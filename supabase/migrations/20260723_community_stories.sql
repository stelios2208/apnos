-- Community stories: short-lived, image-first posts shown as the tall cards at
-- the top of the feed (Facebook stories). A member uploads a photo (+ optional
-- caption) and it appears as a story card for 24h, then naturally drops out of
-- the feed query.
--
-- Public-by-default, authenticated-only, owner-only writes. Photos live in the
-- existing public `catch-photos` bucket (re-encoded client-side, EXIF stripped).
-- Idempotent — safe to paste into the Supabase SQL editor and re-run.

create table if not exists public.community_stories (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  photo_url  text        not null,
  caption    text,
  is_public  boolean     not null default true,
  created_at timestamptz not null default now()
);

alter table public.community_stories enable row level security;
grant select, insert, delete on public.community_stories to authenticated;

drop policy if exists "read public or own story" on public.community_stories;
create policy "read public or own story"
  on public.community_stories for select
  using (is_public = true or auth.uid() = user_id);

drop policy if exists "insert own story" on public.community_stories;
create policy "insert own story"
  on public.community_stories for insert
  with check (auth.uid() = user_id);

drop policy if exists "delete own story" on public.community_stories;
create policy "delete own story"
  on public.community_stories for delete
  using (auth.uid() = user_id);

create index if not exists community_stories_public_created_idx
  on public.community_stories (is_public, created_at desc);
