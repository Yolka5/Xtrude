"use client";

import { motion } from "motion/react";
import { WEEK } from "@/lib/fixtures";
import { duration, durationSpoken } from "@/lib/format";

/**
 * This week, one bar per day.
 *
 * The scale steps in 15-minute increments from a 45-minute floor rather than
 * auto-scaling to the week's own max. Sessions here run 5-25 minutes, so a
 * free-floating scale would make a 27-minute Monday and a 28-minute Tuesday
 * look wildly different.
 *
 * Bars don't just grow - they shoot past full height, squash flat on
 * landing, then settle with a small correction bounce. That's squash and
 * stretch (Disney's second animation principle) rather than a spring for its
 * own sake: a keyframed scaleY/scaleX pair, staggered per bar so the eye
 * reads it as one wave landing left to right.
 */
const FLOOR = 45;
const STEP = 15;

const GROW_Y = [0, 1.22, 0.86, 1.05, 1];
const GROW_X = [1, 0.94, 1.14, 0.97, 1];
const GROW_TIMES = [0, 0.42, 0.62, 0.82, 1];

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
                initial={{ scaleY: 0, scaleX: 1 }}
                animate={{ scaleY: GROW_Y, scaleX: GROW_X }}
                transition={{ duration: 0.64, times: GROW_TIMES, delay: 0.12 + i * 0.075, ease: "easeOut" }}
              />
            </div>
            <span className="weekchart__day">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
