/**
 * Enhetsrotstester och samintegration – porterade från statsmodels 0.14
 * (adfuller, coint, coint_johansen) så att resultaten blir identiska.
 */
import { MACKINNON } from "./mackinnon";
import { ols, ones, simpleOls } from "./ols";

/** Standardnormalens fördelningsfunktion Φ(x), via erfc med relativt fel < 1e-12 (W. J. Cody). */
export function normCdf(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}

function erfc(x: number): number {
  // Cody-liknande rationell approximation via kontinuerligt bråk för stora |x|,
  // serie för små. Tillräckligt för p-värden ned till ~1e-300.
  const ax = Math.abs(x);
  let r: number;
  if (ax < 0.5) {
    // erf via Taylor-serie
    let sum = ax, term = ax;
    const x2 = ax * ax;
    for (let n = 1; n < 60; n++) {
      term *= -x2 / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    r = 1 - (2 / Math.sqrt(Math.PI)) * sum;
  } else {
    // Lentz kontinuerligt bråk: erfc(x) = exp(-x²)/√π · 1/(x + 1/2/(x + 1/(x + 3/2/(x + ...))))
    const tiny = 1e-300;
    let f = ax, C = ax, D = 0;
    for (let n = 1; n < 500; n++) {
      const an = n / 2;
      D = ax + an * D; D = Math.abs(D) < tiny ? tiny : D; D = 1 / D;
      C = ax + an / C; C = Math.abs(C) < tiny ? tiny : C;
      const delta = C * D;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-16) break;
    }
    r = Math.exp(-ax * ax) / Math.sqrt(Math.PI) / f;
  }
  return x >= 0 ? r : 2 - r;
}

type Reg = "c" | "n";

/** MacKinnon (1994) approximativt p-värde. N = antal I(1)-serier (1 = ADF, 2 = Engle-Granger). */
export function mackinnonp(stat: number, regression: Reg = "c", N = 1): number {
  const t = MACKINNON[regression];
  const i = N - 1;
  if (stat > t.max[i]) return 1;
  if (stat < t.min[i]) return 0;
  const coef = stat <= t.star[i] ? t.small[i] : t.large[i];
  let z = 0;
  for (let p = coef.length - 1; p >= 0; p--) z = z * stat + coef[p];
  return normCdf(z);
}

/** MacKinnon (2010) kritiska värden [1 %, 5 %, 10 %] för givet antal observationer. */
export function mackinnoncrit(N = 1, regression: Reg = "c", nobs = Infinity): [number, number, number] {
  const tab = MACKINNON[regression].crit2010[N - 1];
  return tab.map((row) => {
    if (!isFinite(nobs)) return row[0];
    const u = 1 / nobs;
    return row[0] + row[1] * u + row[2] * u * u + row[3] * u * u * u;
  }) as [number, number, number];
}

export interface AdfResult {
  stat: number;
  pvalue: number;
  usedlag: number;
  nobs: number;
  crit: { "1%": number; "5%": number; "10%": number };
  icbest: number | null;
}

/** Bygger ADF-regressorer: [nivå x_{t-1}, Δx_{t-1}, …, Δx_{t-lags}] för de sista `nobs` raderna. */
function adfDesign(x: ArrayLike<number>, xdiff: Float64Array, lags: number) {
  const n = x.length;
  const nobs = n - 1 - lags;
  const level = new Float64Array(nobs);
  const dy = new Float64Array(nobs);
  const lagCols: Float64Array[] = [];
  for (let l = 1; l <= lags; l++) lagCols.push(new Float64Array(nobs));
  for (let r = 0; r < nobs; r++) {
    const t = lags + r; // index i xdiff
    dy[r] = xdiff[t];
    level[r] = x[t];
    for (let l = 1; l <= lags; l++) lagCols[l - 1][r] = xdiff[t - l];
  }
  return { nobs, level, dy, lagCols };
}

/**
 * Augmented Dickey-Fuller. Identisk med statsmodels.tsa.stattools.adfuller(x, regression, autolag="AIC").
 * H0: enhetsrot (icke-stationär). Lågt p-värde → förkasta H0 → serien är stationär.
 */
