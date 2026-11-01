/** Investment banking-begrepp. */
import { fmt, fmtPct } from "../lib/format";
import type { Extra } from "./extras";
import type { Concept, Ctx } from "./types";

const has = (c: Ctx, ...k: string[]) => k.every((x) => c[x] != null && !(typeof c[x] === "number" && !Number.isFinite(c[x])));
const FF = { to: "/ib/vardering", label: "Värderingsöversikten" };
const MA = { to: "/ib/ma", label: "M&A-kalkylen" };
const PROC = { to: "/ib/process", label: "Affärsprocessen" };

export const IB_CONCEPTS: Concept[] = [
  {
    id: "investment-banking", title: "Investment banking", en: "investment banking", kind: "Grundbegrepp",
    what: "Den del av en bank som hjälper företag med stora affärer: köpa och sälja bolag (M&A), ta in pengar via börsen (ECM) eller lån och obligationer (DCM).",
    why: "Nästan varje stor affär på börsen – uppköp, nyemissioner, börsnoteringar – har investmentbanker som rådgivare. De värderar bolag, förhandlar och hittar köpare.",
    interpret: ["M&A: rådgivning vid köp och försäljning av bolag.", "ECM (equity capital markets): börsnoteringar och nyemissioner.", "DCM / leveraged finance: lån och obligationer, ofta till PE-köp.", "Banken tar betalt med en avgift, ofta 1–3 % av affärsvärdet."],
    related: ["football-field", "accretion-dilution", "ipo"], learn: "ib",
  },
  {
    id: "football-field", title: "Värderingsöversikt (football field)", en: "football field chart", kind: "Graf",
    what: "Ett diagram med en liggande stapel per värderingsmetod (DCF, multiplar, 52-veckorsintervall, analytiker, uppköpspremie). Varje stapel visar ett intervall, och en linje visar dagens kurs.",
    why: "Standardbilden i varje bankpresentation inför en affär. Ingen metod ger \"rätt\" svar – genom att lägga dem bredvid varandra syns var värdet rimligen ligger.",
    interpret: ["Där flera staplar överlappar ligger det mest rimliga värdet.", "Ligger kursen till vänster om de flesta staplarna ser aktien billig ut.", "Uppköpsstapeln visar vad en köpare typiskt måste betala – oftast till höger om allt annat."],
    example: (c) => has(c, "name", "lo", "hi", "price") ? `För ${c.name} ger metoderna tillsammans ett spann på ca ${fmt(c.lo, 0)}–${fmt(c.hi, 0)} kr mot kursen ${fmt(c.price, 0)} kr.` : null,
    related: ["dcf", "comps", "analyst-target", "bid-premium"], learn: "ib",
  },
  {
    id: "eps", title: "Vinst per aktie (EPS)", en: "earnings per share", kind: "Mått",
    what: "Nettovinsten delat med antalet aktier. Det som varje aktieägare \"äger\" av vinsten.",
    why: "Börsen bryr sig om vinst per aktie – inte total vinst. Ett förvärv som höjer den totala vinsten men kräver många nya aktier kan ändå sänka EPS.",
    interpret: ["Stigande EPS över tid är det som driver aktiekursen långsiktigt.", "P/E = kurs / EPS."],
    formula: String.raw`\text{EPS} = \frac{\text{Nettovinst}}{\text{Antal aktier}}`,
    related: ["pe", "accretion-dilution"], learn: "ib",
  },
  {
    id: "accretion-dilution", title: "Accretion / dilution", en: "accretion / dilution analysis", kind: "Modell",
    what: "Analysen av om ett förvärv höjer (accretive) eller sänker (dilutive) köparens vinst per aktie året efter affären.",
    why: "Det första en styrelse och aktiemarknaden frågar vid ett uppköp. Banker räknar på det i varje M&A-affär.",
    interpret: ["Tumregel vid aktiebetalning: köper du ett bolag med lägre P/E än ditt eget blir det accretive.", "Skuldfinansiering är accretive om målets vinstavkastning (1/P/E) är högre än räntan efter skatt.", "Accretive är inte samma sak som bra – man kan betala för mycket och ändå få högre EPS med billig skuld."],
    formula: String.raw`\text{EPS}_{pf} = \frac{NI_A + NI_B + S(1-t) - \text{finansieringskostnad}}{n_A + n_{\text{nya}}}`,
    symbols: [[String.raw`NI_A, NI_B`, "köparens och målbolagets nettovinst"], [String.raw`S`, "synergier före skatt"], [String.raw`n_{\text{nya}}`, "nyemitterade aktier till säljarna"]],
    example: (c) => has(c, "acc", "acq", "tgt") ? `Om ${c.acq} köper ${c.tgt} med dina antaganden ändras ${c.acq}s vinst per aktie med ${fmtPct(c.acc, 1, true)}.` : null,
    pitfalls: [{ title: "EPS-jakt", text: "Att göra affärer bara för att de är accretive kan förstöra värde: det säger inget om man betalade rätt pris eller om affären är strategiskt vettig." }],
    related: ["eps", "synergies", "stock-vs-cash"], learn: "ib",
  },
  {
    id: "synergies", title: "Synergier", en: "synergies", kind: "Grundbegrepp",
    what: "Kostnadsbesparingar eller intäktsökningar som bara uppstår för att två bolag går ihop – t.ex. ett gemensamt huvudkontor eller att sälja varandras produkter.",
    why: "Synergierna är ofta det som motiverar budpremien. Utan dem är det svårt att betala mer än marknadspriset och ändå skapa värde.",
    interpret: ["Kostnadssynergier är säkrare än intäktssynergier.", "Synergier tar ofta 2–3 år att få fram och kostar pengar att genomföra.", "Break-even-synergier = hur mycket som behövs för att affären inte ska sänka EPS."],
    example: (c) => has(c, "breakeven") ? `Affären kräver synergier på ca ${fmt(c.breakeven / 1e6, 0)} mkr per år för att inte sänka vinsten per aktie.` : null,
    related: ["accretion-dilution", "bid-premium"], learn: "ib",
  },
  {
    id: "stock-vs-cash", title: "Betalning: aktier, kontanter eller lån", en: "consideration mix", kind: "Parameter",
    what: "Hur köparen betalar: med egna nyemitterade aktier, med pengar i kassan eller med nya lån.",
    why: "Valet påverkar EPS, skuldsättning och vem som bär risken. Med aktier blir säljarna delägare i det nya bolaget.",
    interpret: ["Aktier: ingen ny skuld, men vinsten delas på fler aktier (utspädning).", "Lån: ingen utspädning, men räntekostnad och högre risk.", "Kontanter: billigast om kassan ändå ger låg ränta."],
    related: ["accretion-dilution", "leverage-multiple"], learn: "ib",
  },
  {
    id: "ipo", title: "Börsnotering (IPO)", en: "initial public offering", kind: "Grundbegrepp",
    what: "När ett bolag för första gången säljer aktier till allmänheten och listas på en börs.",
    why: "Ett sätt för bolaget att ta in pengar och för ägare (ofta PE-fonder) att sälja. Investmentbanker sätter priset, hittar investerare och garanterar ofta affären.",
    interpret: ["Processen tar typiskt 4–6 månader.", "Priset sätts ofta med en rabatt (10–15 %) för att locka investerare – därför stiger många IPO:er första dagen.", "PE-ägda bolag noteras ofta som exit."],
    related: ["bookbuilding", "investment-banking", "private-equity"], learn: "ib",
  },
  {
    id: "bookbuilding", title: "Bookbuilding", en: "bookbuilding", kind: "Grundbegrepp",
    what: "Processen där bankerna samlar in order från stora investerare inom ett prisintervall för att hitta det pris marknaden är villig att betala.",
    why: "Så sätts priset i de flesta börsnoteringar och större emissioner. Efterfrågan i \"boken\" avgör om priset hamnar i toppen eller botten av intervallet.",
    interpret: ["\"Boken övertecknad 5 gånger\" = investerarna vill köpa fem gånger så många aktier som erbjuds.", "Ankarinvesterare (cornerstones) lovar att köpa i förväg för att skapa trygghet."],
    related: ["ipo"], learn: "ib",
  },
  {
    id: "ma-process", title: "M&A-process", en: "sell-side M&A process", kind: "Strategi",
    what: "De steg en säljare och dess bank går igenom för att sälja ett bolag: förberedelse, kontakt med köpare, indikativa bud, due diligence, bindande bud och avtal.",
    why: "En strukturerad auktion skapar konkurrens mellan köpare och höjer priset. Banken styr processen och tidsplanen.",
    interpret: ["Typisk tid: 4–9 månader.", "Due diligence = köparen granskar bolaget på djupet (ekonomi, juridik, kunder).", "Ett \"fairness opinion\" är bankens utlåtande om att priset är skäligt för aktieägarna."],
    related: ["investment-banking", "synergies"], learn: "ib",
  },
];

