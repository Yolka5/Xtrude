-- Xtrude Phase 1 schema. Single user, no auth - every table is written and
-- read exclusively with the service-role key from server code, never from
-- the browser, so Row Level Security below is a deliberate lockout (no
-- policies) rather than something client code is expected to satisfy.
--
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New
-- query) against a fresh project. Safe to re-run: every statement is
-- idempotent (CREATE ... IF NOT EXISTS / OR REPLACE).

create extension if not exists pgcrypto;

-- One row per Onshape document this account tracks. The backfill script
-- upserts into this table as it discovers documents, and stamps
-- last_backfilled_at so a future incremental backfill (Phase 1b) knows
-- where it left off.
create table if not exists tracked_documents (
  id                    uuid primary key default gen_random_uuid(),
  onshape_document_id   text not null unique,
  onshape_workspace_id  text not null,
  name                  text not null,
  last_backfilled_at    timestamptz,
  created_at            timestamptz not null default now(),
  -- Phase 1b, live capture: last_notified_at is stamped by the webhook
  -- endpoint the moment a real model-change delivery arrives for this
  -- document - a cheap marker, not the microversion data itself (Onshape's
  -- notification payload doesn't carry one, see webhookIngest.mjs). The
  -- hourly sync cron treats "notified more recently than synced" as its
  -- worklist, so a document with no new activity costs it nothing.
  last_notified_at      timestamptz,
  last_synced_at        timestamptz
);

-- Append-only. One row per microversion pulled from Onshape's
-- documenthistory. Nothing ever updates or deletes a row here except a
-- deliberate re-backfill - sessions and daily_stats are entirely derived
-- from this table, so the scoring algorithm can change later and history
-- gets recomputed, not lost.
create table if not exists events (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references tracked_documents(id) on delete cascade,
  element_id       text,
  microversion_id  text not null,
  occurred_at      timestamptz not null,
  raw              jsonb not null,
  created_at       timestamptz not null default now(),
  -- Lets the backfill script use ON CONFLICT DO NOTHING and be safely
  -- rerunnable without scanning first or producing duplicate events.
  unique (document_id, microversion_id)
);

create index if not exists events_occurred_at_idx on events (occurred_at);

-- Fully derived from events by scripts/recompute-sessions.mjs, which wipes
-- and rebuilds both this table and daily_stats on every run rather than
-- trying to diff old sessions against new ones. At single-user, few-hundred-
-- row volume a full rebuild is simpler than incremental merge logic and
-- trivially idempotent: same events in, same rows out, every time.
create table if not exists sessions (
  id               uuid primary key default gen_random_uuid(),
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

-- Also fully derived, one row per calendar day that had at least one
-- session. Rebuilt alongside sessions.
create table if not exists daily_stats (
  date                 date primary key,
  total_scored_minutes numeric not null,
  session_count        integer not null
);

-- Phase 1b: one row per Onshape webhook this app has registered. The
-- source of truth the public webhook endpoint checks every delivery
-- against - Onshape doesn't deduplicate registration calls, so this also
-- lets the registration script tell "already registered" from "needs one"
-- before ever calling createWebhook again.
create table if not exists webhook_registrations (
  id                  uuid primary key default gen_random_uuid(),
  onshape_webhook_id  text not null unique,
  document_id         uuid not null references tracked_documents(id) on delete cascade,
  events              text[] not null,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  unregistered_at     timestamptz,
  -- One active registration per document: all watched event types ride on
  -- a single webhook (Onshape's `events` field on createWebhook takes an
  -- array), so there's never a reason for two.
  unique (document_id)
);

-- Every inbound POST to /api/webhooks/onshape, accepted or rejected. This
-- is the entire answer to "did webhooks break, or did I just not model
-- anything this week" - both look identical from Today/Sessions without it.
create table if not exists webhook_deliveries (
  id                  uuid primary key default gen_random_uuid(),
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

-- Small key/value table for cross-invocation bookkeeping that doesn't
-- warrant its own table - currently the two cron jobs' last-run summaries,
-- read by /admin so "is this still alive" doesn't require reading logs.
create table if not exists app_state (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table tracked_documents enable row level security;
alter table events enable row level security;
alter table sessions enable row level security;
alter table daily_stats enable row level security;
alter table webhook_registrations enable row level security;
alter table webhook_deliveries enable row level security;
alter table app_state enable row level security;
-- No policies are created on purpose: with RLS on and zero policies, only
-- the service-role key (which bypasses RLS entirely) can read or write.
-- The anon/authenticated roles - the only ones a leaked client-side key
-- could use - get nothing.

-- Re-running this file against a project created before Phase 1b: the
-- table already exists from CREATE TABLE IF NOT EXISTS above, so the new
-- tracked_documents columns need their own idempotent add.
alter table tracked_documents add column if not exists last_notified_at timestamptz;
alter table tracked_documents add column if not exists last_synced_at timestamptz;
