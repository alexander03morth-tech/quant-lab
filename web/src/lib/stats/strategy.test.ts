import { describe, expect, it } from "vitest";
import golden from "./__golden__/golden.json";
import { positionsFromState, signals, spreadModel } from "./strategy";

const g = (golden as any[])[0];
const params = { hedge: "rolling" as const, hedgeWindow: 120, delta: 1e-4, zWindow: 60 };

describe("look-ahead", () => {
  it.each(["rolling", "kalman"] as const)("%s: värden t.o.m. dag t ändras inte av framtida data", (hedge) => {
    const full = spreadModel(g.y, g.x, { ...params, hedge });
    const cut = 700;
    const part = spreadModel(g.y.slice(0, cut), g.x.slice(0, cut), { ...params, hedge });
    for (let t = 0; t < cut; t++) {
      if (Number.isNaN(part.z[t])) { expect(Number.isNaN(full.z[t])).toBe(true); continue; }
      expect(full.z[t]).toBeCloseTo(part.z[t], 10);
      expect(full.beta[t]).toBeCloseTo(part.beta[t], 10);
    }
  });

  it("statisk OLS flaggas som look-ahead och ändras av framtida data", () => {
    const full = spreadModel(g.y, g.x, { ...params, hedge: "static" });
    const part = spreadModel(g.y.slice(0, 700), g.x.slice(0, 700), { ...params, hedge: "static" });
    expect(full.lookAhead).toBe(true);
    expect(Math.abs(full.beta[0] - part.beta[0])).toBeGreaterThan(1e-6);
  });

  it("position dag t beror bara på data t.o.m. t−1", () => {
    const m = spreadModel(g.y, g.x, params);
    const { state } = signals(m.z, { entry: 2, exit: 0.5, stop: 4 });
    const pos = positionsFromState(state, 1);
    // Störa z från dag t och framåt får inte påverka position[t]
    for (const t of [200, 500, 900]) {
      const z2 = Float64Array.from(m.z);
      for (let i = t; i < z2.length; i++) z2[i] = 10 * Math.sin(i);
      const pos2 = positionsFromState(signals(z2, { entry: 2, exit: 0.5, stop: 4 }).state, 1);
      expect(Array.from(pos2.slice(0, t + 1))).toEqual(Array.from(pos.slice(0, t + 1)));
    }
  });
});

describe("signaler", () => {
  it("öppnar, stänger och respekterar stop + cooldown", () => {
    const z = [0, -2.1, -1.5, -0.4, 0, 2.5, 3, 4.2, 3.5, 2.5, 1.9, 2.2, 0.3];
    const { state, events } = signals(z, { entry: 2, exit: 0.5, stop: 4 });
    expect(Array.from(state)).toEqual([0, 1, 1, 0, 0, -1, -1, 0, 0, 0, 0, -1, 0]);
    expect(events.map((e) => e.kind)).toEqual(["long", "exit", "short", "stop", "short", "exit"]);
  });
});

import { pairReturns, tradesFrom } from "./backtest";
describe("affärslista", () => {
  it("summerar till samma totalavkastning som equity-kurvan", () => {
    const n = 40;
    const ly = Float64Array.from({ length: n }, (_, t) => Math.log(100 + 3 * Math.sin(t / 3)));
    const lx = Float64Array.from({ length: n }, () => Math.log(100));
    const pos = Int8Array.from({ length: n }, (_, t) => (t >= 5 && t < 12 ? 1 : t >= 20 && t < 30 ? -1 : 0));
    const beta = new Float64Array(n).fill(1);
    const r = pairReturns(ly, lx, beta, pos, 10, 0);
    const tr = tradesFrom(pos, r.ret);
    expect(tr.length).toBe(2);
    const g = tr.reduce((a, t) => a * (1 + t.ret), 1);
    expect(g).toBeCloseTo(r.equity[n - 1], 12);
  });
});
