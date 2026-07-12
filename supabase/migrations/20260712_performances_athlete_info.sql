-- ============================================================================
-- Athlete identity on performances (name / flag / photo) + avatars bucket.
-- Denormalised at declare time from the athlete's profile, because profiles
-- live in auth user_metadata and are not queryable across users.
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.performances add column if not exists athlete_name text not null default '';
alter table public.performances add column if not exists country_code text not null default '';
alter table public.performances add column if not exists avatar_url   text;

-- ── Storage bucket: avatars (public read, owner-scoped writes) ──────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

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
