import { describe, expect, it } from "vitest";
import { DEFAULT_FUND, irr, runFund } from "./fund";

describe("PE-fond", () => {
  it("allt som säljs fördelas mellan LP och GP", () => {
    const r = runFund(DEFAULT_FUND);
    const gross = r.years.reduce((s, y) => s + y.gross, 0);
    expect(r.distributedLp + r.carryGp).toBeCloseTo(gross, 2);
    expect(r.contributed).toBeCloseTo(DEFAULT_FUND.size, 0); // allt utlovat kapital används (investeringar + avgifter)
  });
  it("med full catch-up får GP exakt carry av den totala vinsten", () => {
    const r = runFund({ ...DEFAULT_FUND, grossMoic: 3.5 });
    const profit = r.distributedLp + r.carryGp - r.contributed;
    expect(r.carryGp / profit).toBeCloseTo(0.2, 6);
  });
  it("ingen vinst = ingen carry, och investerarna förlorar avgifterna", () => {
    const r = runFund({ ...DEFAULT_FUND, grossMoic: 1 });
    expect(r.carryGp).toBe(0);
    expect(r.tvpi).toBeLessThan(1);
    expect(r.netIrr).toBeLessThan(0);
  });
  it("netto-IRR < brutto-IRR, J-kurvan går under noll först", () => {
    const r = runFund(DEFAULT_FUND);
    expect(r.netIrr).toBeLessThan(r.grossIrr);
    expect(r.trough).toBeLessThan(0);
    expect(r.years[0].netCum).toBeLessThan(0);
  });
  it("irr på känt kassaflöde", () => {
    expect(irr([-100, 0, 0, 0, 0, 248.832])).toBeCloseTo(0.2, 8);
  });
});
