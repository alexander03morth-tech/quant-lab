import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric, type Tone } from "../../components/Metric";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Seg, Slider } from "../../components/Slider";
import { useFundamentals, type Fundamentals } from "../../lib/extra";
import { fmt, fmtPct } from "../../lib/format";
import { DEFAULT_LBO, maxPremium, runLbo, type LboInput } from "../../lib/pe/lbo";

const mdkr = (v: number, d = 1) => `${fmt(v / 1e9, d)} mdkr`;

export function LboView() {
  const fund = useFundamentals();
  const { ticker } = useParams();
  const navigate = useNavigate();
  const candidates = useMemo(() => Object.entries(fund?.items ?? {}).filter(([, f]) => f.lbo).sort((a, b) => a[1].name.localeCompare(b[1].name, "sv")), [fund]);
  // Standardval: det realistiskt stora bolag (EV < 200 mdkr) som en PE-köpare har råd att bjuda mest för
  const best = useMemo(() => {
    let top: string | undefined, val = -Infinity;
    for (const [k, f] of candidates) {
      if ((f.ev ?? 0) > 200e9) continue;
      const mp = maxPremium({ ...DEFAULT_LBO, ebitda0: f.ebitda!, revenue0: f.revenue!, marketCap: f.marketCap!, netDebt0: f.netDebt ?? 0, capexPct: f.capexPct ?? 0.05 }, 0.2) ?? -1;
      if (mp > val) { val = mp; top = k; }
    }
    return top;
  }, [candidates]);
  const t = ticker && fund?.items[ticker]?.lbo ? ticker : best ?? candidates[0]?.[0];
  if (fund === undefined) return <div className="plot-loading" style={{ minHeight: "40vh" }}>Laddar nyckeltal…</div>;
  if (!fund || !t) return <div className="notice"><span className="icon">!</span>Nyckeltal saknas – kör pipeline/fundamentals.py.</div>;
  return <LboModel key={t} t={t} f={fund.items[t]} candidates={candidates} onPick={(k) => navigate(`/pe/lbo/${k}`)} fetchedAt={fund.fetchedAt} />;
}

