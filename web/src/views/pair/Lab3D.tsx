/**
 * 3D-labbet i Paranalys. Tre vyer som var och en svarar på en riktig kvantfråga:
 *   1. Parameterlandskap  – hur känslig är strategin för valet av parametrar? (överanpassning)
 *   2. Samintegration i tid – håller sambandet, eller kommer och går det? (regimskiften)
 *   3. OU-prognoskon       – vart väntas spreaden ta vägen härifrån? (mean reversion)
 */
import { useMemo, useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Seg } from "../../components/Slider";
import { fmt, fmtPct } from "../../lib/format";
import { pairReturns, sharpe } from "../../lib/stats/backtest";
import { rollingZ } from "../../lib/stats/meanrev";
import { simpleOls } from "../../lib/stats/ols";
import { positionsFromState, signals } from "../../lib/stats/strategy";
import { coint, normCdf } from "../../lib/stats/tests";

type Tab = "landscape" | "coint" | "ou";

export interface Lab3DProps {
  A: string; B: string;
  dates: string[];
  ly: Float64Array; lx: Float64Array;
  spread: Float64Array; beta: Float64Array;
  entry: number; exit: number; stop: number; zw: number;
  full: { dates: string[]; ly: Float64Array; lx: Float64Array };
  hedgeLabel: string;
  ctx: Record<string, unknown>;
}

export function Lab3D(props: Lab3DProps) {
  const [tab, setTab] = useState<Tab>("landscape");
  return (
    <section className="card span-12 lab3d">
      <div className="card-head">
        <h2 className="card-title"><span className="idx">06</span>3D-labb <span className="dim" style={{ fontWeight: 400 }}>· dra för att rotera, scrolla i grafen för att zooma</span></h2>
        <Seg label="3D-vy" value={tab} onChange={setTab} options={[
          { value: "landscape", label: "Parameterlandskap" },
          { value: "coint", label: "Samintegration i tid" },
          { value: "ou", label: "OU-prognoskon" },
        ]} />
      </div>
      {tab === "landscape" && <Landscape {...props} />}
      {tab === "coint" && <CointSurface {...props} />}
      {tab === "ou" && <OuCone {...props} />}
    </section>
  );
}

// ───────────────────────── 1. Parameterlandskap ─────────────────────────
const ENTRIES = Array.from({ length: 13 }, (_, i) => 0.8 + i * 0.2);
const ZWS = Array.from({ length: 20 }, (_, i) => 10 + i * 10);

