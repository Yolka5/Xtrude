-- Xtrude: multi-user prep (no OAuth).
--
-- ORDER: run this entire file in the Supabase SQL editor FIRST, then deploy
-- the matching code. Do not reverse that.
--
-- SQL first, then code:
--   The currently deployed app does not send `user_id`. This migration adds
--   the column with a DEFAULT of Yoni's id, so live inserts keep working
--   until the new code ships. Selects that do not mention `user_id` keep
--   working too (Postgres ignores extra columns).
--
-- Code first, then SQL:
--   Every new query filters `.eq("user_id", ...)`. PostgREST returns
--   400 / "column user_id does not exist". Today, Sessions, Profile, sync,
--   discovery, and the webhook handler all 500. Incoming Onshape POSTs
--   still hit the route, but logging and last_notified_at writes fail, so
--   deliveries look dead until this SQL has run.
--
-- Idempotent: safe to re-run.
--
-- The users.id below is the same uuid as scripts/lib/appUser.mjs
-- (APP_USER_ID). Shape matches the device-local profile
-- (display_name / initials / avatar_color).

create extension if not exists pgcrypto;

create table if not exists users (
  id               uuid primary key default gen_random_uuid(),
  onshape_user_id  text unique,
  display_name     text not null,
  initials         text not null,
  avatar_color     text not null,
  created_at       timestamptz not null default now()
);

insert into users (id, display_name, initials, avatar_color)
values (
  'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70',
  'Yoni',
  'YS',
  '#2b2b30'
)
on conflict (id) do update
  set display_name = excluded.display_name,
      initials = excluded.initials,
      avatar_color = excluded.avatar_color;

-- Columns: add nullable, backfill, then lock down. ADD COLUMN IF NOT EXISTS
-- will not apply NOT NULL/DEFAULT on a re-run where the column already exists,
-- so the UPDATE + SET NOT NULL / SET DEFAULT below always run.

alter table tracked_documents
  add column if not exists user_id uuid references users(id) on delete cascade;
alter table events
  add column if not exists user_id uuid references users(id) on delete cascade;
alter table sessions
  add column if not exists user_id uuid references users(id) on delete cascade;
alter table daily_stats
  add column if not exists user_id uuid references users(id) on delete cascade;
alter table webhook_registrations
  add column if not exists user_id uuid references users(id) on delete cascade;
alter table webhook_deliveries
  add column if not exists user_id uuid references users(id) on delete cascade;

update tracked_documents
  set user_id = 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70'
  where user_id is null;
update events
  set user_id = 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70'
  where user_id is null;
update sessions
  set user_id = 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70'
  where user_id is null;
update daily_stats
  set user_id = 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70'
  where user_id is null;
update webhook_registrations
  set user_id = 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70'
  where user_id is null;
update webhook_deliveries
  set user_id = 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70'
  where user_id is null;

alter table tracked_documents alter column user_id set default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70';
alter table events             alter column user_id set default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70';
alter table sessions           alter column user_id set default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70';
alter table daily_stats        alter column user_id set default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70';
alter table webhook_registrations alter column user_id set default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70';
alter table webhook_deliveries alter column user_id set default 'e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70';

alter table tracked_documents      alter column user_id set not null;
alter table events                 alter column user_id set not null;
alter table sessions               alter column user_id set not null;
alter table daily_stats            alter column user_id set not null;
alter table webhook_registrations  alter column user_id set not null;
alter table webhook_deliveries     alter column user_id set not null;

-- Documents are unique per user, not globally: two people can track the
-- same Onshape id later. daily_stats was PK(date); it has to be per user.
alter table tracked_documents drop constraint if exists tracked_documents_onshape_document_id_key;
drop index if exists tracked_documents_user_onshape_key;
alter table tracked_documents drop constraint if exists tracked_documents_user_id_onshape_document_id_key;
alter table tracked_documents
  add constraint tracked_documents_user_id_onshape_document_id_key unique (user_id, onshape_document_id);

alter table daily_stats drop constraint if exists daily_stats_pkey;
alter table daily_stats add primary key (user_id, date);

create index if not exists events_user_id_idx on events (user_id);
create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists webhook_deliveries_user_id_idx on webhook_deliveries (user_id);

alter table users enable row level security;

-- authenticated sees only own rows. anon stays locked out (no policies).
-- Service role bypasses RLS, which is how today's server still works with
-- no login. users.id is not an auth.uid() yet; these policies are the
-- shape OAuth will use, not a live login.
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
