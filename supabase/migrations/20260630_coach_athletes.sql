create table if not exists coach_athletes (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  name        text        not null,
  level       text        not null default 'beginner',
  disciplines text[]      not null default '{}',
  programs    jsonb       not null default '[]',
  created_at  timestamptz default now()
);

alter table coach_athletes enable row level security;

create policy "users can manage own coach_athletes"
  on coach_athletes for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
