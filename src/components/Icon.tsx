/**
 * A small, consistent icon set drawn in the SF Symbols idiom: 24px grid,
 * rounded caps and joins, optical weight tuned to sit beside 17px text.
 * Icons are decorative by default (aria-hidden) - every one is paired with a
 * text label, so nothing here is the sole carrier of meaning.
 */

export type IconName =
  | "today" | "sessions" | "league" | "profile"
  | "chevron" | "back" | "flame" | "clock" | "doc" | "bolt" | "verified"
  | "up" | "down" | "same" | "lock" | "spark" | "flame2" | "check"
  | "hourglass" | "calendar" | "run" | "trophy" | "layers" | "sunrise" | "crown" | "copy" | "pencil";

const PATHS: Record<IconName, React.ReactNode> = {
  today: <><path d="M3.6 11.2 12 4l8.4 7.2" /><path d="M5.8 9.6V19a1 1 0 0 0 1 1h10.4a1 1 0 0 0 1-1V9.6" /></>,
  sessions: <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.3V12l3.2 1.9" /></>,
  league: <><path d="M7 4h10v4.2a5 5 0 0 1-10 0V4Z" /><path d="M7 5.4H4.4v1.3a3.2 3.2 0 0 0 2.9 3.2" /><path d="M17 5.4h2.6v1.3a3.2 3.2 0 0 1-2.9 3.2" /><path d="M12 13.4V17" /><path d="M8.6 20h6.8" /><path d="M9.8 20v-1.2a2.2 2.2 0 0 1 2.2-1.8 2.2 2.2 0 0 1 2.2 1.8V20" /></>,
  profile: <><circle cx="12" cy="8.4" r="3.7" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" /></>,
  chevron: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  back: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  flame: <><path d="M12 3.2s5.4 4 5.4 9a5.4 5.4 0 1 1-10.8 0c0-2 1-3.6 1.8-4.5.3 1 1 1.9 1.8 1.9 1.3 0 1.6-2.8 1.8-6.4Z" /></>,
  flame2: <><path d="M12 3.2s5.4 4 5.4 9a5.4 5.4 0 1 1-10.8 0c0-2 1-3.6 1.8-4.5.3 1 1 1.9 1.8 1.9 1.3 0 1.6-2.8 1.8-6.4Z" /><path d="M12 13.4c1.2.9 1.7 1.8 1.7 2.8a1.7 1.7 0 1 1-3.4 0c0-1 .5-1.9 1.7-2.8Z" /></>,
  clock: <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.3V12l3.2 1.9" /></>,
  doc: <><path d="M6.2 3.8h7.3l4.3 4.3v12.1H6.2z" /><path d="M13.3 3.8v4.4h4.5" /></>,
  bolt: <path d="M13.4 3.2 6.6 13.1h4.6l-.6 7.7 6.8-9.9h-4.6z" />,
  verified: <><path d="m12 3 2.1 1.6 2.6-.3 1 2.4 2.3 1.2-.6 2.6.6 2.6-2.3 1.2-1 2.4-2.6-.3L12 18l-2.1-1.6-2.6.3-1-2.4L4 12.9l.6-2.6L4 7.7l2.3-1.2 1-2.4 2.6.3z" /><path d="m9 10.9 2.2 2.2 4-4.1" /></>,
  up: <path d="M12 18.5v-13m0 0-5 5m5-5 5 5" />,
  down: <path d="M12 5.5v13m0 0 5-5m-5 5-5-5" />,
  same: <path d="M6 12h12" />,
  lock: <><rect x="5.2" y="10.4" width="13.6" height="9.4" rx="2.6" /><path d="M8.4 10.4V7.9a3.6 3.6 0 0 1 7.2 0v2.5" /></>,
  spark: <path d="M12 3.4 13.8 9l5.6 1.8-5.6 1.8L12 18.2l-1.8-5.6-5.6-1.8L10.2 9z" />,
  check: <><circle cx="12" cy="12" r="8.4" /><path d="m8.3 12.1 2.6 2.6 4.8-5.1" /></>,
  hourglass: <><path d="M7 3.6h10M7 20.4h10" /><path d="M8 3.6v3.1c0 2 4 3.6 4 5.3s-4 3.3-4 5.3v3.1" /><path d="M16 3.6v3.1c0 2-4 3.6-4 5.3s4 3.3 4 5.3v3.1" /></>,
  calendar: <><rect x="3.8" y="5.4" width="16.4" height="14.4" rx="3" /><path d="M3.8 10h16.4M8.4 3.4v3.6M15.6 3.4v3.6" /></>,
  run: <><circle cx="14.6" cy="4.9" r="1.9" /><path d="m6.2 20.4 3-4.6 3.3-1.9-1.4-4.6-3.7 2.1-1.4 3" /><path d="m11.5 9.3 4.1 2 1.2 3.6 3 1.3" /></>,
  trophy: <><path d="M7 4h10v4.2a5 5 0 0 1-10 0V4Z" /><path d="M7 5.4H4.4v1.3a3.2 3.2 0 0 0 2.9 3.2" /><path d="M17 5.4h2.6v1.3a3.2 3.2 0 0 1-2.9 3.2" /><path d="M12 13.4V17M8.6 20h6.8" /></>,
  layers: <><path d="m12 3.4 8.4 4.4L12 12.2 3.6 7.8z" /><path d="m3.6 12.2 8.4 4.4 8.4-4.4" /><path d="m3.6 16.4 8.4 4.4 8.4-4.4" /></>,
  sunrise: <><path d="M12 3.2v3.4M4.6 10.2 6.9 12M19.4 10.2 17.1 12M2.8 17.6h18.4" /><path d="M7.4 17.6a4.6 4.6 0 0 1 9.2 0" /><path d="m8.6 6.6 3.4-3.4 3.4 3.4" /></>,
  crown: <><path d="m3.8 7.4 3.4 3.2 4.8-6 4.8 6 3.4-3.2-1.7 11H5.5z" /><path d="M5.5 20.2h13" /></>,
  copy: <><rect x="8.6" y="8.6" width="11.6" height="11.6" rx="2.6" /><path d="M15.4 8.6V6a2.6 2.6 0 0 0-2.6-2.6H6a2.6 2.6 0 0 0-2.6 2.6v6.8A2.6 2.6 0 0 0 6 15.4h2.6" /></>,
  pencil: <><path d="M4.8 19.2v-3.2L15.4 5.4a2.2 2.2 0 0 1 3.2 3.2L8 19.2z" /><path d="m13.6 7.2 3.2 3.2" /></>,
};

/**
 * Glyphs that are a single closed silhouette, so filling them reads as a solid
 * symbol rather than a blob. Filling an outline glyph like the clock or the
 * trophy floods its counters and destroys the shape, so `filled` is ignored
 * for anything not on this list.
 */
const FILLABLE = new Set<IconName>(["flame", "flame2", "spark", "bolt", "crown", "layers"]);

export function Icon({
  name,
  size = 22,
  filled = false,
  weight,
  className,
  title,
}: {
  name: IconName;
  size?: number;
  /** Solid variant. Honoured only for closed-silhouette glyphs (see FILLABLE). */
  filled?: boolean;
  /** Stroke weight. Raise it to mark a selected state without filling. */
  weight?: number;
  className?: string;
  /** Supply only when the icon is NOT accompanied by a visible text label. */
  title?: string;
}) {
  const solid = filled && FILLABLE.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={weight ?? (solid ? 1.1 : 1.75)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
