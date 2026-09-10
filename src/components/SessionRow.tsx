"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Chunky } from "./Chunky";
import type { Session } from "@/lib/fixtures";
import { clockTime, duration, durationSpoken, plural } from "@/lib/format";
import { Icon } from "./Icon";
import { docColor } from "@/lib/docColor";

/**
 * The document-colour dot: the "small colour indicator on session rows" the
 * colour model calls for. Deliberately just a dot, not a recoloured avatar -
 * the avatar circle keeps signalling verified/unverified (via the existing
 * green tint, unchanged), so this is a second, independent signal rather than
 * overloading one circle with two meanings.
 */
export function DocDot({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        flex: "none",
        background: docColor(name).dot,
      }}
    />
  );
}

/**
 * Small overlay chip. `onHero` swaps to a translucent-white treatment, since
 * every hero is now a bold light gradient rather than a dark ink surface -
 * the plain green/neutral chip styles are tuned for a white card and read as
 * too flat sitting directly on a gradient.
 *
 * A verified chip stamps in rather than just fading - "a session verifying:
 * a satisfying stamp animation." There's no live verification EVENT in a
 * static-fixture app, so this plays on first scroll into view instead, which
 * is the same honest substitution CountUp and the heatmap ripple make.
 */
export function VerifiedChip({ verified, onHero = false }: { verified: boolean; onHero?: boolean }) {
  // Rotate/scale are transforms - MotionConfig already neutralizes those
  // under Reduce Motion. Opacity isn't, so left with the spring transition
  // it would still visibly fade in; reading useReducedMotion() here only
  // changes that transition's duration, never the JSX.
  const reduced = useReducedMotion();
  const cls = onHero ? "chip chip-onhero" : verified ? "chip chip-pos" : "chip chip-neutral";
  const content = verified ? (
    <>
      <Icon name="verified" size={13} />
      Verified
    </>
  ) : (
    <>
      <Icon name="doc" size={13} />
      Metadata only
    </>
  );

  if (!verified) return <span className={cls}>{content}</span>;

  return (
    <motion.span
      className={cls}
      initial={{ scale: 2.2, rotate: -14, opacity: 0 }}
      whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 14, mass: 0.7 }}
    >
      {content}
    </motion.span>
  );
}

/** A row in the sessions list. Content layer: solid. */
export function SessionRow({ session }: { session: Session }) {
  const docs = session.documents.map((d) => d.name).join(", ");
  return (
    <Link href={`/sessions/${session.id}/`} className="rowitem">
      <span
        className="avatar"
        style={{
          width: 36,
          height: 36,
          background: session.verified ? "color-mix(in srgb, var(--pos) 14%, transparent)" : "var(--surface-3)",
          color: session.verified ? "var(--pos)" : "var(--label-3)",
        }}
        aria-hidden="true"
      >
        <Icon name={session.verified ? "verified" : "doc"} size={17} />
      </span>
      <span className="rowitem__grow stack" style={{ gap: 2 }}>
        <span className="row" style={{ gap: 6 }}>
          <DocDot name={session.documents[0].name} />
          <span className="rowitem__name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {docs}
          </span>
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

/** The "most recent session" card on Today. Chunky: it's a link, so it presses. */
export function RecentSessionCard({ session }: { session: Session }) {
  return (
    <Chunky className="chunk">
      <Link href={`/sessions/${session.id}/`} style={{ display: "block", color: "inherit" }}>
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <div className="stack" style={{ gap: 3, minWidth: 0 }}>
            <span className="row" style={{ gap: 6 }}>
              <DocDot name={session.documents[0].name} />
              <span className="t-headline" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.documents[0].name}
              </span>
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
            <span className="stat-value" style={{ fontSize: 26 }}>
              <span aria-hidden="true">{duration(session.scoredMinutes)}</span>
              <span className="sr-only">{durationSpoken(session.scoredMinutes)}</span>
            </span>
            <span className="t-caption dimmer">scored</span>
          </div>
          <div className="vdivider" />
          <div className="stack" style={{ gap: 1 }}>
            <span className="stat-value" style={{ fontSize: 26 }}>{session.eventCount}</span>
            <span className="t-caption dimmer">edits</span>
          </div>
          <div className="vdivider" />
          <div className="stack" style={{ gap: 1 }}>
            <span className="stat-value" style={{ fontSize: 26 }}>{session.documents.length}</span>
            <span className="t-caption dimmer">{session.documents.length === 1 ? "document" : "documents"}</span>
          </div>
          <Icon name="chevron" size={17} className="dimmer" />
        </div>
      </Link>
    </Chunky>
  );
}
