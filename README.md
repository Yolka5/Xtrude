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

The first two passes built this to the vendored `apple-design` skill in
`.claude/skills/apple-design/`, targeting iOS 26 Liquid Glass: dark-mode-first,
one glowing "ink" hero per screen, glass on every bar. It was tasteful and
dead. This pass keeps the colour model that came out of that work — neutral
base, three semantic overrides, one hashed document colour — and rebuilds
everything else around a different personality: Duolingo and Finch energy
applied to the same palette. Playful, chunky, physical, alive.

### Light mode only

Dark mode is gone, on purpose, not as an oversight. The whole point of this
pass is bold, saturated colour used with confidence — big gradient washes, not
a single restrained accent glowing on black. That reads as "vivid" only against
a light, near-white ground; the same gradients on ink would have to be
darkened back down to protect contrast, which is exactly the muted result this
pass was reacting against. `--ground: #f2f2f5` is the only background this app
has now.

### Rounded, chunky, enormous type

Headings and hero numbers run in **Fredoka**; everything else in **Nunito** —
both self-hosted via `next/font/google` so they work fully offline
(`src/lib/fonts.ts`). Both were chosen over two other pairings (Nunito alone,
Baloo 2 + Outfit) in a live side-by-side on the Today screen; Fredoka's
friendlier, rounder terminals read closest to Duolingo/Finch at hero-number
size, where Baloo felt slightly too playful for body text and Outfit's sharp
corners fought the chunky components. Hero numbers are set enormous (64–68px)
and heavy, because a streak or a rank is the one number per screen that should
feel like a fact worth bragging about, not a data point.

Text itself stays dark and legible everywhere — `--label: #17171a` on white,
and (this is the part that inverted from the previous pass) directly on every
hero gradient too, since all three semantic gradients were tuned so dark text
clears 4.5:1 against every stop. Colour goes in the shapes, never the words.

### Colour, boldly, in the shapes

The layered model survives unchanged in structure — neutral base, three
semantic overrides, one hashed document colour — but the treatment inverted.
The previous pass used one glowing dark "ink" surface per screen because a
saturated colour only cleared contrast against a dark background; this pass
instead tuned every gradient stop so **dark label text sits directly on it**,
which is what lets the hero itself be the bold, confident colour wash instead
of a muted glow behind white text.

