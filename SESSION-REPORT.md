# Session report — 11 Sep 2026 (push / invite / first-run)

Branch: **`session/oauth-leagues-streaks`** (no new branch).  
Previous session on this branch was already pushed (`df70baf`). This follow-up started after that push.  
Production deploy this session: **none**. Preview deploy: **none**.  
SQL against live Supabase: **none**. New migration files: **none**.  
Onshape API calls this session: **0** (budget 0). Running count:

| # | Call | Why |
|---|---|---|
| — | *(none)* | Push decisions, invite landing, and Today copy are all synthetic / local. |

Off-limits this follow-up (untouched): discovery scheduler, badge/streak math in `derive.ts`, league rename/regen, auth binding.

---

## Finished

### 1. Push notification triggers
Uses existing `push_subscriptions` + `sendPushToUser`. New `/api/cron/push` at **18:00 UTC** (20:00 IST / 21:00 IDT — always past 20:00 Asia/Jerusalem). Also evaluated after dirty sync and the existing discover cron (discover is 22:00 UTC / 01:00 IDT, so streak-at-risk will not fire there).

- **Streak at risk:** active streak (`current > 0`), `daily_stats.session_count` for today is 0 (a session, not a 10-minute qualifying day), local hour ≥ 20. Copy: “Your N-day streak needs a session before midnight.”
- **Overtaken in league:** weekly scored minutes. Someone who was behind or tied now has a **strictly higher** total. Rank movement from last week is ignored. First snapshot stores a baseline and does not notify.
- **Badge earned:** only vs a stored earned-id snapshot. First snapshot of historical badges does not notify. Unearned badges do not notify.

Debounce: `app_state` keys `push_dedupe_<user>_<kind>[_extra]_<Israel day>`. A failed send is not marked, so a missing VAPID key does not burn the day. Prefs: `notify_streak` / `notify_league` still gate those two; badge fires if they are subscribed.

**Tests (mutation-checked):**
- 20:00 IDT/IST fire; 19:59 and 01:00 do not; no streak / already-sessioned / already-sent do not. Forced `isPastStreakRiskHour` true → 19:59 checks **red** → reverted.
- Pass fires; stay-ahead, first snapshot, already-ahead, you-passing-them do not; tie-then-pass does. Dropped the “was behind or tied” clause → already-ahead **red** → reverted.
- First snapshot (null) does not fire; unearned does not; new id does; already-snapshotted does not. Null snapshot treated as `[]` → first-snapshot **red** → reverted.

### 2. Invite flow
Shareable `/join/?code=ABC234` next to the existing manual code field. Logged-out: `/join/` is public (so `REQUIRE_AUTH=1` does not strip the query), page redirects to `/connect/?next=/join/?code=…`, Connect passes `next` into OAuth start, start stores `xtrude_invite` for the Onshape round-trip, callback joins **as the new session user** (not the Yoni fallback) and lands on `/league/?league=<id>`. Logged-in: join immediately. Manual code entry on League is unchanged. Rename / regen APIs unchanged.

**Tests (mutation-checked):**
- Logged-out plan is `connect` with the code in `next`; logged-in plan is `join` as that user id. Forcing Yoni’s id on logged-out → **red** → reverted.
- `REQUIRE_AUTH=1` leaves `/join/` public. Removing `/join` from public paths redirected to `/connect/` with the query stripped → **red** → reverted.
- Open-redirect `next` values are ignored.

### 3. New-user first run (Today)
Zero sessions: no `StreakHero`, no 0-minute cards, no empty week chart, no placeholder streak. Background sync is skipped (nothing to ingest; avoids a page-load Onshape pull).

- Not bound to Onshape: “Connect Onshape to start” + Connect button.
- Bound: “Go model something.” No CTA that invents data. Copy says there is no streak yet.

**Tests (mutation-checked):** any real session hides first-run; unbound vs bound copy; no invented digits. Returning “0-day streak” → those checks **red** → reverted.

---

## Compiles but unverified

- A real device actually receiving streak / overtake / badge pushes (no permission grant, no preview deploy).
- Clicking an invite link while logged out, finishing OAuth, landing in the league.
- Today first-run in the browser — the live user has sessions, and opening local `next dev` against production env would run dirty sync (Onshape). Skipped to keep the budget at 0.

---

## Skipped, and why

- **Discovery / badges / streaks / league rename / auth binding** — off limits; being verified manually.
- **Any Onshape CAD call** — budget 0.
- **SQL / new migrations** — debounce and snapshots use existing `app_state`.
- **Production or preview deploy** — forbidden.

---

## Commits on this branch this session

1. Fire streak, league, and badge pushes from real events, once per day.
2. Keep league invites through connect so a logged-out link still lands in the league.
3. Show an honest Today empty state instead of a fake zero streak.
4. (this file)

`npm run verify` is green after every task.
