"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Icon, type IconName } from "./Icon";

const TABS: { href: string; label: string; icon: IconName; match: RegExp }[] = [
  { href: "/",         label: "Today",    icon: "today",    match: /^\/$/ },
  { href: "/sessions", label: "Sessions", icon: "sessions", match: /^\/sessions/ },
  { href: "/league",   label: "League",   icon: "league",   match: /^\/league/ },
  { href: "/profile",  label: "Profile",  icon: "profile",  match: /^\/profile/ },
];

/**
 * Functional layer: Liquid Glass, floating clear of the screen edges, sitting
 * above the iOS home indicator via env(safe-area-inset-bottom).
 *
 * The selection pill carries a shared layoutId, so switching tabs slides one
 * pill across rather than cutting between two. Selection is still signalled
 * three ways - pill, colour, and a heavier glyph - so it survives Reduce
 * Motion and colour blindness alike.
 */
export function TabBar() {
  const raw = usePathname() || "/";
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") || "/" : raw;

  return (
    <nav className="tabbar glass" aria-label="Primary">
      <span className="glass-lens" aria-hidden="true" />
      {TABS.map((t) => {
        const active = t.match.test(path);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="tab"
            aria-current={active ? "page" : undefined}
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
