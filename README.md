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
| Median session | 12 minutes of credited time |
| Session range | 6–25 minutes |
| Sessions per active day | 2.25 |
| History | 182 days, 284 sessions, 126 active days |

Short bursts, several a day. People open CAD, fix one thing, and leave. The
design is tested against that shape rather than against tidy hour-long blocks.

Scoring mirrors `phase0_validate.py` exactly:

```
rawMinutes    = last event - first event
scoredMinutes = min(raw + 5, 240)
```

with a 20-minute idle threshold splitting sessions and clusters under 3 events
discarded as noise.

Document choice is streaky rather than uniform: engineering work has a focus,
so a document is held for three to eight active days before rotating. Drawing
each session independently produced stretches where one document dominated a
month by accident, which reads as a bug and is less true to how people work.

The generator asserts its own output. Badges make factual claims — "50 hours
modeled", "14-day streak" — and regenerating shifts every number, so each claim
is checked against the data and the run fails rather than shipping a
contradiction. An earlier version shipped a "100 hours" badge marked earned
against a 45-hour history.

The app has a fixed `TODAY` constant and never reads the clock. It is
statically exported, so a clock-dependent render would drift out of sync with
the prerendered HTML the moment the day rolled over.

## The design

Built to the vendored `apple-design` skill in `.claude/skills/apple-design/`,
targeting iOS 26 Liquid Glass.

### Three surface families

The whole design is one split:

| | |
|---|---|
| **Glass** (functional) | Tab bar, nav bar, scroll edges, overlay chips. Translucent, blurred, floating. Never carries a value. |
| **Paper** (content) | White / near-black cards. Solid, quiet, recessive. Everything you read a number off lives here. |
| **Ink** (hero) | One deep, glowing block per screen. Solid, loud. |

### Why ink exists

The brand orange `#FF6B00` reaches only **2.86:1 on white** — below even the
3:1 bar for graphic marks, let alone the 4.5:1 for text. On ink it reaches
**6.5:1**. So the accent can never be the loud element on a white card, but it
can be on a dark one.

Giving each screen a single ink block is what lets the real brand colour be
used at full strength. The visual hierarchy and the colour system solve each
other: Today's streak, Session Detail's scored time, League's own row, and
Profile's all-time heatmap are all ink, and everything else on those screens
is deliberately quieter.

The activity heatmap is the clearest case. On ink its ramp can run all the way
up to full brand orange, and because its backdrop no longer changes with the
colour scheme, **one ramp serves both themes**.

### One accent, a real ramp

A nine-step orange ramp (`--o-100` … `--o-900`), not one hex used flat. Which
step gets used is decided by measured contrast, not by eye:

| Use | Step | Why |
|---|---|---|
| Brand, glows, text on ink | `--o-500` `#FF6B00` | 6.5:1 on ink |
| Graphic marks on light | `--o-600` `#E35A00` | 3.67:1 on white |
| Chart bars on light | `#F26100` → `--o-700` | both stops clear 3:1 |
| Text and links on light | `#A03E00` | 4.5:1 on white *and* on the mesh-tinted ground |

Green and red appear only for league movement, and never alone — every
indicator carries an arrow, a number, and a colour, so it survives colour
blindness and greyscale. On ink both are lightened, because the light-mode
green is far too dark against it.

### Making the glass visible

Glass over flat white is indistinguishable from a grey rectangle. Three layers
give it something to bend:

1. A fixed **mesh** of soft accent washes behind all content.
2. A **scroll edge** at each screen edge that dissolves content into the ground
   with a progressive blur ramping toward the bar — straight out of
   HIG > Liquid Glass: *"Background content is blurred and reduced in opacity
   at scroll edges to enhance legibility."*
3. A warm **glow re-laid on top of that fade**, between it and the tab bar.

Step 3 matters: the scroll edge that stops content ghosting through the chrome
would otherwise also erase the mesh, leaving the bar floating over flat paint
again. The glow is the layer that makes the glass read as glass.

That combination is also the fix for content ghosting through the tab bar.
Pushing the tint toward opaque would have worked too, but then it stops being
glass.

### Motion

Spring physics via `motion`, not linear fades. Numbers count up on first scroll
into view, chart bars grow from the baseline on a staggered spring, cards scale
to 0.97 under the finger and spring back, the tab bar's selection pill morphs
between tabs on a shared `layoutId`, screens cross-fade, heatmap cells stagger
in by column, and the streak ember carries a slow idle breath — the only
looping animation in the app, because a streak is the one thing that should
feel alive.

Two structural notes:

- The nav and tab bars live in the layout, **outside** the page transition. A
  `position: fixed` element inside a transformed ancestor resolves against that
  ancestor instead of the viewport, which would tear the chrome off the screen
  edges on every navigation. There is a test for this.
- No component branches on `useReducedMotion()` in a way that changes its tree.
  The hook returns `null` during static prerender, so a branch renders one tree
  on the server and another on the client — a hydration mismatch. A single
  `MotionConfig reducedMotion="user"` handles it instead, which also matches
  HIG's guidance to *replace* x/y transitions with fades rather than delete
  them.

### Accessibility is enforced, not asserted

`npm run contrast` composites every translucent surface over what is actually
behind it — ground, mesh, and glow — before measuring, so "AA against its real
backdrop" is a check rather than a claim. All text clears 4.5:1 and all graphic
marks clear 3:1 in both themes, including white glyphs on orange discs and both
ends of every gradient.

It also guards against itself: the token values it measures are duplicated from
`globals.css`, so every one is verified to literally appear in the stylesheet
first. A failed edit that leaves the test asserting a colour the app no longer
uses fails as `DRIFT` rather than passing while proving nothing.

`prefers-reduced-transparency` drops the blur, the mesh and the glow for solid
fills; `prefers-reduced-motion` makes everything instant and stops the ember;
`prefers-contrast: more` tightens the palette; and an `@supports` guard covers
browsers without `backdrop-filter`. Every interactive target is at least 44pt.

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
