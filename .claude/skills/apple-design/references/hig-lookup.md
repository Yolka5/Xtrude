# HIG Reference Lookup

Routing table for `references/hig/`. Load only what the design under review
actually needs — a typical review pulls 3-8 files.

## Present in this repo

| Topic | File | Load when |
|---|---|---|
| Contrast ratios, touch target sizes, scalable text, colour-blind safety, reduced motion, screen readers, Switch Control | `hig/accessibility.md` | **Every review.** SKILL.md marks this always-load. |
| Colour systems, semantic colours, accent usage, light/dark variants, inclusive colour, colour management | `hig/color.md` | **Every review.** |
| Layout, safe areas, visual hierarchy, adaptability, device dimensions, size classes | `hig/layout.md` | **Every review.** |
| Liquid Glass, glassmorphism, frosted chrome, functional vs content layer, blur radii and opacities, scroll edge effects | `hig/liquid-glass.md` | Any design using translucency, backdrop blur, or a floating control layer. |
| Material thickness, translucency levels, depth and layering between foreground and background | `hig/materials.md` | Alongside `liquid-glass.md` whenever materials are in play. Short; the detailed thickness and vibrancy tables live in `liquid-glass.md`. |
| Accent colour choice, custom fonts, brand voice, when branding should defer to content | `hig/branding.md` | Choosing or defending a brand accent, custom type, or any logo placement. |
| Motion purpose, feedback timing, brevity, letting people cancel animation | `hig/motion.md` | Any design with transitions, animated feedback, or custom motion. |
| Custom settings areas, what belongs in system settings vs in-app, task-specific options | `hig/settings.md` | Reviewing a settings or preferences surface. |
| Drag sources and destinations, drag images, drop feedback, spring loading | `hig/drag-and-drop.md` | Reviewing any drag interaction. |

## Referenced by SKILL.md but NOT yet present

`SKILL.md` names these; they are not in this repo. If a review needs one, say
so explicitly rather than inventing the guideline from memory.

- `hig/typography.md` — SKILL.md marks this "always load". Still missing.
- `hig/dark-mode.md` — partially covered by `hig/color.md`
- `hig/app-icons.md`, `hig/icons.md`, `hig/sf-symbols.md`
- `hig/entering-data.md`, `hig/keyboards.md`
- `hig/onboarding.md`, `hig/launching.md`
- `hig/generative-ai.md`, `hig/machine-learning.md`

## Hard numbers worth not re-deriving

From `hig/accessibility.md`, since these decide pass/fail rather than taste:

| | |
|---|---|
| Text up to 17pt, any weight | 4.5:1 minimum contrast |
| Text 18pt+, or any bold text | 3:1 minimum |
| Mobile control size | 44×44pt default, 28×28pt absolute minimum |
| Desktop control size | 28×28pt default, 20×20pt absolute minimum |
| Padding around bezelled elements | ~12pt |
| Padding around unbezelled elements | ~24pt |
| Mobile type | 17pt default, 11pt minimum |

Contrast must be measured against the **actual** rendered backdrop. A label on
a translucent surface is read against that surface composited over whatever is
behind it, so composite first, then measure. Thin custom weights need larger
sizes than the minimums above.

Under Reduce Motion, `hig/accessibility.md` asks for more than "turn animation
off": tighten springs to remove bounce, keep gesture-tracked animation, avoid
animating z-axis depth changes, replace x/y/z transitions with fades, and avoid
animating into and out of blurs.
