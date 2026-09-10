"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { LEAGUE } from "@/lib/fixtures";
import { useNavTitle } from "./NavTitle";

type Chrome = { title: string | null; back?: { href: string; label: string } };

/**
 * The nav bar lives in the layout rather than in each page, so that the page
 * transition can own a transform without capturing this fixed element into its
 * containing block. Titles are derived from the path for the four tab
 * routes (all fixed, known without fetching anything) - session detail's
 * title is the one dynamic case, and comes from `useNavTitle()` instead
 * (see NavTitle.tsx), since it now depends on a real session pulled from
 * the database rather than a fixture lookup this component could do itself.
 */
function chromeFor(path: string, navTitle: string | null): Chrome {
  if (path === "/") return { title: "Today" };
  if (path === "/sessions") return { title: "Sessions" };
  if (path === "/league") return { title: LEAGUE.name };
  if (path === "/profile") return { title: "Profile" };

  const m = path.match(/^\/sessions\/([^/]+)$/);
  if (m) {
    return {
      title: navTitle ?? "Session",
      back: { href: "/sessions/", label: "Sessions" },
    };
  }
  return { title: "Xtrude" };
}

export function AppChrome() {
  const raw = usePathname() || "/";
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") || "/" : raw;
  const navTitle = useNavTitle();
  const { title, back } = chromeFor(path, navTitle);

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
