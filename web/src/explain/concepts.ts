/**
 * Förklaringslagret. Varje begrepp i appen har en post här; ⓘ-knappar, ordlistan och kursen
 * läser alla från samma källa. Texterna är skrivna för någon utan förkunskaper i kvantfinans.
 */
import { fmt, fmtDays, fmtP, fmtPct } from "../lib/format";
import type { Concept, Ctx } from "./types";
import { MARKET_CONCEPTS } from "./concepts-market";
import { PE_CONCEPTS } from "./concepts-pe";
import { AKTIE_CONCEPTS } from "./concepts-aktie";
import { IB_CONCEPTS } from "./concepts-ib";

const has = (c: Ctx, ...keys: string[]) => keys.every((k) => c[k] !== undefined && c[k] !== null);
const pair = (c: Ctx) => `${c.A}/${c.B}`;

const list: Concept[] = [
  // ───────────────────────────── Grundbegrepp ─────────────────────────────
  {
    id: "normalized-prices",
    title: "Normaliserade kurser",
    en: "rebased prices",
    kind: "Graf",
    what: "Båda aktiernas kurser omräknade så att de startar på 100 samma dag. Då ser man hur de rört sig relativt varandra, oavsett om den ena kostar 30 kr och den andra 800 kr.",
    why: "Pairs trading bygger på att två aktier följs åt. Den här grafen är första ögonkastet: rör de sig i samma takt, och kommer de tillbaka till varandra efter att ha glidit isär?",
    interpret: [
      "Linjer som korsar varandra om och om igen är ett gott tecken – avståndet verkar dras tillbaka.",
      "Linjer som glider isär och aldrig kommer tillbaka tyder på att något har ändrats i bolagen (en **regimskift**).",
      "Att linjerna har samma lutning räcker inte: två aktier som båda stiger 10 % per år kan ändå glida isär för alltid.",
    ],
    formula: String.raw`\tilde P_t = 100 \cdot \frac{P_t}{P_0}`,
    symbols: [[String.raw`P_t`, "justerad stängningskurs dag t"], [String.raw`P_0`, "kursen första dagen i fönstret"]],
    example: (c) => has(c, "A", "B", "retA", "retB")
      ? `Under fönstret har ${c.A} gått ${fmtPct(c.retA, 1, true)} och ${c.B} ${fmtPct(c.retB, 1, true)}. Skillnaden i slutet säger lite – det intressanta är om gapet har öppnats och stängts flera gånger på vägen.`
      : null,
    related: ["log-price", "spread", "corr-vs-coint"],
    learn: "returns",
  },
  {
    id: "log-price",
    title: "Logaritmerade priser",
    en: "log prices",
    kind: "Grundbegrepp",
    what: "Naturliga logaritmen av kursen, $\\ln P_t$. En förändring på 0,01 i log-pris motsvarar ungefär 1 % kursändring, oavsett kursnivå.",
    why: "All parstatistik i Quant Lab görs på log-priser. Då betyder hedge ratio att man jämför **procentuella** rörelser, och en aktie som kostar 800 kr väger inte tyngre än en som kostar 30 kr.",
    interpret: [
      "Skillnaden mellan två log-priser är log-kvoten: $\\ln P^A - \\ln P^B = \\ln(P^A/P^B)$.",
      "Log-avkastning $r_t = \\ln(P_t/P_{t-1})$ är nästan samma sak som vanlig avkastning för små rörelser.",
    ],
    formula: String.raw`r_t = \ln P_t - \ln P_{t-1} = \ln\frac{P_t}{P_{t-1}}`,
    symbols: [[String.raw`r_t`, "log-avkastning dag t"], [String.raw`\ln`, "naturliga logaritmen"]],
    related: ["hedge-ratio", "spread"],
    learn: "returns",
  },
  {
    id: "correlation",
    title: "Korrelation",
    en: "correlation",
    kind: "Mått",
    what: "Ett tal mellan −1 och +1 som mäter hur väl två aktiers **dagliga avkastningar** rör sig ihop. +1 = alltid samma riktning, 0 = inget samband, −1 = alltid motsatt.",
    why: "Hög korrelation är en naturlig första sållning: par som inte ens rör sig ihop dag för dag är sällan bra kandidater. Men korrelation säger inget om huruvida kurserna håller ihop **över tid** – det mäter samintegration.",
    interpret: [
      "Över 0,7 räknas som hög för svenska storbolag; banker sinsemellan ligger ofta där.",
      "0,3–0,7: måttlig – vanligt mellan bolag i olika branscher som ändå följer börsen.",
      "Korrelation ändras med tiden och stiger nästan alltid i kriser (allt faller samtidigt).",
    ],
    formula: String.raw`\rho_{AB} = \frac{\operatorname{Cov}(r^A, r^B)}{\sigma_A\,\sigma_B}`,
    symbols: [[String.raw`r^A, r^B`, "dagliga log-avkastningar"], [String.raw`\sigma`, "standardavvikelse"], [String.raw`\operatorname{Cov}`, "kovarians"]],
    example: (c) => has(c, "A", "B", "corr")
      ? `Korrelationen mellan ${c.A} och ${c.B} är ${fmt(c.corr, 2)} i det valda fönstret. ${c.corr > 0.7 ? "Det är högt – de reagerar på samma nyheter." : c.corr > 0.4 ? "Det är måttligt." : "Det är lågt – var extra skeptisk om testet ändå säger samintegration."}`
      : null,
    pitfalls: [{ title: "Korrelation ≠ samintegration", text: "Se begreppet nedan. Två aktier kan ha korrelation 0,9 och ändå glida isär för alltid." }],
    related: ["corr-vs-coint", "cointegration"],
    learn: "correlation",
  },
  {
    id: "corr-vs-coint",
    title: "Korrelation är inte samintegration",
    en: "correlation vs cointegration",
    kind: "Fallgrop",
    what: "Korrelation mäter om **dagliga rörelser** sammanfaller. Samintegration mäter om **avståndet mellan kurserna** hålls inom ett band över tid. Det ena följer inte av det andra.",
    why: "Pairs trading tjänar pengar på att avståndet går tillbaka. Det kräver samintegration. Många nybörjare väljer par efter hög korrelation och förlorar när paret glider isär.",
    interpret: [
      "Tänk på en hundägare och en hund i koppel: de kan gå åt olika håll från sekund till sekund (låg korrelation), men kopplet håller dem ihop (samintegration).",
      "Två hundar utan koppel som springer åt samma håll: hög korrelation, men inget som hindrar att de hamnar långt ifrån varandra.",
    ],
    example: (c) => has(c, "A", "B", "corr", "p")
      ? `${pair(c)}: korrelation ${fmt(c.corr, 2)}, Engle-Granger p = ${fmtP(c.p)}. ${c.corr > 0.6 && c.p > 0.1 ? "Ett typexempel: hög korrelation men ingen samintegration." : c.corr < 0.4 && c.p < 0.05 ? "Omvänt fall: låg korrelation men testet säger samintegration – kontrollera att det inte är en slump." : "Här pekar de två måtten åt samma håll."}`
      : null,
    related: ["correlation", "cointegration"],
    learn: "cointegration",
  },

  // ───────────────────────────── Stationäritet & tester ─────────────────────────────
  {
    id: "stationarity",
    title: "Stationäritet",
    en: "stationarity",
    kind: "Grundbegrepp",
    what: "En tidsserie är stationär om dess medelvärde och spridning inte ändras över tid – den svänger runt en fast nivå. Aktiekurser är **inte** stationära; de vandrar iväg.",
    why: "Man kan bara handla på att något \"går tillbaka till det normala\" om det finns en stabil normalnivå. Hela pairs trading går ut på att hitta en kombination av två icke-stationära kurser som tillsammans blir stationär.",
    interpret: [
      "Stationär serie: korsar sitt medelvärde ofta, avvikelser är tillfälliga.",
      "Icke-stationär (slumpvandring): kan ligga över eller under sin startnivå i år, inget drar tillbaka den.",
      "Testas med ADF-testet.",
    ],
    related: ["adf", "cointegration", "hurst"],
    learn: "stationarity",
  },
  {
    id: "p-value",
    title: "p-värde",
    en: "p-value",
    kind: "Grundbegrepp",
    what: "Sannolikheten att få ett minst lika extremt testresultat **om nollhypotesen vore sann**. I ADF och Engle-Granger är nollhypotesen \"ingen mean reversion\".",
    why: "p-värdet är det vanligaste sättet att sålla par. Lågt p-värde = det är osannolikt att spreaden ser så stabil ut av ren slump.",
    interpret: [
      "p < 0,01: starkt belägg. p < 0,05: konventionell gräns för \"signifikant\". p > 0,10: inget belägg.",
      "p-värdet är **inte** sannolikheten att paret är samintegrerat.",
      "Testar man 435 par väntar man sig ~22 med p < 0,05 helt av slump – se multipel testning.",
    ],
    formula: String.raw`p = \Pr\left(T \le t_{\text{obs}} \mid H_0\right)`,
    symbols: [[String.raw`T`, "teststatistikan som slumpvariabel"], [String.raw`t_{\text{obs}}`, "värdet vi faktiskt fick"], [String.raw`H_0`, "nollhypotesen (enhetsrot / ingen samintegration)"]],
    pitfalls: [{ title: "p-hacking", text: "Byter man fönster, riktning och par tills p < 0,05 har man i praktiken testat många gånger och p-värdet betyder inte längre vad det säger." }],
    related: ["multiple-testing", "adf", "cointegration"],
    learn: "stationarity",
  },
  {
    id: "adf",
    title: "ADF-test",
    en: "Augmented Dickey-Fuller",
    kind: "Test",
    what: "Ett statistiskt test för om en serie är stationär. Det skattar hur starkt gårdagens nivå drar dagens förändring tillbaka mot medel.",
    why: "Vi kör ADF på **spreaden**. Är spreaden stationär finns en normalnivå att handla tillbaka mot.",
    interpret: [
      "Teststatistiken är negativ. Ju mer negativ, desto starkare mean reversion.",
      "Jämför med de kritiska värdena: under 5 %-värdet (ca −2,86) → förkasta enhetsrot på 5 %-nivån.",
      "\"Augmented\" = laggade förändringar läggs till för att ta bort autokorrelation; antalet väljs automatiskt med AIC.",
    ],
    formula: String.raw`\Delta s_t = c + \gamma\, s_{t-1} + \sum_{i=1}^{p}\phi_i\,\Delta s_{t-i} + \varepsilon_t,\qquad H_0:\ \gamma = 0`,
    symbols: [
      [String.raw`\Delta s_t`, "förändringen i spreaden dag t"],
      [String.raw`\gamma`, "dragkraften tillbaka; negativ om mean-reverting"],
      [String.raw`p`, "antal laggar (väljs med AIC)"],
      [String.raw`\text{ADF} = \hat\gamma / \operatorname{SE}(\hat\gamma)`, "teststatistikan"],
    ],
    example: (c) => has(c, "adf", "adfP", "adfCrit5")
      ? `ADF på spreaden för ${pair(c)}: statistik ${fmt(c.adf, 2)} mot 5 %-gränsen ${fmt(c.adfCrit5, 2)}, p = ${fmtP(c.adfP)}. ${c.adfP < 0.05 ? "Spreaden ser stationär ut." : "Vi kan inte förkasta att spreaden är en slumpvandring."}`
      : null,
    pitfalls: [
      { title: "Fel p-värde på skattad spread", text: "När hedge ratio är skattad med OLS blir residualerna \"för bra\" och vanliga ADF-p-värden för optimistiska. Därför använder Engle-Granger andra kritiska värden (MacKinnon, N=2). ADF-rutan här visar det vanliga p-värdet som jämförelse." },
      { title: "Låg styrka", text: "ADF har svårt att skilja långsam mean reversion från slumpvandring på kort data. Ett högt p-värde på 1 år betyder inte att paret är dåligt – bara att beläggen är svaga." },
    ],
    related: ["stationarity", "cointegration", "p-value"],
    learn: "stationarity",
  },
  {
    id: "cointegration",
    title: "Samintegration (Engle-Granger)",
    en: "cointegration",
    kind: "Test",
    what: "Två icke-stationära kurser är samintegrerade om någon kombination av dem, $\\ln P^A - \\beta \\ln P^B$, är stationär. Engle-Granger testar det i två steg: skatta $\\beta$ med OLS, kör sedan ADF på residualerna.",
    why: "Det här är det centrala testet i pairs trading. Samintegration betyder att det finns en ekonomisk \"fjäder\" mellan aktierna som drar ihop dem när de glider isär.",
    interpret: [
      "p < 0,05: kandidat. p < 0,01: stark kandidat – men kolla stabilitet och q-värde.",
      "Testet är inte symmetriskt: A mot B kan ge annat p-värde än B mot A. Quant Lab väljer riktningen med lägst p som standard.",
      "Kritiska värden kommer från MacKinnon (2010) för två serier – strängare än vanlig ADF (5 % ≈ −3,34 i stället för −2,86).",
    ],
    formula: String.raw`\begin{aligned}&\text{Steg 1: } \ln P^A_t = \alpha + \beta\ln P^B_t + \varepsilon_t \\ &\text{Steg 2: ADF på } \hat\varepsilon_t \text{ utan konstant}\end{aligned}`,
    symbols: [[String.raw`\beta`, "hedge ratio"], [String.raw`\hat\varepsilon_t`, "spreaden (residualerna)"], [String.raw`\alpha`, "konstant (nivåskillnad)"]],
    example: (c) => has(c, "A", "B", "p")
      ? `Engle-Granger för ${pair(c)} (${c.windowLabel ?? "valt fönster"}): p = ${fmtP(c.p)}${c.q != null ? `, q = ${fmtP(c.q)}` : ""}. ${c.p < 0.01 ? "Starkt belägg i det här fönstret." : c.p < 0.05 ? "Signifikant på 5 %-nivån, men inte överväldigande." : "Inget statistiskt belägg för samintegration."}${c.stab != null ? ` Paret har varit signifikant i ${fmtPct(c.stab, 0)} av de rullande 1-årsfönstren senaste 5 åren.` : ""}`
      : null,
    pitfalls: [
      { title: "Multipel testning", text: "Med 435 par hittar man alltid några med lågt p-värde av slump. Titta på q-värdet och stabiliteten." },
      { title: "Regimskiften", text: "Ett förvärv, en ny affärsmodell eller en kris kan bryta sambandet permanent. Samintegration i historiken garanterar inget framåt." },
    ],
    related: ["adf", "hedge-ratio", "johansen", "multiple-testing", "stability"],
    learn: "cointegration",
  },
  {
    id: "johansen",
    title: "Johansen-test",
    en: "Johansen test",
    kind: "Test",
    what: "Ett alternativt samintegrationstest som behandlar båda aktierna symmetriskt (ingen behöver vara \"beroende variabel\"). Det räknar hur många oberoende samintegrerande samband som finns.",
    why: "Som komplement till Engle-Granger: om båda testerna är överens är resultatet mer trovärdigt. Johansen klarar också fler än två serier (korgar).",
    interpret: [
      "Trace-test r = 0: förkasta (statistik > kritiskt värde) → minst ett samband finns.",
      "Trace-test r ≤ 1: bör **inte** förkastas för ett par; förkastas båda tyder det på att serierna själva är stationära.",
      "Den samintegrerande vektorn ger en hedge ratio att jämföra med OLS.",
    ],
    formula: String.raw`\Delta Y_t = \Pi Y_{t-1} + \Gamma_1 \Delta Y_{t-1} + \mu + \varepsilon_t,\quad \text{Trace}(r) = -T\sum_{i=r+1}^{2}\ln(1-\hat\lambda_i)`,
    symbols: [
      [String.raw`Y_t`, "vektor med båda log-priserna"],
      [String.raw`\Pi`, "matris vars rang = antal samband"],
      [String.raw`\hat\lambda_i`, "egenvärden, sorterade"],
      [String.raw`T`, "antal observationer"],
    ],
    example: (c) => has(c, "joh0", "joh0c")
      ? `Trace-statistik för r = 0: ${fmt(c.joh0, 1)} mot kritiskt värde ${fmt(c.joh0c, 1)} (95 %). ${c.joh0 > c.joh0c ? "Johansen hittar ett samband" : "Johansen hittar inget samband"}${has(c, "p") ? (((c.joh0 > c.joh0c) === (c.p < 0.05)) ? " – samma slutsats som Engle-Granger." : " – motsatt slutsats mot Engle-Granger, vilket är en varningssignal.") : "."}`
      : null,
    related: ["cointegration"],
    learn: "cointegration",
  },

  // ───────────────────────────── Mean reversion ─────────────────────────────
  {
    id: "half-life",
    title: "Half-life (Ornstein-Uhlenbeck)",
    en: "half-life of mean reversion",
    kind: "Mått",
    what: "Hur många handelsdagar det i genomsnitt tar för en avvikelse i spreaden att halveras. Skattas genom att anpassa en Ornstein-Uhlenbeck-process, en matematisk modell för något som dras mot ett medelvärde.",
    why: "Den gör samintegration praktisk. Ett par kan vara statistiskt samintegrerat men så långsamt att man binder kapital i ett år per affär – eller så snabbt att transaktionskostnaderna äter vinsten.",
    interpret: [
      "Under 3 dagar: misstänkt snabbt – ofta brus eller datafel; svårt att handla efter kostnader.",
      "5–30 dagar: praktiskt tradebart – tillräckligt många affärer per år och kort tid med risk.",
      "30–60 dagar: möjligt men kapitalkrävande och mer utsatt för regimskiften.",
      "∞: ingen mean reversion alls i det här fönstret.",
      "Tumregel: sätt z-scorefönstret till ungefär 1–3 × half-life.",
    ],
    formula: String.raw`ds_t = \kappa(\mu - s_t)\,dt + \sigma\,dW_t \;\Rightarrow\; \Delta s_t = a + b\,s_{t-1} + \varepsilon_t,\quad \text{HL} = -\frac{\ln 2}{\ln(1+b)}`,
    symbols: [
      [String.raw`\kappa`, "dragkraftens styrka (hastighet)"],
      [String.raw`\mu`, "långsiktigt medelvärde"],
      [String.raw`b`, "lutning i regressionen; negativ om mean-reverting"],
      [String.raw`dW_t`, "slumpmässiga stötar"],
    ],
    example: (c) => has(c, "hl")
      ? `Half-life för ${pair(c)} är ${fmtDays(c.hl)}. ${!Number.isFinite(c.hl) ? "Spreaden drar inte tillbaka alls i det här fönstret." : c.hl < 3 ? "Väldigt snabbt – misstänk brus." : c.hl <= 30 ? `En avvikelse halveras på ungefär ${Math.round(c.hl)} handelsdagar, dvs. ${c.hl < 10 ? "drygt en vecka" : c.hl < 22 ? "några veckor" : "drygt en månad"}. Det är i det praktiska intervallet.` : "Långsamt – affärerna blir långa och kapitalkrävande."}`
      : null,
    pitfalls: [{ title: "Skattningsosäkerhet", text: "Half-life är brusig. Ändra fönster ett år och den kan dubblas. Lita mer på storleksordningen än på exakta dagar." }],
    related: ["spread", "hurst", "z-window"],
    learn: "meanrev",
  },
  {
    id: "hurst",
    title: "Hurst-exponent",
    en: "Hurst exponent",
    kind: "Mått",
    what: "Ett tal mellan 0 och 1 som beskriver om en serie tenderar att vända (mean reversion), vandra slumpmässigt eller trenda. Mäts genom hur snabbt spridningen växer när man tittar över längre tidshorisonter.",
    why: "Ett oberoende sätt att bekräfta mean reversion som inte bygger på samma antaganden som ADF.",
    interpret: [
      "H < 0,5: mean-reverting – lägre är starkare. Under 0,4 är tydligt.",
      "H ≈ 0,5: slumpvandring – ingen förutsägbarhet.",
      "H > 0,5: trendande – avvikelser tenderar att fortsätta.",
    ],
    formula: String.raw`\operatorname{Std}\left(x_{t+\tau} - x_t\right) \propto \tau^{H}`,
    symbols: [[String.raw`\tau`, "tidshorisont i dagar (2–99)"], [String.raw`H`, "lutningen i en log-log-regression"]],
    example: (c) => has(c, "hurst")
      ? `Hurst för spreaden i ${pair(c)}: ${fmt(c.hurst, 2)}. ${c.hurst < 0.4 ? "Tydligt mean-reverting." : c.hurst < 0.5 ? "Svagt mean-reverting." : "Inte mean-reverting – snarare slumpvandring eller trend."}`
      : null,
    pitfalls: [{ title: "Spreaden är skattad", text: "OLS-spreaden är konstruerad för att se så stabil ut som möjligt i fönstret, så Hurst blir ofta lägre än den kommer vara framåt." }],
    related: ["half-life", "stationarity"],
    learn: "meanrev",
  },

  // ───────────────────────────── Modell / spread ─────────────────────────────
  {
    id: "hedge-ratio",
    title: "Hedge ratio (OLS)",
    en: "hedge ratio",
    kind: "Modell",
    what: "Hur mycket av aktie B man ska blanka för varje krona i aktie A, så att det gemensamma marknadsberoendet tar ut varandra. Skattas med vanlig minsta kvadrat-regression (OLS) på log-priser.",
    why: "Utan rätt hedge ratio är man inte marknadsneutral: om börsen faller tjänar man inte på att spreaden går tillbaka, man förlorar på marknaden.",
    interpret: [
      "β = 1: lika stor procentuell rörelse – köp 1 kr A, blanka 1 kr B.",
      "β = 0,5: A rör sig hälften så mycket som B – blanka 0,5 kr B per krona A.",
      "Negativt β är ovanligt för ett par och tyder ofta på en slumpträff.",
      "Statisk OLS över hela fönstret **använder framtida data** – bra för analys, inte för backtest.",
    ],
    formula: String.raw`\ln P^A_t = \alpha + \beta\,\ln P^B_t + \varepsilon_t, \qquad \hat\beta = \frac{\operatorname{Cov}(\ln P^A, \ln P^B)}{\operatorname{Var}(\ln P^B)}`,
    symbols: [[String.raw`\beta`, "hedge ratio"], [String.raw`\alpha`, "konstant"], [String.raw`\varepsilon_t`, "residual = spreaden"]],
    example: (c) => has(c, "A", "B", "beta")
      ? `För ${pair(c)} är OLS-β = ${fmt(c.beta, 2)}: för varje 10 000 kr i ${c.A} blankar man ca ${fmt(Math.abs(c.beta) * 10000, 0)} kr i ${c.B}.`
      : null,
    pitfalls: [{ title: "Look-ahead", text: "En hedge ratio skattad på hela perioden vet hur framtiden såg ut. I backtesten används därför rullande OLS eller Kalman." }],
    related: ["kalman", "spread", "look-ahead"],
    learn: "pairs",
  },
  {
    id: "kalman",
    title: "Kalmanfilter",
    en: "Kalman filter",
    kind: "Modell",
    what: "En metod som uppdaterar hedge ratio en dag i taget: varje ny observation flyttar skattningen lite, mer om den är överraskande. Resultatet är ett β som får variera över tid.",
    why: "Relationen mellan två bolag ändras – affärsmix, skuldsättning, valuta. En fast β från för fem år sedan kan vara fel idag. Kalmanfiltret anpassar sig utan att man behöver välja ett fönster, och använder bara data fram till idag.",
    interpret: [
      "Jämför med OLS: ligger Kalman-β nära den streckade OLS-linjen är relationen stabil.",
      "Ett β som driver iväg kraftigt betyder att relationen har ändrats – var försiktig.",
      "Filtret startar med en OLS-skattning på fönstrets första 60 dagar; de dagarna visas inte och ger inga signaler.",
      "Spreaden blir filtrets prediktionsfel: hur mycket dagens kurs avvek från det gårdagens β förutsade.",
    ],
    formula: String.raw`\begin{aligned}\theta_t &= \theta_{t-1} + w_t, & w_t &\sim N(0, V_w)\\ \ln P^A_t &= [\ln P^B_t,\ 1]\,\theta_t + v_t, & v_t &\sim N(0, V_e)\\ \theta_t &= \theta_{t-1} + K_t\,e_t \end{aligned}`,
    symbols: [
      [String.raw`\theta_t = [\beta_t, \alpha_t]`, "dolt tillstånd: hedge ratio och konstant"],
      [String.raw`V_w = \tfrac{\delta}{1-\delta} I`, "hur mycket θ får ändras per dag"],
      [String.raw`e_t`, "prediktionsfel: överraskningen idag"],
      [String.raw`K_t`, "Kalman gain: hur mycket överraskningen får flytta skattningen"],
    ],
    example: (c) => has(c, "kalmanBeta", "beta")
      ? `Kalman-β för ${pair(c)} är idag ${fmt(c.kalmanBeta, 2)} mot OLS ${fmt(c.beta, 2)}. ${Math.abs(c.kalmanBeta - c.beta) > 0.2 * Math.abs(c.beta) ? "Stor skillnad – relationen har förändrats över fönstret." : "Nära varandra – relationen ser stabil ut."}`
      : null,
    pitfalls: [{ title: "δ är en parameter att överanpassa", text: "Väljer man δ som ger bäst backtest har man smugit in look-ahead via parametervalet." }],
    related: ["kalman-delta", "hedge-ratio", "rolling-window"],
    learn: "pairs",
  },
  {
    id: "kalman-delta",
    title: "Kalman δ (anpassningshastighet)",
    en: "transition covariance",
    kind: "Parameter",
    what: "Styr hur snabbt Kalmanfiltrets hedge ratio får ändras. Litet δ = trögt och stabilt, stort δ = följsamt men brusigt.",
    why: "Avvägningen mellan att reagera på verkliga förändringar och att jaga brus.",
    interpret: [
      "10⁻⁹–10⁻⁸: nästan konstant β, liknar OLS.",
      "10⁻⁷: standard i Quant Lab – β följer långsamma förändringar över månader.",
      "10⁻⁵ och uppåt: β jagar varje rörelse. Spreaden blir liten och ser perfekt stationär ut – men det är en illusion.",
    ],
    pitfalls: [{ title: "Ett för snabbt filter gör allt stationärt", text: "Med stort δ anpassar sig β så snabbt att spreaden bara blir dagens överraskning. Då klarar även helt orelaterade aktier ADF-testet med p ≈ 0 och half-life under en dag. Testa själv: välj Ericsson/Volvo och dra upp δ. Samintegration ska testas med statisk OLS, inte med Kalman-spreaden." }],
    formula: String.raw`V_w = \frac{\delta}{1-\delta}\, I`,
    symbols: [[String.raw`\delta`, "anpassningsparameter"], [String.raw`I`, "enhetsmatris"]],
    related: ["kalman"],
  },
  {
    id: "rolling-window",
    title: "Rullande fönster",
    en: "rolling window",
    kind: "Parameter",
    what: "Att räkna ett mått på bara de senaste L dagarna, och flytta fönstret en dag framåt i taget. Varje dag använder alltså enbart historik.",
    why: "Undviker look-ahead och låter måttet anpassa sig om förhållandena ändras.",
    interpret: [
      "Kort fönster (20–60 d): snabb anpassning, mycket brus.",
      "Långt fönster (250 d+): stabilt men reagerar sent på förändringar.",
    ],
    related: ["look-ahead", "kalman", "z-window"],
  },
  {
    id: "spread",
    title: "Spread",
    en: "spread",
    kind: "Modell",
    what: "Avståndet mellan aktierna efter hedge: $s_t = \\ln P^A_t - \\alpha - \\beta\\,\\ln P^B_t$. Det är den här serien man faktiskt handlar.",
    why: "Om spreaden är stationär (svänger runt ett medelvärde) kan man köpa den när den är låg och sälja när den är hög.",
    interpret: [
      "Positiv spread: A är dyr relativt B. Negativ: A är billig relativt B.",
      "Banden visar ±1 och ±2 standardavvikelser från medel.",
      "En spread som trendar iväg utan att komma tillbaka = sambandet är brutet.",
    ],
    formula: String.raw`s_t = \ln P^A_t - \alpha_t - \beta_t\,\ln P^B_t`,
    symbols: [[String.raw`\beta_t, \alpha_t`, "hedge ratio och konstant (fasta för OLS, tidsvarierande för rullande/Kalman)"]],
    example: (c) => has(c, "A", "B", "zNow")
      ? `Spreaden för ${pair(c)} ligger nu ${fmt(Math.abs(c.zNow), 1)} standardavvikelser ${c.zNow > 0 ? "över" : "under"} sitt rullande medel: ${c.A} är ${c.zNow > 0 ? "dyr" : "billig"} relativt ${c.B}.`
      : null,
    related: ["zscore", "hedge-ratio", "stationarity"],
    learn: "pairs",
  },
  {
    id: "zscore",
    title: "Z-score",
    en: "z-score",
    kind: "Mått",
    what: "Hur många standardavvikelser spreaden ligger från sitt medelvärde de senaste L dagarna. Gör spreaden jämförbar mellan par och över tid.",
    why: "Handelsreglerna uttrycks i z-score: \"gå in vid ±2, gå ur vid 0,5\". Då betyder samma regel samma sak för alla par.",
    interpret: [
      "|z| < 1: normalt brus.",
      "|z| ≈ 2: ovanligt – inträffar ~5 % av tiden om spreaden är normalfördelad.",
      "|z| > 3: extremt – antingen ett fint läge eller tecken på att sambandet har brutits.",
    ],
    formula: String.raw`z_t = \frac{s_t - \bar s_{t,L}}{\sigma_{t,L}}`,
    symbols: [[String.raw`\bar s_{t,L}`, "medel av spreaden dag t−L+1 … t"], [String.raw`\sigma_{t,L}`, "standardavvikelse i samma fönster"], [String.raw`L`, "z-scorefönster"]],
    example: (c) => has(c, "zNow", "entry")
      ? `Senaste z-score för ${pair(c)}: ${fmt(c.zNow, 2)}. ${Math.abs(c.zNow) >= c.entry ? `Det är bortom ingångströskeln ±${fmt(c.entry, 1)} – strategin skulle ${c.zNow > 0 ? "sälja" : "köpa"} spreaden.` : `Innanför ingångströskeln ±${fmt(c.entry, 1)} – ingen ny position.`}`
      : null,
    pitfalls: [{ title: "Fet svans", text: "Spreadar är sällan normalfördelade. ±3σ händer betydligt oftare än 0,3 % av tiden, särskilt vid regimskiften." }],
    related: ["spread", "z-window", "entry-threshold"],
    learn: "pairs",
  },
  {
    id: "z-window",
    title: "Z-scorefönster",
    en: "lookback",
    kind: "Parameter",
    what: "Antal dagar som medel och standardavvikelse för z-scoren räknas över.",
    why: "Bestämmer vad som räknas som \"normalt\". För kort fönster gör att z alltid ser normal ut; för långt reagerar inte på förändringar.",
    interpret: ["Tumregel: 1–3 × half-life.", "Vanliga val: 20, 60 eller 120 dagar."],
    example: (c) => has(c, "zWindow", "hl")
      ? `Du använder ${c.zWindow} dagar. Med half-life ${fmtDays(c.hl)} vore ${Number.isFinite(c.hl) ? `${Math.round(c.hl)}–${Math.round(3 * c.hl)} dagar` : "ett kort fönster – men utan mean reversion spelar det mindre roll"} en rimlig startpunkt.`
      : null,
    related: ["zscore", "half-life"],
  },
  {
    id: "entry-threshold",
    title: "Ingångströskel",
    en: "entry threshold",
    kind: "Parameter",
    what: "Hur långt ifrån medel (i z-score) spreaden måste gå innan man öppnar en position.",
    why: "Högre tröskel = färre men säkrare affärer. Lägre = fler affärer, mer kostnader, mindre marginal per affär.",
    interpret: ["±2,0 är branschstandard att börja med.", "Under ±1,5 äter kostnaderna ofta upp vinsten.", "Över ±3 blir det få affärer och mycket regimrisk."],
    formula: String.raw`\text{Position}_{t} = \begin{cases} +1 & z_t \le -z_{\text{in}} \ (\text{köp } A,\ \text{sälj } \beta B)\\ -1 & z_t \ge z_{\text{in}} \ (\text{sälj } A,\ \text{köp } \beta B)\end{cases}`,
    symbols: [[String.raw`z_{\text{in}}`, "ingångströskel"]],
    pitfalls: [{ title: "Överanpassning", text: "Att justera trösklarna tills grafen ser bra ut är exakt hur man överanpassar. Bestäm dem innan du tittar på resultatet, eller använd in-/out-of-sample." }],
    related: ["exit-threshold", "stop-loss", "signals", "overfitting"],
    learn: "pairs",
  },
  {
    id: "exit-threshold",
    title: "Utgångströskel",
    en: "exit threshold",
    kind: "Parameter",
    what: "När |z| har gått tillbaka under den här nivån stängs positionen.",
    why: "0 = vänta tills spreaden är exakt vid medel (maximal vinst per affär, längre affärer). Högre = ta hem vinsten tidigare.",
    interpret: ["0–0,5 är vanligt.", "Utgång måste vara mindre än ingång, annars stängs positionen direkt."],
    related: ["entry-threshold", "stop-loss"],
  },
  {
    id: "stop-loss",
    title: "Stop-loss",
    en: "stop-loss",
    kind: "Parameter",
    what: "Stänger positionen om spreaden fortsätter åt fel håll förbi en extrem nivå, t.ex. |z| ≥ 4.",
    why: "Skydd mot regimskiften: om sambandet har brutits kommer spreaden aldrig tillbaka, och utan stop kan förlusten bli obegränsad.",
    interpret: ["Typiskt 3,5–5.", "Efter en stop öppnar Quant Lab ingen ny position förrän |z| har gått under ingångströskeln igen."],
    related: ["entry-threshold", "regime-shift"],
  },
  {
    id: "signals",
    title: "Köp- och säljsignaler",
    en: "trading signals",
    kind: "Strategi",
    what: "Markeringar i z-scoregrafen där strategin skulle öppna eller stänga en position. ▲ = köp spreaden (köp A, blanka B), ▼ = sälj spreaden, ● = stäng, ✕ = stop-loss.",
    why: "Visar hur reglerna faktiskt beter sig på historiken – hur ofta de handlar och om de fångar svängningarna.",
    interpret: [
      "Signalen räknas på stängningskursen dag t. Positionen tas tidigast dag t+1 – annars handlar man på information man inte hade.",
      "Många signaler i rad åt samma håll som aldrig stängs = spreaden trendar, sambandet håller inte.",
    ],
    example: (c) => has(c, "nTrades")
      ? `Med nuvarande inställningar ger ${pair(c)} ${c.nTrades} affärer i fönstret${c.nStops ? `, varav ${c.nStops} stoppades ut` : ""}.`
      : null,
    related: ["entry-threshold", "look-ahead"],
    learn: "pairs",
  },

  // ───────────────────────────── 3D-labbet ─────────────────────────────
  {
    id: "param-landscape",
    title: "Parameterlandskap",
    en: "parameter sensitivity surface",
    kind: "Graf",
    what: "En 3D-yta där varje punkt är en hel backtest. De två vågräta axlarna är två parametrar (ingångströskel och z-fönster), höjden är Sharpe-kvoten efter kostnader.",
    why: "Det enklaste sättet att se överanpassning med egna ögon. En robust strategi fungerar hyfsat i ett helt område av inställningar. En överanpassad har en enda spik som råkade passa historiken.",
    interpret: [
      "**Platå** = robust. Små ändringar ger ungefär samma resultat.",
      "**Spik** omgiven av dalar = slump. Du har hittat bruset, inte ett mönster.",
      "Jämför in-sample (första halvan) med out-of-sample (andra halvan). Om toppen flyttar sig eller försvinner var den inte verklig.",
      "Sharpe över 1 efter kostnader är bra, över 2 är misstänkt bra för en enkel parstrategi.",
    ],
    formula: String.raw`	ext{Sharpe} = rac{ar r}{\sigma_r}\sqrt{252}`,
    symbols: [[String.raw`ar r`, "genomsnittlig daglig avkastning"], [String.raw`\sigma_r`, "standardavvikelse för daglig avkastning"], [String.raw`\sqrt{252}`, "omräkning till årstakt (252 handelsdagar)"]],
    example: (c) => has(c, "bestIs", "bestOos")
      ? `För ${pair(c)} gav den bästa kombinationen i första halvan Sharpe ${fmt(c.bestIs, 2)}. Exakt samma inställningar i andra halvan: ${fmt(c.bestOos, 2)}. ${c.bestOos < c.bestIs / 2 ? "Ett klassiskt fall av överanpassning – resultatet höll inte." : "Resultatet höll förvånansvärt väl, vilket är ovanligt."}`
      : null,
    pitfalls: [{ title: "Att välja toppen", text: "Väljer du den högsta punkten på in-sample-ytan och rapporterar den som din strategi har du överanpassat per definition. Rapportera alltid out-of-sample." }],
    related: ["overfitting", "entry-threshold", "z-window", "multiple-testing"],
    learn: "pitfalls",
  },
  {
    id: "coint-surface",
    title: "Samintegration i tid och fönster",
    en: "rolling cointegration surface",
    kind: "Graf",
    what: "Engle-Granger-testet kört om och om igen: för varje slutdatum (x-axeln) och varje fönsterlängd (y-axeln). Höjden är −log₁₀ av p-värdet, så högre = starkare samband.",
    why: "En parscanner tittar på ett enda fönster. Den här ytan visar om sambandet är en bestående egenskap hos paret eller något som bara råkade gälla just nu.",
    interpret: [
      "Höjd 1,3 motsvarar p = 0,05 (det gröna planet). Höjd 2 = p 0,01, höjd 3 = p 0,001.",
      "**Bergskedja längs hela tidsaxeln** = stabilt par.",
      "**Enstaka toppar** = sambandet kommer och går – hög risk för regimskiften.",
      "Längre fönster ger starkare test men reagerar sent när ett samband bryts.",
    ],
    formula: String.raw`	ext{höjd} = -\log_{10} p_{	ext{EG}}(t, L)`,
    symbols: [[String.raw`t`, "fönstrets slutdatum"], [String.raw`L`, "fönsterlängd i handelsdagar"], [String.raw`p_{	ext{EG}}`, "Engle-Granger p-värde (bästa riktningen, 1 lagg)"]],
    example: (c) => has(c, "share")
      ? `${pair(c)}: ${fmtPct(c.share, 0)} av alla fönster har p < 0,05. Av ren slump väntar man sig ungefär 5–10 % (båda riktningarna testas).`
      : null,
    related: ["cointegration", "stability", "regime-shift"],
    learn: "cointegration",
  },
  {
    id: "ou-forecast",
    title: "OU-prognoskon",
    en: "Ornstein-Uhlenbeck forecast",
    kind: "Graf",
    what: "Ornstein-Uhlenbeck-modellens prognos för spreaden: för varje dag framåt (x) visar ytan hur sannolika olika z-nivåer (y) är. Kammen är det mest troliga läget.",
    why: "Visar vad mean reversion faktiskt betyder i siffror: hur snabbt väntas spreaden komma tillbaka, och hur stor är osäkerheten på vägen? Det är det man satsar på när man öppnar en position.",
    interpret: [
      "Kammen som svänger in mot z = 0 = spreaden väntas dras tillbaka. Ju brantare, desto kortare half-life.",
      "Konens bredd = osäkerhet. Den växer först och planar sedan ut på den långsiktiga spridningen.",
      "Utan mean reversion breddas konen för evigt utan att svänga in – som en slumpvandring.",
      "Sannolikheterna förutsätter att modellen stämmer. Vid regimskiften gör den inte det.",
    ],
    formula: String.raw`s_{t+h} \mid s_t \sim N\!\left(\mu + (s_t-\mu)arphi^h,\ \sigma^2rac{1-arphi^{2h}}{1-arphi^2}
ight)`,
    symbols: [[String.raw`arphi`, "AR(1)-koefficient; dragkraft = 1 − φ"], [String.raw`\mu`, "långsiktigt medel"], [String.raw`\sigma`, "daglig brusvolatilitet"], [String.raw`h`, "dagar framåt"]],
    example: (c) => has(c, "z0", "in10", "in20")
      ? `${pair(c)} står idag på z = ${fmt(c.z0, 2)}. Enligt modellen är chansen ${fmtPct(c.in10, 0)} att spreaden ligger innanför utgångströskeln om 10 dagar och ${fmtPct(c.in20, 0)} om 20 dagar.`
      : null,
    related: ["half-life", "zscore", "spread"],
    learn: "meanrev",
  },

  // ───────────────────────────── Fallgropar ─────────────────────────────
  {
    id: "look-ahead",
    title: "Look-ahead bias",
    en: "look-ahead bias",
    kind: "Fallgrop",
    what: "När en analys eller backtest använder information som inte fanns tillgänglig vid tidpunkten. Det vanligaste felet i amatörbacktester.",
    why: "Resultaten blir orealistiskt bra. Klassiskt exempel: skatta hedge ratio på hela perioden och sedan \"handla\" i början av perioden med den.",
    interpret: [
      "Quant Lab: signal dag t använder bara data t.o.m. dag t, och positionen tas dag t+1.",
      "Rullande OLS och Kalman är fria från look-ahead. Statisk OLS är det **inte** och markeras med varning.",
      "Även val av par och parametrar efter att ha sett hela historiken är en form av look-ahead.",
    ],
    related: ["overfitting", "hedge-ratio", "survivorship"],
    learn: "pitfalls",
  },
  {
    id: "overfitting",
    title: "Överanpassning",
    en: "overfitting",
    kind: "Fallgrop",
    what: "När en strategi har justerats så mycket mot historiken att den har lärt sig brus i stället för ett verkligt mönster.",
    why: "En överanpassad backtest ser fantastisk ut och förlorar pengar live. Ju fler parametrar och par man provar, desto större risk.",
    interpret: [
      "Skydd: dela datan i in-sample (där du väljer parametrar) och out-of-sample (där du bara testar en gång).",
      "Var misstänksam om resultatet faller kraftigt när en parameter ändras lite.",
    ],
    related: ["multiple-testing", "look-ahead"],
    learn: "pitfalls",
  },
  {
    id: "multiple-testing",
    title: "Multipel testning och q-värde",
    en: "multiple testing, FDR",
    kind: "Fallgrop",
    what: "Ju fler tester man gör, desto fler falska träffar får man. Med 435 par och gränsen p < 0,05 väntar man sig ~22 \"samintegrerade\" par även om inget samband finns. q-värdet (Benjamini-Hochberg) korrigerar för detta.",
    why: "Det är huvudskälet till att par som såg bra ut i en scanner slutar fungera. q-värdet ger den lägsta andel falska upptäckter man måste acceptera för att räkna paret som en träff.",
    interpret: [
      "q < 0,05: under 5 % av träffarna på den nivån väntas vara falska.",
      "I OMXS30 klarar i stort sett inga par q < 0,05 – ett nyktert besked om hur svagt beläggen ofta är.",
      "Kombinera med ekonomisk logik (samma bransch, samma kunder) och stabilitet över tid.",
    ],
    formula: String.raw`q_{(i)} = \min_{j \ge i} \frac{m\,p_{(j)}}{j}`,
    symbols: [[String.raw`p_{(j)}`, "p-värdena sorterade stigande"], [String.raw`m`, "antal test (435)"]],
    example: (c) => has(c, "q", "p")
      ? `${pair(c)} har p = ${fmtP(c.p)} men q = ${fmtP(c.q)} när man tar hänsyn till att alla 435 par testades.`
      : null,
    related: ["p-value", "stability", "overfitting"],
    learn: "pitfalls",
  },
  {
    id: "stability",
    title: "Stabilitet",
    en: "cointegration stability",
    kind: "Mått",
    what: "Andelen rullande 1-årsfönster under de senaste 5 åren (ett nytt fönster varje månad) där paret var samintegrerat med p < 0,05.",
    why: "Ett par som bara är samintegrerat i ett enda fönster är troligen en slump. Ett verkligt ekonomiskt samband borde synas om och om igen.",
    interpret: ["Över 40 %: återkommande samband.", "10–40 %: sporadiskt.", "Under 10 %: troligen slump (5 % väntas av ren tur)."],
    example: (c) => has(c, "stab")
      ? `${pair(c)} var samintegrerat i ${fmtPct(c.stab, 0)} av fönstren.`
      : null,
    related: ["multiple-testing", "regime-shift"],
    learn: "pitfalls",
  },
  {
    id: "regime-shift",
    title: "Regimskifte",
    en: "regime change",
    kind: "Fallgrop",
    what: "När det ekonomiska sambandet mellan två bolag ändras permanent – genom förvärv, avknoppning, ny strategi, kris eller regeländring.",
    why: "Den största risken i pairs trading. Strategin köper mer av förloraren hela vägen ned om sambandet har brutits.",
    interpret: ["Tecken: Kalman-β som driver iväg, z-score som stannar på ±3 eller mer, stop-loss som triggas.", "Exempel i datan: Hexagons avknoppning av Octave 2026 ändrade bolaget."],
    related: ["stop-loss", "kalman", "stability"],
    learn: "pitfalls",
  },
  {
    id: "survivorship",
    title: "Survivorship bias",
    en: "survivorship bias",
    kind: "Fallgrop",
    what: "Quant Lab använder **dagens** OMXS30-lista bakåt i tiden. Bolag som åkt ur indexet, köpts upp eller gått dåligt saknas.",
    why: "Historiken ser bättre ut än verkligheten: vi tittar bara på vinnarna som fortfarande är stora. Par där ett bolag kollapsade finns inte med.",
    interpret: ["Resultat för långa perioder är systematiskt för optimistiska.", "Ett professionellt test använder indexets faktiska sammansättning varje dag."],
    related: ["look-ahead", "overfitting"],
    learn: "pitfalls",
  },
  {
    id: "short-costs",
    title: "Blankningskostnader",
    en: "short-selling costs",
    kind: "Fallgrop",
    what: "Att blanka en aktie kostar: lånavgift (ofta 0,25–1 % per år för storbolag, mycket mer för hårt blankade), plus att man måste betala ut utdelningar.",
    why: "Pairs trading kräver alltid en blankning. Ignorerar man kostnaden ser strategin bättre ut än den är.",
    interpret: ["Lägg till lånekostnad i backtesten.", "Lån kan återkallas med kort varsel – man kan tvingas stänga vid sämsta tillfälle."],
    related: ["signals"],
    learn: "pitfalls",
  },
];

const all = [...list, ...MARKET_CONCEPTS, ...PE_CONCEPTS, ...AKTIE_CONCEPTS, ...IB_CONCEPTS];
export const CONCEPTS: Record<string, Concept> = Object.fromEntries(all.map((c) => [c.id, c]));
export const CONCEPT_LIST = all;
