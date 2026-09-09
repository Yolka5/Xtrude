import { DAILY } from "@/lib/fixtures";
import { durationSpoken, monthLabel, shortDate } from "@/lib/format";

/**
 * All-time activity, one cell per day, columns are weeks. Profile's hero.
 *
 * Rendered on ink, which is what lets the ramp run all the way up to full
 * prism magenta - the same ramp then works in both themes, because its
 * backdrop no longer changes with the colour scheme. Profile has no semantic
 * of its own, so this is the one place prism is the intensity scale itself,
 * not just decoration - violet through magenta at the high end, near-ink at
 * the low end (see --heat-0..4 in globals.css).
 *
 * Levels are bucketed against fixed minute thresholds, not quantiles, so the
 * scale means the same thing in every week. Empty days also carry an inset
 * ring, so "no activity" is distinguishable by shape and not only by tone -
 * and every cell exposes its real value to assistive tech.
 */
const THRESHOLDS = [1, 15, 30, 45]; // minutes: level 1 at >=1, 2 at >=15, ...

function level(minutes: number): 0 | 1 | 2 | 3 | 4 {
  let l = 0;
  for (const t of THRESHOLDS) if (minutes >= t) l++;
  return l as 0 | 1 | 2 | 3 | 4;
}

export function ActivityHeatmap() {
  // Pad the front so the first column starts on a Monday.
  const first = new Date(Date.parse(`${DAILY[0].date}T00:00:00Z`));
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: ({ date: string; scoredMinutes: number } | null)[] =
    [...Array(lead).fill(null), ...DAILY];

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
            `Daily modeled time over the last ${DAILY.length} days. ` +
            `${DAILY.filter((d) => d.sessions > 0).length} active days, ` +
            `${Math.round(DAILY.reduce((a, d) => a + d.scoredMinutes, 0) / 60)} hours total.`
          }
        >
          {cells.map((c, i) =>
            c ? (
              <div
                key={c.date}
                className="heat__cell"
                data-level={level(c.scoredMinutes)}
                style={{ "--d": `${Math.floor(i / 7) * 11}ms` } as React.CSSProperties}
                title={`${shortDate(c.date)} - ${c.scoredMinutes ? durationSpoken(c.scoredMinutes) : "nothing"}`}
              />
            ) : (
              <div key={`pad-${i}`} style={{ width: 13, height: 13 }} />
            )
          )}
        </div>
      </div>

      <div className="spread" style={{ marginTop: 12 }}>
        <span className="t-caption2" style={{ color: "rgba(255,255,255,0.55)" }}>
          {shortDate(DAILY[0].date)} &ndash; {shortDate(DAILY[DAILY.length - 1].date)}
        </span>
        <div className="heat-legend">
          <span className="t-caption2" style={{ color: "rgba(255,255,255,0.55)" }}>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="heat__cell" data-level={l} aria-hidden="true" />
          ))}
          <span className="t-caption2" style={{ color: "rgba(255,255,255,0.55)" }}>More</span>
        </div>
      </div>
    </div>
  );
}
