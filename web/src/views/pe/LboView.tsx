import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric, type Tone } from "../../components/Metric";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Seg, Slider } from "../../components/Slider";
import { fmt, fmtPct } from "../../lib/format";
import { DEFAULT_LBO, maxEntryMultiple, runLbo, type LboInput } from "../../lib/pe/lbo";

/**
 * Påhittade exempelbolag med siffror som är typiska för respektive bransch (mkr).
 * Avsiktligt inte riktiga bolag – poängen är att lära sig hur kalkylen fungerar.
 */
interface Case { id: string; name: string; blurb: string; revenue: number; margin: number; entry: number; growth: number; marginDelta: number; capex: number; leverage: number }
const CASES: Case[] = [
  { id: "industri", name: "Nischad industritillverkare", blurb: "Stabil, lönsam, låg tillväxt. Klassiskt LBO-bolag: förutsägbara kassaflöden att betala skulden med.", revenue: 2000, margin: 0.16, entry: 9, growth: 0.04, marginDelta: 0.02, capex: 0.04, leverage: 5 },
  { id: "saas", name: "Mjukvarubolag (B2B SaaS)", blurb: "Hög tillväxt och hög marginal, men dyrt i inköp. Avkastningen måste komma från tillväxt, inte skuld.", revenue: 800, margin: 0.28, entry: 16, growth: 0.15, marginDelta: 0.05, capex: 0.03, leverage: 6 },
  { id: "tandvard", name: "Tandvårdskedja (buy-and-build)", blurb: "Plattform som köper upp små kliniker. Tillväxten kommer från tilläggsförvärv.", revenue: 1500, margin: 0.18, entry: 11, growth: 0.09, marginDelta: 0.02, capex: 0.05, leverage: 5.5 },
  { id: "konsument", name: "Konsumentvarumärke", blurb: "Känt varumärke med stabil efterfrågan men konjunkturkänsligt. Marginalen är nyckeln.", revenue: 3000, margin: 0.12, entry: 10, growth: 0.03, marginDelta: 0.015, capex: 0.03, leverage: 4.5 },
];

const mkr = (v: number) => `${fmt(v, v >= 10000 ? 0 : v >= 100 ? 0 : 1)} mkr`;

