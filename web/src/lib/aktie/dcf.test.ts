import { describe, expect, it } from "vitest";
import { runDcf, wacc, type DcfInput } from "./dcf";

const base: DcfInput = { fcf0: 100, netDebt: 200, shares: 10, marketCap: 1500, debt: 300, g1: 0.05, gT: 0.05, years: 5, rf: 0.025, beta: 1, erp: 0.05, kd: 0.05, tax: 0.206 };

describe("DCF", () => {
  it("konstant tillväxt ger samma värde som Gordons formel direkt", () => {
    const r = runDcf({ ...base, waccOverride: 0.09 });
    // EV = FCF1 / (r − g) när tillväxten är konstant hela vägen
    expect(r.ev).toBeCloseTo((100 * 1.05) / (0.09 - 0.05), 6);
    expect(r.perShare).toBeCloseTo((r.ev - 200) / 10, 9);
  });
  it("WACC räknad för hand", () => {
    const w = wacc(base);
    expect(w.ke).toBeCloseTo(0.075, 12);
    expect(w.wacc).toBeCloseTo((1500 / 1800) * 0.075 + (300 / 1800) * 0.05 * 0.794, 12);
  });
  it("högre WACC sänker värdet; terminalvärdet dominerar", () => {
    const a = runDcf({ ...base, waccOverride: 0.08 }), b = runDcf({ ...base, waccOverride: 0.1 });
    expect(b.perShare).toBeLessThan(a.perShare);
    expect(a.tvShare).toBeGreaterThan(0.6);
  });
});
