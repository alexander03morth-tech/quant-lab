/**
 * "Så görs den" och "Öva själv" för modellerna. Övningarna slumpar fram siffror (make(r)) och räknar
 * facit med samma formler som förklaras i metodstegen, så att svaren alltid stämmer.
 */
import { n0, n1, n2, R, type Exercise, type Method } from "../components/Learn";

const pc = (v: number, d = 1) => (v * 100).toLocaleString("sv-SE", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";
const TAX = 0.206;

// ═════════════════════════════ LBO ═════════════════════════════
export const LBO_METHOD: Method = {
  intro: "En LBO (leveraged buyout) är ett företagsköp där köparen – oftast en PE-fond – betalar en stor del med lån. Lånet läggs på det köpta bolaget och betalas av med bolagets egna kassaflöden. Efter några år säljs bolaget, och det som är kvar efter att skulden lösts är fondens vinst.",
  why: "Modellen svarar på två frågor: **vilken avkastning får vi** (IRR och MOIC) vid ett visst pris, och **hur mycket har vi råd att betala** för att nå vårt avkastningsmål (ofta 20 % per år). Den visar också om bolaget klarar skulden.",
  steps: [
    { title: "Sätt priset (inträde)", concept: "enterprise-value", text: "Privata bolag prissätts som en multipel av EBITDA. Priset gäller hela verksamheten – det kallas enterprise value (EV) och är oberoende av hur bolaget är finansierat.", formula: String.raw`EV_{in} = \text{multipel}_{in} \times EBITDA_0`, example: "EBITDA 100 mkr × 9 = EV 900 mkr.", excel: "=B2*B3 – lägg alla antaganden i en egen kolumn med blå text." },
    { title: "Bestäm finansieringen", concept: "leverage-multiple", text: "Bankerna lånar ut en viss multipel av EBITDA (typiskt 4–6×). Resten, plus avgifter till banker och rådgivare, betalar fonden med eget kapital.", formula: String.raw`D_0 = k \times EBITDA_0,\quad E_{in} = EV_{in} + \text{avgifter} - D_0`, example: "Skuld 5 × 100 = 500 mkr. Avgifter 2 % av 900 = 18 mkr. Eget kapital = 900 + 18 − 500 = 418 mkr." },
    { title: "Prognostisera EBITDA", concept: "ebitda", text: "Anta tillväxt i omsättning och förändring i marginal år för år. Det är här fondens plan för bolaget syns: nya marknader, effektiviseringar, tilläggsförvärv.", formula: String.raw`EBITDA_t = \text{Oms}_t \times \text{marginal}_t`, example: "EBITDA växer 6 % per år: 100 → 106 → 112,4 → 119,1." },
    { title: "Räkna fritt kassaflöde", text: "Från EBITDA dras investeringar (capex), ränta, skatt och ökat rörelsekapital. Det som blir kvar är det som kan betala av skulden.", formula: String.raw`FCF_t = EBITDA_t - \text{capex}_t - r\cdot D_{t-1} - \text{skatt}_t - \Delta NWC_t`, example: "106 − 25 (capex) − 40 (ränta) − 8,4 (skatt) = 32,6 mkr.", excel: "Ränta på ingående skuld (D år t−1) undviker cirkelreferenser." },
    { title: "Amortera skulden (cash sweep)", concept: "cash-sweep", text: "Allt fritt kassaflöde går till att betala av lånet. Skulden krymper varje år och mer av bolagets värde tillhör ägarna.", formula: String.raw`D_t = D_{t-1} - FCF_t`, example: "500 − 32,6 = 467,4 mkr kvar efter år 1." },
    { title: "Sälj bolaget (exit)", text: "Vid exit antas en multipel – försiktigt samma som vid köpet. Fonden får EV minus kvarvarande skuld.", formula: String.raw`E_{ut} = \text{multipel}_{ut} \times EBITDA_N - D_N`, example: "9 × 133,8 = 1 204 mkr − skuld 330 = 874 mkr till fonden." },
    { title: "Mät avkastningen", concept: "irr", text: "MOIC är hur många gånger pengarna växte. IRR är den årliga avkastningen. Utan utdelningar under vägen är IRR enkel att räkna.", formula: String.raw`MOIC = \frac{E_{ut}}{E_{in}},\quad IRR = MOIC^{1/N} - 1`, example: "874 / 418 = 2,09×. IRR = 2,09^(1/5) − 1 = 15,9 %." },
    { title: "Dela upp vinsten (värdebrygga)", concept: "value-creation-bridge", text: "Varifrån kom vinsten? Från högre EBITDA, högre multipel vid försäljning eller avbetald skuld. Fonder vill visa att vinsten kommer från EBITDA – inte från tur med multipeln.", formula: String.raw`\Delta E = \underbrace{(EBITDA_N - EBITDA_0)m_{in}}_{\text{tillväxt}} + \underbrace{(m_{ut}-m_{in})EBITDA_N}_{\text{multipel}} + \underbrace{(D_0 - D_N)}_{\text{amortering}}`, example: "Tillväxt 304 + multipel 0 + amortering 170 = 474 mkr (≈ 874 − 418 + avgifter 18)." },
  ],
  mistakes: [
    { title: "Exitmultipel högre än inträdet", text: "Att anta att någon betalar mer om fem år är det vanligaste sättet att blåsa upp en kalkyl. Börja alltid med samma multipel." },
    { title: "Glömma avgifterna", text: "Transaktionskostnader på 2–3 % höjer insatsen och sänker IRR." },
    { title: "För mycket skuld", text: "Om räntan äter upp kassaflödet växer skulden i stället. Kolla räntetäckningen (EBITDA/ränta) – banker vill se minst 2–3×." },
    { title: "Ränta på utgående skuld", text: "Det skapar en cirkelreferens i Excel. Använd ingående skuld eller snittet med iterationer påslagna." },
  ],
  levels: "Börja med **servettmatte-LBO:n** (nivå 1) – den räknas i huvudet på intervjuer. Nivå 2 lägger till ett års kassaflöde, nivå 3 en hel tre-årsmodell med värdebrygga.",
};

export const LBO_EX: Exercise[] = [
  {
    level: 1, title: "Servettmatte-LBO", skills: "EV, skuld, eget kapital, MOIC och IRR",
    make: (r) => {
      const E0 = R.int(r, 60, 200, 10), m = R.pick(r, [7, 8, 9, 10]), d = R.pick(r, [3, 4, 5]), g = R.pick(r, [0.04, 0.06, 0.08, 0.1]), rep = R.pick(r, [0.4, 0.5, 0.6]);
      const EV = m * E0, D0 = d * E0, Ein = EV - D0, E5 = E0 * Math.pow(1 + g, 5), EVout = m * E5, Dl = D0 * (1 - rep), Eout = EVout - Dl, moic = Eout / Ein, irr = Math.pow(moic, 1 / 5) - 1;
      return {
        story: `En PE-fond köper ett bolag med EBITDA på **${E0} mkr** för **${m}× EBITDA**. Banken lånar ut **${d}× EBITDA**, resten betalar fonden. EBITDA växer **${pc(g, 0)} per år** i fem år, och under tiden hinner bolaget betala av **${pc(rep, 0)} av skulden**. Bolaget säljs till samma multipel. Inga avgifter.`,
        givens: [["EBITDA idag", `${E0} mkr`], ["Inträdesmultipel", `${m}×`], ["Skuld", `${d}× EBITDA`], ["EBITDA-tillväxt", `${pc(g, 0)}/år`], ["Amorterat på 5 år", pc(rep, 0)], ["Exitmultipel", `${m}×`]],
        steps: [
          { q: "Vad är köpeskillingen (EV vid inträde)?", unit: "mkr", answer: EV, hint: "Multipel × EBITDA.", solution: `$EV = ${m} \\times ${E0} = ${n0(EV)}$ mkr.` },
          { q: "Hur stor är skulden?", unit: "mkr", answer: D0, hint: "Skuldmultipel × EBITDA.", solution: `$D_0 = ${d} \\times ${E0} = ${n0(D0)}$ mkr.` },
          { q: "Hur mycket eget kapital sätter fonden in?", unit: "mkr", answer: Ein, hint: "Det som inte lånas: EV − skuld.", solution: `$${n0(EV)} - ${n0(D0)} = ${n0(Ein)}$ mkr.` },
          { q: "Vad är EBITDA om fem år?", unit: "mkr", answer: E5, hint: `EBITDA × (1 + tillväxt)^5.`, solution: `$${E0} \\times ${n2(1 + g)}^5 = ${n1(E5)}$ mkr.` },
          { q: "Vad är EV vid försäljningen?", unit: "mkr", answer: EVout, hint: "Samma multipel × nya EBITDA.", solution: `$${m} \\times ${n1(E5)} = ${n1(EVout)}$ mkr.` },
          { q: "Hur mycket skuld är kvar?", unit: "mkr", answer: Dl, hint: `Skulden × (1 − andel amorterad).`, solution: `$${n0(D0)} \\times (1 - ${n1(rep)}) = ${n1(Dl)}$ mkr.` },
          { q: "Hur mycket får fonden vid försäljningen?", unit: "mkr", answer: Eout, hint: "EV ut − kvarvarande skuld.", solution: `$${n1(EVout)} - ${n1(Dl)} = ${n1(Eout)}$ mkr.` },
          { q: "Vad blir MOIC (pengarna gånger)?", unit: "×", answer: moic, tol: Math.max(0.02, moic * 0.01), hint: "Ut / in.", solution: `$${n1(Eout)} / ${n0(Ein)} = ${n2(moic)}\\times$.` },
          { q: "Vad blir IRR (årlig avkastning)?", unit: "%", answer: irr * 100, tol: 0.3, hint: "MOIC^(1/5) − 1. Tumregel: 2× på 5 år ≈ 15 %, 2,5× ≈ 20 %, 3× ≈ 25 %.", solution: `$${n2(moic)}^{1/5} - 1 = ${pc(irr)}$.` },
        ],
        takeaway: `Fonden fick ${n2(moic)}× pengarna (${pc(irr)} per år). Notera att EBITDA bara växte ${pc(Math.pow(1 + g, 5) - 1, 0)} totalt – resten av avkastningen kommer från att skulden betalades av och att fonden bara satte in en del av priset själv. Det är **hävstångseffekten**.`,
      };
    },
  },
  {
    level: 1, title: "Tumregler för IRR", skills: "koppla MOIC, år och IRR",
    make: (r) => {
      const m1 = R.pick(r, [2, 2.5, 3]), y1 = R.pick(r, [3, 4, 5, 6]), irr1 = Math.pow(m1, 1 / y1) - 1;
      const t = R.pick(r, [0.15, 0.2, 0.25]), y2 = R.pick(r, [4, 5, 6]), m2 = Math.pow(1 + t, y2);
      const ein = R.int(r, 200, 800, 50), irr3 = R.pick(r, [0.18, 0.22]), y3 = 5, need = ein * Math.pow(1 + irr3, y3);
      return {
        story: "PE-folk räknar i huvudet med kopplingen mellan **MOIC** (pengarna gånger), **antal år** och **IRR** (årlig avkastning). Här tränar du åt båda hållen.",
        givens: [["Formel", "IRR = MOIC^(1/år) − 1"], ["Omvänt", "MOIC = (1 + IRR)^år"]],
        steps: [
          { q: `En investering ger ${n1(m1)}× på ${y1} år. Vilken IRR?`, unit: "%", answer: irr1 * 100, tol: 0.3, hint: "MOIC^(1/år) − 1.", solution: `$${n1(m1)}^{1/${y1}} - 1 = ${pc(irr1)}$.` },
          { q: `Fonden kräver ${pc(t, 0)} IRR och äger bolaget i ${y2} år. Vilken MOIC behövs?`, unit: "×", answer: m2, tol: 0.02, hint: "(1 + IRR)^år.", solution: `$${n2(1 + t)}^{${y2}} = ${n2(m2)}\\times$.` },
          { q: `Fonden sätter in ${ein} mkr och vill ha ${pc(irr3, 0)} per år i ${y3} år. Hur mycket måste den få tillbaka?`, unit: "mkr", answer: need, hint: "Insats × (1 + IRR)^år.", solution: `$${ein} \\times ${n2(1 + irr3)}^5 = ${n0(need)}$ mkr.` },
        ],
        takeaway: "Samma MOIC ger mycket lägre IRR om det tar längre tid. Därför vill fonder sälja så fort värdet är skapat – **tid kostar**.",
      };
    },
  },
  {
    level: 2, title: "Första året i LBO:n", skills: "avgifter, ränta, skatt, fritt kassaflöde, nyckeltal för banken",
    make: (r) => {
      const E0 = R.int(r, 80, 250, 10), m = R.pick(r, [8, 9, 10, 11]), d = R.pick(r, [4, 4.5, 5]), fee = 0.02, rate = R.pick(r, [0.06, 0.07, 0.08, 0.09]), g = R.pick(r, [0.03, 0.05, 0.07]), k = R.pick(r, [0.15, 0.2, 0.25]);
      const EV = m * E0, F = fee * EV, D0 = d * E0, Ein = EV + F - D0, E1 = E0 * (1 + g), capex = k * E1, int = rate * D0, ebit = E1 - capex, tax = Math.max(0, ebit - int) * TAX, fcf = E1 - capex - int - tax, D1 = D0 - fcf;
      return {
        story: `Fonden köper ett bolag med EBITDA **${E0} mkr** för **${m}×**. Skulden är **${n1(d)}× EBITDA** till **${pc(rate, 0)} ränta**. Avgifter till banker och rådgivare är **2 % av EV**. Nästa år växer EBITDA **${pc(g, 0)}**. Investeringarna (capex) är **${pc(k, 0)} av EBITDA** och lika stora som avskrivningarna. Skatt **20,6 %**.`,
        givens: [["EBITDA idag", `${E0} mkr`], ["Multipel", `${m}×`], ["Skuld", `${n1(d)}× EBITDA`], ["Ränta", pc(rate, 0)], ["Avgifter", "2 % av EV"], ["Tillväxt år 1", pc(g, 0)], ["Capex = avskrivningar", `${pc(k, 0)} av EBITDA`], ["Skatt", "20,6 %"]],
        steps: [
          { q: "Vad är EV vid köpet?", unit: "mkr", answer: EV, hint: "Multipel × EBITDA.", solution: `$${m} \\times ${E0} = ${n0(EV)}$ mkr.` },
          { q: "Hur stora är avgifterna?", unit: "mkr", answer: F, hint: "2 % av EV.", solution: `$0{,}02 \\times ${n0(EV)} = ${n1(F)}$ mkr.` },
          { q: "Hur mycket eget kapital sätter fonden in (inkl. avgifter)?", unit: "mkr", answer: Ein, hint: "EV + avgifter − skuld.", solution: `$${n0(EV)} + ${n1(F)} - ${n0(D0)} = ${n1(Ein)}$ mkr.` },
          { q: "Vad är EBITDA år 1?", unit: "mkr", answer: E1, hint: "EBITDA × (1 + tillväxt).", solution: `$${E0} \\times ${n2(1 + g)} = ${n1(E1)}$ mkr.` },
          { q: "Hur mycket ränta betalas år 1?", unit: "mkr", answer: int, hint: "Räntesats × skulden vid årets början.", solution: `$${pc(rate, 0)} \\times ${n0(D0)} = ${n1(int)}$ mkr.` },
          { q: "Hur mycket skatt betalas år 1?", unit: "mkr", answer: tax, hint: "Skatt på (EBITDA − avskrivningar − ränta). Räntan är avdragsgill!", solution: `Skattepliktigt: $${n1(E1)} - ${n1(capex)} - ${n1(int)} = ${n1(ebit - int)}$. Skatt: $20{,}6\\,\\% \\times ${n1(ebit - int)} = ${n1(tax)}$ mkr.` },
          { q: "Vad är det fria kassaflödet år 1?", unit: "mkr", answer: fcf, hint: "EBITDA − capex − ränta − skatt.", solution: `$${n1(E1)} - ${n1(capex)} - ${n1(int)} - ${n1(tax)} = ${n1(fcf)}$ mkr.` },
          { q: "Hur stor är skulden efter år 1 (allt kassaflöde amorterar)?", unit: "mkr", answer: D1, hint: "Skuld − fritt kassaflöde.", solution: `$${n0(D0)} - ${n1(fcf)} = ${n1(D1)}$ mkr.` },
          { q: "Vad är skuldsättningen efter år 1 (skuld / EBITDA)?", unit: "×", answer: D1 / E1, tol: 0.03, hint: "Skuld efter år 1 / EBITDA år 1.", solution: `$${n1(D1)} / ${n1(E1)} = ${n2(D1 / E1)}\\times$ (från ${n1(d)}× vid köpet).` },
          { q: "Vad är räntetäckningen (EBITDA / ränta)?", unit: "×", answer: E1 / int, tol: 0.03, hint: "Hur många gånger EBITDA täcker räntan.", solution: `$${n1(E1)} / ${n1(int)} = ${n2(E1 / int)}\\times$. ${E1 / int < 2 ? "Under 2× – banken skulle bli nervös." : "Över 2× brukar banker acceptera."}` },
        ],
        takeaway: `Av ${n1(E1)} mkr i EBITDA blev ${n1(fcf)} mkr kvar att betala skuld med – räntan tog ${pc(int / E1, 0)}. Därför är **räntenivån** så viktig för LBO:er: högre ränta = långsammare amortering = lägre avkastning.`,
      };
    },
  },
  {
    level: 3, title: "Tre år, exit och värdebrygga", skills: "hel modell med cash sweep, exit, IRR och värdebrygga",
    make: (r) => {
      const E0 = R.int(r, 100, 300, 20), m = R.pick(r, [8, 9, 10]), mo = m + R.pick(r, [-1, 0, 1]), d = R.pick(r, [4, 5]), rate = R.pick(r, [0.06, 0.07, 0.08]), g = R.pick(r, [0.06, 0.08, 0.1]), k = R.pick(r, [0.2, 0.25]);
      const D0 = d * E0, Ein = m * E0 - D0;
      let D = D0; const E: number[] = [E0], F: number[] = [], Ds: number[] = [D0];
      for (let t = 1; t <= 3; t++) { const e = E0 * Math.pow(1 + g, t); const int = rate * D; const tax = Math.max(0, e * (1 - k) - int) * TAX; const f = e * (1 - k) - int - tax; D -= f; E.push(e); F.push(f); Ds.push(D); }
      const EVo = mo * E[3], Eo = EVo - D, moic = Eo / Ein, irr = Math.pow(moic, 1 / 3) - 1;
      const bG = (E[3] - E0) * m, bM = (mo - m) * E[3], bD = D0 - D;
      const fcfSol = (t: number) => `EBITDA ${n1(E[t])}; ränta $${pc(rate, 0)} \\times ${n1(Ds[t - 1])} = ${n1(rate * Ds[t - 1])}$; skatt $20{,}6\\,\\% \\times (${n1(E[t])}\\cdot${n2(1 - k)} - ${n1(rate * Ds[t - 1])})$; FCF $= ${n1(F[t - 1])}$ mkr.`;
      return {
        story: `Fonden köper för **${m}× EBITDA** (EBITDA **${E0} mkr**) med skuld **${d}× EBITDA** till **${pc(rate, 0)}**. EBITDA växer **${pc(g, 0)}/år**. Capex = avskrivningar = **${pc(k, 0)} av EBITDA**. Skatt 20,6 %. Allt kassaflöde amorterar skulden (ränta på ingående skuld). Efter **3 år** säljs bolaget för **${mo}× EBITDA**. Inga avgifter.`,
        givens: [["EBITDA idag", `${E0} mkr`], ["Inträde / exit", `${m}× / ${mo}×`], ["Skuld", `${d}× = ${n0(D0)} mkr`], ["Ränta", pc(rate, 0)], ["Tillväxt", `${pc(g, 0)}/år`], ["Capex = avskr.", `${pc(k, 0)} av EBITDA`], ["Skatt", "20,6 %"], ["Innehav", "3 år"]],
        steps: [
          { q: "Fritt kassaflöde år 1?", unit: "mkr", answer: F[0], hint: "EBITDA·(1 − capexandel) − ränta − skatt, där skatt = 20,6 % × (EBITDA − avskrivningar − ränta).", solution: fcfSol(1) },
          { q: "Skuld efter år 1?", unit: "mkr", answer: Ds[1], hint: "Ingående skuld − FCF.", solution: `$${n0(D0)} - ${n1(F[0])} = ${n1(Ds[1])}$` },
          { q: "Fritt kassaflöde år 2?", unit: "mkr", answer: F[1], hint: "Samma sak, men räntan räknas på den lägre skulden.", solution: fcfSol(2) },
          { q: "Skuld efter år 2?", unit: "mkr", answer: Ds[2], hint: "Skuld år 1 − FCF år 2.", solution: `$${n1(Ds[1])} - ${n1(F[1])} = ${n1(Ds[2])}$` },
          { q: "Fritt kassaflöde år 3?", unit: "mkr", answer: F[2], hint: "Ränta på skulden efter år 2.", solution: fcfSol(3) },
          { q: "Skuld efter år 3?", unit: "mkr", answer: Ds[3], hint: "Skuld år 2 − FCF år 3.", solution: `$${n1(Ds[2])} - ${n1(F[2])} = ${n1(Ds[3])}$` },
          { q: "EV vid exit?", unit: "mkr", answer: EVo, hint: "Exitmultipel × EBITDA år 3.", solution: `$${mo} \\times ${n1(E[3])} = ${n1(EVo)}$` },
          { q: "Eget kapital till fonden vid exit?", unit: "mkr", answer: Eo, hint: "EV − skuld.", solution: `$${n1(EVo)} - ${n1(Ds[3])} = ${n1(Eo)}$` },
          { q: "MOIC?", unit: "×", answer: moic, tol: Math.max(0.02, moic * 0.01), hint: `Ut / in. In = ${m} × ${E0} − ${n0(D0)}.`, solution: `In $= ${n0(Ein)}$. $${n1(Eo)} / ${n0(Ein)} = ${n2(moic)}\\times$` },
          { q: "IRR?", unit: "%", answer: irr * 100, tol: 0.4, hint: "MOIC^(1/3) − 1.", solution: `$${n2(moic)}^{1/3} - 1 = ${pc(irr)}$` },
          { q: "Värdebrygga: hur mycket kom från EBITDA-tillväxt?", unit: "mkr", answer: bG, hint: "(EBITDA år 3 − EBITDA idag) × inträdesmultipel.", solution: `$(${n1(E[3])} - ${E0}) \\times ${m} = ${n1(bG)}$` },
          { q: "… från förändrad multipel?", unit: "mkr", answer: bM, tol: Math.max(0.5, Math.abs(bM) * 0.01), hint: "(exit − inträde) × EBITDA år 3. Kan vara 0 eller negativ.", solution: `$(${mo} - ${m}) \\times ${n1(E[3])} = ${n1(bM)}$` },
          { q: "… från amortering av skuld?", unit: "mkr", answer: bD, hint: "Skuld vid köp − skuld vid exit.", solution: `$${n0(D0)} - ${n1(Ds[3])} = ${n1(bD)}$. Summa: $${n1(bG)} + ${n1(bM)} + ${n1(bD)} = ${n1(bG + bM + bD)}$ = vinsten $${n1(Eo)} - ${n0(Ein)}$ ✓` },
        ],
        takeaway: `Vinsten på ${n1(Eo - Ein)} mkr kom till ${pc(bG / (Eo - Ein), 0)} från tillväxt, ${pc(bM / (Eo - Ein), 0)} från multipeln och ${pc(bD / (Eo - Ein), 0)} från amortering. ${mo > m ? "Utan den högre exitmultipeln hade IRR varit klart lägre – en köpare av den här kalkylen skulle fråga varför multipeln ska stiga." : mo < m ? "Trots lägre exitmultipel gick det plus tack vare tillväxt och amortering." : "Med oförändrad multipel är vinsten \"ärlig\": den kommer från drift och amortering."}`,
      };
    },
  },
];

// ═════════════════════════════ M&A ═════════════════════════════
export const MA_METHOD: Method = {
  intro: "En M&A-kalkyl (accretion/dilution) visar hur ett förvärv påverkar köparens **vinst per aktie** (EPS). Banken bygger den i varje uppköp för att styrelsen ska förstå vad affären gör med aktieägarnas andel av vinsten.",
  why: "Börsen och styrelsen vill veta: blir vinsten per aktie högre (**accretive**) eller lägre (**dilutive**) efter affären? Och hur mycket synergier krävs för att den ska gå jämnt upp? Det påverkar pris, betalningssätt och om affären blir av.",
  steps: [
    { title: "Räkna köparens EPS och P/E", concept: "eps", text: "Utgångsläget: hur mycket vinst varje aktie har idag och hur dyr köparens aktie är.", formula: String.raw`EPS_A = \frac{NI_A}{n_A},\quad P/E_A = \frac{P_A}{EPS_A}`, example: "Vinst 5 000 mkr, 500 miljoner aktier → EPS 10 kr. Kurs 200 kr → P/E 20." },
    { title: "Sätt budet", concept: "bid-premium", text: "Köparen måste betala en premie över dagens kurs för att få kontroll – typiskt 25–40 %.", formula: String.raw`\text{Bud per aktie} = P_B(1+\text{premie}),\quad \text{Budvärde} = \text{bud} \times n_B`, example: "Kurs 80 kr + 30 % = 104 kr × 100 miljoner aktier = 10 400 mkr." },
    { title: "Välj betalning", concept: "stock-vs-cash", text: "Betala med nya aktier, egen kassa eller nya lån – eller en blandning. Det avgör vad affären kostar i vinst per aktie.", formula: String.raw`n_{nya} = \frac{\text{andel aktier} \times \text{budvärde}}{P_A}`, example: "Hälften i aktier: 5 200 mkr / 200 kr = 26 miljoner nya aktier." },
    { title: "Räkna finansieringskostnaden", text: "Lån kostar ränta och kassa ger förlorad ränteintäkt – båda efter skatt eftersom räntan är avdragsgill.", formula: String.raw`\text{Kostnad} = (D_{ny} \cdot k_d + \text{kassa} \cdot r_{kassa})(1-t)`, example: "Lån 5 200 mkr × 6 % × (1 − 0,206) = 248 mkr per år." },
    { title: "Lägg till synergier", concept: "synergies", text: "Besparingar och merförsäljning som uppstår av sammanslagningen, efter skatt.", formula: String.raw`\text{Synergier efter skatt} = S(1-t)`, example: "400 mkr i besparingar × 0,794 = 318 mkr." },
    { title: "Pro forma EPS och accretion", concept: "accretion-dilution", text: "Lägg ihop vinsterna, dra kostnaden, lägg till synergier och dela på det nya antalet aktier.", formula: String.raw`EPS_{pf} = \frac{NI_A + NI_B + S(1-t) - \text{kostnad}}{n_A + n_{nya}},\quad \text{accretion} = \frac{EPS_{pf}}{EPS_A} - 1` },
    { title: "Break-even-synergier", text: "Hur stora synergier behövs för att EPS ska bli oförändrad? Ett vanligt mått på hur \"dyr\" affären är.", formula: String.raw`S^* = \frac{EPS_A(n_A+n_{nya}) - (NI_A + NI_B - \text{kostnad})}{1-t}` },
  ],
  mistakes: [
    { title: "Accretive = bra", text: "Billig skuld kan göra nästan vilken affär som helst accretive. Det säger inget om priset var rätt." },
    { title: "Glömma skatt", text: "Både ränta och synergier ska räknas efter skatt." },
    { title: "Överskatta synergier", text: "Intäktssynergier uteblir ofta. Kostnadssynergier är säkrare men tar 2–3 år och kostar att genomföra." },
    { title: "Fel aktiekurs för nyemission", text: "Nya aktier räknas till köparens kurs, inte målets." },
  ],
  levels: "Nivå 1 tränar EPS, P/E och budvärde. Nivå 2 är en helt aktiebetald affär, där tumregeln om P/E gäller. Nivå 3 blandar lån och aktier med synergier och break-even.",
};

function maBase(r: () => number) {
  const NIA = R.int(r, 2000, 8000, 250), nA = R.int(r, 200, 800, 50), peA = R.int(r, 15, 24), EPSA = NIA / nA, PA = Math.round(peA * EPSA);
  const NIB = R.int(r, 400, 1600, 100), nB = R.int(r, 50, 250, 10), peB = R.int(r, 10, 17), EPSB = NIB / nB, PB = Math.round(peB * EPSB);
  const prem = R.pick(r, [0.25, 0.3, 0.35, 0.4]);
  const bid = PB * (1 + prem), val = bid * nB;
  return { NIA, nA, EPSA, PA, NIB, nB, EPSB, PB, prem, bid, val };
}
const maGivens = (b: ReturnType<typeof maBase>): [string, string][] => [
  ["Köparens nettovinst", `${n0(b.NIA)} mkr`], ["Köparens antal aktier", `${b.nA} milj.`], ["Köparens kurs", `${b.PA} kr`],
  ["Målets nettovinst", `${n0(b.NIB)} mkr`], ["Målets antal aktier", `${b.nB} milj.`], ["Målets kurs", `${b.PB} kr`], ["Budpremie", pc(b.prem, 0)],
];

export const MA_EX: Exercise[] = [
  {
    level: 1, title: "EPS, P/E och budvärde", skills: "vinst per aktie, P/E, budpremie",
    make: (r) => {
      const b = maBase(r);
      return {
        story: "Ett börsbolag (köparen) funderar på att lägga bud på ett mindre bolag (målet). Börja med grunderna: hur mycket vinst per aktie har de, hur dyra är de, och vad kostar budet?",
        givens: maGivens(b),
        steps: [
          { q: "Köparens vinst per aktie (EPS)?", unit: "kr", answer: b.EPSA, tol: 0.02 + b.EPSA * 0.005, hint: "Nettovinst / antal aktier (mkr / miljoner = kr).", solution: `$${n0(b.NIA)} / ${b.nA} = ${n2(b.EPSA)}$ kr.` },
          { q: "Köparens P/E-tal?", unit: "×", answer: b.PA / b.EPSA, tol: 0.15, hint: "Kurs / EPS.", solution: `$${b.PA} / ${n2(b.EPSA)} = ${n1(b.PA / b.EPSA)}$.` },
          { q: "Målets EPS?", unit: "kr", answer: b.EPSB, tol: 0.02 + b.EPSB * 0.005, hint: "Nettovinst / antal aktier.", solution: `$${n0(b.NIB)} / ${b.nB} = ${n2(b.EPSB)}$ kr.` },
          { q: "Bud per aktie?", unit: "kr", answer: b.bid, tol: 0.1, hint: "Kurs × (1 + premie).", solution: `$${b.PB} \\times ${n2(1 + b.prem)} = ${n2(b.bid)}$ kr.` },
          { q: "Budvärde totalt?", unit: "mkr", answer: b.val, hint: "Bud per aktie × antal aktier.", solution: `$${n2(b.bid)} \\times ${b.nB} = ${n0(b.val)}$ mkr.` },
          { q: "Vilket P/E betalar köparen (budvärde / målets vinst)?", unit: "×", answer: b.val / b.NIB, tol: 0.15, hint: "Budvärde / målets nettovinst.", solution: `$${n0(b.val)} / ${n0(b.NIB)} = ${n1(b.val / b.NIB)}$.` },
        ],
        takeaway: `Köparen värderas till P/E ${n1(b.PA / b.EPSA)} och betalar P/E ${n1(b.val / b.NIB)} för målet. ${b.val / b.NIB < b.PA / b.EPSA ? "Eftersom köparen betalar ett lägre P/E än sitt eget kommer en aktiebetalning att höja vinsten per aktie (accretive)." : "Eftersom köparen betalar ett högre P/E än sitt eget kommer en aktiebetalning att sänka vinsten per aktie (dilutive)."}`,
      };
    },
  },
  {
    level: 2, title: "Helt aktiebetald affär", skills: "nyemission, pro forma EPS, accretion",
    make: (r) => {
      const b = maBase(r);
      const nNew = b.val / b.PA, NIpf = b.NIA + b.NIB, nPf = b.nA + nNew, EPSpf = NIpf / nPf, acc = EPSpf / b.EPSA - 1;
      return {
        story: "Köparen betalar **hela budet med nya aktier** till sina egna aktiekurs. Inga synergier, inga avgifter. Blir vinsten per aktie högre eller lägre?",
        givens: maGivens(b),
        steps: [
          { q: "Budvärde totalt?", unit: "mkr", answer: b.val, hint: "Målets kurs × (1 + premie) × antal aktier.", solution: `$${b.PB} \\times ${n2(1 + b.prem)} \\times ${b.nB} = ${n0(b.val)}$ mkr.` },
          { q: "Hur många nya aktier måste köparen ge ut?", unit: "milj.", answer: nNew, hint: "Budvärde / köparens kurs.", solution: `$${n0(b.val)} / ${b.PA} = ${n1(nNew)}$ miljoner.` },
          { q: "Sammanlagd nettovinst efter affären?", unit: "mkr", answer: NIpf, hint: "Båda vinsterna ihop.", solution: `$${n0(b.NIA)} + ${n0(b.NIB)} = ${n0(NIpf)}$ mkr.` },
          { q: "Antal aktier efter affären?", unit: "milj.", answer: nPf, hint: "Gamla + nya.", solution: `$${b.nA} + ${n1(nNew)} = ${n1(nPf)}$ miljoner.` },
          { q: "Ny vinst per aktie?", unit: "kr", answer: EPSpf, tol: 0.02 + EPSpf * 0.005, hint: "Ny vinst / nytt antal aktier.", solution: `$${n0(NIpf)} / ${n1(nPf)} = ${n2(EPSpf)}$ kr.` },
          { q: "Accretion/dilution i procent?", unit: "%", answer: acc * 100, tol: 0.2, hint: "Ny EPS / gammal EPS − 1. Negativt = dilutive.", solution: `$${n2(EPSpf)} / ${n2(b.EPSA)} - 1 = ${pc(acc)}$ → **${acc >= 0 ? "accretive" : "dilutive"}**.` },
          { q: "Hur stor andel av det nya bolaget ägs av målets gamla aktieägare?", unit: "%", answer: (nNew / nPf) * 100, tol: 0.3, hint: "Nya aktier / alla aktier.", solution: `$${n1(nNew)} / ${n1(nPf)} = ${pc(nNew / nPf)}$.` },
        ],
        takeaway: `Tumregeln stämmer: köparens P/E ${n1(b.PA / b.EPSA)} mot betalt P/E ${n1(b.val / b.NIB)} → ${acc >= 0 ? "accretive" : "dilutive"} (${pc(acc)}). I en aktieaffär blir säljarna delägare – de får ${pc(nNew / nPf, 0)} av det nya bolaget och delar på både risk och uppsida.`,
      };
    },
  },
  {
    level: 3, title: "Lån, aktier och synergier", skills: "räntekostnad efter skatt, synergier, break-even",
    make: (r) => {
      const b = maBase(r);
      const kd = R.pick(r, [0.05, 0.06, 0.07]), S = R.int(r, 100, 600, 50);
      const debt = 0.5 * b.val, nNew = (0.5 * b.val) / b.PA, intAT = debt * kd * (1 - TAX), synAT = S * (1 - TAX);
      const NIpf = b.NIA + b.NIB + synAT - intAT, nPf = b.nA + nNew, EPSpf = NIpf / nPf, acc = EPSpf / b.EPSA - 1;
      const be = Math.max(0, (b.EPSA * nPf - (b.NIA + b.NIB - intAT)) / (1 - TAX));
      return {
        story: `Köparen betalar **hälften med nya aktier och hälften med nya lån** till **${pc(kd, 0)} ränta**. Ledningen räknar med kostnadssynergier på **${S} mkr per år** före skatt. Skatt 20,6 %.`,
        givens: [...maGivens(b), ["Andel aktier / lån", "50 % / 50 %"], ["Låneränta", pc(kd, 0)], ["Synergier (före skatt)", `${S} mkr`], ["Skatt", "20,6 %"]],
        steps: [
          { q: "Budvärde totalt?", unit: "mkr", answer: b.val, hint: "Kurs × (1 + premie) × antal aktier.", solution: `$${n0(b.val)}$ mkr.` },
          { q: "Hur mycket nytt lån tas upp?", unit: "mkr", answer: debt, hint: "50 % av budvärdet.", solution: `$0{,}5 \\times ${n0(b.val)} = ${n0(debt)}$ mkr.` },
          { q: "Räntekostnad per år efter skatt?", unit: "mkr", answer: intAT, hint: "Lån × ränta × (1 − skatt).", solution: `$${n0(debt)} \\times ${n2(kd)} \\times 0{,}794 = ${n1(intAT)}$ mkr.` },
          { q: "Antal nya aktier?", unit: "milj.", answer: nNew, hint: "50 % av budvärdet / köparens kurs.", solution: `$${n0(0.5 * b.val)} / ${b.PA} = ${n1(nNew)}$ miljoner.` },
          { q: "Synergier efter skatt?", unit: "mkr", answer: synAT, hint: "Synergier × (1 − skatt).", solution: `$${S} \\times 0{,}794 = ${n1(synAT)}$ mkr.` },
          { q: "Pro forma nettovinst?", unit: "mkr", answer: NIpf, hint: "Vinst A + vinst B + synergier efter skatt − ränta efter skatt.", solution: `$${n0(b.NIA)} + ${n0(b.NIB)} + ${n1(synAT)} - ${n1(intAT)} = ${n1(NIpf)}$ mkr.` },
          { q: "Pro forma EPS?", unit: "kr", answer: EPSpf, tol: 0.02 + EPSpf * 0.005, hint: "Pro forma vinst / (gamla + nya aktier).", solution: `$${n1(NIpf)} / ${n1(nPf)} = ${n2(EPSpf)}$ kr.` },
          { q: "Accretion/dilution?", unit: "%", answer: acc * 100, tol: 0.2, hint: "Ny EPS / gammal EPS − 1.", solution: `$${n2(EPSpf)} / ${n2(b.EPSA)} - 1 = ${pc(acc)}$.` },
          { q: "Break-even-synergier (före skatt) – hur mycket behövs för oförändrad EPS?", unit: "mkr", answer: be, tol: Math.max(2, be * 0.015), hint: "Vinsten som behövs = gammal EPS × nytt antal aktier. Skillnaden mot vinsten utan synergier, delat med (1 − skatt). Kan vara 0.", solution: `Behövd vinst $= ${n2(b.EPSA)} \\times ${n1(nPf)} = ${n1(b.EPSA * nPf)}$. Utan synergier $= ${n1(b.NIA + b.NIB - intAT)}$. $S^* = ${n1(Math.max(0, b.EPSA * nPf - (b.NIA + b.NIB - intAT)))} / 0{,}794 = ${n1(be)}$ mkr.` },
        ],
        takeaway: `Med ${S} mkr i synergier blir affären ${acc >= 0 ? "accretive" : "dilutive"} (${pc(acc)}). ${be > S ? `Men den kräver ${n0(be)} mkr i synergier för att gå jämnt upp – mer än planen. Styrelsen skulle ifrågasätta priset.` : `Den går jämnt upp redan vid ${n0(be)} mkr i synergier, så den har marginal om synergierna blir mindre än planerat.`}`,
      };
    },
  },
];

// ═════════════════════════════ DCF ═════════════════════════════
export const DCF_METHOD: Method = {
  intro: "En DCF (discounted cash flow) värderar ett bolag som summan av alla framtida kassaflöden, omräknade till vad de är värda idag. En krona om fem år är värd mindre än en krona idag – det är därför man diskonterar.",
  why: "DCF är den mest grundläggande värderingsmetoden: den tvingar fram explicita antaganden om tillväxt, lönsamhet och risk. Den används av aktieanalytiker, banker och PE-fonder – ofta tillsammans med multiplar som kontroll.",
  steps: [
    { title: "Prognostisera fritt kassaflöde", concept: "fcf-yield", text: "Fritt kassaflöde till företaget (FCFF) = rörelseresultat efter skatt + avskrivningar − investeringar − ökat rörelsekapital. Prognosen görs för 5–10 år.", formula: String.raw`FCF_t = EBIT_t(1-t) + D\&A_t - \text{capex}_t - \Delta NWC_t`, example: "FCF idag 1 000 mkr, växer 8 %: 1 080 → 1 166 → 1 260." },
    { title: "Räkna avkastningskravet på eget kapital (CAPM)", concept: "capm", text: "Ägarna kräver riskfri ränta plus en riskpremie som beror på hur mycket aktien svänger med marknaden (beta).", formula: String.raw`k_E = r_f + \beta \cdot ERP`, example: "2,5 % + 1,1 × 5,5 % = 8,55 %." },
    { title: "Räkna WACC", concept: "wacc", text: "Viktat snitt av ägarnas och långivarnas krav, där lånekostnaden räknas efter skatt.", formula: String.raw`WACC = \frac{E}{D+E}k_E + \frac{D}{D+E}k_D(1-t)`, example: "80 % × 8,55 % + 20 % × 5 % × 0,794 = 7,63 %." },
    { title: "Diskontera kassaflödena", text: "Varje års kassaflöde delas med (1 + WACC) upphöjt till antal år.", formula: String.raw`PV_t = \frac{FCF_t}{(1+WACC)^t}`, example: "År 3: 1 260 / 1,0763³ = 1 011 mkr." },
    { title: "Räkna restvärdet", concept: "terminal-value", text: "Bolaget lever efter prognosåren. Restvärdet antar evig tillväxt i takt med ekonomin (2–3 %). Det står ofta för 60–80 % av värdet!", formula: String.raw`TV_N = \frac{FCF_N(1+g)}{WACC-g},\quad PV(TV) = \frac{TV_N}{(1+WACC)^N}`, example: "1 260 × 1,02 / (0,0763 − 0,02) = 22 828 mkr; nuvärde 18 310 mkr." },
    { title: "Från EV till värde per aktie", concept: "enterprise-value", text: "Summan av nuvärdena är företagsvärdet (EV). Dra nettoskulden för att få aktieägarnas värde, dela med antal aktier.", formula: String.raw`\text{Värde/aktie} = \frac{\sum PV_t + PV(TV) - \text{nettoskuld}}{\text{antal aktier}}` },
    { title: "Testa känsligheten", text: "Ändra WACC och evig tillväxt ±0,5–1 procentenhet. Om värdet ändras ±30 % är det normalt – och en påminnelse om att DCF är ett intervall, inte ett exakt svar.", excel: "Använd en datatabell (Data → Konsekvensanalys) med WACC på ena axeln och g på den andra." },
  ],
  mistakes: [
    { title: "g för nära WACC", text: "Om evig tillväxt närmar sig WACC exploderar restvärdet. g ska vara under långsiktig BNP-tillväxt." },
    { title: "Blanda kassaflöden och räntor", text: "FCFF (till hela företaget) diskonteras med WACC; FCFE (till ägarna) med kE. Blanda inte." },
    { title: "Glömma nettoskulden", text: "EV är värdet på hela bolaget. Ägarna får bara det som blir kvar efter att skulden betalats." },
    { title: "Hockeyklubba", text: "Prognoser som är platta i två år och sedan skjuter i höjden. Fråga alltid vad som ska driva förbättringen." },
  ],
  levels: "Nivå 1 tränar nuvärde (kärnan i allt). Nivå 2 bygger WACC från CAPM. Nivå 3 är en hel DCF med restvärde och värde per aktie.",
};

export const DCF_EX: Exercise[] = [
  {
    level: 1, title: "Pengar idag mot senare", skills: "nuvärde och diskontering",
    make: (r) => {
      const rr = R.pick(r, [0.06, 0.08, 0.1]), CF = R.int(r, 100, 1000, 50), N = R.int(r, 2, 6);
      const c1 = R.int(r, 50, 200, 10), c2 = R.int(r, 50, 200, 10), c3 = R.int(r, 50, 200, 10);
      const pv = CF / Math.pow(1 + rr, N), sum = c1 / (1 + rr) + c2 / Math.pow(1 + rr, 2) + c3 / Math.pow(1 + rr, 3), d10 = 1 / Math.pow(1 + rr, 10);
      return {
        story: `Avkastningskravet är **${pc(rr, 0)} per år**. Det betyder att 100 kr idag ska kunna bli ${n0(100 * (1 + rr))} kr om ett år – och därför är 100 kr om ett år värda mindre än 100 kr idag.`,
        givens: [["Avkastningskrav", pc(rr, 0)], ["Kassaflöde i uppgift 1", `${CF} kr om ${N} år`], ["Kassaflöden i uppgift 2", `${c1} / ${c2} / ${c3} kr år 1/2/3`]],
        steps: [
          { q: `Vad är ${CF} kr om ${N} år värda idag?`, unit: "kr", answer: pv, hint: "Belopp / (1 + r)^år.", solution: `$${CF} / ${n2(1 + rr)}^{${N}} = ${n1(pv)}$ kr.` },
          { q: `Vad är kassaflödena ${c1}, ${c2} och ${c3} kr (år 1, 2, 3) värda tillsammans idag?`, unit: "kr", answer: sum, hint: "Diskontera vart och ett och summera.", solution: `$${c1}/${n2(1 + rr)} + ${c2}/${n2(1 + rr)}^2 + ${c3}/${n2(1 + rr)}^3 = ${n1(sum)}$ kr.` },
          { q: "Hur mycket är 1 krona om 10 år värd idag?", unit: "kr", answer: d10, tol: 0.005, hint: "1 / (1 + r)^10.", solution: `$1 / ${n2(1 + rr)}^{10} = ${n2(d10)}$ kr – ${pc(1 - d10, 0)} mindre.` },
        ],
        takeaway: "Ju högre avkastningskrav och ju längre bort pengarna ligger, desto mindre är de värda idag. Därför gör **höjda räntor** att aktier i tillväxtbolag – vars vinster ligger långt fram – faller mest.",
      };
    },
  },
  {
    level: 2, title: "Bygg WACC", skills: "CAPM, lånekostnad efter skatt, viktning",
    make: (r) => {
      const rf = R.pick(r, [0.02, 0.025, 0.03, 0.035]), beta = R.pick(r, [0.8, 0.9, 1.0, 1.1, 1.2, 1.3]), erp = R.pick(r, [0.05, 0.055, 0.06]), kd = R.pick(r, [0.04, 0.05, 0.06]);
      const E = R.int(r, 5000, 40000, 1000), D = R.int(r, 1000, 15000, 500);
      const ke = rf + beta * erp, kdat = kd * (1 - TAX), we = E / (E + D), w = we * ke + (1 - we) * kdat;
      return {
        story: "Du ska räkna fram bolagets **WACC** – det avkastningskrav som används för att diskontera kassaflödena i en DCF. Använd börsvärdet som värde på eget kapital och skulden som den är.",
        givens: [["Riskfri ränta", pc(rf, 1)], ["Beta", n1(beta)], ["Marknadens riskpremie", pc(erp, 1)], ["Låneränta", pc(kd, 0)], ["Skatt", "20,6 %"], ["Börsvärde (E)", `${n0(E)} mkr`], ["Skuld (D)", `${n0(D)} mkr`]],
        steps: [
          { q: "Ägarnas avkastningskrav enligt CAPM?", unit: "%", answer: ke * 100, tol: 0.05, hint: "rf + beta × riskpremie.", solution: `$${pc(rf, 1)} + ${n1(beta)} \\times ${pc(erp, 1)} = ${pc(ke, 2)}$.` },
          { q: "Lånekostnad efter skatt?", unit: "%", answer: kdat * 100, tol: 0.05, hint: "Låneränta × (1 − skatt).", solution: `$${pc(kd, 0)} \\times 0{,}794 = ${pc(kdat, 2)}$.` },
          { q: "Andel eget kapital E/(D+E)?", unit: "%", answer: we * 100, tol: 0.3, hint: "E / (D + E).", solution: `$${n0(E)} / ${n0(E + D)} = ${pc(we)}$.` },
          { q: "WACC?", unit: "%", answer: w * 100, tol: 0.05, hint: "Andel E × kE + andel D × kD efter skatt.", solution: `$${pc(we)} \\times ${pc(ke, 2)} + ${pc(1 - we)} \\times ${pc(kdat, 2)} = ${pc(w, 2)}$.` },
        ],
        takeaway: `WACC ${pc(w, 2)}. Skulden är billigare än eget kapital (${pc(kdat, 1)} mot ${pc(ke, 1)}) – mest för att räntan är avdragsgill och långivare tar mindre risk. Men mer skuld gör aktien mer riskfylld, så beta och kE stiger. Det finns ingen gratis lunch.`,
      };
    },
  },
  {
    level: 3, title: "En hel DCF", skills: "prognos, nuvärde, restvärde, EV till värde per aktie",
    make: (r) => {
      const F0 = R.int(r, 500, 3000, 100), g = R.pick(r, [0.05, 0.08, 0.1, 0.12]), w = R.pick(r, [0.07, 0.08, 0.09, 0.1]), gT = R.pick(r, [0.02, 0.025]), ND = R.int(r, 1000, 8000, 500), sh = R.int(r, 100, 600, 50);
      const F = [1, 2, 3].map((t) => F0 * Math.pow(1 + g, t)), PV = F.map((f, i) => f / Math.pow(1 + w, i + 1)), sPV = PV.reduce((a, b) => a + b, 0);
      const TV = (F[2] * (1 + gT)) / (w - gT), pvTV = TV / Math.pow(1 + w, 3), EV = sPV + pvTV, Eq = EV - ND, ps = Eq / sh;
      return {
        story: `Bolaget har ett fritt kassaflöde på **${n0(F0)} mkr** som väntas växa **${pc(g, 0)} per år** de närmaste tre åren, och därefter **${pc(gT, 1)} för evigt**. WACC är **${pc(w, 0)}**. Nettoskuld **${n0(ND)} mkr**, **${sh} miljoner aktier**.`,
        givens: [["FCF idag", `${n0(F0)} mkr`], ["Tillväxt år 1–3", pc(g, 0)], ["Evig tillväxt", pc(gT, 1)], ["WACC", pc(w, 0)], ["Nettoskuld", `${n0(ND)} mkr`], ["Antal aktier", `${sh} milj.`]],
        steps: [
          { q: "FCF år 1?", unit: "mkr", answer: F[0], hint: "FCF idag × (1 + g).", solution: `$${n0(F0)} \\times ${n2(1 + g)} = ${n1(F[0])}$` },
          { q: "FCF år 3?", unit: "mkr", answer: F[2], hint: "FCF idag × (1 + g)^3.", solution: `$${n0(F0)} \\times ${n2(1 + g)}^3 = ${n1(F[2])}$ (år 2: ${n1(F[1])})` },
          { q: "Summan av nuvärdena för år 1–3?", unit: "mkr", answer: sPV, hint: "Diskontera varje år med (1 + WACC)^t och summera.", solution: `$${n1(PV[0])} + ${n1(PV[1])} + ${n1(PV[2])} = ${n1(sPV)}$` },
          { q: "Restvärde vid år 3 (Gordons formel)?", unit: "mkr", answer: TV, hint: "FCF år 3 × (1 + evig tillväxt) / (WACC − evig tillväxt).", solution: `$${n1(F[2])} \\times ${n2(1 + gT)} / (${n2(w)} - ${n2(gT)}) = ${n0(TV)}$` },
          { q: "Restvärdets nuvärde?", unit: "mkr", answer: pvTV, hint: "Restvärde / (1 + WACC)^3.", solution: `$${n0(TV)} / ${n2(1 + w)}^3 = ${n0(pvTV)}$` },
          { q: "Företagsvärde (EV)?", unit: "mkr", answer: EV, hint: "Nuvärde år 1–3 + restvärdets nuvärde.", solution: `$${n1(sPV)} + ${n0(pvTV)} = ${n0(EV)}$` },
          { q: "Värde per aktie?", unit: "kr", answer: ps, tol: Math.max(0.2, ps * 0.01), hint: "(EV − nettoskuld) / antal aktier.", solution: `$(${n0(EV)} - ${n0(ND)}) / ${sh} = ${n1(ps)}$ kr` },
          { q: "Hur stor andel av EV kommer från restvärdet?", unit: "%", answer: (pvTV / EV) * 100, tol: 0.5, hint: "PV(restvärde) / EV.", solution: `$${n0(pvTV)} / ${n0(EV)} = ${pc(pvTV / EV)}$` },
        ],
        takeaway: `${pc(pvTV / EV, 0)} av värdet ligger i restvärdet – alltså i åren efter prognosen. Därför är **WACC och evig tillväxt** de viktigaste antagandena. Testa: med WACC en procentenhet lägre blir restvärdet ${n0((F[2] * (1 + gT)) / (w - 0.01 - gT))} mkr i stället för ${n0(TV)}.`,
      };
    },
  },
];

// ═════════════════════════════ FOND ═════════════════════════════
export const FUND_METHOD: Method = {
  intro: "En PE-fond samlar in pengar från investerare (LP:s – pensionsfonder, försäkringsbolag, stiftelser) och investerar dem under 10–12 år. Förvaltaren (GP) tar betalt på två sätt: en årlig **förvaltningsavgift** och en vinstandel, **carried interest**.",
  why: "Fondekonomin avgör skillnaden mellan vad bolagen avkastar (**brutto**) och vad investerarna faktiskt får (**netto**). Den förklarar också J-kurvan: varför en fond ser dålig ut de första åren även när allt går bra.",
  steps: [
    { title: "Åtagande och kapitalanrop", concept: "private-equity", text: "Investerarna lovar ett belopp (åtagande). Pengarna anropas först när fonden hittar bolag att köpa – över 3–5 år.", example: "En fond på 10 mdkr anropar kanske 2,5 mdkr per år under fyra år." },
    { title: "Förvaltningsavgift", concept: "management-fee", text: "Typiskt 1,5–2 % per år på åtagandet under investeringsperioden, därefter på det som fortfarande är investerat. Betalar löner, kontor och analys.", formula: String.raw`\text{Avgift}_t = f \times \text{åtagande}\quad(\text{år } 1\text{–}5)`, example: "2 % × 10 mdkr = 200 mkr per år." },
    { title: "Investera och sälja", text: "Varje bolag ägs i 3–7 år. När det säljs kommer pengar tillbaka. Bruttoavkastningen mäts på bolagsnivå (MOIC och IRR).", example: "1 mdkr investerat, sålt för 2,5 mdkr efter 5 år = 2,5× brutto." },
    { title: "Vattenfallet: återbetalning först", concept: "carried-interest", text: "I den europeiska modellen får investerarna först tillbaka allt de satt in – både investeringar och avgifter – innan förvaltaren får någon vinstandel.", formula: String.raw`\text{Steg 1: LP får } C` },
    { title: "Hurdle (preferensavkastning)", concept: "hurdle-rate", text: "Därefter får investerarna en minimiavkastning, typiskt 8 % per år, innan carry börjar.", formula: String.raw`\text{Steg 2: } Pref = C\left[(1+h)^T - 1\right]` },
    { title: "Catch-up och vinstdelning", text: "När hurdlen är nådd får GP en catch-up tills GP har 20 % av all vinst. Sedan delas resten 80/20.", formula: String.raw`\text{Catch-up} = \frac{c}{1-c}\cdot Pref,\quad \text{GP totalt} = c \cdot (\text{utdelat} - C)` },
    { title: "Nettomått för investeraren", concept: "tvpi", text: "TVPI = (utdelat + kvarvarande värde) / insatt. DPI = utdelat / insatt. Netto-IRR räknas på investerarens faktiska kassaflöden.", formula: String.raw`TVPI = \frac{\text{utdelat} + NAV}{\text{insatt}}` },
  ],
  mistakes: [
    { title: "Jämföra brutto med netto", text: "En fond som säger \"25 % IRR\" menar ofta brutto. Efter avgifter och carry kan det bli 17–18 %." },
    { title: "Glömma att avgifter tar av kapitalet", text: "Med 2 % per år i tio år investeras bara ungefär 85 % av åtagandet." },
    { title: "Lita på tidig IRR", text: "IRR de första åren är brusig och ofta negativ (J-kurvan). Bedöm fonder på DPI när de är mogna." },
  ],
  levels: "Nivå 1: hur mycket avgifterna tar. Nivå 2: carried interest utan hurdle. Nivå 3: hela det europeiska vattenfallet med hurdle och catch-up.",
};

export const FUND_EX: Exercise[] = [
  {
    level: 1, title: "Vad kostar avgifterna?", skills: "förvaltningsavgift, investerbart kapital, bruttovinst",
    make: (r) => {
      const F = R.int(r, 2, 12) * 1000, f1 = R.pick(r, [0.015, 0.02]), f2 = f1 / 2, M = R.pick(r, [2, 2.25, 2.5, 3]);
      const fees = F * (f1 * 5 + f2 * 5), inv = F - fees, gross = inv * M;
      return {
        story: `En fond på **${n0(F)} mkr** tar **${pc(f1, 1)} per år** i förvaltningsavgift på åtagandet de första fem åren och **${pc(f2, 2)}** de följande fem. Allt som inte går till avgifter investeras, och bolagen säljs i snitt för **${n2(M)}×** pengarna.`,
        givens: [["Fondstorlek", `${n0(F)} mkr`], ["Avgift år 1–5", pc(f1, 1)], ["Avgift år 6–10", pc(f2, 2)], ["Brutto-MOIC", `${n2(M)}×`]],
        steps: [
          { q: "Avgift per år under de första fem åren?", unit: "mkr", answer: F * f1, hint: "Avgift × fondstorlek.", solution: `$${pc(f1, 1)} \\times ${n0(F)} = ${n0(F * f1)}$ mkr.` },
          { q: "Totala avgifter under tio år?", unit: "mkr", answer: fees, hint: "5 år × full avgift + 5 år × halv avgift.", solution: `$5 \\times ${n0(F * f1)} + 5 \\times ${n0(F * f2)} = ${n0(fees)}$ mkr.` },
          { q: "Hur mycket kan investeras i bolag?", unit: "mkr", answer: inv, hint: "Fondstorlek − avgifter.", solution: `$${n0(F)} - ${n0(fees)} = ${n0(inv)}$ mkr (${pc(inv / F, 0)}).` },
          { q: "Hur mycket kommer tillbaka när bolagen säljs?", unit: "mkr", answer: gross, hint: "Investerat × MOIC.", solution: `$${n0(inv)} \\times ${n2(M)} = ${n0(gross)}$ mkr.` },
          { q: "Vad blir MOIC räknat på hela fonden (före carry)?", unit: "×", answer: gross / F, tol: 0.02, hint: "Tillbaka / fondstorlek.", solution: `$${n0(gross)} / ${n0(F)} = ${n2(gross / F)}\\times$ – lägre än bolagens ${n2(M)}× på grund av avgifterna.` },
        ],
        takeaway: `Avgifterna tog ${pc(fees / F, 0)} av kapitalet, så bolagens ${n2(M)}× blev ${n2(gross / F)}× för fonden – och då är carry inte ens dragen. **Avgifter är den säkraste delen av förvaltarens inkomst.**`,
      };
    },
  },
  {
    level: 2, title: "Carried interest", skills: "vinst, carry, nettoavkastning",
    make: (r) => {
      const C = R.int(r, 1000, 5000, 250), M = R.pick(r, [1.6, 1.8, 2, 2.2, 2.5]), c = 0.2, T = R.pick(r, [5, 6, 7]);
      const P = C * M, prof = P - C, carry = c * prof, lp = P - carry, mo = lp / C, irrN = Math.pow(mo, 1 / T) - 1, irrG = Math.pow(M, 1 / T) - 1;
      return {
        story: `Investerarna har satt in **${n0(C)} mkr** (inklusive avgifter). Efter **${T} år** har fonden delat ut **${n0(P)} mkr**. Förvaltaren får **20 % carry** på vinsten (ingen hurdle i den här övningen).`,
        givens: [["Insatt av LP", `${n0(C)} mkr`], ["Utdelat totalt", `${n0(P)} mkr`], ["Carry", "20 %"], ["Tid", `${T} år`]],
        steps: [
          { q: "Total vinst?", unit: "mkr", answer: prof, hint: "Utdelat − insatt.", solution: `$${n0(P)} - ${n0(C)} = ${n0(prof)}$ mkr.` },
          { q: "Carry till förvaltaren?", unit: "mkr", answer: carry, hint: "20 % av vinsten.", solution: `$0{,}2 \\times ${n0(prof)} = ${n0(carry)}$ mkr.` },
          { q: "Hur mycket får investerarna totalt?", unit: "mkr", answer: lp, hint: "Utdelat − carry.", solution: `$${n0(P)} - ${n0(carry)} = ${n0(lp)}$ mkr.` },
          { q: "Investerarnas netto-MOIC?", unit: "×", answer: mo, tol: 0.02, hint: "Till LP / insatt.", solution: `$${n0(lp)} / ${n0(C)} = ${n2(mo)}\\times$.` },
          { q: "Investerarnas netto-IRR (ett insättnings- och ett uttagstillfälle)?", unit: "%", answer: irrN * 100, tol: 0.3, hint: `MOIC^(1/${T}) − 1.`, solution: `$${n2(mo)}^{1/${T}} - 1 = ${pc(irrN)}$ (brutto ${pc(irrG)}).` },
        ],
        takeaway: `Carry tog ${pc(irrG - irrN)} enheter av den årliga avkastningen. Förvaltaren fick ${n0(carry)} mkr – därför är carry så eftertraktat i PE-branschen. Det är också därför förvaltarens intressen sammanfaller med investerarnas: ingen vinst, ingen carry.`,
      };
    },
  },
  {
    level: 3, title: "Hela vattenfallet", skills: "hurdle, catch-up, europeiskt vattenfall",
    make: (r) => {
      const C = R.int(r, 1000, 4000, 250), T = R.pick(r, [5, 6]), M = R.pick(r, [1.9, 2.1, 2.3, 2.5]), h = 0.08, c = 0.2;
      const P = C * M, prof = P - C, pref = C * (Math.pow(1 + h, T) - 1), cu = (c / (1 - c)) * pref, rest = prof - pref - cu, gp = cu + c * rest, lp = P - gp;
      const mo = lp / C, irrN = Math.pow(mo, 1 / T) - 1;
      return {
        story: `Investerarna satte in **${n0(C)} mkr** och fonden delar ut **${n0(P)} mkr** efter **${T} år** (allt på en gång för enkelhetens skull). Villkor: **8 % hurdle** (årlig ränta på ränta), **20 % carry** och **full catch-up** till förvaltaren.`,
        givens: [["Insatt", `${n0(C)} mkr`], ["Utdelat", `${n0(P)} mkr`], ["Tid", `${T} år`], ["Hurdle", "8 %/år"], ["Carry", "20 %"], ["Catch-up", "100 %"]],
        steps: [
          { q: "Steg 1: investerarna får tillbaka insatsen. Hur mycket vinst finns sedan att fördela?", unit: "mkr", answer: prof, hint: "Utdelat − insatt.", solution: `$${n0(P)} - ${n0(C)} = ${n0(prof)}$ mkr.` },
          { q: "Steg 2: hur stor är preferensavkastningen (hurdle) till investerarna?", unit: "mkr", answer: pref, hint: `Insatt × (1,08^${T} − 1).`, solution: `$${n0(C)} \\times (1{,}08^{${T}} - 1) = ${n0(pref)}$ mkr.` },
          { q: "Steg 3: hur stor är förvaltarens catch-up?", unit: "mkr", answer: cu, hint: "Förvaltaren ska komma ikapp till 20 % av vinsten hittills: 0,2/0,8 × preferensavkastningen.", solution: `$0{,}25 \\times ${n0(pref)} = ${n0(cu)}$ mkr. Nu har GP $${n0(cu)}$ av $${n0(pref + cu)}$ = 20 %.` },
          { q: "Steg 4: hur mycket vinst återstår att dela 80/20?", unit: "mkr", answer: rest, hint: "Vinst − preferens − catch-up.", solution: `$${n0(prof)} - ${n0(pref)} - ${n0(cu)} = ${n0(rest)}$ mkr.` },
          { q: "Hur mycket får förvaltaren totalt?", unit: "mkr", answer: gp, hint: "Catch-up + 20 % av resten. (Ska bli 20 % av all vinst.)", solution: `$${n0(cu)} + 0{,}2 \\times ${n0(rest)} = ${n0(gp)}$ mkr = 20 % × ${n0(prof)} ✓` },
          { q: "Investerarnas netto-MOIC?", unit: "×", answer: mo, tol: 0.02, hint: "(Utdelat − GP) / insatt.", solution: `$(${n0(P)} - ${n0(gp)}) / ${n0(C)} = ${n2(mo)}\\times$.` },
          { q: "Investerarnas netto-IRR?", unit: "%", answer: irrN * 100, tol: 0.3, hint: `MOIC^(1/${T}) − 1.`, solution: `$${n2(mo)}^{1/${T}} - 1 = ${pc(irrN)}$ (brutto ${pc(Math.pow(M, 1 / T) - 1)}).` },
        ],
        takeaway: `Med full catch-up får förvaltaren ändå 20 % av hela vinsten – hurdlen påverkar bara **när** förvaltaren får betalt, inte hur mycket, så länge fonden går tillräckligt bra. Hade fonden bara nått ${n2(1 + (pref) / C)}× hade förvaltaren fått noll carry.`,
      };
    },
  },
];
