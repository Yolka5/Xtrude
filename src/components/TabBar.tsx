"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const TABS: { href: string; label: string; icon: IconName; match: RegExp }[] = [
  { href: "/",         label: "Today",    icon: "today",    match: /^\/$/ },
  { href: "/sessions", label: "Sessions", icon: "sessions", match: /^\/sessions/ },
  { href: "/league",   label: "League",   icon: "league",   match: /^\/league/ },
  { href: "/profile",  label: "Profile",  icon: "profile",  match: /^\/profile/ },
];

/**
 * Functional layer: Liquid Glass, floating clear of the screen edges, with
 * content scrolling behind it. Sits above the iOS home indicator via
 * env(safe-area-inset-bottom) - see .tabbar in globals.css.
 */
export function TabBar() {
  const raw = usePathname() || "/";
  // trailingSlash: true in next.config means paths arrive as "/league/"
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
            className="tab pressable"
            aria-current={active ? "page" : undefined}
          >
            <Icon name={t.icon} size={23} weight={active ? 2.2 : 1.75} />
            <span className="tab__label">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
