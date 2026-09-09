import { Movement } from "@/components/Movement";
import { CountUp } from "@/components/CountUp";
import { Icon } from "@/components/Icon";
import { LEAGUE } from "@/lib/fixtures";
import { duration, durationSpoken, plural } from "@/lib/format";

export default function LeagueScreen() {
  const me = LEAGUE.members.find((m) => m.isMe)!;
  const leader = LEAGUE.members[0];
  const gap = leader.scoredMinutes - me.scoredMinutes;
  const others = LEAGUE.members.filter((m) => !m.isMe);

  return (
    <main className="screen">
      <h1 className="screen__title">{LEAGUE.name}</h1>
      <p className="screen__subtitle t-subhead">
        {plural(LEAGUE.memberCount, "member")} &middot; ranked by scored minutes this week
      </p>

      {/* Hero: my row, lifted out of the list so the screen reads as a race
          rather than a table. The track shows the field's spread with my
          position marked, and every other member pipped behind it. */}
      <section className="hero" aria-labelledby="me-h">
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <div className="stack" style={{ gap: 4 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="hero-value" style={{ fontSize: 64 }}>
                <CountUp value={me.rank} duration={0.75} />
              </span>
              <span className="hero-unit" style={{ fontSize: 21 }}>of {LEAGUE.memberCount}</span>
            </div>
            <span id="me-h" className="hero-label">Your position this week</span>
          </div>
          <span className="hero-chip">
            <Movement delta={me.movement} />
            {me.movement === 0 ? "Holding" : me.movement > 0 ? "Climbing" : "Slipping"}
          </span>
        </div>

        <div style={{ marginTop: 20 }}>
          <div
            className="track"
            role="img"
            aria-label={`You are on ${durationSpoken(me.scoredMinutes)}. The leader, ${leader.name}, is on ${durationSpoken(leader.scoredMinutes)}.`}
          >
            <div className="track__fill" style={{ width: `${(me.scoredMinutes / leader.scoredMinutes) * 100}%` }} />
            {others.map((m) => (
              <span
                key={m.id}
                className="track__pip"
                style={{ left: `calc(${(m.scoredMinutes / leader.scoredMinutes) * 100}% - 1px)` }}
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="spread" style={{ marginTop: 9 }}>
            <span className="t-footnote hero-sub">
              <strong className="num" style={{ color: "#fff" }}>{duration(me.scoredMinutes)}</strong> scored
            </span>
            <span className="t-footnote hero-sub">
              {gap === 0 ? "You're leading" : <>{duration(gap)} behind {leader.name.split(" ")[0]}</>}
            </span>
          </div>
        </div>

        <div className="hero-rule" />

        <div className="spread">
          <span className="t-footnote hero-sub">Day {LEAGUE.daysElapsed} of 7</span>
          <span className="t-footnote hero-sub">
            {plural(me.sessions, "session")} logged
          </span>
        </div>
      </section>

      <div className="section-head">
        <h2>Standings</h2>
        <span className="t-footnote dim">Change vs. last week</span>
      </div>

      <ol className="rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {LEAGUE.members.map((m) => (
          <li key={m.id}>
            <div className="rowitem" style={m.isMe ? { background: "var(--accent-softer)", boxShadow: "inset 3px 0 0 0 var(--accent-graphic)" } : undefined}>
              <span className="rowitem__rank" aria-hidden="true">{m.rank}</span>
              <span
                className="avatar"
                style={m.isMe ? { background: "var(--disc)", color: "#fff" } : undefined}
                aria-hidden="true"
              >
                {m.initials}
              </span>
              <span className="rowitem__grow stack" style={{ gap: 2 }}>
                <span className="rowitem__name" style={m.isMe ? { color: "var(--accent-text)", fontWeight: 700 } : undefined}>
                  {m.name}
                  {m.isMe ? <span className="sr-only"> (you)</span> : null}
                </span>
                <span className="rowitem__meta">{plural(m.sessions, "session")} this week</span>
              </span>
              <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
                <span className="rowitem__value">
                  <span aria-hidden="true">{duration(m.scoredMinutes)}</span>
                  <span className="sr-only">Rank {m.rank}, {durationSpoken(m.scoredMinutes)}</span>
                </span>
                <Movement delta={m.movement} />
              </span>
            </div>
          </li>
        ))}
      </ol>

      <section className="card card-tight" style={{ marginTop: 14 }}>
        <div className="row" style={{ gap: 11, padding: "3px 0" }}>
          <Icon name="bolt" size={19} className="dimmer" />
          <span className="t-footnote dim">
            Ranked on scored minutes: the span from your first edit to your last,
            plus a 5-minute lead-in credit per session.
          </span>
        </div>
      </section>
    </main>
  );
}