function Landscape({ A, B, ly, lx, spread, beta, entry, exit, stop, zw, ctx }: Lab3DProps) {
  const [sample, setSample] = useState<"all" | "is" | "oos">("is");
  const grid = useMemo(() => {
    const n = ly.length, half = Math.floor(n / 2);
    const out = { all: [] as number[][], is: [] as number[][], oos: [] as number[][] };
    for (const w of ZWS) {
      const z = rollingZ(spread, w);
      const rowAll: number[] = [], rowIs: number[] = [], rowOos: number[] = [];
      for (const e of ENTRIES) {
        const st = signals(z, { entry: e, exit: Math.min(exit, e - 0.1), stop: stop >= 8 ? Infinity : stop }).state;
        const r = pairReturns(ly, lx, beta, positionsFromState(st, 1)).ret;
        rowAll.push(sharpe(r));
        rowIs.push(sharpe(r.subarray(0, half)));
        rowOos.push(sharpe(r.subarray(half)));
      }
      out.all.push(rowAll); out.is.push(rowIs); out.oos.push(rowOos);
    }
    // Bästa in-sample → vad hände out-of-sample?
    let best = { i: 0, j: 0, v: -Infinity };
    out.is.forEach((row, i) => row.forEach((v, j) => { if (Number.isFinite(v) && v > best.v) best = { i, j, v }; }));
    return { ...out, best, half };
  }, [ly, lx, spread, beta, exit, stop]);

  const surf = grid[sample];
  const clean = surf.map((r) => r.map((v) => (Number.isFinite(v) ? v : null)));
  const ci = ZWS.indexOf(Math.round(zw / 10) * 10), cj = ENTRIES.findIndex((e) => Math.abs(e - entry) < 0.11);
  const cur = ci >= 0 && cj >= 0 ? surf[ci][cj] : NaN;
  const bestIs = grid.is[grid.best.i][grid.best.j], bestOos = grid.oos[grid.best.i][grid.best.j];
  const neg = cssVar("--neg"), accent = cssVar("--accent"), mid = cssVar("--surface-2");
  const absMax = Math.max(1, ...clean.flat().filter((v): v is number => v != null).map(Math.abs));

  const data: Data[] = [
    {
      type: "surface", x: ENTRIES, y: ZWS, z: clean as any,
      colorscale: [[0, neg], [0.42, "#5a3a3a"], [0.5, mid], [0.62, cssVar("--primary-strong")], [0.85, accent], [1, "#fff4e6"]], cmin: -absMax, cmax: absMax,
      contours: { z: { show: true, usecolormap: true, highlightcolor: "#fff", project: { z: true } } } as any,
      lighting: { ambient: 0.55, diffuse: 0.7, specular: 0.35, roughness: 0.5, fresnel: 0.3 },
      colorbar: { thickness: 10, len: 0.6, tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") }, title: { text: "Sharpe", side: "right", font: { size: 11 } } } as any,
      hovertemplate: "Ingång ±%{x:.1f} · z-fönster %{y} d<br><b>Sharpe %{z:.2f}</b><extra></extra>",
      opacity: 0.97,
    } as any,
    ...(Number.isFinite(cur) ? [{
      type: "scatter3d", mode: "markers+text", x: [entry], y: [ZWS[ci]], z: [cur + absMax * 0.12], text: ["dina inställningar"], textposition: "top center",
      textfont: { color: cssVar("--text"), size: 12 }, marker: { size: 6, color: "#fff", line: { color: "#000", width: 1 } },
      hovertemplate: `Dina inställningar<br>Sharpe ${fmt(cur, 2)}<extra></extra>`,
    } as any] : []),
    ...(sample !== "all" ? [{
      type: "scatter3d", mode: "markers", x: [ENTRIES[grid.best.j]], y: [ZWS[grid.best.i]], z: [surf[grid.best.i][grid.best.j]],
      marker: { size: 7, color: accent, symbol: "diamond", line: { color: "#000", width: 1 } },
      hovertemplate: `Bästa in-sample-kombinationen<extra></extra>`,
    } as any] : []),
  ];
  return (
    <>
      <div className="card-body">
        <div className="row" style={{ marginBottom: 8 }}>
          <Seg label="Urval" value={sample} onChange={setSample} options={[{ value: "is", label: "In-sample (1:a halvan)" }, { value: "oos", label: "Out-of-sample (2:a halvan)" }, { value: "all", label: "Hela" }]} />
          <Info id="param-landscape" ctx={{ ...ctx, bestIs, bestOos }} />
          <span className="spacer" />
          <div className="lab-stat">
            <span>Bästa in-sample</span><b className="num">{fmt(bestIs, 2)}</b>
            <span className="arrow">→</span>
            <span>samma inställning out-of-sample</span><b className={`num ${bestOos < bestIs / 2 ? "neg" : "pos"}`}>{fmt(bestOos, 2)}</b>
          </div>
        </div>
        <Plot ariaLabel="3D-yta: Sharpe som funktion av ingångströskel och z-fönster" data={data} height={520}
          layout={scene3d({ x: "Ingång ±z", y: "Z-fönster (d)", z: "Sharpe" })} />
      </div>
      <Caption>
        Varje punkt på ytan är en hel backtest av {A}/{B} med en viss kombination av ingångströskel och z-fönster (efter kostnader).
        <b> Leta efter platåer, inte toppar:</b> en smal spik betyder att resultatet hänger på exakt den inställningen – det är överanpassning.
        Växla mellan in-sample och out-of-sample: den bästa punkten i första halvan ({fmt(bestIs, 2)}) gav {fmt(bestOos, 2)} i andra halvan.
      </Caption>
    </>
  );
}

// ───────────────────────── 2. Samintegration i tid ─────────────────────────
const CW = [126, 189, 252, 378, 504, 756, 1008];

function CointSurface({ A, B, full, ctx }: Lab3DProps) {
  const res = useMemo(() => {
    const n = full.ly.length, step = 15;
    const ends: number[] = [];
    for (let e = CW[0]; e <= n; e += step) ends.push(e);
    if (ends[ends.length - 1] !== n) ends.push(n);
    const z: (number | null)[][] = CW.map(() => []);
    const p: (number | null)[][] = CW.map(() => []);
    CW.forEach((w, i) => {
      for (const e of ends) {
        if (e < w) { z[i].push(null); p[i].push(null); continue; }
        const y = full.ly.subarray(e - w, e), x = full.lx.subarray(e - w, e);
        // Förenklat test med 1 lagg (för fart). EG åt båda håll, bästa p.
        const pv = Math.min(coint(y, x, { maxlag: 1, autolag: null }).pvalue, coint(x, y, { maxlag: 1, autolag: null }).pvalue);
        p[i].push(pv);
        z[i].push(-Math.log10(Math.max(pv, 1e-6)));
      }
    });
    const flat = p.flat().filter((v): v is number => v != null);
    return { ends: ends.map((e) => full.dates[e - 1]), z, p, share: flat.filter((v) => v < 0.05).length / flat.length };
  }, [full]);

  const thr = -Math.log10(0.05);
  const data: Data[] = [
    {
      type: "surface", x: res.ends, y: CW, z: res.z as any, customdata: res.p as any,
      colorscale: [[0, cssVar("--surface-2")], [0.3, "#3b3b44"], [0.5, cssVar("--primary-strong")], [0.75, cssVar("--accent")], [1, "#fff6ea"]],
      cmin: 0, cmax: 4,
      contours: { z: { show: true, start: thr, end: thr, size: 1, color: cssVar("--pos"), width: 4 } } as any,
      lighting: { ambient: 0.6, diffuse: 0.6, specular: 0.4, roughness: 0.4 },
      colorbar: { thickness: 10, len: 0.6, tickvals: [0, 1, 1.3, 2, 3, 4], ticktext: ["1", "0,1", "0,05", "0,01", "0,001", "<0,0001"], tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") }, title: { text: "p-värde", side: "right", font: { size: 11 } } } as any,
      hovertemplate: "Slut %{x}<br>Fönster %{y} d<br><b>p = %{customdata:.4f}</b><extra></extra>",
    } as any,
    {
      type: "surface", x: [res.ends[0], res.ends[res.ends.length - 1]], y: [CW[0], CW[CW.length - 1]], z: [[thr, thr], [thr, thr]],
      showscale: false, opacity: 0.18, colorscale: [[0, cssVar("--pos")], [1, cssVar("--pos")]], hoverinfo: "skip",
    } as any,
  ];
  return (
    <>
      <div className="card-body">
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Engle-Granger p-värde för varje kombination av fönsterlängd och slutdatum, hela historiken.</span>
          <Info id="coint-surface" ctx={{ ...ctx, share: res.share }} />
          <span className="spacer" />
          <div className="lab-stat"><span>Andel av ytan med p &lt; 0,05</span><b className="num">{fmtPct(res.share, 0)}</b></div>
        </div>
        <Plot ariaLabel="3D-yta: samintegrationens p-värde över tid och fönsterlängd" data={data} height={520}
          layout={scene3d({ x: "Fönstrets slutdatum", y: "Fönsterlängd (d)", z: "−log₁₀ p" }, { aspectratio: { x: 1.8, y: 1, z: 0.6 } })} />
      </div>
      <Caption>
        Höjd = hur starkt {A} och {B} var samintegrerade. Allt som sticker upp genom det gröna glasplanet har p &lt; 0,05.
        <b> Ett riktigt par är en bergskedja som löper genom hela tiden.</b> Isolerade toppar och dalar betyder att sambandet kommer och går –
        då kan en scanner som bara tittar på ett fönster lura dig. Förenklat test (1 lagg) för att det ska gå snabbt.
      </Caption>
    </>
  );
}

// ───────────────────────── 3. OU-prognoskon ─────────────────────────
function OuCone({ A, B, spread, exit, entry, ctx, hedgeLabel }: Lab3DProps) {
  const [start, setStart] = useState<"auto" | "today" | "entry" | "extreme">("auto");
  const res = useMemo(() => {
    const s: number[] = [];
    for (const v of spread) if (Number.isFinite(v)) s.push(v);
    // AR(1): s_t = c + φ s_{t−1} + ε
    const y = s.slice(1), x = s.slice(0, -1);
    const { alpha: c, beta: phi } = simpleOls(y, x);
    let v = 0;
    for (let i = 0; i < y.length; i++) v += (y[i] - c - phi * x[i]) ** 2;
    const sig = Math.sqrt(v / (y.length - 2));
    const mr = phi > 0 && phi < 1;
    const mu = mr ? c / (1 - phi) : s.reduce((a, b) => a + b, 0) / s.length;
    const sdEq = mr ? sig / Math.sqrt(1 - phi * phi) : Math.sqrt(s.reduce((a, b) => a + (b - mu) ** 2, 0) / s.length);
    const zToday = (s[s.length - 1] - mu) / sdEq;
    const mode = start === "auto" ? (Math.abs(zToday) < 1 ? "entry" : "today") : start;
    const zStart = mode === "today" ? zToday : mode === "entry" ? entry : 3.5;
    const s0 = mu + zStart * sdEq;
    const hl = mr ? -Math.LN2 / Math.log(phi) : Infinity;
    const H = Math.round(Math.min(120, Math.max(30, Number.isFinite(hl) ? 4 * hl : 60)));
    const hs = Array.from({ length: H }, (_, i) => i + 1);
    const us = Array.from({ length: 81 }, (_, i) => -4 + i * 0.1);
    const mean: number[] = [], sd: number[] = [], inside: number[] = [];
    const z = us.map(() => [] as number[]);
    for (const h of hs) {
      const m = mr ? mu + (s0 - mu) * Math.pow(phi, h) : s0;
      const vh = mr ? (sig * sig * (1 - Math.pow(phi, 2 * h))) / (1 - phi * phi) : sig * sig * h;
      const sdh = Math.sqrt(vh);
      mean.push((m - mu) / sdEq); sd.push(sdh / sdEq);
      const lo = mu - exit * sdEq, hi = mu + exit * sdEq;
      inside.push(normCdf((hi - m) / sdh) - normCdf((lo - m) / sdh));
      us.forEach((u, k) => {
        const val = mu + u * sdEq;
        // täthet i z-enheter: smal och hög nära idag, bred och låg längre fram
        z[k].push(Math.exp(-0.5 * ((val - m) / sdh) ** 2) / ((sdh / sdEq) * Math.sqrt(2 * Math.PI)));
      });
    }
    const peak = Math.max(...z.flat());
    return { hs, us, z, mean, sd, inside, z0: zStart, zToday, mode, hl, mr, H, peak };
  }, [spread, exit, entry, start]);

  const accent = cssVar("--accent"), pos = cssVar("--pos"), prim = cssVar("--primary");
  const at = (h: number) => res.inside[Math.min(h, res.H) - 1];
  const data: Data[] = [
    {
      type: "surface", x: res.hs, y: res.us, z: res.z as any,
      colorscale: [[0, "rgba(0,0,0,0)"], [0.05, cssVar("--surface-2")], [0.4, cssVar("--primary-strong")], [0.8, accent], [1, "#fff6ea"]],
      showscale: false, opacity: 0.95,
      lighting: { ambient: 0.5, diffuse: 0.8, specular: 0.6, roughness: 0.35, fresnel: 0.4 },
      hovertemplate: "Om %{x} dagar<br>z = %{y:.1f}<br>sannolikhetstäthet %{z:.2f}<extra></extra>",
    } as any,
    {
      type: "scatter3d", mode: "lines", x: res.hs, y: res.mean, z: res.mean.map((_, i) => 1 / (res.sd[i] * Math.sqrt(2 * Math.PI)) + res.peak * 0.03), name: "Förväntad bana",
      line: { color: "#fff", width: 6 },
      customdata: res.inside.map((p, i) => [p, res.sd[i]]) as any,
      hovertemplate: "Om %{x} dagar: förväntat z = %{y:.2f}<br>±1σ-band ±%{customdata[1]:.2f}<br><b>%{customdata[0]:.0%} chans innanför utgången</b><extra></extra>",
    } as any,
    ...[exit, -exit].map((e) => ({ type: "scatter3d", mode: "lines", x: [1, res.H], y: [e, e], z: [0, 0], line: { color: pos, width: 4, dash: "dash" }, hoverinfo: "skip", showlegend: false } as any)),
    ...[entry, -entry].map((e) => ({ type: "scatter3d", mode: "lines", x: [1, res.H], y: [e, e], z: [0, 0], line: { color: prim, width: 3, dash: "dot" }, hoverinfo: "skip", showlegend: false } as any)),
  ];
  return (
    <>
      <div className="card-body">
        <div className="row" style={{ marginBottom: 8 }}>
          <Seg label="Startläge" value={start === "auto" ? res.mode as "today" | "entry" : start} onChange={setStart} options={[
            { value: "today", label: "Idag" }, { value: "entry", label: `Vid ingång (${fmt(entry, 1)})` }, { value: "extreme", label: "Extrem (3,5)" },
          ]} />
          <Info id="ou-forecast" ctx={{ ...ctx, z0: res.z0, in10: at(10), in20: at(20) }} />
          <span className="spacer" />
          <div className="lab-stat">
            <span>Chans innanför utgång ±{fmt(exit, 1)} om</span>
            <span>5 d</span><b className="num">{fmtPct(at(5), 0)}</b>
            <span>20 d</span><b className="num">{fmtPct(at(20), 0)}</b>
            <span>60 d</span><b className="num">{fmtPct(at(60), 0)}</b>
          </div>
        </div>
        <Plot ariaLabel="3D-yta: OU-prognos för spreadens fördelning över kommande dagar" data={data} height={520}
          layout={scene3d({ x: "Dagar framåt", y: "z-score", z: "Sannolikhetstäthet" }, { camera: { eye: { x: -1.75, y: -0.75, z: 1.05 }, center: { x: 0.05, y: 0, z: -0.15 } }, aspectratio: { x: 1.5, y: 1.25, z: 0.55 } })} />
      </div>
      <Caption>
        Om spreaden mellan {A} och {B} står på z = {fmt(res.z0, 1)} idag – var hamnar den? Kammen är det mest sannolika läget varje dag framåt, den vita linjen är medelbanan.
        Nära idag är vi ganska säkra (smal, hög topp); längre fram flyter fördelningen ut.
        {res.mr
          ? <> <b>Mean reversion syns som att kammen svänger in mot 0.</b> För spreaden du handlar ({hedgeLabel}) är halveringstiden ca {fmt(res.hl, res.hl < 10 ? 1 : 0)} dagar{ctx.hl != null ? <> – OLS-spreaden i nyckeltalen har {fmt(ctx.hl as number, 0)} dagar, eftersom den inte anpassar sig</> : null}. Gröna streck = utgång, koppar = ingång.</>
          : <> Här finns ingen mean reversion: konen breddas bara utan att dras mot mitten – exakt som en slumpvandring.</>}
      </Caption>
    </>
  );
}
