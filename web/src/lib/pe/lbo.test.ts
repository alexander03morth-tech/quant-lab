import { describe, expect, it } from "vitest";
import { DEFAULT_LBO, maxEntryMultiple, runLbo, type LboInput } from "./lbo";

const base: LboInput = { ...DEFAULT_LBO, ebitda0: 100, revenue0: 500, entryMultiple: 12.4, capexPct: 0.04 };

describe("LBO", () => {
  it("värdeskapandebryggan summerar exakt till vinsten", () => {
    const r = runLbo({ ...base, exitMultiple: 14 });
    const b = r.bridge;
    expect(b.ebitdaGrowth + b.multiple + b.deleveraging + b.fees).toBeCloseTo(r.equityOut - r.equityIn, 6);
  });
  it("inträde: EV, skuld och eget kapital stämmer för hand", () => {
    const r = runLbo(base);
    expect(r.entryEv).toBeCloseTo(1240, 9);
    expect(r.debt0).toBeCloseTo(500, 9);
    expect(r.equityIn).toBeCloseTo(1240 + 24.8 - 500, 9);
  });
  it("år 1 kassaflöde räknat för hand", () => {
    const y = runLbo(base).years[0];
    const rev = 520, margin = 0.2 + 0.01 / 5, ebitda = rev * margin, da = 0.04 * rev;
    const interest = 0.08 * 500, tax = (ebitda - da - interest) * 0.206, dNwc = 0.1 * 20;
    expect(y.fcf).toBeCloseTo(ebitda - da - tax - interest - dNwc, 9);
    expect(y.debt).toBeCloseTo(500 - y.fcf, 9);
  });
  it("dyrare köp ger lägre IRR; maxmultipel ger exakt målavkastningen", () => {
    expect(runLbo({ ...base, entryMultiple: 14, exitMultiple: 12 }).irr).toBeLessThan(runLbo({ ...base, entryMultiple: 10, exitMultiple: 12 }).irr);
    const m = maxEntryMultiple({ ...base, exitMultiple: 12 }, 0.2)!;
    expect(runLbo({ ...base, entryMultiple: m, exitMultiple: 12 }).irr).toBeCloseTo(0.2, 6);
  });
});
