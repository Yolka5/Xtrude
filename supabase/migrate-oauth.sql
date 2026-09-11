-- Encrypted Onshape OAuth tokens, one row per user.
-- Additive. Run in the SQL editor before deploying this branch.
-- Idempotent.

create table if not exists oauth_tokens (
  user_id          uuid primary key references users(id) on delete cascade,
  access_cipher    text not null,
  refresh_cipher   text not null,
  expires_at       timestamptz not null,
  updated_at       timestamptz not null default now()
);

alter table oauth_tokens enable row level security;

-- Tokens never leave the server. No authenticated-client policies on
-- purpose: the app reads this table with the service role only.

comment on table oauth_tokens is
  'Onshape access/refresh tokens, AES-GCM encrypted at rest. Never expose to the browser.';
