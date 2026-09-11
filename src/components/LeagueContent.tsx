"use client";

import { motion, useReducedMotion } from "motion/react";
import { Movement } from "@/components/Movement";
import { CountUp } from "@/components/CountUp";
import { TiltHero } from "@/components/TiltHero";
import { FlyItem } from "@/components/FlyItem";
import { Icon } from "@/components/Icon";
import type { League } from "@/lib/fixtures";
import { duration, durationSpoken, plural } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { useEffect, useRef } from "react";

const ROW_H = 64; // .rowitem's min-height (62px) + its 2px border

export function LeagueContent({
  league,
  lonely,
}: {
  league: League;
  /** One real member, no fixtures — say so, without an "example data" chip. */
  lonely?: boolean;
}) {
  const reduced = useReducedMotion();
  const me = league.members.find((m) => m.isMe) ?? league.members[0];
  const leader = league.members[0];
  const gap = leader && me ? leader.scoredMinutes - me.scoredMinutes : 0;
  const others = league.members.filter((m) => !m.isMe);
  const celebrated = useRef(false);

  const fillPct =
    !leader || leader.scoredMinutes <= 0
      ? 100
      : (me.scoredMinutes / leader.scoredMinutes) * 100;

  useEffect(() => {
    if (celebrated.current) return;
    if (!me || me.movement <= 0) return;
    celebrated.current = true;
    haptics.celebrate();
  }, [me]);

  const heroStyle = {
    "--hero-1": "var(--gold-1)",
    "--hero-2": "var(--gold-2)",
    "--hero-3": "var(--gold-3)",
  } as React.CSSProperties;

  if (!me || !leader) {
    return (
      <main className="screen">
        <FlyItem>
          <h1 className="screen__title">{league.name}</h1>
          <p className="screen__subtitle t-subhead">No members yet.</p>
        </FlyItem>
      </main>
    );
  }

  return (
    <main className="screen">
      <FlyItem>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <h1 className="screen__title">{league.name}</h1>
        </div>
        <p className="screen__subtitle t-subhead">
          {plural(league.memberCount, "member")} &middot; ranked by scored minutes this week
        </p>
        {lonely ? (
          <p className="t-footnote dim" style={{ marginTop: -4 }}>
            Just you, for now. Standings are your real minutes this week.
          </p>
        ) : null}
      </FlyItem>

      <FlyItem>
        <TiltHero className="hero" style={heroStyle} edge="var(--gold-edge)">
          <div className="spread" style={{ alignItems: "flex-start" }} aria-labelledby="me-h">
            <div className="stack" style={{ gap: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="hero-value" style={{ fontSize: 64 }}>
                  <CountUp value={me.rank} />
                </span>
                <span className="hero-unit" style={{ fontSize: 21 }}>of {league.memberCount}</span>
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
              <motion.div
                className="track__fill"
                initial={{ width: 0 }}
                animate={{ width: `${fillPct}%` }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 12, delay: 0.3 }}
              />
              {others.map((m) => (
                <span
                  key={m.id}
                  className="track__pip"
                  style={{ left: `calc(${(m.scoredMinutes / Math.max(leader.scoredMinutes, 1)) * 100}% - 1px)` }}
                  aria-hidden="true"
                />
              ))}
            </div>
            <div className="spread" style={{ marginTop: 9 }}>
              <span className="t-footnote hero-sub">
                <strong className="num" style={{ color: "var(--label)" }}>{duration(me.scoredMinutes)}</strong> scored
              </span>
              <span className="t-footnote hero-sub">
                {gap === 0 ? "You're leading" : <>{duration(gap)} behind {leader.name.split(" ")[0]}</>}
              </span>
            </div>
          </div>

          <div className="hero-rule" />

          <div className="spread">
            <span className="t-footnote hero-sub">Day {league.daysElapsed} of 7</span>
            <span className="t-footnote hero-sub">{plural(me.sessions, "session")} logged</span>
          </div>
        </TiltHero>
      </FlyItem>

      <FlyItem>
        <div className="section-head">
          <h2>Standings</h2>
          <span className="t-footnote dim">Change vs. last week</span>
        </div>

        <ol className="rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {league.members.map((m, i) => {
            const startOffset = (m.lastRank - m.rank) * ROW_H;
            return (
              <motion.li
                key={m.id}
                initial={{ y: startOffset, opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 22, delay: 0.15 + i * 0.05 }}
                style={{ position: "relative" }}
              >
                <motion.div
                  className="rowitem"
                  initial={m.isMe ? { backgroundColor: "rgba(250, 165, 46, 0)" } : undefined}
                  animate={
                    m.isMe
                      ? reduced
                        ? { backgroundColor: "rgba(217, 165, 61, 0.10)" }
                        : { backgroundColor: ["rgba(250, 165, 46, 0)", "rgba(250, 165, 46, 0.55)", "rgba(217, 165, 61, 0.10)"] }
                      : undefined
                  }
                  transition={m.isMe ? (reduced ? { duration: 0 } : { duration: 0.9, delay: 0.5 + i * 0.05, times: [0, 0.35, 1] }) : undefined}
                  style={m.isMe ? { boxShadow: "inset 3px 0 0 0 var(--gold-3)" } : undefined}
                >
                  <span
                    className="rowitem__rank"
                    aria-hidden="true"
                    style={m.rank === 1 ? { color: "var(--gold-text-on-light)", fontWeight: 800 } : undefined}
                  >
                    {m.rank}
                  </span>
                  <span
                    className="avatar"
                    style={m.isMe ? { background: "var(--gold-graphic)", color: "#fff" } : undefined}
                    aria-hidden="true"
                  >
                    {m.initials}
                  </span>
                  <span className="rowitem__grow stack" style={{ gap: 2 }}>
                    <span className="rowitem__name" style={m.isMe ? { color: "var(--gold-text-on-light)" } : undefined}>
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
                </motion.div>
              </motion.li>
            );
          })}
        </ol>
      </FlyItem>

      <FlyItem>
        <section className="chunk chunk-sm" style={{ marginTop: 14 }}>
          <div className="row" style={{ gap: 11 }}>
            <Icon name="bolt" size={19} className="dimmer" />
            <span className="t-footnote dim">
              Ranked on scored minutes: the span from your first edit to your last,
              plus a 5-minute lead-in credit per session.
            </span>
          </div>
        </section>
      </FlyItem>
    </main>
  );
}
