"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * Tab switches: not a cross-fade. The outgoing screen's blocks fly up and
 * out in a fast cascade; the incoming screen's blocks fly in from below,
 * staggered - each one propagated down to a <FlyItem> wrapping that screen's
 * top-level sections (see each page's JSX). This component only owns the
 * container's state ("hidden"/"show"/"exit") and the stagger timing; the
 * per-item motion lives in FlyItem.
 *
 * No component here branches on useReducedMotion() to change its TREE - the
 * hook returns null during static prerender, so a structural branch would
 * render one tree on the server and another on the client (a real hydration
 * mismatch this app hit once already). It's still read here to zero out the
 * stagger/delay timing values: MotionConfig's reducedMotion="user" only
 * neutralizes transform, so left alone the container would still schedule
 * each FlyItem's (now-instant) snap after its normal staggerChildren delay -
 * calm, but not instant. Branching a timing NUMBER, never the JSX, keeps the
 * hydration guarantee intact.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  const pageVariants = {
    hidden: {},
    show: { transition: reduced ? { staggerChildren: 0, delayChildren: 0 } : { staggerChildren: 0.05, delayChildren: 0.04 } },
    exit: { transition: reduced ? { staggerChildren: 0 } : { staggerChildren: 0.025, staggerDirection: -1 } },
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
