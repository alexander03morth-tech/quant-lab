import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { fmtPct } from "../lib/format";

/** Löpande band med senaste dagens förändring för alla aktier. Pausar vid hovring; stilla vid reduced motion. */
export function TickerTape() {
  const { prices, meta } = useData();
  const items = useMemo(() => {
    const n = prices.dates.length;
    return [meta.benchmark.ticker, ...meta.stocks.map((s) => s.ticker)].map((t) => {
      const c = prices.series[t]?.close ?? [];
      let i = n - 1;
      while (i > 0 && c[i] == null) i--;
      let j = i - 1;
      while (j > 0 && c[j] == null) j--;
      const last = c[i] as number, prev = c[j] as number;
      return { t, label: t === meta.benchmark.ticker ? "OMXS30" : t.replace(".ST", ""), last, chg: last / prev - 1 };
    });
  }, [prices, meta]);
  const row = items.map((it) => (
    <Link key={it.t} to={it.t.startsWith("^") ? "/marknad" : `/par/${it.t}/${it.t === "SWED-A.ST" ? "NDA-SE.ST" : "SWED-A.ST"}`} className="tick">
      <span className="tick-sym">{it.label}</span>
      <span className="num">{it.last?.toLocaleString("sv-SE", { maximumFractionDigits: 2 })}</span>
      <span className={`num ${it.chg >= 0 ? "pos" : "neg"}`}>{it.chg >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(it.chg), 2)}</span>
    </Link>
  ));
  return (
    <div className="tape" aria-label="Senaste dagens kursförändringar">
      <div className="tape-track">{row}<span aria-hidden="true" style={{ display: "contents" }}>{row}</span></div>
    </div>
  );
}
