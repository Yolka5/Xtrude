# Questions

I did not stop for these. Defaults I used are in brackets.

1. **SQL** — Please run, in order, against live Supabase before you deploy this branch:
   - `supabase/migrate-leagues.sql`
   - `supabase/migrate-oauth.sql`
   - `supabase/migrate-push.sql`  
   [I could not run DDL from here.]

2. **First Onshape login binds to Yoni** while `users.onshape_user_id` is still null. Confirm the first account you connect is yours. If someone else connected first, they would inherit your sessions. [Assumed you will connect first.]

3. **`REQUIRE_AUTH=1`** — When should logged-out visitors stop seeing your Today and hit `/connect/` instead? [Left unset so production cannot lock you out if this branch is deployed early.]

4. **VAPID on Vercel** — Local `.env` has `PUSH_VAPID_PUBLIC_KEY` / `PUSH_VAPID_PRIVATE_KEY` / `PUSH_VAPID_SUBJECT` (gitignored). Add the same names on Vercel when you deploy push. Want me to copy them up in a later session, or will you paste them?

5. **Post-onboarding discover** — New users currently get 20 docs at connect time only. Should the daily Vercel cron start using each user’s OAuth token (costs ~1 list call per user per day)? [Left as Yoni + API keys.]

6. **League name** — Default league is “Xtrude” with join code `XTRUDE`. Want a different name?

7. **After midnight** — Badge counts a session that *starts* 00:00–04:59 Asia/Jerusalem. Is 05:00 still “after midnight” for you?
