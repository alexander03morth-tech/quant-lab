import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Data, Layout, Shape } from "plotly.js-dist-min";
import { Caption } from "../components/Caption";
import { Info } from "../components/Info";
import { Metric, type Tone } from "../components/Metric";
import { cssVar, Plot } from "../components/Plot";
import { Seg, Slider } from "../components/Slider";
import { alignedPair, useData } from "../lib/data";
import { fmt, fmtDays, fmtP, fmtPct, fmtSigned } from "../lib/format";
import { useSettings } from "../lib/settings";
import { corr, halfLife, hurst, rollingOls, staticSpread } from "../lib/stats/meanrev";
import { signals, spreadModel, type HedgeMethod } from "../lib/stats/strategy";
import { adfuller, coint, johansen } from "../lib/stats/tests";
import type { WindowKey } from "../lib/types";
import { Lab3D } from "./pair/Lab3D";
import { ZGauge } from "../components/ZGauge";
import { kalmanSeries } from "../lib/stats/strategy";

const WINDOWS: { value: string; label: string; days: number }[] = [
  { value: "1Y", label: "1 år", days: 252 },
  { value: "2Y", label: "2 år", days: 504 },
  { value: "3Y", label: "3 år", days: 756 },
  { value: "5Y", label: "5 år", days: 1260 },
  { value: "10Y", label: "10 år", days: 2520 },
  { value: "MAX", label: "Max", days: 0 },
];

const DEFAULTS = { w: "3Y", hedge: "kalman", hw: 120, dexp: -7, zw: 60, entry: 2, exit: 0.5, stop: 4 };
export const DEFAULT_PAIR = ["NDA-SE.ST", "SWED-A.ST"];

/** Rullande medel och std för banden runt spreaden. */
function rollingBands(s: Float64Array, L: number) {
  const n = s.length, m = new Float64Array(n).fill(NaN), sd = new Float64Array(n).fill(NaN);
  let sum = 0, sum2 = 0, cnt = 0;
  for (let t = 0; t < n; t++) {
    const v = s[t];
    if (Number.isFinite(v)) { sum += v; sum2 += v * v; cnt++; }
    if (t >= L) { const o = s[t - L]; if (Number.isFinite(o)) { sum -= o; sum2 -= o * o; cnt--; } }
    if (cnt === L) { m[t] = sum / L; sd[t] = Math.sqrt(Math.max(0, (sum2 - L * m[t] * m[t]) / (L - 1))); }
  }
  return { m, sd };
}

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
/** 10^-7,25 → "5,6·10⁻⁸" */
function fmtDelta(e: number) {
  const ex = Math.floor(e), m = Math.pow(10, e - ex);
  const sup = String(ex).split("").map((c) => SUP[c]).join("");
  return `${m < 1.05 ? "" : fmt(m, 1) + "·"}10${sup}`;
}

const nanToNull = (a: ArrayLike<number>) => Array.from(a, (v) => (Number.isFinite(v) ? v : null));

export function PairRedirect() {
  return <Navigate to={`/par/${DEFAULT_PAIR[0]}/${DEFAULT_PAIR[1]}`} replace />;
}

