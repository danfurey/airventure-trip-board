-- AirVenture Trip Board v1.4 migration
-- Run this only if you already created the database using schema.sql from v1.3 or earlier.

begin;

-- Keep the newest row if an older installation somehow contains duplicate event picks.
delete from public.group_choices older
using public.group_choices newer
where older.trip_id = newer.trip_id
  and older.event_id = newer.event_id
  and older.ctid < newer.ctid;

alter table public.group_choices
  drop constraint if exists group_choices_pkey;

alter table public.group_choices
  add primary key (trip_id, event_id);

create index if not exists group_choices_decision_idx
  on public.group_choices (trip_id, decision_id);

commit;
