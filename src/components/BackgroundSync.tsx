"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Fires a background sync when Today mounts with stale data. Does not block
 * the first paint - cached numbers render immediately, then router.refresh()
 * swaps in the updated tree if the sync actually ran.
 *
 * Module-level inFlight stops React Strict Mode / rapid tab switches from
 * stacking requests; the server also refuses a second run inside 15 minutes.
 */
let inFlight = false;

export function BackgroundSync({ needed }: { needed: boolean }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!needed || started.current || inFlight) return;
    started.current = true;
    inFlight = true;

    fetch("/api/sync", { method: "POST" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (body?.skipped) return;
        if (res.ok) router.refresh();
      })
      .catch(() => {
        // Stay on cached data - the hourly GitHub Action is the backstop.
      })
      .finally(() => {
        inFlight = false;
      });
  }, [needed, router]);

  return null;
}
