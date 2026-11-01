/**
 * Portföljmotor: simulerar en portfölj med valda vikter, räknar risk per innehav,
 * slumpar portföljer för den effektiva fronten och gör Monte Carlo-bootstrap.
 */
import type { Prices } from "../types";

export interface Holding { ticker: string; weight: number }
export type Rebalance = "monthly" | "quarterly" | "none";

export interface ReturnMatrix {
  dates: string[];       // datum för avkastningarna (dag t)
  tickers: string[];
  R: Float64Array[];     // R[j][t] = enkel avkastning för aktie j dag t
  idx: Float64Array;     // indexavkastning
  available: number;     // antal dagar där alla har kurs
  limitedBy: string | null;
}

/** Avkastningar för gemensamma handelsdagar (alla aktier + index har kurs), de sista `n` dagarna. */
export function returnMatrix(prices: Prices, tickers: string[], bench: string, n: number): ReturnMatrix {
  const all = [...tickers, bench];
  const closes = all.map((t) => prices.series[t].close);
  const idx: number[] = [];
  for (let i = 0; i < prices.dates.length; i++) if (closes.every((c) => c[i] != null)) idx.push(i);
  const take = n > 0 ? idx.slice(-(n + 1)) : idx;
  const m = take.length - 1;
  const R = tickers.map(() => new Float64Array(m));
  const I = new Float64Array(m);
  for (let k = 1; k <= m; k++) {
    const i = take[k], p = take[k - 1];
    tickers.forEach((_, j) => { R[j][k - 1] = (closes[j][i] as number) / (closes[j][p] as number) - 1; });
    I[k - 1] = (closes[all.length - 1][i] as number) / (closes[all.length - 1][p] as number) - 1;
  }
  // vilken aktie begränsar historiken?
  let limitedBy: string | null = null, latest = "";
  tickers.forEach((t) => {
    const c = prices.series[t].close;
    const first = c.findIndex((v) => v != null);
    if (prices.dates[first] > latest) { latest = prices.dates[first]; limitedBy = t; }
  });
  return { dates: take.slice(1).map((i) => prices.dates[i]), tickers, R, idx: I, available: idx.length - 1, limitedBy };
}

/**
 * Portföljens dagliga avkastning. Vikterna driver med kurserna mellan ombalanseringar
 * (det är så en verklig portfölj beter sig). Negativa vikter = blankning.
 */
export function simulate(M: ReturnMatrix, weights: number[], rebalance: Rebalance): { ret: Float64Array; drift: Float64Array[] } {
  const n = M.dates.length, k = weights.length;
  const ret = new Float64Array(n);
  const drift = weights.map(() => new Float64Array(n));
  let w = weights.slice();
  let lastMonth = M.dates[0]?.slice(0, 7);
  for (let t = 0; t < n; t++) {
    const month = M.dates[t].slice(0, 7);
    const mm = Number(month.slice(5));
    const newPeriod = month !== lastMonth;
    if (newPeriod && (rebalance === "monthly" || (rebalance === "quarterly" && (mm - 1) % 3 === 0))) w = weights.slice();
    lastMonth = month;
    let r = 0;
    for (let j = 0; j < k; j++) r += w[j] * M.R[j][t];
    ret[t] = r;
    // vikterna driver: w_j ← w_j (1 + r_j) / (1 + r_p)
    for (let j = 0; j < k; j++) { w[j] = (w[j] * (1 + M.R[j][t])) / (1 + r); drift[j][t] = w[j]; }
  }
  return { ret, drift };
}

/** Kovariansmatris (daglig) för valda kolumner. */
export function covariance(R: Float64Array[], from = 0, to = R[0]?.length ?? 0): number[][] {
  const k = R.length, n = to - from;
  const mu = R.map((r) => { let s = 0; for (let t = from; t < to; t++) s += r[t]; return s / n; });
  const C = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let a = 0; a < k; a++)
    for (let b = a; b < k; b++) {
      let s = 0;
      for (let t = from; t < to; t++) s += (R[a][t] - mu[a]) * (R[b][t] - mu[b]);
      C[a][b] = C[b][a] = s / (n - 1);
    }
  return C;
}

export function meanReturns(R: Float64Array[]): number[] {
  return R.map((r) => r.reduce((a, b) => a + b, 0) / r.length);
}

/**
 * Riskbidrag (Euler): RC_j = w_j (Σw)_j / σ_p. Summerar exakt till portföljens volatilitet.
 * Returnerar andel av total risk (summerar till 1).
 */
export function riskContrib(C: number[][], w: number[]): { share: number[]; vol: number } {
  const k = w.length;
  const Cw = C.map((row) => row.reduce((s, c, j) => s + c * w[j], 0));
  const varP = w.reduce((s, wj, j) => s + wj * Cw[j], 0);
  const vol = Math.sqrt(varP);
  return { share: Array.from({ length: k }, (_, j) => (w[j] * Cw[j]) / varP), vol };
}

