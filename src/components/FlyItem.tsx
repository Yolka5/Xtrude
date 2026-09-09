"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * One block of a screen's content, choreographed by PageTransition.
 *
 * This component sets no initial/animate/exit of its own - it only supplies
 * per-item keyframes via `variants`, and inherits *which* state it's in
 * ("hidden" / "show" / "exit") from PageTransition's outer motion.div. That
 * propagation is what turns a plain list of sections into "the outgoing
 * screen's elements fly out, the incoming ones fly in staggered" - the stagger
 * timing itself lives on the container, not here.
 *
 * MotionConfig's reducedMotion="user" only neutralizes transform (x/y/scale) -
 * by design it still lets opacity animate on its own timing, so a spring/stagger
 * transition left as-is still fades in over ~250ms under Reduce Motion. That's
 * "calm" but not "instant," and the brief said instant. Branching the
 * TRANSITION here (never the hidden/show/exit target values, which stay
 * identical either way) is safe against the hydration rule below: it changes
 * how a future animation plays, not what gets rendered on this pass.
 */
export function FlyItem({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const reduced = useReducedMotion();
  const itemVariants = {
    hidden: { opacity: 0, y: 34, scale: 0.96 },
    show: {
      opacity: 1, y: 0, scale: 1,
      transition: reduced
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 340, damping: 26, mass: 0.8 },
    },
    exit: {
      opacity: 0, y: -22, scale: 0.97,
      transition: reduced ? { duration: 0 } : { duration: 0.16, ease: "easeIn" as const },
    },
  };
  return (
    <motion.div className={className} style={style} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
