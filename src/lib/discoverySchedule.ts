/**
 * Whether the daily 22:00 UTC cron should spend Onshape calls for a user.
 * Reading sessions / last-discovery from our DB is free. listMyDocuments is not.
 *
 * Cadence:
 *   - any session in the last 7 local days → daily
 *   - otherwise → weekly
 * Brand-new users are discovered at connect time (see maybeOnboardUser);
 * this function only decides the cron. A connect that already ran today
 * is skipped until the cadence says so again.
 */
import { calendarDateInZone } from "../../scripts/lib/timezone.mjs";

const DAY_MS = 86_400_000;
export const ACTIVE_WINDOW_DAYS = 7;

export type DiscoveryCadence = "daily" | "weekly";

export type DiscoveryDecision = {
  due: boolean;
  cadence: DiscoveryCadence;
  reason: string;
};

function toMs(instant: Date | string | number): number {
  if (instant instanceof Date) return instant.getTime();
  if (typeof instant === "number") return instant;
  return Date.parse(String(instant));
}

function civilDate(instant: Date | string | number | null | undefined): string | null {
  if (instant == null) return null;
  const ms = toMs(instant);
  if (!Number.isFinite(ms)) return null;
  return calendarDateInZone(ms);
}

function daysBetween(earlier: string, later: string): number {
  return Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / DAY_MS);
}

export function discoveryDue(opts: {
  now: Date | number | string;
  lastSessionAt: Date | string | number | null;
  lastDiscoveredAt: Date | string | number | null;
}): DiscoveryDecision {
  const today = civilDate(opts.now);
  if (!today) {
    return { due: false, cadence: "weekly", reason: "invalid now" };
  }
  const sessionDay = civilDate(opts.lastSessionAt);
  const discoveredDay = civilDate(opts.lastDiscoveredAt);
  const daysSinceSession = sessionDay == null ? Number.POSITIVE_INFINITY : daysBetween(sessionDay, today);
  const cadence: DiscoveryCadence = daysSinceSession <= ACTIVE_WINDOW_DAYS ? "daily" : "weekly";

  if (!discoveredDay) {
    return {
      due: true,
      cadence,
      reason:
        cadence === "daily"
          ? "active in last 7 days; never discovered by cron"
          : "no session in last 7 days; never discovered by cron",
    };
  }

  const daysSinceDiscovery = daysBetween(discoveredDay, today);
  if (cadence === "daily") {
    if (daysSinceDiscovery >= 1) {
      return { due: true, cadence, reason: "active in last 7 days; daily due" };
    }
    return { due: false, cadence, reason: "active in last 7 days; already discovered today" };
  }

  if (daysSinceDiscovery >= ACTIVE_WINDOW_DAYS) {
    return { due: true, cadence, reason: "no session in last 7 days; weekly due" };
  }
  return {
    due: false,
    cadence,
    reason: `no session in last 7 days; weekly, last discovery ${daysSinceDiscovery}d ago`,
  };
}

export function whoIsDue<T extends { id: string; lastSessionAt: Date | string | null; lastDiscoveredAt: Date | string | null }>(
  users: T[],
  now: Date | number | string
): { user: T; decision: DiscoveryDecision }[] {
  return users.map((user) => ({ user, decision: discoveryDue({ now, lastSessionAt: user.lastSessionAt, lastDiscoveredAt: user.lastDiscoveredAt }) }));
}
