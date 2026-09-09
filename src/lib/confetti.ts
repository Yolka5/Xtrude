"use client";

/**
 * Celebration bursts, built on canvas-confetti.
 *
 * Every entry point checks prefers-reduced-motion itself and no-ops when set
 * - confetti is pure spectacle, exactly what that setting asks apps to drop.
 * canvas-confetti lazily creates its own <canvas> on first call and reuses
 * it, so there is nothing to mount ahead of time.
 */
import confetti from "canvas-confetti";

function reduced(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** A burst from a point on screen - badge taps, personal records. */
export function burstAt(xRatio: number, yRatio: number, colors?: string[]) {
  if (reduced()) return;
  confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 32,
    origin: { x: xRatio, y: yRatio },
    colors,
    scalar: 0.9,
    ticks: 160,
  });
}

/** Full-screen confetti from both bottom corners - the biggest celebration. */
export function celebrate(colors?: string[]) {
  if (reduced()) return;
  const shared = { particleCount: 70, spread: 80, startVelocity: 46, colors, ticks: 200 };
  confetti({ ...shared, angle: 60, origin: { x: 0, y: 0.9 } });
  confetti({ ...shared, angle: 120, origin: { x: 1, y: 0.9 } });
}
