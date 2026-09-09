import { NavBar } from "@/components/NavBar";
import { StatCard } from "@/components/Stat";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { Icon, type IconName } from "@/components/Icon";
import { BADGES, DAILY, PROFILE, RECORDS } from "@/lib/fixtures";
import { duration, plural, shortDate } from "@/lib/format";

export default function ProfileScreen() {
  const earned = BADGES.filter((b) => b.earned).length;

  return (
    <>
      <NavBar title="Profile" />
      <main className="screen">
        <h1 className="screen__title rise">Profile</h1>

        {/* Identity */}
        <section className="card rise" style={{ animationDelay: "40ms" }}>
          <div className="row" style={{ gap: 14 }}>
            <span className="avatar avatar--me" style={{ width: 58, height: 58, fontSize: 20 }} aria-hidden="true">
              {PROFILE.initials}
            </span>
            <div className="stack" style={{ gap: 3 }}>
              <span className="t-title3">{PROFILE.name}</span>
              <span className="t-footnote dim">{PROFILE.handle}</span>
              <span className="t-caption dimmer">Modeling since {PROFILE.memberSince}</span>
            </div>
          </div>
        </section>

        {/* Lifetime */}
        <div className="section-head"><h2>Lifetime</h2></div>
        <div className="grid-2 rise" style={{ animationDelay: "80ms" }}>
          <StatCard
            label="Hours modeled"
            value={PROFILE.lifetimeHours}
            unit="hrs"
            icon={<Icon name="clock" size={15} className="dimmer" />}
            footnote={`Across ${plural(PROFILE.activeDays, "active day")}`}
          />
          <StatCard
            label="Longest streak"
            value={PROFILE.longestStreak}
            unit="days"
            icon={<Icon name="flame" size={15} className="dimmer" />}
            footnote={`${PROFILE.currentStreak} days running now`}
          />
          <StatCard
            label="Total sessions"
            value={PROFILE.totalSessions}
            icon={<Icon name="sessions" size={15} className="dimmer" />}
            footnote={`Median ${PROFILE.medianSessionMinutes} min each`}
          />
          <StatCard
            label="Verified"
            value={PROFILE.verifiedShare}
            unit="%"
            icon={<Icon name="verified" size={15} className="dimmer" />}
            footnote="Sessions that changed geometry"
          />
        </div>

        {/* Records */}
        <div className="section-head"><h2>Personal records</h2></div>
        <section className="card rise" style={{ animationDelay: "120ms" }}>
          {RECORDS.map((r) => (
            <div key={r.label} className="kv">
              <span className="kv__k">
                {r.label}
                {r.when ? (
                  <span className="t-caption dimmer" style={{ display: "block" }}>
                    {shortDate(r.when)}
                  </span>
                ) : null}
              </span>
              <span className="kv__v">
                {r.value}
                {r.unit ? <span className="dimmer" style={{ fontSize: 13, fontWeight: 500 }}> {r.unit}</span> : null}
              </span>
            </div>
          ))}
        </section>

        {/* Badges */}
        <div className="section-head">
          <h2>Badges</h2>
          <span className="t-footnote dim">{earned} of {BADGES.length} earned</span>
        </div>
        <ul className="badge-grid rise" style={{ margin: 0, padding: 0, listStyle: "none", animationDelay: "160ms" }}>
          {BADGES.map((b) => (
            <li key={b.id} className={`badge-tile${b.earned ? "" : " badge-tile--locked"}`}>
              <span className="badge-tile__disc" aria-hidden="true">
                <Icon name={b.earned ? (b.glyph as IconName) : "lock"} size={22} filled weight={b.earned ? 1.9 : 1.75} />
              </span>
              <span className="badge-tile__name">{b.name}</span>
              <span className="badge-tile__sub">
                {b.earned ? "Earned" : b.detail}
              </span>
              <span className="sr-only">
                {b.earned ? `Earned: ${b.detail}` : `Locked: ${b.detail}`}
              </span>
            </li>
          ))}
        </ul>

        {/* All-time activity */}
        <div className="section-head">
          <h2>All-time activity</h2>
          <span className="t-footnote dim">{duration(PROFILE.lifetimeMinutes)}</span>
        </div>
        <section className="card rise" style={{ animationDelay: "200ms" }}>
          <ActivityHeatmap />
          <p className="t-caption dimmer" style={{ margin: "14px 0 0" }}>
            Last {DAILY.length} days. Each square is one day of scored time.
          </p>
        </section>
      </main>
    </>
  );
}
