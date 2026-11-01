import { useMemo, useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric } from "../../components/Metric";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Slider } from "../../components/Slider";
import { fmt, fmtPct } from "../../lib/format";
import { DEFAULT_FUND, runFund, type FundInput } from "../../lib/pe/fund";

const mdkr = (v: number) => `${fmt(v / 1e9, 1)} mdkr`;

export function FundView() {
  const [p, setP] = useState<FundInput>(DEFAULT_FUND);
  const set = <K extends keyof FundInput>(k: K, v: FundInput[K]) => setP((o) => ({ ...o, [k]: v }));
  const r = useMemo(() => runFund(p), [p]);
  const surf = useMemo(() => {
    const moics = Array.from({ length: 16 }, (_, i) => 1 + i * 0.2);
    const holds = [3, 4, 5, 6, 7, 8];
    const z = holds.map((h) => moics.map((m) => { const v = runFund({ ...p, grossMoic: m, hold: h }).netIrr; return Number.isFinite(v) ? v : null; }));
    return { moics, holds, z };
  }, [p.feePct, p.carry, p.hurdle, p.deployYears, p.size, p.life]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = cssVar("--pos"), neg = cssVar("--neg"), accent = cssVar("--accent"), colB = cssVar("--series-b");
  const yrs = r.years.map((y) => `År ${y.year}`);
  const profit = r.distributedLp + r.carryGp - r.contributed + r.feesTotal; // bruttovinst före avgifter
  const ctx = { netIrr: r.netIrr, grossIrr: r.grossIrr, tvpi: r.tvpi, carry: r.carryGp, fees: r.feesTotal };

  const jData: Data[] = [
    { type: "bar", name: "Inbetalt (investeringar + avgifter)", x: yrs, y: r.years.map((y) => -y.calls / 1e9), marker: { color: neg }, hovertemplate: "%{x}: investerarna betalar in %{y:.2f} mdkr<extra></extra>" },
    { type: "bar", name: "Utbetalt till investerarna", x: yrs, y: r.years.map((y) => y.toLp / 1e9), marker: { color: pos }, hovertemplate: "%{x}: investerarna får %{y:.2f} mdkr<extra></extra>" },
    { type: "scatter", mode: "lines+markers", name: "Kumulativt netto (J-kurvan)", x: yrs, y: r.years.map((y) => y.netCum / 1e9), line: { color: accent, width: 3 }, marker: { size: 7 },
      customdata: r.years.map((y) => (y.netCum < 0 ? "investerarna ligger fortfarande på minus" : "investerarna har fått tillbaka mer än de satt in")) as any,
      hovertemplate: "%{x}: %{y:+.2f} mdkr<br><i>%{customdata}</i><extra></extra>" },
  ];
  const split: Data[] = [{
    type: "bar", orientation: "h", y: ["Avgifter till PE-bolaget", "Carry till PE-bolaget", "Vinst till investerarna"],
    x: [r.feesTotal / 1e9, r.carryGp / 1e9, (r.distributedLp - r.contributed) / 1e9],
    marker: { color: [colB, accent, pos] }, text: [r.feesTotal, r.carryGp, r.distributedLp - r.contributed].map((v) => `${mdkr(v)} (${fmtPct(v / Math.max(1, profit), 0)})`),
    textposition: "outside", cliponaxis: false, hovertemplate: "%{y}: %{x:.2f} mdkr<extra></extra>",
  } as any];
  const surfData: Data[] = [
    { type: "surface", x: surf.moics, y: surf.holds, z: surf.z as any, colorscale: [[0, neg], [0.3, "#4a3434"], [0.42, cssVar("--surface-2")], [0.65, cssVar("--primary-strong")], [1, "#fff4e6"]], cmin: -0.15, cmax: 0.35,
      contours: { z: { show: true, start: 0.15, end: 0.15, size: 1, color: pos, width: 5 } } as any,
      colorbar: { thickness: 8, len: 0.55, tickformat: ".0%", title: { text: "Netto-IRR", side: "right", font: { size: 11 } }, tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") } } as any,
      lighting: { ambient: 0.55, diffuse: 0.7, specular: 0.4, roughness: 0.4 },
      hovertemplate: "Brutto %{x:.1f}× · %{y} års innehav<br><b>Netto-IRR %{z:.1%}</b><extra></extra>" } as any,
    { type: "scatter3d", mode: "markers+text", x: [p.grossMoic], y: [p.hold], z: [r.netIrr + 0.02], text: ["din fond"], textposition: "top center", textfont: { color: cssVar("--text"), size: 12 }, marker: { size: 6, color: "#fff", line: { color: "#000", width: 1 } }, hoverinfo: "skip" } as any,
  ];

  return (
    <>
      <div className="hero" style={{ marginBottom: 14 }}>
        <div>
          <div className="hero-kicker"><span>Fondekonomi</span><span className="live">ur investerarens perspektiv</span></div>
          <h1 className="hero-title">Vem tjänar vad i en PE-fond?</h1>
          <p className="hero-sub">En pensionsfond lovar pengar till en PE-fond. Följ pengarna: när de betalas in, när de kommer tillbaka och hur vinsten delas mellan investerarna och PE-bolaget.</p>
        </div>
        <div className="hero-right">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div><div className="dim" style={{ fontSize: 12.5 }}>Netto-IRR till investerarna <Info id="gross-net" ctx={ctx} /></div><div className={`big-num ${r.netIrr >= 0.12 ? "pos" : "neg"}`}>{fmtPct(r.netIrr, 1)}</div></div>
            <div style={{ textAlign: "right" }}><div className="dim" style={{ fontSize: 12.5 }}>Brutto-IRR</div><div className="num" style={{ fontSize: 28 }}>{fmtPct(r.grossIrr, 1)}</div></div>
          </div>
          <div className="dim" style={{ fontSize: 13 }}>Skillnaden – <b style={{ color: "var(--text)" }}>{fmt((r.grossIrr - r.netIrr) * 100, 1)} procentenheter per år</b> – är vad avgifter och carry kostar investerarna.</div>
        </div>
      </div>
      <div className="grid">
        <div className="metrics span-12">
          <Metric label="Fondstorlek" value={mdkr(p.size)} sub="utlovat kapital" info="private-equity" />
          <Metric label="TVPI (netto)" info="tvpi" ctx={ctx} value={`${fmt(r.tvpi, 2)}×`} sub="pengar tillbaka per insatt krona" />
          <Metric label="Avgifter totalt" info="management-fee" ctx={ctx} value={mdkr(r.feesTotal)} sub={fmtPct(r.feesTotal / p.size, 0) + " av fonden"} />
          <Metric label="Carry till PE-bolaget" info="carried-interest" ctx={ctx} value={mdkr(r.carryGp)} />
          <Metric label="Djupaste läget" info="j-curve" ctx={ctx} value={mdkr(r.trough)} sub={r.breakevenYear ? `plus igen år ${r.breakevenYear}` : "blir aldrig plus"} />
        </div>

        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Antaganden</h2></div>
          <div className="card-body">
            <div className="grid" style={{ gap: "10px 22px" }}>
              <div className="span-3"><Slider label="Brutto-MOIC på affärerna" info="moic" ctx={ctx} value={p.grossMoic} min={0.6} max={4} step={0.05} onChange={(v) => set("grossMoic", v)} format={(v) => `${fmt(v, 2)}×`} /></div>
              <div className="span-3"><Slider label="Innehavstid per bolag" value={p.hold} min={2} max={8} step={1} onChange={(v) => set("hold", v)} format={(v) => `${v} år`} /></div>
              <div className="span-3"><Slider label="Förvaltningsavgift / år" info="management-fee" ctx={ctx} value={p.feePct} min={0} max={0.03} step={0.0025} onChange={(v) => set("feePct", v)} format={(v) => fmtPct(v, 2)} /></div>
              <div className="span-3"><Slider label="Carry (vinstandel)" info="carried-interest" ctx={ctx} value={p.carry} min={0} max={0.3} step={0.01} onChange={(v) => set("carry", v)} format={(v) => fmtPct(v, 0)} /></div>
              <div className="span-3"><Slider label="Hurdle (preferensavkastning)" info="hurdle-rate" ctx={ctx} value={p.hurdle} min={0} max={0.12} step={0.005} onChange={(v) => set("hurdle", v)} format={(v) => fmtPct(v, 1)} /></div>
              <div className="span-3"><Slider label="Investeringsperiod" value={p.deployYears} min={2} max={6} step={1} onChange={(v) => set("deployYears", v)} format={(v) => `${v} år`} /></div>
            </div>
          </div>
        </section>

        <section className="card span-7">
          <div className="card-head"><h2 className="card-title"><span className="idx">02</span>J-kurvan <Info id="j-curve" ctx={ctx} /></h2></div>
          <div className="card-body"><Plot ariaLabel="Fondens kassaflöden år för år och kumulativt netto" data={jData} height={320} layout={{ barmode: "relative", hovermode: "closest", yaxis: { ticksuffix: " md", side: "left", zeroline: true } as any, xaxis: { type: "category" } as any }} /></div>
          <Caption>Röda staplar = pengar investerarna betalar in, gröna = pengar de får tillbaka. Den kopparfärgade linjen är summan hittills. <b>Den dyker först (avgifter och köp) och vänder sedan uppåt när bolagen säljs</b> – därav namnet J-kurvan. Därför kräver PE tålamod.</Caption>
        </section>
        <section className="card span-5">
          <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Hur vinsten delas <Info id="carried-interest" ctx={ctx} /></h2></div>
          <div className="card-body"><Plot ariaLabel="Fördelning av fondens bruttovinst" data={split} height={320} layout={{ hovermode: "closest", xaxis: { ticksuffix: " md" } as any, yaxis: { side: "left", automargin: true } as any, margin: { l: 8, r: 90, t: 8, b: 8 } }} /></div>
          <Caption>Av allt fonden tjänar på sina bolag går en del till PE-bolaget som avgifter (oavsett resultat) och som <b>carry</b> (bara om det går bra). Resten är investerarnas vinst. Procenten är andel av bruttovinsten.</Caption>
        </section>

        <section className="card span-12 lab3d">
          <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Netto-IRR i 3D: hur bra affärer × hur snabbt <Info id="gross-net" ctx={ctx} /></h2><span className="dim" style={{ fontSize: 12 }}>dra för att rotera</span></div>
          <div className="card-body"><Plot ariaLabel="3D-yta: investerarnas netto-IRR över brutto-MOIC och innehavstid" data={surfData} height={500}
            layout={scene3d({ x: "Brutto-MOIC (×)", y: "Innehavstid (år)", z: "Netto-IRR" }, { zaxis: { tickformat: ".0%" }, camera: { eye: { x: 1.4, y: -1.5, z: 0.8 } } } as any)} /></div>
          <Caption>Varje punkt är en hel fond med en viss avkastning på affärerna och en viss innehavstid. Den gröna linjen är 15 % netto – ungefär vad pensionsfonder hoppas på. <b>Samma MOIC ger mycket lägre IRR om det tar längre tid</b>, och under ca 1,3× brutto äter avgifterna upp nästan allt.</Caption>
        </section>
      </div>
    </>
  );
}
