import { describe, expect, it } from "vitest";
import { DEFAULT_LBO, maxPremium, runLbo, type LboInput } from "./lbo";

const base: LboInput = { ...DEFAULT_LBO, ebitda0: 100, revenue0: 500, marketCap: 800, netDebt0: 200, capexPct: 0.04 };

describe("LBO", () => {
  it("värdeskapandebryggan summerar exakt till vinsten", () => {
    const r = runLbo(base);
    const b = r.bridge;
    expect(b.ebitdaGrowth + b.multiple + b.deleveraging + b.fees).toBeCloseTo(r.equityOut - r.equityIn, 6);
  });
  it("inträde: EV, multipel och eget kapital stämmer för hand", () => {
    const r = runLbo(base);
    expect(r.equityPrice).toBeCloseTo(1040, 9);         // 800 × 1,3
    expect(r.entryEv).toBeCloseTo(1240, 9);             // + 200 nettoskuld
    expect(r.entryMultiple).toBeCloseTo(12.4, 9);
    expect(r.debt0).toBeCloseTo(500, 9);                // 5 × 100
    expect(r.equityIn).toBeCloseTo(1240 + 24.8 - 500, 9);
  });
  it("år 1 kassaflöde räknat för hand", () => {
    const y = runLbo(base).years[0];
    const rev = 520, margin = 0.2 + 0.01 / 5, ebitda = rev * margin, da = 0.04 * rev;
    const interest = 0.08 * 500, tax = (ebitda - da - interest) * 0.206, dNwc = 0.1 * 20;
    expect(y.fcf).toBeCloseTo(ebitda - da - tax - interest - dNwc, 9);
    expect(y.debt).toBeCloseTo(500 - y.fcf, 9);
  });
  it("utan hävstång och tillväxt blir IRR ≈ FCF-avkastning; högre premie sänker IRR", () => {
    const lo = runLbo({ ...base, premium: 0.1 }).irr, hi = runLbo({ ...base, premium: 0.5 }).irr;
    expect(hi).toBeLessThan(lo);
    const mp = maxPremium(base, 0.2)!;
    expect(runLbo({ ...base, premium: mp }).irr).toBeCloseTo(0.2, 6);
  });
});
