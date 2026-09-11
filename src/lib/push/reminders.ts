import "server-only";
import { getSupabase } from "@/lib/db/client";
import { sendPushToUser, type PushPayload } from "./send";
import { snapshotStreak } from "../../../scripts/lib/streakSnapshot.mjs";
import { deriveRealData } from "@/lib/db/derive";
import { getLeagueView } from "@/lib/db/leagues";
import {
  civilDay,
  leagueOvertakes,
  badgeAwardsToNotify,
  pushDedupeKey,
  pushSnapKey,
  streakAtRiskShouldFire,
  type LeagueMemberMinutes,
} from "./triggers";

type Counts = { streak: number; league: number; badge: number };

async function alreadySent(key: string): Promise<boolean> {
  const { data } = await getSupabase().from("app_state").select("key").eq("key", key).maybeSingle();
  return Boolean(data);
}

async function markSent(key: string, value: unknown, now: Date): Promise<void> {
  await getSupabase().from("app_state").upsert({
    key,
    value,
    updated_at: now.toISOString(),
  });
}

async function sendOnce(
  userId: string,
  key: string,
  payload: PushPayload,
  now: Date,
  meta: unknown
): Promise<number> {
  if (await alreadySent(key)) return 0;
  const result = await sendPushToUser(userId, payload);
  if (result.sent > 0) await markSent(key, meta, now);
  return result.sent;
}

async function dataForUser(userId: string, todayMs: number) {
  const sb = getSupabase();
  const [sessionsRes, dailyRes, docsRes] = await Promise.all([
    sb.from("sessions").select("*").eq("user_id", userId).order("started_at", { ascending: false }),
    sb.from("daily_stats").select("*").eq("user_id", userId).order("date", { ascending: true }),
    sb.from("tracked_documents").select("id, onshape_document_id, name").eq("user_id", userId),
  ]);
  const docNameById = new Map(
    (docsRes.data ?? []).map((d) => [d.onshape_document_id as string, d.name as string])
  );
  return deriveRealData(sessionsRes.data ?? [], dailyRes.data ?? [], docNameById, todayMs);
}

/**
 * Evaluate streak-at-risk, league overtake, and newly earned badges for
 * every user with a push subscription. No Onshape calls.
 */
export async function maybeSendPushReminders(now = new Date()): Promise<Counts> {
  const sb = getSupabase();
  const { data: subs, error } = await sb.from("push_subscriptions").select("user_id");
  if (error || !subs?.length) return { streak: 0, league: 0, badge: 0 };

  const userIds = [...new Set(subs.map((s) => s.user_id as string))];
  const today = civilDay(now);
  const todayMs = now instanceof Date ? now.getTime() : Date.parse(String(now));
  const counts: Counts = { streak: 0, league: 0, badge: 0 };

  for (const userId of userIds) {
    try {
      const { data: user } = await sb
        .from("users")
        .select("notify_streak, notify_league")
        .eq("id", userId)
        .maybeSingle();

      if (user?.notify_streak !== false) {
        const snap = await snapshotStreak(sb, now, userId);
        const { data: todayRow } = await sb
          .from("daily_stats")
          .select("session_count, total_scored_minutes")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle();
        const todaySessionCount = Number(todayRow?.session_count ?? 0);
        const dedupe = pushDedupeKey(userId, "streak", today);
        if (
          streakAtRiskShouldFire({
            now,
            currentStreak: Number(snap.current ?? 0),
            todaySessionCount,
            alreadySentToday: await alreadySent(dedupe),
          })
        ) {
          counts.streak += await sendOnce(
            userId,
            dedupe,
            {
              type: "streak",
              title: "Streak at risk",
              body: `Your ${snap.current}-day streak needs a session before midnight.`,
              url: "/",
            },
            now,
            { current: snap.current }
          );
        }
      }

      if (user?.notify_league !== false) {
        try {
          const root = await getLeagueView(userId);
          const leagueIds = root.id
            ? [root.id, ...root.allLeagues.map((l) => l.id).filter((id) => id !== root.id)]
            : [];
          for (const leagueId of leagueIds) {
            const view = leagueId === root.id ? root : await getLeagueView(userId, leagueId);
            if (!view.id) continue;
            const current: LeagueMemberMinutes[] = view.members.map((m) => ({
              userId: m.id,
              weekMinutes: m.scoredMinutes,
              name: m.name,
            }));
            const snapKey = pushSnapKey(userId, "league", view.id);
            const { data: snapRow } = await sb.from("app_state").select("value").eq("key", snapKey).maybeSingle();
            const previous = Array.isArray((snapRow?.value as { members?: LeagueMemberMinutes[] } | null)?.members)
              ? ((snapRow!.value as { members: LeagueMemberMinutes[] }).members)
              : null;
            if (previous) {
              const events = leagueOvertakes(userId, previous, current);
              if (events.length) {
                const passer = events[0]!;
                const dedupe = pushDedupeKey(userId, "league", today, view.id);
                counts.league += await sendOnce(
                  userId,
                  dedupe,
                  {
                    type: "league",
                    title: "League update",
                    body: `${passer.passerName} passed you in ${view.name}.`,
                    url: `/league/?league=${view.id}`,
                  },
                  now,
                  { passerId: passer.passerId }
                );
              }
            }
            await markSent(snapKey, { members: current }, now);
          }
        } catch (err) {
          console.error("league push skipped:", err instanceof Error ? err.message : err);
        }
      }

      try {
        const derived = await dataForUser(userId, todayMs);
        const earned = derived.badges.map((b) => ({ id: b.id, name: b.name, earned: b.earned }));
        const snapKey = pushSnapKey(userId, "badges");
        const { data: snapRow } = await sb.from("app_state").select("value").eq("key", snapKey).maybeSingle();
        const previousIds = Array.isArray((snapRow?.value as { ids?: string[] } | null)?.ids)
          ? ((snapRow!.value as { ids: string[] }).ids)
          : null;
        if (previousIds !== null) {
          for (const badge of badgeAwardsToNotify(previousIds, earned)) {
            const dedupe = pushDedupeKey(userId, "badge", today, badge.id);
            counts.badge += await sendOnce(
              userId,
              dedupe,
              {
                type: "badge",
                title: "Badge earned",
                body: badge.name,
                url: "/profile/",
              },
              now,
              { badgeId: badge.id }
            );
          }
        }
        await markSent(snapKey, { ids: earned.filter((b) => b.earned).map((b) => b.id) }, now);
      } catch (err) {
        console.error("badge push skipped:", err instanceof Error ? err.message : err);
      }
    } catch (err) {
      console.error("push user skipped:", err instanceof Error ? err.message : err);
    }
  }

  return counts;
}