export function adfuller(
  x: ArrayLike<number>,
  opts: { regression?: Reg; autolag?: "aic" | null; maxlag?: number } = {},
): AdfResult {
  const regression = opts.regression ?? "c";
  const autolag = opts.autolag === undefined ? "aic" : opts.autolag;
  const n = x.length;
  const ntrend = regression === "c" ? 1 : 0;
  let maxlag = opts.maxlag ?? Math.min(Math.floor(n / 2) - ntrend - 1, Math.ceil(12 * Math.pow(n / 100, 0.25)));
  if (maxlag < 0) throw new Error("för kort serie för ADF");
  const xdiff = new Float64Array(n - 1);
  for (let i = 1; i < n; i++) xdiff[i - 1] = x[i] - x[i - 1];

  let usedlag = maxlag;
  let icbest: number | null = null;
  if (autolag) {
    // Alla lagglängder skattas på samma urval (bestämt av maxlag), precis som statsmodels.
    const d = adfDesign(x, xdiff, maxlag);
    const base: ArrayLike<number>[] = regression === "c" ? [ones(d.nobs), d.level] : [d.level];
    let best = Infinity, bestLag = 0;
    for (let lag = 0; lag <= maxlag; lag++) {
      const res = ols(d.dy, [...base, ...d.lagCols.slice(0, lag)]);
      // min över tupler (aic, kolumnindex) → vid lika AIC vinner kortast lagg
      if (res.aic < best) { best = res.aic; bestLag = lag; }
    }
    usedlag = bestLag;
    icbest = best;
  }
  const d = adfDesign(x, xdiff, usedlag);
  const cols: ArrayLike<number>[] = [d.level, ...d.lagCols];
  if (regression === "c") cols.push(ones(d.nobs));
  const res = ols(d.dy, cols);
  const stat = res.t[0];
  const c = mackinnoncrit(1, regression, d.nobs);
  return {
    stat,
    pvalue: mackinnonp(stat, regression, 1),
    usedlag,
    nobs: d.nobs,
    crit: { "1%": c[0], "5%": c[1], "10%": c[2] },
    icbest,
  };
}

export interface CointResult {
  stat: number;
  pvalue: number;
  crit: { "1%": number; "5%": number; "10%": number };
  alpha: number;
  beta: number;
  resid: Float64Array;
  usedlag: number;
}

/**
 * Engle-Granger tvåstegstest. Identisk med statsmodels.tsa.stattools.coint(y, x, trend="c").
 * Steg 1: y = α + βx + e (OLS).  Steg 2: ADF utan konstant på residualerna,
 * men p-värdet hämtas från MacKinnons fördelning för N=2 (residualerna är skattade).
 */
export function coint(
  y: ArrayLike<number>, x: ArrayLike<number>,
  opts: { maxlag?: number; autolag?: "aic" | null } = {},
): CointResult {
  const { alpha, beta } = simpleOls(y, x);
  const n = y.length;
  const resid = new Float64Array(n);
  for (let i = 0; i < n; i++) resid[i] = y[i] - alpha - beta * x[i];
  const adf = adfuller(resid, { regression: "n", autolag: opts.autolag === undefined ? "aic" : opts.autolag, maxlag: opts.maxlag });
  const c = mackinnoncrit(2, "c", n - 1);
  return {
    stat: adf.stat,
    pvalue: mackinnonp(adf.stat, "c", 2),
    crit: { "1%": c[0], "5%": c[1], "10%": c[2] },
    alpha, beta, resid, usedlag: adf.usedlag,
  };
}

export interface JohansenResult {
  eig: [number, number];
  trace: [number, number];
  maxEig: [number, number];
  /** kritiska värden [90 %, 95 %, 99 %] för trace-testet, r=0 resp. r≤1 */
  traceCrit: [number[], number[]];
  maxEigCrit: [number[], number[]];
  /** samintegrerande vektor normaliserad så att första elementet = 1: y - b·x */
  vector: [number, number];
}

