"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { haptics } from "@/lib/haptics";

/**
 * The hero cards tilt in 3D toward wherever you touch them, and squash flat
 * on press - a physical object being poked, not a flat rectangle.
 *
 * This tracks a pointer position directly into two motion values rather than
 * using whileTap/whileHover variants, because the tilt has to follow the
 * touch point continuously, not jump between two fixed states.
 *
 * MotionConfig's reducedMotion="user" (see MotionProvider) disables Motion's
 * own animated transitions, but a continuously-updated motion value driven by
 * pointer position isn't an "animation" Motion would otherwise strip - it's a
 * live value with no transition to skip. So this component still checks the
 * media query itself and zeroes the tilt range when it's set, per this
 * feature's own explicit "reduced motion turns it off" requirement.
 */
const TILT_DEG = 9;

export function TiltHero({
  children,
  className,
  style,
  edge,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  edge: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const pressed = useMotionValue(1);

  const reduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const rotateX = useSpring(useTransform(py, [0, 1], [TILT_DEG, -TILT_DEG]), {
    stiffness: 280, damping: 20,
  });
  const rotateY = useSpring(useTransform(px, [0, 1], [-TILT_DEG, TILT_DEG]), {
    stiffness: 280, damping: 20,
  });
  const scale = useSpring(pressed, { stiffness: 500, damping: 24 });

  function updateFromPointer(e: React.PointerEvent) {
    if (reduced() || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  }

  function reset() {
    px.set(0.5);
    py.set(0.5);
    pressed.set(1);
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        ...style,
        rotateX,
        rotateY,
        scale,
        transformPerspective: 900,
        boxShadow: `0 8px 0 0 ${edge}, 0 18px 36px rgba(20, 16, 10, 0.16)`,
      }}
      onPointerMove={updateFromPointer}
      onPointerDown={(e) => {
        if (!reduced()) pressed.set(0.965);
        updateFromPointer(e);
        haptics.tap();
      }}
      onPointerUp={reset}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      {children}
    </motion.div>
  );
}
