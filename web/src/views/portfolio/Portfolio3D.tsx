import { useMemo, useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Seg } from "../../components/Slider";
import { fmt, fmtPct } from "../../lib/format";
import { covariance, maxSharpe, meanReturns, minVariance, monteCarlo, randomPortfolios, riskContrib, type ReturnMatrix } from "../../lib/portfolio/engine";
import { sharpe } from "../../lib/stats/backtest";

type Tab = "frontier" | "mc" | "risk";
interface Props { M: ReturnMatrix; weights: number[]; ret: Float64Array; drift: Float64Array[]; tickers: string[]; value: number; ctx: Record<string, unknown>; name: (t: string) => string }

export function Portfolio3D(props: Props) {
  const [tab, setTab] = useState<Tab>("frontier");
  return (
    <section className="card span-12 lab3d">
      <div className="card-head">
        <h2 className="card-title"><span className="idx">07</span>3D-labb <span className="dim" style={{ fontWeight: 400 }}>· dra för att rotera</span></h2>
        <Seg label="3D-vy" value={tab} onChange={setTab} options={[{ value: "frontier", label: "Effektiva fronten" }, { value: "mc", label: "Monte Carlo-kon" }, { value: "risk", label: "Riskterräng" }]} />
      </div>
      {tab === "frontier" && <Frontier {...props} />}
      {tab === "mc" && <MonteCarloCone {...props} />}
      {tab === "risk" && <RiskTerrain {...props} />}
    </section>
  );
}

function portStats(mu: number[], C: number[][], w: number[]) {
  const m = w.reduce((s, wj, j) => s + wj * mu[j], 0) * 252;
  const v = riskContrib(C, w).vol * Math.sqrt(252);
  return { ret: m, vol: v, sharpe: m / v };
}

