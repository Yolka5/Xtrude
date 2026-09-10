import type { DayTotal } from "@/lib/fixtures";
import { durationSpoken, monthLabel, shortDate } from "@/lib/format";

/**
 * All-time activity, one cell per day, columns are weeks. Profile's hero -
 * a bold prism gradient card, since Profile has no semantic colour of its
 * own. The cells carry their own separate ramp (near-neutral -> vivid
 * magenta) so the intensity scale still reads clearly against that busy
 * background - see --heat-0..4 in globals.css.
 *
 * Levels are bucketed against fixed minute thresholds, not quantiles, so the
 * scale means the same thing in every week. Empty days also carry an inset
 * ring, so "no activity" is distinguishable by shape and not only by tone -
 * and every cell exposes its real value to assistive tech.
 *
 * On first view the cells ripple outward from today's cell like a wave,
 * rather than sweeping column by column - each cell's delay is set by its
 * Euclidean distance from the most recent day, not its index.
 *
 * `daily` (from derive.ts) is dense from first tracked day to today, so a
 * brand-new account hands this exactly one entry. Rendering that literally
 * - a single square adrift in a big card - reads as a rendering failure,
 * not "day one." MIN_DISPLAY_DAYS backfills real, dated, zero-activity
 * cells before the earliest real entry so the grid always reads as a
 * calendar waiting to be filled, however little history actually exists.
 * This is a display-only pad: it never touches `daily` itself, so nothing
 * that counts real active days (streaks, "days tracked", records) sees it.
 */
const THRESHOLDS = [1, 15, 30, 45]; // minutes: level 1 at >=1, 2 at >=15, ...
const RIPPLE_MS_PER_CELL = 20;
const MIN_DISPLAY_DAYS = 84; // 12 weeks - enough columns to read as a real calendar

function level(minutes: number): 0 | 1 | 2 | 3 | 4 {
  let l = 0;
  for (const t of THRESHOLDS) if (minutes >= t) l++;
  return l as 0 | 1 | 2 | 3 | 4;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ActivityHeatmap({ daily }: { daily: DayTotal[] }) {
  const todayDate = daily[daily.length - 1].date;

  // Pad with real, dated, zero-activity days before the earliest real entry
  // so short histories still render a full-looking grid.
  const short = MIN_DISPLAY_DAYS - daily.length;
  const padded: DayTotal[] =
    short > 0
      ? [
          ...Array.from({ length: short }, (_, i) => ({
            date: isoDate(Date.parse(`${daily[0].date}T00:00:00Z`) - (short - i) * 86_400_000),
            scoredMinutes: 0,
            sessions: 0,
          })),
          ...daily,
        ]
      : daily;

  // Pad the front so the first column starts on a Monday.
  const first = new Date(Date.parse(`${padded[0].date}T00:00:00Z`));
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: ({ date: string; scoredMinutes: number } | null)[] =
    [...Array(lead).fill(null), ...padded];

  // Month ticks: label a column when its first day starts a new month.
  const months: { col: number; label: string }[] = [];
  let seen = "";
  cells.forEach((c, i) => {
    if (!c || i % 7 !== 0) return;
    const m = monthLabel(c.date);
    if (m !== seen) { months.push({ col: i / 7, label: m }); seen = m; }
  });

  const totalCols = Math.ceil(cells.length / 7);
  const cols = { gridTemplateColumns: `repeat(${totalCols}, 13px)` };

  // The ripple's origin: the last real cell, i.e. today.
  const lastIndex = cells.length - 1;
  const originCol = Math.floor(lastIndex / 7);
  const originRow = lastIndex % 7;

  return (
    <div>
      {/* The grid can outrun a phone's width, so month ticks and cells share
          one scroll container - otherwise the axis drifts off its columns. */}
      <div className="heat-scroll">
        <div className="heat-months" style={cols} aria-hidden="true">
          {months.map((m) => (
            <span key={m.label + m.col} style={{ gridColumnStart: m.col + 1 }}>
              {m.label}
            </span>
          ))}
        </div>

        <div
          className="heat"
          style={cols}
          role="img"
          aria-label={
            `Daily modeled time over the last ${padded.length} days. ` +
            `${daily.filter((d) => d.sessions > 0).length} active days, ` +
            `${Math.round(daily.reduce((a, d) => a + d.scoredMinutes, 0) / 60)} hours total.`
          }
        >
          {cells.map((c, i) => {
            if (!c) return <div key={`pad-${i}`} style={{ width: 13, height: 13 }} />;
            const col = Math.floor(i / 7);
            const row = i % 7;
            const dist = Math.hypot(col - originCol, row - originRow);
            const isToday = c.date === todayDate;
            return (
              <div
                key={c.date}
                className="heat__cell"
                data-level={level(c.scoredMinutes)}
                data-today={isToday || undefined}
                style={{ "--d": `${Math.round(dist * RIPPLE_MS_PER_CELL)}ms` } as React.CSSProperties}
                title={
                  `${shortDate(c.date)} - ${c.scoredMinutes ? durationSpoken(c.scoredMinutes) : "nothing"}` +
                  (isToday ? " (today)" : "")
                }
              />
            );
          })}
        </div>
      </div>

      <div className="spread" style={{ marginTop: 12 }}>
        <span className="t-caption2" style={{ color: "rgba(23,23,26,0.55)" }}>
          {shortDate(padded[0].date)} &ndash; {shortDate(todayDate)}
        </span>
        <div className="heat-legend">
          <span className="t-caption2" style={{ color: "rgba(23,23,26,0.55)" }}>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="heat__cell" data-level={l} aria-hidden="true" />
          ))}
          <span className="t-caption2" style={{ color: "rgba(23,23,26,0.55)" }}>More</span>
        </div>
      </div>
    </div>
  );
}
