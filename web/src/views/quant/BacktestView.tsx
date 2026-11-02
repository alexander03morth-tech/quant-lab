import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Data, Shape } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric } from "../../components/Metric";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Seg, Slider } from "../../components/Slider";
import { alignedPair, useData } from "../../lib/data";
import { fmt, fmtDays, fmtP, fmtPct } from "../../lib/format";
import { short } from "../../lib/market";
import { pairReturns, sharpe, tradesFrom } from "../../lib/stats/backtest";
import { halfLife } from "../../lib/stats/meanrev";
import { drawdown, perf, type Perf } from "../../lib/stats/perf";
import { KALMAN_BURN, positionsFromState, signals, spreadModel, type HedgeMethod } from "../../lib/stats/strategy";
import { coint } from "../../lib/stats/tests";
import { DEFAULT_PAIR } from "../PairView";


interface Params { hedge: HedgeMethod; hw: number; delta: number; zw: number; entry: number; exit: number; stop: number; cost: number; borrow: number }

/** Kör hela kedjan för ett par på given historik. Allt är kausalt: β och z använder bara data t.o.m. dag t, positionen dag t+1. */
function runPair(ly: Float64Array, lx: Float64Array, p: Params, entry = p.entry, cost = p.cost) {
  const model = spreadModel(ly, lx, { hedge: p.hedge, hedgeWindow: p.hw, delta: p.delta, zWindow: p.zw });
  const sig = signals(model.z, { entry, exit: Math.min(p.exit, entry - 0.1), stop: p.stop >= 8 ? Infinity : p.stop });
  const pos = positionsFromState(sig.state, 1);
  const r = pairReturns(ly, lx, model.beta, pos, cost, p.borrow);
  return { model, pos, ...r };
}

function slice(a: Float64Array, from: number, to = a.length) { return a.subarray(from, to); }

