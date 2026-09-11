import { notFound } from "next/navigation";
import { DocDot, VerifiedChip } from "@/components/SessionRow";
import { CountUp } from "@/components/CountUp";
import { TiltHero } from "@/components/TiltHero";
import { FlyItem } from "@/components/FlyItem";
import { Icon } from "@/components/Icon";
import { SetNavTitle } from "@/components/NavTitle";
import { SCORING } from "@/lib/fixtures";
import { getSessionDetail } from "@/lib/db/queries";
import { clockTime, dayLabel, duration, durationSpoken, longDate, plural } from "@/lib/format";
import { docColor } from "@/lib/docColor";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionDetail(id);
  if (!session) notFound();

  const rawPct = session.scoredMinutes > 0 ? (session.rawMinutes / session.scoredMinutes) * 100 : 100;
  const q = session.qualification;
  const primary = session.documents[0];
  const heroStyle = primary
    ? (() => {
        const doc = docColor(primary.name);
        return {
          "--hero-1": doc.heroLight,
          "--hero-2": doc.heroMid,
          "--doc-deep": doc.deep,
        } as React.CSSProperties;
      })()
    : undefined;

  return (
    <main className="screen">
      <SetNavTitle title={dayLabel(session.date)} />
      <FlyItem>
        <h1 className="screen__title">{dayLabel(session.date)}</h1>
        <p className="screen__subtitle t-subhead">
          {longDate(session.date)} &middot; {clockTime(session.start)} &ndash; {clockTime(session.end)}
          {" · "}
          {duration(session.rawMinutes)} observed
        </p>
      </FlyItem>

      <FlyItem>
        <TiltHero className="hero" style={heroStyle} edge="var(--doc-deep)">
          <div className="spread" style={{ alignItems: "flex-start" }} aria-labelledby="scored-h">
            <div className="stack" style={{ gap: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="hero-value" style={{ fontSize: 68 }}>
                  <span aria-hidden="true"><CountUp value={session.scoredMinutes} /></span>
                  <span className="sr-only">{durationSpoken(session.scoredMinutes)}</span>
                </span>
                <span className="hero-unit" style={{ fontSize: 22 }} aria-hidden="true">min</span>
              </div>
              <span id="scored-h" className="hero-label">Scored time</span>
            </div>
            <VerifiedChip verified={session.verified} onHero />
          </div>

          <div className="hero-rule" />

          <div
            className="deltabar"
            role="img"
            aria-label={`${session.rawMinutes} minutes observed plus ${session.leadInMinutes} minutes lead-in credit equals ${session.scoredMinutes} minutes scored.`}
          >
            <span className="deltabar__raw" style={{ width: `${rawPct}%` }} />
            <span className="deltabar__lead" style={{ width: `${100 - rawPct}%` }} />
          </div>
          <div className="spread" style={{ marginTop: 9 }}>
            <span className="t-footnote hero-sub">
              <strong className="num" style={{ color: "var(--label)" }}>{session.rawMinutes}m</strong> observed
            </span>
            <span className="t-footnote hero-sub">
              <strong className="num">+{session.leadInMinutes}m</strong> lead-in
            </span>
          </div>
        </TiltHero>
      </FlyItem>

      <FlyItem>
        <section className="chunk" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="stack" style={{ gap: 1 }}>
              <span className="stat-value" style={{ fontSize: 24 }}>{session.eventCount}</span>
              <span className="t-caption dimmer">edits</span>
            </div>
            <div className="vdivider" />
            <div className="stack" style={{ gap: 1 }}>
              <span className="stat-value" style={{ fontSize: 24 }}>
                {(session.eventCount / Math.max(session.rawMinutes, 1)).toFixed(1)}
              </span>
              <span className="t-caption dimmer">edits / min</span>
            </div>
            <div className="vdivider" />
            <div className="stack" style={{ gap: 1 }}>
              <span className="stat-value" style={{ fontSize: 24 }}>{session.documents.length}</span>
              <span className="t-caption dimmer">{session.documents.length === 1 ? "document" : "documents"}</span>
            </div>
          </div>
        </section>
      </FlyItem>

      <FlyItem>
        <div className="section-head"><h2>How this was scored</h2></div>
        <section className="chunk">
          <div className="kv">
            <span className="kv__k">
              Started
              <span className="t-caption dimmer" style={{ display: "block" }}>First edit</span>
            </span>
            <span className="kv__v">{clockTime(session.start)}</span>
          </div>
          <div className="kv">
            <span className="kv__k">
              Ended
              <span className="t-caption dimmer" style={{ display: "block" }}>Last edit</span>
            </span>
            <span className="kv__v">{clockTime(session.end)}</span>
          </div>
          <div className="kv">
            <span className="kv__k">
              Duration
              <span className="t-caption dimmer" style={{ display: "block" }}>First edit to last edit</span>
            </span>
            <span className="kv__v">{duration(session.rawMinutes)}</span>
          </div>
          <div className="kv">
            <span className="kv__k">
              Raw event count
              <span className="t-caption dimmer" style={{ display: "block" }}>
                Need ≥{q.minEvents} to count as a session
              </span>
            </span>
            <span className="kv__v">{q.eventCount}</span>
          </div>
          <div className="kv">
            <span className="kv__k">
              Raw span
              <span className="t-caption dimmer" style={{ display: "block" }}>
                Need ≥{q.minSpanMinutes} minutes to count as a session
              </span>
            </span>
            <span className="kv__v">{q.spanMinutes} min</span>
          </div>
          <div className="kv">
            <span className="kv__k">
              Lead-in credit
              <span className="t-caption dimmer" style={{ display: "block" }}>Opening the model, before the first save</span>
            </span>
            <span className="kv__v">+{session.leadInMinutes} min</span>
          </div>
          <div className="kv">
            <span className="kv__k" style={{ color: "var(--label)", fontWeight: 700 }}>Scored</span>
            <span className="kv__v" style={{ fontSize: 18 }}>{session.scoredMinutes} min</span>
          </div>
          <p className="t-caption dimmer" style={{ margin: "12px 0 0" }}>
            Edits more than {SCORING.idleThresholdMinutes} minutes apart start a new session.
            Clusters under {q.minEvents} edits, or spanning under {q.minSpanMinutes} minutes, are discarded as noise, and no
            single session is credited past {SCORING.maxSessionHours} hours.
          </p>
        </section>
      </FlyItem>

      {session.documents.length > 0 ? (
        <FlyItem>
          <div className="section-head">
            <h2>{session.documents.length === 1 ? "Document touched" : "Documents touched"}</h2>
          </div>
          <div className="rows">
            {session.documents.map((d) => (
              <div key={d.name + d.tab} className="rowitem">
                <span className="avatar" style={{ width: 34, height: 34 }} aria-hidden="true">
                  <Icon name="doc" size={17} />
                </span>
                <span className="rowitem__grow stack" style={{ gap: 2 }}>
                  <span className="row" style={{ gap: 6 }}>
                    <DocDot name={d.name} />
                    <span className="rowitem__name">{d.name}</span>
                  </span>
                  {d.tab ? <span className="rowitem__meta">{d.tab}</span> : null}
                </span>
                {d.edits != null ? (
                  <span className="rowitem__value" style={{ fontSize: 15 }}>{plural(d.edits, "edit")}</span>
                ) : null}
              </div>
            ))}
          </div>
        </FlyItem>
      ) : null}

      <FlyItem>
        <div className="section-head"><h2>Verification</h2></div>
        <section className="chunk chunk-sm">
          <div className="row" style={{ gap: 12 }}>
            <span
              className="avatar"
              style={{
                width: 34, height: 34,
                background: session.verified ? "color-mix(in srgb, var(--pos) 14%, transparent)" : "var(--surface-3)",
                color: session.verified ? "var(--pos)" : "var(--label-3)",
              }}
              aria-hidden="true"
            >
              <Icon name={session.verified ? "verified" : "doc"} size={18} />
            </span>
            <span className="stack" style={{ gap: 2 }}>
              <span className="t-headline">
                {session.verified ? "Geometry changed" : "No geometry change"}
              </span>
              <span className="t-footnote dim">
                {session.verified
                  ? "The part's shape differs between the first and last microversion."
                  : "Edits were renames, drawings, or metadata. Time is tracked but not verified."}
              </span>
            </span>
          </div>
        </section>

        <p className="t-caption dimmer" style={{ margin: "20px 4px 0", textAlign: "center" }}>
          Session {session.id} &middot; {duration(session.scoredMinutes)} scored
        </p>
      </FlyItem>
    </main>
  );
}
