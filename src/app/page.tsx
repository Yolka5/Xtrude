import Link from "next/link";
import { StreakHero } from "@/components/StreakHero";
import { StatCard } from "@/components/Stat";
import { WeekChart } from "@/components/WeekChart";
import { RecentSessionCard } from "@/components/SessionRow";
import { FlyItem } from "@/components/FlyItem";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Icon } from "@/components/Icon";
import { requireAppUser } from "@/lib/auth/requireAppUser";
import { getLastSyncAt, getRealData, hasOnshapeBinding } from "@/lib/db/queries";
import { duration, durationSpoken, longDate, plural, splitDuration } from "@/lib/format";
import { BackgroundSync } from "@/components/BackgroundSync";
import { PushPrompt } from "@/components/PushPrompt";
import { PAGE_SYNC_MAX_AGE_MS } from "@/lib/pageSync";
import { firstRunCopy } from "@/lib/firstRun";

export const dynamic = "force-dynamic"; // always today's real numbers, never cached stale

export default async function TodayScreen({
  searchParams,
}: {
  searchParams: Promise<{ onboarded?: string }>;
}) {
  const userId = await requireAppUser();
  const [{ today, todayStats, streak, week, sessions, hasAnyData }, lastSyncAt, params, onshapeConnected] = await Promise.all([
    getRealData(),
    getLastSyncAt(userId),
    searchParams,
    hasOnshapeBinding(),
  ]);
  const firstRun = firstRunCopy({ hasAnyData, onshapeConnected });
  const needsSync =
    !firstRun &&
    params.onboarded !== "1" &&
    (lastSyncAt === null || Date.now() - lastSyncAt > PAGE_SYNC_MAX_AGE_MS);
  const todaySplit = splitDuration(todayStats.scoredMinutes);
  const mostRecent = sessions[0];
  const weekSoFar = streak.weekMinutes;
  const daysElapsed = week.filter((d) => !d.isFuture).length;

  // Compare like with like: three days into this week against the first three
  // days of last week, not against last week's full total.
  const pace = streak.lastWeekMinutes
    ? Math.round((weekSoFar / (streak.lastWeekMinutes * (daysElapsed / 7))) * 100 - 100)
    : 0;

  return (
    <PullToRefresh>
      <BackgroundSync needed={needsSync} />
      <main className="screen">
        <FlyItem>
          <h1 className="screen__title">Today</h1>
          <p className="screen__subtitle t-subhead">{longDate(today)}</p>
        </FlyItem>

        {firstRun ? (
          <FlyItem>
            <section className="chunk" style={{ padding: "22px 18px" }}>
              <div className="stack" style={{ gap: 12 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                    lineHeight: "28px",
                    fontWeight: 800,
                    letterSpacing: "-0.3px",
                    fontFamily: "var(--font-rounded)",
                    color: "var(--label)",
                  }}
                >
                  {firstRun.headline}
                </h2>
                <p className="t-body" style={{ margin: 0 }}>{firstRun.body}</p>
                {firstRun.action ? (
                  <Link
                    href={firstRun.action.href}
                    className="text-btn text-btn--strong"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      minHeight: 48,
                      padding: "0 18px",
                      borderRadius: "var(--r-chip)",
                      background: "var(--label)",
                      color: "var(--surface)",
                      width: "fit-content",
                    }}
                  >
                    <Icon name="doc" size={18} />
                    {firstRun.action.label}
                  </Link>
                ) : null}
              </div>
            </section>
          </FlyItem>
        ) : (
          <>
            <FlyItem>
              <StreakHero
                current={streak.current}
                longest={streak.longest}
                freezeBank={streak.freezeBank}
                lastFreezeUsed={streak.lastFreezeUsed}
              />
            </FlyItem>

            <FlyItem>
              <PushPrompt ready={hasAnyData && streak.current >= 1} />
            </FlyItem>

            <FlyItem>
              <div className="grid-2" style={{ marginTop: 12 }}>
                <StatCard
                  label="Modeled today"
                  value={todayStats.scoredMinutes}
                  animate
                  unit={todaySplit.unit === "min" ? "min" : todaySplit.unit}
                  srValue={durationSpoken(todayStats.scoredMinutes)}
                  icon={<Icon name="clock" size={15} className="dimmer" />}
                  footnote={`${plural(todayStats.sessions, "session")} · ${plural(todayStats.events, "edit")}`}
                />
                <StatCard
                  label="This week"
                  value={weekSoFar}
                  animate
                  unit="min"
                  srValue={durationSpoken(weekSoFar)}
                  icon={<Icon name="bolt" size={15} className="dimmer" />}
                  footnote={
                    pace === 0
                      ? "Level with last week"
                      : `${pace > 0 ? "+" : ""}${pace}% vs. last week's pace`
                  }
                />
              </div>
            </FlyItem>

            <FlyItem>
              <div className="section-head">
                <h2>This week</h2>
                <span className="t-footnote dim">{duration(weekSoFar)} scored</span>
              </div>
              <section className="chunk">
                <WeekChart week={week} />
              </section>
            </FlyItem>

            {mostRecent ? (
              <FlyItem>
                <div className="section-head">
                  <h2>Most recent session</h2>
                  <Link className="section-link" href="/sessions/">All sessions</Link>
                </div>
                <RecentSessionCard session={mostRecent} />
              </FlyItem>
            ) : null}
          </>
        )}
      </main>
    </PullToRefresh>
  );
}
