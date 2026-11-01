import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric } from "../../components/Metric";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Slider } from "../../components/Slider";
import { runDcf, type DcfInput } from "../../lib/aktie/dcf";
import { alignedPair, useData } from "../../lib/data";
import { useFundamentals, type Fundamentals } from "../../lib/extra";
import { fmt, fmtPct } from "../../lib/format";
import { betaAlpha } from "../../lib/stats/perf";

export function DcfView() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const fund = useFundamentals();
  const list = useMemo(() => Object.entries(fund?.items ?? {}).filter(([, f]) => f.sector !== "finans" && f.ebitda && f.shares && f.marketCap).sort((a, b) => a[1].name.localeCompare(b[1].name, "sv")), [fund]);
  if (fund === undefined) return <div className="plot-loading" style={{ minHeight: "40vh" }}>Laddar nyckeltal…</div>;
  const t = ticker && list.some(([k]) => k === ticker) ? ticker : list.find(([k]) => k === "ASSA-B.ST")?.[0] ?? list[0]?.[0];
  if (!t) return <div className="notice"><span className="icon">!</span>Nyckeltal saknas.</div>;
  return <Dcf key={t} t={t} f={fund!.items[t]} list={list} onPick={(k) => navigate(`/aktie/dcf/${k}`)} />;
}

