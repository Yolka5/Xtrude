import { notFound } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { VerifiedChip } from "@/components/SessionRow";
import { Icon } from "@/components/Icon";
import { SCORING, SESSIONS } from "@/lib/fixtures";
import { clockTime, dayLabel, duration, durationSpoken, longDate, plural } from "@/lib/format";

/** Static export: every session page is prerendered from the fixtures. */
export function generateStaticParams() {
  return SESSIONS.map((s) => ({ id: s.id }));
}

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = SESSIONS.find((s) => s.id === id);
  if (!session) notFound();

  const rawPct = (session.rawMinutes / session.scoredMinutes) * 100;

  return (
    <>
      <NavBar title={dayLabel(session.date)} back={{ href: "/sessions/", label: "Sessions" }} />
      <main className="screen">
        <h1 className="screen__title rise">{dayLabel(session.date)}</h1>
        <p className="screen__subtitle t-subhead">
          {longDate(session.date)} &middot; {clockTime(session.start)} &ndash; {clockTime(session.end)}
        </p>

        {/* Headline: scored duration + verification */}
        <section className="card rise" style={{ animationDelay: "40ms" }}>
          <div className="spread" style={{ alignItems: "flex-start" }}>
            <div className="stack" style={{ gap: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span className="stat-value" style={{ fontSize: 46 }}>
                  <span aria-hidden="true">{session.scoredMinutes}</span>
                  <span className="sr-only">{durationSpoken(session.scoredMinutes)}</span>
                </span>
                <span className="stat-unit" style={{ fontSize: 19 }} aria-hidden="true">min</span>
              </div>
              <span className="stat-label">Scored time</span>
            </div>
            <VerifiedChip verified={session.verified} />
          </div>

          <div className="divider" />

          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="stack" style={{ gap: 1 }}>
              <span className="stat-value" style={{ fontSize: 22 }}>{session.eventCount}</span>
              <span className="t-caption dimmer">edits</span>
            </div>
            <div className="vdivider" />
            <div className="stack" style={{ gap: 1 }}>
              <span className="stat-value" style={{ fontSize: 22 }}>
                {(session.eventCount / Math.max(session.rawMinutes, 1)).toFixed(1)}
              </span>
              <span className="t-caption dimmer">edits / min</span>
            </div>
            <div className="vdivider" />
            <div className="stack" style={{ gap: 1 }}>
              <span className="stat-value" style={{ fontSize: 22 }}>{session.documents.length}</span>
              <span className="t-caption dimmer">{session.documents.length === 1 ? "document" : "documents"}</span>
            </div>
          </div>
        </section>

        {/* Scored vs raw - the thing that needs explaining */}
        <div className="section-head">
          <h2>How this was scored</h2>
        </div>
        <section className="card rise" style={{ animationDelay: "80ms" }}>
          <div
            className="deltabar"
            role="img"
            aria-label={`${session.rawMinutes} minutes observed plus ${session.leadInMinutes} minutes lead-in credit equals ${session.scoredMinutes} minutes scored.`}
          >
            <span className="deltabar__raw" style={{ width: `${rawPct}%` }} />
            <span className="deltabar__lead" style={{ width: `${100 - rawPct}%` }} />
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="kv">
              <span className="kv__k">
                Raw span
                <span className="t-caption dimmer" style={{ display: "block" }}>
                  First edit to last edit
                </span>
              </span>
              <span className="kv__v">{session.rawMinutes} min</span>
            </div>
            <div className="kv">
              <span className="kv__k">
                Lead-in credit
                <span className="t-caption dimmer" style={{ display: "block" }}>
                  Opening the model, before the first save
                </span>
              </span>
              <span className="kv__v" style={{ color: "var(--accent-text)" }}>
                +{session.leadInMinutes} min
              </span>
            </div>
            <div className="kv">
              <span className="kv__k" style={{ color: "var(--label)", fontWeight: 600 }}>Scored</span>
              <span className="kv__v" style={{ fontSize: 18 }}>{session.scoredMinutes} min</span>
            </div>
          </div>

          <p className="t-caption dimmer" style={{ margin: "12px 0 0" }}>
            Edits more than {SCORING.idleThresholdMinutes} minutes apart start a new session.
            Clusters under {SCORING.minEvents} edits are discarded as noise, and no
            single session is credited past {SCORING.maxSessionHours} hours.
          </p>
        </section>

        {/* Documents touched */}
        <div className="section-head">
          <h2>{session.documents.length === 1 ? "Document touched" : "Documents touched"}</h2>
        </div>
        <div className="rows rise" style={{ animationDelay: "120ms" }}>
          {session.documents.map((d) => (
            <div key={d.name + d.tab} className="rowitem">
              <span className="avatar" style={{ width: 34, height: 34 }} aria-hidden="true">
                <Icon name="doc" size={17} />
              </span>
              <span className="rowitem__grow stack" style={{ gap: 2 }}>
                <span className="rowitem__name">{d.name}</span>
                <span className="rowitem__meta">{d.tab}</span>
              </span>
              <span className="rowitem__value" style={{ fontSize: 15 }}>
                {plural(d.edits, "edit")}
              </span>
            </div>
          ))}
        </div>

        {/* Verification */}
        <div className="section-head">
          <h2>Verification</h2>
        </div>
        <section className="card card-tight rise" style={{ animationDelay: "160ms" }}>
          <div className="row" style={{ gap: 12, padding: "4px 0" }}>
            <span
              className="avatar"
              style={{
                width: 34, height: 34,
                background: session.verified ? "var(--accent-soft)" : "var(--surface-3)",
                color: session.verified ? "var(--accent-text)" : "var(--label-3)",
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

        <p className="t-caption dimmer" style={{ margin: "22px 4px 0", textAlign: "center" }}>
          Session {session.id} &middot; {duration(session.scoredMinutes)} scored
        </p>
      </main>
    </>
  );
}
