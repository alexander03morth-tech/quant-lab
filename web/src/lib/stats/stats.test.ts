/** Verifierar TypeScript-statistiken mot statsmodels (golden.json skapas av pipeline/tools/make_golden.py). */
import { describe, expect, it } from "vitest";
import golden from "./__golden__/golden.json";
import { adfuller, coint, johansen, mackinnonp, normCdf } from "./tests";
import { halfLife, hurst, kalman, kalmanInit, staticSpread } from "./meanrev";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));

describe("normCdf", () => {
  it("matchar kända värden", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 15);
    expect(normCdf(-1.959963984540054)).toBeCloseTo(0.025, 12);
    expect(rel(normCdf(-6), 9.865876450376946e-10)).toBeLessThan(1e-10);
    expect(rel(normCdf(-20), 2.7536241186061556e-89)).toBeLessThan(1e-10);
  });
  it("mackinnonp gränsfall", () => {
    expect(mackinnonp(5, "c", 1)).toBe(1);
    expect(mackinnonp(-40, "c", 2)).toBe(0);
  });
});

for (const g of golden as any[]) {
  describe(`${g.a} / ${g.b} (${g.y.length} dagar)`, () => {
    const s = staticSpread(g.y, g.x);
    it("OLS hedge ratio", () => {
      expect(rel(s.beta, g.ols.beta)).toBeLessThan(1e-9);
      expect(rel(s.alpha, g.ols.alpha)).toBeLessThan(1e-9);
    });
    it("ADF (konstant, AIC)", () => {
      const r = adfuller(s.resid);
      expect(r.usedlag).toBe(g.adf.lag);
      expect(r.nobs).toBe(g.adf.nobs);
      expect(rel(r.stat, g.adf.stat)).toBeLessThan(1e-7);
      expect(rel(r.pvalue, g.adf.p)).toBeLessThan(1e-6);
      expect(rel(r.icbest!, g.adf.ic)).toBeLessThan(1e-8);
      for (const k of ["1%", "5%", "10%"] as const) expect(rel(r.crit[k], g.adf.crit[k])).toBeLessThan(1e-9);
    });
    it("ADF (utan konstant)", () => {
      const r = adfuller(s.resid, { regression: "n" });
      expect(r.usedlag).toBe(g.adfN.lag);
      expect(rel(r.stat, g.adfN.stat)).toBeLessThan(1e-7);
      expect(rel(r.pvalue, g.adfN.p)).toBeLessThan(1e-6);
    });
    it("Engle-Granger", () => {
      const r = coint(g.y, g.x);
      expect(rel(r.stat, g.coint.stat)).toBeLessThan(1e-7);
      expect(rel(r.pvalue, g.coint.p)).toBeLessThan(1e-6);
      [r.crit["1%"], r.crit["5%"], r.crit["10%"]].forEach((c, i) => expect(rel(c, g.coint.crit[i])).toBeLessThan(1e-9));
    });
    it("Johansen", () => {
      const r = johansen(g.y, g.x);
      for (let i = 0; i < 2; i++) {
        expect(rel(r.eig[i], g.johansen.eig[i])).toBeLessThan(1e-7);
        expect(rel(r.trace[i], g.johansen.trace[i])).toBeLessThan(1e-7);
        expect(rel(r.maxEig[i], g.johansen.maxEig[i])).toBeLessThan(1e-7);
      }
      expect(rel(r.vector[1], g.johansen.vector[1])).toBeLessThan(1e-6);
    });
    it("half-life och Hurst", () => {
      expect(rel(halfLife(s.resid).hl, g.halfLife)).toBeLessThan(1e-8);
      expect(rel(hurst(s.resid), g.hurst)).toBeLessThan(1e-8);
    });
    it("Kalmanfilter", () => {
      const k = kalman(g.y, g.x, 1e-4, 1e-3);
      g.kalman.beta.forEach((b: number, i: number) => expect(k.beta[i * 25]).toBeCloseTo(b, 9));
      expect(rel(k.beta[k.beta.length - 1], g.kalman.betaLast)).toBeLessThan(1e-9);
      expect(Math.abs(k.e[k.e.length - 1] - g.kalman.eLast)).toBeLessThan(1e-9); // litet tal: absolut tolerans
      expect(rel(k.Q[k.Q.length - 1], g.kalman.QLast)).toBeLessThan(1e-9);
    });
    it("Kalmanfilter med OLS-start (δ = 1e-7)", () => {
      const ki = kalmanInit(g.y, g.x, 60);
      expect(rel(ki.theta[0], g.kalmanInit.theta[0])).toBeLessThan(1e-9);
      expect(rel(ki.ve, g.kalmanInit.ve)).toBeLessThan(1e-9);
      expect(rel(ki.P[0][1], g.kalmanInit.P[0][1])).toBeLessThan(1e-7);
      const k = kalman(g.y.slice(60), g.x.slice(60), 1e-7, ki.ve, ki);
      g.kalmanInit.beta.forEach((b: number, i: number) => expect(k.beta[i * 25]).toBeCloseTo(b, 8));
      g.kalmanInit.e.forEach((e: number, i: number) => expect(k.e[i * 25]).toBeCloseTo(e, 8));
    });
  });
}
