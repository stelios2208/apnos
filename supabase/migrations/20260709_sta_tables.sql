-- Custom STA training tables (CO2 / O2) with breathing mode.
create table if not exists sta_tables (
  id             uuid        default gen_random_uuid() primary key,
  user_id        uuid        references auth.users(id) on delete cascade,
  name           text        not null,
  type           text        not null check (type in ('co2', 'o2')),
  breathing_mode text        not null default 'normal' check (breathing_mode in ('normal', 'frc', 'rv')),
  rounds         jsonb       not null default '[]',
  created_at     timestamptz default now()
);

alter table sta_tables enable row level security;

create policy "users can manage own sta_tables"
  on sta_tables for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
