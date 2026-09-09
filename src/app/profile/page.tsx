import { StatCard } from "@/components/Stat";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { Icon, type IconName } from "@/components/Icon";
import { BADGES, DAILY, PROFILE, RECORDS } from "@/lib/fixtures";
import { duration, plural, shortDate } from "@/lib/format";

export default function ProfileScreen() {
  const earned = BADGES.filter((b) => b.earned).length;

  return (
    <main className="screen">
      <h1 className="screen__title">Profile</h1>

      {/* Identity - intentionally minimal so it doesn't compete with the hero */}
      <div className="row" style={{ gap: 14, margin: "8px 4px 20px" }}>
        <span
          className="avatar"
          style={{
            width: 54, height: 54, fontSize: 19,
            background: "var(--disc)",
            color: "#fff", boxShadow: "0 6px 18px rgba(255,107,0,0.32)",
          }}
          aria-hidden="true"
        >
          {PROFILE.initials}
        </span>
        <div className="stack" style={{ gap: 2 }}>
          <span className="t-title3">{PROFILE.name}</span>
          <span className="t-footnote dim">{PROFILE.handle} &middot; since {PROFILE.memberSince}</span>
        </div>
      </div>

      {/* Hero: the all-time heatmap. On ink, so the ramp can run to full
          brand orange and 182 days of work reads as one object. */}
      <section className="hero" style={{ padding: "20px 18px 18px" }} aria-labelledby="activity-h">
        <div className="spread" style={{ marginBottom: 16 }}>
          <div className="stack" style={{ gap: 3 }}>
            <span id="activity-h" className="hero-label">All-time activity</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="hero-value" style={{ fontSize: 40, letterSpacing: "-1.2px" }}>
                {PROFILE.lifetimeHours}
              </span>
              <span className="hero-unit" style={{ fontSize: 16 }}>hours modeled</span>
            </div>
          </div>
          <span className="hero-chip">
            <Icon name="flame" size={12} filled />
            {PROFILE.currentStreak}-day streak
          </span>
        </div>
        <ActivityHeatmap />
      </section>

      <div className="section-head"><h2>Lifetime</h2></div>
      <div className="grid-2">
        <StatCard
          label="Hours modeled" value={PROFILE.lifetimeHours} decimals={1} animate unit="hrs"
          icon={<Icon name="clock" size={15} className="dimmer" />}
          footnote={`Across ${plural(PROFILE.activeDays, "active day")}`}
        />
        <StatCard
          label="Longest streak" value={PROFILE.longestStreak} animate unit="days"
          icon={<Icon name="flame" size={15} className="dimmer" />}
          footnote={`${PROFILE.currentStreak} days running now`}
        />
        <StatCard
          label="Total sessions" value={PROFILE.totalSessions} animate
          icon={<Icon name="sessions" size={15} className="dimmer" />}
          footnote={`Median ${PROFILE.medianSessionMinutes} min each`}
        />
        <StatCard
          label="Verified" value={PROFILE.verifiedShare} animate unit="%"
          icon={<Icon name="verified" size={15} className="dimmer" />}
          footnote="Sessions that changed geometry"
        />
      </div>

      <div className="section-head"><h2>Personal records</h2></div>
      <section className="card">
        {RECORDS.map((r) => (
          <div key={r.label} className="kv">
            <span className="kv__k">
              {r.label}
              {r.when ? (
                <span className="t-caption dimmer" style={{ display: "block" }}>{shortDate(r.when)}</span>
              ) : null}
            </span>
            <span className="kv__v">
              {r.value}
              {r.unit ? <span className="dimmer" style={{ fontSize: 13, fontWeight: 500 }}> {r.unit}</span> : null}
            </span>
          </div>
        ))}
      </section>

      <div className="section-head">
        <h2>Badges</h2>
        <span className="t-footnote dim">{earned} of {BADGES.length} earned</span>
      </div>
      <ul className="badge-grid" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {BADGES.map((b) => (
          <li key={b.id} className={`badge-tile${b.earned ? "" : " badge-tile--locked"}`}>
            <span className="badge-tile__disc" aria-hidden="true">
              <Icon name={b.earned ? (b.glyph as IconName) : "lock"} size={22} filled weight={b.earned ? 1.9 : 1.75} />
            </span>
            <span className="badge-tile__name">{b.name}</span>
            <span className="badge-tile__sub">{b.earned ? "Earned" : b.detail}</span>
            <span className="sr-only">{b.earned ? `Earned: ${b.detail}` : `Locked: ${b.detail}`}</span>
          </li>
        ))}
      </ul>

      <p className="t-caption dimmer" style={{ margin: "20px 4px 0", textAlign: "center" }}>
        {DAILY.length} days tracked &middot; {duration(PROFILE.lifetimeMinutes)} scored
      </p>
    </main>
  );
}
