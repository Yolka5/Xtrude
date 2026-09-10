"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { StatCard } from "@/components/Stat";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { TiltHero } from "@/components/TiltHero";
import { Chunky } from "@/components/Chunky";
import { FlyItem } from "@/components/FlyItem";
import { Icon, type IconName } from "@/components/Icon";
import type { Badge, DayTotal, PersonalRecord, ProfileStats } from "@/lib/fixtures";
import { duration, plural, shortDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { burstAt, celebrate } from "@/lib/confetti";

const PRISM_CONFETTI = ["#9e74e7", "#f04cf0", "#ff52a8"];

/** "Personal record or badge: full-screen confetti" - there's no live unlock
 *  event in a static-fixture app, so earned badges and records are tappable
 *  celebrations instead: "these should feel good enough that I want to
 *  trigger them again" is an explicit invitation to make them repeatable. */
function useCelebrate(ref: React.RefObject<HTMLElement | null>) {
  return () => {
    haptics.celebrate();
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      burstAt((r.left + r.width / 2) / window.innerWidth, (r.top + r.height / 2) / window.innerHeight, PRISM_CONFETTI);
    } else {
      celebrate(PRISM_CONFETTI);
    }
  };
}

function RecordRow({ r }: { r: PersonalRecord }) {
  const ref = useRef<HTMLDivElement>(null);
  const fire = useCelebrate(ref);
  return (
    <motion.div
      ref={ref}
      className="kv"
      style={{ cursor: "pointer" }}
      whileTap={{ scale: 0.97 }}
      onTap={fire}
    >
      <span className="kv__k">
        {r.label}
        {r.when ? <span className="t-caption dimmer" style={{ display: "block" }}>{shortDate(r.when)}</span> : null}
      </span>
      <span className="kv__v">
        {r.value}
        {r.unit ? <span className="dimmer" style={{ fontSize: 13, fontWeight: 600 }}> {r.unit}</span> : null}
      </span>
    </motion.div>
  );
}

function BadgeTile({ b }: { b: Badge }) {
  const ref = useRef<HTMLLIElement>(null);
  const fire = useCelebrate(ref);
  // Badge discs are bold by default (prism, see .badge-tile__disc) - locked
  // ones fall back to neutral grey. Flame/flame2 badges override to fire
  // instead: "the flame mark uses fire" reads better as the disc's own
  // colour now that discs are bold, not as a tint on top of prism.
  const isFlame = b.earned && (b.glyph === "flame" || b.glyph === "flame2");
  const discStyle = isFlame
    ? { background: "linear-gradient(155deg, var(--fire-1), var(--fire-2))", boxShadow: "0 4px 0 0 var(--fire-edge)" }
    : undefined;

  return (
    <Chunky
      as="li"
      ref={ref}
      className={`badge-tile${b.earned ? "" : " badge-tile--locked"}`}
      edge={b.earned ? "var(--chunk-edge-neutral-strong)" : "var(--chunk-edge-neutral-strong)"}
      depth={5}
      onTap={b.earned ? fire : undefined}
    >
      <span className="badge-tile__disc" style={discStyle} aria-hidden="true">
        <Icon name={b.earned ? (b.glyph as IconName) : "lock"} size={22} filled weight={b.earned ? 1.9 : 1.75} />
      </span>
      <span className="badge-tile__name">{b.name}</span>
      <span className="badge-tile__sub">{b.earned ? "Earned" : b.detail}</span>
      <span className="sr-only">{b.earned ? `Earned: ${b.detail}` : `Locked: ${b.detail}`}</span>
    </Chunky>
  );
}