| Layer | Colour | Where |
|---|---|---|
| **Neutral** (default) | white / near-black / grey | Everything: labels, chrome, badges, bars |
| **Prism** (the app's own default) | violet → magenta → pink | Profile's hero + heatmap, the tab bar's active pill, the week chart's bars |
| **Fire** (streak's own colour) | gold → red-orange | Today's hero, the ember — nowhere else |
| **Gold** (league's own colour) | amber → deep gold | League's hero, the race track, your row, the rank-1 number |
| **Document** (quiet identifier) | one of 5 blue-cyan hues, hashed from the name | A dot on session rows; Session Detail's own hero |

Verified green / unverified neutral / league movement up-green-down-red are
untouched. Every stop of every gradient — not just one representative
"text-safe" shade — is checked against dark label text in `npm run contrast`,
since the whole hero surface is now a colour field text can land on at any
point.

### Chunky, physical components

Every card, button, hero, and badge tile (`.chunk`, `.hero`, the `Chunky`
component) is built from the same physical metaphor: a thick block with a
solid, slightly darker bottom edge standing in for its own depth. Press it and
it pushes down into that edge — the shadow doesn't fade, it *disappears*,
because the element has physically moved down to meet it. That's the Duolingo
button feel, and it's applied to everything tappable, not just buttons:
session rows, badge tiles, the streak ember. If it's chunky, it should look
pressable, and if it's pressable, it presses.

### Motion past reasonable, on purpose

Every animation in this pass leans on a cartoon principle rather than a
reasonable ease curve, because the brief was explicit: if a motion feels
tasteful, it's wrong. Concretely:

- **Numbers** (`CountUp`) hit their target via a low-damping spring rather than
  a linear count, so they overshoot past the real value and wobble down to
  rest — anticipation and overshoot, not a clean ramp.
- **Chart bars** (`WeekChart`) shoot past full height, squash flat on landing,
  then correct with a small bounce — squash and stretch, staggered per bar so
  the eye reads one wave landing left to right.
- **Cards** (`TiltHero`) tilt in 3D toward the pointer/touch position and
  compress slightly on press, so a hero block reads as a physical object with
  weight rather than a flat rectangle.
- **Tab switches** (`PageTransition` + `FlyItem`) are not a cross-fade: the
  outgoing screen's blocks fly up and out in a fast staggered cascade, the
  incoming screen's fly in from below, staggered the other way.
- **The activity heatmap** (`ActivityHeatmap`) ripples in from the most recent
  cell outward, timed by each cell's actual distance from that point, rather
  than a flat row-by-row reveal.
- **The streak ember** (`StreakHero`) never sits still — an irregular flicker
  loop runs constantly, the one looping animation in the app, because a streak
  is the one thing that should feel alive — and tapping it punches into a
  bigger burst with confetti and a haptic.
- **League rows** (`league/page.tsx`) physically swap into place on load, each
  one offset by exactly how far its rank moved since last week and springing
  into its current slot; your own row flashes gold once it settles — an
  honest illustration of fixture data (`lastRank` vs. `rank`), not a fabricated
  live event.
- **Pull-to-refresh** (`PullToRefresh`) does something deliberately absurd:
  there's nothing to refresh in a static-fixture app, so pulling past the
  threshold fires a full confetti burst and a silly, honest message ("Still
  exactly 14 days. Go extrude something.") instead of faking a spinner.

### Celebration moments

Four places now have an explicit celebration, all tap-triggered rather than
event-triggered — there's no live state to react to in a fixtures-only app, so
the honest substitute is letting the user re-trigger the moment themselves:
tapping the streak ember, tapping an earned badge or a lifetime stat on
Profile, and the first-scroll-into-view stamp on a verified session chip.
Each pairs a haptic (`src/lib/haptics.ts`, feature-detected against the
Vibration API, silently absent on iOS/desktop) with a `canvas-confetti` burst
positioned at the element that triggered it.

### Real glass, tab bar only

Every other glass surface from the previous pass — nav bar, scroll-edge fades,
overlay chips — is gone; only the tab bar is glass now. It uses an actual SVG
displacement filter (`GlassDefs.tsx`: `feTurbulence` → `feGaussianBlur` →
`feDisplacementMap`), referenced from `backdrop-filter: blur(14px)
url(#xtr-glass-distort) saturate(180%)`, for genuine refraction rather than a
flat frosted blur — Chrome/Android supports SVG filters inside
`backdrop-filter`. An `@supports` guard falls back to a plain frosted blur
everywhere that doesn't (Safari included), and `prefers-reduced-transparency`
drops both in favour of a solid fill.

### A mascot, proposed but not built

Three CAD-native character sketches were proposed for a future pass — an
extrusion (a sketch circle extruded into a body, wearing a face), a filleted
block (a `.chunk` come to life), and a bearing/washer ring — each simple SVGs,
each deliberately not wired into the app yet. See the sketches sent alongside
this work.

### Motion is instant and calm for anyone who asked for that

`prefers-reduced-motion` doesn't just make things a little calmer here — every
one of the effects above collapses to instant. That took more than
`MotionConfig`'s `reducedMotion="user"`: Motion's own reduced-motion handling
neutralizes transform (`x`/`y`/`scale`/`rotate`) automatically, but leaves
`opacity`, `backgroundColor`, and `width` animations to run on their normal
timing — confirmed empirically (a page transition's opacity fade still took
~275ms under `prefers-reduced-motion: reduce` with a fresh Playwright
`reducedMotion: "reduce"` context, even though its transform was correctly
frozen). Every component with a non-transform property in its transition
(`FlyItem`, `PageTransition`'s stagger timing, the league row's opacity and
its gold flash's `backgroundColor`, the verified-chip stamp's opacity,
`StreakHero`'s entrance and idle halo) reads `useReducedMotion()` to zero out
just that transition's duration — never to change what gets rendered, only how
long the change takes, which is what keeps this consistent with the no-tree-
branching rule below. `PullToRefresh` goes further and disables the gesture
outright under reduced motion, since the whole feature is spectacle with no
functional purpose — there's nothing to make "calm," so it goes inert instead.

Two structural notes carried over from the previous pass, still true:

- The nav and tab bars live in the layout, **outside** the page transition. A
  `position: fixed` element inside a transformed ancestor resolves against that
  ancestor instead of the viewport, which would tear the chrome off the screen
  edges on every navigation. There is a test for this.
- No component branches on `useReducedMotion()` in a way that changes its
  tree. The hook returns `null` during static prerender, so a structural
  branch would render one tree on the server and another on the client — a
  hydration mismatch this app hit once already. Every reduced-motion check
  added this pass branches a transition's timing value, never the JSX.

### Accessibility is enforced, not asserted

`npm run contrast` measures dark label text against every stop of every
gradient — prism, fire, gold, and all 5 document hues — plus the glass tab
bar's composited backdrop, the active pill against all three prism stops, and
the heatmap ramp's step-to-step distinguishability. It also guards against
itself: every token value it measures is duplicated from `globals.css` and
`docColor.ts`, so a failed edit that leaves the test asserting a colour the
app no longer uses fails as `DRIFT` rather than passing while proving nothing.

`prefers-reduced-transparency` drops the tab bar's blur for a solid fill;
`prefers-contrast: more` tightens the palette; an `@supports` guard covers
browsers without `backdrop-filter`. Every interactive target is at least 44pt
— checked by a Playwright sweep, not just eyeballed.

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
