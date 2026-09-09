/**
 * WCAG contrast checker for the design tokens.
 *
 * Run: node scripts/check-contrast.mjs
 *
 * Every colour pairing the app actually renders is checked here: text on its
 * real backdrop (composited, not idealised), every prism/fire/gold gradient
 * stop, and every generated document colour - both graphic (3:1) and
 * text-on-ink (4.5:1) uses, in both themes.
 *
 * A DRIFT guard also verifies every value below literally appears in
 * globals.css or docColor.ts, so a failed edit that leaves this file
 * asserting a colour the app no longer uses fails loudly instead of passing
 * while proving nothing.
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
   Tokens, duplicated from globals.css / docColor.ts for measurement. The
   DRIFT guard below (not a formality - see the bottom of this file) verifies
   every one of these literally appears in the source, so a value here that
   the app doesn't actually use fails loudly rather than passing quietly.
   -------------------------------------------------------------------------- */

const L = {
  ground: "#f2f2f5", surface: "#ffffff", surface2: "#f1f1f4", surface3: "#e6e6ea",
  label: "#17171a", label2: "#57575d", label3: "#5c5c62",
  pos: "#15703f", neg: "#a8322a",
  glassTint: "rgba(255, 255, 255, 0.74)",
  chromeSolid: "#fafafc",
  barTop: "#4b4b52", barBottom: "#2b2b30",
  discNeutral: "#2b2b30",
  goldTextOnLight: "#8a6116",
};
const D = {
  ground: "#0a0a0c", surface: "#19191c", surface2: "#232326", surface3: "#313134",
  label: "#fcfcfd", label2: "#b6b6bb", label3: "#a3a3a9",
  pos: "#4fd786", neg: "#ff8f85",
  glassTint: "rgba(22, 22, 26, 0.62)",
  chromeSolid: "#1a1a1d",
  barTop: "#d6d6da", barBottom: "#9c9ca3",
  discNeutral: "#38383e",
  goldTextOnLight: "#f0c25c",
};
const INK = { light: "#131316", dark: "#1e1e22" };

const PRISM = { 1: "#6e5af0", 2: "#b24fe0", 3: "#ff5fa8" };
const FIRE = { 1: "#ffb238", 2: "#f55200", 3: "#ff3d1f", text: "#ffc266" };
const GOLD = { 1: "#f6d374", 2: "#d9a53d", 3: "#b9832a", textOnInk: "#f6d374" };
const HEAT = ["#2b2632", "#4a3470", "#7a3fa8", "#b24fe0", "#ff5fa8"];

/** Document hue set - must match src/lib/docColor.ts exactly. */
const DOCS = [
  { dot: "#2494bc", onInk: "#3ab3df" },
  { dot: "#3190d8", onInk: "#3a97df" },
  { dot: "#4b8add", onInk: "#4287e0" },
  { dot: "#4b77dd", onInk: "#5882e4" },
  { dot: "#4b63dd", onInk: "#6a7fe7" },
];

const glowPrismL = "rgba(178, 79, 224, 0.30)";
const glowPrismD = "rgba(178, 79, 224, 0.34)";

