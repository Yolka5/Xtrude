import "server-only";
import { getSupabase } from "@/lib/db/client";
import { sendPushToUser } from "./send";
import { snapshotStreak } from "../../../scripts/lib/streakSnapshot.mjs";
import { QUALIFYING_MINUTES } from "../../../scripts/lib/streakMath.mjs";
import { calendarDateInZone } from "../../../scripts/lib/timezone.mjs";
import { getLeagueView } from "@/lib/db/leagues";

/**
 * Evening reminders from the 22:00 UTC discovery cron (midnight Israel in
 * winter, 1am in summer). No Onshape calls.
 */
export async function maybeSendPushReminders(now = new Date()): Promise<{ streak: number; league: number }> {
  const sb = getSupabase();
  const { data: subs, error } = await sb.from("push_subscriptions").select("user_id");
  if (error || !subs?.length) return { streak: 0, league: 0 };

  const userIds = [...new Set(subs.map((s) => s.user_id as string))];
  const today = calendarDateInZone(now);
  const weekKey = today.slice(0, 10);
  let streak = 0;
  let league = 0;

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
        .select("total_scored_minutes")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();
      const todayMinutes = Number(todayRow?.total_scored_minutes ?? 0);
      if (snap.current > 0 && todayMinutes < QUALIFYING_MINUTES) {
        const sent = await sendPushToUser(userId, {
          type: "streak",
          title: "Streak at risk",
          body: `Your ${snap.current}-day streak needs 10 scored minutes before the day ends.`,
          url: "/",
        });
        streak += sent.sent;
      }
    }

    if (user?.notify_league !== false) {
      try {
        const view = await getLeagueView(userId);
        const me = view.members.find((m) => m.isMe);
        if (me && me.movement < 0) {
          const dedupeKey = `push_league_${userId}_${weekKey}`;
          const { data: seen } = await sb.from("app_state").select("key").eq("key", dedupeKey).maybeSingle();
          if (!seen) {
            const sent = await sendPushToUser(userId, {
              type: "league",
              title: "League update",
              body: `Someone passed you. You're ${me.rank} of ${view.memberCount} this week.`,
              url: "/league/",
            });
            league += sent.sent;
            await sb.from("app_state").upsert({
              key: dedupeKey,
              value: { rank: me.rank },
              updated_at: now.toISOString(),
            });
          }
        }
      } catch (err) {
        console.error("league push skipped:", err instanceof Error ? err.message : err);
      }
    }
    } catch (err) {
      console.error("push user skipped:", err instanceof Error ? err.message : err);
    }
  }

  return { streak, league };
}
