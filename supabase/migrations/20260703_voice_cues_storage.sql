-- Per-user voice cue storage for the guided STA trainer.
-- Files live at:  <uid>/<lang>/<key>   (e.g. 3f0e…/el/hold)
-- Public read (so the <audio> element can stream them); only the owner may
-- upload / overwrite / delete their own files.

insert into storage.buckets (id, name, public)
values ('voice-cues', 'voice-cues', true)
on conflict (id) do nothing;

-- Listing/authenticated reads are owner-only. Public playback still works via
-- the public bucket URL (getPublicUrl), which bypasses RLS for public buckets.
create policy "voice-cues owner list"
  on storage.objects for select
  using (
    bucket_id = 'voice-cues'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "voice-cues owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-cues'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "voice-cues owner update"
  on storage.objects for update
  using (
    bucket_id = 'voice-cues'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "voice-cues owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'voice-cues'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
