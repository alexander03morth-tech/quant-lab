import { describe, expect, it } from "vitest";
import { covariance, maxSharpe, minVariance, riskContrib, simulate, type ReturnMatrix } from "./engine";
import { betaAlpha, drawdown, equityFrom, perf, varCvar } from "../stats/perf";

const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
function matrix(k: number, n: number): ReturnMatrix {
  const r = rand(3);
  const dates = Array.from({ length: n }, (_, t) => new Date(Date.UTC(2020, 0, 1 + Math.floor(t * 1.4))).toISOString().slice(0, 10));
  const mkt = Array.from({ length: n }, () => r() * 0.02);
  return { dates, tickers: [], R: Array.from({ length: k }, (_, j) => Float64Array.from(mkt, (m) => m * (0.6 + 0.3 * j) + r() * 0.02)), idx: Float64Array.from(mkt), available: n, limitedBy: null };
}

describe("portföljmotor", () => {
  const M = matrix(4, 600);
  it("riskbidrag summerar till 100 % och vol stämmer", () => {
    const C = covariance(M.R), w = [0.4, 0.3, 0.2, 0.1];
    const rc = riskContrib(C, w);
    expect(rc.share.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const r = Array.from({ length: 600 }, (_, t) => w.reduce((s, wj, j) => s + wj * M.R[j][t], 0));
    const m = r.reduce((a, b) => a + b, 0) / r.length;
    const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1));
    expect(rc.vol).toBeCloseTo(sd, 12);
  });
  it("köp och behåll = viktat värde av varje akties utveckling", () => {
    const w = [0.25, 0.25, 0.25, 0.25];
    const { ret } = simulate(M, w, "none");
    const final = equityFrom(ret)[599];
    const direct = w.reduce((s, wj, j) => s + wj * equityFrom(M.R[j])[599], 0);
    expect(final).toBeCloseTo(direct, 10);
  });
  it("månadsombalansering återställer vikterna vid ny månad", () => {
    const w = [0.7, 0.1, 0.1, 0.1];
    const { drift } = simulate(M, w, "monthly");
    const t = M.dates.findIndex((d, i) => i > 0 && d.slice(0, 7) !== M.dates[i - 1].slice(0, 7));
    // dag t handlas med målvikterna → avkastningen dag t ska vara exakt viktad med w
    const { ret } = simulate(M, w, "monthly");
    expect(ret[t]).toBeCloseTo(w.reduce((s, wj, j) => s + wj * M.R[j][t], 0), 14);
    expect(drift[0][t - 1]).not.toBeCloseTo(0.7, 4);
  });
  it("minsta varians har lägre vol än lika vikt, och vikter summerar till 1", () => {
    const C = covariance(M.R);
    const wm = minVariance(C), eq = [0.25, 0.25, 0.25, 0.25];
    expect(wm.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(wm.every((v) => v >= 0)).toBe(true);
    expect(riskContrib(C, wm).vol).toBeLessThanOrEqual(riskContrib(C, eq).vol + 1e-12);
    const ws = maxSharpe([0.001, 0.0002, 0.0002, 0.0002], C);
    expect(ws[0]).toBeGreaterThan(0.25);
  });
});

describe("nyckeltal", () => {
  it("drawdown, VaR och beta på kända serier", () => {
    const dd = drawdown([1, 1.2, 0.9, 1.0, 1.3]);
    expect(Math.min(...dd)).toBeCloseTo(0.9 / 1.2 - 1, 12);
    const r = Array.from({ length: 100 }, (_, i) => (i - 50) / 1000); // −5 % … +4,9 %
    const v = varCvar(r);
    expect(v.var).toBeCloseTo(0.046, 12);
    expect(v.cvar).toBeCloseTo(0.048, 12);
    const idx = r.map((x, i) => x + (i % 2 ? 0.001 : -0.001));
    const ret = idx.map((x) => 1.5 * x + 0.0001);
    expect(betaAlpha(ret, idx).beta).toBeCloseTo(1.5, 10);
    expect(perf(Array(252).fill(0.001)).cagr).toBeCloseTo(Math.pow(1.001, 252) - 1, 10);
  });
});
