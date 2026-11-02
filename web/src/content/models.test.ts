import { describe, expect, it } from "vitest";
import { rng } from "../lib/portfolio/engine";
import { runMerger } from "../lib/ib/merger";
import { DCF_EX, FUND_EX, LBO_EX, MA_EX } from "./models";

const ALL = [...LBO_EX, ...MA_EX, ...DCF_EX, ...FUND_EX];
const num = (s: string) => Number(s.replace(/\s| /g, "").replace(/[^\d,.-]/g, "").replace(",", "."));

describe("övningar", () => {
  it("alla facit är ändliga tal och varje nivå har övningar", () => {
    for (const ex of ALL) for (let s = 1; s <= 200; s++) {
      const c = ex.make(rng(s));
      c.steps.forEach((st) => expect(Number.isFinite(st.answer), `${ex.title} seed ${s}: ${st.q}`).toBe(true));
      expect(c.givens.length).toBeGreaterThan(0);
    }
    for (const set of [LBO_EX, MA_EX, DCF_EX, FUND_EX]) for (const l of [1, 2, 3]) expect(set.some((e) => e.level === l)).toBe(true);
  });

  it("LBO nivå 3: värdebryggan summerar till vinsten och skulden förblir positiv", () => {
    const ex = LBO_EX.find((e) => e.level === 3)!;
    for (let s = 1; s <= 200; s++) {
      const st = ex.make(rng(s)).steps;
      const D3 = st[5].answer, Eo = st[7].answer, moic = st[8].answer;
      const Ein = Eo / moic;
      expect(D3).toBeGreaterThan(0);
      expect(st[10].answer + st[11].answer + st[12].answer).toBeCloseTo(Eo - Ein, 6);
    }
  });

  it("Fond nivå 3: förvaltaren får exakt 20 % av vinsten och inget steg blir negativt", () => {
    const ex = FUND_EX.find((e) => e.level === 3)!;
    for (let s = 1; s <= 200; s++) {
      const st = ex.make(rng(s)).steps;
      expect(st[3].answer).toBeGreaterThanOrEqual(0);
      expect(st[4].answer).toBeCloseTo(0.2 * st[0].answer, 6);
    }
  });

  it("M&A nivå 2 och 3 ger samma accretion som verktygets runMerger", () => {
    const [l2, l3] = [MA_EX.find((e) => e.level === 2)!, MA_EX.find((e) => e.level === 3)!];
    for (let s = 1; s <= 100; s++) {
      for (const [ex, stock, kdIdx] of [[l2, 1, -1], [l3, 0.5, 1]] as const) {
        const c = ex.make(rng(s));
        const g = Object.fromEntries(c.givens);
        const side = (ni: string, n: string, p: string) => ({ name: "", netIncome: num(g[ni]) * 1e6, shares: num(g[n]) * 1e6, price: num(g[p]), netDebt: 0, ebitda: 1 });
        const kd = kdIdx > 0 ? num(g["Låneränta"]) / 100 : 0;
        const syn = kdIdx > 0 ? num(g["Synergier (före skatt)"]) * 1e6 : 0;
        const res = runMerger({
          acq: side("Köparens nettovinst", "Köparens antal aktier", "Köparens kurs"), tgt: side("Målets nettovinst", "Målets antal aktier", "Målets kurs"),
          premium: num(g["Budpremie"]) / 100, pctStock: stock, pctCash: 0, kd, cashYield: 0, tax: 0.206, synergies: syn, feePct: 0,
        });
        const accStep = c.steps.find((x) => x.q.startsWith("Accretion"))!;
        expect(accStep.answer).toBeCloseTo(res.accretion * 100, 6);
        if (kdIdx > 0) expect(c.steps[8].answer).toBeCloseTo(res.breakevenSynergies / 1e6, 4);
      }
    }
  });
});
