"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { Icon } from "./Icon";
import { CountUp } from "./CountUp";
import { TiltHero } from "./TiltHero";
import { haptics } from "@/lib/haptics";
import { burstAt } from "@/lib/confetti";

/**
 * Today's hero: fire, at full strength - a streak is a flame, the colour IS
 * the meaning, so it overrides prism here and nowhere else on this screen.
 *
 * The ember never sits still: an irregular flicker loop (not a smooth
 * breathe - real fire doesn't ease in and out symmetrically) runs constantly,
 * and tapping it punches into a bigger burst with confetti and a haptic -
 * "reacts when tapped," not just decoration. Both are the first things
 * Reduce Motion switches off; the tap still registers, it just doesn't do
 * the burst.
 */
export function StreakHero({ current, longest }: { current: number; longest: number }) {
  const reduced = useReducedMotion();
  // Fixtures never hit current >= longest (they were hand-tuned so there was
  // always a record left to chase); real data eventually will, the moment a
  // live streak becomes the longest one ever. "0 to beat it" or a negative
  // number would read as broken, so that case gets its own copy instead.
  //
  // longest === 0 is a distinct third state, not a degenerate case of
  // atRecord: it means no streak has ever existed (impossible once a single
  // session has been logged - even a lone active day counts as a 1-day
  // streak). "New record" for 0 days done reads as congratulating nothing;
  // day one gets an invitation instead.
  const neverStarted = longest === 0;
  const atRecord = !neverStarted && current >= longest;
  const toBeat = longest - current + 1;
  const emberRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const [lit, setLit] = useState(false);

  const idleFlicker = {
    scale: [1, 1.03, 0.985, 1.045, 0.99, 1.02, 1],
    rotate: [0, -1.5, 1, -2.5, 1.5, -0.5, 0],
    transition: {
      duration: 3.2, repeat: Infinity, ease: "easeInOut" as const,
      times: [0, 0.16, 0.34, 0.52, 0.7, 0.86, 1],
    },
  };

  // Sequenced by hand rather than a single declarative `animate` target: the
  // entrance spring has to finish before the idle flicker loop starts, and
  // controls.start() returning a promise is the only way to await that.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      // scale is a transform - Motion already neutralizes it under Reduce
      // Motion, confirmed empirically. opacity isn't, so left with the
      // spring's own timing it would still visibly fade in over ~200ms.
      await controls.start({
        scale: 1, opacity: 1,
        transition: reduced
          ? { duration: 0 }
          : { type: "spring" as const, stiffness: 260, damping: 16, delay: 0.06 },
      });
      if (!cancelled && !reduced) controls.start(idleFlicker);
    }
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, reduced]);

  const heroStyle = {
    "--hero-1": "var(--fire-1)",
    "--hero-2": "var(--fire-2)",
    "--hero-3": "var(--fire-3)",
  } as React.CSSProperties;

  async function poke() {
    haptics.streak();
    setLit(true);
    if (!reduced && emberRef.current) {
      const r = emberRef.current.getBoundingClientRect();
      burstAt((r.left + r.width / 2) / window.innerWidth, (r.top + r.height / 2) / window.innerHeight, [
        "#ffce5c", "#ff9147", "#ff5e3d", "#ffe08a",
      ]);
    }
    await controls.start({
      scale: [1, 1.5, 0.85, 1.12, 1],
      rotate: [0, -8, 6, -3, 0],
      transition: { duration: 0.62, times: [0, 0.32, 0.55, 0.78, 1], ease: "easeOut" as const },
    });
    setLit(false);
    if (!reduced) controls.start(idleFlicker);
  }

  return (
    <TiltHero className="hero" style={heroStyle} edge="var(--fire-edge)">
      <div className="row" style={{ gap: 18 }} aria-labelledby="streak-h">
        <div ref={emberRef} style={{ position: "relative" }}>
          <motion.span
            className="ember-halo"
            aria-hidden="true"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={
              reduced
                ? { opacity: lit ? 0.95 : 0.6, scale: lit ? 1.3 : 1 }
                : { opacity: [0.5, 0.8, 0.55, 0.85, 0.5], scale: [1, 1.1, 1.02, 1.14, 1] }
            }
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 2.2, repeat: Infinity, ease: "easeInOut" as const, times: [0, 0.3, 0.5, 0.75, 1] }
            }
          />
          <motion.span
            className="ember"
            role="button"
            tabIndex={0}
            aria-label="Streak flame. Tap to celebrate."
            onTap={poke}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); poke(); } }}
            style={{ cursor: "pointer" }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={controls}
          >
            <Icon name="flame" size={40} filled />
          </motion.span>
        </div>

        <div className="stack" style={{ gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span className="hero-value" style={{ fontSize: 68 }}>
              <CountUp value={current} />
            </span>
            <span className="hero-unit" style={{ fontSize: 22 }}>
              {current === 1 ? "day" : "days"}
            </span>
          </div>
          <span id="streak-h" className="hero-label">Current streak</span>
        </div>
      </div>

      <div className="hero-rule" />

      <div className="spread">
        <span className="t-footnote hero-sub">
          {neverStarted ? "No sessions yet" : (
            <>Longest ever <strong className="num" style={{ color: "var(--label)" }}>{longest}</strong> days</>
          )}
        </span>
        <span className="hero-chip">
          <Icon name={neverStarted ? "spark" : "bolt"} size={12} filled />
          {neverStarted ? "Start your streak" : atRecord ? "New record" : `${toBeat} to beat it`}
        </span>
      </div>
    </TiltHero>
  );
}
