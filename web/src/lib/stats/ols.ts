/**
 * Minsta kvadrat-skattning (OLS) med Householder-QR. Numeriskt stabilt och tillräckligt
 * snabbt för de små regressionerna i ADF/Engle-Granger (n ≤ ~4000, k ≤ ~20).
 */
export interface OlsResult {
  beta: number[];
  resid: Float64Array;
  ssr: number;
  se: number[];
  t: number[];
  nobs: number;
  k: number;
  /** Akaike-informationskriterium på samma sätt som statsmodels: -2·llf + 2k */
  aic: number;
}

/** X ges kolumnvis: cols[j][i] = X_ij. */
export function ols(y: ArrayLike<number>, cols: ArrayLike<number>[]): OlsResult {
  const n = y.length;
  const k = cols.length;
  // Kopiera till radmajor matris A (n × k) och vektor b
  const A = new Float64Array(n * k);
  for (let j = 0; j < k; j++) {
    const c = cols[j];
    for (let i = 0; i < n; i++) A[i * k + j] = c[i];
  }
  const b = Float64Array.from(y as ArrayLike<number>);

  // Householder-QR in place: A → R (övre triangel), b → Qᵀb
  for (let j = 0; j < k; j++) {
    let norm = 0;
    for (let i = j; i < n; i++) norm += A[i * k + j] ** 2;
    norm = Math.sqrt(norm);
    if (norm === 0) continue;
    const alpha = A[j * k + j] > 0 ? -norm : norm;
    const v0 = A[j * k + j] - alpha;
    // v = [v0, A[j+1..n-1, j]]
    let vnorm2 = v0 * v0;
    for (let i = j + 1; i < n; i++) vnorm2 += A[i * k + j] ** 2;
    if (vnorm2 === 0) continue;
    // Applicera H = I - 2vvᵀ/(vᵀv) på kvarvarande kolumner och b
    for (let c = j + 1; c < k; c++) {
      let dot = v0 * A[j * k + c];
      for (let i = j + 1; i < n; i++) dot += A[i * k + j] * A[i * k + c];
      const f = (2 * dot) / vnorm2;
      A[j * k + c] -= f * v0;
      for (let i = j + 1; i < n; i++) A[i * k + c] -= f * A[i * k + j];
    }
    {
      let dot = v0 * b[j];
      for (let i = j + 1; i < n; i++) dot += A[i * k + j] * b[i];
      const f = (2 * dot) / vnorm2;
      b[j] -= f * v0;
      for (let i = j + 1; i < n; i++) b[i] -= f * A[i * k + j];
    }
    A[j * k + j] = alpha;
  }

  // Bakåtsubstitution R β = (Qᵀb)[0..k-1]
  const beta = new Array<number>(k).fill(0);
  for (let j = k - 1; j >= 0; j--) {
    let s = b[j];
    for (let c = j + 1; c < k; c++) s -= A[j * k + c] * beta[c];
    beta[j] = s / A[j * k + j];
  }

  const resid = new Float64Array(n);
  let ssr = 0;
  for (let i = 0; i < n; i++) {
    let yhat = 0;
    for (let j = 0; j < k; j++) yhat += cols[j][i] * beta[j];
    resid[i] = (y[i] as number) - yhat;
    ssr += resid[i] ** 2;
  }

  // (XᵀX)⁻¹ = R⁻¹ R⁻ᵀ → diagonalen ger standardfel
  const Rinv = new Float64Array(k * k);
  for (let j = 0; j < k; j++) {
    Rinv[j * k + j] = 1 / A[j * k + j];
    for (let i = j - 1; i >= 0; i--) {
      let s = 0;
      for (let m = i + 1; m <= j; m++) s += A[i * k + m] * Rinv[m * k + j];
      Rinv[i * k + j] = -s / A[i * k + i];
    }
  }
  const sigma2 = ssr / (n - k);
  const se = new Array<number>(k);
  const t = new Array<number>(k);
  for (let i = 0; i < k; i++) {
    let d = 0;
    for (let j = i; j < k; j++) d += Rinv[i * k + j] ** 2;
    se[i] = Math.sqrt(sigma2 * d);
    t[i] = beta[i] / se[i];
  }
  const llf = -(n / 2) * (Math.log(2 * Math.PI) + Math.log(ssr / n) + 1);
  return { beta, resid, ssr, se, t, nobs: n, k, aic: -2 * llf + 2 * k };
}

/** Enkel regression y = α + βx. Snabb väg utan QR. */
export function simpleOls(y: ArrayLike<number>, x: ArrayLike<number>): { alpha: number; beta: number } {
  const n = y.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    sxy += dx * (y[i] - my);
    sxx += dx * dx;
  }
  const beta = sxy / sxx;
  return { alpha: my - beta * mx, beta };
}

export const ones = (n: number) => new Float64Array(n).fill(1);
