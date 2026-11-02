/**
 * Linjär algebra och faktormodeller för Korrelation och PCA-vyerna.
 *  - jacobiEigen: egenvärden/egenvektorer för en symmetrisk matris (Jacobis rotationsmetod)
 *  - corrMatrix: korrelationsmatris för en avkastningspanel
 *  - pca: huvudkomponenter av korrelationsmatrisen (standardiserade avkastningar)
 *  - sScores: Avellaneda & Lee (2010) – residualer mot egenportföljer, OU-anpassning och s-score
 *  - clusterOrder: ordning från hierarkisk klustring (average linkage) med avstånd 1 − ρ
 */

export interface Eigen { values: number[]; vectors: number[][] /* vectors[k] = k:te egenvektorn */ }

/** Jacobis metod. Returnerar egenvärden i fallande ordning. Exakt nog för 30×30 (konvergerar till ~1e-12). */
export function jacobiEigen(M: number[][], maxSweeps = 100): Eigen {
  const n = M.length;
  const A = M.map((r) => r.slice());
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
      }
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((i, j) => A[j][j] - A[i][i]);
  return {
    values: idx.map((i) => A[i][i]),
    vectors: idx.map((i) => {
      const v = V.map((row) => row[i]);
      // tecken: gör summan positiv så att PC1 = "marknaden upp" och grafen inte byter håll mellan fönster
      const s = v.reduce((a, b) => a + b, 0);
      return s < 0 ? v.map((x) => -x) : v;
    }),
  };
}

/** Medel och std (ddof=1) per kolumn samt standardiserade serier. R[j][t]. */
export function standardize(R: ArrayLike<number>[]) {
  const T = R[0].length;
  const mu: number[] = [], sd: number[] = [];
  const Z = R.map((r) => {
    let s = 0; for (let t = 0; t < T; t++) s += r[t];
    const m = s / T;
    let v = 0; for (let t = 0; t < T; t++) v += (r[t] - m) ** 2;
    const d = Math.sqrt(v / (T - 1));
    mu.push(m); sd.push(d);
    const z = new Float64Array(T);
    for (let t = 0; t < T; t++) z[t] = (r[t] - m) / d;
    return z;
  });
  return { Z, mu, sd };
}

export function corrMatrix(R: ArrayLike<number>[]): number[][] {
  const { Z } = standardize(R);
  const k = Z.length, T = Z[0].length;
  const C = Array.from({ length: k }, () => new Array<number>(k).fill(1));
  for (let a = 0; a < k; a++)
    for (let b = a + 1; b < k; b++) {
      let s = 0; for (let t = 0; t < T; t++) s += Z[a][t] * Z[b][t];
      C[a][b] = C[b][a] = s / (T - 1);
    }
  return C;
}

export interface PcaResult {
  values: number[];
  vectors: number[][];
  explained: number[];
  /** Marchenko–Pastur: största egenvärde som ren slump kan ge (λ₊) för N aktier och T dagar */
  mpMax: number;
  mpMin: number;
  sd: number[];
  corr: number[][];
}

export function pca(R: ArrayLike<number>[]): PcaResult {
  const N = R.length, T = R[0].length;
  const corr = corrMatrix(R);
  const { values, vectors } = jacobiEigen(corr);
  const tot = values.reduce((a, b) => a + b, 0);
  const q = N / T;
  return {
    values, vectors, corr,
    explained: values.map((v) => v / tot),
    mpMax: (1 + Math.sqrt(q)) ** 2,
    mpMin: (1 - Math.sqrt(q)) ** 2,
    sd: standardize(R).sd,
  };
}

/** Marchenko–Pastur-täthet (för att rita "slumpens" fördelning av egenvärden). */
export function mpDensity(lambda: number, q: number): number {
  const lp = (1 + Math.sqrt(q)) ** 2, lm = (1 - Math.sqrt(q)) ** 2;
  if (lambda <= lm || lambda >= lp) return 0;
  return Math.sqrt((lp - lambda) * (lambda - lm)) / (2 * Math.PI * q * lambda);
}

/**
 * Egenportföljernas dagliga avkastning: F_k[t] = Σ_i (v_ik / σ_i) R_i[t]  (Avellaneda & Lee, ekv. 9).
 * Vikterna v_ik/σ_i gör att volatila aktier väger mindre.
 */
export function eigenReturns(R: ArrayLike<number>[], vectors: number[][], sd: number[], k: number): Float64Array[] {
  const T = R[0].length;
  return vectors.slice(0, k).map((v) => {
    const f = new Float64Array(T);
    for (let i = 0; i < R.length; i++) { const w = v[i] / sd[i]; for (let t = 0; t < T; t++) f[t] += w * R[i][t]; }
    return f;
  });
}

