"use client";

import { motion, useReducedMotion } from "motion/react";
import { Icon } from "./Icon";
import { CountUp } from "./CountUp";
import { STREAK } from "@/lib/fixtures";

/**
 * Today's hero. Ink block, brand orange at full strength, one big number.
 *
 * The ember carries a slow idle breath - the only looping animation in the
 * app. It exists because a streak is the one thing here that should feel
 * alive; everything else animates once and stops. It is the first thing Reduce
 * Motion switches off.
 */
export function StreakHero() {
  const reduced = useReducedMotion();
  const toBeat = STREAK.longest - STREAK.current + 1;

  // Fire overrides prism on this hero - a streak is a flame, the colour IS
  // the meaning. The ember disc/halo are hardcoded fire in globals.css since
  // they never vary; the hero-unit ("days") and hero-chip ("to beat it")
  // pick fire up through these custom properties instead.
  const heroStyle = {
    "--hero-glow-1": "rgba(255, 122, 30, 0.6)",
    "--hero-glow-2": "rgba(255, 61, 31, 0.32)",
    "--hero-accent": "var(--fire-text)",
    "--hero-chip-bg": "rgba(255, 122, 30, 0.18)",
    "--hero-chip-fg": "var(--fire-text)",
  } as React.CSSProperties;

  return (
    <section className="hero" style={heroStyle} aria-labelledby="streak-h">
      <div className="row" style={{ gap: 18 }}>
        <div style={{ position: "relative" }}>
          <motion.span
            className="ember-halo"
            aria-hidden="true"
            initial={{ opacity: 0.62, scale: 1 }}
            animate={reduced ? { opacity: 0.62, scale: 1 } : { opacity: [0.5, 0.85, 0.5], scale: [1, 1.09, 1] }}
            transition={reduced ? { duration: 0 } : { duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="ember"
            aria-hidden="true"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.06 }}
          >
            <Icon name="flame" size={40} filled />
          </motion.span>
        </div>

        <div className="stack" style={{ gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span className="hero-value" style={{ fontSize: 68 }}>
              <CountUp value={STREAK.current} duration={1.15} />
            </span>
            <span className="hero-unit" style={{ fontSize: 22 }}>
              {STREAK.current === 1 ? "day" : "days"}
            </span>
          </div>
          <span id="streak-h" className="hero-label">Current streak</span>
        </div>
      </div>

      <div className="hero-rule" />

      <div className="spread">
        <span className="t-footnote hero-sub">
          Longest ever{" "}
          <strong className="num" style={{ color: "#fff" }}>{STREAK.longest}</strong> days
        </span>
        <span className="hero-chip">
          <Icon name="bolt" size={12} filled />
          {toBeat} to beat it
        </span>
      </div>
    </section>
  );
}
