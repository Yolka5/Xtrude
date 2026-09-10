"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * A number that slams in with an overshoot and wobbles down to rest - not a
 * clean linear count. A low-damping spring targeted straight at the value
 * does this by construction: it flies past, swings back, and settles, no
 * manual overshoot math needed.
 *
 * The final value is what renders server-side, so the prerendered HTML, the
 * no-JS view and the accessibility tree all carry the real figure - the
 * animation is a client-side embellishment written straight to the text node,
 * never React state, so counting costs no re-renders. This component's
 * return value never branches on `reduced` - only the effect's internal
 * behaviour does - so there's nothing for hydration to disagree about.
 *
 * Under Reduce Motion the effect returns immediately and the value simply
 * stands, which is the "instant, not broken" behaviour that feature asks for.
 */
export function CountUp({
  value,
  decimals = 0,
  delay = 0,
  className,
}: {
  value: number;
  decimals?: number;
  /** Kept for API compatibility with earlier callers; the spring ignores it. */
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    let controls: ReturnType<typeof animate> | undefined;
    const start = () => {
      controls = animate(0, value, {
        type: "spring",
        stiffness: 60,
        damping: 7,
        mass: 1,
        delay,
        onUpdate: (v) => {
          // The spring overshoots past `value` and can dip slightly negative
          // on the rebound for small numbers - clamp only the floor, since
          // overshooting the ceiling is the whole point.
          el.textContent = Math.max(0, v).toFixed(decimals);
        },
        onComplete: () => { el.textContent = value.toFixed(decimals); },
      });
    };

    // Only animate on first scroll into view - re-triggering on every scroll
    // past would be motion for its own sake, not an event worth noticing.
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        el.textContent = (0).toFixed(decimals);
        start();
      },
      { threshold: 0.25 }
    );
    io.observe(el);

    return () => { io.disconnect(); controls?.stop(); };
  }, [value, decimals, delay, reduced]);

  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {value.toFixed(decimals)}
    </span>
  );
}
