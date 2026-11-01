/**
 * Förenklad LBO-modell (leveraged buyout) på årsbasis – samma logik som en PE-analytiker bygger i Excel.
 *
 * Köp:   EV = inträdesmultipel × EBITDA (så prissätts privata bolag). Befintlig nettoskuld löses vid köpet.
 * Finansiering: ny skuld = skuldsättning × EBITDA. Resten + avgifter = sponsorns eget kapital.
 * År t:  omsättning växer, marginal ändras linjärt, fritt kassaflöde (efter ränta och skatt) amorterar skulden ("cash sweep").
 * Exit:  EV = exitmultipel × EBITDA år N. Eget kapital ut = EV − skuld + kassa.
 * Avkastning: MOIC = ut / in, IRR = MOIC^(1/N) − 1 (inga utdelningar under innehavet).
 */
export interface LboInput {
  ebitda0: number;        // EBITDA senaste 12 mån (kr)
  revenue0: number;       // omsättning senaste 12 mån (kr)
  entryMultiple: number;  // köpeskilling som EV/EBITDA, t.ex. 10
  leverage: number;       // ny skuld / EBITDA, t.ex. 5
  rate: number;           // räntekostnad, t.ex. 0,08
  growth: number;         // årlig omsättningstillväxt
  marginDelta: number;    // förändring i EBITDA-marginal över hela perioden (t.ex. +0,02)
  capexPct: number;       // capex i % av omsättning (antas = avskrivningar)
  nwcPct: number;         // rörelsekapitalbehov i % av omsättningsökningen
  tax: number;            // bolagsskatt (Sverige 20,6 %)
  feePct: number;         // transaktionsavgifter i % av EV
  exitMultiple: number | null; // null = samma som inträdesmultipeln
  years: number;
}

export interface LboYear {
  year: number; revenue: number; ebitda: number; margin: number; da: number; ebit: number;
  interest: number; tax: number; capex: number; dNwc: number; fcf: number; debt: number; cash: number;
  coverage: number; leverage: number;
}

export interface LboResult {
  entryEv: number; entryMultiple: number; debt0: number; fees: number; equityIn: number;
  exitEv: number; exitMultiple: number; equityOut: number; moic: number; irr: number;
  years: LboYear[];
  bridge: { ebitdaGrowth: number; multiple: number; deleveraging: number; fees: number };
  warnings: string[];
}

export const DEFAULT_LBO: Omit<LboInput, "ebitda0" | "revenue0" | "entryMultiple" | "capexPct"> = {
  leverage: 5, rate: 0.08, growth: 0.04, marginDelta: 0.01, nwcPct: 0.1, tax: 0.206, feePct: 0.02, exitMultiple: null, years: 5,
};

export function runLbo(i: LboInput): LboResult {
  const entryMultiple = i.entryMultiple;
  const entryEv = entryMultiple * i.ebitda0;
  const fees = i.feePct * entryEv;
  const debt0 = Math.min(i.leverage * i.ebitda0, 0.85 * entryEv);
  const equityIn = entryEv + fees - debt0;
  const m0 = i.ebitda0 / i.revenue0;
  const warnings: string[] = [];
  if (debt0 < i.leverage * i.ebitda0) warnings.push("Skulden begränsades till 85 % av köpeskillingen – ingen bank lånar ut mer än så.");

  let rev = i.revenue0, debt = debt0, cash = 0;
  const years: LboYear[] = [];
  for (let t = 1; t <= i.years; t++) {
    const prevRev = rev;
    rev = prevRev * (1 + i.growth);
    const margin = m0 + (i.marginDelta * t) / i.years;
    const ebitda = rev * margin;
    const da = i.capexPct * rev;
    const ebit = ebitda - da;
    const interest = i.rate * debt;
    const tax = Math.max(0, ebit - interest) * i.tax;
    const capex = i.capexPct * rev;
    const dNwc = i.nwcPct * (rev - prevRev);
    const fcf = ebitda - capex - tax - interest - dNwc;
    // cash sweep: allt fritt kassaflöde amorterar; när skulden är borta byggs kassa
    if (fcf >= 0) { const pay = Math.min(debt, fcf); debt -= pay; cash += fcf - pay; }
    else { debt += -fcf; }
    years.push({ year: t, revenue: rev, ebitda, margin, da, ebit, interest, tax, capex, dNwc, fcf, debt, cash,
      coverage: interest > 0 ? ebitda / interest : Infinity, leverage: debt / ebitda });
  }
  const last = years[years.length - 1];
  const exitMultiple = i.exitMultiple ?? entryMultiple;
  const exitEv = exitMultiple * last.ebitda;
  const equityOut = exitEv - last.debt + last.cash;
  const moic = equityOut / equityIn;
  const irr = moic > 0 ? Math.pow(moic, 1 / i.years) - 1 : -1;
  const y1 = years[0];
  if (y1.coverage < 2) warnings.push(`Räntetäckningen år 1 är bara ${y1.coverage.toFixed(1).replace(".", ",")}× – banker kräver normalt minst 2–3×.`);
  if (years.some((y) => y.fcf < 0)) warnings.push("Kassaflödet räcker inte till räntan något år – skulden växer i stället för att betalas av.");
  return {
    entryEv, entryMultiple, debt0, fees, equityIn, exitEv, exitMultiple, equityOut, moic, irr, years,
    bridge: {
      ebitdaGrowth: (last.ebitda - i.ebitda0) * entryMultiple,
      multiple: (exitMultiple - entryMultiple) * last.ebitda,
      deleveraging: debt0 - last.debt + last.cash,
      fees: -fees,
    },
    warnings,
  };
}

/**
 * Högsta inträdesmultipel som fortfarande ger målavkastningen (bisektion). "Vad har PE-köparen råd att betala?"
 * Exitmultipeln hålls fast (om den är satt) – annars antas exit = inträde, vilket gör frågan cirkulär,
 * så då används den nuvarande inträdesmultipeln som fast exit.
 */
export function maxEntryMultiple(i: LboInput, targetIrr = 0.2): number | null {
  const exit = i.exitMultiple ?? i.entryMultiple;
  const f = (m: number) => runLbo({ ...i, entryMultiple: m, exitMultiple: exit }).irr - targetIrr;
  let lo = 1, hi = 40;
  if (f(lo) < 0) return null;
  if (f(hi) > 0) return hi;
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