export function ProfileContent({
  profile,
  records,
  badges,
  daily,
  daysTracked,
  hasAnyData,
}: {
  profile: ProfileStats;
  records: PersonalRecord[];
  badges: Badge[];
  daily: DayTotal[];
  daysTracked: number;
  hasAnyData: boolean;
}) {
  const earned = badges.filter((b) => b.earned).length;

  return (
    <main className="screen">
      {/* Identity - intentionally minimal so it doesn't compete with the hero */}
      <FlyItem>
        <h1 className="screen__title">Profile</h1>
        <div className="row" style={{ gap: 14, margin: "8px 4px 20px" }}>
          <span
            className="avatar"
            style={{
              width: 54, height: 54, fontSize: 19,
              background: "var(--disc-neutral)",
              color: "#fff", boxShadow: "0 6px 0 0 var(--chunk-edge-neutral-strong)",
            }}
            aria-hidden="true"
          >
            {profile.initials}
          </span>
          <div className="stack" style={{ gap: 2 }}>
            <span className="t-title3">{profile.name}</span>
            <span className="t-footnote dim">{profile.handle} &middot; since {profile.memberSince}</span>
          </div>
        </div>
      </FlyItem>

      {/* Hero: the all-time heatmap. Profile has no colour of its own, so
          this is the one place prism appears as the default it's meant to be
          - a bold light gradient, dark text, ramp running to full magenta. */}
      <FlyItem>
        <TiltHero className="hero" style={{ padding: "20px 18px 18px" }} edge="var(--prism-edge)">
          <div className="spread" style={{ marginBottom: 16 }} aria-labelledby="activity-h">
            <div className="stack" style={{ gap: 3 }}>
              <span id="activity-h" className="hero-label">All-time activity</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span className="hero-value" style={{ fontSize: 40, letterSpacing: "-1.2px" }}>
                  {profile.lifetimeHours}
                </span>
                <span className="hero-unit" style={{ fontSize: 16 }}>hours modeled</span>
              </div>
            </div>
            {/* Chip stays neutral - this is Profile's prism moment, not a
                second streak moment. Only the flame glyph carries fire. */}
            <span className="hero-chip">
              <span style={{ color: "var(--fire-edge)" }}>
                <Icon name="flame" size={12} filled />
              </span>
              {profile.currentStreak}-day streak
            </span>
          </div>
          <ActivityHeatmap daily={daily} />
        </TiltHero>
      </FlyItem>

      <FlyItem>
        <div className="section-head"><h2>Lifetime</h2></div>
        <div className="grid-2">
          <StatCard
            label="Hours modeled" value={profile.lifetimeHours} decimals={1} animate unit="hrs"
            icon={<Icon name="clock" size={15} className="dimmer" />}
            footnote={`Across ${plural(profile.activeDays, "active day")}`}
          />
          <StatCard
            label="Longest streak" value={profile.longestStreak} animate unit="days"
            icon={<Icon name="flame" size={15} className="dimmer" />}
            footnote={`${profile.currentStreak} days running now`}
          />
          <StatCard
            label="Total sessions" value={profile.totalSessions} animate
            icon={<Icon name="sessions" size={15} className="dimmer" />}
            footnote={`Median ${profile.medianSessionMinutes} min each`}
          />
          <StatCard
            label="Verified" value={profile.verifiedShare} animate unit="%"
            icon={<Icon name="verified" size={15} className="dimmer" />}
            footnote="Sessions that changed geometry"
          />
        </div>
      </FlyItem>

      {records.length > 0 && (
        <FlyItem>
          <div className="section-head">
            <h2>Personal records</h2>
            <span className="t-footnote dim">Tap one</span>
          </div>
          <section className="chunk">
            {records.map((r) => <RecordRow key={r.label} r={r} />)}
          </section>
        </FlyItem>
      )}

      <FlyItem>
        <div className="section-head">
          <h2>Badges</h2>
          <span className="t-footnote dim">{earned} of {badges.length} earned</span>
        </div>
        <ul className="badge-grid" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {badges.map((b) => <BadgeTile key={b.id} b={b} />)}
        </ul>
      </FlyItem>

      <FlyItem>
        <p className="t-caption dimmer" style={{ margin: "20px 4px 0", textAlign: "center" }}>
          {hasAnyData
            ? `${daysTracked} days tracked · ${duration(profile.lifetimeMinutes)} scored`
            : "Day one · nothing modeled yet"}
        </p>
      </FlyItem>
    </main>
  );
}
