/**
 * Tvåstegs-DCF på fritt kassaflöde till företaget (FCFF).
 *  Steg 1: år 1..N, tillväxten går linjärt från g1 till terminal tillväxt gT.
 *  Steg 2: terminalvärde med Gordons formel: TV = FCF_{N+1} / (WACC − gT).
 *  WACC = E/(D+E)·kE + D/(D+E)·kD·(1 − skatt), kE från CAPM: rf + β·marknadspremie.
 */
export interface DcfInput {
  fcf0: number; netDebt: number; shares: number; marketCap: number; debt: number;
  g1: number; gT: number; years: number;
  rf: number; beta: number; erp: number; kd: number; tax: number;
  waccOverride?: number | null;
}
export interface DcfResult {
  wacc: number; ke: number; flows: { year: number; fcf: number; growth: number; pv: number }[];
  pvExplicit: number; tv: number; pvTv: number; ev: number; equity: number; perShare: number; tvShare: number;
}
export function capm(rf: number, beta: number, erp: number) { return rf + beta * erp; }
export function wacc(i: DcfInput) {
  const ke = capm(i.rf, i.beta, i.erp);
  const E = i.marketCap, D = Math.max(0, i.debt);
  return { ke, wacc: (E / (E + D)) * ke + (D / (E + D)) * i.kd * (1 - i.tax) };
}
export function runDcf(i: DcfInput): DcfResult {
  const w = wacc(i);
  const r = i.waccOverride ?? w.wacc;
  let fcf = i.fcf0, pvExplicit = 0;
  const flows = [];
  for (let t = 1; t <= i.years; t++) {
    const g = i.g1 + ((i.gT - i.g1) * (t - 1)) / Math.max(1, i.years - 1);
    fcf *= 1 + g;
    const pv = fcf / Math.pow(1 + r, t);
    pvExplicit += pv;
    flows.push({ year: t, fcf, growth: g, pv });
  }
  const tv = r > i.gT ? (fcf * (1 + i.gT)) / (r - i.gT) : Infinity;
  const pvTv = tv / Math.pow(1 + r, i.years);
  const ev = pvExplicit + pvTv;
  const equity = ev - i.netDebt;
  return { wacc: r, ke: w.ke, flows, pvExplicit, tv, pvTv, ev, equity, perShare: equity / i.shares, tvShare: pvTv / ev };
}
