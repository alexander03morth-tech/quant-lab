import { describe, expect, it } from "vitest";
import { runMerger, type MergerInput } from "./merger";

const acq = { name: "A", price: 100, shares: 1000, netIncome: 5000, netDebt: 10000, ebitda: 12000 }; // P/E 20
const tgt = { name: "B", price: 50, shares: 400, netIncome: 1000, netDebt: 2000, ebitda: 2500 };     // P/E 20
const base: MergerInput = { acq, tgt, premium: 0, pctStock: 1, pctCash: 0, kd: 0.06, cashYield: 0.02, tax: 0.206, synergies: 0, feePct: 0 };

describe("M&A accretion/dilution", () => {
  it("helt aktiebetalt, samma P/E, ingen premie → EPS oförändrad", () => {
    expect(runMerger(base).accretion).toBeCloseTo(0, 12);
  });
  it("köpa ett billigare bolag med aktier → accretive; dyrare → dilutive", () => {
    expect(runMerger({ ...base, tgt: { ...tgt, price: 30 } }).accretion).toBeGreaterThan(0);
    expect(runMerger({ ...base, premium: 0.4 }).accretion).toBeLessThan(0);
  });
  it("synergier vid break-even ger exakt oförändrad EPS", () => {
    const r = runMerger({ ...base, premium: 0.3, pctStock: 0.5, pctCash: 0.2 });
    const r2 = runMerger({ ...base, premium: 0.3, pctStock: 0.5, pctCash: 0.2, synergies: r.breakevenSynergies });
    expect(r2.accretion).toBeCloseTo(0, 10);
  });
  it("skuldfinansiering: EPS räknad för hand", () => {
    const r = runMerger({ ...base, pctStock: 0, pctCash: 0 });
    const ni = 5000 + 1000 - 20000 * 0.06 * 0.794;
    expect(r.epsAfter).toBeCloseTo(ni / 1000, 10);
  });
});
