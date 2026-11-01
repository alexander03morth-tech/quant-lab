import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { cssVar, Plot } from "../../components/Plot";
import { betaVs } from "../../lib/aktie/beta";
import { runDcf } from "../../lib/aktie/dcf";
import { useData } from "../../lib/data";
import { useFundamentals, type Fundamentals } from "../../lib/extra";
import { fmt } from "../../lib/format";

const median = (a: (number | null)[]) => { const v = a.filter((x): x is number => x != null && Number.isFinite(x) && x > 0).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };

interface Bar { label: string; lo: number; hi: number; info: string; how: string }

export function FootballField() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const fund = useFundamentals();
  const { prices, meta } = useData();
  const t = ticker && fund?.items[ticker] ? ticker : "SKF-B.ST";
  const all = fund?.items ?? {};
  const f: Fundamentals | undefined = all[t];

  const bars = useMemo<Bar[]>(() => {
    if (!f || !f.price || !f.shares) return [];
    const out: Bar[] = [];
    const bank = f.sector === "finans";
    if (f.low52 && f.high52) out.push({ label: "52-veckorsintervall", lo: f.low52, hi: f.high52, info: "range-52w", how: "Lägsta och högsta kurs senaste året" });
    if (f.targetLow && f.targetHigh) out.push({ label: "Analytikernas riktkurser", lo: f.targetLow, hi: f.targetHigh, info: "analyst-target", how: `Lägsta–högsta av ${fmt(f.analysts, 0)} analytiker` });
    const peers = Object.values(all).filter((x) => (bank ? x.sector === "finans" : x.sector !== "finans"));
    const pe = median(peers.map((x) => x.pe));
    if (pe && f.netIncome && f.netIncome > 0) {
      const eps = f.netIncome / f.shares;
      out.push({ label: "P/E-multiplar", lo: eps * pe * 0.85, hi: eps * pe * 1.15, info: "pe", how: `Medianen för jämförbara bolag (${fmt(pe, 1)}×) ±15 %` });
    }
    if (!bank && f.ebitda && f.ebitda > 0) {
      const m = median(peers.map((x) => x.evEbitda));
      if (m) out.push({ label: "EV/EBITDA-multiplar", lo: (m * 0.85 * f.ebitda - (f.netDebt ?? 0)) / f.shares, hi: (m * 1.15 * f.ebitda - (f.netDebt ?? 0)) / f.shares, info: "ev-ebitda", how: `Medianen (${fmt(m, 1)}×) ±15 %, minus nettoskuld` });
      const beta = betaVs(prices, t, meta.benchmark.ticker);
      const fcf = f.fcf && f.fcf > 0 ? f.fcf : f.ebitda * 0.794 - (f.capex ?? 0);
      if (fcf > 0) {
        const base = { fcf0: fcf, netDebt: f.netDebt ?? 0, shares: f.shares, marketCap: f.marketCap!, debt: f.debt ?? 0, g1: Math.max(0, Math.min(0.12, f.revenueGrowth ?? 0.04)), years: 7, rf: 0.025, beta, erp: 0.055, kd: 0.05, tax: 0.206 };
        const w = runDcf({ ...base, gT: 0.02 }).wacc;
        const vals = [runDcf({ ...base, gT: 0.015, waccOverride: w + 0.01 }).perShare, runDcf({ ...base, gT: 0.025, waccOverride: w - 0.01 }).perShare];
        out.push({ label: "DCF", lo: Math.max(0, Math.min(...vals)), hi: Math.max(...vals), info: "dcf", how: `WACC ${fmt((w - 0.01) * 100, 1)}–${fmt((w + 0.01) * 100, 1)} %, evig tillväxt 1,5–2,5 %` });
      }
    }
    out.push({ label: "Uppköpspremie 25–45 %", lo: f.price * 1.25, hi: f.price * 1.45, info: "bid-premium", how: "Vad en köpare typiskt måste betala över kursen" });
    return out;
  }, [f, all, prices, t, meta]);

  if (fund === undefined) return <div className="plot-loading" style={{ minHeight: "40vh" }}>Laddar nyckeltal…</div>;
  if (!f || !f.price) return <div className="notice"><span className="icon">!</span>Nyckeltal saknas.</div>;
  const price = f.price;
  const lo = Math.min(...bars.map((b) => b.lo)), hi = Math.max(...bars.map((b) => b.hi));
  const core = bars.filter((b) => !b.label.startsWith("Uppköp"));
  const ctx = { name: f.name, lo: Math.min(...core.map((b) => b.lo)), hi: Math.max(...core.map((b) => b.hi)), price };
  const colors = [cssVar("--text-3"), cssVar("--series-b"), cssVar("--series-c"), cssVar("--series-a"), cssVar("--accent"), cssVar("--pos")];
  const data: Data[] = [
    { type: "bar", orientation: "h", y: bars.map((b) => b.label), x: bars.map((b) => b.hi - b.lo), base: bars.map((b) => b.lo), marker: { color: bars.map((_, i) => colors[i % colors.length]), line: { width: 0 } },
      text: bars.map((b) => `${fmt(b.lo, 0)} – ${fmt(b.hi, 0)}`), textposition: "inside", insidetextanchor: "middle", textfont: { family: cssVar("--mono"), size: 12, color: "#0b0b0d" },
      customdata: bars.map((b) => b.how) as any, hovertemplate: "<b>%{y}</b><br>%{text} kr<br><i>%{customdata}</i><extra></extra>", showlegend: false } as any,
  ];
  const stocks = Object.entries(all).sort((a, b) => a[1].name.localeCompare(b[1].name, "sv"));

  return (
    <>
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Värderingsöversikt</span><span className="live">football field</span></div>
          <h1 className="hero-title">Vad är {f.name} värt – enligt fem metoder?</h1>
          <p className="hero-sub">Så presenterar en investmentbank ett bolags värde inför en affär: varje metod ger ett intervall, och tillsammans visar de var värdet rimligen ligger. <Info id="football-field" ctx={ctx} /></p>
          <div className="row">
            <select className="select" value={t} onChange={(e) => navigate(`/ib/vardering/${e.target.value}`)} aria-label="Välj bolag">{stocks.map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}</select>
            <Link className="btn" to={`/aktie/bolag/${t}`}>Bolagsanalys →</Link>
            {f.sector !== "finans" && <Link className="btn" to={`/aktie/dcf/${t}`}>Justera DCF →</Link>}
          </div>
        </div>
      </div>
      <div className="grid">
        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Värde per aktie, kr <Info id="football-field" ctx={ctx} /></h2><span className="legend"><span><i style={{ background: cssVar("--text"), height: 10, width: 2 }} />kurs idag {fmt(price, 0)} kr</span></span></div>
          <div className="card-body">
            <Plot ariaLabel="Football field: värderingsintervall per metod" data={data} height={70 + 58 * bars.length}
              layout={{ barmode: "overlay", hovermode: "closest", bargap: 0.35, xaxis: { range: [lo * 0.9, hi * 1.06], ticksuffix: " kr" } as any, yaxis: { side: "left", autorange: "reversed", automargin: true } as any,
                shapes: [{ type: "line", x0: price, x1: price, yref: "paper", y0: -0.02, y1: 1.02, line: { color: cssVar("--text"), width: 2 } }] as any,
                annotations: [{ x: price, y: 1.04, yref: "paper", text: `Kurs ${fmt(price, 0)}`, showarrow: false, font: { family: cssVar("--mono"), size: 12, color: cssVar("--text") } }] as any,
                margin: { l: 8, r: 16, t: 28, b: 8 } }} />
          </div>
          <Caption>Varje stapel är ett intervall för vad aktien är värd enligt en metod. Den vita linjen är dagens kurs. <b>Där flera staplar överlappar ligger det mest troliga värdet.</b> Uppköpsstapeln längst ner visar ungefär vad en köpare skulle behöva bjuda – därför ligger den oftast till höger om allt annat.</Caption>
        </section>
        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Så räknades staplarna</h2></div>
          <div className="card-body">
            <table className="data"><thead><tr><th>Metod</th><th>Antagande</th><th className="num">Lägst</th><th className="num">Högst</th></tr></thead>
              <tbody>{bars.map((b) => <tr key={b.label}><td><span className="row" style={{ gap: 6 }}>{b.label} <Info id={b.info} ctx={ctx} /></span></td><td className="muted">{b.how}</td><td className="num">{fmt(b.lo, 0)}</td><td className="num">{fmt(b.hi, 0)}</td></tr>)}</tbody>
            </table>
            <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>Förenklat: verkliga bankanalyser använder noga utvalda jämförelsebolag, egna prognoser och tidigare uppköp i branschen (transaktionsmultiplar).</p>
          </div>
        </section>
      </div>
    </>
  );
}
