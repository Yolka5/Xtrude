"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * A number that springs up to its value on mount.
 *
 * The final value is what renders server-side, so the prerendered HTML, the
 * no-JS view and the accessibility tree all carry the real figure - the
 * animation is a client-side embellishment written straight to the text node,
 * never React state, so counting costs no re-renders.
 *
 * Under Reduce Motion the effect returns immediately and the value simply
 * stands, which is the "instant, not broken" behaviour.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 1.1,
  delay = 0,
  className,
}: {
  value: number;
  decimals?: number;
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

    // Only count on the first mount of this value, and only when the number
    // is actually on screen - counting something the user scrolled past is
    // motion for its own sake.
    let controls: ReturnType<typeof animate> | undefined;
    const start = () => {
      controls = animate(0, value, {
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (v) => { el.textContent = v.toFixed(decimals); },
        onComplete: () => { el.textContent = value.toFixed(decimals); },
      });
    };

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
  }, [value, decimals, duration, delay, reduced]);

  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {value.toFixed(decimals)}
    </span>
  );
}
