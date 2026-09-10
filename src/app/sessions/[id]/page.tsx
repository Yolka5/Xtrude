import { notFound } from "next/navigation";
import { DocDot, VerifiedChip } from "@/components/SessionRow";
import { CountUp } from "@/components/CountUp";
import { TiltHero } from "@/components/TiltHero";
import { FlyItem } from "@/components/FlyItem";
import { Icon } from "@/components/Icon";
import { SetNavTitle } from "@/components/NavTitle";
import { SCORING } from "@/lib/fixtures";
import { getRealData, getSessionDocuments } from "@/lib/db/queries";
import { clockTime, dayLabel, duration, durationSpoken, longDate, plural } from "@/lib/format";
import { docColor } from "@/lib/docColor";

export const dynamic = "force-dynamic";

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sessions } = await getRealData();
  const found = sessions.find((s) => s.id === id);
  if (!found) notFound();

  // The list-level pass fills `documents` with names only (edits: 0
  // placeholders, see queries.ts) - detail is the one screen that shows a
  // per-document edit count, so it's worth the one extra query to get it
  // right here.
  const documents = await getSessionDocuments(id, found.documents);
  const session = { ...found, documents };

  const rawPct = (session.rawMinutes / session.scoredMinutes) * 100;

  // Document colour overrides prism on this hero - the one place besides the
  // session-row dot that a document's hue appears. Multi-document sessions
  // are coloured by the primary (first) document, matching how its name is
  // already treated as primary throughout the row/card components.
  const doc = docColor(session.documents[0].name);
  const heroStyle = {
    "--hero-1": doc.heroLight,
    "--hero-2": doc.heroMid,
    "--doc-deep": doc.deep,
  } as React.CSSProperties;

  return (
    <main className="screen">
      <SetNavTitle title={dayLabel(session.date)} />
      <FlyItem>
        <h1 className="screen__title">{dayLabel(session.date)}</h1>
        <p className="screen__subtitle t-subhead">
          {longDate(session.date)} &middot; {clockTime(session.start)} &ndash; {clockTime(session.end)}
        </p>
      </FlyItem>

      {/* Hero: the scored time, coloured by this session's document. */}
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

          {/* raw vs scored, inside the hero because it is the same number */}
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

      {/* Supporting stats */}
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
              Raw span
              <span className="t-caption dimmer" style={{ display: "block" }}>First edit to last edit</span>
            </span>
            <span className="kv__v">{session.rawMinutes} min</span>
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
            Clusters under 2 edits, or spanning under 2 minutes, are discarded as noise, and no
            single session is credited past {SCORING.maxSessionHours} hours.
          </p>
        </section>
      </FlyItem>

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
                <span className="rowitem__meta">{d.tab}</span>
              </span>
              <span className="rowitem__value" style={{ fontSize: 15 }}>{plural(d.edits, "edit")}</span>
            </div>
          ))}
        </div>
      </FlyItem>

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
