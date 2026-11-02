/** Hjälpfunktioner för marknadsöversikt och korrelation. */
import type { Prices } from "./types";

export type Period = "1D" | "1V" | "1M" | "3M" | "YTD" | "1Y" | "3Y";
export const PERIODS: { value: Period; label: string }[] = [
  { value: "1D", label: "1 dag" }, { value: "1V", label: "1 v" }, { value: "1M", label: "1 m" }, { value: "3M", label: "3 m" },
  { value: "YTD", label: "i år" }, { value: "1Y", label: "1 år" }, { value: "3Y", label: "3 år" },
];

/** Index i prices.dates där perioden börjar (stängningen man jämför med). */
export function periodStart(dates: string[], last: number, p: Period): number {
  const back: Record<string, number> = { "1D": 1, "1V": 5, "1M": 21, "3M": 63, "1Y": 252, "3Y": 756 };
  if (p === "YTD") {
    const y = dates[last].slice(0, 4);
    let i = last; while (i > 0 && dates[i - 1].slice(0, 4) === y) i--;
    return Math.max(0, i - 1);
  }
  return Math.max(0, last - back[p]);
}

/** Senaste icke-null-värdet på eller före index i. */
function at(c: (number | null)[], i: number): number | null {
  for (let k = i; k >= 0 && k > i - 10; k--) if (c[k] != null) return c[k];
  return null;
}

export function periodReturn(prices: Prices, ticker: string, p: Period): number | null {
  const c = prices.series[ticker]?.close; if (!c) return null;
  const last = prices.dates.length - 1;
  const a = at(c, periodStart(prices.dates, last, p)), b = at(c, last);
  return a != null && b != null ? b / a - 1 : null;
}

/** Årlig volatilitet på de senaste n dagarnas log-avkastningar. */
export function vol(prices: Prices, ticker: string, n = 252): number | null {
  const c = prices.series[ticker].close, end = prices.dates.length - 1;
  const r: number[] = [];
  for (let i = Math.max(1, end - n + 1); i <= end; i++) if (c[i] != null && c[i - 1] != null) r.push(Math.log((c[i] as number) / (c[i - 1] as number)));
  if (r.length < 20) return null;
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1) * 252);
}

/**
 * Rullande genomsnittlig parvis korrelation. Varje fönster (L dagar, steg `step`) tar med de aktier som har
 * kurs alla dagar i fönstret. Snittkorrelationen räknas exakt via standardiserade avkastningar:
 *   Σ_ij ρ_ij = Var(Σ_i z_i) ⇒ ρ̄ = (Var(Σ z) − N) / (N(N−1)).
 */
export function rollingAvgCorr(prices: Prices, tickers: string[], L = 63, step = 5) {
  const T = prices.dates.length;
  const lr = tickers.map((t) => {
    const c = prices.series[t].close, r = new Float64Array(T).fill(NaN);
    for (let i = 1; i < T; i++) if (c[i] != null && c[i - 1] != null) r[i] = Math.log((c[i] as number) / (c[i - 1] as number));
    return r;
  });
  const dates: string[] = [], avg: number[] = [], count: number[] = [];
  for (let end = T - 1; end >= L + 1; end -= step) {
    const from = end - L + 1;
    const Z: Float64Array[] = [];
    for (const r of lr) {
      let ok = true, s = 0;
      for (let t = from; t <= end; t++) { if (!Number.isFinite(r[t])) { ok = false; break; } s += r[t]; }
      if (!ok) continue;
      const m = s / L; let v = 0;
      for (let t = from; t <= end; t++) v += (r[t] - m) ** 2;
      const sd = Math.sqrt(v / (L - 1)); if (sd === 0) continue;
      const z = new Float64Array(L); for (let t = 0; t < L; t++) z[t] = (r[from + t] - m) / sd;
      Z.push(z);
    }
    const N = Z.length; if (N < 5) continue;
    const sum = new Float64Array(L);
    for (const z of Z) for (let t = 0; t < L; t++) sum[t] += z[t];
    let ms = 0; for (let t = 0; t < L; t++) ms += sum[t]; ms /= L;
    let vs = 0; for (let t = 0; t < L; t++) vs += (sum[t] - ms) ** 2; vs /= L - 1;
    dates.push(prices.dates[end]); avg.push((vs - N) / (N * (N - 1))); count.push(N);
  }
  return { dates: dates.reverse(), avg: avg.reverse(), count: count.reverse() };
}

/** Rullande årlig volatilitet (L dagar), sampel varje `step` dag – för volatilitetslandskapet. */
export function rollingVolGrid(prices: Prices, tickers: string[], days: number, L = 21, step = 5) {
  const T = prices.dates.length;
  const ends: number[] = [];
  for (let e = T - 1; e >= Math.max(L + 1, T - days); e -= step) ends.push(e);
  ends.reverse();
  const z = tickers.map((t) => {
    const c = prices.series[t].close;
    return ends.map((e) => {
      const r: number[] = [];
      for (let i = e - L + 1; i <= e; i++) if (c[i] != null && c[i - 1] != null) r.push(Math.log((c[i] as number) / (c[i - 1] as number)));
      if (r.length < L * 0.8) return null;
      const m = r.reduce((a, b) => a + b, 0) / r.length;
      return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1) * 252);
    });
  });
  return { dates: ends.map((e) => prices.dates[e]), z };
}

/** Sektorfärger (samma som .sector-dot i CSS). */
export function sectorColor(s: string): string {
  const v = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const m: Record<string, string> = {
    finans: v("--series-b"), industri: v("--series-a"), halsovard: v("--pos"), material: v("--warn"),
    it: v("--series-c"), telekom: "#22d3ee", sallanskop: "#f472b6", dagligvaror: "#a3e635",
  };
  return m[s] ?? v("--text-3");
}

export const short = (t: string) => t.replace(".ST", "");
