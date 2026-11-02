import { describe, expect, it } from "vitest";
import g from "./__golden__/pca.json";
import { clusterOrder, corrMatrix, jacobiEigen, pca, sScores } from "./pca";

describe("PCA mot numpy", () => {
  it("korrelationsmatris = np.corrcoef", () => {
    const C = corrMatrix(g.X);
    g.corr.forEach((row: number[], i: number) => row.forEach((v, j) => expect(C[i][j]).toBeCloseTo(v, 10)));
  });
  it("egenvärden = np.linalg.eigvalsh", () => {
    const p = pca(g.X);
    p.values.forEach((v, i) => expect(v).toBeCloseTo(g.eig[i], 9));
    expect(p.explained.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it("A·v = λ·v och egenvektorerna är ortonormala", () => {
    const C = corrMatrix(g.X);
    const { values, vectors } = jacobiEigen(C);
    vectors.forEach((v, k) => {
      const Av = C.map((row) => row.reduce((s, c, j) => s + c * v[j], 0));
      Av.forEach((x, i) => expect(x).toBeCloseTo(values[k] * v[i], 9));
      vectors.forEach((u, l) => expect(u.reduce((s, x, i) => s + x * v[i], 0)).toBeCloseTo(k === l ? 1 : 0, 9));
    });
  });
  it("klustring lägger ihop de korrelerade serierna 0, 1, 2", () => {
    const ord = clusterOrder(corrMatrix(g.X));
    const pos = [0, 1, 2].map((i) => ord.indexOf(i)).sort();
    expect(pos[2] - pos[0]).toBe(2);
  });
  it("s-score: en aktie som just fallit mycket mot faktorn får negativt s", () => {
    // faktorn = slump; aktie 0 följer faktorn men har en OU-residual som slutar långt under sitt medel
    let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    const T = 60, F = Float64Array.from({ length: T }, () => rnd() * 0.02);
    const stocks = Array.from({ length: 5 }, (_, i) => {
      let x = 0; return Float64Array.from({ length: T }, (_, t) => { const nx = 0.8 * x + rnd() * 0.01; const r = F[t] + (nx - x); x = nx; return r + (i === 0 && t === T - 1 ? -0.05 : 0); });
    });
    const s = sScores(stocks, [F], T);
    expect(s[0].ok).toBe(true);
    expect(s[0].s).toBeLessThan(-1);
  });
});