for (const [mode, T, ink, glowPrism] of [
  ["LIGHT", L, INK.light, glowPrismL],
  ["DARK", D, INK.dark, glowPrismD],
]) {
  console.log(`\n=== ${mode} ===`);

  console.log("-- text on solid content surfaces (the numbers) --");
  check("label on card", T.label, T.surface, AA);
  check("label-2 on card", T.label2, T.surface, AA);
  check("label-3 on card", T.label3, T.surface, AA);
  check("label-2 on ground", T.label2, T.ground, AA);
  check("label-3 on ground", T.label3, T.ground, AA);
  check("label-2 on surface-2", T.label2, T.surface2, AA);
  check("label-3 on surface-2", T.label3, T.surface2, AA);
  check("label as link on card", T.label, T.surface, AA);
  check("label as link on ground", T.label, T.ground, AA);
  check("positive on card", T.pos, T.surface, AA);
  check("negative on card", T.neg, T.surface, AA);
  check("white on ink", "#ffffff", ink, AA);

  console.log("-- reduced-transparency solid fallback --");
  check("label-3 on chrome-solid", T.label3, T.chromeSolid, AA);
  check("label on chrome-solid (link/focus)", T.label, T.chromeSolid, AA);

  console.log("-- glass chrome: label on the tab bar's real backdrop --");
  // Worst case: the bottom glow (which the tab bar sits directly above)
  // composited under the glass tint. This is what a label actually reads
  // against, not an idealised flat colour.
  const glowComposite = over(glowPrism, T.ground);
  const glassComposite = over(T.glassTint, glowComposite);
  check("label on glass (tab bar over glow)", T.label, glassComposite, AA);
  check("label-3 on glass (inactive tab)", T.label3, glassComposite, AA);

  console.log("-- active tab pill: label on the prism wash, every stop --");
  for (const [name, stop] of [["violet", PRISM[1]], ["magenta", PRISM[2]], ["pink", PRISM[3]]]) {
    const [r, g, b] = hex(stop);
    const wash = `rgba(${r}, ${g}, ${b}, 0.30)`;
    const pillComposite = over(wash, glassComposite);
    check(`label on ${name} pill`, T.label, pillComposite, AA);
  }

  console.log("-- FIRE (streak hero) --");
  check("fire-text on ink", FIRE.text, ink, AA);
  check("white on ember (fire-2 mid stop)", "#ffffff", FIRE[2], GRAPHIC);
  check("fire-text on neutral badge disc", FIRE.text, T.discNeutral, GRAPHIC);

  console.log("-- GOLD (league hero + standings) --");
  check("gold-text-on-ink on ink", GOLD.textOnInk, ink, AA);
  check("gold-text-on-light on card", T.goldTextOnLight, T.surface, AA);
  // "me" row tints the card with a light gold wash - verify against THAT,
  // not the plain card, since that is what the name text actually sits on.
  const meRowBg = over("rgba(217, 165, 61, 0.10)", T.surface);
  check("gold-text-on-light on 'me' row tint", T.goldTextOnLight, meRowBg, AA);
  check("white on gold-graphic (light end, gold-3)", "#ffffff", GOLD[3], GRAPHIC);
  check("white on gold-graphic (dark end, #8a6116)", "#ffffff", "#8a6116", GRAPHIC);

  console.log("-- DOCUMENT colours --");
  DOCS.forEach((d, i) => {
    check(`doc[${i}] dot vs card`, d.dot, T.surface, GRAPHIC);
    check(`doc[${i}] dot vs ground`, d.dot, T.ground, GRAPHIC);
    check(`doc[${i}] onInk vs ink (hero accent/deltabar)`, d.onInk, ink, AA);
  });

  console.log("-- graphic objects: chart bars (3:1, both stops) --");
  check("bar-top vs card", T.barTop, T.surface, GRAPHIC);
  check("bar-bottom vs card", T.barBottom, T.surface, GRAPHIC);
  check("white on badge disc (neutral)", "#ffffff", T.discNeutral, GRAPHIC);

  console.log("-- activity ramp: prism as an intensity scale, on ink --");
  check("heat-0 (empty) vs ink", HEAT[0], ink, 1.05);
  check("heat-1 vs heat-0 (empty)", HEAT[1], HEAT[0], 1.35);
  check("heat-2 vs heat-1", HEAT[2], HEAT[1], 1.2);
  check("heat-3 vs heat-2", HEAT[3], HEAT[2], 1.2);
  check("heat-4 vs heat-3", HEAT[4], HEAT[3], 1.15);
}

console.log("\n=== movement on ink (unchanged, re-verified against new ink) ===");
for (const ink of [INK.light, INK.dark]) {
  check("move--up (#6ee7a0) on ink", "#6ee7a0", ink, AA);
  check("move--down (#ff9d94) on ink", "#ff9d94", ink, AA);
}

/* --------------------------------------------------------------------------
   DRIFT guard: every colour measured above must literally appear in the
   files that actually ship it, or this test is asserting fiction.
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
for (const [mode, T] of [["light", L], ["dark", D]]) {
  for (const [k, v] of Object.entries(T)) {
    if (typeof v === "string") assertInCss(`${mode}.${k}`, v);
  }
}
assertInCss("ink.light", INK.light);
assertInCss("ink.dark", INK.dark);
for (const [k, v] of Object.entries(PRISM)) assertInCss(`prism.${k}`, v);
for (const [k, v] of Object.entries(FIRE)) assertInCss(`fire.${k}`, v);
for (const [k, v] of Object.entries(GOLD)) assertInCss(`gold.${k}`, v);
HEAT.forEach((v, i) => assertInCss(`heat-${i}`, v));
DOCS.forEach((d, i) => {
  assertInCss(`doc[${i}].dot`, d.dot, docTokens);
  assertInCss(`doc[${i}].onInk`, d.onInk, docTokens);
});
assertInCss("glow-prism (light)", glowPrismL);
assertInCss("glow-prism (dark)", glowPrismD);
if (!fails) console.log("  all tokens found in source");

console.log(fails === 0 ? "\nAll checks pass.\n" : `\n${fails} FAILING.\n`);
process.exit(fails === 0 ? 0 : 1);
