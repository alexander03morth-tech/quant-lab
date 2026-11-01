import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { useFundamentals } from "../../lib/extra";
import { fmt, fmtPct } from "../../lib/format";
import { DEFAULT_LBO, maxPremium, runLbo } from "../../lib/pe/lbo";

type SortKey = "maxPrem" | "irr" | "evEbitda" | "netDebtEbitda" | "ev" | "fcfYield";

export function PeScreen() {
  const fund = useFundamentals();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>("maxPrem");
  const rows = useMemo(() => Object.entries(fund?.items ?? {}).filter(([, f]) => f.lbo).map(([t, f]) => {
    const input = { ...DEFAULT_LBO, ebitda0: f.ebitda!, revenue0: f.revenue!, marketCap: f.marketCap!, netDebt0: f.netDebt ?? 0, capexPct: f.capexPct ?? 0.05, growth: Math.max(-0.03, Math.min(0.08, f.revenueGrowth ?? 0.03)) };
    const r = runLbo(input);
    return { t, f, irr: r.irr, maxPrem: maxPremium(input, 0.2), tooBig: (f.ev ?? 0) > 200e9 };
  }), [fund]);
  const sorted = [...rows].sort((a, b) => {
    const v = (x: typeof a) => (sort === "irr" ? x.irr : sort === "maxPrem" ? x.maxPrem ?? -9 : sort === "ev" ? -(x.f.ev ?? 0) : sort === "fcfYield" ? x.f.fcfYield ?? -9 : -(x.f[sort] ?? 99));
    return v(b) - v(a);
  });
  if (fund === undefined) return <div className="plot-loading" style={{ minHeight: "40vh" }}>Laddar nyckeltal…</div>;
  if (!fund) return <div className="notice"><span className="icon">!</span>Nyckeltal saknas.</div>;
  const excluded = Object.values(fund.items).filter((f) => !f.lbo);
  const neg = cssVar("--neg");
  const realistic = rows.filter((r) => !r.tooBig);

  const scatter: Data[] = [{
    type: "scatter3d", mode: "markers+text",
    x: rows.map((r) => r.f.evEbitda), y: rows.map((r) => r.f.netDebtEbitda), z: rows.map((r) => r.maxPrem ?? -0.5),
    text: rows.map((r) => r.f.name.replace(/ [ABC]$/, "")) as any, textposition: "top center", textfont: { size: 10.5, color: cssVar("--text-2") },
    marker: { size: rows.map((r) => 5 + Math.log10((r.f.ev ?? 1e10) / 1e10) * 6), color: rows.map((r) => r.maxPrem ?? -0.5), cmin: -0.3, cmax: 0.6,
      colorscale: [[0, neg], [0.33, cssVar("--surface-2")], [0.7, cssVar("--primary-strong")], [1, "#fff4e6"]], opacity: 0.95, line: { color: "#000", width: 0.5 },
      colorbar: { thickness: 8, len: 0.55, tickformat: ".0%", title: { text: "Max bud", side: "right", font: { size: 11 } }, tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") } } },
    customdata: rows.map((r) => [r.f.name, r.maxPrem == null ? "inget" : fmtPct(r.maxPrem, 0, true), r.tooBig ? "för stort för en LBO" : ""]) as any,
    hovertemplate: "<b>%{customdata[0]}</b><br>EV/EBITDA %{x:.1f}× · nettoskuld %{y:.1f}× EBITDA<br>Max bud för 20 % IRR: %{customdata[1]}<br><i>%{customdata[2]}</i><extra></extra>",
  } as any];

  const th = (k: SortKey, label: string, info?: string) => (
    <th className="num"><button className="th-sort" aria-pressed={sort === k} onClick={() => setSort(k)}>{label}{sort === k ? " ↓" : ""}</button>{info && <> <Info id={info} /></>}</th>
  );

  return (
    <>
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Take-private-screen</span><span className="live">{rows.length} bolag analyserade</span></div>
          <h1 className="hero-title">Vem skulle en PE-fond kunna köpa?</h1>
          <p className="hero-sub">Vi kör samma LBO-kalkyl på varje OMXS30-bolag med standardantaganden (5× skuld, 8 % ränta, 5 år, exit till samma multipel) och räknar ut hur hög budpremie en köpare har råd med för att nå 20 % IRR. Klicka på ett bolag för att räkna själv.</p>
        </div>
      </div>
      <div className="grid">
        <section className="card span-12 lab3d">
          <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Kandidatkartan <Info id="take-private" /></h2><span className="dim" style={{ fontSize: 12 }}>dra för att rotera · storlek = EV</span></div>
          <div className="card-body"><Plot ariaLabel="3D: bolagens värdering, skuldsättning och maxbud" data={scatter} height={500}
            onClick={(pt) => { const r = rows[pt?.pointNumber]; if (r) navigate(`/pe/lbo/${r.t}`); }}
            layout={scene3d({ x: "EV/EBITDA idag", y: "Nettoskuld / EBITDA", z: "Max budpremie" }, { zaxis: { tickformat: ".0%" }, camera: { eye: { x: 1.6, y: 1.3, z: 0.7 } } } as any)} /></div>
          <Caption>Varje klot är ett bolag. <b>Högt upp = en PE-köpare har råd att bjuda mycket över börskursen.</b> Billiga bolag (låg EV/EBITDA, till vänster) med lite skuld (fram) brukar hamna högst. Stora klot är stora bolag – de allra största är i praktiken för stora för en LBO.</Caption>
        </section>

        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Rangordning</h2><span className="dim" style={{ fontSize: 12 }}>klicka på kolumnrubrik för att sortera · {realistic.length} av {rows.length} är realistiska i storlek</span></div>
          <div className="card-body" style={{ overflowX: "auto" }}>
            <table className="data">
              <thead><tr><th>Bolag</th>{th("ev", "EV", "enterprise-value")}{th("evEbitda", "EV/EBITDA", "ev-ebitda")}{th("netDebtEbitda", "Nettoskuld/EBITDA", "leverage-multiple")}{th("fcfYield", "FCF-avkastning")}{th("irr", "IRR @30 %", "irr")}{th("maxPrem", "Max bud", "max-bid")}</tr></thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.t} className="row-link" onClick={() => navigate(`/pe/lbo/${r.t}`)}>
                    <td>{r.f.name}{r.tooBig && <span className="tag neutral" style={{ marginLeft: 8 }}>för stort</span>}</td>
                    <td className="num">{fmt((r.f.ev ?? 0) / 1e9, 0)} mdkr</td>
                    <td className="num">{fmt(r.f.evEbitda, 1)}×</td>
                    <td className="num">{fmt(r.f.netDebtEbitda, 1)}×</td>
                    <td className="num">{fmtPct(r.f.fcfYield, 1)}</td>
                    <td className={`num ${r.irr >= 0.2 ? "pos" : r.irr < 0.1 ? "neg" : ""}`}>{fmtPct(r.irr, 1)}</td>
                    <td className={`num ${r.maxPrem != null && r.maxPrem >= 0.3 ? "pos" : r.maxPrem == null || r.maxPrem < 0 ? "neg" : ""}`}>{r.maxPrem == null ? "–" : fmtPct(r.maxPrem, 0, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details style={{ marginTop: 12 }}>
              <summary className="dim" style={{ cursor: "pointer", fontSize: 13 }}>{excluded.length} bolag är inte med – varför?</summary>
              <ul className="muted" style={{ fontSize: 13 }}>{excluded.map((f) => <li key={f.name}><b>{f.name}</b>: {f.lboNote}</li>)}</ul>
            </details>
            <p className="dim" style={{ fontSize: 12, margin: "10px 0 0" }}>Grov screening, inte en rekommendation. Verkliga uppköp avgörs också av ägarstruktur, branschens cyklikalitet, regler och om ägarna vill sälja. Nyckeltal från Yahoo Finance, omräknade till SEK.</p>
          </div>
        </section>
      </div>
    </>
  );
}
