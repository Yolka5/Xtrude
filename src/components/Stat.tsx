import type { ReactNode } from "react";

/**
 * Content layer. Solid surface, opaque text - nothing translucent ever sits
 * behind a number in this app.
 */
export function StatCard({
  label,
  value,
  unit,
  size = 40,
  footnote,
  icon,
  srValue,
}: {
  label: string;
  value: string | number;
  unit?: string;
  size?: number;
  footnote?: ReactNode;
  icon?: ReactNode;
  /** Spoken form, when the visual form abbreviates ("1:22" -> "1 hour 22 minutes"). */
  srValue?: string;
}) {
  return (
    <div className="card stack" style={{ gap: 8, justifyContent: "space-between" }}>
      <div className="row" style={{ gap: 7 }}>
        {icon}
        <span className="stat-label">{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span className="stat-value" style={{ fontSize: size }}>
          {srValue ? <span aria-hidden="true">{value}</span> : value}
          {srValue ? <span className="sr-only">{srValue}</span> : null}
        </span>
        {unit ? (
          <span className="stat-unit" style={{ fontSize: Math.round(size * 0.42) }} aria-hidden={!!srValue}>
            {unit}
          </span>
        ) : null}
      </div>
      {footnote ? <div className="t-caption dim">{footnote}</div> : null}
    </div>
  );
}
