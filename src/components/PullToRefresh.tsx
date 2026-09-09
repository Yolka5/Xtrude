"use client";

import { useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { haptics } from "@/lib/haptics";
import { celebrate } from "@/lib/confetti";

/**
 * "Pull to refresh should do something absurd." There is nothing to
 * refresh - the data is static fixtures - so instead of faking a spinner and
 * a fetch, pulling down far enough gets a full confetti burst and an
 * honest, silly message, then springs back. The bit IS the feature.
 *
 * Implemented as a raw touch/pointer listener rather than Motion's `drag`,
 * because `drag` on a scrollable container fights the browser's own scroll
 * - this only starts tracking a pull when the page is already scrolled to
 * the very top and the first move is downward, exactly like native pull-to-
 * refresh gesture detection.
 */
const TRIGGER_PX = 88;
const MAX_PULL_PX = 130;

const MESSAGES = [
  "Nothing to refresh. You're all caught up.",
  "Still exactly 14 days. Go extrude something.",
  "The data is fixtures. It was never going anywhere.",
  "Pulling harder won't make Onshape save faster.",
];

export function PullToRefresh({ children }: { children: ReactNode }) {
  const y = useMotionValue(0);
  const rotate = useTransform(y, [0, MAX_PULL_PX], [0, 14]);
  const [state, setState] = useState<"idle" | "armed" | "fired">("idle");
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);

  let startY = 0;
  let tracking = false;

  function reduced() {
    return typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY > 2) return;
    startY = e.touches[0].clientY;
    tracking = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!tracking) return;
    // The whole feature is pure spectacle - nothing actually refreshes - so
    // under Reduce Motion it goes fully inert rather than "calmer": content
    // never drags, and touch-end below skips the celebration outright.
    if (reduced()) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { y.set(0); return; }
    const pulled = Math.min(MAX_PULL_PX, dy * 0.5); // rubber-band resistance
    y.set(pulled);
    const armed = pulled > TRIGGER_PX * 0.7;
    if (armed && state !== "armed") { setState("armed"); haptics.tap(); }
    if (!armed && state === "armed") setState("idle");
  }

  function onTouchEnd() {
    if (!tracking) return;
    tracking = false;
    if (reduced()) return;
    const pulled = y.get();
    if (pulled > TRIGGER_PX * 0.7) {
      setState("fired");
      haptics.celebrate();
      celebrate(["#9e74e7", "#f04cf0", "#ff52a8", "#ffce5c"]);
      animate(y, 0, { type: "spring", stiffness: 260, damping: 20, delay: 0.5 });
      window.setTimeout(() => setState("idle"), 1700);
    } else {
      animate(y, 0, { type: "spring", stiffness: 300, damping: 26 });
      setState("idle");
    }
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ position: "relative" }}
    >
      <motion.div
        aria-live="polite"
        style={{
          position: "absolute", top: -50, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, height: 46, opacity: useTransform(y, [0, 40], [0, 1]),
          pointerEvents: "none",
        }}
      >
        <motion.span style={{ rotate, fontSize: 20 }} aria-hidden="true">🔥</motion.span>
        <span className="t-footnote dim" style={{ fontWeight: 800 }}>
          {state === "fired" ? message : state === "armed" ? "Release for... nothing" : "Pull down for a surprise"}
        </span>
      </motion.div>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
