/**
 * Avkastningsmotor för pairs trading. position[t] (från positionsFromState med lag ≥ 1) är innehavet
 * under dag t. Hedge ratio som används dag t är β_{t−1} – den som var känd när positionen togs.
 *
 * Bruttoexponering normaliseras till 1: lång 1/(1+|β|) i A och kort β/(1+|β|) i B.
 * Kostnad dras vid varje förändring av positionen: costBps per sida och ben (avgift + halva spreaden).
 */
export interface ReturnsResult {
  ret: Float64Array;
  equity: Float64Array;
  trades: number;
}

export function pairReturns(
  ly: ArrayLike<number>, lx: ArrayLike<number>, beta: ArrayLike<number>, pos: ArrayLike<number>,
  costBps = 10, borrowBpsYear = 50,
): ReturnsResult {
  const n = ly.length;
  const ret = new Float64Array(n), equity = new Float64Array(n);
  let eq = 1, trades = 0;
  equity[0] = 1;
  for (let t = 1; t < n; t++) {
    const p = pos[t], pPrev = pos[t - 1];
    const b = beta[t - 1];
    let r = 0;
    if (p !== 0 && Number.isFinite(b)) {
      const ra = Math.expm1(ly[t] - ly[t - 1]), rb = Math.expm1(lx[t] - lx[t - 1]);
      const wA = 1 / (1 + Math.abs(b)), wB = b / (1 + Math.abs(b));
      r = p * (wA * ra - wB * rb);
      // lånekostnad på det blankade benet
      const shortW = p > 0 ? Math.abs(wB) : wA;
      r -= shortW * (borrowBpsYear / 1e4) / 252;
    }
    if (p !== pPrev) {
      // stänga + öppna = upp till två sidor per ben
      const sides = Math.abs(p - pPrev);
      r -= sides * (costBps / 1e4);
      if (p !== 0) trades++;
    }
    ret[t] = r;
    eq *= 1 + r;
    equity[t] = eq;
  }
  return { ret, equity, trades };
}

export function sharpe(ret: ArrayLike<number>, from = 0): number {
  let s = 0, s2 = 0, c = 0;
  for (let i = from; i < ret.length; i++) { s += ret[i]; s2 += ret[i] * ret[i]; c++; }
  if (c < 20) return NaN;
  const m = s / c, v = s2 / c - m * m;
  return v > 0 ? (m / Math.sqrt(v)) * Math.sqrt(252) : NaN;
}

export interface Trade { start: number; end: number; side: number; ret: number; days: number; open: boolean }

/**
 * Affärslista från positionsserien: en affär = en sammanhängande period med samma position ≠ 0.
 * Avkastningen är den sammansatta dagliga avkastningen under perioden, inklusive kostnader
 * (även stängningskostnaden, som bokförs dagen positionen blir 0).
 */
export function tradesFrom(pos: ArrayLike<number>, ret: ArrayLike<number>): Trade[] {
  const out: Trade[] = [];
  let cur: { start: number; side: number; g: number } | null = null;
  for (let t = 1; t < pos.length; t++) {
    const p = pos[t];
    if (cur && p !== cur.side) {
      // dagen positionen ändras bär stängningskostnaden
      cur.g *= 1 + ret[t];
      out.push({ start: cur.start, end: t, side: cur.side, ret: cur.g - 1, days: t - cur.start, open: false });
      cur = null;
      if (p !== 0) cur = { start: t, side: p, g: 1 }; // vänd direkt (sällsynt)
      continue;
    }
    if (!cur && p !== 0) cur = { start: t, side: p, g: 1 + ret[t] };
    else if (cur) cur.g *= 1 + ret[t];
  }
  if (cur) out.push({ start: cur.start, end: pos.length - 1, side: cur.side, ret: cur.g - 1, days: pos.length - 1 - cur.start, open: true });
  return out;
}
