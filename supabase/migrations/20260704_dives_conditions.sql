-- STA-specific session conditions (posture, dry/wet, face gear, room temp,
-- breathe-up rhythm). One JSONB column keeps it flexible without many columns.
-- The app writes this defensively: if the column is missing it retries without
-- it, so dive logging keeps working until this migration is applied.

alter table dives add column if not exists conditions jsonb;
