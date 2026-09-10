import Link from "next/link";
import { StreakHero } from "@/components/StreakHero";
import { StatCard } from "@/components/Stat";
import { WeekChart } from "@/components/WeekChart";
import { RecentSessionCard } from "@/components/SessionRow";
import { FlyItem } from "@/components/FlyItem";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Icon } from "@/components/Icon";
import { getRealData } from "@/lib/db/queries";
import { duration, durationSpoken, longDate, plural, splitDuration } from "@/lib/format";

export const dynamic = "force-dynamic"; // always today's real numbers, never cached stale

export default async function TodayScreen() {
  const { today, todayStats, streak, week, sessions, hasAnyData } = await getRealData();
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
      <main className="screen">
        <FlyItem>
          <h1 className="screen__title">Today</h1>
          <p className="screen__subtitle t-subhead">{longDate(today)}</p>
        </FlyItem>

        <FlyItem>
          <StreakHero current={streak.current} longest={streak.longest} />
        </FlyItem>

        {/* Supporting stats - deliberately quieter than the hero */}
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

        {hasAnyData && mostRecent ? (
          <FlyItem>
            <div className="section-head">
              <h2>Most recent session</h2>
              <Link className="section-link" href="/sessions/">All sessions</Link>
            </div>
            <RecentSessionCard session={mostRecent} />
          </FlyItem>
        ) : (
          <FlyItem>
            <div className="section-head">
              <h2>Most recent session</h2>
            </div>
            <section className="chunk" style={{ textAlign: "center" }}>
              <p className="t-footnote dim" style={{ margin: 0 }}>
                No sessions yet. Run the backfill to pull your real Onshape history.
              </p>
            </section>
          </FlyItem>
        )}
      </main>
    </PullToRefresh>
  );
}
