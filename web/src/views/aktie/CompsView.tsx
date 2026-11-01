import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Seg } from "../../components/Slider";
import { useData } from "../../lib/data";
import { useFundamentals } from "../../lib/extra";
import { fmt, fmtPct } from "../../lib/format";

const median = (a: (number | null)[]) => { const v = a.filter((x): x is number => x != null && Number.isFinite(x)).sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
const SECTOR_COLORS: Record<string, string> = { industri: "--series-a", finans: "--series-b", halsovard: "--pos", material: "--warn", it: "--series-c", telekom: "#22d3ee", sallanskop: "#f472b6", dagligvaror: "#a3e635" };
const col = (s: string) => (SECTOR_COLORS[s]?.startsWith("--") ? cssVar(SECTOR_COLORS[s]) : SECTOR_COLORS[s] ?? cssVar("--text-3"));

export function CompsView() {
  const fund = useFundamentals();
  const { meta } = useData();
  const navigate = useNavigate();
  const [group, setGroup] = useState<"bolag" | "finans">("bolag");
  const rows = useMemo(() => Object.entries(fund?.items ?? {}).map(([t, f]) => ({ t, f })).filter(({ f }) => (group === "finans" ? f.sector === "finans" : f.sector !== "finans")), [fund, group]);
  if (fund === undefined) return <div className="plot-loading" style={{ minHeight: "40vh" }}>Laddar nyckeltal…</div>;
  if (!fund) return <div className="notice"><span className="icon">!</span>Nyckeltal saknas.</div>;

  const label = (n: string) => n.replace(/ [ABC]$/, "");
  const scatter: Data[] = group === "bolag"
    ? [...new Set(rows.map((r) => r.f.sector))].map((s) => {
        const rs = rows.filter((r) => r.f.sector === s && r.f.evEbitda != null && r.f.evEbitda < 45);
        return {
          type: "scatter3d", mode: "markers+text", name: meta.sectors[s],
          x: rs.map((r) => r.f.ebitdaMargin), y: rs.map((r) => r.f.revenueGrowth), z: rs.map((r) => r.f.evEbitda),
          text: rs.map((r) => label(r.f.name)) as any, textposition: "top center", textfont: { size: 10.5, color: cssVar("--text-2") },
          marker: { size: 7, color: col(s), line: { color: "#000", width: 0.5 } },
          customdata: rs.map((r) => r.t) as any,
          hovertemplate: "<b>%{text}</b><br>EBITDA-marginal %{x:.0%} · tillväxt %{y:.0%}<br>EV/EBITDA %{z:.1f}×<extra></extra>",
        } as any;
      })
    : [{
        type: "scatter", mode: "markers+text", x: rows.map((r) => r.f.roe), y: rows.map((r) => r.f.pb), text: rows.map((r) => label(r.f.name)) as any, textposition: "top center",
        marker: { size: 12, color: cssVar("--series-b"), line: { color: "#000", width: 0.5 } }, customdata: rows.map((r) => r.t) as any,
        hovertemplate: "<b>%{text}</b><br>ROE %{x:.0%} · P/B %{y:.2f}×<extra></extra>",
      } as any];

  const cols = group === "bolag"
    ? [["EV/EBITDA", "ev-ebitda", (f: any) => f.evEbitda, (v: number) => `${fmt(v, 1)}×`], ["P/E", "pe", (f: any) => f.pe, (v: number) => fmt(v, 1)], ["EBITDA-marg.", "margins", (f: any) => f.ebitdaMargin, (v: number) => fmtPct(v, 0)], ["Tillväxt", "total-return", (f: any) => f.revenueGrowth, (v: number) => fmtPct(v, 1, true)], ["ROE", "roe", (f: any) => f.roe, (v: number) => fmtPct(v, 0)], ["Direktavk.", "div-yield", (f: any) => f.divYield, (v: number) => fmtPct(v, 1)]] as const
    : [["P/E", "pe", (f: any) => f.pe, (v: number) => fmt(v, 1)], ["P/B", "pb", (f: any) => f.pb, (v: number) => `${fmt(v, 2)}×`], ["ROE", "roe", (f: any) => f.roe, (v: number) => fmtPct(v, 0)], ["Direktavk.", "div-yield", (f: any) => f.divYield, (v: number) => fmtPct(v, 1)]] as const;

  return (
    <>
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Jämförelse</span><span className="live">{rows.length} bolag</span></div>
          <h1 className="hero-title">Vad är dyrt, och varför?</h1>
          <p className="hero-sub">Bolag som tjänar mer och växer snabbare brukar vara dyrare. Jämför bolagen med varandra för att se vem som sticker ut – det kallas relativvärdering. <Info id="comps" /></p>
          <Seg label="Grupp" value={group} onChange={setGroup} options={[{ value: "bolag", label: "Industri, konsument, IT m.fl." }, { value: "finans", label: "Banker & investmentbolag" }]} />
        </div>
      </div>
      <div className="grid">
        <section className={`card span-12 ${group === "bolag" ? "lab3d" : ""}`}>
          <div className="card-head"><h2 className="card-title"><span className="idx">01</span>{group === "bolag" ? "Marginal × tillväxt × pris i 3D" : "Lönsamhet mot pris"} <Info id={group === "bolag" ? "ev-ebitda" : "pb"} /></h2><span className="dim" style={{ fontSize: 12 }}>{group === "bolag" ? "dra för att rotera · klicka för bolagsanalys" : "klicka för bolagsanalys"}</span></div>
          <div className="card-body">
            <Plot ariaLabel="Bolagens värdering i förhållande till lönsamhet och tillväxt" data={scatter} height={group === "bolag" ? 520 : 380}
              onClick={(pt) => pt?.customdata && navigate(`/aktie/bolag/${pt.customdata}`)}
              layout={group === "bolag"
                ? { ...scene3d({ x: "EBITDA-marginal", y: "Omsättningstillväxt", z: "EV/EBITDA (×)" }, { xaxis: { tickformat: ".0%" }, yaxis: { tickformat: ".0%" }, camera: { eye: { x: 1.6, y: -1.3, z: 0.7 } } } as any), showlegend: true, legend: { orientation: "h", y: 1.02, x: 0 } }
                : { hovermode: "closest", xaxis: { tickformat: ".0%", title: { text: "ROE" } } as any, yaxis: { side: "left", title: { text: "P/B" } } as any }} />
          </div>
          <Caption>{group === "bolag"
            ? <>Varje klot är ett bolag, färgat efter bransch. Höjden är priset (EV/EBITDA). <b>Bolag högt upp med låg marginal och låg tillväxt är dyra för vad du får</b>; bolag lågt ner till höger är billiga – om siffrorna håller framåt.</>
            : <>För banker är det klassiska sambandet: <b>högre avkastning på eget kapital (ROE) motiverar högre P/B.</b> En bank långt under de andra kan vara billig – eller ha risker marknaden ser.</>}</Caption>
        </section>
        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Multiplar sida vid sida</h2></div>
          <div className="card-body" style={{ overflowX: "auto" }}>
            <table className="data">
              <thead><tr><th>Bolag</th><th>Bransch</th>{cols.map(([l, info]) => <th key={l} className="num">{l} <Info id={info} /></th>)}</tr></thead>
              <tbody>
                {[...rows].sort((a, b) => a.f.name.localeCompare(b.f.name, "sv")).map(({ t, f }) => (
                  <tr key={t} className="row-link" onClick={() => navigate(`/aktie/bolag/${t}`)}>
                    <td>{f.name}</td><td className="dim">{meta.sectors[f.sector]}</td>
                    {cols.map(([l, , get, show]) => { const v = get(f); return <td key={l} className="num">{v == null ? "–" : show(v)}</td>; })}
                  </tr>
                ))}
                <tr><td><b>Median</b></td><td />{cols.map(([l, , get, show]) => { const m = median(rows.map((r) => get(r.f))); return <td key={l} className="num"><b>{m == null ? "–" : show(m)}</b></td>; })}</tr>
              </tbody>
            </table>
            <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>Nyckeltal från Yahoo Finance (rullande 12 mån), omräknade till SEK. Banker jämförs separat eftersom EBITDA och skuld betyder något annat för dem.</p>
          </div>
        </section>
      </div>
    </>
  );
}
