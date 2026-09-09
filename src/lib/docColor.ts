/**
 * Deterministic per-document colour.
 *
 * Every Onshape document gets its own hue, derived from its name so the same
 * document always renders the same colour without being stored anywhere. The
 * curated set below is a blue-cyan family only - it deliberately stays clear
 * of every other colour this app assigns meaning to: violet/magenta/pink is
 * the prism default, amber/red-orange is the streak's fire, warm gold is the
 * league, and green/red are verified/movement. Document colour is a quiet
 * identifier, not a fifth semantic system, so it lives in the one hue range
 * nothing else touches.
 *
 * Both shades in each entry are verified in scripts/check-contrast.mjs:
 *   dot    - the small graphic indicator on a session row. >=3:1 against a
 *            white AND a dark card, so one value serves both themes.
 *   onInk  - text-weight accent used on the session-detail hero (which is
 *            near-black in both themes). >=4.5:1 against ink there.
 *
 * The set is 5, not 6 (matching the fixture's document count would be nice,
 * but a 6th hue in this same family could not be made to clear 3:1 against
 * both a white and a dark card at once - see the exploration this was
 * generated from). Per the brief: shrink the set rather than weaken the test.
 * A hash collision just means two documents quietly share a colour, which is
 * an acceptable trade for every colour actually passing.
 */
const DOC_HUES: { dot: string; onInk: string }[] = [
  { dot: "#2494bc", onInk: "#3ab3df" },
  { dot: "#3190d8", onInk: "#3a97df" },
  { dot: "#4b8add", onInk: "#4287e0" },
  { dot: "#4b77dd", onInk: "#5882e4" },
  { dot: "#4b63dd", onInk: "#6a7fe7" },
];

/** FNV-1a, good enough distribution for a 5-bucket hash and stable forever. */
function hash(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function docColor(name: string): { dot: string; onInk: string } {
  return DOC_HUES[hash(name) % DOC_HUES.length];
}
