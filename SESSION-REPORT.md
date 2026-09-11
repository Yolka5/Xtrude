# Session report — 11 Sep 2026 (follow-up)

Branch: **`session/oauth-leagues-streaks`** (no new branch).  
Production deploy this session: **none**. Preview deploy: **none**.  
SQL against live Supabase: **none**. New migration files: **none**.  
Onshape API calls this session: **0** (budget 10, preferred 0). Running count:

| # | Call | Why |
|---|---|---|
| — | *(none)* | Docs only for webhooks; discovery scheduler is unit-tested with synthetic users. |

Annual quota context: ~2,500, ~270 already spent before this session. Still 0 added here.

---

## Finished

### 1. Activity-driven document discovery
Daily Vercel cron is still the only entry point. App opens do not discover. Per user, from sessions in the DB (zero Onshape calls to decide):

- any session in the last 7 *Israel* civil days → daily
- otherwise → weekly
- connect-time onboarding kept; it stamps `app_state.discovery_user_<id>` so the same-day cron skips
- first-discovery backfill (`last_backfilled_at` null → `documenthistory`) unchanged

`/admin` logs each user as due or skipped, and why. Yoni still uses API keys when due; everyone else uses OAuth (or is skipped: `due but no oauth token`).

**Test (mutation-checked):** four synthetic users on 11 Sep 2026 noon Israel — active yesterday (due daily), last active 10 days ago with a discovery 3 days ago (skipped weekly), brand-new onboarded today (skipped), dormant for months (due weekly). Forced `discoveryDue` to always skip → those checks went **red** → reverted → green.

### 2. Onshape webhook scope
See `WEBHOOK-SCOPE.md`. **No user-scoped “new document” webhook** for a free/EDU personal account. Company scope exists for admins (`onshape.document.lifecycle.created` + `companyId`). Not implemented.

### 3. First-login binding
Removed the “bind to Yoni while `onshape_user_id` is null” hole. Match only on `onshape_user_id`; otherwise insert an empty user. Bound ids cannot be overwritten.

**Test (mutation-checked):** user A bound with 3 sessions; user B logs in → new id, **zero sessions**, A untouched. Pointing `applyOnshapeLogin` at `users[0]` made “B sees zero sessions” **red** (after the test was tightened to use `b.userId`) → reverted → green.

### 4. League naming
No hardcoded default name (solo fallback is the owner’s display name or `"League"`). Owner can rename and regenerate the join code in the UI. Rename does not change membership or the code. New codes: 6 chars, alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L), uniqueness retried.

**Tests (mutation-checked):** alphabet + `0` → **red**; `renameLeagueState` also changing the code → **red**; both reverted.

### 5. After Midnight
Window is **00:00–04:59 Asia/Jerusalem**; **05:00 does not count**. Evaluated on the session instant in Israel time.

**Tests (mutation-checked):** 04:59 IDT and IST count; 05:00 IDT and IST do not; UTC 02:30 in September is 05:30 IDT and does not count. `hour < 6` made those **red** → reverted.

### 6. `REQUIRE_AUTH`
Still **unset**. When set to `1`: logged-out `/` and `/sessions/` redirect to `/connect/` (no throw); `/admin` stays public.

**Tests (mutation-checked):** dropping `/admin` from public paths → admin check **red**; ignoring `REQUIRE_AUTH=1` → connect redirect **red**; both reverted.

### 7. Push
Missing VAPID → 503 JSON / `{ sent: 0 }`, Today still renders, banner not shown. Profile: enable + **Send a test notification**. Client config object cannot include the private key.

**Build grep (after `npm run build`, values never printed):**
- `PUSH_VAPID_PRIVATE_KEY`: **absent from `.next`**
- `NEXT_PUBLIC_*` secret-ish names: **0 hits** in src/scripts/.next
- Public VAPID key: not baked into `.next/static` (fetched from `/api/push/vapid` at runtime)

**Test (mutation-checked):** returning `privateKey` from `clientPushConfig` → **red** → reverted.

Device delivery: **unverified** (no permission grant in this session; no preview deploy).

### 8. `DEPLOY-CHECKLIST.md`
At repo root, 8 steps including `/admin` vs `/connect/` when `REQUIRE_AUTH=1`.

### 9. Empty-data guarantee
Existing checks: no badges, no records. Added **no streak** (`current === 0 && longest === 0`).

**Mutation-checked:**
- First badge `earned: true` always → `no badge is earned without data` **red** (`["first"]`) → reverted
- Empty `current: 1` → `no streak without data` **red** → reverted
- Then green again

---

## Compiles but unverified

- Daily cron against live users (would spend Onshape `listMyDocuments` for whoever is due). Do not poke `/api/cron/discover` on production from here.
- OAuth click-through on a preview URL
- Push permission prompt → SW subscribe → row in `push_subscriptions` → notification on a phone
- League rename / new join code on the live “Xtrude” seeded league (SQL left untouched)
- Multi-user session rebuild at midnight for anyone other than Yoni (code is there; not run live)

---

## Skipped, and why

- **Implementing company-scope webhooks** — docs say it needs a company admin; this account is treated as personal EDU/free. Research only.
- **Any Onshape CAD call** — budget prefer 0; scheduler tests need none.
- **SQL / new migrations** — schema from the three already-run files is enough (`app_state` keys for last-discovery).
- **Production deploy** — forbidden.
- **Preview deploy** — would still be a deploy; OAuth redirect URLs would not match. Local build + grep instead.
- **Rotating the service role key** — you do that in Supabase.

---

## Commits on this branch this session

1. Drive document discovery from recent sessions, not app opens.
2. Record that Onshape has no user-scoped new-document webhook for a free account.
3. Stop binding a new Onshape login onto an existing user row.
4. Let league owners rename and rotate join codes without a hardcoded name.
5. Count After Midnight only for 00:00-04:59 in Israel time, including both DST offsets.
6. Keep /admin public when REQUIRE_AUTH is on, and send logged-out visitors to /connect.
7. Degrade quietly when VAPID is missing, and keep the private key off the client.
8. Add a short ordered deploy checklist so preview is always tried before production.
9. (this file + QUESTIONS.md)

`npm run verify` is green after every task. `npm run build` succeeded for the secret grep.