/** Diversifieringskvot: viktad snittvolatilitet / portföljvolatilitet. 1 = ingen diversifiering. */
export function diversificationRatio(C: number[][], w: number[]) {
  const sd = C.map((row, i) => Math.sqrt(row[i]));
  const num = w.reduce((s, wj, j) => s + Math.abs(wj) * sd[j], 0);
  const { vol } = riskContrib(C, w);
  return num / vol;
}

/** Enkel deterministisk slumpgenerator så att molnet inte hoppar vid varje omritning. */
export function rng(seed = 42) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface CloudPoint { w: number[]; vol: number; ret: number; sharpe: number }

/** Slumpade long-only-portföljer (Dirichlet via −ln U). Årliga tal. */
export function randomPortfolios(mu: number[], C: number[][], count: number, seed = 7): CloudPoint[] {
  const r = rng(seed), k = mu.length, out: CloudPoint[] = [];
  for (let i = 0; i < count; i++) {
    // blanda in några koncentrerade portföljer så att hörnen av fronten syns
    const conc = i % 4 === 0 ? 3 : 1;
    const raw = Array.from({ length: k }, () => Math.pow(-Math.log(r() || 1e-12), conc));
    const sum = raw.reduce((a, b) => a + b, 0);
    const w = raw.map((v) => v / sum);
    const m = w.reduce((s, wj, j) => s + wj * mu[j], 0) * 252;
    const v = riskContrib(C, w).vol * Math.sqrt(252);
    out.push({ w, vol: v, ret: m, sharpe: m / v });
  }
  return out;
}

/** Minsta-varians-portfölj (long-only) via projicerad gradient. */
export function minVariance(C: number[][], iters = 400): number[] {
  const k = C.length;
  let w = new Array(k).fill(1 / k);
  for (let it = 0; it < iters; it++) {
    const g = C.map((row) => row.reduce((s, c, j) => s + c * w[j], 0));
    const step = 0.5 / (Math.max(...C.map((row, i) => row[i])) * 4);
    w = projectSimplex(w.map((wi, i) => wi - step * g[i]));
  }
  return w;
}

/** Max-Sharpe (long-only) via projicerad gradient på −Sharpe. */
export function maxSharpe(mu: number[], C: number[][], iters = 800): number[] {
  const k = C.length;
  let w = new Array(k).fill(1 / k);
  for (let it = 0; it < iters; it++) {
    const Cw = C.map((row) => row.reduce((s, c, j) => s + c * w[j], 0));
    const v = w.reduce((s, wj, j) => s + wj * Cw[j], 0), sd = Math.sqrt(v);
    const m = w.reduce((s, wj, j) => s + wj * mu[j], 0);
    const grad = mu.map((mi, i) => mi / sd - (m * Cw[i]) / (sd * v));
    const scale = Math.max(...grad.map(Math.abs)) || 1;
    w = projectSimplex(w.map((wi, i) => wi + (0.02 * grad[i]) / scale));
  }
  return w;
}

function projectSimplex(v: number[]): number[] {
  const u = [...v].sort((a, b) => b - a);
  let css = 0, rho = 0, theta = 0;
  for (let i = 0; i < u.length; i++) {
    css += u[i];
    const t = (css - 1) / (i + 1);
    if (u[i] - t > 0) { rho = i; theta = t; }
  }
  void rho;
  return v.map((x) => Math.max(0, x - theta));
}

/**
 * Block-bootstrap Monte Carlo: drar sammanhängande block av historiska dagliga avkastningar
 * (behåller volatilitetskluster). Returnerar percentilbanor och täthetsyta.
 */
export function monteCarlo(ret: ArrayLike<number>, horizon = 252, paths = 2000, block = 10, seed = 11) {
  const r = rng(seed), n = ret.length;
  const step = Math.max(1, Math.floor(horizon / 60));
  const hs: number[] = [];
  for (let h = step; h <= horizon; h += step) hs.push(h);
  const finals: number[][] = hs.map(() => []);
  for (let p = 0; p < paths; p++) {
    let v = 1, h = 0, hi = 0;
    while (h < horizon) {
      const start = Math.floor(r() * (n - block));
      for (let b = 0; b < block && h < horizon; b++, h++) {
        v *= 1 + ret[start + b];
        if (hi < hs.length && h + 1 === hs[hi]) { finals[hi].push(v); hi++; }
      }
    }
  }
  const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * arr.length)))];
  finals.forEach((f) => f.sort((a, b) => a - b));
  const pct = (p: number) => finals.map((f) => q(f, p));
  return { hs, finals, p05: pct(0.05), p25: pct(0.25), p50: pct(0.5), p75: pct(0.75), p95: pct(0.95), lossProb: finals.map((f) => f.filter((v) => v < 1).length / f.length) };
}
