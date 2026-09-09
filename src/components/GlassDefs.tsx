/**
 * SVG displacement map used for the optional lensing at glass edges.
 *
 * Applied via `filter`, never `backdrop-filter` - a browser that cannot handle
 * it simply drops a decorative rim rather than losing the whole glass material.
 * The amplitude is deliberately small; this is a hint of refraction at the rim,
 * not a fisheye.
 */
export function GlassDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
    >
      <filter id="xtr-lens" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.009 0.014" numOctaves={2} seed={7} result="noise" />
        <feGaussianBlur in="noise" stdDeviation="1.4" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="7" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
