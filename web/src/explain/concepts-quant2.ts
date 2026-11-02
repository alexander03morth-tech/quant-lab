/** Begrepp för Korrelationsmatris, Parscanner, Backtest, PCA och Marknadsöversikt. */
import { fmt, fmtPct } from "../lib/format";
import type { Extra } from "./extras";
import type { Concept, Ctx } from "./types";

const has = (c: Ctx, ...k: string[]) => k.every((x) => c[x] != null && !(typeof c[x] === "number" && !Number.isFinite(c[x])));
const CORR = { to: "/korrelation", label: "Korrelationsmatrisen" };
const BT = { to: "/backtest", label: "Backtest" };
const PCA = { to: "/pca", label: "PCA-vyn" };
const MKT = { to: "/marknad", label: "Marknadsöversikten" };


export const QUANT2_CONCEPTS: Concept[] = [
  {
    id: "corr-matrix", title: "Korrelationsmatris", en: "correlation matrix", kind: "Graf",
    what: "En tabell där varje ruta visar korrelationen mellan två aktiers dagliga avkastning. Diagonalen är alltid 1 (en aktie mot sig själv).",
    why: "Den visar på en gång vilka aktier som rör sig ihop. Det är grunden för diversifiering, för att hitta par och för faktormodeller som PCA.",
    interpret: ["Mörk/varm färg = rör sig ofta åt samma håll samma dag.", "Block av höga värden = en grupp som drivs av samma sak (t.ex. banker).", "Hög korrelation betyder inte att aktierna går lika bra på sikt – bara att de rör sig samtidigt."],
    example: (c) => has(c, "A", "B", "rho") ? `${c.A} och ${c.B} har korrelation ${fmt(c.rho, 2)} i valt fönster.` : null,
    related: ["correlation", "clustering", "avg-correlation", "corr-vs-coint"], learn: "kvant",
  },
  {
    id: "avg-correlation", title: "Genomsnittlig korrelation", en: "average pairwise correlation", kind: "Mått",
    what: "Snittet av alla parvisa korrelationer i indexet, räknat i ett rullande fönster. Ett mått på hur mycket hela marknaden rör sig som en klump.",
    why: "När det krisar stiger korrelationen – \"allt faller samtidigt\" – och diversifieringen försvinner precis när man behöver den. Låg korrelation betyder att det är aktieval, inte marknaden, som avgör.",
    interpret: ["Under 0,3: aktierna går mest sin egen väg.", "0,3–0,5: normalt för en svensk storbolagsmarknad.", "Över 0,6: stress – marknaden drivs av en gemensam faktor (räntor, kris)."],
    formula: String.raw`\bar\rho = \frac{2}{N(N-1)}\sum_{i<j}\rho_{ij}`,
    example: (c) => has(c, "avgNow", "avgPct") ? `Just nu ${fmt(c.avgNow, 2)}, högre än ${fmtPct(c.avgPct, 0)} av alla perioder sedan datan börjar.` : null,
    related: ["corr-matrix", "diversification", "pca"], learn: "kvant",
  },
  {
    id: "clustering", title: "Klustring", en: "hierarchical clustering", kind: "Modell",
    what: "En metod som sorterar aktierna så att de som liknar varandra mest hamnar bredvid varandra. Avståndet mellan två aktier är 1 − korrelationen.",
    why: "Med klustrad ordning syns grupperna i korrelationsmatrisen som tydliga block – ofta mer talande än den officiella sektorindelningen.",
    interpret: ["Två aktier i samma block är naturliga parkandidater.", "En aktie som inte hör till något block (t.ex. AstraZeneca) diversifierar mest.", "Klustren kan ändras över tid – jämför olika fönster."],
    related: ["corr-matrix", "pca"], learn: "kvant",
  },
  {
    id: "backtest", title: "Backtest", en: "backtest", kind: "Modell",
    what: "En simulering av hur en strategi hade gått historiskt, dag för dag, med de regler och kostnader man bestämt i förväg.",
    why: "Det enda sättet att se om en idé hade fungerat innan man riskerar pengar. Men en backtest är bara så ärlig som dess antaganden.",
    interpret: ["Fråga alltid: använde signalen bara information man hade då? (look-ahead)", "Hur många varianter testades innan man valde den här? (överanpassning)", "Ingår courtage, spread och blankningskostnad?", "Fungerar det på data som inte användes för att välja reglerna? (out-of-sample)"],
    related: ["look-ahead", "overfitting", "out-of-sample", "transaction-costs"], learn: "kvant",
  },
  {
    id: "out-of-sample", title: "In-sample och out-of-sample", en: "in-sample / out-of-sample", kind: "Fallgrop",
    what: "In-sample är den period man använt för att välja par och parametrar. Out-of-sample är perioden efter, som strategin aldrig \"sett\".",
    why: "En strategi som bara fungerar in-sample har lärt sig bruset. Out-of-sample-resultatet är det närmaste en ärlig gissning om framtiden man kan få.",
    interpret: ["Sharpe brukar falla med hälften eller mer out-of-sample – det är normalt.", "Om out-of-sample är bättre än in-sample: troligen tur, inte skicklighet.", "Titta bara på out-of-sample en gång. Justerar man efteråt blir det in-sample."],
    example: (c) => has(c, "srIn", "srOut") ? `Här: Sharpe ${fmt(c.srIn, 2)} in-sample mot ${fmt(c.srOut, 2)} out-of-sample.` : null,
    related: ["overfitting", "backtest", "multiple-testing"], learn: "kvant",
  },
  {
    id: "transaction-costs", title: "Transaktionskostnader", en: "transaction costs", kind: "Parameter",
    what: "Det det kostar att handla: courtage, halva skillnaden mellan köp- och säljkurs (spread) och påverkan på priset när man handlar stort. Anges i baspunkter (1 bp = 0,01 %).",
    why: "Pairs trading tjänar lite per affär och handlar ofta. Kostnaderna kan äta upp hela vinsten – en strategi med Sharpe 1,5 utan kostnader kan bli negativ med dem.",
    interpret: ["Stora svenska aktier: ca 3–10 bp per sida för en institution, mer för en privatperson.", "Varje affär i ett par = 4 transaktioner (köp/sälj × två aktier).", "Testa alltid hur resultatet ändras när kostnaden dubblas."],
    example: (c) => has(c, "costBps", "breakEvenBps") ? `Med ${fmt(c.costBps, 0)} bp per sida och ben; strategin går jämnt upp vid ca ${fmt(c.breakEvenBps, 0)} bp.` : null,
    related: ["short-costs", "backtest"], learn: "kvant",
  },
  {
    id: "pca", title: "PCA (huvudkomponentanalys)", en: "principal component analysis", kind: "Modell",
    what: "En metod som hittar de få dolda \"krafter\" som förklarar det mesta av hur 30 aktier rör sig. Den första är nästan alltid marknaden själv.",
    why: "Om 40 % av alla rörelser är marknaden och 10 % är \"cykliskt mot defensivt\" kan man rensa bort dem och handla det som är kvar – det bolagsspecifika.",
    interpret: ["PC1 (första komponenten): alla aktier åt samma håll = marknaden.", "PC2 och PC3: ofta sektorer mot varandra, t.ex. banker mot verkstad.", "Komponenter med egenvärde under Marchenko–Pastur-gränsen går inte att skilja från slump."],
    formula: String.raw`C = V \Lambda V^\top,\quad \text{andel}_k = \frac{\lambda_k}{\sum_j \lambda_j}`,
    symbols: [["C", "korrelationsmatrisen"], [String.raw`\lambda_k`, "egenvärde k – hur mycket variation komponent k förklarar"], ["V", "egenvektorerna – varje akties vikt (laddning) i komponenten"]],
    example: (c) => has(c, "pc1") ? `I valt fönster förklarar PC1 ${fmtPct(c.pc1, 0)} av all variation${has(c, "nSig") ? ` och ${c.nSig} komponenter ligger över slumpgränsen` : ""}.` : null,
    related: ["eigenportfolio", "marchenko-pastur", "factor-model", "s-score"], learn: "kvant",
  },
  {
    id: "eigenportfolio", title: "Egenportfölj och laddning", en: "eigenportfolio / loading", kind: "Grundbegrepp",
    what: "Varje huvudkomponent kan köpas som en portfölj: laddningen säger hur mycket av varje aktie den innehåller. PC1:s egenportfölj liknar ett index.",
    why: "Egenportföljerna fungerar som faktorer: man kan mäta hur mycket en aktie rör sig med dem (beta) och vad som är kvar (residualen).",
    interpret: ["Stor positiv laddning = aktien drar åt samma håll som komponenten.", "Laddningar med olika tecken = komponenten ställer de grupperna mot varandra.", "Vikten per aktie delas med dess volatilitet, så volatila aktier väger mindre."],
    related: ["pca", "factor-model"], learn: "kvant",
  },
  {
    id: "marchenko-pastur", title: "Marchenko–Pastur-gränsen", en: "Marchenko–Pastur bound", kind: "Test",
    what: "Det största egenvärde som helt slumpmässiga, okorrelerade aktier skulle ge med samma antal aktier och dagar. Allt under gränsen kan vara brus.",
    why: "Med 30 aktier och ett års data hittar PCA alltid 30 komponenter – men bara de som sticker upp över gränsen säger något verkligt om marknaden.",
    interpret: ["Typiskt 2–4 komponenter över gränsen för OMXS30.", "Kortare fönster → högre gräns → färre komponenter går att lita på."],
    formula: String.raw`\lambda_{+} = \left(1 + \sqrt{N/T}\right)^2`,
    symbols: [["N", "antal aktier"], ["T", "antal dagar"]],
    example: (c) => has(c, "mp") ? `Med valt fönster är gränsen λ₊ = ${fmt(c.mp, 2)}.` : null,
    related: ["pca", "multiple-testing"], learn: "kvant",
  },
  {
    id: "factor-model", title: "Faktormodell", en: "factor model", kind: "Modell",
    what: "Ett sätt att dela upp en akties avkastning i en del som förklaras av gemensamma faktorer (marknaden, sektorer) och en bolagsspecifik rest (residual).",
    why: "Stat arb med faktorer handlar residualen: man blankar faktorerna bort och satsar på att den bolagsspecifika avvikelsen går tillbaka.",
    interpret: ["R² nära 1: aktien är nästan bara marknad och sektor.", "Stor residual en dag: något bolagsspecifikt hände – eller brus."],
    formula: String.raw`R_i = \beta_{i1}F_1 + \dots + \beta_{ik}F_k + \varepsilon_i`,
    related: ["pca", "s-score", "beta"], learn: "kvant",
  },
  {
    id: "s-score", title: "s-score (Avellaneda–Lee)", en: "s-score", kind: "Mått",
    what: "Hur långt en akties bolagsspecifika del (residualen efter faktorerna) ligger från sitt jämviktsläge, mätt i standardavvikelser. Samma idé som z-score för ett par, fast mot hela marknaden.",
    why: "Avellaneda och Lee (2010) visade att man kan göra stat arb på alla aktier samtidigt: köp de som är billiga relativt sina faktorer, blanka de som är dyra, och hedga bort faktorerna.",
    interpret: ["s < −1,25: aktien är billig relativt marknad och sektor → köpsignal i artikeln.", "s > +1,25: dyr → blanka.", "Stäng när s är tillbaka nära 0 (artikeln: −0,5 respektive +0,75).", "Bara aktier med snabb återgång (half-life under ca 30 dagar) räknas."],
    formula: String.raw`dX_t = \kappa(m - X_t)\,dt + \sigma\,dW_t,\quad s = \frac{X_T - m}{\sigma_{eq}},\ \sigma_{eq} = \frac{\sigma}{\sqrt{2\kappa}}`,
    symbols: [[String.raw`X_t`, "kumulerad residual de senaste 60 dagarna"], [String.raw`\kappa`, "hastighet för återgång (per år)"], ["m", "jämviktsnivå"]],
    example: (c) => has(c, "name", "s") ? `${c.name} har s = ${fmt(c.s, 2)}${Math.abs(c.s) >= 1.25 ? (c.s < 0 ? " – billig relativt faktorerna." : " – dyr relativt faktorerna.") : " – ingen signal."}` : null,
    related: ["factor-model", "zscore", "half-life", "pca"], learn: "kvant",
  },
  {
    id: "vol-clustering", title: "Volatilitetskluster", en: "volatility clustering", kind: "Grundbegrepp",
    what: "Lugna dagar följs oftast av lugna dagar och stormiga av stormiga. Volatiliteten kommer i vågor.",
    why: "Det betyder att risk går att förutsäga någorlunda på kort sikt (det är grunden för GARCH-modeller), och att en strategi kan se säker ut i lugna perioder och sedan få alla förluster på en gång.",
    interpret: ["Toppar som slår till i alla aktier samtidigt = marknadskris (t.ex. mars 2020).", "Topp i en enda aktie = bolagsspecifik händelse (rapport, bud)."],
    related: ["volatility", "fat-tails", "avg-correlation"], learn: "marknad",
  },
];

