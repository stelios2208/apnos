create table if not exists sta_sessions (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users(id) on delete cascade,
  date         date        not null,
  rounds       jsonb       not null,
  best_hold    integer,
  avg_hold     integer,
  total_rounds integer,
  created_at   timestamptz default now()
);

alter table sta_sessions enable row level security;

create policy "users can manage own sta_sessions"
  on sta_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
