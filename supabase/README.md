# Setting up Supabase for Phase 1

One-time setup, about five minutes.

1. Go to [supabase.com](https://supabase.com), sign up (or sign in), and
   create a new project. Any region is fine; pick one close to you. Set a
   database password when prompted - you won't need it for anything below
   (we use the API, not a direct Postgres connection), but save it somewhere
   anyway.
2. Wait for the project to finish provisioning (a minute or two).
3. Open **SQL Editor** in the left sidebar -> **New query**:
   - **Fresh project:** paste `supabase/schema.sql` and run it.
   - **This live project (already has Phase 1 tables):** paste
     `supabase/migrate-users.sql` and run it **before** deploying the
     matching code. That file's header explains what breaks if you
     reverse the order.
   It creates `users` plus `user_id` on the data tables, backfills every
   existing row to Yoni, and adds RLS policies so an authenticated user
   (none today — no OAuth) can only see their own rows. The service-role
   key still bypasses RLS. You should see "Success. No rows returned."
4. Open **Project Settings** (gear icon) -> **API**. Copy two values:
   - **Project URL** -> this is `SUPABASE_URL`
   - **service_role** key under "Project API keys" (not the `anon` one) ->
     this is `SUPABASE_SERVICE_ROLE_KEY`

Put both into a `.env` file at the repo root (copy `.env.example` to `.env`
and fill them in) for local dev, and into Vercel's project settings
(**Settings -> Environment Variables**) for the deployed app.

The service-role key bypasses Row Level Security entirely - treat it like a
database admin password. It should only ever appear in `.env` (gitignored)
and in Vercel's environment variable settings, never in a client component,
never in a commit, never printed in a log.
