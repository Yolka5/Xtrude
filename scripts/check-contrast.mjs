/**
 * WCAG contrast checker for the design tokens.
 *
 * Run: node scripts/check-contrast.mjs
 *
 * The point of this file is the phrase "against its actual backdrop". Glass
 * surfaces are semi-transparent, so a label on the tab bar is not being read
 * against the tint - it is being read against the tint composited over
 * whatever ground is behind it. This composites first, then measures.
 */

import { readFileSync } from "node:fs";

const hex = (h) => {
  const s = h.replace("#", "");
  const n = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};
const rgba = (s) => {
  const m = s.match(/rgba?\(([^)]+)\)/);
  const p = m[1].split(",").map((x) => parseFloat(x.trim()));
  return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
};
const parse = (s) =>
  Array.isArray(s) ? s : s.startsWith("#") ? [...hex(s), 1] : rgba(s);

/** src over dst, both straight RGBA. */
const over = (src, dst) => {
  const [r, g, b, a] = parse(src);
  const [R, G, B] = parse(dst);
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
};

const lum = (c) => {
  const f = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratio = (a, b) => {
  const [x, y] = [lum(parse(a)), lum(parse(b))];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
};

const L = {
  ground: "#f6f3ef", surface: "#ffffff", surface2: "#f4f0eb", surface3: "#e9e3db",
  label: "#1c1712", label2: "#574f47", label3: "#5f574e",
  accentGraphic: "#e35a00", accentText: "#a03e00",
  pos: "#15703f", neg: "#a8322a",
  glassTint: "rgba(255,252,248,0.72)", chromeSolid: "#fdfaf6",
  mesh: "rgba(255,107,0,0.26)", glow: "rgba(255,107,0,0.42)",
  barTop: "#f26100", barBottom: "#cc4e00",
  discTop: "#e35a00", discBottom: "#b84600",
};
const D = {
  ground: "#0c0a08", surface: "#1a1612", surface2: "#241f19", surface3: "#322a22",
  label: "#fdfbf9", label2: "#b9ada0", label3: "#a99d90",
  accentGraphic: "#ff7a1f", accentText: "#ff9e57",
  pos: "#4fd786", neg: "#ff8f85",
  glassTint: "rgba(30,24,18,0.62)", chromeSolid: "#1b1611",
  mesh: "rgba(255,107,0,0.30)", glow: "rgba(255,107,0,0.38)",
  barTop: "#ff8c3d", barBottom: "#ff6b00",
  discTop: "#e35a00", discBottom: "#b84600",
};

/* The ink hero and its activity ramp are the same in both themes, except that
   dark mode raises the hero surface so it lifts off a near-black ground. */
const INK = { light: "#17120d", dark: "#241b13" };
const HEAT = ["#2a231b", "#6b3a10", "#a8570c", "#e0700a", "#ff8f2e"];
const ON_INK = {
  label: "#ffffff",
  label2: "rgba(255,236,220,0.78)",
  label3: "rgba(255,236,220,0.60)",
  brand: "#ff6b00",
  unit: "#ffb87f",
  pos: "#6ee7a0",
  neg: "#ff9d94",
};

/* Worst case for the chrome: the mesh is at its most saturated directly under
   the floating tab bar, which is exactly where the tab labels sit. Composite
   the mesh over the ground, then the glass tint over that, and measure the
   labels against THAT - not against an idealised flat background. */
// The tab bar's true backdrop is the ground, plus the mesh, plus the warm glow
// re-laid over the scroll-edge fade. All three, then the tint.
const washL = over(L.glow, over(L.mesh, L.ground));
const washD = over(D.glow, over(D.mesh, D.ground));
const glassL = over(L.glassTint, washL);
const glassD = over(D.glassTint, washD);

const AA = 4.5, AA_LARGE = 3.0, GRAPHIC = 3.0;
let fails = 0;

/* --------------------------------------------------------------------------
   Guard against the table above drifting away from the stylesheet.

   These values are duplicated from globals.css, which means a failed edit can
   leave this file asserting a colour the app does not actually use - a test
   that passes while proving nothing. Every value is therefore checked for its
   literal presence in the stylesheet before any contrast is measured.
   -------------------------------------------------------------------------- */
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const norm = (v) => v.replace(/\s+/g, "").toLowerCase();
const cssTokens = norm(css);

function assertInCss(label, value) {
  if (!cssTokens.includes(norm(value))) {
    console.log(`DRIFT  ${label} = ${value} does not appear in globals.css`);
    fails++;
  }
}
for (const [mode, T] of [["light", L], ["dark", D]]) {
  for (const [k, v] of Object.entries(T)) {
    if (typeof v === "string") assertInCss(`${mode}.${k}`, v);
  }
}
for (const [k, v] of Object.entries(INK)) assertInCss(`ink.${k}`, v);
HEAT.forEach((v, i) => assertInCss(`heat-${i}`, v));
if (fails) console.log("");

const check = (name, fg, bg, min) => {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) fails++;
  const bgs = Array.isArray(bg)
    ? `rgb(${bg.slice(0, 3).map((v) => Math.round(v)).join(",")})`
    : bg;
  console.log(
    `${ok ? "  ok " : "FAIL "} ${r.toFixed(2).padStart(6)}:1  (min ${min})  ${name}`,
    ok ? "" : `\n        fg ${fg} on ${bgs}`
  );
};

