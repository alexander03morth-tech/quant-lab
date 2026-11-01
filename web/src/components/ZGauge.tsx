import { fmt, fmtSigned } from "../lib/format";

/** Horisontell mätare för z-score med trösklar. Visuellt ankare i paranalysens hero. */
export function ZGauge({ z, entry, exit, stop }: { z: number; entry: number; exit: number; stop: number }) {
  const R = 4.5;
  const pct = (v: number) => ((Math.max(-R, Math.min(R, v)) + R) / (2 * R)) * 100;
  const zone = Math.abs(z) >= entry ? (z > 0 ? "neg" : "pos") : Math.abs(z) <= exit ? "dim" : "warn";
  return (
    <div className="zgauge">
      <div className="zgauge-head">
        <span className="dim">Z-score idag</span>
        <span className={`zgauge-val num ${zone}`}>{fmtSigned(z, 2)}</span>
      </div>
      <div className="zgauge-bar">
        <div className="zg-zone zg-long" style={{ left: 0, width: `${pct(-entry)}%` }} />
        <div className="zg-zone zg-short" style={{ left: `${pct(entry)}%`, right: 0 }} />
        <div className="zg-zone zg-exit" style={{ left: `${pct(-exit)}%`, width: `${pct(exit) - pct(-exit)}%` }} />
        {stop < 8 && [-stop, stop].map((s) => <div key={s} className="zg-tick stop" style={{ left: `${pct(s)}%` }} />)}
        {[-entry, entry].map((s) => <div key={s} className="zg-tick" style={{ left: `${pct(s)}%` }} />)}
        {Number.isFinite(z) && <div className={`zg-needle ${zone}`} style={{ left: `${pct(z)}%` }} />}
      </div>
      <div className="zgauge-scale num">
        <span>−{fmt(R, 0)}</span><span>köp spread</span><span>0</span><span>sälj spread</span><span>+{fmt(R, 0)}</span>
      </div>
    </div>
  );
}