function LboModel({ t, f, candidates, onPick, fetchedAt }: { t: string; f: Fundamentals; candidates: [string, Fundamentals][]; onPick: (t: string) => void; fetchedAt: string }) {
  const g0 = Math.max(-0.05, Math.min(0.12, f.revenueGrowth ?? 0.04));
  const [p, setP] = useState({ ...DEFAULT_LBO, growth: Math.round(g0 * 200) / 200, capexPct: Math.round((f.capexPct ?? 0.05) * 200) / 200 });
  const [sameExit, setSameExit] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP((o) => ({ ...o, [k]: v }));

  const input: LboInput = { ...p, ebitda0: f.ebitda!, revenue0: f.revenue!, marketCap: f.marketCap!, netDebt0: f.netDebt ?? 0, exitMultiple: sameExit ? null : p.exitMultiple };
  const r = useMemo(() => runLbo(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxPrem = useMemo(() => maxPremium(input, 0.2), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3D: IRR över budpremie × exitmultipel
  const surf = useMemo(() => {
    const prem = Array.from({ length: 17 }, (_, i) => i * 0.05);
    const m0 = runLbo({ ...input, premium: 0 }).entryMultiple;
    const exits = Array.from({ length: 17 }, (_, i) => Math.max(3, m0 - 6 + i * 0.75));
    const z = exits.map((em) => prem.map((pr) => Math.max(-0.5, Math.min(0.8, runLbo({ ...input, premium: pr, exitMultiple: em }).irr))));
    return { prem, exits, z };
  }, [JSON.stringify({ ...input, premium: 0, exitMultiple: 0 })]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = { name: f.name, debt0: r.debt0, equityIn: r.equityIn, ev: f.ev, marketCap: f.marketCap, evEbitda: f.evEbitda, irr: r.irr, moic: r.moic, maxPrem };
  const irrTone: Tone = r.irr >= 0.2 ? "good" : r.irr >= 0.12 ? "mid" : "bad";
  const pos = cssVar("--pos"), neg = cssVar("--neg"), colA = cssVar("--series-a"), colB = cssVar("--series-b"), accent = cssVar("--accent");
  const exitM = r.exitMultiple;

  const years = ["Köp", ...r.years.map((y) => `År ${y.year}`)];
  const debtSeries = [r.debt0, ...r.years.map((y) => y.debt)];
  const evSeries = [r.entryEv, ...r.years.map((y) => exitM * y.ebitda)];
  const eqSeries = evSeries.map((ev, i) => ev - debtSeries[i] + (i ? r.years[i - 1].cash : 0));
  const capData: Data[] = [
    { type: "bar", name: "Skuld", x: years, y: debtSeries, marker: { color: neg }, hovertemplate: "%{x}: skuld %{y:,.3s} kr<extra></extra>" },
    { type: "bar", name: "Ägarnas värde", x: years, y: eqSeries, marker: { color: colA }, hovertemplate: "%{x}: eget kapital %{y:,.3s} kr<extra></extra>" },
    { type: "scatter", mode: "lines+markers", name: "Skuld / EBITDA", x: years, y: [r.debt0 / f.ebitda!, ...r.years.map((y) => y.leverage)], yaxis: "y2", line: { color: colB, width: 2 }, hovertemplate: "%{x}: %{y:.1f}× EBITDA<extra></extra>" },
  ];
  const b = r.bridge;
  const bridge: Data[] = [{
    type: "waterfall", orientation: "v",
    x: ["Insatt kapital", "EBITDA-tillväxt", "Multipel", "Amortering", "Avgifter", "Ut vid exit"],
    measure: ["absolute", "relative", "relative", "relative", "relative", "total"],
    y: [r.equityIn, b.ebitdaGrowth, b.multiple, b.deleveraging, b.fees, 0],
    text: [mdkr(r.equityIn), mdkr(b.ebitdaGrowth), mdkr(b.multiple), mdkr(b.deleveraging), mdkr(b.fees), mdkr(r.equityOut)],
    textposition: "outside", cliponaxis: false,
    increasing: { marker: { color: pos } }, decreasing: { marker: { color: neg } }, totals: { marker: { color: accent } },
    connector: { line: { color: cssVar("--border-strong"), width: 1, dash: "dot" } },
    customdata: ["Det fonden betalade in", "Värdet av att EBITDA växte, till samma multipel", "Effekten av att sälja till en annan multipel än man köpte", "Skuld som betalats av med bolagets kassaflöde", "Banker, rådgivare och advokater", "Det fonden får tillbaka"] as any,
    hovertemplate: "<b>%{x}</b>: %{text}<br><i>%{customdata}</i><extra></extra>",
  } as any];
  const surfData: Data[] = [
    { type: "surface", x: surf.prem, y: surf.exits, z: surf.z as any, colorscale: [[0, neg], [0.38, "#4a3434"], [0.5, cssVar("--surface-2")], [0.62, cssVar("--primary-strong")], [0.85, accent], [1, "#fff4e6"]], cmin: -0.5, cmax: 0.8,
      contours: { z: { show: true, start: 0.2, end: 0.2, size: 1, color: pos, width: 5 } } as any,
      lighting: { ambient: 0.55, diffuse: 0.7, specular: 0.4, roughness: 0.4 },
      colorbar: { thickness: 8, len: 0.55, tickformat: ".0%", title: { text: "IRR", side: "right", font: { size: 11 } }, tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") } } as any,
      hovertemplate: "Budpremie %{x:.0%} · exit %{y:.1f}×<br><b>IRR %{z:.1%}</b><extra></extra>" } as any,
    { type: "surface", x: [0, 0.8], y: [surf.exits[0], surf.exits[surf.exits.length - 1]], z: [[0.2, 0.2], [0.2, 0.2]], showscale: false, opacity: 0.16, colorscale: [[0, pos], [1, pos]], hoverinfo: "skip" } as any,
    { type: "scatter3d", mode: "markers+text", x: [p.premium], y: [exitM], z: [r.irr + 0.05], text: ["din kalkyl"], textposition: "top center", textfont: { color: cssVar("--text"), size: 12 }, marker: { size: 6, color: "#fff", line: { color: "#000", width: 1 } }, hovertemplate: `Din kalkyl: IRR ${fmtPct(r.irr, 1)}<extra></extra>` } as any,
  ];

  return (
    <>
      <div className="hero" style={{ marginBottom: 14 }}>
        <div>
          <div className="hero-kicker"><span>LBO-modell</span><span className="live">nyckeltal {fetchedAt.slice(0, 10)}</span></div>
          <h1 className="hero-title">Köp ut {f.name}</h1>
          <p className="hero-sub">Tänk dig att du är en PE-fond som köper hela {f.name} från börsen. Dra i reglagen och se vad du får för avkastning – och varifrån den kommer.</p>
          <label className="field" style={{ maxWidth: 280 }}>Bolag
            <select className="select" value={t} onChange={(e) => onPick(e.target.value)} aria-label="Välj bolag">
              {candidates.map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="hero-right">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div><div className="dim" style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}>IRR <Info id="irr" ctx={ctx} /></div><div className={`big-num ${r.irr >= 0.15 ? "pos" : "neg"}`}>{fmtPct(r.irr, 1)}</div></div>
            <div style={{ textAlign: "right" }}><div className="dim" style={{ fontSize: 12.5 }}>MOIC <Info id="moic" ctx={ctx} /></div><div className="num" style={{ fontSize: 30 }}>{fmt(r.moic, 2)}×</div></div>
          </div>
          <div className="dim" style={{ fontSize: 12.5 }}>
            {maxPrem == null ? "Ingen budpremie ger 20 % IRR med de här antagandena." : <>Max bud för 20 % IRR: <b className="num" style={{ color: "var(--text)" }}>{fmtPct(maxPrem, 0, true)}</b> över börskursen <Info id="max-bid" ctx={ctx} /></>}
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="metrics span-12">
          <Metric label="Köpeskilling (EV)" info="enterprise-value" ctx={ctx} value={mdkr(r.entryEv, 0)} sub={`börsvärde ${mdkr(f.marketCap!, 0)}`} />
          <Metric label="Inträdesmultipel" info="ev-ebitda" ctx={ctx} value={`${fmt(r.entryMultiple, 1)}×`} sub={`börsen idag ${fmt(f.evEbitda, 1)}×`} />
          <Metric label="Ny skuld" info="leverage-multiple" ctx={ctx} value={mdkr(r.debt0, 0)} sub={`${fmtPct(r.debt0 / (r.entryEv + r.fees), 0)} av finansieringen`} />
          <Metric label="Eget kapital in" info="lbo" ctx={ctx} value={mdkr(r.equityIn, 0)} />
          <Metric label="Räntetäckning år 1" info="interest-coverage" ctx={ctx} value={`${fmt(r.years[0].coverage, 1)}×`} tone={r.years[0].coverage >= 3 ? "good" : r.years[0].coverage >= 2 ? "mid" : "bad"} toneLabel={r.years[0].coverage >= 3 ? "bekvämt" : r.years[0].coverage >= 2 ? "ansträngt" : "farligt"} />
          <Metric label="IRR" info="irr" ctx={ctx} value={fmtPct(r.irr, 1)} tone={irrTone} toneLabel={r.irr >= 0.2 ? "över PE-mål" : r.irr >= 0.12 ? "svag" : "dålig affär"} />
        </div>
        {r.warnings.map((w) => <div key={w} className="notice span-12"><span className="icon">!</span>{w}</div>)}

        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Antaganden</h2><span className="dim" style={{ fontSize: 12 }}>Utgångsläge: EBITDA {mdkr(f.ebitda!)}, marginal {fmtPct(f.ebitdaMargin, 0)}, nettoskuld {mdkr(f.netDebt ?? 0)}{f.capexEstimated ? " · capex uppskattad" : ""}</span></div>
          <div className="card-body">
            <div className="grid" style={{ gap: "10px 22px" }}>
              <div className="span-3"><Slider label="Budpremie" info="bid-premium" ctx={ctx} value={p.premium} min={0} max={0.8} step={0.01} onChange={(v) => set("premium", v)} format={(v) => fmtPct(v, 0)} /></div>
              <div className="span-3"><Slider label="Skuld (× EBITDA)" info="leverage-multiple" ctx={ctx} value={p.leverage} min={0} max={7.5} step={0.25} onChange={(v) => set("leverage", v)} format={(v) => `${fmt(v, 2)}×`} /></div>
              <div className="span-3"><Slider label="Ränta på skulden" value={p.rate} min={0.03} max={0.13} step={0.0025} onChange={(v) => set("rate", v)} format={(v) => fmtPct(v, 1)} /></div>
              <div className="span-3"><Slider label="Innehavstid" value={p.years} min={3} max={8} step={1} onChange={(v) => set("years", v)} format={(v) => `${v} år`} /></div>
              <div className="span-3"><Slider label="Omsättningstillväxt / år" value={p.growth} min={-0.06} max={0.15} step={0.005} onChange={(v) => set("growth", v)} format={(v) => fmtPct(v, 1, true)} /></div>
              <div className="span-3"><Slider label="Marginalförbättring (totalt)" info="ebitda" ctx={ctx} value={p.marginDelta} min={-0.06} max={0.08} step={0.0025} onChange={(v) => set("marginDelta", v)} format={(v) => `${fmt(v * 100, 1)} pe`} /></div>
              <div className="span-3"><Slider label="Capex (% av omsättning)" info="cash-sweep" ctx={ctx} value={p.capexPct} min={0} max={0.2} step={0.005} onChange={(v) => set("capexPct", v)} format={(v) => fmtPct(v, 1)} /></div>
              <div className="span-3">
                {sameExit
                  ? <div className="slider"><div className="slider-head"><span className="label">Exitmultipel <Info id="multiple-expansion" ctx={ctx} /></span><span className="num">= inträde ({fmt(r.entryMultiple, 1)}×)</span></div><button className="btn" onClick={() => { setSameExit(false); set("exitMultiple", Math.round(r.entryMultiple * 4) / 4); }}>Ändra exitmultipel</button></div>
                  : <><Slider label="Exitmultipel" info="multiple-expansion" ctx={ctx} value={p.exitMultiple ?? r.entryMultiple} min={3} max={30} step={0.25} onChange={(v) => set("exitMultiple", v)} format={(v) => `${fmt(v, 2)}×`} /><button className="btn" style={{ marginTop: 4 }} onClick={() => setSameExit(true)}>Samma som inträde</button></>}
              </div>
            </div>
          </div>
        </section>

        <section className="card span-6">
          <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Skulden betalas av <Info id="cash-sweep" ctx={ctx} /></h2></div>
          <div className="card-body"><Plot ariaLabel="Skuld och ägarnas värde år för år" data={capData} height={300} layout={{ barmode: "stack", hovermode: "closest", yaxis: { tickformat: ".2s", side: "left" } as any, yaxis2: { overlaying: "y", side: "right", ticksuffix: "×", tickformat: ".1f", showgrid: false } as any, xaxis: { type: "category" } as any }} /></div>
          <Caption>Röd = lånen, koppar = det ägarna äger. Varje år används bolagets kassaflöde till att betala av lånen, så <b>den röda delen krymper och den kopparfärgade växer</b> – även om bolaget inte växer alls. Blå linje = skuld i antal års EBITDA.</Caption>
        </section>

        <section className="card span-6">
          <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Varifrån kommer vinsten? <Info id="value-creation-bridge" ctx={ctx} /></h2></div>
          <div className="card-body"><Plot ariaLabel="Värdeskapandebrygga från insatt till utbetalt kapital" data={bridge} height={300} layout={{ hovermode: "closest", yaxis: { tickformat: ".2s", side: "left" } as any, xaxis: { type: "category" } as any, margin: { l: 8, r: 8, t: 24, b: 8 } }} /></div>
          <Caption>Från det fonden satte in (vänster) till det den får tillbaka (höger). Gröna staplar ökar värdet, röda minskar. <b>Den bästa vinsten kommer från EBITDA-tillväxt</b> – multipeln beror mer på marknaden än på fonden.</Caption>
        </section>

        <section className="card span-12 lab3d">
          <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Känslighet i 3D: budpremie × exitmultipel <Info id="irr" ctx={ctx} /></h2><span className="dim" style={{ fontSize: 12 }}>dra för att rotera</span></div>
          <div className="card-body"><Plot ariaLabel="3D-yta: IRR som funktion av budpremie och exitmultipel" data={surfData} height={520}
            layout={scene3d({ x: "Budpremie", y: "Exitmultipel (×)", z: "IRR" }, { xaxis: { tickformat: ".0%" }, zaxis: { tickformat: ".0%" }, camera: { eye: { x: 1.5, y: -1.4, z: 0.8 } } } as any)} /></div>
          <Caption>Varje punkt är hela LBO-kalkylen med en viss budpremie och exitmultipel. Det gröna glasplanet är 20 % IRR – PE-fondernas typiska mål. <b>Allt ovanför planet är en affär värd att göra.</b> Lägg märke till hur mycket mer IRR beror på exitmultipeln än på premien: att sälja till rätt pris är avgörande.</Caption>
        </section>

        <section className="card span-12">
          <div className="card-head">
            <h2 className="card-title"><span className="idx">05</span>Kassaflöde år för år</h2>
            <Seg label="Visa tabell" value={showTable ? "y" : "n"} onChange={(v) => setShowTable(v === "y")} options={[{ value: "n", label: "Dölj" }, { value: "y", label: "Visa" }]} />
          </div>
          {showTable && (
            <div className="card-body" style={{ overflowX: "auto" }}>
              <table className="data">
                <thead><tr><th>mdkr</th>{r.years.map((y) => <th key={y.year} className="num">År {y.year}</th>)}</tr></thead>
                <tbody>
                  {([["Omsättning", "revenue"], ["EBITDA", "ebitda"], ["− Avskrivningar", "da"], ["= Rörelseresultat (EBIT)", "ebit"], ["− Ränta", "interest"], ["− Skatt", "tax"], ["− Capex", "capex"], ["− Ökat rörelsekapital", "dNwc"], ["= Fritt kassaflöde", "fcf"], ["Skuld vid årets slut", "debt"]] as const).map(([lab, k]) => (
                    <tr key={k}><td className={lab.startsWith("=") ? "" : "muted"}>{lab}</td>{r.years.map((y) => <td key={y.year} className="num">{fmt(y[k] / 1e9, 1)}</td>)}</tr>
                  ))}
                  <tr><td className="muted">EBITDA-marginal</td>{r.years.map((y) => <td key={y.year} className="num dim">{fmtPct(y.margin, 1)}</td>)}</tr>
                </tbody>
              </table>
              <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>Förenklad modell: avskrivningar = capex, ingen utdelning under innehavet, skatt 20,6 %, avgifter 2 % av EV. Nyckeltal från Yahoo Finance – kontrollera mot årsredovisningen innan du drar slutsatser.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