for (const [mode, T, glass] of [["LIGHT", L, glassL], ["DARK", D, glassD]]) {
  console.log(`\n=== ${mode} ===`);
  const ink = mode === "LIGHT" ? INK.light : INK.dark;
  console.log("-- text on solid content surfaces (the numbers) --");
  check("label on card",              T.label,  T.surface,  AA);
  check("label-2 on card",            T.label2, T.surface,  AA);
  check("label-3 on card",            T.label3, T.surface,  AA);
  check("label-2 on ground",          T.label2, T.ground,   AA);
  check("label-3 on ground",          T.label3, T.ground,   AA);
  // Section headings and subtitles sit on the bare ground, which the mesh
  // tints. Measure them where the mesh is strongest, not on flat paint.
  check("label-2 on ground+mesh",     T.label2, over(T.mesh, T.ground), AA);
  check("label-3 on ground+mesh",     T.label3, over(T.mesh, T.ground), AA);
  check("accent-text on ground+mesh", T.accentText, over(T.mesh, T.ground), AA);
  check("label-2 on surface-2",       T.label2, T.surface2, AA);
  check("label-3 on surface-2",       T.label3, T.surface2, AA);
  check("accent-text on card",        T.accentText, T.surface,  AA);
  check("accent-text on ground",      T.accentText, T.ground,   AA);
  check("accent-text on surface-2",   T.accentText, T.surface2, AA);
  check("positive on card",           T.pos,    T.surface,  AA);
  check("negative on card",           T.neg,    T.surface,  AA);

  console.log("-- text on GLASS, composited over the ground wash --");
  check("label on glass",             T.label,      glass, AA);
  check("label-2 on glass",           T.label2,     glass, AA);
  check("label-3 on glass (tab idle)",T.label3,     glass, AA);
  check("accent-text on glass",       T.accentText, glass, AA);

  console.log("-- text on the reduced-transparency solid fallback --");
  check("label-3 on chrome-solid",    T.label3,     T.chromeSolid, AA);
  check("accent-text on chrome-solid",T.accentText, T.chromeSolid, AA);

  console.log("-- text on the INK hero (where the brand orange is legible) --");
  check("white on ink",               ON_INK.label,  ink, AA);
  check("hero secondary on ink",      ON_INK.label2, ink, AA);
  check("hero tertiary on ink",       ON_INK.label3, ink, AA);
  check("BRAND #ff6b00 on ink",       ON_INK.brand,  ink, AA);
  check("hero unit on ink",           ON_INK.unit,   ink, AA);
  check("hero positive on ink",       ON_INK.pos,    ink, AA);
  check("hero negative on ink",       ON_INK.neg,    ink, AA);

  console.log("-- graphic objects (3:1) --");
  // A gradient bar has to clear the bar at BOTH ends, not just where it is
  // darkest - the light end is the one that fails on white.
  check("bar gradient top on card",   T.barTop,    T.surface, GRAPHIC);
  check("bar gradient base on card",  T.barBottom, T.surface, GRAPHIC);
  check("accent graphic on card",     T.accentGraphic, T.surface, GRAPHIC);
  // White glyphs and initials ride on these gradients, so the lightest stop
  // of the disc has to clear the bar too.
  check("white glyph on disc (light end)", "#ffffff", T.discTop,    GRAPHIC);
  check("white glyph on disc (dark end)",  "#ffffff", T.discBottom, GRAPHIC);

  console.log("-- activity ramp, on ink in both themes --");
  check("empty cell vs ink",          HEAT[0], ink, 1.05);
  // The lightest step must be clearly heavier than "no activity", or a day
  // with work reads as emptier than a day without.
  check("step 1 vs empty",            HEAT[1], HEAT[0], 1.35);
  check("step 2 vs step 1",           HEAT[2], HEAT[1], 1.2);
  check("step 3 vs step 2",           HEAT[3], HEAT[2], 1.2);
  check("step 4 vs step 3",           HEAT[4], HEAT[3], 1.15);
}

console.log(fails === 0 ? "\nAll checks pass.\n" : `\n${fails} FAILING.\n`);
process.exit(fails === 0 ? 0 : 1);
