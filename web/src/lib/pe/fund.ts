/**
 * Förenklad PE-fond ur investerarens (LP:s) perspektiv, årsvis.
 *
 *  - Investerarna lovar F kr. Förvaltningsavgift: feePct × F under investeringsperioden (år 1–5),
 *    därefter feePct × investerat kapital som ännu inte sålts.
 *  - Resten investeras jämnt under år 1–deployYears. Varje årskull säljs efter `hold` år till brutto-MOIC `grossMoic`.
 *  - Fördelning enligt europeisk vattenfallsmodell (hela fonden):
 *      1) LP får tillbaka allt insatt kapital (investeringar + avgifter)
 *      2) LP får preferensavkastning (hurdle, t.ex. 8 %/år på insatt kapital)
 *      3) GP får "catch-up" 100 % tills GP har carry% av all vinst
 *      4) Därefter delas allt (1 − carry) till LP och carry till GP
 */
export interface FundInput {
  size: number; feePct: number; carry: number; hurdle: number;
  grossMoic: number; hold: number; deployYears: number; life: number;
}
export interface FundYear { year: number; calls: number; fees: number; invested: number; gross: number; toLp: number; toGp: number; netCum: number; dpi: number }
export interface FundResult {
  years: FundYear[]; contributed: number; distributedLp: number; carryGp: number; feesTotal: number;
  tvpi: number; dpi: number; netIrr: number; grossIrr: number; trough: number; breakevenYear: number | null;
}

export const DEFAULT_FUND: FundInput = { size: 10e9, feePct: 0.02, carry: 0.2, hurdle: 0.08, grossMoic: 2.5, hold: 5, deployYears: 4, life: 12 };

export function irr(flows: number[]): number {
  const npv = (r: number) => flows.reduce((s, f, t) => s + f / Math.pow(1 + r, t), 0);
  let lo = -0.99, hi = 5;
  if (npv(lo) * npv(hi) > 0) return NaN;
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}

export function runFund(i: FundInput): FundResult {
  const Y = Math.max(i.life, i.deployYears + i.hold + 1);
  // Avgifterna beror på hur mycket som är investerat, och det investerbara beror på avgifterna → iterera
  let investable = i.size * 0.85;
  let fees: number[] = [], inv: number[] = [];
  for (let it = 0; it < 30; it++) {
    inv = new Array(Y + 1).fill(0);
    for (let t = 1; t <= i.deployYears; t++) inv[t] = investable / i.deployYears;
    fees = new Array(Y + 1).fill(0);
    let outstanding = 0;
    for (let t = 1; t <= Y; t++) {
      outstanding += inv[t];
      if (t - i.hold >= 1) outstanding -= inv[t - i.hold];
      fees[t] = t <= 5 ? i.feePct * i.size : t <= 10 ? i.feePct * Math.max(0, outstanding) : 0;
    }
    investable = Math.max(0, i.size - fees.reduce((a, b) => a + b, 0));
  }
  const gross = new Array(Y + 1).fill(0);
  for (let t = 1; t <= i.deployYears; t++) if (t + i.hold <= Y) gross[t + i.hold] += inv[t] * i.grossMoic;

  // Europeisk vattenfallsmodell, kumulativt år för år
  let contributed = 0, returned = 0, prefAccrued = 0, prefPaid = 0, catchUp = 0, gpCarry = 0, distLp = 0;
  let netCum = 0, trough = 0, breakeven: number | null = null;
  const years: FundYear[] = [];
  const lpFlows: number[] = [0], grossFlows: number[] = [0];
  for (let t = 1; t <= Y; t++) {
    // preferensavkastningen växer på kapital som inte återbetalats + obetald pref (från tidigare år)
    prefAccrued += (contributed - returned + prefAccrued - prefPaid) * i.hurdle;
    const calls = inv[t] + fees[t];
    contributed += calls;
    let d = gross[t], toLp = 0, toGp = 0;
    const r1 = Math.min(d, contributed - returned); returned += r1; toLp += r1; d -= r1;          // 1) kapital tillbaka
    const r2 = Math.min(d, prefAccrued - prefPaid); prefPaid += r2; toLp += r2; d -= r2;         // 2) pref
    const r3 = Math.min(d, Math.max(0, (i.carry / (1 - i.carry)) * prefPaid - catchUp));       // 3) catch-up
    catchUp += r3; toGp += r3; d -= r3;
    toLp += d * (1 - i.carry); toGp += d * i.carry;                                            // 4) 80/20
    gpCarry += toGp; distLp += toLp;
    netCum += toLp - calls;
    trough = Math.min(trough, netCum);
    if (breakeven == null && netCum >= 0 && contributed > 0 && t > 1) breakeven = t;
    lpFlows.push(toLp - calls); grossFlows.push(gross[t] - inv[t]);
    years.push({ year: t, calls, fees: fees[t], invested: inv[t], gross: gross[t], toLp, toGp, netCum, dpi: distLp / contributed });
  }
  return {
    years, contributed, distributedLp: distLp, carryGp: gpCarry, feesTotal: fees.reduce((a, b) => a + b, 0),
    tvpi: distLp / contributed, dpi: distLp / contributed, netIrr: irr(lpFlows), grossIrr: irr(grossFlows),
    trough, breakevenYear: breakeven,
  };
}
