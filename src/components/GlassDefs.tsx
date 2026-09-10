/**
 * The SVG displacement filter used for real glass refraction on the tab bar.
 *
 * Chrome (Android included) supports referencing an SVG filter from inside
 * backdrop-filter - `backdrop-filter: url(#id) saturate(...)` - which lets the
 * filter's feDisplacementMap warp the actual backdrop content, not just a
 * decorative overlay. That's the "real thing" the tab bar uses; the
 * @supports guard in globals.css drops to a plain frosted blur wherever this
 * isn't supported (iOS Safari included).
 */
export function GlassDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
    >
      <filter
        id="xtr-glass-distort"
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence type="fractalNoise" baseFrequency="0.009 0.014" numOctaves={2} seed={7} result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2.2" result="softNoise" />
        <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="20" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