function Dcf({ t, f, list, onPick }: { t: string; f: Fundamentals; list: [string, Fundamentals][]; onPick: (t: string) => void }) {
  const { prices, meta } = useData();
  const beta0 = useMemo(() => {
    const al = alignedPair(prices, t, meta.benchmark.ticker, 1260);
    const ra = [], rb = [];
    for (let i = 1; i < al.pa.length; i++) { ra.push(al.pa[i] / al.pa[i - 1] - 1); rb.push(al.pb[i] / al.pb[i - 1] - 1); }
    return Math.round(betaAlpha(ra, rb).beta * 100) / 100;
  }, [prices, t, meta]);
  // Bas-FCF: Yahoos fria kassaflöde om rimligt, annars EBITDA efter skatt minus capex
  const fcfBase = f.fcf && f.fcf > 0 ? f.fcf : Math.max(0.05 * f.ebitda!, f.ebitda! * (1 - 0.206) - (f.capex ?? 0.05 * (f.revenue ?? 0)));
  const [p, setP] = useState({ g1: Math.round(Math.max(0, Math.min(0.15, f.revenueGrowth ?? 0.04)) * 200) / 200, gT: 0.02, years: 7, rf: 0.025, beta: beta0, erp: 0.055, kd: 0.05 });
  const set = <K extends keyof typeof p>(k: K, v: number) => setP((o) => ({ ...o, [k]: v }));
  const input: DcfInput = { fcf0: fcfBase, netDebt: f.netDebt ?? 0, shares: f.shares!, marketCap: f.marketCap!, debt: f.debt ?? 0, tax: 0.206, ...p };
  const r = useMemo(() => runDcf(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const price = f.price!;
  // Omvänd DCF: vilken tillväxt de närmaste åren förutsätter dagens kurs?
  const implied = useMemo(() => {
    const val = (g: number) => runDcf({ ...input, g1: g }).perShare - price;
    let lo = -0.3, hi = 0.6;
    if (val(lo) > 0 || val(hi) < 0) return null;
    for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (val(m) > 0) hi = m; else lo = m; }
    return (lo + hi) / 2;
  }, [JSON.stringify(input), price]); // eslint-disable-line react-hooks/exhaustive-deps
  const surf = useMemo(() => {
    const ws = Array.from({ length: 15 }, (_, i) => 0.06 + i * 0.0045);
    const gs = Array.from({ length: 13 }, (_, i) => 0.0 + i * 0.0035);
    const z = gs.map((g) => ws.map((w) => (w - g > 0.012 ? Math.min(price * 4, Math.max(0, runDcf({ ...input, gT: g, waccOverride: w }).perShare)) : null)));
    return { ws, gs, z };
  }, [JSON.stringify({ ...input, gT: 0 })]); // eslint-disable-line react-hooks/exhaustive-deps

  const up = r.perShare / price - 1;
  const ctx = { name: f.name, perShare: r.perShare, price, wacc: r.wacc, ke: r.ke, tvShare: r.tvShare, beta: p.beta };
  const colA = cssVar("--series-a"), accent = cssVar("--accent"), pos = cssVar("--pos"), neg = cssVar("--neg");
  const pvData: Data[] = [
    { type: "bar", name: "Nuvärde av årets kassaflöde", x: [...r.flows.map((fl) => `År ${fl.year}`), "Terminalvärde"], y: [...r.flows.map((fl) => fl.pv / 1e9), r.pvTv / 1e9], marker: { color: [...r.flows.map(() => colA), accent] },
      customdata: [...r.flows.map((fl) => `Kassaflöde ${fmt(fl.fcf / 1e9, 1)} mdkr (tillväxt ${fmtPct(fl.growth, 1)}) är värt ${fmt(fl.pv / 1e9, 1)} mdkr idag`), `Allt efter år ${p.years}: ${fmtPct(r.tvShare, 0)} av hela värdet`] as any,
      hovertemplate: "<b>%{x}</b><br>%{customdata}<extra></extra>", text: [...r.flows.map(() => ""), fmtPct(r.tvShare, 0)], textposition: "outside" } as any,
  ];
  const surfData: Data[] = [
    { type: "surface", x: surf.ws, y: surf.gs, z: surf.z as any, colorscale: [[0, neg], [0.25, "#4a3434"], [0.25, cssVar("--surface-2")], [0.6, cssVar("--primary-strong")], [1, "#fff4e6"]], cmin: 0, cmax: price * 2,
      contours: { z: { show: true, start: price, end: price, size: 1, color: pos, width: 5 } } as any,
      lighting: { ambient: 0.55, diffuse: 0.7, specular: 0.4, roughness: 0.4 },
      colorbar: { thickness: 8, len: 0.55, title: { text: "kr/aktie", side: "right", font: { size: 11 } }, tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") } } as any,
      hovertemplate: "WACC %{x:.1%} · terminal tillväxt %{y:.1%}<br><b>%{z:.0f} kr per aktie</b><extra></extra>" } as any,
    { type: "surface", x: [surf.ws[0], surf.ws[14]], y: [surf.gs[0], surf.gs[12]], z: [[price, price], [price, price]], showscale: false, opacity: 0.18, colorscale: [[0, pos], [1, pos]], hoverinfo: "skip" } as any,
    { type: "scatter3d", mode: "markers+text", x: [r.wacc], y: [p.gT], z: [Math.min(price * 4, r.perShare) * 1.03], text: ["din kalkyl"], textposition: "top center", textfont: { color: cssVar("--text"), size: 12 }, marker: { size: 6, color: "#fff", line: { color: "#000", width: 1 } }, hoverinfo: "skip" } as any,
  ];

  return (
    <>
      <div className="hero" style={{ marginBottom: 14 }}>
        <div>
          <div className="hero-kicker"><span>DCF-värdering</span><span className="live">kassaflöde {fmt(fcfBase / 1e9, 1)} mdkr</span></div>
          <h1 className="hero-title">Vad är {f.name} värt?</h1>
          <p className="hero-sub">Ett bolag är värt alla pengar det kommer att tjäna i framtiden, omräknade till dagens kronor. Dra i antagandena och se hur värdet ändras – och vad dagens kurs egentligen förutsätter.</p>
          <div className="row">
            <select className="select" value={t} onChange={(e) => onPick(e.target.value)} aria-label="Välj bolag">{list.map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}</select>
            <Link className="btn" to={`/aktie/bolag/${t}`}>Bolagsanalys →</Link>
          </div>
        </div>
        <div className="hero-right">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div><div className="dim" style={{ fontSize: 12.5 }}>Värde per aktie <Info id="dcf" ctx={ctx} /></div><div className="big-num" style={{ textShadow: "none" }}>{fmt(r.perShare, 0)} kr</div></div>
            <div style={{ textAlign: "right" }}><div className="dim" style={{ fontSize: 12.5 }}>mot kursen {fmt(price, 0)} kr</div><div className={`num ${up >= 0 ? "pos" : "neg"}`} style={{ fontSize: 28 }}>{fmtPct(up, 0, true)}</div></div>
          </div>
          <div className="dim" style={{ fontSize: 13 }}>
            {implied == null ? "Dagens kurs går inte att förklara inom rimliga tillväxtantaganden." : <>Dagens kurs förutsätter att kassaflödet växer ca <b className="num" style={{ color: "var(--text)" }}>{fmtPct(implied, 1)}</b> per år de närmaste {p.years} åren (omvänd DCF).</>}
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="metrics span-12">
          <Metric label="WACC" info="wacc" ctx={ctx} value={fmtPct(r.wacc, 1)} sub={`ägarnas krav ${fmtPct(r.ke, 1)}`} />
          <Metric label="Beta (5 år)" info="beta" ctx={ctx} value={fmt(p.beta, 2)} sub={`uppmätt ${fmt(beta0, 2)}`} />
          <Metric label="Företagsvärde (EV)" info="enterprise-value" ctx={ctx} value={`${fmt(r.ev / 1e9, 0)} mdkr`} sub={`börsen: ${fmt((f.ev ?? 0) / 1e9, 0)} mdkr`} />
          <Metric label="Terminalvärdets andel" info="terminal-value" ctx={ctx} value={fmtPct(r.tvShare, 0)} tone={r.tvShare > 0.8 ? "mid" : "neutral"} toneLabel={r.tvShare > 0.8 ? "mycket" : "normalt"} />
          {f.targetMean && <Metric label="Analytikernas riktkurs" info="analyst-target" ctx={{ ...ctx, target: f.targetMean, analysts: f.analysts }} value={`${fmt(f.targetMean, 0)} kr`} />}
        </div>
        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Antaganden</h2><span className="dim" style={{ fontSize: 12 }}>Riskfri ränta ≈ svensk 10-årig statsobligation</span></div>
          <div className="card-body"><div className="grid" style={{ gap: "10px 22px" }}>
            <div className="span-3"><Slider label="Tillväxt år 1 (avtar mot terminal)" value={p.g1} min={-0.1} max={0.25} step={0.005} onChange={(v) => set("g1", v)} format={(v) => fmtPct(v, 1, true)} /></div>
            <div className="span-3"><Slider label="Terminal tillväxt" info="terminal-value" ctx={ctx} value={p.gT} min={0} max={0.04} step={0.0025} onChange={(v) => set("gT", v)} format={(v) => fmtPct(v, 2)} /></div>
            <div className="span-3"><Slider label="Prognosår" value={p.years} min={3} max={10} step={1} onChange={(v) => set("years", v)} format={(v) => `${v} år`} /></div>
            <div className="span-3"><Slider label="Beta" info="capm" ctx={ctx} value={p.beta} min={0.3} max={2} step={0.05} onChange={(v) => set("beta", v)} format={(v) => fmt(v, 2)} /></div>
            <div className="span-3"><Slider label="Riskfri ränta" info="capm" ctx={ctx} value={p.rf} min={0} max={0.06} step={0.0025} onChange={(v) => set("rf", v)} format={(v) => fmtPct(v, 2)} /></div>
            <div className="span-3"><Slider label="Marknadens riskpremie" info="capm" ctx={ctx} value={p.erp} min={0.03} max={0.08} step={0.0025} onChange={(v) => set("erp", v)} format={(v) => fmtPct(v, 2)} /></div>
            <div className="span-3"><Slider label="Låneränta före skatt" info="wacc" ctx={ctx} value={p.kd} min={0.02} max={0.1} step={0.0025} onChange={(v) => set("kd", v)} format={(v) => fmtPct(v, 2)} /></div>
          </div></div>
        </section>
        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Varifrån kommer värdet? <Info id="terminal-value" ctx={ctx} /></h2></div>
          <div className="card-body"><Plot ariaLabel="Nuvärde per år och terminalvärde" data={pvData} height={280} layout={{ hovermode: "closest", xaxis: { type: "category" } as any, yaxis: { ticksuffix: " md", side: "left" } as any, margin: { l: 8, r: 8, t: 20, b: 8 } }} /></div>
          <Caption>Varje stapel är vad ett års kassaflöde är värt i dagens pengar – de krymper med tiden eftersom framtida pengar är mindre värda. <b>Den sista, stora stapeln är allt efter prognosperioden.</b> Att den oftast är störst betyder att det mesta av värdet bygger på antaganden långt in i framtiden.</Caption>
        </section>
        <section className="card span-12 lab3d">
          <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Känslighet i 3D: avkastningskrav × evig tillväxt <Info id="wacc" ctx={ctx} /></h2><span className="dim" style={{ fontSize: 12 }}>dra för att rotera</span></div>
          <div className="card-body"><Plot ariaLabel="3D-yta: värde per aktie över WACC och terminal tillväxt" data={surfData} height={520}
            layout={scene3d({ x: "WACC", y: "Terminal tillväxt", z: "Värde per aktie (kr)" }, { xaxis: { tickformat: ".1%" }, yaxis: { tickformat: ".1%" }, camera: { eye: { x: -1.5, y: -1.4, z: 0.8 } } } as any)} /></div>
          <Caption>Varje punkt är hela DCF:en med ett annat avkastningskrav och en annan evig tillväxt. Det gröna glasplanet är dagens kurs: <b>där ytan ligger över planet är aktien billig, under planet dyr.</b> Se hur brant ytan blir uppe till vänster – små ändringar i antagandena kan dubbla värdet. Därför är en DCF ett sätt att resonera, inte ett facit.</Caption>
        </section>
      </div>
    </>
  );
}
