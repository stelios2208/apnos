alter table dives add column if not exists neck_weight numeric(5,2);
alter table dives add column if not exists belt_weight numeric(5,2);
alter table dives add column if not exists wetsuit_mm  numeric(4,1);
alter table dives add column if not exists buoyancy    text check (buoyancy in ('negative','neutral','positive'));
alter table dives add column if not exists fins_type   text check (fins_type in ('monofin','bifins','none'));
alter table dives add column if not exists water_temp  numeric(4,1);
