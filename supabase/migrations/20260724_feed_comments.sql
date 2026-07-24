-- Comments on community content — so a post/dive/catch/story can hold a real
-- conversation underneath it (this replaces the old "message the author" icon:
-- the icon under a post now opens comments, not a DM).
--
-- One row per comment, scoped by (target_type, target_id) exactly like
-- feed_reactions. Readable by any signed-in member; you can add your own and
-- delete your own. Authenticated-only. Idempotent.

create table if not exists public.feed_comments (
  id          uuid        primary key default gen_random_uuid(),
  target_type text        not null,
  target_id   uuid        not null,
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  body        text        not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

alter table public.feed_comments enable row level security;
grant select, insert, delete on public.feed_comments to authenticated;

-- Anyone signed in can read comments (to render the thread + count).
drop policy if exists "read comments" on public.feed_comments;
create policy "read comments"
  on public.feed_comments for select
  using (true);

-- You can only add a comment as yourself.
drop policy if exists "insert own comment" on public.feed_comments;
create policy "insert own comment"
  on public.feed_comments for insert
  with check (auth.uid() = user_id);

-- You can only delete your OWN comment.
drop policy if exists "delete own comment" on public.feed_comments;
create policy "delete own comment"
  on public.feed_comments for delete
  using (auth.uid() = user_id);

create index if not exists feed_comments_target_idx
  on public.feed_comments (target_type, target_id, created_at);
