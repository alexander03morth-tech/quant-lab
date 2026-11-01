/** Mean reversion-mått och dynamisk hedge ratio. Speglar pipeline/stats/core.py. */
import { ols, ones, simpleOls } from "./ols";

/** Half-life via diskret Ornstein-Uhlenbeck: Δs_t = a + b·s_{t-1} + ε, HL = −ln2 / ln(1+b). */
export function halfLife(s: ArrayLike<number>): { hl: number; b: number; a: number } {
  const n = s.length;
  const ds = new Float64Array(n - 1);
  const lag = new Float64Array(n - 1);
  for (let i = 1; i < n; i++) { ds[i - 1] = s[i] - s[i - 1]; lag[i - 1] = s[i - 1]; }
  const { alpha, beta } = simpleOls(ds, lag);
  const hl = beta >= 0 || beta <= -1 ? Infinity : -Math.LN2 / Math.log1p(beta);
  return { hl, b: beta, a: alpha };
}

/** Hurst-exponent: lutningen i log std(x_{t+τ} − x_t) mot log τ, τ = 2…99. */
export function hurst(x: ArrayLike<number>, minLag = 2, maxLag = 100): number {
  const n = x.length;
  maxLag = Math.min(maxLag, Math.floor(n / 2));
  const lx: number[] = [], ly: number[] = [];
  for (let lag = minLag; lag < maxLag; lag++) {
    const m = n - lag;
    let mean = 0;
    for (let i = 0; i < m; i++) mean += x[i + lag] - x[i];
    mean /= m;
    let v = 0;
    for (let i = 0; i < m; i++) v += (x[i + lag] - x[i] - mean) ** 2;
    const sd = Math.sqrt(v / m);
    if (sd > 0) { lx.push(Math.log(lag)); ly.push(Math.log(sd)); }
  }
  return simpleOls(ly, lx).beta;
}

export interface KalmanResult {
  beta: Float64Array;
  alpha: Float64Array;
  /** prediktionsfel e_t = y_t − (β_{t−1}x_t + α_{t−1}) */
  e: Float64Array;
  /** prediktionsfelets varians */
  Q: Float64Array;
}

/**
 * Kalmanfilter för tidsvarierande hedge ratio. θ_t = [β_t, α_t] följer en slumpvandring.
 * δ styr hur snabbt β får ändras (större δ → mer följsam, mer brus).
 * Filtrerat, inte utjämnat: β_t använder bara data t.o.m. t – ingen look-ahead.
 */
export interface KalmanInit { theta: [number, number]; P: [[number, number], [number, number]]; ve: number; burn: number }

/** Startvärden från OLS på de första `burn` dagarna. Utan detta tar β upp prisnivån i stället för α. */
export function kalmanInit(y: ArrayLike<number>, x: ArrayLike<number>, burn = 60): KalmanInit {
  const ys = Array.from({ length: burn }, (_, i) => y[i]), xs = Array.from({ length: burn }, (_, i) => x[i]);
  const { alpha, beta } = simpleOls(ys, xs);
  let ve = 0, sx = 0, sxx = 0;
  const r = ys.map((v, i) => v - alpha - beta * xs[i]);
  const mr = r.reduce((a, b) => a + b, 0) / burn;
  for (let i = 0; i < burn; i++) { ve += (r[i] - mr) ** 2; sx += xs[i]; sxx += xs[i] * xs[i]; }
  ve /= burn;
  // P = ve · (XᵀX)⁻¹ med X = [x, 1]
  const det = sxx * burn - sx * sx;
  return { theta: [beta, alpha], P: [[(ve * burn) / det, (-ve * sx) / det], [(-ve * sx) / det, (ve * sxx) / det]], ve, burn };
}

