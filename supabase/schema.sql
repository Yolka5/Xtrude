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
  created_at            timestamptz not null default now()
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

alter table tracked_documents enable row level security;
alter table events enable row level security;
alter table sessions enable row level security;
alter table daily_stats enable row level security;
-- No policies are created on purpose: with RLS on and zero policies, only
-- the service-role key (which bypasses RLS entirely) can read or write.
-- The anon/authenticated roles - the only ones a leaked client-side key
-- could use - get nothing.
