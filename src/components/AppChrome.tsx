"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { SESSIONS, LEAGUE } from "@/lib/fixtures";
import { dayLabel } from "@/lib/format";

type Chrome = { title: string; back?: { href: string; label: string } };

/**
 * The nav bar lives in the layout rather than in each page, so that the page
 * transition can own a transform without capturing this fixed element into its
 * containing block. Titles are derived from the path.
 */
function chromeFor(path: string): Chrome {
  if (path === "/") return { title: "Today" };
  if (path === "/sessions") return { title: "Sessions" };
  if (path === "/league") return { title: LEAGUE.name };
  if (path === "/profile") return { title: "Profile" };

  const m = path.match(/^\/sessions\/([^/]+)$/);
  if (m) {
    const session = SESSIONS.find((s) => s.id === m[1]);
    return {
      title: session ? dayLabel(session.date) : "Session",
      back: { href: "/sessions/", label: "Sessions" },
    };
  }
  return { title: "Xtrude" };
}

export function AppChrome() {
  const raw = usePathname() || "/";
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") || "/" : raw;
  const { title, back } = chromeFor(path);

  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    // The bar has nothing to separate from until the large title starts
    // passing beneath it - the HIG scroll edge effect.
    const THRESHOLD = 26;
    let frame = 0;
    const read = () => { frame = 0; setStuck(window.scrollY > THRESHOLD); };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [path]);

  return (
    <header className="navbar" data-stuck={stuck}>
      <div className="navbar__inner">
        {back ? (
          <Link href={back.href} className="navbar__back">
            <Icon name="back" size={20} />
            <span>{back.label}</span>
          </Link>
        ) : (
          <span className="navbar__spacer" aria-hidden="true" />
        )}
        <span
          className="navbar__title"
          style={{
            opacity: stuck ? 1 : 0,
            transform: stuck ? "none" : "translateY(4px)",
            transition: "opacity .2s ease, transform .2s ease",
          }}
          aria-hidden={!stuck}
        >
          {title}
        </span>
        <span className="navbar__spacer" aria-hidden="true" />
      </div>
    </header>
  );
}
