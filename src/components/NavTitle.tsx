"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * AppChrome (the nav bar) lives in the root layout, a sibling of the page
 * content rather than its wrapper, so it can't just read a prop off
 * whatever page is currently rendered. That was fine while every screen's
 * title was derivable from the path alone or a quick fixture lookup - it
 * broke the moment session detail's title (the session's date) started
 * depending on a real, server-fetched session no longer knowable from
 * fixtures. This tiny context lets a page push its own title up to the
 * chrome instead.
 */
const NavTitleContext = createContext<{
  title: string | null;
  setTitle: (title: string | null) => void;
} | null>(null);

export function NavTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return <NavTitleContext.Provider value={{ title, setTitle }}>{children}</NavTitleContext.Provider>;
}

export function useNavTitle(): string | null {
  return useContext(NavTitleContext)?.title ?? null;
}

/** A page renders this once with its real, dynamic title - session detail's
 * only current use, but any future dynamic route can do the same. */
export function SetNavTitle({ title }: { title: string }) {
  const ctx = useContext(NavTitleContext);
  useEffect(() => {
    ctx?.setTitle(title);
    return () => ctx?.setTitle(null);
  }, [ctx, title]);
  return null;
}