export const IB_EXTRAS: Record<string, Extra> = {
  "investment-banking": { track: "ib", view: PROC, analogy: "Som en mäklare för hela företag: värderar, hittar köpare, förhandlar och ser till att affären går i mål.", worked: "Ett bolag säljs för 10 mdkr. Säljarens bank tar 1,5 % = 150 mkr i avgift, plus att köparens bank och advokater tar sitt." },
  "football-field": { track: "ib", view: FF, analogy: "Som att värdera en bostad genom att väga ihop mäklarens bedömning, vad grannarna sålt för och vad den kostade för ett år sedan.", worked: "DCF 280–360 kr, multiplar 300–340 kr, analytiker 290–410 kr, uppköp 390–450 kr. Kursen 310 kr ligger i den nedre delen av de flesta intervallen." },
  eps: { track: "ib", view: MA, analogy: "Hur stor bit av tårtan varje aktie får. En större tårta hjälper inte om den delas på många fler.", worked: "Vinst 5 mdkr, 1 miljard aktier → EPS 5 kr. Efter ett förvärv: vinst 6 mdkr men 1,3 miljarder aktier → EPS 4,62 kr (−7,7 %)." },
  "accretion-dilution": { track: "ib", view: MA, analogy: "Om du byter in din bil mot en dyrare: blir din ekonomi bättre eller sämre per månad, när man räknar in lånet?", worked: "Köparen har P/E 20 och köper ett bolag på P/E 15 med aktier → accretive. Betalar man en premie så att P/E blir 25 → dilutive." },
  synergies: { track: "ib", view: MA, analogy: "Två grannar som delar gräsklippare: var och en sparar pengar, men bara för att de gick ihop.", worked: "Två bolag slår ihop sina huvudkontor och sparar 400 mkr per år före skatt. Efter 20,6 % skatt: 318 mkr mer i vinst." },
  "stock-vs-cash": { track: "ib", view: MA, analogy: "Att betala ett hus kontant, med bolån eller genom att ge säljaren en del av ett annat hus du äger.", worked: "Köp för 10 mdkr: med aktier á 100 kr krävs 100 miljoner nya aktier. Med lån á 6 % blir räntan 600 mkr/år (476 mkr efter skatt)." },
  ipo: { track: "ib", view: PROC, analogy: "Att öppna en privat klubb för allmänheten: alla kan köpa medlemskap, men klubben måste visa sina böcker.", worked: "Bolaget värderas till 5 mdkr och säljer 30 % = 1,5 mdkr. Kursen stiger 12 % första dagen – nya aktieägare tjänar 180 mkr som säljarna gick miste om." },
  bookbuilding: { track: "ib", view: PROC, analogy: "Som en auktion i förväg: man frågar alla intresserade hur mycket de vill köpa till olika priser innan priset sätts.", worked: "Intervall 90–110 kr. Order för 4,5 mdkr på en emission om 1,5 mdkr → övertecknad 3×, priset sätts i toppen: 110 kr." },
  "ma-process": { track: "ib", view: PROC, analogy: "Som en bostadsvisning i flera steg: först ett prospekt till många, sedan visning för de intresserade, sedan budgivning och kontrakt.", worked: "Banken kontaktar 40 möjliga köpare, 12 skriver på sekretessavtal, 6 lämnar indikativa bud, 3 gör due diligence, 1 vinner med bindande bud." },
};
