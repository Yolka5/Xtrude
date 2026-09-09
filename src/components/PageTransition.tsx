"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

/**
 * Cross-fades between the four screens.
 *
 * Deliberately short. This runs on every tab tap, and HIG > Motion warns
 * against making people wait through an animation they will see hundreds of
 * times. Under Reduce Motion it collapses to a plain swap, which also satisfies
 * the guidance to replace x/y transitions with fades.
 *
 * Note this component - not the pages - owns the transform. The nav and tab
 * bars are position: fixed and are rendered outside it in the layout, because
 * an ancestor transform would turn them into descendants of this element's
 * containing block and drag them along with the page.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // No branching on useReducedMotion() here: the hook returns null during
  // static prerender, so a branch would render one tree on the server and
  // another on the client. MotionProvider's reducedMotion="user" strips the
  // y-translation and leaves the fade, with the structure unchanged.
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.19, ease: [0.22, 0.9, 0.28, 1] }}
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
