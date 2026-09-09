"use client";

import { MotionConfig } from "motion/react";

/**
 * `reducedMotion: "user"` makes the whole motion system defer to the OS
 * setting: transform and layout animations are dropped and only opacity
 * survives, which is exactly what HIG > Accessibility asks for - "replacing
 * transitions in x-, y-, and z-axes with fades to avoid motion".
 *
 * Doing it here rather than per-component matters for correctness, not just
 * tidiness. `useReducedMotion()` cannot know the user's setting during static
 * prerender, so any component that BRANCHES on it renders one tree on the
 * server and a different one on the client - a hydration mismatch. Components
 * keep a single structure and let this config do the work.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