/** Små minsta kvadrat-lösare via normalekvationer (få regressorer, välkonditionerat). */
function lstsq(y: ArrayLike<number>, X: ArrayLike<number>[]): { coef: number[]; resid: Float64Array } {
  const p = X.length + 1, T = y.length;
  const cols = [Float64Array.from({ length: T }, () => 1), ...X];
  const XtX = Array.from({ length: p }, () => new Array<number>(p).fill(0)), Xty = new Array<number>(p).fill(0);
  for (let a = 0; a < p; a++) {
    for (let t = 0; t < T; t++) Xty[a] += cols[a][t] * y[t];
    for (let b = a; b < p; b++) { let s = 0; for (let t = 0; t < T; t++) s += cols[a][t] * cols[b][t]; XtX[a][b] = XtX[b][a] = s; }
  }
  // Gauss-Jordan med partiell pivotering
  const A = XtX.map((r, i) => [...r, Xty[i]]);
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c] || 1e-300;
    for (let j = c; j <= p; j++) A[c][j] /= d;
    for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c]; for (let j = c; j <= p; j++) A[r][j] -= f * A[c][j]; }
  }
  const coef = A.map((r) => r[p]);
  const resid = new Float64Array(T);
  for (let t = 0; t < T; t++) { let f = coef[0]; for (let j = 1; j < p; j++) f += coef[j] * cols[j][t]; resid[t] = y[t] - f; }
  return { coef, resid };
}

export interface SScore {
  s: number; kappa: number; halfLife: number; m: number; sigmaEq: number; betas: number[]; ok: boolean; resid: Float64Array; cum: Float64Array;
}

/**
 * Avellaneda & Lee (2010), avsnitt 4: för varje aktie, regressera de senaste `L` dagarnas avkastning på
 * faktoravkastningarna. Kumulera residualerna till X_t och anpassa AR(1): X_{t+1} = a + b X_t + ζ.
 * κ = −ln(b)·252, m = a/(1−b), σ_eq = √(Var(ζ)/(1−b²)). s = (X_L − m)/σ_eq, där m centreras över alla aktier
 * (artikelns modifiering). Kräver b ∈ (0,1); annars ok = false.
 */
export function sScores(R: ArrayLike<number>[], F: ArrayLike<number>[], L = 60): SScore[] {
  const T = R[0].length;
  const from = T - L;
  const Fw = F.map((f) => Array.prototype.slice.call(f, from) as number[]);
  const raw = R.map((r) => {
    const y = Array.prototype.slice.call(r, from) as number[];
    const { coef, resid } = lstsq(y, Fw);
    const cum = new Float64Array(L);
    let c = 0; for (let t = 0; t < L; t++) { c += resid[t]; cum[t] = c; }
    const ar = lstsq(cum.subarray(1), [cum.subarray(0, L - 1)]);
    const a = ar.coef[0], b = ar.coef[1];
    let v = 0; for (let t = 0; t < ar.resid.length; t++) v += ar.resid[t] ** 2;
    v /= ar.resid.length - 2;
    const ok = b > 0 && b < 1;
    const kappa = ok ? -Math.log(b) * 252 : NaN;
    const m = ok ? a / (1 - b) : NaN;
    const sigmaEq = ok ? Math.sqrt(v / (1 - b * b)) : NaN;
    return { a, b, ok, kappa, m, sigmaEq, betas: coef.slice(1), resid, cum, last: cum[L - 1] };
  });
  const okM = raw.filter((x) => x.ok).map((x) => x.m);
  const mBar = okM.length ? okM.reduce((p, q) => p + q, 0) / okM.length : 0;
  return raw.map((x) => ({
    s: x.ok ? (x.last - (x.m - mBar)) / x.sigmaEq : NaN,
    kappa: x.kappa, halfLife: x.ok ? (Math.LN2 / x.kappa) * 252 : NaN,
    m: x.m - mBar, sigmaEq: x.sigmaEq, betas: x.betas, ok: x.ok, resid: x.resid, cum: x.cum,
  }));
}

/** Hierarkisk klustring (average linkage), avstånd 1 − ρ. Returnerar bladordningen (lika aktier hamnar bredvid varandra). */
export function clusterOrder(C: number[][]): number[] {
  type Node = { items: number[] };
  let nodes: Node[] = C.map((_, i) => ({ items: [i] }));
  const dist = (a: Node, b: Node) => {
    let s = 0; for (const i of a.items) for (const j of b.items) s += 1 - C[i][j];
    return s / (a.items.length * b.items.length);
  };
  while (nodes.length > 1) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const d = dist(nodes[i], nodes[j]); if (d < bd) { bd = d; bi = i; bj = j; } }
    const merged = { items: [...nodes[bi].items, ...nodes[bj].items] };
    nodes = nodes.filter((_, k) => k !== bi && k !== bj);
    nodes.push(merged);
  }
  return nodes[0].items;
}
