import { alignedPair } from "../data";
import { betaAlpha } from "../stats/perf";
import type { Prices } from "../types";

/** Beta mot index på dagliga avkastningar, senaste `days` handelsdagarna. */
export function betaVs(prices: Prices, ticker: string, bench: string, days = 1260): number {
  const al = alignedPair(prices, ticker, bench, days);
  const ra: number[] = [], rb: number[] = [];
  for (let i = 1; i < al.pa.length; i++) { ra.push(al.pa[i] / al.pa[i - 1] - 1); rb.push(al.pb[i] / al.pb[i - 1] - 1); }
  return betaAlpha(ra, rb).beta;
}
