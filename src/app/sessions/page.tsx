import { FlyItem } from "@/components/FlyItem";
import { SessionRow } from "@/components/SessionRow";
import { getRealData } from "@/lib/db/queries";
import type { Session } from "@/lib/fixtures";
import { dayLabel, duration, plural } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionsScreen() {
  const { sessions: allSessions, hasAnyData } = await getRealData();

  // group newest-first by day
  const byDay = new Map<string, Session[]>();
  for (const s of allSessions) {
    const list = byDay.get(s.date);
    if (list) list.push(s);
    else byDay.set(s.date, [s]);
  }

  if (!hasAnyData) {
    return (
      <main className="screen">
        <FlyItem>
          <h1 className="screen__title">Sessions</h1>
          <p className="screen__subtitle t-subhead">Last 0 days of tracked work.</p>
        </FlyItem>
        <FlyItem>
          <section className="chunk" style={{ textAlign: "center" }}>
            <p className="t-footnote dim" style={{ margin: 0 }}>
              No sessions yet. Run the backfill to pull your real Onshape history.
            </p>
          </section>
        </FlyItem>
      </main>
    );
  }

  return (
    <main className="screen">
      <FlyItem>
        <h1 className="screen__title">Sessions</h1>
        <p className="screen__subtitle t-subhead">Last {byDay.size} days of tracked work.</p>
      </FlyItem>

      {[...byDay.entries()].map(([date, sessions]) => {
        const total = sessions.reduce((a, s) => a + s.scoredMinutes, 0);
        return (
          <FlyItem key={date}>
            <div className="section-head">
              <h2>{dayLabel(date)}</h2>
              <span className="t-footnote dim">
                {duration(total)} &middot; {plural(sessions.length, "session")}
              </span>
            </div>
            <div className="rows">
              {sessions.map((s) => <SessionRow key={s.id} session={s} />)}
            </div>
          </FlyItem>
        );
      })}
    </main>
  );
}
