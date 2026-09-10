/**
 * Fredoka (display/numbers) + Nunito (body). Chosen over an all-Nunito and a
 * Baloo2+Outfit pairing - both compared on the Today screen, screenshots in
 * the delivery. Outfit reads too close to a system sans to register as a
 * personality change; all-Nunito is friendly but not chunky enough for the
 * numbers to feel like an event. Fredoka's numerals are the whole point:
 * rounded, heavy, built to be stared at.
 *
 * next/font/google self-hosts both at build time - the woff2 files land in
 * the static export, so there is no runtime dependency on Google's CDN and
 * the PWA renders offline with the right fonts from the first paint.
 */
import { Fredoka, Nunito } from "next/font/google";

export const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

export const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const FONT_VARS = `${fredoka.variable} ${nunito.variable}`;
