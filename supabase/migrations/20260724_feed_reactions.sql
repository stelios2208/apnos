-- Real, shared likes across the community — so a post/dive/catch/story shows a
-- like count and WHO liked it (little profile pics), instead of a device-local
-- heart. Also the foundation for "interaction → friend" later.
--
-- One row per (target, user, kind). `target_type` scopes the id to a feature
-- ('post' | 'dive' | 'catch' | 'story'); `kind` is 'heart' for now. Readable by
-- any signed-in member (to render who liked); writable only for your own row.
-- Authenticated-only. Idempotent.

create table if not exists public.feed_reactions (
  id          uuid        primary key default gen_random_uuid(),
  target_type text        not null,
  target_id   uuid        not null,
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text        not null default 'heart',
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, user_id, kind)
);

alter table public.feed_reactions enable row level security;
grant select, insert, delete on public.feed_reactions to authenticated;

-- Anyone signed in can see reactions (needed to show likers + counts).
drop policy if exists "read reactions" on public.feed_reactions;
create policy "read reactions"
  on public.feed_reactions for select
  using (true);

-- You can only add / remove your OWN reaction.
drop policy if exists "insert own reaction" on public.feed_reactions;
create policy "insert own reaction"
  on public.feed_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "delete own reaction" on public.feed_reactions;
create policy "delete own reaction"
  on public.feed_reactions for delete
  using (auth.uid() = user_id);

create index if not exists feed_reactions_target_idx
  on public.feed_reactions (target_type, target_id);