// statsmodels.tsa.coint_tables.c_sjt / c_sja för det_order = 0
const SJT = { 1: [2.7055, 3.8415, 6.6349], 2: [13.4294, 15.4943, 19.9349] };
const SJA = { 1: [2.7055, 3.8415, 6.6349], 2: [12.2971, 14.2639, 18.52] };

/**
 * Johansen-test för två serier med konstant (det_order=0) och en laggad differens (k_ar_diff=1).
 * Identisk med statsmodels.tsa.vector_ar.vecm.coint_johansen(..., 0, 1).
 */
export function johansen(y1: ArrayLike<number>, y2: ArrayLike<number>): JohansenResult {
  const n = y1.length;
  const demean = (a: Float64Array) => {
    let m = 0;
    for (let i = 0; i < a.length; i++) m += a[i];
    m /= a.length;
    for (let i = 0; i < a.length; i++) a[i] -= m;
    return a;
  };
  const e1 = demean(Float64Array.from(y1 as ArrayLike<number>));
  const e2 = demean(Float64Array.from(y2 as ArrayLike<number>));
  const T = n - 2;
  // dx_t (t = 1..n-2 i dx-index), z_t = dx_{t-1}, lx_t = endog_t
  const dx1 = new Float64Array(T), dx2 = new Float64Array(T);
  const z1 = new Float64Array(T), z2 = new Float64Array(T);
  const l1 = new Float64Array(T), l2 = new Float64Array(T);
  for (let r = 0; r < T; r++) {
    const t = r + 1;
    dx1[r] = e1[t + 1] - e1[t]; dx2[r] = e2[t + 1] - e2[t];
    z1[r] = e1[t] - e1[t - 1]; z2[r] = e2[t] - e2[t - 1];
    l1[r] = e1[t]; l2[r] = e2[t];
  }
  [dx1, dx2, z1, z2, l1, l2].forEach(demean);
  const resid = (a: Float64Array) => {
    const r = ols(a, [z1, z2]);
    return r.resid;
  };
  const r0 = [resid(dx1), resid(dx2)];
  const rk = [resid(l1), resid(l2)];
  const S = (a: Float64Array[], b: Float64Array[]) => {
    const m = [[0, 0], [0, 0]];
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        let s = 0;
        for (let t = 0; t < T; t++) s += a[i][t] * b[j][t];
        m[i][j] = s / T;
      }
    return m;
  };
  const inv2 = (m: number[][]) => {
    const d = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    return [[m[1][1] / d, -m[0][1] / d], [-m[1][0] / d, m[0][0] / d]];
  };
  const mul = (a: number[][], b: number[][]) => [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
  const tr = (a: number[][]) => [[a[0][0], a[1][0]], [a[0][1], a[1][1]]];
  const skk = S(rk, rk), sk0 = S(rk, r0), s00 = S(r0, r0);
  const M = mul(inv2(skk), mul(sk0, mul(inv2(s00), tr(sk0))));
  // Egenvärden för 2×2: λ = tr/2 ± sqrt(tr²/4 - det)
  const trM = M[0][0] + M[1][1];
  const detM = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  const disc = Math.sqrt(Math.max(0, (trM * trM) / 4 - detM));
  const a1 = trM / 2 + disc, a2 = trM / 2 - disc;
  // Egenvektor för största egenvärdet
  let v: [number, number] = Math.abs(M[0][1]) > 1e-14 ? [M[0][1], a1 - M[0][0]] : [a1 - M[1][1], M[1][0]];
  v = [1, v[1] / v[0]];
  return {
    eig: [a1, a2],
    trace: [-T * (Math.log(1 - a1) + Math.log(1 - a2)), -T * Math.log(1 - a2)],
    maxEig: [-T * Math.log(1 - a1), -T * Math.log(1 - a2)],
    traceCrit: [SJT[2], SJT[1]],
    maxEigCrit: [SJA[2], SJA[1]],
    vector: v,
  };
}