export function BacktestView() {
  const { prices, meta } = useData();
  const [sp, setSp] = useSearchParams();
  const [mode, setMode] = useState<"pair" | "portfolio">(sp.get("mode") === "portfolio" ? "portfolio" : "pair");
  const a = sp.get("a") ?? DEFAULT_PAIR[0], b = sp.get("b") ?? DEFAULT_PAIR[1];
  const setPair = (na: string, nb: string) => { const n = new URLSearchParams(sp); n.set("a", na); n.set("b", nb); setSp(n, { replace: true }); };

  const [hedge, setHedge] = useState<HedgeMethod>("kalman");
  const [hw, setHw] = useState(120);
  const [dexp, setDexp] = useState(-7);
  const [zw, setZw] = useState(60);
  const [entry, setEntry] = useState(2);
  const [exit, setExit] = useState(0.5);
  const [stop, setStop] = useState(4);
  const [cost, setCost] = useState(10);
  const [borrow, setBorrow] = useState(50);
  const lastYear = Number(prices.dates[prices.dates.length - 1].slice(0, 4));
  const [splitYear, setSplitYear] = useState(lastYear - 2);
  const params: Params = { hedge, hw, delta: Math.pow(10, dexp), zw, entry, exit, stop, cost, borrow };
  const splitDate = `${splitYear}-01-01`;

  const stocks = [...meta.stocks].sort((p, q) => p.name.localeCompare(q.name, "sv"));

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Backtest · pairs trading</span><span className="live">kostnader inräknade · ingen look-ahead</span></div>
          <h1 className="hero-title">Hade det tjänat pengar?</h1>
          <p className="hero-sub" style={{ maxWidth: "78ch" }}>Simulera strategin dag för dag med courtage och blankningskostnad. Historiken delas i två: <b>träning</b> (där man väljer par och inställningar) och <b>test</b> (som strategin aldrig sett). Bara testperioden säger något om framtiden. <Info id="out-of-sample" /></p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Seg label="Läge" value={mode} onChange={(v) => { setMode(v); const n = new URLSearchParams(sp); if (v === "portfolio") n.set("mode", v); else n.delete("mode"); setSp(n, { replace: true }); }}
              options={[{ value: "pair", label: "Ett par" }, { value: "portfolio", label: "Portfölj av par" }]} />
            {mode === "pair" && (
              <div className="pair-picker" style={{ margin: 0 }}>
                <select className="select" value={a} onChange={(e) => setPair(e.target.value, b)} aria-label="Aktie A">{stocks.map((s) => <option key={s.ticker} value={s.ticker} disabled={s.ticker === b}>{s.name}</option>)}</select>
                <button className="btn" onClick={() => setPair(b, a)} aria-label="Byt plats">⇄</button>
                <select className="select" value={b} onChange={(e) => setPair(a, e.target.value)} aria-label="Aktie B">{stocks.map((s) => <option key={s.ticker} value={s.ticker} disabled={s.ticker === a}>{s.name}</option>)}</select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="stack">
        <section className="card">
          <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Regler</h2>
            <div className="card-tools">
              <span className="dim" style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>Hedge <Info id="hedge-ratio" /></span>
              <Seg label="Hedge-metod" value={hedge} onChange={setHedge} options={[{ value: "kalman", label: "Kalman" }, { value: "rolling", label: "Rullande OLS" }]} />
            </div>
          </div>
          <div className="card-body">
            <div className="grid" style={{ gap: "10px 22px" }}>
              <div className="span-3">{hedge === "kalman"
                ? <Slider label="Kalman δ (10^x)" info="kalman-delta" value={dexp} min={-9} max={-4} step={0.25} onChange={setDexp} format={(v) => fmt(v, 2)} />
                : <Slider label="Hedge-fönster" info="rolling-window" value={hw} min={20} max={500} step={10} onChange={setHw} format={(v) => `${v} d`} />}</div>
              <div className="span-3"><Slider label="Z-scorefönster" info="z-window" value={zw} min={10} max={250} step={5} onChange={setZw} format={(v) => `${v} d`} /></div>
              <div className="span-2"><Slider label="Ingång ±z" info="entry-threshold" value={entry} min={0.5} max={4} step={0.1} onChange={(v) => setEntry(Math.round(v * 10) / 10)} format={(v) => fmt(v, 1)} /></div>
              <div className="span-2"><Slider label="Utgång ±z" info="exit-threshold" value={Math.min(exit, entry - 0.1)} min={0} max={Math.max(0.1, entry - 0.1)} step={0.1} onChange={(v) => setExit(Math.round(v * 10) / 10)} format={(v) => fmt(v, 1)} /></div>
              <div className="span-2"><Slider label="Stop-loss ±z" info="stop-loss" value={stop} min={2.5} max={8} step={0.5} onChange={setStop} format={(v) => (v >= 8 ? "av" : fmt(v, 1))} /></div>
              <div className="span-3"><Slider label="Kostnad per sida och ben" info="transaction-costs" value={cost} min={0} max={40} step={1} onChange={setCost} format={(v) => `${v} bp`} /></div>
              <div className="span-3"><Slider label="Blankningsavgift" info="short-costs" value={borrow} min={0} max={300} step={10} onChange={setBorrow} format={(v) => `${fmt(v / 100, 1)} %/år`} /></div>
              <div className="span-6"><Slider label="Testperioden börjar" info="out-of-sample" value={splitYear} min={Number(prices.dates[0].slice(0, 4)) + 4} max={lastYear} step={1} onChange={setSplitYear} format={(v) => `1 jan ${v}`} /></div>
            </div>
          </div>
        </section>

        {mode === "pair"
          ? <PairBacktest a={a} b={b} p={params} splitDate={splitDate} />
          : <PortfolioBacktest p={params} splitDate={splitDate} />}

        <p className="dim" style={{ fontSize: 12.5 }}>
          Antaganden: signal på stängningskursen, affär dagen efter till stängningskurs. Bruttoexponering 1 (lika mycket kapital i båda benen, viktat med β). Ingen ränta på kassan, utdelningar ingår via justerade kurser. Dagens OMXS30-lista används bakåt i tiden (survivorship bias <Info id="survivorship" />).
        </p>
      </div>
    </div>
  );
}

function PerfTable({ rows }: { rows: { label: string; p: Perf | null }[] }) {
  const line = (label: string, info: string | null, f: (p: Perf) => string) => (
    <tr><td><span className="row" style={{ gap: 6 }}>{label}{info && <Info id={info} />}</span></td>{rows.map((r) => <td key={r.label} className="num">{r.p ? f(r.p) : "–"}</td>)}</tr>
  );
  return (
    <table className="data">
      <thead><tr><th></th>{rows.map((r) => <th key={r.label} className="num">{r.label}</th>)}</tr></thead>
      <tbody>
        {line("Total avkastning", "total-return", (p) => fmtPct(p.totalReturn, 1, true))}
        {line("Per år (CAGR)", null, (p) => fmtPct(p.cagr, 1, true))}
        {line("Volatilitet", "volatility", (p) => fmtPct(p.vol, 1))}
        {line("Sharpe", "sharpe", (p) => fmt(p.sharpe, 2))}
        {line("Största nedgång", "max-drawdown", (p) => fmtPct(p.maxDD, 1))}
        {line("År", null, (p) => fmt(p.years, 1))}
      </tbody>
    </table>
  );
}

function PairBacktest({ a, b, p, splitDate }: { a: string; b: string; p: Params; splitDate: string }) {
  const { prices, name } = useData();
  const A = name(a), B = name(b);
  const base = useMemo(() => {
    const al = alignedPair(prices, a, b, 0);
    return { dates: al.dates, ly: Float64Array.from(al.pa, Math.log), lx: Float64Array.from(al.pb, Math.log) };
  }, [prices, a, b]);

  const res = useMemo(() => runPair(base.ly, base.lx, p), [base, p.hedge, p.hw, p.delta, p.zw, p.entry, p.exit, p.stop, p.cost, p.borrow]);
  const n = base.dates.length;
  const warm = Math.min(n - 1, (p.hedge === "kalman" ? KALMAN_BURN : p.hw) + p.zw);
  let split = base.dates.findIndex((d) => d >= splitDate); if (split < 0) split = n;
  split = Math.max(split, warm + 60);

  const pIn = split - warm > 60 ? perf(slice(res.ret, warm, split)) : null;
  const pOut = n - split > 40 ? perf(slice(res.ret, split)) : null;
  const pAll = perf(slice(res.ret, warm));
  const trades = useMemo(() => tradesFrom(res.pos, res.ret), [res]);
  const tIn = trades.filter((t) => t.start < split), tOut = trades.filter((t) => t.start >= split);
  const win = (ts: typeof trades) => ts.length ? ts.filter((t) => t.ret > 0).length / ts.length : NaN;

  // kostnadskänslighet (test­perioden)
  const sens = useMemo(() => {
    const cs = Array.from({ length: 21 }, (_, i) => i * 2);
    return cs.map((c) => { const r = runPair(base.ly, base.lx, p, p.entry, c); return { c, srIn: sharpe(slice(r.ret, warm, split)), srOut: sharpe(slice(r.ret, split)) }; });
  }, [base, p.hedge, p.hw, p.delta, p.zw, p.entry, p.exit, p.stop, p.borrow, warm, split]);
  const be = (() => { for (let i = 1; i < sens.length; i++) if (sens[i - 1].srOut > 0 && sens[i].srOut <= 0) return sens[i - 1].c + (2 * sens[i - 1].srOut) / (sens[i - 1].srOut - sens[i].srOut); return NaN; })();

  // robusthet: equity för olika ingångströsklar (3D)
  const ribbons = useMemo(() => {
    const ents = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
    const step = Math.max(1, Math.floor((n - warm) / 260));
    const idx: number[] = []; for (let t = warm; t < n; t += step) idx.push(t);
    const z = ents.map((e) => { const r = runPair(base.ly, base.lx, p, e); const e0 = r.equity[warm]; return idx.map((t) => r.equity[t] / e0); });
    return { ents, x: idx.map((t) => base.dates[t]), z };
  }, [base, p.hedge, p.hw, p.delta, p.zw, p.exit, p.stop, p.cost, p.borrow, warm, n]);

  const ctx = { srIn: pIn?.sharpe, srOut: pOut?.sharpe, costBps: p.cost, breakEvenBps: be, A, B };
  const eq0 = res.equity[warm];
  const eq = Array.from(res.equity, (v, i) => (i < warm ? null : v / eq0));
  const dd = drawdown(slice(res.equity, warm));
  const x = base.dates;
  const shade: Partial<Shape>[] = split < n ? [{ type: "rect", xref: "x", yref: "paper", x0: x[split], x1: x[n - 1], y0: 0, y1: 1, fillcolor: cssVar("--primary"), opacity: 0.08, line: { width: 0 }, layer: "below" },
    { type: "line", xref: "x", yref: "paper", x0: x[split], x1: x[split], y0: 0, y1: 1, line: { color: cssVar("--primary"), width: 1, dash: "dash" } }] : [];
  const eqData: Data[] = [
    { x, y: eq, type: "scatter", mode: "lines", line: { color: cssVar("--accent"), width: 7 }, opacity: 0.15, hoverinfo: "skip", showlegend: false },
    { x, y: eq, type: "scatter", mode: "lines", name: "Strategin", line: { color: cssVar("--accent"), width: 1.6 }, hovertemplate: "%{y:.3f}<extra></extra>" },
  ];
  const ddData: Data[] = [{ x: x.slice(warm), y: Array.from(dd), type: "scatter", mode: "lines", fill: "tozeroy", line: { color: cssVar("--neg"), width: 1 }, fillcolor: `${cssVar("--neg")}33`, hovertemplate: "%{y:.1%}<extra></extra>", name: "Nedgång" }];
  const sensData: Data[] = [
    { x: sens.map((s) => s.c), y: sens.map((s) => s.srIn), type: "scatter", mode: "lines", name: "Träning", line: { color: cssVar("--text-3"), width: 1.4, dash: "dot" } },
    { x: sens.map((s) => s.c), y: sens.map((s) => s.srOut), type: "scatter", mode: "lines+markers", name: "Test", line: { color: cssVar("--accent"), width: 1.8 }, marker: { size: 4 } },
  ];
  const surf: Data[] = [{
    type: "surface", x: ribbons.x, y: ribbons.ents, z: ribbons.z, showscale: false,
    colorscale: [[0, cssVar("--neg")], [0.45, cssVar("--surface-2")], [0.55, cssVar("--primary")], [1, cssVar("--accent")]] as any,
    cmid: 1, hovertemplate: "%{x}<br>ingång ±%{y}<br>värde %{z:.3f}<extra></extra>",
    contours: { y: { show: true, color: cssVar("--border-strong"), width: 1 } } as any,
  } as any];

  return (
    <>
      <div className="metrics">
        <Metric label="Sharpe träning" info="sharpe" ctx={ctx} value={fmt(pIn?.sharpe, 2)} sub={`${tIn.length} affärer`} />
        <Metric label="Sharpe test" info="out-of-sample" ctx={ctx} value={fmt(pOut?.sharpe, 2)} tone={pOut ? (pOut.sharpe > 0.5 ? "good" : pOut.sharpe > 0 ? "mid" : "bad") : undefined} toneLabel={pOut ? (pOut.sharpe > 0.5 ? "håller" : pOut.sharpe > 0 ? "svagt" : "förlust") : undefined} sub={`${tOut.length} affärer`} />
        <Metric label="Avkastning test" info="total-return" value={fmtPct(pOut?.totalReturn, 1, true)} sub={pOut ? `${fmtPct(pOut.cagr, 1, true)}/år` : ""} />
        <Metric label="Största nedgång" info="max-drawdown" value={fmtPct(pAll.maxDD, 1)} sub="hela perioden" />
        <Metric label="Vinnande affärer" value={fmtPct(win(trades), 0)} sub={`snitt ${fmt(trades.reduce((s, t) => s + t.days, 0) / Math.max(1, trades.length), 0)} dagar`} />
        <Metric label="Break-even-kostnad" info="transaction-costs" ctx={ctx} value={Number.isFinite(be) ? `${fmt(be, 0)} bp` : sens[0].srOut <= 0 ? "< 0 bp" : "> 40 bp"} sub="test-Sharpe = 0" />
      </div>

      <div className="grid">
        <section className="card span-8">
          <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Kapitalets utveckling <Info id="backtest" ctx={ctx} /></h2><span className="dim" style={{ fontSize: 12 }}>{A} / {B} · start = 1</span></div>
          <div className="card-body">
            <Plot ariaLabel="Equity-kurva för parstrategin" data={eqData} height={260} layout={{ shapes: shade as Shape[], showlegend: false }} />
            <Plot ariaLabel="Nedgång från tidigare topp" data={ddData} height={120} layout={{ shapes: shade as Shape[], showlegend: false, yaxis: { tickformat: ".0%" } as any }} />
          </div>
          <Caption>Övre grafen: vad 1 krona blivit. Den skuggade delen till höger är <b>testperioden</b>. Undre grafen: hur långt under sin tidigare topp strategin legat. Lång tid under vattnet är jobbigt även om slutresultatet är plus.</Caption>
        </section>
        <section className="card span-4">
          <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Träning mot test</h2></div>
          <div className="card-body"><PerfTable rows={[{ label: "Träning", p: pIn }, { label: "Test", p: pOut }]} /></div>
          <Caption>Om testkolumnen är mycket sämre än träningen har strategin troligen lärt sig brus. Det är vanligt – och det är därför den här uppdelningen finns.</Caption>
        </section>

        <section className="card span-6">
          <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Vad tål strategin i kostnad? <Info id="transaction-costs" ctx={ctx} /></h2></div>
          <div className="card-body"><Plot ariaLabel="Sharpe som funktion av transaktionskostnad" data={sensData} height={260}
            layout={{ hovermode: "x unified", xaxis: { title: { text: "Kostnad per sida och ben (bp)" } } as any, yaxis: { title: { text: "Sharpe" }, zeroline: true } as any,
              shapes: [{ type: "line", xref: "x", yref: "paper", x0: p.cost, x1: p.cost, y0: 0, y1: 1, line: { color: cssVar("--primary"), dash: "dash", width: 1 } }] as any }} /></div>
          <Caption>Varje affär i ett par betyder fyra transaktioner. Linjen visar hur Sharpe faller när kostnaden stiger; den streckade linjen är ditt val. <b>Där testlinjen korsar noll</b> äter kostnaderna upp hela fördelen.</Caption>
        </section>
        <section className="card span-6 lab3d">
          <div className="card-head"><h2 className="card-title"><span className="idx">05</span>Robusthet i 3D <Info id="overfitting" /></h2><span className="dim" style={{ fontSize: 12 }}>en kurva per ingångströskel</span></div>
          <div className="card-body"><Plot ariaLabel="3D: kapitalutveckling för olika ingångströsklar" data={surf} height={300}
            layout={scene3d({ x: "Datum", y: "Ingång ±z", z: "Värde" }, { camera: { eye: { x: -1.5, y: -1.6, z: 0.8 } } } as any)} /></div>
          <Caption>Samma strategi med nio olika ingångströsklar. En <b>jämn yta som lutar uppåt</b> betyder att resultatet inte hänger på exakt vilken tröskel man valde. En enda topp mitt i en dal är ett varningstecken.</Caption>
        </section>

        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">06</span>Affärer</h2><span className="dim" style={{ fontSize: 12 }}>senaste 12 · inkl. kostnader</span></div>
          <div className="card-body" style={{ overflowX: "auto" }}>
            <table className="data">
              <thead><tr><th>Öppnad</th><th>Stängd</th><th>Riktning</th><th className="num">Dagar</th><th className="num">Resultat</th><th>Period</th></tr></thead>
              <tbody>
                {trades.slice(-12).reverse().map((t) => (
                  <tr key={t.start}>
                    <td className="mono">{x[t.start]}</td><td className="mono">{t.open ? "öppen" : x[t.end]}</td>
                    <td>{t.side > 0 ? `Köp ${short(a)}, blanka ${short(b)}` : `Blanka ${short(a)}, köp ${short(b)}`}</td>
                    <td className="num">{t.days}</td><td className={`num ${t.ret > 0 ? "pos" : "neg"}`}>{fmtPct(t.ret, 2, true)}</td>
                    <td className="dim">{t.start >= split ? "test" : "träning"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="dim" style={{ fontSize: 12.5, margin: "10px 0 0" }}>Vill du se signalerna i grafen? <Link to={`/par/${a}/${b}`}>Öppna paret i Paranalys →</Link></p>
          </div>
        </section>
      </div>
    </>
  );
}

/**
 * Portfölj av par utan look-ahead: paren väljs bara med data FÖRE testperioden (formationsperiod 3 år),
 * och handlas sedan under testperioden. Jämförs med att välja paren med dagens statistik (som använder testperioden).
 */
function PortfolioBacktest({ p, splitDate }: { p: Params; splitDate: string }) {
  const { prices, meta, pairs } = useData();
  const nav = useNavigate();
  const [topN, setTopN] = useState(8);
  const tickers = meta.stocks.map((s) => s.ticker);
  const split = prices.dates.findIndex((d) => d >= splitDate);
  const FORM = 756;

  const selection = useMemo(() => {
    const cands: { y: string; x: string; p: number; hl: number }[] = [];
    if (split < FORM) return cands;
    const lp = (t: string) => prices.series[t].close.slice(split - FORM, split);
    for (let i = 0; i < tickers.length; i++)
      for (let j = i + 1; j < tickers.length; j++) {
        const ca = lp(tickers[i]), cb = lp(tickers[j]);
        if (ca.some((v) => v == null) || cb.some((v) => v == null)) continue;
        const la = Float64Array.from(ca as number[], Math.log), lb = Float64Array.from(cb as number[], Math.log);
        // snabbtest: fast lagg 1 (ingen AIC-sökning) för att hinna testa alla par i webbläsaren
        const ab = coint(la, lb, { autolag: null, maxlag: 1 }), ba = coint(lb, la, { autolag: null, maxlag: 1 });
        const best = ab.pvalue <= ba.pvalue ? { y: tickers[i], x: tickers[j], r: ab } : { y: tickers[j], x: tickers[i], r: ba };
        if (best.r.beta <= 0) continue;
        const hl = halfLife(best.r.resid).hl;
        if (best.r.pvalue < 0.05 && hl >= 3 && hl <= 60) cands.push({ y: best.y, x: best.x, p: best.r.pvalue, hl });
      }
    return cands.sort((u, v) => u.p - v.p);
  }, [prices, split]);

  // "fusk"-urvalet: dagens 3-årsstatistik, som använder data från testperioden
  const cheat = useMemo(() => pairs.pairs.filter((r) => r.w["3Y"] && r.w["3Y"]!.p < 0.05 && (r.w["3Y"]!.hl ?? 99) >= 3 && (r.w["3Y"]!.hl ?? 99) <= 60 && r.w["3Y"]!.beta > 0)
    .sort((u, v) => u.w["3Y"]!.p - v.w["3Y"]!.p).map((r) => (r.w["3Y"]!.dep === "a" ? { y: r.a, x: r.b, p: r.w["3Y"]!.p, hl: r.w["3Y"]!.hl ?? NaN } : { y: r.b, x: r.a, p: r.w["3Y"]!.p, hl: r.w["3Y"]!.hl ?? NaN })), [pairs]);

  const trade = (list: { y: string; x: string; p: number; hl: number }[]) => {
    const dates = prices.dates.slice(split);
    const T = dates.length;
    const port = new Float64Array(T);
    const per = list.map((c) => {
      // modellen startar vid formationsperiodens början så att Kalman och z-score är uppvärmda vid testets start
      const from = split - FORM;
      const cy = prices.series[c.y].close, cx = prices.series[c.x].close;
      const ly = new Float64Array(prices.dates.length - from), lx = new Float64Array(prices.dates.length - from);
      let last = [0, 0];
      for (let t = from; t < prices.dates.length; t++) {
        const vy = cy[t] ?? null, vx = cx[t] ?? null;
        if (vy != null) last[0] = Math.log(vy); if (vx != null) last[1] = Math.log(vx);
        ly[t - from] = last[0]; lx[t - from] = last[1];
      }
      const r = runPair(ly, lx, p);
      const ret = r.ret.subarray(FORM);
      return { ...c, ret, total: ret.reduce((g, v) => g * (1 + v), 1) - 1, trades: tradesFrom(r.pos.subarray(FORM), ret).length };
    });
    if (per.length) for (let t = 0; t < T; t++) { let s = 0; for (const q of per) s += q.ret[t]; port[t] = s / per.length; }
    return { dates, port, per };
  };

  const honest = useMemo(() => (split >= FORM ? trade(selection.slice(0, topN)) : null), [selection, topN, p.hedge, p.hw, p.delta, p.zw, p.entry, p.exit, p.stop, p.cost, p.borrow]);
  const biased = useMemo(() => (split >= FORM ? trade(cheat.slice(0, topN)) : null), [cheat, topN, split, p.hedge, p.hw, p.delta, p.zw, p.entry, p.exit, p.stop, p.cost, p.borrow]);

  if (!honest || !biased) return <div className="notice"><span className="icon">!</span>Testperioden måste börja minst tre år efter att datan börjar.</div>;
  if (!honest.per.length) return <div className="notice"><span className="icon">!</span>Inga par klarade urvalet i formationsperioden. Prova ett annat startår.</div>;

  const pH = perf(honest.port), pB = perf(biased.port);
  const ctx = { srIn: pB.sharpe, srOut: pH.sharpe };
  const eqH = Array.from(honest.port).reduce<number[]>((acc, r) => { acc.push((acc[acc.length - 1] ?? 1) * (1 + r)); return acc; }, []);
  const eqB = Array.from(biased.port).reduce<number[]>((acc, r) => { acc.push((acc[acc.length - 1] ?? 1) * (1 + r)); return acc; }, []);
  const idxC = prices.series[meta.benchmark.ticker].close.slice(split);
  const i0 = idxC.find((v) => v != null) as number;
  const data: Data[] = [
    ...honest.per.map((q) => ({ x: honest.dates, y: Array.from(q.ret).reduce<number[]>((acc, r) => { acc.push((acc[acc.length - 1] ?? 1) * (1 + r)); return acc; }, []), type: "scatter", mode: "lines", line: { color: cssVar("--text-3"), width: 0.7 }, opacity: 0.45, hoverinfo: "skip", showlegend: false } as Data)),
    { x: honest.dates, y: idxC.map((v) => (v == null ? null : v / i0)), type: "scatter", mode: "lines", name: "OMXS30 (jämförelse)", line: { color: cssVar("--series-b"), width: 1.1, dash: "dot" }, hovertemplate: "Index %{y:.3f}<extra></extra>" },
    { x: biased.dates, y: eqB, type: "scatter", mode: "lines", name: "Par valda med facit (look-ahead)", line: { color: cssVar("--neg"), width: 1.4, dash: "dash" }, hovertemplate: "Med facit %{y:.3f}<extra></extra>" },
    { x: honest.dates, y: eqH, type: "scatter", mode: "lines", name: "Ärligt urval", line: { color: cssVar("--accent"), width: 2.2 }, hovertemplate: "Ärligt %{y:.3f}<extra></extra>" },
  ];

  return (
    <>
      <div className="metrics">
        <Metric label="Sharpe, ärligt urval" info="out-of-sample" ctx={ctx} value={fmt(pH.sharpe, 2)} tone={pH.sharpe > 0.5 ? "good" : pH.sharpe > 0 ? "mid" : "bad"} toneLabel={pH.sharpe > 0.5 ? "håller" : pH.sharpe > 0 ? "svagt" : "förlust"} sub={`${honest.per.length} par`} />
        <Metric label="Avkastning, ärligt" info="total-return" value={fmtPct(pH.totalReturn, 1, true)} sub={`${fmtPct(pH.cagr, 1, true)}/år`} />
        <Metric label="Sharpe med facit" info="look-ahead" ctx={ctx} value={fmt(pB.sharpe, 2)} sub="par valda med dagens data" />
        <Metric label="Största nedgång" info="max-drawdown" value={fmtPct(pH.maxDD, 1)} sub="ärligt urval" />
        <Metric label="Kandidater i formationen" info="multiple-testing" value={selection.length} sub={`p < 0,05 av ${tickers.length * (tickers.length - 1) / 2}`} />
      </div>
      <div className="grid">
        <section className="card span-8">
          <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Testperioden: ärligt mot facit <Info id="look-ahead" ctx={ctx} /></h2>
            <div className="card-tools" style={{ minWidth: 220 }}><Slider label="Antal par" value={topN} min={2} max={15} step={1} onChange={setTopN} /></div>
          </div>
          <div className="card-body"><Plot ariaLabel="Equity för portfölj av par: ärligt urval mot urval med facit" data={data} height={340} /></div>
          <Caption><b>Guld:</b> paren valdes med bara de tre åren före {splitDate.slice(0, 4)} och handlades sedan – så hade det faktiskt kunnat gå. <b>Röd streckad:</b> paren valdes med dagens statistik, som redan "vet" hur testperioden gick. Skillnaden är priset för look-ahead. Tunna linjer = varje par för sig. Kapitalet delas lika mellan paren.</Caption>
        </section>
        <section className="card span-4">
          <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Valda par</h2><span className="dim" style={{ fontSize: 12 }}>formation {prices.dates[split - FORM]} – {prices.dates[split - 1]}</span></div>
          <div className="card-body">
            <table className="data"><thead><tr><th>Par</th><th className="num">p</th><th className="num">HL</th><th className="num">Test</th></tr></thead>
              <tbody>{honest.per.map((q) => (
                <tr key={q.y + q.x} className="row-link" onClick={() => nav(`/par/${q.y}/${q.x}`)}>
                  <td>{short(q.y)} / {short(q.x)}</td><td className="num dim">{fmtP(q.p)}</td><td className="num dim">{fmtDays(q.hl)}</td><td className={`num ${q.total > 0 ? "pos" : "neg"}`}>{fmtPct(q.total, 1, true)}</td>
                </tr>))}</tbody></table>
            <p className="dim" style={{ fontSize: 12.5, margin: "8px 0 0" }}>Urval: Engle-Granger p &lt; 0,05 (snabbtest med en lagg), half-life 3–60 dagar, β &gt; 0, sorterat på p.</p>
          </div>
        </section>
      </div>
    </>
  );
}
