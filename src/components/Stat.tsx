import type { ReactNode } from "react";
import { CountUp } from "./CountUp";
import { Chunky } from "./Chunky";

/**
 * Content layer. Solid surface, opaque text - nothing translucent ever sits
 * behind a number in this app. Chunky like everything else, but a size step
 * down from the hero: this is a supporting stat, not the screen's one loud
 * moment.
 */
export function StatCard({
  label,
  value,
  unit,
  size = 38,
  decimals = 0,
  animate = false,
  footnote,
  icon,
  srValue,
}: {
  label: string;
  value: string | number;
  unit?: string;
  size?: number;
  decimals?: number;
  /** Count up on first scroll into view. Only for numeric values. */
  animate?: boolean;
  footnote?: ReactNode;
  icon?: ReactNode;
  /** Spoken form, when the visual form abbreviates. */
  srValue?: string;
}) {
  const numeric = typeof value === "number";
  return (
    <Chunky className="chunk stack" style={{ gap: 8, justifyContent: "space-between" }}>
      <div className="row" style={{ gap: 7 }}>
        {icon}
        <span className="stat-label">{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span className="stat-value" style={{ fontSize: size }}>
          {srValue ? (
            <>
              <span aria-hidden="true">
                {animate && numeric ? <CountUp value={value} decimals={decimals} /> : value}
              </span>
              <span className="sr-only">{srValue}</span>
            </>
          ) : animate && numeric ? (
            <CountUp value={value} decimals={decimals} />
          ) : (
            value
          )}
        </span>
        {unit ? (
          <span className="stat-unit" style={{ fontSize: Math.round(size * 0.42) }} aria-hidden={!!srValue}>
            {unit}
          </span>
        ) : null}
      </div>
      {footnote ? <div className="t-caption dim">{footnote}</div> : null}
    </Chunky>
  );
}
