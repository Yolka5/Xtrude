-- Xtrude schema. One users row today (Yoni); no OAuth. Server code writes
-- and reads with the service-role key, which bypasses RLS. authenticated
-- policies below are the shape a future login will use: a user only sees
-- their own rows. anon has no policies, so a leaked client key still
-- reads nothing.
--
-- Fresh project: paste this whole file into the SQL editor and run it.
-- Existing Phase-1 project: run supabase/migrate-users.sql instead, do not
-- re-run this file (CREATE TABLE IF NOT EXISTS will not add user_id).

create extension if not exists pgcrypto;

create table if not exists users (
  id               uuid primary key default gen_random_uuid(),
  onshape_user_id  text unique,
  display_name     text not null,
  initials         text not null,
  avatar_color     text not null,
  created_at       timestamptz not null default now()
);

-- Stable id, shared with scripts/lib/appUser.mjs (APP_USER_ID).
insert into users (id, display_name, initials, avatar_color)
values (
  'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70',
  'Yoni',
  'YS',
  '#2b2b30'
)
on conflict (id) do nothing;

create table if not exists tracked_documents (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70' references users(id) on delete cascade,
  onshape_document_id   text not null,
  onshape_workspace_id  text not null,
  name                  text not null,
  last_backfilled_at    timestamptz,
  created_at            timestamptz not null default now(),
  last_notified_at      timestamptz,
  last_synced_at        timestamptz,
  unique (user_id, onshape_document_id)
);

create table if not exists events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70' references users(id) on delete cascade,
  document_id      uuid not null references tracked_documents(id) on delete cascade,
  element_id       text,
  microversion_id  text not null,
  occurred_at      timestamptz not null,
  raw              jsonb not null,
  created_at       timestamptz not null default now(),
  unique (document_id, microversion_id)
);

create index if not exists events_occurred_at_idx on events (occurred_at);
create index if not exists events_user_id_idx on events (user_id);

create table if not exists sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70' references users(id) on delete cascade,
  started_at       timestamptz not null,
  ended_at         timestamptz not null,
  duration_seconds integer not null,
  event_count      integer not null,
  raw_minutes      numeric not null,
  scored_minutes   numeric not null,
  document_ids     text[] not null default '{}',
  created_at       timestamptz not null default now()
);

create index if not exists sessions_started_at_idx on sessions (started_at);
create index if not exists sessions_user_id_idx on sessions (user_id);

create table if not exists daily_stats (
  user_id              uuid not null default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70' references users(id) on delete cascade,
  date                 date not null,
  total_scored_minutes numeric not null,
  session_count        integer not null,
  primary key (user_id, date)
);

create table if not exists webhook_registrations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70' references users(id) on delete cascade,
  onshape_webhook_id  text not null unique,
  document_id         uuid not null references tracked_documents(id) on delete cascade,
  events              text[] not null,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  unregistered_at     timestamptz,
  unique (document_id)
);

create table if not exists webhook_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70' references users(id) on delete cascade,
  received_at         timestamptz not null default now(),
  onshape_webhook_id  text,
  event               text,
  document_id         uuid references tracked_documents(id) on delete set null,
  accepted            boolean not null,
  reason              text not null,
  raw                 jsonb,
  ip                  text
);

create index if not exists webhook_deliveries_received_at_idx on webhook_deliveries (received_at desc);
create index if not exists webhook_deliveries_user_id_idx on webhook_deliveries (user_id);

create table if not exists app_state (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table users enable row level security;
alter table tracked_documents enable row level security;
alter table events enable row level security;
alter table sessions enable row level security;
alter table daily_stats enable row level security;
alter table webhook_registrations enable row level security;
alter table webhook_deliveries enable row level security;
alter table app_state enable row level security;

drop policy if exists users_select_own on users;
create policy users_select_own on users
  for select to authenticated
  using (id = auth.uid());

drop policy if exists users_update_own on users;
create policy users_update_own on users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists tracked_documents_own on tracked_documents;
create policy tracked_documents_own on tracked_documents
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists events_own on events;
create policy events_own on events
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists sessions_own on sessions;
create policy sessions_own on sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists daily_stats_own on daily_stats;
create policy daily_stats_own on daily_stats
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists webhook_registrations_own on webhook_registrations;
create policy webhook_registrations_own on webhook_registrations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists webhook_deliveries_own on webhook_deliveries;
create policy webhook_deliveries_own on webhook_deliveries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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

drop policy if exists leagues_select_member on leagues;
create policy leagues_select_member on leagues
  for select to authenticated
  using (
    exists (
      select 1 from league_members m
      where m.league_id = leagues.id and m.user_id = auth.uid()
    )
  );

drop policy if exists leagues_insert_own on leagues;
create policy leagues_insert_own on leagues
  for insert to authenticated
  with check (created_by = auth.uid());

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
