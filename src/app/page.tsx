import Link from "next/link";
import { StreakHero } from "@/components/StreakHero";
import { StatCard } from "@/components/Stat";
import { WeekChart } from "@/components/WeekChart";
import { RecentSessionCard } from "@/components/SessionRow";
import { FlyItem } from "@/components/FlyItem";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Icon } from "@/components/Icon";
import { SESSIONS, STREAK, TODAY, TODAY_STATS, WEEK } from "@/lib/fixtures";
import { duration, durationSpoken, longDate, plural, splitDuration } from "@/lib/format";

export default function TodayScreen() {
  const today = splitDuration(TODAY_STATS.scoredMinutes);
  const mostRecent = SESSIONS[0];
  const weekSoFar = STREAK.weekMinutes;
  const daysElapsed = WEEK.filter((d) => !d.isFuture).length;

  // Compare like with like: three days into this week against the first three
  // days of last week, not against last week's full total.
  const pace = STREAK.lastWeekMinutes
    ? Math.round((weekSoFar / (STREAK.lastWeekMinutes * (daysElapsed / 7))) * 100 - 100)
    : 0;

  return (
    <PullToRefresh>
      <main className="screen">
        <FlyItem>
          <h1 className="screen__title">Today</h1>
          <p className="screen__subtitle t-subhead">{longDate(TODAY)}</p>
        </FlyItem>

        <FlyItem>
          <StreakHero />
        </FlyItem>

        {/* Supporting stats - deliberately quieter than the hero */}
        <FlyItem>
          <div className="grid-2" style={{ marginTop: 12 }}>
            <StatCard
              label="Modeled today"
              value={TODAY_STATS.scoredMinutes}
              animate
              unit={today.unit === "min" ? "min" : today.unit}
              srValue={durationSpoken(TODAY_STATS.scoredMinutes)}
              icon={<Icon name="clock" size={15} className="dimmer" />}
              footnote={`${plural(TODAY_STATS.sessions, "session")} · ${plural(TODAY_STATS.events, "edit")}`}
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
            <WeekChart />
          </section>
        </FlyItem>

        <FlyItem>
          <div className="section-head">
            <h2>Most recent session</h2>
            <Link className="section-link" href="/sessions/">All sessions</Link>
          </div>
          <RecentSessionCard session={mostRecent} />
        </FlyItem>
      </main>
    </PullToRefresh>
  );
}
