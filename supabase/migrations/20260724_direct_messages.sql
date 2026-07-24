-- Direct messages between any two members (profile ↔ profile), which also
-- covers messaging the coach (the admin is just another user). Supersedes the
-- admin-only admin_messages thread with a general 1:1 DM model.
--
-- Includes the admin bookkeeping (app_admins + is_admin + get_admin_id) so the
-- "Message the coach" shortcut can find the admin's id. Idempotent — safe to
-- paste into the Supabase SQL editor and re-run.

-- ── admins (who the coach is) ────────────────────────────────────────────────
create table if not exists public.app_admins (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

insert into public.app_admins (user_id)
select id from auth.users
where email in ('steliosmarkis@hotmail.com', 'techfollow.eshop@gmail.com')
on conflict (user_id) do nothing;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- First admin's id, so members can start a DM with the coach without the admin
-- roster being public. SECURITY DEFINER bypasses app_admins' RLS.
create or replace function public.get_admin_id()
returns uuid language sql security definer stable set search_path = public as $$
  select user_id from public.app_admins order by created_at limit 1;
$$;
grant execute on function public.get_admin_id() to authenticated;

-- ── direct messages ──────────────────────────────────────────────────────────
create table if not exists public.direct_messages (
  id           uuid        primary key default gen_random_uuid(),
  sender_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  recipient_id uuid        not null references auth.users(id) on delete cascade,
  body         text        not null,
  created_at   timestamptz not null default now()
);

alter table public.direct_messages enable row level security;
grant select, insert on public.direct_messages to authenticated;

-- You can read a message only if you're one of the two parties.
drop policy if exists "read own dms" on public.direct_messages;
create policy "read own dms"
  on public.direct_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- You can only send AS yourself.
drop policy if exists "send own dms" on public.direct_messages;
create policy "send own dms"
  on public.direct_messages for insert
  with check (auth.uid() = sender_id);

create index if not exists direct_messages_pair_idx
  on public.direct_messages (sender_id, recipient_id, created_at);
create index if not exists direct_messages_recipient_idx
  on public.direct_messages (recipient_id, created_at);
