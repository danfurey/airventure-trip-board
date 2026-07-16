-- AirVenture Trip Board shared data model
-- Run this once in the Supabase SQL editor.

create table if not exists public.trip_members (
  trip_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.votes (
  trip_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  choice text not null check (choice in ('going', 'maybe', 'skip')),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id, event_id),
  foreign key (trip_id, user_id) references public.trip_members(trip_id, user_id) on delete cascade
);

create table if not exists public.group_choices (
  trip_id uuid not null,
  decision_id text not null,
  event_id text not null,
  updated_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (trip_id, event_id),
  foreign key (trip_id, updated_by) references public.trip_members(trip_id, user_id) on delete cascade
);

create index if not exists group_choices_decision_idx
  on public.group_choices (trip_id, decision_id);

alter table public.trip_members enable row level security;
alter table public.votes enable row level security;
alter table public.group_choices enable row level security;

-- This helper avoids recursive row-level-security checks when testing membership.
create or replace function public.is_trip_member(target_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members member
    where member.trip_id = target_trip
      and member.user_id = auth.uid()
  );
$$;

revoke all on function public.is_trip_member(uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;

-- A signed-in anonymous user may join a trip ID they possess.
drop policy if exists "members may join trips" on public.trip_members;
create policy "members may join trips"
on public.trip_members
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "members may read their trip" on public.trip_members;
create policy "members may read their trip"
on public.trip_members
for select
to authenticated
using (user_id = auth.uid() or public.is_trip_member(trip_id));

drop policy if exists "members may update themselves" on public.trip_members;
create policy "members may update themselves"
on public.trip_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "members may read trip votes" on public.votes;
create policy "members may read trip votes"
on public.votes
for select
to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists "members may add own votes" on public.votes;
create policy "members may add own votes"
on public.votes
for insert
to authenticated
with check (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "members may update own votes" on public.votes;
create policy "members may update own votes"
on public.votes
for update
to authenticated
using (user_id = auth.uid() and public.is_trip_member(trip_id))
with check (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "members may delete own votes" on public.votes;
create policy "members may delete own votes"
on public.votes
for delete
to authenticated
using (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "members may read group choices" on public.group_choices;
create policy "members may read group choices"
on public.group_choices
for select
to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists "members may add group choices" on public.group_choices;
create policy "members may add group choices"
on public.group_choices
for insert
to authenticated
with check (updated_by = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "members may update group choices" on public.group_choices;
create policy "members may update group choices"
on public.group_choices
for update
to authenticated
using (public.is_trip_member(trip_id))
with check (updated_by = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "members may delete group choices" on public.group_choices;
create policy "members may delete group choices"
on public.group_choices
for delete
to authenticated
using (public.is_trip_member(trip_id));

-- Realtime needs the tables in the publication.
do $$
begin
  alter publication supabase_realtime add table public.trip_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.votes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_choices;
exception when duplicate_object then null;
end $$;

alter table public.trip_members replica identity full;
alter table public.votes replica identity full;
alter table public.group_choices replica identity full;
