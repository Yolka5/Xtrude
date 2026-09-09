import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { StatCard } from "@/components/Stat";
import { WeekChart } from "@/components/WeekChart";
import { RecentSessionCard } from "@/components/SessionRow";
import { Icon } from "@/components/Icon";
import { SESSIONS, STREAK, TODAY, TODAY_STATS, WEEK } from "@/lib/fixtures";
import { duration, durationSpoken, longDate, plural, splitDuration } from "@/lib/format";

export default function TodayScreen() {
  const today = splitDuration(TODAY_STATS.scoredMinutes);
  const mostRecent = SESSIONS[0];

  const weekSoFar = STREAK.weekMinutes;
  const lastWeekSameDays = WEEK.filter((d) => !d.isFuture).length;
  // Compare like with like: three days into this week against the first three
  // days of last week, not against last week's full total.
  const pace = STREAK.lastWeekMinutes
    ? Math.round((weekSoFar / (STREAK.lastWeekMinutes * (lastWeekSameDays / 7))) * 100 - 100)
    : 0;

  return (
    <>
      <NavBar title="Today" />
      <main className="screen">
        <h1 className="screen__title rise">Today</h1>
        <p className="screen__subtitle t-subhead">{longDate(TODAY)}</p>

        {/* Streak - the daily-open hero */}
        <section className="card rise" style={{ animationDelay: "40ms" }} aria-labelledby="streak-h">
          <div className="hero-streak">
            <span className="hero-streak__disc" aria-hidden="true">
              <Icon name="flame" size={30} filled />
            </span>
            <div className="stack" style={{ gap: 2 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span className="stat-value" style={{ fontSize: 52 }}>{STREAK.current}</span>
                <span className="stat-unit" style={{ fontSize: 20 }}>days</span>
              </div>
              <span id="streak-h" className="stat-label">Current streak</span>
            </div>
          </div>
          <div className="divider" />
          <div className="spread">
            <span className="t-footnote dim">
              Longest ever <strong className="num" style={{ color: "var(--label)" }}>{STREAK.longest}</strong> days
            </span>
            <span className="chip chip-accent">
              <Icon name="bolt" size={12} filled />
              {STREAK.longest - STREAK.current + 1} to beat it
            </span>
          </div>
        </section>

        {/* Today's numbers */}
        <div className="grid-2 rise" style={{ marginTop: 12, animationDelay: "80ms" }}>
          <StatCard
            label="Modeled today"
            value={today.value}
            unit={today.unit}
            srValue={durationSpoken(TODAY_STATS.scoredMinutes)}
            icon={<Icon name="clock" size={15} className="dimmer" />}
            footnote={`${plural(TODAY_STATS.sessions, "session")} · ${plural(TODAY_STATS.events, "edit")}`}
          />
          <StatCard
            label="This week"
            value={splitDuration(weekSoFar).value}
            unit={splitDuration(weekSoFar).unit}
            srValue={durationSpoken(weekSoFar)}
            icon={<Icon name="bolt" size={15} className="dimmer" />}
            footnote={
              pace === 0
                ? "Level with last week"
                : `${pace > 0 ? "+" : ""}${pace}% vs. last week's pace`
            }
          />
        </div>

        {/* Week chart */}
        <div className="section-head">
          <h2>This week</h2>
          <span className="t-footnote dim">{duration(weekSoFar)} scored</span>
        </div>
        <section className="card rise" style={{ animationDelay: "120ms" }}>
          <WeekChart />
        </section>

        {/* Most recent session */}
        <div className="section-head">
          <h2>Most recent session</h2>
          <Link className="section-link" href="/sessions/">All sessions</Link>
        </div>
        <div className="rise" style={{ animationDelay: "160ms" }}>
          <RecentSessionCard session={mostRecent} />
        </div>
      </main>
    </>
  );
}
