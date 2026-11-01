/**
 * Accretion/dilution: hur påverkas köparens vinst per aktie (EPS) av ett förvärv?
 * Betalning: andel aktier (nyemission till köparens kurs), andel egen kassa (förlorad ränta) och andel ny skuld (räntekostnad).
 */
export interface Side { name: string; price: number; shares: number; netIncome: number; netDebt: number; ebitda: number }
export interface MergerInput {
  acq: Side; tgt: Side;
  premium: number; pctStock: number; pctCash: number; // resten finansieras med ny skuld
  kd: number; cashYield: number; tax: number; synergies: number; feePct: number;
}
export interface MergerResult {
  offerEquity: number; offerPerShare: number; newShares: number; newDebt: number; cashUsed: number; fees: number;
  epsBefore: number; epsAfter: number; accretion: number; tgtOwnership: number;
  proFormaNi: number; leverageBefore: number; leverageAfter: number; breakevenSynergies: number;
  peAcq: number; peOffer: number;
}

export function runMerger(i: MergerInput): MergerResult {
  const offerPerShare = i.tgt.price * (1 + i.premium);
  const offerEquity = offerPerShare * i.tgt.shares;
  const fees = i.feePct * offerEquity;
  const pctDebt = Math.max(0, 1 - i.pctStock - i.pctCash);
  const newShares = (i.pctStock * offerEquity) / i.acq.price;
  const cashUsed = i.pctCash * offerEquity + fees;
  const newDebt = pctDebt * offerEquity;
  const afterTax = 1 - i.tax;
  const costs = (newDebt * i.kd + cashUsed * i.cashYield) * afterTax;
  const proFormaNi = i.acq.netIncome + i.tgt.netIncome + i.synergies * afterTax - costs;
  const epsBefore = i.acq.netIncome / i.acq.shares;
  const epsAfter = proFormaNi / (i.acq.shares + newShares);
  // Synergier (före skatt) som behövs för att EPS ska vara oförändrad
  const breakevenSynergies = (epsBefore * (i.acq.shares + newShares) - (i.acq.netIncome + i.tgt.netIncome - costs)) / afterTax;
  return {
    offerEquity, offerPerShare, newShares, newDebt, cashUsed, fees, epsBefore, epsAfter, accretion: epsAfter / epsBefore - 1,
    tgtOwnership: newShares / (i.acq.shares + newShares), proFormaNi,
    leverageBefore: i.acq.netDebt / i.acq.ebitda,
    leverageAfter: (i.acq.netDebt + i.tgt.netDebt + newDebt + cashUsed) / (i.acq.ebitda + i.tgt.ebitda + i.synergies),
    breakevenSynergies: Math.max(0, breakevenSynergies),
    peAcq: i.acq.price / epsBefore, peOffer: offerEquity / i.tgt.netIncome,
  };
}
