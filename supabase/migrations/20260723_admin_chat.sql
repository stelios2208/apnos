-- Direct chat between each member and the admin (Messenger-style), so members
-- can reach the coach/admin from inside the app instead of by email.
--
-- Two tables + one helper:
--   1. `app_admins`   — who the admins are (just a list of user ids). Read only
--      through the SECURITY DEFINER `is_admin()` helper so the admin list is
--      never exposed to normal members.
--   2. `is_admin()`   — SECURITY DEFINER boolean used by the message policies.
--   3. `admin_messages` — one row per message. `user_id` is always the MEMBER
--      side of the thread (the thread owner); `sender` says who wrote it
--      ('user' or 'admin'). A member sees only their own thread; an admin sees
--      and can answer every thread.
--
-- AUTHENTICATED-ONLY. Idempotent — safe to paste into the Supabase SQL editor
-- and re-run.

-- ── 1. app_admins ────────────────────────────────────────────────────────────
create table if not exists public.app_admins (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
-- No policies: the table is reachable only via the SECURITY DEFINER helper
-- below (and the service role in the SQL editor). This keeps the admin roster
-- private from members.

-- Seed the owner as the first admin (no-op if the account/row already exists).
insert into public.app_admins (user_id)
select id from auth.users where email = 'techfollow.eshop@gmail.com'
on conflict (user_id) do nothing;

-- ── 2. is_admin() helper ─────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- ── 3. admin_messages ────────────────────────────────────────────────────────
create table if not exists public.admin_messages (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  sender     text        not null check (sender in ('user', 'admin')),
  body       text        not null,
  created_at timestamptz not null default now()
);

alter table public.admin_messages enable row level security;
grant select, insert on public.admin_messages to authenticated;

-- SELECT: your own thread, or everything if you're an admin.
drop policy if exists "read own thread or admin" on public.admin_messages;
create policy "read own thread or admin"
  on public.admin_messages for select
  using (auth.uid() = user_id or public.is_admin());

-- INSERT (member): can only write into their OWN thread, tagged sender='user'.
drop policy if exists "member sends to own thread" on public.admin_messages;
create policy "member sends to own thread"
  on public.admin_messages for insert
  with check (auth.uid() = user_id and sender = 'user');

-- INSERT (admin): can answer ANY thread, tagged sender='admin'.
drop policy if exists "admin replies to any thread" on public.admin_messages;
create policy "admin replies to any thread"
  on public.admin_messages for insert
  with check (public.is_admin() and sender = 'admin');

-- Thread reads sort chronologically; admin inbox groups by member.
create index if not exists admin_messages_thread_idx
  on public.admin_messages (user_id, created_at);