export function LboView() {
  const [sp, setSp] = useSearchParams();
  const caseId = sp.get("bolag") ?? "industri";
  const c = CASES.find((x) => x.id === caseId);
  const [custom, setCustom] = useState({ revenue: 1000, ebitda: 150, entry: 10 });
  const pick = (id: string) => setSp(id === "industri" ? {} : { bolag: id }, { replace: true });
  const base = c ? { revenue: c.revenue, ebitda: c.revenue * c.margin } : { revenue: custom.revenue, ebitda: custom.ebitda };
  return (
    <>
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>LBO-modell</span><span className="live">påhittade exempelbolag</span></div>
          <h1 className="hero-title">Var PE-fonden för en dag</h1>
          <p className="hero-sub">Välj ett bolag att köpa, bestäm hur mycket du betalar och lånar, och se om affären når fondens mål på 20 % per år. Exempelbolagen är påhittade men har siffror som är typiska för sin bransch – eller mata in ett eget.</p>
          <div className="case-grid">
            {CASES.map((x) => (
              <button key={x.id} className="case" aria-pressed={x.id === caseId} onClick={() => pick(x.id)}>
                <b>{x.name}</b><span>{x.blurb}</span>
                <span className="num dim">{mkr(x.revenue)} oms · {fmtPct(x.margin, 0)} marg · {fmt(x.entry, 0)}×</span>
              </button>
            ))}
            <button className="case" aria-pressed={!c} onClick={() => pick("eget")}><b>Eget bolag</b><span>Mata in egna siffror, t.ex. från ett case du jobbar med.</span><span className="num dim">valfritt</span></button>
          </div>
          {!c && (
            <div className="row" style={{ marginTop: 12 }}>
              {([["revenue", "Omsättning (mkr)"], ["ebitda", "EBITDA (mkr)"], ["entry", "Inträdesmultipel (× EBITDA)"]] as const).map(([k, lab]) => (
                <label key={k} className="field">{lab}
                  <input className="select num" style={{ backgroundImage: "none", width: 170, padding: "6px 10px" }} type="number" min={0.1} step={k === "entry" ? 0.5 : 10}
                    value={custom[k]} onChange={(e) => setCustom((o) => ({ ...o, [k]: Math.max(0.1, Number(e.target.value) || 0.1) }))} />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <LboModel key={c?.id ?? `eget-${custom.revenue}-${custom.ebitda}-${custom.entry}`} name={c?.name ?? "Eget bolag"} base={base}
        init={c ? { entry: c.entry, growth: c.growth, marginDelta: c.marginDelta, capex: c.capex, leverage: c.leverage } : { entry: custom.entry, growth: 0.04, marginDelta: 0.01, capex: 0.04, leverage: 5 }} />
    </>
  );
}

function LboModel({ name, base, init }: { name: string; base: { revenue: number; ebitda: number }; init: { entry: number; growth: number; marginDelta: number; capex: number; leverage: number } }) {
  const [p, setP] = useState({ ...DEFAULT_LBO, entryMultiple: init.entry, growth: init.growth, marginDelta: init.marginDelta, capexPct: init.capex, leverage: init.leverage });
  const [sameExit, setSameExit] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP((o) => ({ ...o, [k]: v }));
  const input: LboInput = { ...p, ebitda0: base.ebitda, revenue0: base.revenue, exitMultiple: sameExit ? null : p.exitMultiple };
  const key = JSON.stringify(input);
  const r = useMemo(() => runLbo(input), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxM = useMemo(() => maxEntryMultiple(input, 0.2), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3D: IRR över inträdes- × exitmultipel (den klassiska PE-känslighetstabellen, fast i 3D)
  const surf = useMemo(() => {
    const ent = Array.from({ length: 17 }, (_, i) => Math.max(3, init.entry - 6 + i * 0.75));
    const exits = Array.from({ length: 17 }, (_, i) => Math.max(3, init.entry - 6 + i * 0.75));
    const z = exits.map((em) => ent.map((en) => Math.max(-0.5, Math.min(0.8, runLbo({ ...input, entryMultiple: en, exitMultiple: em }).irr))));
    return { ent, exits, z };
  }, [JSON.stringify({ ...input, entryMultiple: 0, exitMultiple: 0 })]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = { name, debt0: r.debt0, equityIn: r.equityIn, irr: r.irr, moic: r.moic, maxEntry: maxM, entry: r.entryMultiple };
  const irrTone: Tone = r.irr >= 0.2 ? "good" : r.irr >= 0.12 ? "mid" : "bad";
  const pos = cssVar("--pos"), neg = cssVar("--neg"), colA = cssVar("--series-a"), colB = cssVar("--series-b"), accent = cssVar("--accent");
  const exitM = r.exitMultiple;
  const years = ["Köp", ...r.years.map((y) => `År ${y.year}`)];
  const debtSeries = [r.debt0, ...r.years.map((y) => y.debt)];
  const evSeries = [r.entryEv, ...r.years.map((y) => exitM * y.ebitda)];
  const eqSeries = evSeries.map((ev, i) => ev - debtSeries[i] + (i ? r.years[i - 1].cash : 0));
  const capData: Data[] = [
    { type: "bar", name: "Skuld", x: years, y: debtSeries, marker: { color: neg }, hovertemplate: "%{x}: skuld %{y:,.0f} mkr<extra></extra>" },
    { type: "bar", name: "Ägarnas värde", x: years, y: eqSeries, marker: { color: colA }, hovertemplate: "%{x}: eget kapital %{y:,.0f} mkr<extra></extra>" },
    { type: "scatter", mode: "lines+markers", name: "Skuld / EBITDA", x: years, y: [r.debt0 / base.ebitda, ...r.years.map((y) => y.leverage)], yaxis: "y2", line: { color: colB, width: 2 }, hovertemplate: "%{x}: %{y:.1f}× EBITDA<extra></extra>" },
  ];
  const b = r.bridge;
  const bridge: Data[] = [{
    type: "waterfall", orientation: "v",
    x: ["Insatt", "EBITDA-tillväxt", "Multipel", "Amortering", "Avgifter", "Ut vid exit"],
    measure: ["absolute", "relative", "relative", "relative", "relative", "total"],
    y: [r.equityIn, b.ebitdaGrowth, b.multiple, b.deleveraging, b.fees, 0],
    text: [r.equityIn, b.ebitdaGrowth, b.multiple, b.deleveraging, b.fees, r.equityOut].map(mkr), textposition: "outside", cliponaxis: false,
    increasing: { marker: { color: pos } }, decreasing: { marker: { color: neg } }, totals: { marker: { color: accent } },
    connector: { line: { color: cssVar("--border-strong"), width: 1, dash: "dot" } },
    customdata: ["Det fonden betalade in", "Värdet av att EBITDA växte, till samma multipel", "Effekten av att sälja till en annan multipel än man köpte", "Skuld som betalats av med bolagets kassaflöde", "Banker, rådgivare och advokater", "Det fonden får tillbaka"] as any,
    hovertemplate: "<b>%{x}</b>: %{text}<br><i>%{customdata}</i><extra></extra>",
  } as any];
  const surfData: Data[] = [
    { type: "surface", x: surf.ent, y: surf.exits, z: surf.z as any, colorscale: [[0, neg], [0.38, "#4a3434"], [0.5, cssVar("--surface-2")], [0.62, cssVar("--primary-strong")], [0.85, accent], [1, "#fff4e6"]], cmin: -0.5, cmax: 0.8,
      contours: { z: { show: true, start: 0.2, end: 0.2, size: 1, color: pos, width: 5 } } as any,
      lighting: { ambient: 0.55, diffuse: 0.7, specular: 0.4, roughness: 0.4 },
      colorbar: { thickness: 8, len: 0.55, tickformat: ".0%", title: { text: "IRR", side: "right", font: { size: 11 } }, tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") } } as any,
      hovertemplate: "Köp %{x:.1f}× · sälj %{y:.1f}×<br><b>IRR %{z:.1%}</b><extra></extra>" } as any,
    { type: "surface", x: [surf.ent[0], surf.ent[16]], y: [surf.exits[0], surf.exits[16]], z: [[0.2, 0.2], [0.2, 0.2]], showscale: false, opacity: 0.16, colorscale: [[0, pos], [1, pos]], hoverinfo: "skip" } as any,
    { type: "scatter3d", mode: "markers+text", x: [r.entryMultiple], y: [exitM], z: [r.irr + 0.05], text: ["din kalkyl"], textposition: "top center", textfont: { color: cssVar("--text"), size: 12 }, marker: { size: 6, color: "#fff", line: { color: "#000", width: 1 } }, hovertemplate: `Din kalkyl: IRR ${fmtPct(r.irr, 1)}<extra></extra>` } as any,
  ];

  return (
    <div className="grid">
      <div className="lbo-result span-12">
        <div><div className="dim" style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}>IRR <Info id="irr" ctx={ctx} /></div><div className={`big-num ${r.irr >= 0.15 ? "pos" : "neg"}`}>{fmtPct(r.irr, 1)}</div></div>
        <div><div className="dim" style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}>MOIC <Info id="moic" ctx={ctx} /></div><div className="big-num" style={{ textShadow: "none" }}>{fmt(r.moic, 2)}×</div></div>
        <div className="muted" style={{ fontSize: 14, maxWidth: 420 }}>
          {maxM == null ? "Ingen inträdesmultipel ger 20 % IRR med de här antagandena." : <>För att nå fondens mål på 20 % per år får du betala högst <b className="num" style={{ color: "var(--text)" }}>{fmt(maxM, 1)}× EBITDA</b> ({mkr(maxM * base.ebitda)}). <Info id="max-bid" ctx={ctx} /></>}
        </div>
      </div>
      <div className="metrics span-12">
        <Metric label="Köpeskilling (EV)" info="enterprise-value" ctx={ctx} value={mkr(r.entryEv)} sub={`${fmt(r.entryMultiple, 1)}× EBITDA ${mkr(base.ebitda)}`} />
        <Metric label="Ny skuld" info="leverage-multiple" ctx={ctx} value={mkr(r.debt0)} sub={`${fmtPct(r.debt0 / (r.entryEv + r.fees), 0)} av finansieringen`} />
        <Metric label="Eget kapital in" info="lbo" ctx={ctx} value={mkr(r.equityIn)} />
        <Metric label="Eget kapital ut" info="moic" ctx={ctx} value={mkr(r.equityOut)} sub={`efter ${p.years} år`} />
        <Metric label="Räntetäckning år 1" info="interest-coverage" ctx={ctx} value={`${fmt(r.years[0].coverage, 1)}×`} tone={r.years[0].coverage >= 3 ? "good" : r.years[0].coverage >= 2 ? "mid" : "bad"} toneLabel={r.years[0].coverage >= 3 ? "bekvämt" : r.years[0].coverage >= 2 ? "ansträngt" : "farligt"} />
        <Metric label="IRR" info="irr" ctx={ctx} value={fmtPct(r.irr, 1)} tone={irrTone} toneLabel={r.irr >= 0.2 ? "över fondens mål" : r.irr >= 0.12 ? "svag" : "dålig affär"} />
      </div>
      {r.warnings.map((w) => <div key={w} className="notice span-12"><span className="icon">!</span>{w}</div>)}

      <section className="card span-12">
        <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Antaganden</h2><span className="dim" style={{ fontSize: 12 }}>{name}: omsättning {mkr(base.revenue)}, EBITDA {mkr(base.ebitda)} ({fmtPct(base.ebitda / base.revenue, 0)})</span></div>
        <div className="card-body">
          <div className="grid" style={{ gap: "10px 22px" }}>
            <div className="span-3"><Slider label="Inträdesmultipel (pris)" info="ev-ebitda" ctx={ctx} value={p.entryMultiple} min={4} max={25} step={0.25} onChange={(v) => set("entryMultiple", v)} format={(v) => `${fmt(v, 2)}×`} /></div>
            <div className="span-3"><Slider label="Skuld (× EBITDA)" info="leverage-multiple" ctx={ctx} value={p.leverage} min={0} max={7.5} step={0.25} onChange={(v) => set("leverage", v)} format={(v) => `${fmt(v, 2)}×`} /></div>
            <div className="span-3"><Slider label="Ränta på skulden" value={p.rate} min={0.03} max={0.13} step={0.0025} onChange={(v) => set("rate", v)} format={(v) => fmtPct(v, 1)} /></div>
            <div className="span-3"><Slider label="Innehavstid" value={p.years} min={3} max={8} step={1} onChange={(v) => set("years", v)} format={(v) => `${v} år`} /></div>
            <div className="span-3"><Slider label="Omsättningstillväxt / år" value={p.growth} min={-0.06} max={0.2} step={0.005} onChange={(v) => set("growth", v)} format={(v) => fmtPct(v, 1, true)} /></div>
            <div className="span-3"><Slider label="Marginalförbättring (totalt)" info="ebitda" ctx={ctx} value={p.marginDelta} min={-0.06} max={0.1} step={0.0025} onChange={(v) => set("marginDelta", v)} format={(v) => `${fmt(v * 100, 1)} pe`} /></div>
            <div className="span-3"><Slider label="Capex (% av omsättning)" info="cash-sweep" ctx={ctx} value={p.capexPct} min={0} max={0.2} step={0.005} onChange={(v) => set("capexPct", v)} format={(v) => fmtPct(v, 1)} /></div>
            <div className="span-3">
              {sameExit
                ? <div className="slider"><div className="slider-head"><span className="label">Exitmultipel <Info id="multiple-expansion" ctx={ctx} /></span><span className="num">= inträde</span></div><button className="btn" onClick={() => { setSameExit(false); set("exitMultiple", p.entryMultiple); }}>Ändra exitmultipel</button></div>
                : <><Slider label="Exitmultipel" info="multiple-expansion" ctx={ctx} value={p.exitMultiple ?? p.entryMultiple} min={3} max={30} step={0.25} onChange={(v) => set("exitMultiple", v)} format={(v) => `${fmt(v, 2)}×`} /><button className="btn" style={{ marginTop: 4 }} onClick={() => setSameExit(true)}>Samma som inträde</button></>}
            </div>
          </div>
        </div>
      </section>

      <section className="card span-6">
        <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Skulden betalas av <Info id="cash-sweep" ctx={ctx} /></h2></div>
        <div className="card-body"><Plot ariaLabel="Skuld och ägarnas värde år för år" data={capData} height={300} layout={{ barmode: "stack", hovermode: "closest", yaxis: { tickformat: ",.0f", side: "left" } as any, yaxis2: { overlaying: "y", side: "right", ticksuffix: "×", tickformat: ".1f", showgrid: false } as any, xaxis: { type: "category" } as any }} /></div>
        <Caption>Röd = lånen, koppar = det ägarna äger (mkr). Varje år används bolagets kassaflöde till att betala av lånen, så <b>den röda delen krymper och den kopparfärgade växer</b> – även om bolaget inte växer alls. Blå linje = skuld i antal års EBITDA.</Caption>
      </section>
      <section className="card span-6">
        <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Varifrån kommer vinsten? <Info id="value-creation-bridge" ctx={ctx} /></h2></div>
        <div className="card-body"><Plot ariaLabel="Värdeskapandebrygga från insatt till utbetalt kapital" data={bridge} height={300} layout={{ hovermode: "closest", yaxis: { tickformat: ",.0f", side: "left" } as any, xaxis: { type: "category" } as any, margin: { l: 8, r: 8, t: 24, b: 8 } }} /></div>
        <Caption>Från det fonden satte in (vänster) till det den får tillbaka (höger). Gröna staplar ökar värdet, röda minskar. <b>Den bästa vinsten kommer från EBITDA-tillväxt</b> – multipeln beror mer på marknaden än på fonden.</Caption>
      </section>

      <section className="card span-12 lab3d">
        <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Köp- och säljpris i 3D <Info id="irr" ctx={ctx} /></h2><span className="dim" style={{ fontSize: 12 }}>dra för att rotera</span></div>
        <div className="card-body"><Plot ariaLabel="3D-yta: IRR som funktion av inträdes- och exitmultipel" data={surfData} height={520}
          layout={scene3d({ x: "Köppris (× EBITDA)", y: "Säljpris (× EBITDA)", z: "IRR" }, { zaxis: { tickformat: ".0%" }, camera: { eye: { x: 1.5, y: -1.4, z: 0.8 } } } as any)} /></div>
        <Caption>Varje punkt är hela kalkylen med ett visst köppris och säljpris. Det gröna glasplanet är 20 % IRR. <b>Allt ovanför planet är en affär värd att göra.</b> Diagonalen (köp och sälj till samma multipel) visar vad bolaget och skuldavbetalningen ger av egen kraft – avvikelser från den är ren marknadstur eller otur.</Caption>
      </section>

      <section className="card span-12">
        <div className="card-head">
          <h2 className="card-title"><span className="idx">05</span>Kassaflöde år för år</h2>
          <Seg label="Visa tabell" value={showTable ? "y" : "n"} onChange={(v) => setShowTable(v === "y")} options={[{ value: "n", label: "Dölj" }, { value: "y", label: "Visa" }]} />
        </div>
        {showTable && (
          <div className="card-body" style={{ overflowX: "auto" }}>
            <table className="data">
              <thead><tr><th>mkr</th>{r.years.map((y) => <th key={y.year} className="num">År {y.year}</th>)}</tr></thead>
              <tbody>
                {([["Omsättning", "revenue"], ["EBITDA", "ebitda"], ["− Avskrivningar", "da"], ["= Rörelseresultat (EBIT)", "ebit"], ["− Ränta", "interest"], ["− Skatt", "tax"], ["− Capex", "capex"], ["− Ökat rörelsekapital", "dNwc"], ["= Fritt kassaflöde", "fcf"], ["Skuld vid årets slut", "debt"]] as const).map(([lab, k]) => (
                  <tr key={k}><td className={lab.startsWith("=") ? "" : "muted"}>{lab}</td>{r.years.map((y) => <td key={y.year} className="num">{fmt(y[k], 0)}</td>)}</tr>
                ))}
                <tr><td className="muted">EBITDA-marginal</td>{r.years.map((y) => <td key={y.year} className="num dim">{fmtPct(y.margin, 1)}</td>)}</tr>
              </tbody>
            </table>
            <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>Förenklad modell: avskrivningar = capex, ingen utdelning under innehavet, skatt 20,6 %, avgifter 2 % av EV, rörelsekapital 10 % av omsättningsökningen.</p>
          </div>
        )}
      </section>
    </div>
  );
}
