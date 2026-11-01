import type { ReactNode } from "react";
import { Info } from "./Info";

export type Tone = "good" | "mid" | "bad" | "neutral";

export function Metric({ label, value, sub, tone, toneLabel, info, ctx }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; toneLabel?: string;
  info?: string; ctx?: Record<string, unknown>;
}) {
  return (
    <div className="metric">
      <div className="metric-label">{label}{info && <Info id={info} ctx={ctx} />}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">
        {tone && toneLabel && <span className={`tag ${tone}`}>{toneLabel}</span>}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}
