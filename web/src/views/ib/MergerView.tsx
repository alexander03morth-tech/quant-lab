import { useMemo, useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric } from "../../components/Metric";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Slider } from "../../components/Slider";
import { runMerger, type MergerInput, type Side } from "../../lib/ib/merger";
import { useFundamentals, type Fundamentals } from "../../lib/extra";
import { fmt, fmtPct } from "../../lib/format";

const mkr = (v: number) => `${fmt(v / 1e6, 0)} mkr`;
const side = (f: Fundamentals): Side => ({ name: f.name, price: f.price!, shares: f.shares!, netIncome: f.netIncome!, netDebt: f.netDebt ?? 0, ebitda: f.ebitda! });

export function MergerView() {
  const fund = useFundamentals();
  const list = useMemo(() => Object.entries(fund?.items ?? {}).filter(([, f]) => f.sector !== "finans" && f.netIncome && f.netIncome > 0 && f.shares && f.price && f.ebitda).sort((a, b) => a[1].name.localeCompare(b[1].name, "sv")), [fund]);
  const [a, setA] = useState("SAND.ST");
  const [b, setB] = useState("SKF-B.ST");
  const [p, setP] = useState({ premium: 0.35, pctStock: 0.5, pctCash: 0.1, kd: 0.055, cashYield: 0.02, synergies: 1.5e9, feePct: 0.015 });
  const set = <K extends keyof typeof p>(k: K, v: number) => setP((o) => ({ ...o, [k]: v }));
  const fa = fund?.items[a], fb = fund?.items[b];
  const ok = fa && fb && a !== b && list.some(([k]) => k === a) && list.some(([k]) => k === b);
  const input: MergerInput | null = ok ? { acq: side(fa!), tgt: side(fb!), tax: 0.206, ...p, pctCash: Math.min(p.pctCash, 1 - p.pctStock) } : null;
  const r = useMemo(() => (input ? runMerger(input) : null), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const surf = useMemo(() => {
    if (!input) return null;
    const stock = Array.from({ length: 11 }, (_, i) => i / 10);
    const prem = Array.from({ length: 13 }, (_, i) => i * 0.05);
    const z = prem.map((pr) => stock.map((s) => runMerger({ ...input, premium: pr, pctStock: s, pctCash: Math.min(input.pctCash, 1 - s) }).accretion));
    return { stock, prem, z };
  }, [JSON.stringify({ ...input, premium: 0, pctStock: 0 })]); // eslint-disable-line react-hooks/exhaustive-deps
  if (fund === undefined) return <div className="plot-loading" style={{ minHeight: "40vh" }}>Laddar nyckeltal…</div>;

  const pos = cssVar("--pos"), neg = cssVar("--neg"), accent = cssVar("--accent");
  const ctx = r && input ? { acc: r.accretion, acq: fa!.name, tgt: fb!.name, breakeven: r.breakevenSynergies } : {};
  let bridge: Data[] = [];
  if (r && input) {
    const nA = input.acq.shares, nNew = r.newShares;
    const steps = [
      ["EPS idag", r.epsBefore],
      [`+ ${fb!.name}s vinst`, input.tgt.netIncome / (nA + nNew)],
      ["+ synergier efter skatt", (input.synergies * 0.794) / (nA + nNew)],
      ["− ränta och förlorad avkastning", -(r.newDebt * input.kd + r.cashUsed * input.cashYield) * 0.794 / (nA + nNew)],
      ["− utspädning (nya aktier)", input.acq.netIncome / (nA + nNew) - r.epsBefore],
    ] as const;
    bridge = [{
      type: "waterfall", orientation: "v", x: [...steps.map((s) => s[0]), "EPS efter"], measure: ["absolute", "relative", "relative", "relative", "relative", "total"],
      y: [...steps.map((s) => s[1]), 0], text: [...steps.map((s) => fmt(s[1], 2)), fmt(r.epsAfter, 2)], textposition: "outside", cliponaxis: false,
      increasing: { marker: { color: pos } }, decreasing: { marker: { color: neg } }, totals: { marker: { color: accent } },
      connector: { line: { color: cssVar("--border-strong"), width: 1, dash: "dot" } }, hovertemplate: "<b>%{x}</b>: %{text} kr per aktie<extra></extra>",
    } as any];
  }
  const surfData: Data[] = surf ? [
    { type: "surface", x: surf.stock, y: surf.prem, z: surf.z as any, colorscale: [[0, neg], [0.5, cssVar("--surface-2")], [1, pos]], cmid: 0,
      contours: { z: { show: true, start: 0, end: 0, size: 1, color: "#fff", width: 4 } } as any,
      colorbar: { thickness: 8, len: 0.55, tickformat: ".0%", title: { text: "EPS-effekt", side: "right", font: { size: 11 } }, tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") } } as any,
      lighting: { ambient: 0.55, diffuse: 0.7, specular: 0.4, roughness: 0.4 },
      hovertemplate: "Aktier %{x:.0%} av betalningen · premie %{y:.0%}<br><b>EPS %{z:+.1%}</b><extra></extra>" } as any,
    { type: "scatter3d", mode: "markers+text", x: [p.pctStock], y: [p.premium], z: [r!.accretion + 0.01], text: ["din affär"], textposition: "top center", textfont: { color: cssVar("--text"), size: 12 }, marker: { size: 6, color: "#fff", line: { color: "#000", width: 1 } }, hoverinfo: "skip" } as any,
  ] : [];

  return (
    <>
      <div className="hero" style={{ marginBottom: 14 }}>
        <div>
          <div className="hero-kicker"><span>M&A-kalkyl</span><span className="live">hypotetiskt exempel</span></div>
          <h1 className="hero-title">Om {fa?.name ?? "A"} köpte {fb?.name ?? "B"}</h1>
          <p className="hero-sub">Påhittad affär med riktiga nyckeltal. Den första frågan varje styrelse ställer: blir vinsten per aktie högre eller lägre efter köpet? <Info id="accretion-dilution" ctx={ctx} /></p>
          <div className="row">
            <label className="field">Köpare<select className="select" value={a} onChange={(e) => setA(e.target.value)}>{list.map(([k, f]) => <option key={k} value={k} disabled={k === b}>{f.name}</option>)}</select></label>
            <label className="field">Målbolag<select className="select" value={b} onChange={(e) => setB(e.target.value)}>{list.map(([k, f]) => <option key={k} value={k} disabled={k === a}>{f.name}</option>)}</select></label>
          </div>
        </div>
        {r && (
          <div className="hero-right">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
              <div><div className="dim" style={{ fontSize: 12.5 }}>Vinst per aktie för {fa!.name}</div><div className={`big-num ${r.accretion >= 0 ? "pos" : "neg"}`}>{fmtPct(r.accretion, 1, true)}</div></div>
              <div style={{ textAlign: "right" }}><div className="tag" style={{ color: r.accretion >= 0 ? "var(--pos)" : "var(--neg)" }}>{r.accretion >= 0 ? "accretive" : "dilutive"}</div></div>
            </div>
            <div className="dim" style={{ fontSize: 13 }}>Affären behöver synergier på <b className="num" style={{ color: "var(--text)" }}>{mkr(r.breakevenSynergies)}</b> per år för att inte sänka vinsten per aktie. <Info id="synergies" ctx={ctx} /></div>
          </div>
        )}
      </div>
      {!r || !input ? <div className="notice"><span className="icon">!</span>Välj två olika bolag med positiv vinst.</div> : (
        <div className="grid">
          <div className="metrics span-12">
            <Metric label="Köpeskilling (aktier)" info="bid-premium" ctx={ctx} value={mkr(r.offerEquity)} sub={`${fmt(r.offerPerShare, 0)} kr/aktie mot ${fmt(input.tgt.price, 0)}`} />
            <Metric label="P/E betalt / köparens P/E" info="accretion-dilution" ctx={ctx} value={`${fmt(r.peOffer, 1)} / ${fmt(r.peAcq, 1)}`} tone={r.peOffer < r.peAcq ? "good" : "mid"} toneLabel={r.peOffer < r.peAcq ? "billigare än köparen" : "dyrare än köparen"} />
            <Metric label="Nya aktier" info="stock-vs-cash" ctx={ctx} value={`${fmt(r.newShares / 1e6, 0)} milj.`} sub={`säljarna äger ${fmtPct(r.tgtOwnership, 0)}`} />
            <Metric label="Ny skuld" info="stock-vs-cash" ctx={ctx} value={mkr(r.newDebt)} />
            <Metric label="Skuld / EBITDA" info="leverage-multiple" ctx={ctx} value={`${fmt(r.leverageAfter, 1)}×`} sub={`före: ${fmt(r.leverageBefore, 1)}×`} tone={r.leverageAfter > 3 ? "mid" : "neutral"} toneLabel={r.leverageAfter > 3 ? "hög" : "ok"} />
          </div>
          <section className="card span-12">
            <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Affärens upplägg</h2></div>
            <div className="card-body"><div className="grid" style={{ gap: "10px 22px" }}>
              <div className="span-3"><Slider label="Budpremie" info="bid-premium" ctx={ctx} value={p.premium} min={0} max={0.7} step={0.01} onChange={(v) => set("premium", v)} format={(v) => fmtPct(v, 0)} /></div>
              <div className="span-3"><Slider label="Betalas med aktier" info="stock-vs-cash" ctx={ctx} value={p.pctStock} min={0} max={1} step={0.05} onChange={(v) => set("pctStock", v)} format={(v) => fmtPct(v, 0)} /></div>
              <div className="span-3"><Slider label="Betalas från kassan" info="stock-vs-cash" ctx={ctx} value={Math.min(p.pctCash, 1 - p.pctStock)} min={0} max={1 - p.pctStock} step={0.05} onChange={(v) => set("pctCash", v)} format={(v) => `${fmtPct(v, 0)} · lån ${fmtPct(Math.max(0, 1 - p.pctStock - Math.min(p.pctCash, 1 - p.pctStock)), 0)}`} /></div>
              <div className="span-3"><Slider label="Synergier per år (före skatt)" info="synergies" ctx={ctx} value={p.synergies} min={0} max={Math.max(2e9, input.tgt.ebitda * 0.4)} step={5e7} onChange={(v) => set("synergies", v)} format={mkr} /></div>
              <div className="span-3"><Slider label="Ränta på ny skuld" value={p.kd} min={0.02} max={0.1} step={0.0025} onChange={(v) => set("kd", v)} format={(v) => fmtPct(v, 2)} /></div>
            </div></div>
          </section>
          <section className="card span-6">
            <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Från EPS idag till EPS efter <Info id="eps" ctx={ctx} /></h2></div>
            <div className="card-body"><Plot ariaLabel="Brygga över vinst per aktie före och efter förvärvet" data={bridge} height={320} layout={{ hovermode: "closest", xaxis: { type: "category" } as any, yaxis: { ticksuffix: " kr", side: "left" } as any, margin: { l: 8, r: 8, t: 24, b: 8 } }} /></div>
            <Caption>Vinsten per aktie före köpet (vänster) plus målbolagets vinst och synergierna, minus räntekostnader och effekten av att vinsten delas på fler aktier, ger vinsten per aktie efter (höger).</Caption>
          </section>
          <section className="card span-6 lab3d">
            <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Betalning × premie i 3D <Info id="accretion-dilution" ctx={ctx} /></h2></div>
            <div className="card-body"><Plot ariaLabel="3D-yta: EPS-effekt över andel aktiebetalning och budpremie" data={surfData} height={360}
              layout={scene3d({ x: "Andel betalt med aktier", y: "Budpremie", z: "EPS-effekt" }, { xaxis: { tickformat: ".0%" }, yaxis: { tickformat: ".0%" }, zaxis: { tickformat: ".0%" }, camera: { eye: { x: 1.5, y: -1.5, z: 0.9 } } } as any)} /></div>
            <Caption>Grönt = vinsten per aktie ökar, rött = den minskar. Den vita linjen är gränsen. <b>Ju mer man betalar och ju mer med aktier, desto mer späds ägarna ut</b> – om inte målbolaget är billigt jämfört med köparen.</Caption>
          </section>
        </div>
      )}
    </>
  );
}
