"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Icon, type IconName } from "./Icon";
import { haptics } from "@/lib/haptics";

const TABS: { href: string; label: string; icon: IconName; match: RegExp }[] = [
  { href: "/",          label: "Today",    icon: "today",    match: /^\/$/ },
  { href: "/sessions/", label: "Sessions", icon: "sessions", match: /^\/sessions/ },
  { href: "/league/",   label: "League",   icon: "league",   match: /^\/league/ },
  { href: "/profile/",  label: "Profile",  icon: "profile",  match: /^\/profile/ },
];

/**
 * The one glass surface left in the app - real SVG-displacement refraction
 * where Chrome supports referencing an SVG filter from backdrop-filter (see
 * globals.css's @supports guard + GlassDefs' #xtr-glass-distort), a plain
 * frosted blur everywhere else. Floats clear of the screen edges, sitting
 * above the iOS home indicator via env(safe-area-inset-bottom).
 *
 * The selection pill carries a shared layoutId, so switching tabs morphs one
 * pill across rather than cutting between two. Selection is still signalled
 * three ways - pill, colour, and a heavier glyph - so it survives Reduce
 * Motion and colour blindness alike.
 */
export function TabBar() {
  const raw = usePathname() || "/";
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") || "/" : raw;

  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((t) => {
        const active = t.match.test(path);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="tab"
            aria-current={active ? "page" : undefined}
            onClick={() => haptics.tap()}
          >
            {active ? (
              <motion.span
                className="tab__pill"
                layoutId="tab-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                aria-hidden="true"
              />
            ) : null}
            <span className="tab__icon">
              <Icon name={t.icon} size={23} weight={active ? 2.2 : 1.75} />
            </span>
            <span className="tab__label">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
