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

Apple's iridescent violet-magenta-pink (`#B24FE0` at full strength) reaches
only **2.7:1 on white** — the same failure a flat brand colour has. On ink it
reads clean. So colour can never be the loud element on a white card, but it
can be on a dark one — which is what makes "one hero per screen" and "use as
little colour as you can get away with" the same design rather than two
competing ones. The base is neutral by a wide margin — white paper, near-black
ink, grey chrome — and colour is an override a screen opts into, never the
ink surface's resting state.

### A layered colour model, not one accent

The first build used a single brand accent everywhere. That was wrong for the
same reason the HIG warns against reusing one colour for different meanings:
it flattens streak, competition, and "this is document X" into the same
visual event. Four layers now, most restrictive first:

| Layer | Colour | Where |
|---|---|---|
| **Neutral** (default) | white/black/grey | Everything: labels, numbers, chrome, badges, bars |
| **Prism** (the app's own default) | violet → magenta → pink, a real gradient | Profile's heatmap (the one hero with no semantic of its own), glass rims, the glow beneath the tab bar, the active tab pill |
| **Fire** (streak's own colour) | amber → red-orange | Today's hero, the ember — nowhere else |
| **Gold** (league's own colour) | podium gold | League's hero, the race track, your row, the rank-1 number |
| **Document** (quiet identifier) | one of 5 blue-cyan hues, hashed from the name | A small dot on session rows, the accent on Session Detail's hero |

Verified green / unverified neutral / league movement up-green-down-red are
untouched — they were already correct.

Prism never touches text — `#B24FE0` fails exactly like the old flat orange
did — so the tab pill's label stays neutral and only the translucent capsule
behind it carries colour. Fire and gold are exceptions on their own hero:
there the colour *is* the meaning (a streak is a flame, a leaderboard is a
podium), so `--hero-accent`/`--hero-chip-bg` custom properties let those two
screens override prism's default glow without a second CSS block — Profile
sets nothing and gets prism, which is deliberate.

Document colour is the one entirely new placement: `src/lib/docColor.ts`
hashes a document's name to one of 5 curated blue-cyan hues (FNV-1a, stable
forever). Five, not six — a sixth hue in that family couldn't be made to
clear 3:1 against both a white *and* a dark card at once, and the brief's own
rule is to shrink the set rather than weaken the test. A hash collision just
means two documents quietly share a colour.

Twelve badges do NOT each get a colour: an earned-badge disc is neutral, with
one exception — a flame/flame2 glyph tints its own icon fire, even on the
neutral disc, because "the flame mark uses fire" wherever it appears. That
restraint is deliberate: Profile's one coloured moment is the heatmap, and a
dozen colourful badge discs on the same screen would be the opposite of "one
or two coloured moments, not five."

### Making the glass visible

Glass over flat white is indistinguishable from a grey rectangle. Two layers
give it something to bend:

1. A **scroll edge** at each screen edge that dissolves content into the ground
   with a progressive blur ramping toward the bar — straight out of
   HIG > Liquid Glass: *"Background content is blurred and reduced in opacity
   at scroll edges to enhance legibility."*
2. A prism **glow re-laid on top of that fade**, between it and the tab bar —
   two off-centre stops (violet, pink) plus a magenta core, light dispersing
   through glass rather than a flat tint.

The glow matters twice over. First, the scroll edge that stops content
ghosting through the chrome would otherwise erase any colour wash underneath
it too, leaving the bar floating over flat paint again — re-laying the glow
*on top of* the fade is what fixes that. Second, it's deliberately the only
place prism washes the page: the nav bar over plain scrolled content stays
clear glass with nothing to bend, which is both more restrained and closer to
how real Liquid Glass behaves (it tints from what's actually behind it, not
from a fake wash painted everywhere).

Pushing the tint toward opaque would also have fixed the ghosting. But then it
stops being glass.

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
behind it — ground and glow — before measuring, so "AA against its real
backdrop" is a check rather than a claim. Every layer of the colour model is
covered: all three prism stops against the tab pill's real backdrop, fire's
mid stop against the white ember icon it sits under, gold on ink *and* on
paper in both themes (a single hex can't clear both when "paper" is white in
one theme and near-black in the other), and all 5 document hues against a
white card, a dark card, *and* the ink hero at once.

It also guards against itself: the token values it measures are duplicated from
`globals.css`, so every one is verified to literally appear in the stylesheet
first. A failed edit that leaves the test asserting a colour the app no longer
uses fails as `DRIFT` rather than passing while proving nothing.

`prefers-reduced-transparency` drops the blur and the glow for solid fills;
`prefers-reduced-motion` makes everything instant and stops the ember;
`prefers-contrast: more` tightens the palette (including gold's on-paper text,
which gets its own darker/lighter override per theme); and an `@supports`
guard covers browsers without `backdrop-filter`. Every interactive target is
at least 44pt.

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
