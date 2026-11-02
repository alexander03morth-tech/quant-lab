import { describe, expect, it } from "vitest";
import { rng } from "../../lib/portfolio/engine";
import { CALC } from "./calc";
import { INTERVIEW } from "./interview";
import { REASONING } from "./reasoning";

describe("Öva-banker", () => {
  it("räknegeneratorer ger ändliga svar och inga NaN i lösningarna", () => {
    for (const g of CALC) for (let s = 1; s <= 300; s++) {
      const c = g.make(rng(s * 97 + 3));
      expect(Number.isFinite(c.answer), `${g.id} seed ${s}`).toBe(true);
      expect(c.solution + c.q).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
  it("unika id:n och giltiga facit", () => {
    const ids = [...INTERVIEW.map((q) => q.id), ...REASONING.map((q) => q.id), ...CALC.map((q) => q.id)];
    expect(new Set(ids).size).toBe(ids.length);
    REASONING.forEach((q) => { expect(q.correct).toBeGreaterThanOrEqual(0); expect(q.correct).toBeLessThan(q.options.length); });
    expect(INTERVIEW.length).toBeGreaterThanOrEqual(50);
    expect(REASONING.length).toBeGreaterThanOrEqual(50);
    expect(CALC.length).toBeGreaterThanOrEqual(30);
  });
  it("stickprov: formler stämmer", () => {
    const irr = CALC.find((g) => g.id === "irr")!.make(rng(5));
    const m = Number(irr.q.match(/^([\d,]+)×/)![1].replace(",", ".")), y = Number(irr.q.match(/på (\d) år/)![1]);
    expect(irr.answer).toBeCloseTo((Math.pow(m, 1 / y) - 1) * 100, 8);
    const rec = CALC.find((g) => g.id === "recovery")!.make(rng(9));
    const l = Number(rec.q.match(/faller ([\d,]+) %/)![1].replace(",", ".")) / 100;
    expect(rec.answer).toBeCloseTo((l / (1 - l)) * 100, 8);
  });
});
