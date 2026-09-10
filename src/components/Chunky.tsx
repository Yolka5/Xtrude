"use client";

import { forwardRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { haptics } from "@/lib/haptics";

/**
 * The Duolingo button mechanic: a solid coloured edge reads as the underside
 * of a thick physical object, and pressing pushes the face down into it -
 * the shadow doesn't fade, it disappears because the object is now flush
 * with what was casting it.
 *
 * The resting box-shadow is set inline (not left to the .chunk CSS class) so
 * Motion has an explicit start value to spring back to - animating a value
 * that only exists in a stylesheet has nothing to interpolate from.
 *
 * MotionConfig's reducedMotion="user" (see MotionProvider) already strips
 * the spring itself under Reduce Motion, snapping press/release instantly;
 * this component doesn't need its own branch for that.
 */
type ChunkyProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** The bottom-edge colour - a darker shade of whatever sits on top. */
  edge?: string;
  /** How far (px) the face drops into its edge on press. */
  depth?: number;
  /** Squash slightly wider/shorter on press, cartoon-style. Off for tiny chips. */
  squash?: boolean;
  onTap?: () => void;
  /** Render as this tag - "div" (default) or "li" for list items. */
  as?: "div" | "li";
};

export const Chunky = forwardRef<HTMLElement, ChunkyProps>(function Chunky(
  { children, className, style, edge = "var(--chunk-edge-neutral)", depth = 6, squash = true, onTap, as = "div" },
  ref
) {
  const ambient = "0 1px 2px rgba(20, 20, 28, 0.05)";
  const rest = `0 ${depth}px 0 0 ${edge}, ${ambient}`;
  const pressed = `0 0px 0 0 ${edge}, ${ambient}`;

  const shared = {
    className,
    style: { ...style, boxShadow: rest },
    whileTap: {
      y: depth,
      boxShadow: pressed,
      scaleX: squash ? 1.035 : 1,
      scaleY: squash ? 0.95 : 1,
    },
    transition: { type: "spring" as const, stiffness: 700, damping: 24, mass: 0.7 },
    onTapStart: () => haptics.tap(),
    onTap,
  };

  if (as === "li") {
    return (
      <motion.li ref={ref as React.Ref<HTMLLIElement>} {...shared}>
        {children}
      </motion.li>
    );
  }
  return (
    <motion.div ref={ref as React.Ref<HTMLDivElement>} {...shared}>
      {children}
    </motion.div>
  );
});
