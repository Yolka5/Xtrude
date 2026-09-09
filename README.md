# Xtrude

Modeled time, measured from what you actually built.

## Where this is

**Phase 0 — done.** `phase0_validate.py` answered the only question that
mattered before building anything: does Onshape's microversion history contain
enough granular, timestamped events to reconstruct real working sessions? It
does. 73.5% of gaps between consecutive events are under 30 seconds, which
means Onshape records granular edits rather than coarse checkpoints, and the
session-reconstruction model holds.

**Phase 0.5 — this app.** A static visual shell of the product, deployable to
Vercel and installable to a phone home screen. Every number on screen is a
constant. There is no backend, no database, no auth, and no Onshape
integration. The point is to look at the design on a real phone before
building the real thing.

## What is deliberately not here

- No Onshape API calls. `phase0_validate.py` is untouched.
- No Supabase or any database.
- No authentication.
- No scoring logic. The scoring *parameters* are mirrored into the fixtures so
  the numbers are internally consistent, but nothing computes a score at
  runtime.

## Running it

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # static export to out/
npm start              # serve the built output
```

Supporting scripts:

```bash
npm run fixtures       # regenerate src/lib/fixtures.ts
npm run icons          # regenerate the PWA icons
npm run contrast       # WCAG check on the design tokens
```

## The data

`src/lib/fixtures.ts` is generated, committed, and imported as plain constants.
It is shaped from what Phase 0 measured, not invented:

| | |
|---|---|
| Median session | 11 minutes of credited time |
| Session range | 6–25 minutes |
| Sessions per active day | 2.3 |
| History | 182 days, 276 sessions, 121 active days |

Short bursts, several a day. People open CAD, fix one thing, and leave. The
design is tested against that shape rather than against tidy hour-long blocks.

Scoring mirrors `phase0_validate.py` exactly:

```
rawMinutes    = last event - first event
scoredMinutes = min(raw + 5, 240)
```

with a 20-minute idle threshold splitting sessions and clusters under 3 events
discarded as noise.

The app has a fixed `TODAY` constant and never reads the clock. It is
statically exported, so a clock-dependent render would drift out of sync with
the prerendered HTML the moment the day rolled over.

## The design

Built to the vendored `apple-design` skill in `.claude/skills/apple-design/`,
targeting iOS 26 Liquid Glass.

**Two layers, and the split is the whole point.**

The *functional* layer — bottom tab bar, top nav bar, overlay chips — gets the
Liquid Glass material: `backdrop-filter: blur(30px) saturate(180%)` over a
semi-transparent tint, a 1px specular highlight on the lit top edge, a soft
wide shadow for separation, and continuous corner curvature where the browser
supports `corner-shape: squircle`.

The *content* layer — stat cards, charts, leaderboard rows — stays solid.
Nothing translucent ever sits behind a number. This is a data app; if a value
is hard to read the design has failed no matter how good the glass looks.

**One accent.** System blue, used for data marks and primary actions. Charts
get four steps of that one accent plus an empty state, not a rainbow. Green and
red appear only for league movement, and never alone — every movement
indicator carries an arrow, a number, and a colour, so it survives colour
blindness and greyscale.

**Accessibility is enforced, not asserted.** `npm run contrast` composites
every glass surface over the ground wash behind it and measures the result, so
"AA against its actual backdrop" is a check rather than a claim. All text
clears 4.5:1 and all chart marks clear 3:1 in both light and dark.
`prefers-reduced-transparency` drops the blur for a solid fill,
`prefers-reduced-motion` drops the animation, `prefers-contrast: more`
tightens the palette, and an `@supports` guard gives browsers without
`backdrop-filter` a solid background rather than an unreadable transparent one.

## PWA

Installable on both Android and iOS.

- `public/manifest.webmanifest` — standalone display, 192/512 icons plus a
  maskable variant, theme and background colours.
- `public/sw.js` — precaches the four tab routes, then network-first for pages
  and cache-first for hashed build output. `scripts/stamp-sw.mjs` stamps the
  commit SHA into the cache name at build time, so a deploy can never strand a
  client on stale chunk references.
- iOS specifics: `apple-touch-icon`, `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, and `viewport-fit=cover` with
  `env(safe-area-inset-*)` padding throughout. The floating tab bar sits above
  the home indicator via `env(safe-area-inset-bottom)`.

## Deploying

Zero-config on Vercel — it detects Next.js and serves the static export.
`vercel.json` only sets cache headers, the important one being that `sw.js` is
never cached.

```bash
npx vercel --prod
```
