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
 * Three shades per entry, each verified in scripts/check-contrast.mjs:
 *   dot        - the small graphic indicator on a session row. >=3:1 against
 *                a white card, so it reads as a distinct mark, not a text.
 *   heroLight / heroMid - the two-stop gradient behind Session Detail's hero,
 *                which overrides prism there. Dark text (var(--label)) has
 *                to clear 4.5:1 against BOTH stops, since the big number and
 *                small labels can land anywhere across the gradient - this
 *                is why heroMid's lightness is tuned per hue rather than
 *                sharing one fixed value; the bluest hues need to stay
 *                lighter to keep dark text legible on them.
 *
 * The set is 5, not 6 (matching the fixture's document count would be nice,
 * but a 6th hue in this same family couldn't be made to clear 3:1 for the dot
 * against a white card - see the exploration this was generated from). Per
 * the brief: shrink the set rather than weaken the test. A hash collision
 * just means two documents quietly share a colour, an acceptable trade for
 * every colour actually passing.
 */
const DOC_HUES: { dot: string; heroLight: string; heroMid: string }[] = [
  { dot: "#2494bc", heroLight: "#94d7f0", heroMid: "#47bfeb" },
  { dot: "#3190d8", heroLight: "#94c8f0", heroMid: "#47a4eb" },
  { dot: "#4b8add", heroLight: "#94bcf0", heroMid: "#478eeb" },
  { dot: "#4b77dd", heroLight: "#94aff0", heroMid: "#4c7ceb" },
  { dot: "#4b63dd", heroLight: "#94a3f0", heroMid: "#5e76ed" },
];

/** A deeper shade of each heroMid, used only for the deltabar's fill - a
 *  graphic bar segment, not text, so it can sit outside the AA-for-text set
 *  above and just needs to read clearly against the hero's own translucent
 *  track background. */
const DOC_DEEP = ["#1266a5", "#0f5490", "#0f4590", "#1a3d9e", "#26399e"];

/** FNV-1a, good enough distribution for a 5-bucket hash and stable forever. */
function hash(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function docColor(name: string): {
  dot: string;
  heroLight: string;
  heroMid: string;
  deep: string;
} {
  const i = hash(name) % DOC_HUES.length;
  return { ...DOC_HUES[i], deep: DOC_DEEP[i] };
}
