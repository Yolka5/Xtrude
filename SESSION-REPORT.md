# Session report — 11 Sep 2026

Branch: **`session/oauth-leagues-streaks`**  
Deployed this session: **Part 3 only** (production). Everything below stays on the branch and is **not** on live.

Onshape API this session: **0 calls**. Budget remaining vs the 20-call cap: 20.

---

## Done

### Task 1 — Deploy Part 3 (only deploy)

Committed and shipped to production (`6776af0`). Checked live:

- Today, Sessions, Profile, `/admin` all HTTP 200
- Existing session still correct (most recent at verify time: 5:06–5:11 PM, 11 min scored)

Do not redeploy this branch until you have reviewed it.

### Task 2 — DST cron

Already live from Part 1: `vercel.json` is `0 22 * * *` (22:00 UTC). No `21:00` left in the repo. No extra commit.

### Task 3 — League reads real data

League no longer uses fixture people or the “Example data” chip. Standings are weekly scored minutes from `sessions`. With one member it is a league of one (your name, your minutes). Local check against the live DB: **Yoni**, “Just you, for now.”, no Priya.

If `leagues` / `league_members` are missing, the screen synthesizes that one-person board so it does not 500. Run `supabase/migrate-leagues.sql` for a real default “Xtrude” league (join code `XTRUDE`) with only you in it.

### Task 4 — Onshape OAuth (built, not deployed)

- `/api/auth/onshape/start` — CSRF `state` cookie
- `/api/auth/onshape/callback` — code → tokens, `sessioninfo`, create/match `users`, httpOnly signed session cookie (30 days)
- Tokens AES-GCM encrypted at rest (`oauth_tokens`). Refresh ~5 minutes before expiry. Never sent to the client
- `/api/auth/logout`
- Proxy gate: set `REQUIRE_AUTH=1` to send logged-out visitors to `/connect/`. **Default is off**, and `getCurrentUserId()` still falls back to your Yoni row, so the app is not dead without a cookie

First OAuth from an unbound Yoni row (`onshape_user_id` null) **attaches that Onshape account to your existing data** instead of creating an empty twin.

Signing uses `AUTH_SECRET` if set, otherwise `CRON_SECRET`.

### Task 5 — Onboarding

`/connect/` landing page. After a **new** user connects (zero tracked documents): register webhooks on their 20 most recently modified docs and pull each document’s history. You already have tracked docs, so **your** login will not run that and will not spend those calls.

Empty Today after `/?onboarded=1`: “Tracking starts now…”

**API cost to onboard one new user (quota-counted):**

| Step | Typical | Worst |
| --- | --- | --- |
| `listMyDocuments` (20 newest) | 1 | 1 |
| workspace lookup | 0 | 20 |
| `documenthistory` | 20 | 20 |
| `createWebhook` | 20 | 20 |
| **Total** | **41** | **61** |

`sessioninfo` at login is **+1**. Token exchange is OAuth, not the CAD API quota. Webhook *deliveries* stay free. Daily discover is still Yoni + API keys only.

### Task 6 — Leagues properly

Create (name + 6-char join code), join by code, leave, switch if you are in several. Standings: weekly scored minutes, your row highlighted, week-over-week movement. RLS policies are in the SQL; the app still uses the service role, so it also filters in code.

### Task 7 — Streaks and freezes

A day counts at **≥ 10 scored minutes**. Earn 1 freeze per week that had a qualifying day, bank up to 2, auto-spend to save a miss. Empty-so-far today still does not break the streak. UI shows “Freeze used {date}” — never silent. Longest streak is tracked separately.

### Task 8 — Badges and records

Records: longest session, best week (Monday-anchored), most active days in a month, biggest day.  
Badges: first session, 10h / 50h / 100h, 7 / 30 / 100 day streaks, session after midnight (00:00–04:59 Israel), every day of one week.  
`npm run verify` asserts **no badge is earned on empty data**.

### Task 9 — Celebrations

Streak increment: particles, scale bounce, number slam (sessionStorage so the first paint of a session does not fake an increment). League: existing row-swap spring + gold flash; haptic if your rank improved since last visit. New badge/record: full-screen confetti. Haptics are feature-detected. All of it no-ops under `prefers-reduced-motion`.

### Task 10 — Push

Opt-in only. Banner on Today after you already have a streak (not first load). Per-type opt-out on Profile. Evening streak-risk send is hooked to the 22:00 UTC discover cron (no extra Onshape calls). League-pass is weekly vs last week, deduped.

VAPID keys were generated into local `.env` only (not committed). Add `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, and `PUSH_VAPID_SUBJECT` on Vercel before this is useful in production.

**iOS:** Web Push only works if the PWA is on the Home Screen, iOS 16.4+, and the user granted permission. Delivery is best-effort and often delayed or dropped. Android Chrome is the reliable target. Safari on iOS without “Add to Home Screen” will not get pushes.

---

## Half-done / caveats

- SQL for leagues, oauth tokens, and push is **written, not run** on live Supabase (you were away). Local League uses the solo fallback until `migrate-leagues.sql` runs.
- New users will not auto-discover documents created *after* onboarding until discover is made multi-user (still Yoni + API keys).
- Page-load `/api/sync` still syncs **Yoni’s** dirty docs via API keys. A brand-new user’s Today with `?onboarded=1` skips that once; later visits could still fire Yoni’s sync if `last_sync` is stale. Do not treat that as multi-user sync.
- `REQUIRE_AUTH` is off. Logged-out visitors still see your data, as today.

---

## Blocked on you

See `QUESTIONS.md`. Mainly: run the three SQL files, add VAPID env on Vercel when you deploy this branch, decide when to set `REQUIRE_AUTH=1`.

---

## What to test when you are back

### Production (already live, Part 3)

Today / Sessions / Profile / Admin — you already have this; spot-check the session list if you want.

### This branch, local only (`npm run dev`) — do **not** `vercel --prod`

**League**

1. Open `http://localhost:3000/league/`
2. You should see your real name and this week’s scored minutes, 1 of 1, no “Example data”
3. After `migrate-leagues.sql`: join code `XTRUDE`, Create / Join / Leave

**OAuth (spends 1 Onshape call: `sessioninfo`)**

1. `http://localhost:3000/connect/`
2. **Connect Onshape**
3. Approve `OAuth2ReadPII` and `OAuth2Read`
4. You should land on Today with your existing sessions (binding to Yoni)
5. Profile → **Sign out** → `/connect/`
6. Optional: set `REQUIRE_AUTH=1` in `.env`, restart `next dev`, visit `/` → should redirect to `/connect/`
7. Do **not** connect a second Onshape account if you want to keep the Yoni bind unused; the first unbound login claims that row

**Onboarding a throwaway user** — do not do this unless you accept **~41–61 Onshape calls**.

**Streaks / badges**

- `npm run verify`
- Today: freeze copy only if a freeze was actually used
- Profile: locked badges stay locked; yours should match real totals (you are under 10h, so Ten Hours is locked)

**Push (optional)**

1. Run `migrate-push.sql`
2. Profile → Enable push on this device (Android Chrome or desktop Chrome; iOS only after Add to Home Screen)
3. Opt out of each type and confirm the checkboxes persist
