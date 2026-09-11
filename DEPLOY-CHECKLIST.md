# Deploy checklist

Do these in order. Do not skip to production.

1. **Run pending SQL** against Supabase, in filename order (`supabase/migrate-*.sql` that have not been applied). Already applied: `migrate-leagues.sql`, `migrate-oauth.sql`, `migrate-push.sql`. This session added **no new migration**.
2. **Set/verify env on Vercel** (Production, Preview, and Development): Onshape keys + OAuth, Supabase, `WEBHOOK_URL`, `CRON_SECRET`, `AUTH_SECRET`, VAPID (`PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, `PUSH_VAPID_SUBJECT`). Then **redeploy** — env vars do not apply to an existing build.
3. **Deploy a PREVIEW url.** Never promote this branch straight to production.
4. **Click through Onshape OAuth on preview.** Your existing sessions must still be there (you are already bound). A second Onshape account must get an empty user, not your data.
5. **Open `/admin`.** Confirm a recent webhook delivery and a recent sync/discovery row. Discovery should log each user as due or skipped, and why.
6. **Only then promote to production.**
7. **Flip `REQUIRE_AUTH=1` only on the day a link is shared with another person.** Leave it unset until then.
   - Logged-out visitors to Today/Sessions/etc. go to `/connect/` (not a blank page, not a 500).
   - `/admin` stays reachable without a session — it is the only liveness tripwire.
8. **Rotate the Supabase service role key BEFORE onboarding any second user.**
