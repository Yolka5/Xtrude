/**
 * A thin, feature-detected wrapper over the Vibration API.
 *
 * Android Chrome supports it; iOS Safari does not (no Vibration API at all)
 * and Android browsers without a physical vibrator motor return false. Every
 * call is wrapped so a missing API is a silent no-op, never a thrown error.
 */
type Pattern = number | number[];

function supported(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

function fire(pattern: Pattern) {
  if (!supported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw if called outside a user gesture - ignore */
  }
}

export const haptics = {
  /** A light tick - card presses, tab switches. */
  tap: () => fire(10),
  /** A firmer confirmation - a badge tap, a stamp landing. */
  confirm: () => fire([0, 18, 40, 18]),
  /** The streak incrementing - a short escalating buzz. */
  streak: () => fire([0, 12, 30, 12, 30, 24]),
  /** A full celebration - passing someone, a personal record. */
  celebrate: () => fire([0, 20, 30, 20, 30, 20, 30, 40]),
};
