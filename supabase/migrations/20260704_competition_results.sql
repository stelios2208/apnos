-- Competition results feed the public rankings, so SELECT must be allowed
-- across users for rows marked public (own rows always visible).
-- Idempotent: safe to re-run (drops policies before recreating).

create table if not exists competition_results (
  id                 uuid        default gen_random_uuid() primary key,
  user_id            uuid        references auth.users(id) on delete cascade not null,
  athlete_name       text        not null default '',
  gender             text        default '',
  discipline         text        not null,
  federation         text        not null default 'AIDA',
  result             numeric     not null,
  competition_name   text        default '',
  location           text        default '',
  country            text        default 'Greece',
  competition_date   date,
  is_national_record boolean     default false,
  is_public          boolean     default true,
  created_at         timestamptz default now()
);

alter table competition_results enable row level security;

-- Table-level privileges. Raw-SQL tables don't always inherit these, and without
-- them Postgres returns "permission denied for table" before RLS is even checked.
grant select, insert, update, delete on competition_results to authenticated;
grant select on competition_results to anon;

drop policy if exists "read public or own competition_results" on competition_results;
create policy "read public or own competition_results"
  on competition_results for select
  using (is_public = true or auth.uid() = user_id);

drop policy if exists "insert own competition_results" on competition_results;
create policy "insert own competition_results"
  on competition_results for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own competition_results" on competition_results;
create policy "update own competition_results"
  on competition_results for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own competition_results" on competition_results;
create policy "delete own competition_results"
  on competition_results for delete
  using (auth.uid() = user_id);

create index if not exists competition_results_ranking_idx
  on competition_results (discipline, federation, result desc);
