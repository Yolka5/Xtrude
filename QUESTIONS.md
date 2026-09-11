# Questions

I did not stop for these. Defaults I used are in brackets.

1. **Company-scoped Onshape webhooks** — Docs allow `companyId` for `onshape.document.lifecycle.created` (all present and future *company-owned* documents). That needs a company admin. [Treated as unavailable on this free/EDU personal account. Discovery polling stays. See WEBHOOK-SCOPE.md.]

2. **`REQUIRE_AUTH=1`** — Flip only the day a link is shared. [Left unset.]

3. **Rotate Supabase service role** — Do this before a second person logs in. [Not rotated from here.]

4. **Push on a real device** — Opt-in + test send is in Profile. I could not grant the browser permission prompt from this session, so a notification actually arriving is unverified. [Code path is in; try it on preview after you deploy.] Streak / overtake / badge triggers are unit-tested; delivery is still unverified.

5. **Preview deploy** — Task 7 asked for preview end-to-end. I did not deploy (production forbidden; preview would still be a deploy, and OAuth redirect is not registered for random preview URLs). [Local production build + secret grep instead.]

6. **Existing league named “Xtrude”** — Seeded by `migrate-leagues.sql` (already run, not edited). Owners can rename it in the UI. [Left the live row as-is.]

7. **Invite click-through** — Logged-out `/join/?code=` → `/connect/` → OAuth → league is wired and unit-tested. Not clicked on a real URL this session (no deploy). [Try on preview: copy the invite link from League, open it logged out.]

8. **Today first-run in the browser** — Copy is unit-tested. Did not open local Today against the live project (that would background-sync with Onshape keys). [Looks right on an account with zero sessions.]
