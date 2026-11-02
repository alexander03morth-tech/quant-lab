/**
 * Akademin: inlärningsvägar. Varje steg är kort (2–3 meningar), pekar på 2–4 begrepp i ordlistan,
 * på ett verktyg där man provar själv, och har en kontrollfråga. Medvetet lite text per steg.
 */
export interface Step {
  id: string;
  title: string;
  mins: number;
  text: string;
  concepts: string[];
  link: { to: string; label: string };
  task: string;
  quiz: { q: string; options: string[]; correct: number; why: string };
}
export interface Path { id: string; title: string; kicker: string; blurb: string; steps: Step[] }

export const PATHS: Path[] = [
  {
    id: "grund", title: "Grunderna", kicker: "Börja här", blurb: "Hur börsen fungerar, vad risk är och varför man sprider den.",
    steps: [
      { id: "g1", title: "Vad är ett index?", mins: 4, text: "Ett index sammanfattar hur en grupp aktier gått. OMXS30 är de 30 mest handlade aktierna i Stockholm. Det är måttstocken som nästan alla jämför sig med.",
        concepts: ["index", "total-return"], link: { to: "/marknad", label: "Marknadsöversikten" }, task: "Byt period mellan ”1 m” och ”3 år” och se vilka sektorer som dragit indexet.",
        quiz: { q: "OMXS30 steg 2 % idag. Vad vet du säkert?", options: ["Alla 30 aktier steg", "Snittet, viktat efter storlek, steg 2 %", "Ingen aktie föll"], correct: 1, why: "Ett index är ett viktat snitt. Enskilda aktier kan ha fallit samma dag." } },
      { id: "g2", title: "Risk = hur mycket det svänger", mins: 5, text: "Volatilitet mäter hur mycket en aktie brukar röra sig. Med beta jämför man den med marknaden. Hög volatilitet betyder inte att aktien är dålig, bara att resan blir gropigare.",
        concepts: ["volatility", "beta", "sigma-move"], link: { to: "/marknad", label: "Marknadsöversikten" }, task: "Sortera tabellen på ”Vol 1 år”. Vilka sektorer hamnar högst?",
        quiz: { q: "En aktie har beta 1,5. Index faller 4 %. Vad är väntat för aktien?", options: ["−4 %", "−6 %", "−1,5 %"], correct: 1, why: "Beta 1,5 betyder att aktien i snitt rör sig 1,5 gånger så mycket som index: 1,5 × −4 % = −6 %." } },
      { id: "g3", title: "Korrelation och diversifiering", mins: 6, text: "Två aktier som inte rör sig samtidigt jämnar ut varandra. Därför sjunker risken när man blandar. Men i kriser rör sig allt ihop, och då försvinner skyddet.",
        concepts: ["correlation", "diversification", "avg-correlation"], link: { to: "/korrelation", label: "Korrelationsmatrisen" }, task: "Hitta två aktier med korrelation under 0,1 och titta på kurvan ”När allt faller samtidigt”.",
        quiz: { q: "När sprider man risken bäst?", options: ["Med aktier som har hög korrelation", "Med aktier som har låg korrelation", "Med många aktier i samma sektor"], correct: 1, why: "Låg korrelation gör att förluster i en aktie ofta vägs upp av en annan." } },
      { id: "g4", title: "Bygg en portfölj", mins: 8, text: "En portfölj bedöms på avkastning i förhållande till risk. Sharpe-kvoten och största nedgång säger mer än bara avkastningen. Den effektiva fronten visar de bästa kombinationerna.",
        concepts: ["sharpe", "max-drawdown", "efficient-frontier", "estimation-error"], link: { to: "/portfolj", label: "Portföljlabbet" }, task: "Bygg en portfölj med 5 aktier och jämför din punkt med den effektiva fronten.",
        quiz: { q: "Portfölj A: +12 %/år, vol 24 %. Portfölj B: +9 %/år, vol 12 %. Vilken har högst Sharpe (ränta 0)?", options: ["A (0,5)", "B (0,75)", "Lika"], correct: 1, why: "Sharpe = avkastning / volatilitet: A 12/24 = 0,5, B 9/12 = 0,75." } },
    ],
  },
  {
    id: "kvant", title: "Kvant & stat arb", kicker: "Statistisk arbitrage", blurb: "Från samintegration till en ärlig backtest och faktormodeller.",
    steps: [
      { id: "k1", title: "Korrelation räcker inte", mins: 6, text: "Pairs trading satsar på att avståndet mellan två aktier går tillbaka. Det kräver samintegration (ett koppel), inte bara korrelation. Två aktier kan röra sig lika varje dag och ändå glida isär för alltid.",
        concepts: ["corr-vs-coint", "stationarity", "cointegration"], link: { to: "/par", label: "Paranalys" }, task: "Öppna NDA-SE/SWED-A och se om de normaliserade kurserna glider isär och möts igen.",
        quiz: { q: "Vad är det som ska vara stationärt i pairs trading?", options: ["Varje akties kurs", "Spreaden mellan dem", "Korrelationen"], correct: 1, why: "Kurserna vandrar fritt. Det är skillnaden (spreaden) som ska återgå till ett medel." } },
      { id: "k2", title: "Testerna: ADF, EG och Johansen", mins: 8, text: "Engle-Granger testar om spreaden är stationär. Johansen gör samma sak utan att välja riktning. Half-life och Hurst visar hur snabbt och hur pålitligt spreaden återgår.",
        concepts: ["adf", "p-value", "johansen", "half-life", "hurst"], link: { to: "/par", label: "Paranalys" }, task: "Läs bedömningstabellen för ett par. Hur många av 6 kriterier klaras?",
        quiz: { q: "Half-life 10 dagar. Spreaden ligger 4 % från medel. Väntat om 20 dagar?", options: ["0 %", "1 %", "2 %"], correct: 1, why: "Halveras var 10:e dag: 4 % → 2 % → 1 %." } },
      { id: "k3", title: "Hedge ratio, spread och z-score", mins: 8, text: "Hedge ratio β säger hur mycket av B man blankar per krona A. Kalmanfiltret låter β ändras över tid. Z-scoren mäter hur ovanlig spreaden är idag och ger in- och utgångssignaler.",
        concepts: ["hedge-ratio", "kalman", "zscore", "signals"], link: { to: "/par", label: "Paranalys" }, task: "Byt mellan Kalman och statisk OLS och läs varningen om look-ahead.",
        quiz: { q: "z = −2,3 med ingång ±2. Vad gör strategin?", options: ["Köper spreaden (köp A, blanka B)", "Säljer spreaden", "Inget"], correct: 0, why: "Låg z = A billig relativt B, så köp A och blanka β × B. Affären görs nästa dag." } },
      { id: "k4", title: "Slumpens fälla: många test", mins: 6, text: "Med 435 par ger 5 % signifikansnivå runt 22 par som ser bra ut av ren tur. q-värden och stabilitet över tid är de bästa skydden.",
        concepts: ["multiple-testing", "stability", "overfitting"], link: { to: "/scanner", label: "Parscannern" }, task: "Jämför hur många par som har p < 0,05 med hur många slumpen väntas ge.",
        quiz: { q: "Du testar 200 par och hittar 11 med p < 0,05. Vad är rimligast?", options: ["11 bra par", "De flesta kan vara slump (≈10 väntas)", "Inget par är bra"], correct: 1, why: "200 × 5 % = 10 falska träffar väntas även om inget par är samintegrerat." } },
      { id: "k5", title: "En ärlig backtest", mins: 10, text: "Välj par och inställningar på träningsdata och utvärdera sedan på en period strategin aldrig sett. Räkna med courtage och blankningskostnad. Skillnaden mot ett urval med facit är ofta enorm.",
        concepts: ["backtest", "out-of-sample", "look-ahead", "transaction-costs"], link: { to: "/backtest?mode=portfolio", label: "Backtest" }, task: "Kör ”Portfölj av par” och jämför det ärliga urvalet med urvalet med facit.",
        quiz: { q: "Sharpe 1,8 i träning och 0,2 i test. Troligaste förklaringen?", options: ["Otur i testperioden", "Strategin har anpassats till brus", "Kostnaderna är för låga"], correct: 1, why: "Ett stort fall från träning till test är det klassiska tecknet på överanpassning." } },
      { id: "k6", title: "Faktorer och PCA", mins: 10, text: "PCA hittar de gemensamma krafterna bakom alla aktier, och den första är marknaden. Rensar man bort dem återstår varje bolags egen rörelse. s-score (Avellaneda–Lee) visar vilka aktier som är billiga mot faktorerna.",
        concepts: ["pca", "marchenko-pastur", "factor-model", "s-score"], link: { to: "/pca", label: "PCA-vyn" }, task: "Hur många komponenter ligger över slumpgränsen? Vilka aktier har s ≤ −1,25?",
        quiz: { q: "Vad representerar nästan alltid PC1?", options: ["Bankerna", "Marknaden som helhet", "Slumpen"], correct: 1, why: "Alla aktier laddar åt samma håll på PC1, och dess portfölj följer indexet nästan exakt." } },
    ],
  },
  {
    id: "aktie", title: "Aktieanalys", kicker: "Fundamental analys", blurb: "Läs ett bolag, värdera det och jämför med konkurrenterna.",
    steps: [
      { id: "a1", title: "Läs bolaget", mins: 6, text: "Börja med hur bolaget tjänar pengar: tillväxt, marginaler och kassaflöde. Avkastning på eget kapital visar hur bra ledningen förvaltar ägarnas pengar.",
        concepts: ["margins", "roe", "fcf-yield"], link: { to: "/aktie/bolag", label: "Bolagsanalys" }, task: "Välj ett bolag och hitta dess EBITDA-marginal och fritt kassaflöde.",
        quiz: { q: "Vilket mått visar bäst hur mycket kontanter bolaget faktiskt genererar?", options: ["Omsättning", "Fritt kassaflöde", "Antal anställda"], correct: 1, why: "Fritt kassaflöde = pengar kvar efter investeringar, som kan delas ut eller betala skuld." } },
      { id: "a2", title: "Multiplar: P/E och EV/EBITDA", mins: 6, text: "Multiplar jämför priset med vinst eller kassaflöde. EV/EBITDA tar med skulden och är bättre för att jämföra bolag med olika finansiering. En låg multipel är billig bara om bolaget inte är sämre.",
        concepts: ["pe", "ev-ebitda", "enterprise-value"], link: { to: "/aktie/jamfor", label: "Jämförelse" }, task: "Jämför tre verkstadsbolag på EV/EBITDA och tillväxt.",
        quiz: { q: "Bolag A har P/E 10 och B har P/E 25. Vad vet du?", options: ["A är billigare", "Marknaden väntar sig mer tillväxt av B", "B är övervärderat"], correct: 1, why: "En högre multipel speglar ofta förväntad tillväxt. ”Billigt” kräver en jämförelse med kvalitet och utsikter." } },
      { id: "a3", title: "DCF: värdet av framtida kassaflöden", mins: 10, text: "En DCF diskonterar framtida kassaflöden med WACC. Det mesta av värdet ligger ofta i restvärdet. Omvänd DCF frågar vad marknaden redan antar.",
        concepts: ["dcf", "wacc", "terminal-value", "capm"], link: { to: "/aktie/dcf", label: "DCF-värdering" }, task: "Höj WACC med 1 procentenhet och se hur mycket värdet faller.",
        quiz: { q: "Vad händer med DCF-värdet om WACC höjs?", options: ["Det stiger", "Det sjunker", "Oförändrat"], correct: 1, why: "Framtida kassaflöden diskonteras hårdare och är därför värda mindre idag." } },
      { id: "a4", title: "Analytiker och yrket", mins: 5, text: "Sell-side-analytiker skriver rekommendationer och riktkurser. Buy-side-analytiker fattar själva besluten. Riktkurser är åsikter med stor spridning, inte facit.",
        concepts: ["analyst-target", "quality-score"], link: { to: "/aktie/jobbet", label: "Så funkar jobbet" }, task: "Läs ”En vanlig dag” för en aktieanalytiker.",
        quiz: { q: "Vem arbetar på buy-side?", options: ["En mäklarfirmas analytiker", "En fondförvaltares analytiker", "Bolagets IR-chef"], correct: 1, why: "Buy-side = de som investerar (fonder, pensionsbolag). Sell-side säljer analys och handel." } },
    ],
  },
  {
    id: "ib", title: "Investment banking", kicker: "Rådgivning & affärer", blurb: "Värdering, M&A och hur en affär går till.",
    steps: [
      { id: "i1", title: "Vad gör en investmentbank?", mins: 5, text: "Banken ger råd vid köp och försäljning av bolag (M&A), tar in kapital via börsen (ECM) och lånar ut via obligationer och lån (DCM). Betalt tar den i form av avgifter, ofta en procentsats av affären.",
        concepts: ["investment-banking", "ipo"], link: { to: "/ib/jobbet", label: "Så funkar jobbet" }, task: "Läs ”Bankens avdelningar” och välj den som verkar roligast.",
        quiz: { q: "Vilken avdelning hjälper till vid en börsnotering?", options: ["DCM", "ECM", "M&A"], correct: 1, why: "ECM (equity capital markets) arbetar med aktier: börsnoteringar och nyemissioner." } },
      { id: "i2", title: "Värderingsöversikten", mins: 7, text: "Banker lägger flera värderingsmetoder bredvid varandra i en ”football field”. Där staplarna överlappar ligger det rimliga värdet, och en köpare måste oftast betala en premie.",
        concepts: ["football-field", "comps", "bid-premium", "range-52w"], link: { to: "/ib/vardering", label: "Värderingsöversikten" }, task: "Var hamnar dagens kurs jämfört med uppköpsstapeln?",
        quiz: { q: "Varför ligger uppköpsstapeln oftast längst till höger?", options: ["Köpare betalar en premie för kontroll", "DCF är alltid lägst", "Kursen är fel"], correct: 0, why: "För att få kontroll måste köparen betala mer än marknadspriset, typiskt 25–40 %." } },
      { id: "i3", title: "M&A: accretion och synergier", mins: 8, text: "Höjer eller sänker affären köparens vinst per aktie? Det beror på pris, betalningssätt och synergier. Break-even-synergier visar hur mycket som krävs för att affären ska gå jämnt upp.",
        concepts: ["accretion-dilution", "synergies", "stock-vs-cash", "eps"], link: { to: "/ib/ma", label: "M&A-kalkylen" }, task: "Byt från aktiebetalning till lån och se hur EPS-effekten ändras.",
        quiz: { q: "Köparen har P/E 20 och köper ett bolag på P/E 15 med aktier. Utan synergier blir affären…", options: ["Accretive", "Dilutive", "Neutral"], correct: 0, why: "Man köper vinst billigare än sina egna aktier värderas, så EPS stiger." } },
      { id: "i4", title: "Affärsprocessen", mins: 6, text: "En försäljning är en auktion i flera steg: förberedelse, indikativa bud, due diligence och bindande bud. Det tar typiskt 4–9 månader.",
        concepts: ["ma-process", "bookbuilding"], link: { to: "/ib/process", label: "Affärsprocessen" }, task: "Följ stegen och notera var flest köpare faller bort.",
        quiz: { q: "Vad är due diligence?", options: ["Prisförhandling", "Köparens djupa granskning av bolaget", "Börsens godkännande"], correct: 1, why: "Köparen granskar ekonomi, juridik, kunder och risker innan bindande bud." } },
    ],
  },
  {
    id: "pe", title: "Private equity", kicker: "Köpa, utveckla, sälja", blurb: "Hur PE-fonder köper bolag, skapar värde och tjänar pengar.",
    steps: [
      { id: "p1", title: "Vad är private equity?", mins: 5, text: "En PE-fond köper bolag, ofta med mycket lån, utvecklar dem i 3–7 år och säljer. Fonden har olika strategier, från stora uppköp till riskkapital i startups.",
        concepts: ["private-equity", "lbo"], link: { to: "/pe/jobbet", label: "Så funkar jobbet" }, task: "Klicka igenom strategierna under ”Så hittas bolag”.",
        quiz: { q: "Vilken strategi använder mest lån?", options: ["Venture", "Buyout", "Tillväxtkapital"], correct: 1, why: "Buyouts köper mogna bolag med stabila kassaflöden som tål skuld. Venture använder i princip inga lån." } },
      { id: "p2", title: "LBO-modellen", mins: 10, text: "Fonden köper bolaget för en multipel av EBITDA och finansierar en stor del med lån. Kassaflödet betalar av skulden. Avkastningen mäts i IRR och MOIC.",
        concepts: ["leverage-multiple", "irr", "moic", "cash-sweep"], link: { to: "/pe/lbo", label: "LBO-modellen" }, task: "Höj skulden från 4× till 6× EBITDA och se vad som händer med IRR och räntetäckningen.",
        quiz: { q: "Du får tillbaka 2,5× pengarna efter 5 år. Ungefär vilken IRR är det?", options: ["10 %", "20 %", "50 %"], correct: 1, why: "2,5^(1/5) ≈ 1,20, alltså cirka 20 % per år." } },
      { id: "p3", title: "Var kommer vinsten ifrån?", mins: 6, text: "Värdet skapas på tre sätt: högre EBITDA, högre multipel vid försäljning och avbetald skuld. Värdebryggan visar hur mycket varje del bidrog.",
        concepts: ["value-creation-bridge", "multiple-expansion", "ebitda"], link: { to: "/pe/lbo", label: "LBO-modellen" }, task: "Sätt samma multipel vid köp och försäljning. Hur stor blir IRR då?",
        quiz: { q: "Vilken värdekälla är mest ”riktigt arbete”?", options: ["Multipelexpansion", "EBITDA-tillväxt", "Lägre ränta"], correct: 1, why: "Multipeln styrs mycket av marknaden. EBITDA-tillväxt kommer från bättre drift." } },
      { id: "p4", title: "Fondens ekonomi", mins: 8, text: "Investerarna (LP) betalar förvaltningsavgift och lämnar carried interest till förvaltaren (GP) över en hurdle rate. J-kurvan visar att fonden ser dålig ut de första åren.",
        concepts: ["management-fee", "carried-interest", "hurdle-rate", "j-curve", "gross-net"], link: { to: "/pe/fond", label: "Fondekonomi" }, task: "Ändra carry från 20 % till 30 % och jämför brutto- och netto-IRR.",
        quiz: { q: "Varför är fondens avkastning negativ de första åren?", options: ["Bolagen går dåligt", "Avgifter och kostnader kommer före vinsterna", "Fel i redovisningen"], correct: 1, why: "Det är J-kurvan: avgifter betalas direkt, medan värdet skapas och realiseras senare." } },
    ],
  },
];