export function kalman(
  y: ArrayLike<number>, x: ArrayLike<number>, delta = 1e-4, ve = 1e-3,
  init?: { theta: [number, number]; P: [[number, number], [number, number]] },
): KalmanResult {
  const n = y.length;
  const vw = delta / (1 - delta);
  let t0 = init?.theta[0] ?? 0, t1 = init?.theta[1] ?? 0; // θ
  let p00 = init?.P[0][0] ?? 0, p01 = init?.P[0][1] ?? 0, p11 = init?.P[1][1] ?? 0; // P (symmetrisk)
  const beta = new Float64Array(n), alpha = new Float64Array(n), e = new Float64Array(n), Q = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    const f0 = x[t], f1 = 1;
    const r00 = p00 + vw, r01 = p01, r11 = p11 + vw;
    const yhat = f0 * t0 + f1 * t1;
    // R·F
    const rf0 = r00 * f0 + r01 * f1;
    const rf1 = r01 * f0 + r11 * f1;
    const q = f0 * rf0 + f1 * rf1 + ve;
    const err = y[t] - yhat;
    const k0 = rf0 / q, k1 = rf1 / q;
    t0 += k0 * err; t1 += k1 * err;
    // P = R − K Fᵀ R = R − K (R F)ᵀ
    p00 = r00 - k0 * rf0;
    p01 = r01 - k0 * rf1;
    p11 = r11 - k1 * rf1;
    beta[t] = t0; alpha[t] = t1; e[t] = err; Q[t] = q;
  }
  return { beta, alpha, e, Q };
}

/** Rullande OLS y = α_t + β_t x över de senaste L observationerna (t.o.m. t). NaN före L. */
export function rollingOls(y: ArrayLike<number>, x: ArrayLike<number>, L: number) {
  const n = y.length;
  const alpha = new Float64Array(n).fill(NaN), beta = new Float64Array(n).fill(NaN);
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let t = 0; t < n; t++) {
    sx += x[t]; sy += y[t]; sxx += x[t] * x[t]; sxy += x[t] * y[t];
    if (t >= L) {
      const o = t - L;
      sx -= x[o]; sy -= y[o]; sxx -= x[o] * x[o]; sxy -= x[o] * y[o];
    }
    if (t >= L - 1) {
      const b = (L * sxy - sx * sy) / (L * sxx - sx * sx);
      beta[t] = b;
      alpha[t] = (sy - b * sx) / L;
    }
  }
  return { alpha, beta };
}

/** Rullande z-score: (s_t − medel_L) / std_L, beräknat på s_{t−L+1..t}. NaN före fönstret är fullt. */
export function rollingZ(s: ArrayLike<number>, L: number): Float64Array {
  const n = s.length;
  const z = new Float64Array(n).fill(NaN);
  let sum = 0, sum2 = 0, cnt = 0;
  const q: number[] = [];
  for (let t = 0; t < n; t++) {
    const v = s[t];
    if (Number.isFinite(v)) { sum += v; sum2 += v * v; cnt++; }
    q.push(v);
    if (q.length > L) {
      const o = q.shift()!;
      if (Number.isFinite(o)) { sum -= o; sum2 -= o * o; cnt--; }
    }
    if (cnt === L) {
      const m = sum / L;
      const sd = Math.sqrt(Math.max(0, (sum2 - L * m * m) / (L - 1)));
      z[t] = sd > 0 ? (v - m) / sd : NaN;
    }
  }
  return z;
}

export function staticSpread(y: ArrayLike<number>, x: ArrayLike<number>) {
  const r = ols(y, [ones(y.length), x]);
  return { alpha: r.beta[0], beta: r.beta[1], resid: r.resid };
}

export function mean(a: ArrayLike<number>) {
  let s = 0, c = 0;
  for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i])) { s += a[i]; c++; }
  return s / c;
}
export function std(a: ArrayLike<number>, ddof = 1) {
  const m = mean(a);
  let s = 0, c = 0;
  for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i])) { s += (a[i] - m) ** 2; c++; }
  return Math.sqrt(s / (c - ddof));
}
export function corr(a: ArrayLike<number>, b: ArrayLike<number>) {
  const ma = mean(a), mb = mean(b);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    sab += da * db; saa += da * da; sbb += db * db;
  }
  return sab / Math.sqrt(saa * sbb);
}