export const QUANT2_EXTRAS: Record<string, Extra> = {
  "corr-matrix": { track: "kvant", view: CORR, analogy: "Som en tabell över vilka elever som brukar räcka upp handen samtidigt – den säger vem som reagerar lika, inte vem som får bäst betyg.", worked: "SEB–Swedbank 0,78, SEB–AstraZeneca 0,15. En portfölj med SEB och Swedbank är nästan en enda bankposition; SEB och AstraZeneca diversifierar." },
  "avg-correlation": { track: "kvant", view: CORR, analogy: "Hur mycket en folkmassa rör sig i takt. På en konsert hoppar alla samtidigt (hög korrelation); på en tågstation går alla åt olika håll.", worked: "Vintern 2020: snittkorrelationen ca 0,35. Mars 2020: över 0,7. En portfölj med 15 aktier föll då nästan lika mycket som indexet." },
  clustering: { track: "kvant", view: CORR, analogy: "Att placera gäster vid bord så att de som känner varandra sitter tillsammans.", worked: "Först slås SEB och Swedbank ihop (ρ 0,8), sedan Handelsbanken och Nordea till dem, sedan Investor och Industrivärden – och plötsligt syns ett \"finansblock\"." },
  backtest: { track: "kvant", view: BT, analogy: "Att provköra ett recept med förra årets ingredienser – men utan att veta hur rätten skulle smaka innan du bestämmer kryddningen.", worked: "Regler: köp spreaden vid z ≤ −2, stäng vid −0,5, 10 bp kostnad. Resultat 2021–2026: +18 %, Sharpe 0,6, största nedgång −9 %, 23 affärer." },
  "out-of-sample": { track: "kvant", view: BT, analogy: "Plugga på gamla tentor (in-sample) och skriv sedan en tenta du aldrig sett (out-of-sample). Bara den andra visar vad du kan.", worked: "Par valda på 2019–2023 med p < 0,05: Sharpe 1,4 under samma period. Handlade 2024–2026: Sharpe 0,2. De flesta \"bra\" paren var slump." },
  "transaction-costs": { track: "kvant", view: BT, analogy: "Som växlingsavgiften på semestern: liten varje gång, men byter du pengar tio gånger om dagen är semesterkassan snart borta.", worked: "50 affärer per år × 4 transaktioner × 10 bp = 20 % av kapitalet i kostnad per år (räknat på bruttoexponeringen). Strategin måste tjäna mer än så för att gå plus." },
  pca: { track: "kvant", view: PCA, analogy: "Som att beskriva vädret: med temperatur, vind och nederbörd förklarar man det mesta, fast det finns hundra mätvärden.", worked: "30 aktier, 1 år: PC1 förklarar 38 % (alla upp eller ner), PC2 8 % (cykliska mot defensiva), PC3 6 %. Resten är mest bolagsspecifikt brus." },
  eigenportfolio: { track: "kvant", view: PCA, analogy: "Ett recept: PC1 är \"lite av allt\", PC2 är \"mycket verkstad, minus banker\".", worked: "PC2-laddningar: Sandvik +0,30, Atlas +0,28 … SEB −0,25, Swedbank −0,27. En dag när PC2 stiger går verkstad bättre än banker." },
  "marchenko-pastur": { track: "kvant", view: PCA, analogy: "Om du kastar 30 tärningar många gånger kommer vissa att råka visa samma sak ofta – gränsen säger hur mycket \"samvariation\" ren tur kan skapa.", worked: "N = 30, T = 252: λ₊ = (1 + √0,119)² = 1,81. Egenvärden 11,2, 2,4, 1,9 ligger över – tre verkliga faktorer. Resten är brus." },
  "factor-model": { track: "kvant", view: PCA, analogy: "En båt på havet: vågorna (faktorerna) lyfter alla båtar, men varje båt har också sin egen motor (residualen).", worked: "Volvo idag +2,1 %. Faktorerna förklarar +1,4 % (marknaden +1 %, verkstad +0,4 %). Residual: +0,7 % – det som är Volvos eget." },
  "s-score": { track: "kvant", view: PCA, analogy: "Hunden och ägaren igen – men nu är \"ägaren\" hela marknaden och sektorn, inte en enda annan aktie.", worked: "Ericssons residual har fallit 4 % på två veckor; jämviktsspridning 2,5 % → s = −1,6. Signal: köp Ericsson, sälj motsvarande mängd faktorportföljer." },
  "vol-clustering": { track: "marknad", view: MKT, analogy: "Som jordskalv: efter ett stort skalv kommer efterskalv. Det blir inte lugnt direkt.", worked: "Mars 2020 låg OMXS30-aktiernas 21-dagarsvolatilitet på 50–90 % per år, mot normala 20–30 %. Det tog flera månader innan den var tillbaka." },
};


