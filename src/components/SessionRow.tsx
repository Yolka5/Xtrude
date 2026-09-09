import Link from "next/link";
import { Pressable } from "./Pressable";
import type { Session } from "@/lib/fixtures";
import { clockTime, duration, durationSpoken, plural } from "@/lib/format";
import { Icon } from "./Icon";

/**
 * Small overlay chip. Takes an ink variant, because the deep hero surface
 * needs lightened semantic colours to stay legible - the light-mode green is
 * far too dark against it.
 */
export function VerifiedChip({ verified, onInk = false }: { verified: boolean; onInk?: boolean }) {
  const ink = onInk
    ? {
        background: verified ? "rgba(80, 220, 140, 0.16)" : "rgba(255, 236, 220, 0.13)",
        color: verified ? "#6ee7a0" : "rgba(255, 236, 220, 0.82)",
      }
    : undefined;
  if (!verified) {
    return (
      <span className={onInk ? "chip" : "chip chip-neutral"} style={ink}>
        <Icon name="doc" size={13} />
        Metadata only
      </span>
    );
  }
  return (
    <span className={onInk ? "chip" : "chip chip-pos"} style={ink}>
      <Icon name="verified" size={13} />
      Verified
    </span>
  );
}

/** A row in the sessions list. Content layer: solid. */
export function SessionRow({ session }: { session: Session }) {
  const docs = session.documents.map((d) => d.name).join(", ");
  return (
    <Link href={`/sessions/${session.id}/`} className="rowitem">
      <span
        className="avatar"
        style={{ width: 34, height: 34, background: session.verified ? "var(--accent-soft)" : "var(--surface-3)", color: session.verified ? "var(--accent-text)" : "var(--label-3)" }}
        aria-hidden="true"
      >
        <Icon name={session.verified ? "verified" : "doc"} size={17} />
      </span>
      <span className="rowitem__grow stack" style={{ gap: 2 }}>
        <span className="rowitem__name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {docs}
        </span>
        <span className="rowitem__meta">
          {clockTime(session.start)} &middot; {plural(session.eventCount, "edit")}
        </span>
      </span>
      <span className="rowitem__value">
        <span aria-hidden="true">{duration(session.scoredMinutes)}</span>
        <span className="sr-only">{durationSpoken(session.scoredMinutes)} scored</span>
      </span>
      <Icon name="chevron" size={16} className="dimmer" />
    </Link>
  );
}

/** The "most recent session" card on Today. Content layer: solid. */
export function RecentSessionCard({ session }: { session: Session }) {
  return (
    <Pressable>
      <Link href={`/sessions/${session.id}/`} className="card" style={{ display: "block", color: "inherit" }}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 3, minWidth: 0 }}>
          <span className="t-headline" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session.documents[0].name}
          </span>
          <span className="t-footnote dim">
            {clockTime(session.start)} &ndash; {clockTime(session.end)}
          </span>
        </div>
        <VerifiedChip verified={session.verified} />
      </div>

      <div className="divider" />

      <div className="row" style={{ gap: 0, justifyContent: "space-between" }}>
        <div className="stack" style={{ gap: 1 }}>
          <span className="stat-value" style={{ fontSize: 24, color: "var(--accent-text)" }}>
            <span aria-hidden="true">{duration(session.scoredMinutes)}</span>
            <span className="sr-only">{durationSpoken(session.scoredMinutes)}</span>
          </span>
          <span className="t-caption dimmer">scored</span>
        </div>
        <div className="vdivider" />
        <div className="stack" style={{ gap: 1 }}>
          <span className="stat-value" style={{ fontSize: 24 }}>{session.eventCount}</span>
          <span className="t-caption dimmer">edits</span>
        </div>
        <div className="vdivider" />
        <div className="stack" style={{ gap: 1 }}>
          <span className="stat-value" style={{ fontSize: 24 }}>{session.documents.length}</span>
          <span className="t-caption dimmer">{session.documents.length === 1 ? "document" : "documents"}</span>
        </div>
        <Icon name="chevron" size={17} className="dimmer" />
        </div>
      </Link>
    </Pressable>
  );
}
