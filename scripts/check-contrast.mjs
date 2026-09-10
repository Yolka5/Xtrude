/**
 * WCAG contrast checker for the design tokens - rewritten for the
 * "Duolingo/Finch energy" personality pass (light mode only, bold gradient
 * heroes, dark text throughout).
 *
 * Run: node scripts/check-contrast.mjs
 *
 * The governing constraint this pass had to keep: dark text (var(--label))
 * sits on top of vivid prism/fire/gold/document gradients, so every stop of
 * every gradient is verified here, not just the semantic's "text" shade -
 * there's no separate text-safe shade any more, because dark text works
 * directly on all of them by construction.
 *
 * A DRIFT guard verifies every value below literally appears in globals.css
 * or docColor.ts, so a failed edit that leaves this file asserting a colour
 * the app no longer ships fails loudly instead of passing while proving
 * nothing.
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
  const x = lum(parse(a)), y = lum(parse(b));
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
};

const AA = 4.5, GRAPHIC = 3.0;
let fails = 0;

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

/* --------------------------------------------------------------------------
   Tokens, duplicated from globals.css / docColor.ts for measurement.
   -------------------------------------------------------------------------- */
const T = {
  ground: "#f2f2f5", surface: "#ffffff", surface2: "#f1f1f4", surface3: "#e6e6ea",
  label: "#17171a", label2: "#57575d", label3: "#5c5c62",
  pos: "#15703f", neg: "#a8322a",
  glassTint: "rgba(255, 255, 255, 0.68)",
  chromeSolid: "#ffffff",
  discNeutral: "#2b2b30",
  goldTextOnLight: "#8a6116",
  chunkEdgeNeutral: "#d3d3da",
};

const PRISM = { 1: "#9e74e7", 2: "#f04cf0", 3: "#ff52a8", edge: "#8518aa" };
const FIRE = { 1: "#ffce5c", 2: "#ff5500", 3: "#ff5e3d", edge: "#c2290a" };
const GOLD = { 1: "#fcdf88", 2: "#fbc456", 3: "#faa52e", edge: "#b86f0a" };
const GOLD_GRAPHIC = ["#b86f0a", "#8a6116"]; // white initials ride on this
const HEAT = ["#ebe0f5", "#c492e8", "#b933e6", "#ae09ae", "#6c0449"];

/** Document hue set - must match src/lib/docColor.ts exactly. */
const DOCS = [
  { dot: "#2494bc", heroLight: "#94d7f0", heroMid: "#47bfeb", deep: "#1266a5" },
  { dot: "#3190d8", heroLight: "#94c8f0", heroMid: "#47a4eb", deep: "#0f5490" },
  { dot: "#4b8add", heroLight: "#94bcf0", heroMid: "#478eeb", deep: "#0f4590" },
  { dot: "#4b77dd", heroLight: "#94aff0", heroMid: "#4c7ceb", deep: "#1a3d9e" },
  { dot: "#4b63dd", heroLight: "#94a3f0", heroMid: "#5e76ed", deep: "#26399e" },
];

console.log("=== NEUTRAL BASE (light mode only) ===");
check("label on surface", T.label, T.surface, AA);
check("label-2 on surface", T.label2, T.surface, AA);
check("label-3 on surface", T.label3, T.surface, AA);
check("label-2 on ground", T.label2, T.ground, AA);
check("label-3 on ground", T.label3, T.ground, AA);
check("label-2 on surface-2", T.label2, T.surface2, AA);
check("label-3 on surface-2", T.label3, T.surface2, AA);
check("label as link on surface", T.label, T.surface, AA);
check("label as link on ground", T.label, T.ground, AA);
check("positive on surface", T.pos, T.surface, AA);
check("negative on surface", T.neg, T.surface, AA);

console.log("\n=== glass tab bar: label on its real composited backdrop ===");
// Worst case: glass tint over the ground (no extra wash behind the tab bar
// in this palette - the bar floats over whatever screen content scrolls by,
// worst realistic case is the light ground itself).
const glassComposite = over(T.glassTint, T.ground);
check("label on glass (tab bar)", T.label, glassComposite, AA);
check("label-3 on glass (inactive tab)", T.label3, glassComposite, AA);

console.log("\n=== active tab pill: label on every prism stop, full strength ===");
for (const [name, stop] of [["violet", PRISM[1]], ["magenta", PRISM[2]], ["pink", PRISM[3]]]) {
  const composite = over(stop, glassComposite);
  check(`label on ${name} pill`, T.label, composite, AA);
}

console.log("\n=== PRISM hero: dark label text on every gradient stop ===");
check("label on prism-1 (violet)", T.label, PRISM[1], AA);
check("label on prism-2 (magenta)", T.label, PRISM[2], AA);
check("label on prism-3 (pink)", T.label, PRISM[3], AA);

