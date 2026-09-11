-- Xtrude: leagues + membership. Additive. Safe to run on the live project.
--
-- Run this in the Supabase SQL editor BEFORE deploying the session branch
-- that reads these tables. Until then, the app synthesizes a one-person
-- league from sessions/users so local `next dev` against the live DB
-- does not 500.
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

create table if not exists leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,
  created_by  uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists league_members (
  league_id  uuid not null references leagues(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists league_members_user_id_idx on league_members (user_id);
create index if not exists leagues_join_code_idx on leagues (join_code);

-- Default league: just Yoni. Honest, slightly lonely, not fixture people.
insert into leagues (id, name, join_code, created_by)
values (
  'a1c4e8b2-7d3f-4a91-9e05-2c6b8f0d4a17',
  'Xtrude',
  'XTRUDE',
  'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70'
)
on conflict (id) do nothing;

insert into league_members (league_id, user_id)
values (
  'a1c4e8b2-7d3f-4a91-9e05-2c6b8f0d4a17',
  'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70'
)
on conflict (league_id, user_id) do nothing;

alter table leagues enable row level security;
alter table league_members enable row level security;

-- A member can read leagues they belong to.
drop policy if exists leagues_select_member on leagues;
create policy leagues_select_member on leagues
  for select to authenticated
  using (
    exists (
      select 1 from league_members m
      where m.league_id = leagues.id and m.user_id = auth.uid()
    )
  );

-- Creating a league: you must be the creator.
drop policy if exists leagues_insert_own on leagues;
create policy leagues_insert_own on leagues
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists leagues_update_own on leagues;
create policy leagues_update_own on leagues
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Members of a league can see everyone in it (standings).
drop policy if exists league_members_select_same_league on league_members;
create policy league_members_select_same_league on league_members
  for select to authenticated
  using (
    exists (
      select 1 from league_members me
      where me.league_id = league_members.league_id
        and me.user_id = auth.uid()
    )
  );

drop policy if exists league_members_insert_self on league_members;
create policy league_members_insert_self on league_members
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists league_members_delete_self on league_members;
create policy league_members_delete_self on league_members
  for delete to authenticated
  using (user_id = auth.uid());

-- Join by code without already being a member. SECURITY DEFINER so the
-- lookup can see leagues the caller is not in yet. The app currently
-- writes with the service role (bypasses RLS); this function is the
-- shape a future authenticated client will use.
create or replace function join_league_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select id into lid
    from leagues
   where upper(join_code) = upper(trim(code));
  if lid is null then
    raise exception 'unknown join code';
  end if;
  insert into league_members (league_id, user_id)
  values (lid, uid)
  on conflict (league_id, user_id) do nothing;
  return lid;
end;
$$;

revoke all on function join_league_by_code(text) from public;
grant execute on function join_league_by_code(text) to authenticated;
