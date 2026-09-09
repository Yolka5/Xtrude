"use client";

import { motion } from "motion/react";
import { WEEK } from "@/lib/fixtures";
import { duration, durationSpoken } from "@/lib/format";

/**
 * This week, one bar per day. Content layer: solid card, opaque axis labels.
 *
 * The scale steps in 15-minute increments from a 45-minute floor rather than
 * auto-scaling to the week's own max. Sessions here run 5-25 minutes, so a
 * free-floating scale would make a 27-minute Monday and a 28-minute Tuesday
 * look wildly different.
 *
 * Bars use a gradient whose lightest stop still clears 3:1 against the white
 * card, so the whole mark meets the graphic-object bar, not just its base.
 */
const FLOOR = 45;
const STEP = 15;

export function WeekChart() {
  const max = Math.max(...WEEK.map((d) => d.scoredMinutes));
  const peak = Math.max(FLOOR, Math.ceil(max / STEP) * STEP);

  return (
    <div
      className="weekchart"
      role="img"
      aria-label={
        "Modeled time this week: " +
        WEEK.filter((d) => !d.isFuture)
          .map((d) => `${d.label} ${d.scoredMinutes ? durationSpoken(d.scoredMinutes) : "nothing"}`)
          .join(", ")
      }
    >
      {WEEK.map((d, i) => {
        const pct = d.scoredMinutes === 0 ? 0 : Math.max(7, (d.scoredMinutes / peak) * 100);
        return (
          <div
            key={d.date}
            className={
              "weekchart__col" +
              (d.isToday ? " weekchart__col--today" : "") +
              (d.isFuture ? " weekchart__col--future" : "")
            }
          >
            <span className="weekchart__val">
              {d.scoredMinutes ? duration(d.scoredMinutes) : d.isFuture ? "" : "-"}
            </span>
            <div className="weekchart__track">
              <motion.div
                className={"weekchart__bar" + (d.scoredMinutes === 0 ? " weekchart__bar--empty" : "")}
                style={{ height: d.scoredMinutes === 0 ? 4 : `${pct}%` }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{
                  type: "spring", stiffness: 150, damping: 19, mass: 0.9,
                  delay: 0.08 + i * 0.055,
                }}
              />
            </div>
            <span className="weekchart__day">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
