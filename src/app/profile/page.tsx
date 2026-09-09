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
        {/* Neutral, deliberately - the heatmap hero below is this screen's
            one coloured moment; a colourful identity avatar here would add a
            second before the reader even reaches it. */}
        <span
          className="avatar"
          style={{
            width: 54, height: 54, fontSize: 19,
            background: "var(--disc-neutral)",
            color: "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.24)",
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

      {/* Hero: the all-time heatmap. Profile has no colour of its own, so
          this is the ONE place prism appears as the default it is meant to
          be - on ink, so the ramp can run to full strength and 182 days of
          work reads as one object. No override style here: --hero-glow-1/2
          and --hero-accent fall back to prism in globals.css. */}
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
          {/* Chip stays neutral - this is Profile's prism moment, not a
              second streak moment. Only the flame glyph itself carries a
              hint of fire, same idea as the badge discs below. */}
          <span className="hero-chip">
            <span style={{ color: "var(--fire-text)" }}>
              <Icon name="flame" size={12} filled />
            </span>
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
        {BADGES.map((b) => {
          // Badge discs are neutral (see .badge-tile__disc) - a dozen
          // colourful discs would be the opposite of restraint. The one
          // exception: "the flame mark uses fire" per the colour model, so a
          // flame/flame2 glyph tints its own icon even on the neutral disc.
          const isFlame = b.earned && (b.glyph === "flame" || b.glyph === "flame2");
          return (
            <li key={b.id} className={`badge-tile${b.earned ? "" : " badge-tile--locked"}`}>
              <span className="badge-tile__disc" style={isFlame ? { color: "var(--fire-text)" } : undefined} aria-hidden="true">
                <Icon name={b.earned ? (b.glyph as IconName) : "lock"} size={22} filled weight={b.earned ? 1.9 : 1.75} />
              </span>
              <span className="badge-tile__name">{b.name}</span>
              <span className="badge-tile__sub">{b.earned ? "Earned" : b.detail}</span>
              <span className="sr-only">{b.earned ? `Earned: ${b.detail}` : `Locked: ${b.detail}`}</span>
            </li>
          );
        })}
      </ul>

      <p className="t-caption dimmer" style={{ margin: "20px 4px 0", textAlign: "center" }}>
        {DAILY.length} days tracked &middot; {duration(PROFILE.lifetimeMinutes)} scored
      </p>
    </main>
  );
}