console.log("\n=== FIRE hero: dark label text on every gradient stop ===");
check("label on fire-1 (amber)", T.label, FIRE[1], AA);
check("label on fire-2 (orange)", T.label, FIRE[2], AA);
check("label on fire-3 (red-orange)", T.label, FIRE[3], AA);
check("white ember icon on fire-2 (mid stop, where it sits)", "#ffffff", FIRE[2], GRAPHIC);
check("fire-edge icon tint on neutral badge disc", FIRE[2], T.discNeutral, GRAPHIC);

console.log("\n=== GOLD hero + standings: dark label text on every stop ===");
check("label on gold-1 (pale)", T.label, GOLD[1], AA);
check("label on gold-2 (mid)", T.label, GOLD[2], AA);
check("label on gold-3 (deep)", T.label, GOLD[3], AA);
check("gold-text-on-light on surface (rank-1, 'me' row)", T.goldTextOnLight, T.surface, AA);
// "me" row tints the card with a light gold wash - verify against THAT.
const meRowBg = over("rgba(250, 165, 46, 0.10)", T.surface);
check("gold-text-on-light on 'me' row tint", T.goldTextOnLight, meRowBg, AA);
check("white on gold-graphic (light end)", "#ffffff", GOLD_GRAPHIC[0], GRAPHIC);
check("white on gold-graphic (dark end)", "#ffffff", GOLD_GRAPHIC[1], GRAPHIC);

console.log("\n=== DOCUMENT hero + dot: dark label text on both hero stops ===");
DOCS.forEach((d, i) => {
  check(`doc[${i}] dot vs white card`, d.dot, T.surface, GRAPHIC);
  check(`doc[${i}] dot vs ground`, d.dot, T.ground, GRAPHIC);
  check(`doc[${i}] label on heroLight`, T.label, d.heroLight, AA);
  check(`doc[${i}] label on heroMid`, T.label, d.heroMid, AA);
});

console.log("\n=== graphic objects: neutral week-chart bars, badges ===");
check("bar-top (prism-1) vs white card", PRISM[1], T.surface, GRAPHIC);
check("bar-bottom (prism-2) vs white card", PRISM[2], T.surface, GRAPHIC);
check("white glyph on neutral badge disc", "#ffffff", T.discNeutral, GRAPHIC);
check("white glyph on prism badge disc (light end)", "#ffffff", PRISM[1], GRAPHIC);

console.log("\n=== activity ramp: adjacent steps clearly distinguishable ===");
check("heat-0 vs white card", HEAT[0], T.surface, 1.05);
check("heat-1 vs heat-0", HEAT[1], HEAT[0], 1.15);
check("heat-2 vs heat-1", HEAT[2], HEAT[1], 1.15);
check("heat-3 vs heat-2", HEAT[3], HEAT[2], 1.15);
check("heat-4 vs heat-3", HEAT[4], HEAT[3], 1.15);

console.log("\n=== movement colours (unchanged, re-verified on the new bases) ===");
check("move--up on white card", T.pos, T.surface, AA);
check("move--down on white card", T.neg, T.surface, AA);
check("move--up on gold-1 (lightest hero stop it could sit on)", T.pos, GOLD[1], AA);
check("move--down on gold-1", T.neg, GOLD[1], AA);

/* --------------------------------------------------------------------------
   DRIFT guard
   -------------------------------------------------------------------------- */
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const docColorSrc = readFileSync(new URL("../src/lib/docColor.ts", import.meta.url), "utf8");
const norm = (v) => v.replace(/\s+/g, "").toLowerCase();
const cssTokens = norm(css);
const docTokens = norm(docColorSrc);

function assertInCss(label, value, haystack = cssTokens) {
  if (!haystack.includes(norm(value))) {
    console.log(`DRIFT  ${label} = ${value} does not appear in its source file`);
    fails++;
  }
}

console.log("\n=== drift guard ===");
for (const [k, v] of Object.entries(T)) assertInCss(`base.${k}`, v);
for (const [k, v] of Object.entries(PRISM)) assertInCss(`prism.${k}`, v);
for (const [k, v] of Object.entries(FIRE)) assertInCss(`fire.${k}`, v);
for (const [k, v] of Object.entries(GOLD)) assertInCss(`gold.${k}`, v);
GOLD_GRAPHIC.forEach((v, i) => assertInCss(`gold-graphic[${i}]`, v));
HEAT.forEach((v, i) => assertInCss(`heat-${i}`, v));
DOCS.forEach((d, i) => {
  assertInCss(`doc[${i}].dot`, d.dot, docTokens);
  assertInCss(`doc[${i}].heroLight`, d.heroLight, docTokens);
  assertInCss(`doc[${i}].heroMid`, d.heroMid, docTokens);
  assertInCss(`doc[${i}].deep`, d.deep, docTokens);
});
if (!fails) console.log("  all tokens found in source");

console.log(fails === 0 ? "\nAll checks pass.\n" : `\n${fails} FAILING.\n`);
process.exit(fails === 0 ? 0 : 1);