export function PairView() {
  const { a = DEFAULT_PAIR[0], b = DEFAULT_PAIR[1] } = useParams();
  const { prices, pairs, name, meta } = useData();
  const { mode } = useSettings();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [xRange, setXRange] = useState<[string, string] | null>(null);

  const get = <K extends keyof typeof DEFAULTS>(k: K): (typeof DEFAULTS)[K] => {
    const v = sp.get(k);
    if (v == null) return DEFAULTS[k];
    return (typeof DEFAULTS[k] === "number" ? Number(v) : v) as (typeof DEFAULTS)[K];
  };
  const set = (k: keyof typeof DEFAULTS, v: string | number) => {
    const next = new URLSearchParams(sp);
    if (v === DEFAULTS[k]) next.delete(k); else next.set(k, String(v));
    setSp(next, { replace: true });
  };
  const w = get("w"), hedge = get("hedge") as HedgeMethod, hw = get("hw"), dexp = get("dexp");
  const zw = get("zw"), entry = get("entry"), exit = Math.min(get("exit"), get("entry") - 0.1), stop = get("stop");
  const delta = Math.pow(10, dexp);
  const winDays = WINDOWS.find((x) => x.value === w)?.days ?? 756;
  const valid = prices.series[a] && prices.series[b] && a !== b;

  const A = name(a), B = name(b);

  // ── Tunga tester: beror bara på par + fönster ──
  const base = useMemo(() => {
    if (!valid) return null;
    const al = alignedPair(prices, a, b, winDays);
    const ly = Float64Array.from(al.pa, Math.log), lx = Float64Array.from(al.pb, Math.log);
    const st = staticSpread(ly, lx);
    const eg = coint(ly, lx);
    const egRev = coint(lx, ly);
    const adf = adfuller(st.resid);
    const hl = halfLife(st.resid).hl;
    const H = hurst(st.resid);
    const joh = johansen(ly, lx);
    const ra = new Float64Array(ly.length - 1), rb = new Float64Array(ly.length - 1);
    for (let i = 1; i < ly.length; i++) { ra[i - 1] = ly[i] - ly[i - 1]; rb[i - 1] = lx[i] - lx[i - 1]; }
    return { ...al, ly, lx, st, eg, egRev, adf, hl, H, joh, corr: corr(ra, rb) };
  }, [valid, prices, a, b, winDays]);

  // ── Interaktivt: spreadmodell + signaler ──
  const live = useMemo(() => {
    if (!base) return null;
    const model = spreadModel(base.ly, base.lx, { hedge, hedgeWindow: hw, delta, zWindow: zw });
    const sig = signals(model.z, { entry, exit, stop: stop >= 8 ? Infinity : stop });
    const kal = kalmanSeries(base.ly, base.lx, delta);
    const roll = rollingOls(base.ly, base.lx, hw);
    const bands = rollingBands(model.spread, zw);
    return { model, sig, kal, roll, bands };
  }, [base, hedge, hw, delta, zw, entry, exit, stop]);

  const full = useMemo(() => {
    if (!valid) return null;
    const al = alignedPair(prices, a, b, 0);
    return { dates: al.dates, ly: Float64Array.from(al.pa, Math.log), lx: Float64Array.from(al.pb, Math.log) };
  }, [valid, prices, a, b]);

  const pre = useMemo(() => {
    const row = pairs.pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
    const wk = (["1Y", "3Y", "5Y"] as WindowKey[]).includes(w as WindowKey) ? (w as WindowKey) : null;
    return { stab: row?.stab ?? null, q: wk && row?.w[wk] ? row.w[wk]!.q ?? null : null };
  }, [pairs, a, b, w]);

  const suggestions = useMemo(() => {
    return pairs.pairs
      .filter((p) => p.w["3Y"] && p.w["5Y"] && p.w["3Y"]!.p < 0.05 && p.w["5Y"]!.p < 0.05 && (p.w["3Y"]!.corr ?? 0) > 0.3)
      .sort((x, y) => (y.stab ?? 0) - (x.stab ?? 0))
      .slice(0, 5)
      .map((p) => (p.w["5Y"]!.dep === "a" ? [p.a, p.b] : [p.b, p.a]));
  }, [pairs]);

  if (!valid) return <Navigate to={`/par/${DEFAULT_PAIR[0]}/${DEFAULT_PAIR[1]}`} replace />;
  if (!base || !live || !full) return null;

  const n = base.dates.length;
  const last = n - 1;
  const zNow = live.model.z[last];
  const trades = live.sig.events.filter((e) => e.kind === "long" || e.kind === "short").length;
  const stops = live.sig.events.filter((e) => e.kind === "stop").length;
  const windowLabel = WINDOWS.find((x) => x.value === w)?.label;
  const shortHistory = winDays > 0 && base.available < winDays;

  const ctx = {
    A, B, windowLabel,
    p: base.eg.pvalue, q: pre.q, stab: pre.stab, beta: base.st.beta, hl: base.hl, hurst: base.H,
    adf: base.adf.stat, adfP: base.adf.pvalue, adfCrit5: base.adf.crit["5%"], corr: base.corr,
    joh0: base.joh.trace[0], joh0c: base.joh.traceCrit[0][1], kalmanBeta: live.kal.beta[last],
    zNow, entry, zWindow: zw, nTrades: trades, nStops: stops,
    retA: base.pa[last] / base.pa[0] - 1, retB: base.pb[last] / base.pb[0] - 1,
  };

  // ── Bedömning ──
  const checks: { ok: boolean | null; label: string; detail: string; info: string }[] = [
    { ok: base.eg.pvalue < 0.05, label: "Samintegrerat (EG p < 0,05)", detail: `p = ${fmtP(base.eg.pvalue)}`, info: "cointegration" },
    { ok: base.joh.trace[0] > base.joh.traceCrit[0][1], label: "Johansen bekräftar", detail: `trace ${fmt(base.joh.trace[0], 1)} / ${fmt(base.joh.traceCrit[0][1], 1)}`, info: "johansen" },
    { ok: Number.isFinite(base.hl) && base.hl >= 3 && base.hl <= 30, label: "Half-life 3–30 dagar", detail: fmtDays(base.hl), info: "half-life" },
    { ok: base.H < 0.5, label: "Hurst under 0,5", detail: fmt(base.H, 2), info: "hurst" },
    { ok: pre.stab == null ? null : pre.stab >= 0.3, label: "Stabilt över tid (≥ 30 %)", detail: pre.stab == null ? "för kort historik" : fmtPct(pre.stab, 0), info: "stability" },
    { ok: base.st.beta > 0 && base.corr > 0.3, label: "Ekonomiskt rimligt (β > 0, korr > 0,3)", detail: `β ${fmt(base.st.beta, 2)}, ρ ${fmt(base.corr, 2)}`, info: "corr-vs-coint" },
  ];
  const score = checks.filter((c) => c.ok).length;
  const verdict = score >= 5 ? { tone: "good" as Tone, text: "Stark kandidat" } : score >= 3 ? { tone: "mid" as Tone, text: "Möjlig kandidat" } : { tone: "bad" as Tone, text: "Svag – troligen inte tradebart" };

  const toneP = (p: number): [Tone, string] => (p < 0.01 ? ["good", "stark"] : p < 0.05 ? ["mid", "signifikant"] : ["bad", "ej signifikant"]);
  const toneHl = (h: number): [Tone, string] => (!Number.isFinite(h) ? ["bad", "ingen"] : h < 3 ? ["mid", "brusigt"] : h <= 30 ? ["good", "tradebart"] : h <= 60 ? ["mid", "långsamt"] : ["bad", "för långsamt"]);
  const toneH = (h: number): [Tone, string] => (h < 0.4 ? ["good", "mean-rev."] : h < 0.5 ? ["mid", "svag m-r"] : ["bad", "trend/RW"]);

  // ── Grafer ──
  const colA = cssVar("--series-a"), colB = cssVar("--series-b"), colC = cssVar("--series-c");
  const pos = cssVar("--pos"), neg = cssVar("--neg"), warn = cssVar("--warn"), txt = cssVar("--text"), txt3 = cssVar("--text-3"), prim = cssVar("--primary");
  const x = base.dates;

  const normA = Array.from(base.pa, (v) => (100 * v) / base.pa[0]);
  const normB = Array.from(base.pb, (v) => (100 * v) / base.pb[0]);
  const gapText = normA.map((v, i) => {
    const g = Math.log(v / normB[i]);
    return `${A} ${g >= 0 ? "ligger före" : "ligger efter"} med ${fmt(Math.abs(g) * 100, 1)} %`;
  });
  const priceData: Data[] = [
    { x, y: normA, type: "scatter", mode: "lines", line: { color: colA, width: 8 }, opacity: 0.14, hoverinfo: "skip", showlegend: false },
    { x, y: normB, type: "scatter", mode: "lines", line: { color: colB, width: 8 }, opacity: 0.14, hoverinfo: "skip", showlegend: false },
    { x, y: normA, type: "scatter", mode: "lines", name: A, line: { color: colA, width: 1.6 }, customdata: Array.from(base.pa), hovertemplate: `${A}: %{y:.1f} <span style="color:${txt3}">(%{customdata:.2f} kr)</span><extra></extra>` },
    { x, y: normB, type: "scatter", mode: "lines", name: B, line: { color: colB, width: 1.6 }, customdata: gapText.map((g, i) => [base.pb[i], g]) as any, hovertemplate: `${B}: %{y:.1f} <span style="color:${txt3}">(%{customdata[0]:.2f} kr)</span><br><i>%{customdata[1]}</i><extra></extra>` },
  ];

  const betaHover = (bv: number) => Number.isFinite(bv) ? `1 % i ${B} ≈ ${fmt(bv, 2)} % i ${A}` : "";
  const hedgeData: Data[] = [
    { x, y: nanToNull(live.kal.beta), type: "scatter", mode: "lines", line: { color: colA, width: 8 }, opacity: 0.18, hoverinfo: "skip", showlegend: false },
    { x, y: nanToNull(live.kal.beta), type: "scatter", mode: "lines", name: "Kalman", line: { color: colA, width: 1.6 }, customdata: Array.from(live.kal.beta, betaHover), hovertemplate: "Kalman β %{y:.3f}<br><i>%{customdata}</i><extra></extra>" },
    { x, y: nanToNull(live.roll.beta), type: "scatter", mode: "lines", name: `Rullande OLS (${hw} d)`, line: { color: colC, width: 1.2 }, hovertemplate: "Rullande β %{y:.3f}<extra></extra>" },
    { x: [x[0], x[last]], y: [base.st.beta, base.st.beta], type: "scatter", mode: "lines", name: "OLS hela fönstret", line: { color: txt3, width: 1.2, dash: "dash" }, hovertemplate: "OLS β %{y:.3f} (använder hela fönstret)<extra></extra>" },
  ];

  const s = live.model.spread, bm = live.bands.m, bsd = live.bands.sd;
  const band = (k: number) => nanToNull(Array.from(bm, (m, i) => m + k * bsd[i]));
  const spreadData: Data[] = [
    { x, y: band(2), type: "scatter", mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false },
    { x, y: band(-2), type: "scatter", mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: `${prim}1f`, name: "±2σ", hoverinfo: "skip" },
    { x, y: nanToNull(bm), type: "scatter", mode: "lines", name: "Rullande medel", line: { color: txt3, width: 1, dash: "dot" }, hoverinfo: "skip" },
    { x, y: nanToNull(s), type: "scatter", mode: "lines", name: "Spread", line: { color: colA, width: 1.4 },
      customdata: Array.from(s, (v, i) => Number.isFinite(live.model.z[i]) ? `${A} ${v - bm[i] > 0 ? "dyr" : "billig"} relativt ${B} (${fmt(live.model.z[i], 1)}σ)` : "") as any,
      hovertemplate: "Spread %{y:.3f}<br><i>%{customdata}</i><extra></extra>" },
  ];

  const zInterp = (z: number) => {
    if (!Number.isFinite(z)) return "";
    const az = Math.abs(z);
    if (az >= stop && stop < 8) return `Bortom stop-loss (${fmt(stop, 1)}) – sambandet kan ha brutits`;
    if (az >= entry) return z > 0 ? `${A} dyr → sälj spreaden (sälj ${A}, köp ${B})` : `${A} billig → köp spreaden (köp ${A}, sälj ${B})`;
    if (az <= exit) return "Nära medel – här stängs positioner";
    if (az < 1) return "Normalt brus";
    return "Förhöjd, men innanför ingångströskeln";
  };
  const z = live.model.z;
  const evs = live.sig.events;
  const mk = (kind: string, sym: string, color: string, label: string, hover: (t: number) => string): Data => {
    const e = evs.filter((v) => v.kind === kind);
    return {
      x: e.map((v) => x[v.t]), y: e.map((v) => v.z), type: "scatter", mode: "markers", name: label,
      marker: { symbol: sym as any, size: kind === "exit" ? 7 : 10, color, line: { width: 1, color: cssVar("--surface") } },
      customdata: e.map((v) => hover(v.t)) as any, hovertemplate: "<b>%{customdata}</b><extra></extra>",
    };
  };
  const beta = live.model.beta;
  const zData: Data[] = [
    { x, y: nanToNull(z), type: "scatter", mode: "lines", line: { color: prim, width: 7 }, opacity: 0.18, hoverinfo: "skip", showlegend: false },
    { x, y: nanToNull(z), type: "scatter", mode: "lines", name: "z-score", line: { color: txt, width: 1.2 }, customdata: Array.from(z, zInterp) as any, hovertemplate: "z = %{y:.2f}<br><i>%{customdata}</i><extra></extra>" },
    mk("long", "triangle-up", pos, "Köp spread", (t) => `Köp spreaden: köp ${A}, blanka ${fmt(beta[t], 2)}× ${B}. Utförs nästa dag.`),
    mk("short", "triangle-down", neg, "Sälj spread", (t) => `Sälj spreaden: blanka ${A}, köp ${fmt(beta[t], 2)}× ${B}. Utförs nästa dag.`),
    mk("exit", "circle", txt3, "Stäng", () => "Stäng positionen – spreaden är tillbaka nära medel."),
    mk("stop", "x", warn, "Stop-loss", () => "Stop-loss – spreaden gick för långt åt fel håll."),
  ];
  const hline = (y: number, color: string, dash: string): Partial<Shape> => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color, width: 1, dash: dash as any } });
  const shapes: Partial<Shape>[] = [hline(entry, prim, "dash"), hline(-entry, prim, "dash"), hline(exit, txt3, "dot"), hline(-exit, txt3, "dot")];
  if (stop < 8) shapes.push(hline(stop, warn, "dashdot"), hline(-stop, warn, "dashdot"));
  // Skugga perioder med öppen position
  let open: { t: number; side: number } | null = null;
  for (const e of evs) {
    if (e.kind === "long" || e.kind === "short") open = { t: e.t, side: e.kind === "long" ? 1 : -1 };
    else if (open) { shapes.push({ type: "rect", xref: "x", yref: "paper", x0: x[open.t], x1: x[e.t], y0: 0, y1: 1, fillcolor: open.side > 0 ? pos : neg, opacity: 0.07, line: { width: 0 }, layer: "below" }); open = null; }
  }
  if (open) shapes.push({ type: "rect", xref: "x", yref: "paper", x0: x[open.t], x1: x[last], y0: 0, y1: 1, fillcolor: open.side > 0 ? pos : neg, opacity: 0.07, line: { width: 0 }, layer: "below" });
  const zLayout: Partial<Layout> = { shapes: shapes as Shape[], yaxis: { zeroline: true, title: { text: "" } } as any };

  const ticker = (t: string) => t.replace(".ST", "");
  const stocks = [...meta.stocks].sort((p, q) => p.name.localeCompare(q.name, "sv"));
  const go = (na: string, nb: string) => navigate({ pathname: `/par/${na}/${nb}`, search: sp.toString() });

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 14 }}>
        <div>
          <div className="hero-kicker"><span>Paranalys · OMXS30</span><span className="live">data t.o.m. {base.dates[last]}</span></div>
          <h1 className="hero-title">{A}<span className="x">⇄</span><span className="b">{B}</span></h1>
          <p className="hero-sub">Går de här två aktierna att handla som ett par? Nedan testas om avståndet mellan dem håller sig stabilt, hur mycket av {B} man ska blanka per krona {A}, och var strategin hade köpt och sålt.</p>
          <div className="pair-picker">
            <label className="field">Aktie A (y)
              <select className="select" value={a} onChange={(e) => go(e.target.value, b)} aria-label="Aktie A">
                {stocks.map((s) => <option key={s.ticker} value={s.ticker} disabled={s.ticker === b}>{s.name}</option>)}
              </select>
            </label>
            <button className="btn" style={{ alignSelf: "flex-end", height: 36 }} onClick={() => go(b, a)} title="Byt plats på A och B" aria-label="Byt plats">⇄</button>
            <label className="field">Aktie B (x)
              <select className="select" value={b} onChange={(e) => go(a, e.target.value)} aria-label="Aktie B">
                {stocks.map((s) => <option key={s.ticker} value={s.ticker} disabled={s.ticker === a}>{s.name}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="hero-right">
          <ZGauge z={zNow} entry={entry} exit={exit} stop={stop} />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className={`tag ${verdict.tone}`}>{verdict.text} · {score}/6</span>
            <span className="dim" style={{ fontSize: 12.5 }}>{zInterp(zNow) || "z-score saknas"}</span>
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="quick-pairs">
          <span className="dim" style={{ fontSize: 13 }}>Stabila kandidater (signifikanta på både 3 och 5 år):</span>
          {suggestions.map(([p, q]) => (
            <button key={p + q} className="chip" aria-pressed={p === a && q === b} onClick={() => go(p, q)}>{ticker(p)} / {ticker(q)}</button>
          ))}
        </div>

        {shortHistory && (
          <div className="notice"><span className="icon">!</span>Gemensam historik finns bara för {base.available} handelsdagar – fönstret är kortare än valt.</div>
        )}

        <div className="metrics">
          <Metric label="Engle-Granger p" info="cointegration" ctx={ctx} value={fmtP(base.eg.pvalue)} tone={toneP(base.eg.pvalue)[0]} toneLabel={toneP(base.eg.pvalue)[1]} sub={`omvänd: ${fmtP(base.egRev.pvalue)}`} />
          <Metric label="q-värde (FDR)" info="multiple-testing" ctx={ctx} value={pre.q == null ? "–" : fmtP(pre.q)} tone={pre.q == null ? undefined : pre.q < 0.05 ? "good" : pre.q < 0.2 ? "mid" : "bad"} toneLabel={pre.q == null ? undefined : pre.q < 0.05 ? "håller" : pre.q < 0.2 ? "osäkert" : "troligen slump"} sub={pre.q == null ? "bara för 1/3/5 år" : "435 par testade"} />
          <Metric label="Half-life" info="half-life" ctx={ctx} value={fmtDays(base.hl)} tone={toneHl(base.hl)[0]} toneLabel={toneHl(base.hl)[1]} />
          <Metric label="Hurst" info="hurst" ctx={ctx} value={fmt(base.H, 2)} tone={toneH(base.H)[0]} toneLabel={toneH(base.H)[1]} />
          <Metric label="Hedge ratio β" info="hedge-ratio" ctx={ctx} value={fmt(base.st.beta, 3)} sub={`Kalman idag ${fmt(live.kal.beta[last], 3)}`} />
          <Metric label="Korrelation" info="correlation" ctx={ctx} value={fmt(base.corr, 2)} sub="dagliga log-avkastningar" />
          <Metric label="Z-score nu" info="zscore" ctx={ctx} value={fmtSigned(zNow, 2)} tone={Math.abs(zNow) >= entry ? (zNow > 0 ? "bad" : "good") : "neutral"} toneLabel={Math.abs(zNow) >= entry ? (zNow > 0 ? "sälj spread" : "köp spread") : "ingen signal"} />
        </div>

        <div className="grid">
          <section className="card span-12">
            <div className="card-head">
              <h2 className="card-title"><span className="idx">01</span>Normaliserade kurser <Info id="normalized-prices" ctx={ctx} /></h2>
              <div className="card-tools">
                <Seg label="Fönster" value={w} onChange={(v) => { set("w", v); setXRange(null); }} options={WINDOWS.map(({ value, label }) => ({ value, label }))} />
                {xRange && <button className="btn" onClick={() => setXRange(null)}>Återställ zoom</button>}
              </div>
            </div>
            <div className="card-body"><Plot ariaLabel={`Normaliserade kurser för ${A} och ${B}`} data={priceData} height={260} xRange={xRange} onXRange={setXRange} layout={{ yaxis: { ticksuffix: "" } as any }} /></div>
            <Caption>Båda kurserna startar på 100. <b>Det du letar efter:</b> linjer som glider isär och sedan kommer tillbaka till varandra, om och om igen. Dra i grafen för att zooma – alla grafer på sidan följer med.</Caption>
          </section>

          <section className="card span-12">
            <div className="card-head">
              <h2 className="card-title"><span className="idx">02</span>Strategiinställningar</h2>
              <div className="card-tools">
                <span className="dim" style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>Hedge-metod för spread <Info id="hedge-ratio" ctx={ctx} /></span>
                <Seg label="Hedge-metod" value={hedge} onChange={(v) => set("hedge", v)} options={[{ value: "kalman", label: "Kalman" }, { value: "rolling", label: "Rullande OLS" }, { value: "static", label: "Statisk OLS" }]} />
              </div>
            </div>
            <div className="card-body">
              <div className="grid" style={{ gap: "10px 22px" }}>
                <div className="span-3">
                  {hedge === "kalman" && <Slider label="Kalman δ" info="kalman-delta" ctx={ctx} value={dexp} min={-9} max={-4} step={0.25} onChange={(v) => set("dexp", v)} format={fmtDelta} />}
                  {hedge !== "kalman" && <Slider label="Hedge-fönster" info="rolling-window" ctx={ctx} value={hw} min={20} max={500} step={10} onChange={(v) => set("hw", v)} format={(v) => `${v} d`} />}
                </div>
                <div className="span-3"><Slider label="Z-scorefönster" info="z-window" ctx={ctx} value={zw} min={10} max={250} step={5} onChange={(v) => set("zw", v)} format={(v) => `${v} d`} /></div>
                <div className="span-2"><Slider label="Ingång ±z" info="entry-threshold" ctx={ctx} value={entry} min={0.5} max={4} step={0.1} onChange={(v) => set("entry", Math.round(v * 10) / 10)} format={(v) => fmt(v, 1)} /></div>
                <div className="span-2"><Slider label="Utgång ±z" info="exit-threshold" ctx={ctx} value={exit} min={0} max={Math.max(0.1, entry - 0.1)} step={0.1} onChange={(v) => set("exit", Math.round(v * 10) / 10)} format={(v) => fmt(v, 1)} /></div>
                <div className="span-2"><Slider label="Stop-loss ±z" info="stop-loss" ctx={ctx} value={stop} min={2.5} max={8} step={0.5} onChange={(v) => set("stop", v)} format={(v) => (v >= 8 ? "av" : fmt(v, 1))} /></div>
              </div>
              {hedge === "static" && (
                <div className="notice" style={{ marginTop: 12 }}><span className="icon">!</span>
                  <span>Statisk OLS skattar β på hela fönstret – även framtiden. Bra för att förstå sambandet, men signalerna nedan har <b>look-ahead bias</b> och hade inte gått att handla på. <Info id="look-ahead" ctx={ctx} /></span>
                </div>
              )}
            </div>
          </section>

          <section className="card span-6">
            <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Hedge ratio över tid <Info id="kalman" ctx={ctx} /></h2></div>
            <div className="card-body"><Plot ariaLabel="Hedge ratio: Kalman, rullande OLS och statisk OLS" data={hedgeData} height={250} xRange={xRange} onXRange={setXRange} /></div>
            <Caption>Hur mycket {B} man blankar per krona {A}. Den streckade linjen är en enda OLS-skattning för hela perioden; Kalman och rullande OLS använder bara historik. <b>Stor skillnad = relationen har ändrats.</b></Caption>
          </section>

          <section className="card span-6">
            <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Spread <Info id="spread" ctx={ctx} /></h2></div>
            <div className="card-body"><Plot ariaLabel="Spread med rullande band" data={spreadData} height={250} xRange={xRange} onXRange={setXRange} /></div>
            <Caption>Spread = log({A}) − β·log({B}). Det skuggade bandet är ±2 standardavvikelser kring det rullande medlet. <b>En bra spread studsar mellan banden</b>; en som stannar utanför har tappat sitt samband.</Caption>
          </section>

          <section className="card span-12">
            <div className="card-head">
              <h2 className="card-title"><span className="idx">05</span>Z-score och signaler <Info id="zscore" ctx={ctx} /> <Info id="signals" ctx={ctx} /></h2>
              <div className="legend">
                <span><i style={{ background: prim }} />ingång ±{fmt(entry, 1)}</span>
                <span><i style={{ background: txt3 }} />utgång ±{fmt(exit, 1)}</span>
                {stop < 8 && <span><i style={{ background: warn }} />stop ±{fmt(stop, 1)}</span>}
                <span className="mono">{trades} affärer{stops ? ` · ${stops} stop` : ""}</span>
              </div>
            </div>
            <div className="card-body"><Plot ariaLabel="Z-score med in- och utgångströsklar och signaler" data={zData} height={300} xRange={xRange} onXRange={setXRange} layout={zLayout} /></div>
            <Caption>
              ▲ = spreaden är ovanligt låg → köp {A}, blanka {B}. ▼ = ovanligt hög → tvärtom. ● = tillbaka nära medel, stäng. Grön/röd bakgrund = öppen position.
              Signalen räknas på dagens stängningskurs och utförs först nästa dag, så inget bygger på information man inte hade. Hovra över linjen för en tolkning dag för dag.
            </Caption>
          </section>

          <Lab3D A={A} B={B} dates={base.dates} ly={base.ly} lx={base.lx} spread={live.model.spread} beta={live.model.beta}
            entry={entry} exit={exit} stop={stop} zw={zw} full={full} ctx={ctx}
            hedgeLabel={hedge === "kalman" ? "Kalman" : hedge === "rolling" ? `rullande OLS ${hw} d` : "statisk OLS"} />

          <section className="card span-5">
            <div className="card-head"><h2 className="card-title"><span className="idx">07</span>Bedömning</h2><span className={`tag ${verdict.tone}`}>{verdict.text} · {score}/6</span></div>
            <div className="card-body">
              <table className="data">
                <tbody>
                  {checks.map((c) => (
                    <tr key={c.label}>
                      <td style={{ width: 22 }} className={c.ok == null ? "dim" : c.ok ? "pos" : "neg"}>{c.ok == null ? "–" : c.ok ? "✓" : "✕"}</td>
                      <td><span className="row" style={{ gap: 6 }}>{c.label} <Info id={c.info} ctx={ctx} /></span></td>
                      <td className="num dim">{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mode === "beginner" && <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>Inget enskilt test räcker. Ett bra par klarar de flesta kriterierna – och har en ekonomisk förklaring (samma bransch, liknande kunder, gemensamma ägare).</p>}
            </div>
          </section>

          <section className="card span-7">
            <div className="card-head"><h2 className="card-title"><span className="idx">08</span>Testdetaljer</h2><span className="dim mono" style={{ fontSize: 12 }}>n = {n} · {base.dates[0]} – {base.dates[last]}</span></div>
            <div className="card-body" style={{ overflowX: "auto" }}>
              <table className="data">
                <thead><tr><th>Test</th><th className="num">Statistik</th><th className="num">p</th><th className="num">1 %</th><th className="num">5 %</th><th className="num">10 %</th></tr></thead>
                <tbody>
                  <tr><td><span className="row" style={{ gap: 6 }}>Engle-Granger {ticker(a)} ~ {ticker(b)} <Info id="cointegration" ctx={ctx} /></span></td><td className="num">{fmt(base.eg.stat, 3)}</td><td className="num">{fmtP(base.eg.pvalue)}</td><td className="num dim">{fmt(base.eg.crit["1%"], 2)}</td><td className="num dim">{fmt(base.eg.crit["5%"], 2)}</td><td className="num dim">{fmt(base.eg.crit["10%"], 2)}</td></tr>
                  <tr><td>Engle-Granger {ticker(b)} ~ {ticker(a)}</td><td className="num">{fmt(base.egRev.stat, 3)}</td><td className="num">{fmtP(base.egRev.pvalue)}</td><td className="num dim">{fmt(base.egRev.crit["1%"], 2)}</td><td className="num dim">{fmt(base.egRev.crit["5%"], 2)}</td><td className="num dim">{fmt(base.egRev.crit["10%"], 2)}</td></tr>
                  <tr><td><span className="row" style={{ gap: 6 }}>ADF på OLS-spread ({base.adf.usedlag} laggar) <Info id="adf" ctx={ctx} /></span></td><td className="num">{fmt(base.adf.stat, 3)}</td><td className="num">{fmtP(base.adf.pvalue)}</td><td className="num dim">{fmt(base.adf.crit["1%"], 2)}</td><td className="num dim">{fmt(base.adf.crit["5%"], 2)}</td><td className="num dim">{fmt(base.adf.crit["10%"], 2)}</td></tr>
                </tbody>
              </table>
              <table className="data" style={{ marginTop: 14 }}>
                <thead><tr><th><span className="row" style={{ gap: 6 }}>Johansen <Info id="johansen" ctx={ctx} /></span></th><th className="num">Trace</th><th className="num">Krit. 95 %</th><th className="num">Max-egenv.</th><th className="num">Krit. 95 %</th><th>Slutsats</th></tr></thead>
                <tbody>
                  {(["r = 0", "r ≤ 1"] as const).map((lab, i) => {
                    const rej = base.joh.trace[i] > base.joh.traceCrit[i][1];
                    return (
                      <tr key={lab}><td>{lab}</td><td className="num">{fmt(base.joh.trace[i], 2)}</td><td className="num dim">{fmt(base.joh.traceCrit[i][1], 2)}</td><td className="num">{fmt(base.joh.maxEig[i], 2)}</td><td className="num dim">{fmt(base.joh.maxEigCrit[i][1], 2)}</td>
                        <td className={i === 0 ? (rej ? "pos" : "dim") : rej ? "warn" : "dim"}>{i === 0 ? (rej ? "samband finns" : "inget samband") : rej ? "båda stationära?" : "högst ett samband"}</td></tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="dim" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
                Johansen-vektorn ger hedge ratio {fmt(-base.joh.vector[1], 3)} (jämför OLS {fmt(base.st.beta, 3)}). Kritiska värden: MacKinnon (2010) och Osterwald-Lenum. Siffrorna är verifierade mot statsmodels.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
