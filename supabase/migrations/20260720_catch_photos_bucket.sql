-- Per-user catch photo storage for Apnos Spearo (one shareable photo per catch).
-- Files live at:  <uid>/<random-id>.jpg   (e.g. 3f0e…/9b2c….jpg)
-- Public read (so the <img> thumbnails and the future share card can render);
-- only the owner may upload / overwrite / delete their own files.
--
-- SPOT SECRECY: a catch's `spot` coordinates are private and must never leak.
-- Photos are re-encoded client-side (drawn through a canvas and re-exported as
-- JPEG — see src/lib/spearo-photos.ts) BEFORE upload, which strips ALL metadata,
-- including any GPS/EXIF tags the camera embedded. A public photo therefore never
-- carries the catch's coordinates, so it is safe to serve from a public bucket:
-- this re-encode is what keeps the private spot private.
--
-- This mirrors supabase/migrations/20260703_voice_cues_storage.sql exactly,
-- adapted to the `catch-photos` bucket. Fully idempotent: safe to paste into the
-- hosted Supabase SQL editor and re-run by hand.

insert into storage.buckets (id, name, public)
values ('catch-photos', 'catch-photos', true)
on conflict (id) do nothing;

-- Listing/authenticated reads are owner-only. Public playback/rendering still
-- works via the public bucket URL (getPublicUrl), which bypasses RLS for public
-- buckets. Drop-then-create so re-running in the SQL editor never errors.
drop policy if exists "catch-photos owner list" on storage.objects;
create policy "catch-photos owner list"
  on storage.objects for select
  using (
    bucket_id = 'catch-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "catch-photos owner insert" on storage.objects;
create policy "catch-photos owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'catch-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "catch-photos owner update" on storage.objects;
create policy "catch-photos owner update"
  on storage.objects for update
  using (
    bucket_id = 'catch-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "catch-photos owner delete" on storage.objects;
create policy "catch-photos owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'catch-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
