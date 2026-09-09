import { NavBar } from "@/components/NavBar";
import { Movement } from "@/components/Movement";
import { Icon } from "@/components/Icon";
import { LEAGUE } from "@/lib/fixtures";
import { duration, durationSpoken, plural } from "@/lib/format";

export default function LeagueScreen() {
  const me = LEAGUE.members.find((m) => m.isMe)!;
  const leader = LEAGUE.members[0];
  const gap = leader.scoredMinutes - me.scoredMinutes;

  return (
    <>
      <NavBar title={LEAGUE.name} />
      <main className="screen">
        <h1 className="screen__title rise">{LEAGUE.name}</h1>
        <p className="screen__subtitle t-subhead">
          {plural(LEAGUE.memberCount, "member")} &middot; ranked by scored minutes this week
        </p>

        {/* My standing */}
        <section className="card rise" style={{ animationDelay: "40ms" }}>
          <div className="spread" style={{ alignItems: "flex-start" }}>
            <div className="stack" style={{ gap: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span className="stat-value" style={{ fontSize: 46 }}>{me.rank}</span>
                <span className="stat-unit" style={{ fontSize: 19 }}>
                  of {LEAGUE.memberCount}
                </span>
              </div>
              <span className="stat-label">Your position</span>
            </div>
            <span className={`chip ${me.movement > 0 ? "chip-pos" : "chip-neutral"}`}>
              <Movement delta={me.movement} />
              {me.movement === 0 ? "Holding" : me.movement > 0 ? "Climbing" : "Slipping"}
            </span>
          </div>
          <div className="divider" />
          <div className="spread">
            <span className="t-footnote dim">
              {gap === 0
                ? "You're leading."
                : <>
                    <strong className="num" style={{ color: "var(--label)" }}>{duration(gap)}</strong>
                    {" "}behind {leader.name}
                  </>}
            </span>
            <span className="t-footnote dim">
              Day {LEAGUE.daysElapsed} of 7
            </span>
          </div>
        </section>

        <div className="section-head">
          <h2>Standings</h2>
          <span className="t-footnote dim">Change vs. last week</span>
        </div>

        <ol className="rows rise" style={{ margin: 0, padding: 0, listStyle: "none", animationDelay: "80ms" }}>
          {LEAGUE.members.map((m) => (
            <li key={m.id}>
              <div className={`rowitem${m.isMe ? " rowitem--me" : ""}`}>
                <span className="rowitem__rank" aria-hidden="true">{m.rank}</span>
                <span className={`avatar${m.isMe ? " avatar--me" : ""}`} aria-hidden="true">
                  {m.initials}
                </span>
                <span className="rowitem__grow stack" style={{ gap: 2 }}>
                  <span className="rowitem__name">
                    {m.name}
                    {m.isMe ? <span className="sr-only"> (you)</span> : null}
                  </span>
                  <span className="rowitem__meta">
                    {plural(m.sessions, "session")} this week
                  </span>
                </span>
                <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
                  <span className="rowitem__value">
                    <span aria-hidden="true">{duration(m.scoredMinutes)}</span>
                    <span className="sr-only">
                      Rank {m.rank}, {durationSpoken(m.scoredMinutes)}
                    </span>
                  </span>
                  <Movement delta={m.movement} />
                </span>
              </div>
            </li>
          ))}
        </ol>

        <section className="card card-tight rise" style={{ marginTop: 14, animationDelay: "120ms" }}>
          <div className="row" style={{ gap: 11, padding: "3px 0" }}>
            <Icon name="bolt" size={19} className="dimmer" />
            <span className="t-footnote dim">
              Ranked on scored minutes: the span from your first edit to your
              last, plus a 5-minute lead-in credit per session.
            </span>
          </div>
        </section>
      </main>
    </>
  );
}
