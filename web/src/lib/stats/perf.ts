/**
 * Nyckeltal för en avkastningsserie (dagliga enkla avkastningar). Delas av Portföljlabb och Backtest.
 * Riskfri ränta antas vara 0 (enkelt och transparent – förklaras i UI:t).
 */
export const DAYS = 252;

export interface Perf {
  totalReturn: number;
  cagr: number;
  vol: number;
  sharpe: number;
  sortino: number;
  maxDD: number;
  maxDDStart: number;
  maxDDEnd: number;
  calmar: number;
  var95: number;
  cvar95: number;
  best: number;
  worst: number;
  hitRate: number;
  years: number;
}

export function equityFrom(ret: ArrayLike<number>, start = 1): Float64Array {
  const eq = new Float64Array(ret.length);
  let v = start;
  for (let i = 0; i < ret.length; i++) { v *= 1 + ret[i]; eq[i] = v; }
  return eq;
}

export function drawdown(eq: ArrayLike<number>): Float64Array {
  const dd = new Float64Array(eq.length);
  let peak = -Infinity;
  for (let i = 0; i < eq.length; i++) { peak = Math.max(peak, eq[i]); dd[i] = eq[i] / peak - 1; }
  return dd;
}

/** Historisk VaR/CVaR: förlust som överskrids 5 % av dagarna, och snittförlusten de dagarna. Positiva tal = förlust. */
export function varCvar(ret: ArrayLike<number>, level = 0.95) {
  const s = Array.from(ret).sort((a, b) => a - b);
  const k = Math.max(1, Math.floor((1 - level) * s.length));
  const tail = s.slice(0, k);
  return { var: -s[k - 1], cvar: -tail.reduce((a, b) => a + b, 0) / tail.length };
}

export function perf(ret: ArrayLike<number>): Perf {
  const n = ret.length;
  let s = 0, s2 = 0, down2 = 0, wins = 0, nz = 0, best = -Infinity, worst = Infinity;
  for (let i = 0; i < n; i++) {
    const r = ret[i];
    s += r; s2 += r * r;
    if (r < 0) down2 += r * r;
    if (r !== 0) { nz++; if (r > 0) wins++; }
    best = Math.max(best, r); worst = Math.min(worst, r);
  }
  const mean = s / n;
  const sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  const dsd = Math.sqrt(down2 / n);
  const eq = equityFrom(ret);
  const dd = drawdown(eq);
  let maxDD = 0, end = 0;
  for (let i = 0; i < n; i++) if (dd[i] < maxDD) { maxDD = dd[i]; end = i; }
  let start = end;
  while (start > 0 && dd[start - 1] < 0) start--;
  const years = n / DAYS;
  const total = eq[n - 1] - 1;
  const cagr = Math.pow(1 + total, 1 / years) - 1;
  const { var: v, cvar } = varCvar(ret);
  return {
    totalReturn: total, cagr, vol: sd * Math.sqrt(DAYS),
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(DAYS) : NaN,
    sortino: dsd > 0 ? (mean / dsd) * Math.sqrt(DAYS) : NaN,
    maxDD, maxDDStart: start, maxDDEnd: end,
    calmar: maxDD < 0 ? cagr / -maxDD : NaN,
    var95: v, cvar95: cvar, best, worst,
    hitRate: nz ? wins / nz : NaN, years,
  };
}

/** Beta, årlig alfa och korrelation mot ett index. */
export function betaAlpha(ret: ArrayLike<number>, idx: ArrayLike<number>) {
  const n = ret.length;
  let mr = 0, mi = 0;
  for (let i = 0; i < n; i++) { mr += ret[i]; mi += idx[i]; }
  mr /= n; mi /= n;
  let cov = 0, vi = 0, vr = 0;
  for (let i = 0; i < n; i++) { cov += (ret[i] - mr) * (idx[i] - mi); vi += (idx[i] - mi) ** 2; vr += (ret[i] - mr) ** 2; }
  const beta = cov / vi;
  return { beta, alpha: (mr - beta * mi) * DAYS, corr: cov / Math.sqrt(vi * vr) };
}
