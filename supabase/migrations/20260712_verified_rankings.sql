-- ============================================================================
-- Verified rankings — schema only (competitions, performances, proofs bucket).
-- Idempotent: safe to re-run. Apply manually in the Supabase SQL editor.
-- ============================================================================

-- ── Admin check ─────────────────────────────────────────────────────────────
-- Admin status lives in the user's app_metadata (only settable via the service
-- role / SQL editor — never by the user), and is surfaced in the JWT. To make a
-- user an admin, see the one-off UPDATE at the bottom of this file.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

-- ── 1. competitions (official events — admin-curated) ───────────────────────
create table if not exists public.competitions (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  location     text        default '',
  country_code text        default '',
  federation   text        not null check (federation in ('AIDA', 'CMAS')),
  date         date,
  created_at   timestamptz not null default now()
);

alter table public.competitions enable row level security;

grant select on public.competitions to anon, authenticated;
grant insert, update, delete on public.competitions to authenticated;

drop policy if exists "competitions public read" on public.competitions;
create policy "competitions public read"
  on public.competitions for select
  using (true);

drop policy if exists "competitions admin insert" on public.competitions;
create policy "competitions admin insert"
  on public.competitions for insert
  with check (public.is_admin());

drop policy if exists "competitions admin update" on public.competitions;
create policy "competitions admin update"
  on public.competitions for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "competitions admin delete" on public.competitions;
create policy "competitions admin delete"
  on public.competitions for delete
  using (public.is_admin());

-- ── 2. performances (athlete-declared results) ──────────────────────────────
create table if not exists public.performances (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  discipline      text        not null check (discipline in
                    ('STA','DYN','DYNB','DNF','CWT','CWTB','CNF','FIM')),
  value           numeric     not null check (value >= 0),  -- seconds (STA) / metres
  competition_id  uuid        references public.competitions(id) on delete set null,
  proof_photo_url text,
  status          text        not null default 'self_reported'
                    check (status in ('self_reported','pending','verified','rejected')),
  is_public       boolean     not null default false,
  created_at      timestamptz not null default now()
);

alter table public.performances enable row level security;

grant select on public.performances to anon, authenticated;
grant insert, update, delete on public.performances to authenticated;

create index if not exists performances_ranking_idx
  on public.performances (discipline, value desc);
create index if not exists performances_user_idx
  on public.performances (user_id);
create index if not exists performances_status_idx
  on public.performances (status);

-- Athletes never choose their own status: it's derived on write, and only an
-- admin may move a row to verified/rejected. This also stops a user from
-- re-deriving away a verified status just by editing other fields.
create or replace function public.enforce_performance_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    -- Admins only bypass the derivation when EXPLICITLY seeding a reviewed
    -- status. The app never sends status on declare, so without this check an
    -- admin's own declarations landed on the column default (self_reported)
    -- instead of pending and never reached the review queue.
    if public.is_admin() and new.status in ('verified', 'rejected') then
      return new;
    end if;
    if new.competition_id is null then
      new.status := 'self_reported'; -- no event → unverified self-report
    else
      new.status := 'pending';       -- linked to an event → awaits admin review
    end if;
    return new;
  end if;

  -- UPDATE
  if public.is_admin() then
    return new;                      -- admin verifies / rejects freely
  end if;
  if new.competition_id is distinct from old.competition_id
     or new.proof_photo_url is distinct from old.proof_photo_url then
    -- the event link / proof changed → back to the automatic pre-review state
    if new.competition_id is null then
      new.status := 'self_reported';
    else
      new.status := 'pending';
    end if;
  else
    new.status := old.status;        -- otherwise athletes can't touch status
  end if;
  return new;
end;
$$;

drop trigger if exists performances_status_guard on public.performances;
create trigger performances_status_guard
  before insert or update on public.performances
  for each row execute function public.enforce_performance_status();

drop policy if exists "performances read public own or admin" on public.performances;
create policy "performances read public own or admin"
  on public.performances for select
  using (is_public = true or auth.uid() = user_id or public.is_admin());

drop policy if exists "performances insert own" on public.performances;
create policy "performances insert own"
  on public.performances for insert
  with check (auth.uid() = user_id);

drop policy if exists "performances update own or admin" on public.performances;
create policy "performances update own or admin"
  on public.performances for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "performances delete own or admin" on public.performances;
create policy "performances delete own or admin"
  on public.performances for delete
  using (auth.uid() = user_id or public.is_admin());

-- ── 3. Storage bucket: performance-proofs ───────────────────────────────────
-- Public read (rankings can show the proof); writes are owner-scoped to the
-- user's own folder <uid>/... so proofs can't be overwritten by other users.
insert into storage.buckets (id, name, public)
values ('performance-proofs', 'performance-proofs', true)
on conflict (id) do nothing;

drop policy if exists "performance-proofs public read" on storage.objects;
create policy "performance-proofs public read"
  on storage.objects for select
  using (bucket_id = 'performance-proofs');

drop policy if exists "performance-proofs owner insert" on storage.objects;
create policy "performance-proofs owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'performance-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "performance-proofs owner update" on storage.objects;
create policy "performance-proofs owner update"
  on storage.objects for update
  using (
    bucket_id = 'performance-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "performance-proofs owner delete" on storage.objects;
create policy "performance-proofs owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'performance-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── One-off: grant yourself admin (replace the email, then sign out/in) ─────
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                         || '{"is_admin": true}'::jsonb
-- where email = 'YOUR_EMAIL_HERE';
