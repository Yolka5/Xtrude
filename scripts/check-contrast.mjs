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
  ground: "#f2f2f7", surface: "#ffffff", surface2: "#f5f5f8", surface3: "#ebebf0",
  label: "#1c1c1e", label2: "#55555c", label3: "#6b6b73",
  accent: "#007aff", accentText: "#0062cc",
  pos: "#17803d", neg: "#c0271f",
  glassTint: "rgba(255,255,255,0.80)", chromeSolid: "#fbfbfd",
  ramp0: "#e9e9ef",
  ramp1: "rgba(0,122,255,0.42)", ramp2: "rgba(0,122,255,0.62)",
  ramp3: "rgba(0,122,255,0.80)", ramp4: "rgba(0,122,255,0.97)",
};
const D = {
  ground: "#000000", surface: "#1c1c1e", surface2: "#2c2c2e", surface3: "#3a3a3c",
  label: "#ffffff", label2: "#b4b4bc", label3: "#95959e",
  accent: "#0a84ff", accentText: "#6cb8ff",
  pos: "#5bd98a", neg: "#ff7a70",
  glassTint: "rgba(28,28,32,0.76)", chromeSolid: "#1a1a1e",
  ramp0: "#2a2a2e",
  ramp1: "rgba(10,132,255,0.40)", ramp2: "rgba(10,132,255,0.60)",
  ramp3: "rgba(10,132,255,0.80)", ramp4: "rgba(10,132,255,1)",
};

/* Worst case for glass chrome: the ground wash is at its most saturated where
   the radial gradients peak, so composite the wash over the ground first, then
   the glass tint over that. */
const washL = over("rgba(0,122,255,0.10)", L.ground);
const washD = over("rgba(10,132,255,0.16)", D.ground);
const glassL = over(L.glassTint, washL);
const glassD = over(D.glassTint, washD);

const AA = 4.5, AA_LARGE = 3.0, GRAPHIC = 3.0;
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

for (const [mode, T, glass] of [["LIGHT", L, glassL], ["DARK", D, glassD]]) {
  console.log(`\n=== ${mode} ===`);
  console.log("-- text on solid content surfaces (the numbers) --");
  check("label on card",              T.label,  T.surface,  AA);
  check("label-2 on card",            T.label2, T.surface,  AA);
  check("label-3 on card",            T.label3, T.surface,  AA);
  check("label-2 on ground",          T.label2, T.ground,   AA);
  check("label-3 on ground",          T.label3, T.ground,   AA);
  check("label-2 on surface-2",       T.label2, T.surface2, AA);
  check("label-3 on surface-2",       T.label3, T.surface2, AA);
  check("accent-text on card",        T.accentText, T.surface, AA);
  check("accent-text on ground",      T.accentText, T.ground,  AA);
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

  console.log("-- graphic objects (chart marks, 3:1) --");
  check("accent fill on card",        T.accent, T.surface, GRAPHIC);
  check("accent fill on ground",      T.accent, T.ground,  GRAPHIC);
  check("ramp-0 empty cell on card",  T.ramp0,  T.surface, 1.05);
  // The lightest activity step must be clearly heavier than "no activity",
  // otherwise a day with work reads as emptier than a day without.
  const r1 = over(T.ramp1, T.surface);
  const r2 = over(T.ramp2, T.surface);
  const r3 = over(T.ramp3, T.surface);
  const r4 = over(T.ramp4, T.surface);
  check("ramp-1 vs ramp-0 (empty)",   r1, T.ramp0, 1.35);
  check("ramp-2 vs ramp-1",           r2, r1, 1.2);
  check("ramp-3 vs ramp-2",           r3, r2, 1.2);
  check("ramp-4 vs ramp-3",           r4, r3, 1.15);
}

console.log(fails === 0 ? "\nAll checks pass.\n" : `\n${fails} FAILING.\n`);
process.exit(fails === 0 ? 0 : 1);
