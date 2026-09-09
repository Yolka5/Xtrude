# HIG Reference Lookup

Routing table for `references/hig/`. Load only what the design under review
actually needs — a typical review pulls 3-8 files.

## Present in this repo

| Topic | File | Load when |
|---|---|---|
| Liquid Glass, glassmorphism, frosted/translucent chrome, materials, blur, vibrancy | `hig/liquid-glass.md` | Any design using translucency, backdrop blur, or a floating functional layer. Also the reference for material thickness and vibrancy levels. |
| Color systems, semantic colors, accent usage, light/dark variants, inclusive color, color management | `hig/color.md` | Every review. |
| Layout, safe areas, visual hierarchy, adaptability, device dimensions, size classes | `hig/layout.md` | Every review. |
| Motion, animation purpose, feedback timing, reduced motion | `hig/motion.md` | Any design with transitions, animated feedback, or custom motion. |

## Referenced by SKILL.md but NOT yet present

`SKILL.md` names these; they are not in this repo yet. If a review needs one,
say so explicitly rather than inventing the guideline from memory.

- `hig/accessibility.md` — SKILL.md marks this "always load"
- `hig/typography.md` — SKILL.md marks this "always load"
- `hig/materials.md` — partially covered by the Standard Materials section of `hig/liquid-glass.md`
- `hig/dark-mode.md` — partially covered by `hig/color.md`
- `hig/app-icons.md`, `hig/icons.md`, `hig/sf-symbols.md`
- `hig/entering-data.md`, `hig/keyboards.md`
- `hig/onboarding.md`, `hig/launching.md`
- `hig/generative-ai.md`, `hig/machine-learning.md`

## Interim substitutes

Until `accessibility.md` lands, hold designs to these explicit bars, which are
stricter than "looks fine":

- WCAG AA contrast against the **actual** rendered backdrop, not an idealised
  one. 4.5:1 for text under 18pt, 3:1 for large text and for graphic objects
  such as chart marks and icon strokes.
- Touch targets >= 44pt on mobile, >= 24pt on desktop.
- `prefers-reduced-transparency` must drop backdrop blur for a solid fill.
- `prefers-reduced-motion` must drop non-essential animation.
- Never encode information in color alone — pair it with a glyph, label, or
  numeral.