function Frontier({ M, weights, tickers, ctx, name }: Props) {
  const res = useMemo(() => {
    if (tickers.length < 2) return null;
    const mu = meanReturns(M.R), C = covariance(M.R);
    const cloud = randomPortfolios(mu, C, 3000);
    const wMin = minVariance(C), wMax = maxSharpe(mu, C);
    const eq = tickers.map(() => 1 / tickers.length);
    // Överanpassningstest: optimera på första halvan, utvärdera på andra
    const half = Math.floor(M.dates.length / 2);
    const R1 = M.R.map((r) => r.subarray(0, half));
    const wIs = maxSharpe(meanReturns(R1), covariance(R1));
    const oos = (w: number[]) => sharpe(Array.from({ length: M.dates.length - half }, (_, k) => w.reduce((s, wj, j) => s + wj * M.R[j][half + k], 0)));
    const isS = (w: number[]) => sharpe(Array.from({ length: half }, (_, k) => w.reduce((s, wj, j) => s + wj * M.R[j][k], 0)));
    return {
      mu, C, cloud, wMin, wMax,
      cur: portStats(mu, C, weights), min: portStats(mu, C, wMin), max: portStats(mu, C, wMax), eq: portStats(mu, C, eq),
      singles: tickers.map((_, i) => ({ vol: Math.sqrt(C[i][i] * 252), ret: mu[i] * 252 })),
      test: { isMax: isS(wIs), oosMax: oos(wIs), oosEq: oos(eq), split: M.dates[half] },
    };
  }, [M, weights.join(","), tickers.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!res) return <div className="card-body muted">Lägg till minst två aktier för att se fronten.</div>;
  const accent = cssVar("--accent"), txt = cssVar("--text");
  const mk = (pt: { vol: number; ret: number; sharpe: number }, label: string, color: string, symbol: string, size = 9): Data => ({
    type: "scatter3d", mode: "markers+text", x: [pt.vol], y: [pt.ret], z: [pt.sharpe + 0.04], text: [label], textposition: "top center",
    textfont: { color: txt, size: 12, family: cssVar("--font") }, marker: { size, color, symbol, line: { color: "#000", width: 1 } },
    hovertemplate: `<b>${label}</b><br>Risk %{x:.1%} · Avkastning %{y:.1%}<br>Sharpe ${fmt(pt.sharpe, 2)}<extra></extra>`,
  } as any);
  const sh = res.cloud.map((c) => c.sharpe);
  const data: Data[] = [
    {
      type: "scatter3d", mode: "markers", x: res.cloud.map((c) => c.vol), y: res.cloud.map((c) => c.ret), z: sh,
      marker: { size: 2.2, color: sh, colorscale: [[0, cssVar("--series-b")], [0.5, cssVar("--primary-strong")], [1, "#fff4e6"]], opacity: 0.75,
        colorbar: { thickness: 8, len: 0.55, title: { text: "Sharpe", side: "right", font: { size: 11 } }, tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") } } },
      customdata: res.cloud.map((c) => c.w.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([v, i]) => `${name(tickers[i])} ${fmt(v * 100, 0)} %`).join(", ")) as any,
      hovertemplate: "Slumpad portfölj<br>Risk %{x:.1%} · Avkastning %{y:.1%} · Sharpe %{z:.2f}<br><i>Störst: %{customdata}</i><extra></extra>",
    } as any,
    {
      type: "scatter3d", mode: "markers", x: res.singles.map((s) => s.vol), y: res.singles.map((s) => s.ret), z: res.singles.map((s) => s.ret / s.vol),
      marker: { size: 4, color: cssVar("--text-3"), symbol: "circle-open" }, text: tickers.map((t) => name(t)) as any,
      hovertemplate: "%{text} ensam<br>Risk %{x:.1%} · Avkastning %{y:.1%}<extra></extra>",
    } as any,
    mk(res.cur, "Din portfölj", "#fff", "diamond", 10),
    mk(res.max, "Max Sharpe", accent, "circle"),
    mk(res.min, "Minsta risk", cssVar("--pos"), "circle"),
    mk(res.eq, "Lika vikt", cssVar("--series-b"), "square", 7),
  ];
  const t = res.test;
  return (
    <>
      <div className="card-body">
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>3 000 slumpade portföljer av dina {tickers.length} aktier. Vågrätt: risk och avkastning, höjd och färg: Sharpe.</span>
          <Info id="efficient-frontier" ctx={ctx} />
          <span className="spacer" />
          <div className="lab-stat">
            <span>Max Sharpe optimerad före {t.split}</span><b className="num">{fmt(t.isMax, 2)}</b><span className="arrow">→ efter:</span>
            <b className={`num ${t.oosMax < t.oosEq ? "neg" : "pos"}`}>{fmt(t.oosMax, 2)}</b><span>· lika vikt efter:</span><b className="num">{fmt(t.oosEq, 2)}</b>
            <Info id="estimation-error" ctx={ctx} />
          </div>
        </div>
        <Plot ariaLabel="3D: effektiva fronten med slumpade portföljer" data={data} height={540}
          layout={scene3d({ x: "Risk (volatilitet/år)", y: "Avkastning/år", z: "Sharpe" }, {
            xaxis: { tickformat: ".0%", title: { text: "Risk / år" } }, yaxis: { tickformat: ".0%", title: { text: "Avkastning / år" } },
            camera: { eye: { x: 0.2, y: -2.0, z: 0.9 } },
          } as any)} />
      </div>
      <Caption>
        Varje prick är en portfölj med samma aktier men andra vikter. <b>Övre vänstra kanten är "effektiva fronten"</b> – mest avkastning per risk. Vita diamanten är din portfölj, grå ringar är aktierna var för sig – notera att nästan alla portföljer har lägre risk än aktierna ensamma (det är diversifiering).
        Men se upp: vikterna som var bäst före {t.split} gav Sharpe {fmt(t.oosMax, 2)} efteråt, mot {fmt(t.oosEq, 2)} för lika vikt. {t.oosMax < t.oosEq ? "Optimeringen höll inte – ett typiskt exempel på skattningsfel." : "Den här gången höll optimeringen – det är ovanligt."}
      </Caption>
    </>
  );
}

function MonteCarloCone({ ret, value, ctx }: Props) {
  const [horizon, setHorizon] = useState(252);
  const res = useMemo(() => {
    const mc = monteCarlo(ret, horizon, 2500);
    // täthetsyta: för varje horisont, histogram över portföljvärde
    const lo = Math.min(...mc.p05) * 0.85, hi = Math.max(...mc.p95) * 1.12;
    const bins = 70, step = (hi - lo) / bins;
    const ys = Array.from({ length: bins }, (_, i) => lo + (i + 0.5) * step);
    const z = ys.map(() => [] as number[]);
    mc.finals.forEach((f) => {
      const h = new Array(bins).fill(0);
      f.forEach((v) => { const b = Math.floor((v - lo) / step); if (b >= 0 && b < bins) h[b]++; });
      // lätt utjämning
      const sm = h.map((_, i) => (h[i - 1] ?? 0) * 0.25 + h[i] * 0.5 + (h[i + 1] ?? 0) * 0.25);
      sm.forEach((c, i) => z[i].push(c / f.length));
    });
    return { mc, ys, z };
  }, [ret, horizon]);
  const { mc } = res;
  const last = mc.hs.length - 1;
  const line = (arr: number[], color: string, width: number, label: string): Data => ({
    type: "scatter3d", mode: "lines", x: mc.hs, y: arr.map((v) => v * value), z: arr.map(() => 0), line: { color, width }, name: label,
    hovertemplate: `${label}<br>Om %{x} dagar: %{y:,.0f} kr<extra></extra>`,
  } as any);
  const data: Data[] = [
    {
      type: "surface", x: mc.hs, y: res.ys.map((v) => v * value), z: res.z as any, showscale: false, opacity: 0.95,
      colorscale: [[0, "rgba(0,0,0,0)"], [0.04, cssVar("--surface-2")], [0.35, cssVar("--primary-strong")], [0.75, cssVar("--accent")], [1, "#fff4e6"]],
      lighting: { ambient: 0.55, diffuse: 0.8, specular: 0.5, roughness: 0.4 },
      hovertemplate: "Om %{x} dagar<br>Värde ≈ %{y:,.0f} kr<br>Andel av utfallen %{z:.1%}<extra></extra>",
    } as any,
    line(mc.p50, "#fff", 6, "Median"),
    line(mc.p05, cssVar("--neg"), 4, "5 % sämsta"),
    line(mc.p95, cssVar("--pos"), 4, "5 % bästa"),
    { type: "scatter3d", mode: "lines", x: [mc.hs[0], mc.hs[last]], y: [value, value], z: [0, 0], line: { color: cssVar("--text-3"), width: 3, dash: "dash" }, hoverinfo: "skip" } as any,
  ];
  return (
    <>
      <div className="card-body">
        <div className="row" style={{ marginBottom: 8 }}>
          <Seg label="Horisont" value={horizon} onChange={setHorizon} options={[{ value: 63, label: "3 mån" }, { value: 252, label: "1 år" }, { value: 756, label: "3 år" }]} />
          <Info id="monte-carlo" ctx={ctx} />
          <span className="spacer" />
          <div className="lab-stat">
            <span>Median</span><b className="num">{fmt(mc.p50[last] * value, 0)} kr</b>
            <span>· 5 % sämsta</span><b className="num neg">{fmt(mc.p05[last] * value, 0)} kr</b>
            <span>· risk för förlust</span><b className="num">{fmtPct(mc.lossProb[last], 0)}</b>
          </div>
        </div>
        <Plot ariaLabel="3D: Monte Carlo-simulering av portföljens framtida värde" data={data} height={540}
          layout={scene3d({ x: "Dagar framåt", y: "Portföljvärde (kr)", z: "Andel utfall" }, { camera: { eye: { x: -1.6, y: -1.3, z: 0.9 } }, yaxis: { tickformat: ",.0f", title: { text: "Värde (kr)" } } } as any)} />
      </div>
      <Caption>
        2 500 simulerade framtider byggda av portföljens egna historiska dagar, dragna i block om 10 dagar. Berget visar var utfallen hamnar: <b>smalt och högt i början, brett och lågt längre fram</b> – osäkerheten växer med tiden.
        Vit linje = median, röd = ett av tjugo dåliga utfall, grön = ett av tjugo bra. Streckad linje = det du satte in ({fmt(value, 0)} kr). Simuleringen kan aldrig visa något värre än historiken innehåller.
      </Caption>
    </>
  );
}

function RiskTerrain({ M, weights, tickers, ctx, name }: Props) {
  const res = useMemo(() => {
    const W = 126, step = 7, n = M.dates.length;
    const xs: string[] = [];
    const z = tickers.map(() => [] as number[]);
    for (let e = W; e <= n; e += step) {
      const C = covariance(M.R, e - W, e);
      const rc = riskContrib(C, weights);
      xs.push(M.dates[e - 1]);
      rc.share.forEach((s, i) => z[i].push(s));
    }
    return { xs, z };
  }, [M, weights.join(","), tickers.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (res.xs.length < 3) return <div className="card-body muted">För kort historik – välj ett längre fönster.</div>;
  const data: Data[] = [{
    type: "surface", x: res.xs, y: tickers.map((_, i) => i), z: res.z as any,
    colorscale: [[0, cssVar("--surface-2")], [0.3, cssVar("--series-b")], [0.6, cssVar("--primary-strong")], [1, "#fff4e6"]],
    customdata: tickers.map((t) => res.xs.map(() => name(t))) as any,
    hovertemplate: "%{customdata}<br>%{x}<br><b>%{z:.0%} av risken</b><extra></extra>",
    lighting: { ambient: 0.55, diffuse: 0.7, specular: 0.4, roughness: 0.4 },
    colorbar: { thickness: 8, len: 0.55, tickformat: ".0%", tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") } },
  } as any];
  return (
    <>
      <div className="card-body">
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Varje akties andel av portföljens risk, rullande halvår, över tid.</span>
          <Info id="risk-contribution" ctx={ctx} />
        </div>
        <Plot ariaLabel="3D: riskbidrag per aktie över tid" data={data} height={540}
          layout={scene3d({ x: "Datum", y: "Aktie", z: "Andel av risken" }, {
            yaxis: { tickvals: tickers.map((_, i) => i), ticktext: tickers.map((t) => t.replace(".ST", "")), title: { text: "" } },
            zaxis: { tickformat: ".0%" }, aspectratio: { x: 1.9, y: 1.1, z: 0.6 }, camera: { eye: { x: -1.2, y: -1.7, z: 1.0 } },
          } as any)} />
      </div>
      <Caption>
        En "bergskedja" per aktie. Ju högre berg, desto större del av portföljens svängningar kom från den aktien just då. <b>Toppar som växer fram visar när en aktie började dominera risken</b> – ofta i samband med rapporter, kriser eller när den blivit mer volatil. Med lika vikt borde alla berg vara ungefär lika höga; skillnaden är effekten av volatilitet och korrelation.
      </Caption>
    </>
  );
}
