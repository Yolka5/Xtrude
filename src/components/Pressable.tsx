"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

/**
 * Touch feedback: a small scale-down that springs back on release.
 *
 * HIG > Motion asks for feedback that is brief and precise rather than
 * decorative, so this is deliberately shallow - enough to confirm the touch
 * landed, not enough to make a frequent interaction feel slow.
 */
export function Pressable({
  children,
  className,
  scale = 0.97,
  style,
}: {
  children: ReactNode;
  className?: string;
  scale?: number;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      whileTap={{ scale }}
      transition={{ type: "spring", stiffness: 520, damping: 30, mass: 0.7 }}
    >
      {children}
    </motion.div>
  );
}
