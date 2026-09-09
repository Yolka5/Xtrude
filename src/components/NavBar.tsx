"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";

/**
 * Top nav bar, functional layer.
 *
 * Implements the HIG scroll edge effect: at the top of the scroll there is
 * nothing to separate from, so the bar is fully transparent and the large
 * title reads as part of the content. Once content passes beneath it, the
 * glass and the compact title fade in.
 */
export function NavBar({ title, back }: { title: string; back?: { href: string; label: string } }) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    // Fires once the large title has begun to pass under the bar.
    const THRESHOLD = 26;
    let frame = 0;
    const read = () => {
      frame = 0;
      setStuck(window.scrollY > THRESHOLD);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <header className="navbar glass" data-stuck={stuck}>
        <span className="glass-lens" aria-hidden="true" />
        <div className="navbar__inner">
          {back ? (
            <Link href={back.href} className="navbar__back pressable">
              <Icon name="back" size={20} />
              <span>{back.label}</span>
            </Link>
          ) : (
            <span className="navbar__spacer" aria-hidden="true" />
          )}
          <span className="navbar__title" aria-hidden={!stuck}>{title}</span>
          <span className="navbar__spacer" aria-hidden="true" />
        </div>
      </header>
    </>
  );
}
