/**
 * "Så funkar jobbet" – innehåll per spår. Skrivet för någon som inte känner till branschen.
 * Siffror (tider, storlekar, avkastningsmål) är typiska tumregler, inte exakta fakta för en viss firma.
 */
export interface Role { title: string; years: string; does: string }
export interface DayItem { time: string; what: string }
export interface Task { title: string; text: string; concept?: string; link?: { to: string; label: string } }
export interface Career {
  id: string; kicker: string; title: string; purpose: string; who: string;
  tasks: Task[]; roles: Role[]; day: DayItem[]; skills: string[]; where: string[]; next: string;
}

export const CAREERS: Record<string, Career> = {
  ib: {
    id: "ib", kicker: "Investment banking", title: "Rådgivarna bakom de stora affärerna",
    purpose: "En investmentbank hjälper företag, ägare och PE-fonder när något stort ska hända: ett bolag ska köpas eller säljas, gå till börsen eller låna pengar. Banken bidrar med värdering, kontakter med köpare och investerare, förhandling och projektledning – och tar betalt med en avgift när affären går i mål.",
    who: "Kunderna är storbolag (som vill köpa konkurrenter eller sälja en division), familjeägare (som vill sälja), PE-fonder (som köper och säljer hela tiden) och staten.",
    tasks: [
      { title: "Pitcha för nya uppdrag", text: "Banken konkurrerar om uppdragen. Teamet bygger en \"pitch book\": en presentation med marknadsöversikt, värdering och förslag på köpare – för att övertyga kunden om att anlita just dem.", concept: "investment-banking" },
      { title: "Värdera bolag", text: "Varje affär börjar med frågan \"vad är det värt?\". Analytikerna bygger modeller i Excel: DCF, jämförelsebolag, tidigare uppköp och LBO-analys för att se vad en PE-köpare har råd med.", concept: "football-field", link: { to: "/ib/vardering", label: "Värderingsöversikten" } },
      { title: "Driva försäljningsprocesser", text: "Vid en försäljning skriver banken säljpromemorian, kontaktar köpare, sköter datarummet, samlar in bud och förhandlar fram bästa pris och villkor.", concept: "ma-process", link: { to: "/ib/process", label: "Affärsprocessen" } },
      { title: "Räkna på köp", text: "När en kund vill köpa: vad ska man bjuda, hur ska det finansieras och blir vinsten per aktie högre eller lägre efteråt?", concept: "accretion-dilution", link: { to: "/ib/ma", label: "M&A-kalkylen" } },
      { title: "Ta in kapital", text: "ECM-teamen sköter börsnoteringar och nyemissioner; DCM och leveraged finance ordnar lån och obligationer – ofta för PE-fondernas köp.", concept: "ipo" },
    ],
    roles: [
      { title: "Analyst", years: "0–3 år", does: "Bygger modeller, gör presentationer, letar data och kontrollerar varenda siffra. Lär sig hantverket. Långa dagar." },
      { title: "Associate", years: "3–6 år", does: "Styr analytikernas arbete, granskar modeller och presentationer, är kontaktperson mot kundens team i det dagliga." },
      { title: "Vice President (VP)", years: "6–9 år", does: "Projektleder affärerna: tidsplan, kundmöten, samordning med advokater och revisorer." },
      { title: "Director", years: "9–12 år", does: "Börjar äga kundrelationer och dra in egna uppdrag." },
      { title: "Managing Director (MD)", years: "12+ år", does: "Ansvarar för kundrelationerna och för att banken vinner affärer. Förhandlar de viktigaste villkoren." },
    ],
    day: [
      { time: "08:30", what: "Läser nyheter om kundernas branscher, kollar vad som hänt i pågående affärer." },
      { time: "09:30", what: "Internt möte: vad ska vara klart idag i pitchen och i den pågående försäljningen?" },
      { time: "10:00", what: "Uppdaterar värderingsmodellen med kundens nya prognoser." },
      { time: "13:00", what: "Samtal med kund och advokater om datarummet och köparnas frågor." },
      { time: "15:00", what: "Bygger sidor till pitch book: jämförelsebolag, tidigare affärer, möjliga köpare." },
      { time: "19:00", what: "Kommentarer från VP – ändringar i presentationen." },
      { time: "22:00+", what: "Sista kontroll av siffror innan materialet skickas till kunden på morgonen." },
    ],
    skills: ["Excel och finansiell modellering", "Redovisning (resultat-, balans- och kassaflödesräkning)", "Värdering: DCF, multiplar, LBO", "PowerPoint och att berätta med siffror", "Noggrannhet under tidspress", "Uthållighet: 70–90 timmars veckor är vanligt"],
    where: ["Nordiska banker med corporate finance (t.ex. SEB, Handelsbanken, Nordea, Swedbank, DNB Carnegie, ABG)", "Globala banker i London och Stockholm (t.ex. Goldman Sachs, Morgan Stanley, J.P. Morgan)", "Rådgivningsboutiques och Big Four-firmornas M&A-avdelningar"],
    next: "Efter 2–3 år som analytiker går många vidare till private equity, till företags egna förvärvsavdelningar (corporate development) eller till startups. Andra stannar och blir MD.",
  },

  pe: {
    id: "pe", kicker: "Private equity", title: "Ägarna som köper, förbättrar och säljer",
    purpose: "En PE-fond förvaltar pengar från pensionsfonder, försäkringsbolag och förmögna familjer. Uppdraget: ge dem högre avkastning än börsen genom att köpa bolag, göra dem bättre som aktiva ägare under 3–7 år och sälja dem. PE-bolaget tjänar på avgifter och en andel av vinsten (carry).",
    who: "Investerarna (LP:er) är främst pensionsfonder, statliga fonder, försäkringsbolag och stiftelser. Bolagen som köps är allt från familjeföretag till börsbolag och avknoppade divisioner.",
    tasks: [
      { title: "Hitta bolag (sourcing)", text: "Teamet letar ständigt efter bolag att köpa: genom banker som säljer bolag, direktkontakt med ägare, branschteman och tilläggsförvärv till bolag de redan äger. Se fliken \"Så hittas bolag\".", concept: "private-equity" },
      { title: "Analysera och värdera", text: "Varje intressant bolag gås igenom: marknad, konkurrenter, kunder, lönsamhet. En LBO-modell visar vad man kan betala för att nå målavkastningen.", concept: "lbo", link: { to: "/pe/lbo", label: "LBO-modellen" } },
      { title: "Investeringskommittén", text: "Teamet skriver ett investeringsmemo och försvarar caset inför partnerna i investeringskommittén (IC). Utan IC:s godkännande blir det inget bud.", concept: "irr" },
      { title: "Due diligence och finansiering", text: "Rådgivare granskar bolaget (finansiellt, juridiskt, kommersiellt). Samtidigt förhandlas lånen med banker och kreditfonder.", concept: "leverage-multiple" },
      { title: "Utveckla bolaget", text: "Efter köpet sitter PE-bolaget i styrelsen: tar fram en 100-dagarsplan, rekryterar ledning, gör tilläggsförvärv, effektiviserar och följer upp varje månad.", concept: "value-creation-bridge" },
      { title: "Sälja (exit)", text: "Efter några år säljs bolaget till en industriell köpare, en annan PE-fond eller via börsen. Det är först då vinsten realiseras.", concept: "moic" },
      { title: "Ta in nya fonder", text: "Partnerna reser regelbundet nya fonder: träffar investerare, visar resultat och förhandlar villkor.", concept: "carried-interest", link: { to: "/pe/fond", label: "Fondekonomi" } },
    ],
    roles: [
      { title: "Analyst", years: "0–2 år", does: "Screenar bolag, bygger LBO-modeller och marknadsanalyser, skriver delar av investeringsmemon. Ofta rekryterad direkt från IB." },
      { title: "Associate", years: "2–5 år", does: "Driver analysen i affärer, samordnar due diligence-rådgivare, följer upp portföljbolag." },
      { title: "Vice President / Investment Manager", years: "5–8 år", does: "Leder affärsprocessen i det dagliga, förhandlar med säljare och banker, sitter i portföljbolagens styrelser." },
      { title: "Director / Principal", years: "8–12 år", does: "Hittar egna affärer, äger relationer med rådgivare och ägare, leder värdeskapandet i bolagen." },
      { title: "Partner", years: "12+ år", does: "Fattar investeringsbeslut i IC, ansvarar för fondens resultat och för att resa nya fonder. Får störst del av carryn." },
    ],
    day: [
      { time: "08:00", what: "Läser branschnyheter och nya säljprocesser som bankerna skickat ut (teasers)." },
      { time: "09:00", what: "Screeningmöte: vilka av veckans inkomna bolag är värda att titta vidare på?" },
      { time: "10:30", what: "Samtal med en familjeägare om ett eventuellt generationsskifte." },
      { time: "12:00", what: "Lunch med en M&A-rådgivare – relationer ger tidiga tips." },
      { time: "13:30", what: "Uppdaterar LBO-modellen med nya siffror från due diligence." },
      { time: "16:00", what: "Styrelsemöte i ett portföljbolag: uppföljning av 100-dagarsplanen och ett tilläggsförvärv." },
      { time: "18:00", what: "Skriver på investeringsmemot inför veckans IC." },
    ],
    skills: ["LBO-modellering och värdering", "Kommersiell analys: förstå marknader och affärsmodeller", "Förhandling och relationsbyggande", "Omdöme: att se risker och säga nej till de flesta bolag", "Styrelsearbete och ledarskap", "Att skriva tydligt (investeringsmemon)"],
    where: ["Stora nordiska fonder (t.ex. EQT, Nordic Capital, Triton, IK Partners)", "Medelstora fonder (t.ex. Altor, Adelis, Litorina, FSN Capital)", "Tillväxt- och impactfonder (t.ex. Verdane, Summa Equity)", "Riskkapital/venture (t.ex. Creandum, Northzone, EQT Ventures)", "Börsnoterade ägare (t.ex. Ratos) och family offices"],
    next: "Många stannar länge i branschen eftersom carryn gör att lönen växer med åren. Andra blir vd eller CFO i portföljbolag, startar egna fonder eller går till investerarsidan.",
  },

  aktie: {
    id: "aktie", kicker: "Aktieanalys & förvaltning", title: "De som bedömer vad aktier är värda",
    purpose: "Aktieanalytiker försöker förstå bolag bättre än marknaden: hur de tjänar pengar, vart de är på väg och vad aktien borde vara värd. På bankerna (sell-side) säljs analysen till investerare; hos fondbolagen (buy-side) används den för att bestämma vad fonden ska äga.",
    who: "Sell-side-analytiker skriver för fondförvaltare och andra professionella investerare. Buy-side-analytiker och förvaltare jobbar för fondsparare, pensionsfonder och försäkringsbolag.",
    tasks: [
      { title: "Följa ett antal bolag", text: "En analytiker följer ofta 10–20 bolag i samma bransch och kan dem utan och innan: produkter, kunder, konkurrenter, ledning.", concept: "comps", link: { to: "/aktie/jamfor", label: "Jämförelsen" } },
      { title: "Bygga prognosmodeller", text: "Kärnan är en Excelmodell per bolag med prognoser för omsättning, marginaler och kassaflöde flera år framåt – grunden för värderingen.", concept: "dcf", link: { to: "/aktie/dcf", label: "DCF-värderingen" } },
      { title: "Rapportsäsong", text: "Fyra gånger om året rapporterar bolagen. Analytikern jämför utfallet med sina prognoser, lyssnar på telefonkonferensen och skriver en kommentar inom några timmar.", concept: "eps" },
      { title: "Sätta riktkurs och rekommendation", text: "Sell-side publicerar köp/behåll/sälj och en riktkurs. Buy-side bestämmer i stället hur mycket fonden ska äga.", concept: "analyst-target", link: { to: "/aktie/bolag", label: "Bolagsanalysen" } },
      { title: "Träffa bolag och investerare", text: "Möten med ledningar, fabriksbesök, kapitalmarknadsdagar – och för sell-side, att presentera sina idéer för fondförvaltare.", concept: "quality-score" },
    ],
    roles: [
      { title: "Junior analytiker", years: "0–3 år", does: "Uppdaterar modeller, samlar data, skriver utkast till rapporter och rapportkommentarer." },
      { title: "Analytiker", years: "3–8 år", does: "Ansvarar för egna bolag eller en bransch, publicerar under eget namn, träffar investerare." },
      { title: "Senior analytiker / sektoransvarig", years: "8+ år", does: "Leder en sektor, rankas av investerare i årliga undersökningar." },
      { title: "Förvaltare (buy-side)", years: "", does: "Bestämmer vad fonden ska äga och hur mycket. Mäts mot ett index – slår man det inte väljer sparare andra fonder." },
    ],
    day: [
      { time: "07:00", what: "Läser nattens nyheter och rapporter – något som påverkar mina bolag?" },
      { time: "07:45", what: "Morgonmöte: varje analytiker presenterar sin viktigaste idé för säljarna." },
      { time: "09:00", what: "Ett bolag rapporterar: jämför mot prognosen, lyssnar på telefonkonferensen 10:00." },
      { time: "11:30", what: "Publicerar en kort kommentar och uppdaterar modellen." },
      { time: "14:00", what: "Möte med en fondförvaltare som vill diskutera branschen." },
      { time: "16:00", what: "Arbetar på en längre branschrapport om framtida efterfrågan." },
    ],
    skills: ["Redovisning och att läsa årsredovisningar", "Prognosmodeller i Excel", "Värdering: DCF och multiplar", "Branschkunskap och nyfikenhet", "Att skriva kort och tydligt", "Att ha en egen åsikt och stå för den"],
    where: ["Bankers aktieanalys (t.ex. SEB, Handelsbanken, Nordea, DNB Carnegie, ABG, Danske Bank)", "Fondbolag och förvaltare (t.ex. Swedbank Robur, SEB Fonder, Handelsbanken Fonder, Lannebo, Didner & Gerge)", "AP-fonderna och försäkringsbolag", "Oberoende analyshus"],
    next: "Vanliga vägar: från sell-side till buy-side (förvaltning), till investor relations på ett börsbolag eller till corporate finance.",
  },

  kvant: {
    id: "kvant", kicker: "Kvantitativ finans", title: "Matematik, data och kod som investeringsbeslut",
    purpose: "Kvantar använder statistik, matematik och programmering för att fatta investeringsbeslut eller mäta risk – i stället för att bedöma bolag ett och ett. Målet är att hitta mönster som håller över tid, bygga strategier som handlar systematiskt och se till att riskerna är under kontroll.",
    who: "Hedgefonder och systematiska förvaltare, bankernas handels- och riskavdelningar, pensionsfonder och fintechbolag.",
    tasks: [
      { title: "Forska fram signaler", text: "En kvantforskare formulerar hypoteser (\"aktier som glidit isär från sin partner brukar komma tillbaka\") och testar dem statistiskt på historisk data.", concept: "cointegration", link: { to: "/par", label: "Paranalys" } },
      { title: "Backtesta – utan att lura sig själv", text: "Den största delen av jobbet är att kontrollera att resultat inte beror på överanpassning, look-ahead bias eller survivorship bias.", concept: "overfitting" },
      { title: "Bygga portföljer och mäta risk", text: "Signaler omvandlas till positioner med hänsyn till risk, korrelation och kostnader. Riskkvantar bygger modeller för VaR och stresstester.", concept: "risk-contribution", link: { to: "/portfolj", label: "Portföljlabbet" } },
      { title: "Bygga system", text: "Kvantutvecklare skriver koden som hämtar data, räknar signaler och skickar order – snabbt och felfritt.", concept: "look-ahead" },
      { title: "Övervaka strategier live", text: "Strategier slutar fungera när marknaden förändras. Man följer upp dagligen och stänger av det som inte längre fungerar.", concept: "regime-shift" },
    ],
    roles: [
      { title: "Kvantanalytiker / junior researcher", years: "0–3 år", does: "Rensar data, kör backtester, implementerar idéer från seniora forskare." },
      { title: "Quant researcher", years: "3+ år", does: "Tar fram egna strategier och signaler, publicerar internt, äger en del av portföljen." },
      { title: "Quant developer", years: "", does: "Bygger plattformen: datapipelines, backtestmotor, handelssystem. Ofta mjukvaruingenjörer med finansintresse." },
      { title: "Quant trader / portföljförvaltare", years: "", does: "Ansvarar för att strategierna handlas, att risken hålls inom ramarna och för resultatet." },
      { title: "Riskkvant", years: "", does: "På banker och försäkringsbolag: modeller för marknads- och kreditrisk, kapitalkrav och stresstester." },
    ],
    day: [
      { time: "08:00", what: "Kollar nattens körningar: gick alla datahämtningar och signaler igenom?" },
      { time: "08:30", what: "Går igenom gårdagens resultat per strategi – något avvikande?" },
      { time: "09:30", what: "Forskning: testar om en ny signal håller out-of-sample." },
      { time: "13:00", what: "Kodgranskning med en kvantutvecklare." },
      { time: "15:00", what: "Forskningsmöte: presenterar resultat och får kritik – \"är det här överanpassat?\"" },
      { time: "17:30", what: "Kontrollerar att dagens order gick som planerat efter börsens stängning." },
    ],
    skills: ["Statistik och sannolikhetslära", "Linjär algebra och optimering", "Python (pandas, numpy) – ofta även C++", "Tidsserieanalys och maskininlärning", "Kritiskt tänkande kring data och fallgropar", "Finansiell intuition: varför borde en signal fungera?"],
    where: ["Systematiska förvaltare och hedgefonder (t.ex. Lynx Asset Management, fonder inom Brummer & Partners)", "Bankernas markets- och riskavdelningar (t.ex. SEB, Nordea, Handelsbanken, Swedbank)", "AP-fonderna och stora försäkringsbolag", "Globala kvantfonder och tradingfirmor i London och Amsterdam", "Fintech och betalbolag"],
    next: "Kvantkompetens är eftertraktad brett: många rör sig mellan hedgefonder, banker, tech och data science. Bakgrunden är ofta civilingenjör, matematik, fysik eller datavetenskap.",
  },
};

/** PE-strategier: vad de letar efter och var de hittar bolag. */
export interface Strategy {
  id: string; name: string; short: string; size: string; ownership: string; debt: string; target: string; hold: string;
  lookFor: string[]; channels: { name: string; text: string }[]; value: string; exit: string; example: string; firms: string;
}
export const PE_STRATEGIES: Strategy[] = [
  {
    id: "largecap", name: "Stora buyouts", short: "Köper ledande bolag för miljarder, ofta med mycket lån.",
    size: "EV över ~5 mdkr", ownership: "Majoritet (ofta 100 %)", debt: "Hög: 4–6× EBITDA", target: "~20 % IRR, 2–3× pengarna", hold: "4–6 år",
    lookFor: ["Marknadsledare i en växande nisch", "Stabila, förutsägbara kassaflöden att betala lånen med", "En plattform för tilläggsförvärv", "Möjlighet att internationalisera eller digitalisera", "En tydlig väg till exit"],
    channels: [
      { name: "Auktioner via banker", text: "De flesta stora bolag säljs i strukturerade processer där investmentbanker bjuder in 5–20 köpare. Konkurrensen är hård och priserna höga." },
      { name: "Avknoppningar (carve-outs)", text: "Storbolag som vill fokusera säljer divisioner. Ofta förbisedda bolag med förbättringspotential." },
      { name: "Uppköp av börsbolag (take-private)", text: "Fonden lägger bud på ett noterat bolag som börsen värderar lågt, ofta tillsammans med huvudägaren." },
      { name: "Från andra PE-fonder (secondary buyout)", text: "Ett bolag som en mindre fond har vuxit köps av en större fond som tar nästa steg." },
      { name: "Branschteman", text: "Fonden väljer teman (t.ex. vårdtjänster eller IT-säkerhet) och kartlägger alla bolag i nischen långt innan de är till salu." },
    ],
    value: "Internationell expansion, stora tilläggsförvärv, professionalisering av ledning och system, effektivisering.",
    exit: "Börsnotering, försäljning till industriell köpare eller till en annan stor fond.",
    example: "En nordisk marknadsledare inom laboratorieutrustning med 1,5 mdkr i EBITDA köps för 14× EBITDA i en bankledd auktion och växer genom fem tilläggsförvärv i Europa.",
    firms: "T.ex. EQT, Nordic Capital, Triton, IK Partners",
  },
  {
    id: "midmarket", name: "Mellanstora buyouts", short: "Köper familjeägda och grundarledda bolag och hjälper dem växa.",
    size: "EV ~0,3–5 mdkr", ownership: "Majoritet, ofta med säljaren kvar som delägare", debt: "Måttlig: 2–4× EBITDA", target: "~20–25 % IRR, 2,5–3×", hold: "4–6 år",
    lookFor: ["Lönsamt bolag med ägare som vill gå vidare (generationsskifte)", "Fragmenterad bransch där man kan köpa ihop flera mindre bolag (buy-and-build)", "Möjlighet att professionalisera: styrelse, ekonomistyrning, försäljning", "Rimligt pris – ofta lägre multiplar än stora bolag"],
    channels: [
      { name: "Direktkontakt med ägare (proprietary)", text: "Teamet ringer och träffar ägare år efter år. Affärer utan auktion ger lägre pris och bättre relation – men kräver tålamod." },
      { name: "Mindre rådgivare och nätverk", text: "M&A-boutiques, revisorer och advokater som känner ägarna och vet när de funderar på att sälja." },
      { name: "Generationsskiften", text: "Familjeföretag där nästa generation inte vill ta över är en klassisk källa i Norden." },
      { name: "Tilläggsförvärv", text: "När fonden redan äger en plattform letas mindre konkurrenter upp som kan köpas till låga multiplar." },
    ],
    value: "Buy-and-build (köpa mindre bolag billigt och bli större och mer värd), professionalisering, ny försäljningsorganisation.",
    exit: "Försäljning till en större PE-fond eller industriell köpare; ibland börsnotering.",
    example: "En familjeägd tandvårdskedja med 12 kliniker köps; fonden köper 40 kliniker till under fyra år och säljer en rikstäckande kedja till en större fond.",
    firms: "T.ex. Altor, Adelis, Litorina, FSN Capital",
  },
  {
    id: "growth", name: "Tillväxtkapital", short: "Köper minoritetsposter i snabbväxande bolag – lite eller ingen skuld.",
    size: "Investering ~50–1 000 mkr", ownership: "Ofta minoritet (20–49 %)", debt: "Låg eller ingen", target: "~25 % IRR, 3×+", hold: "4–7 år",
    lookFor: ["Hög tillväxt (ofta över 20 % per år) med bevisad affärsmodell", "Skalbarhet: intäkterna kan växa snabbare än kostnaderna", "Grundare som vill ha kapital och hjälp – men behålla kontrollen", "Ofta mjukvara, tech och hållbarhetsbolag"],
    channels: [
      { name: "Datadriven screening", text: "Teamen följer tusentals bolag i databaser (tillväxt, anställda, webbtrafik) och kontaktar de som sticker ut." },
      { name: "Uppsökande kontakt med grundare", text: "Analytiker mejlar och ringer grundare långt innan de söker kapital, för att bygga relation." },
      { name: "Konferenser och nätverk", text: "Branschevent, andra investerare och tidigare portföljbolag tipsar." },
    ],
    value: "Internationell expansion, rekrytering, prissättning och försäljningsprocesser – utan att ta över styret.",
    exit: "Försäljning av posten till en buyoutfond eller industriell köpare, eller börsnotering.",
    example: "Ett lönsamt svenskt SaaS-bolag som växer 35 % per år tar in 400 mkr för 30 % av bolaget för att etablera sig i USA.",
    firms: "T.ex. Verdane, Summa Equity, EQT Growth",
  },
  {
    id: "venture", name: "Riskkapital (venture)", short: "Investerar i tidiga startups – de flesta misslyckas, några blir enorma.",
    size: "Investering ~1–200 mkr", ownership: "Minoritet (10–25 % per runda)", debt: "Ingen", target: "Några få bolag ska ge 10–100× och bära hela fonden", hold: "5–10 år",
    lookFor: ["Ett exceptionellt team", "En mycket stor potentiell marknad", "Produkt som kunderna tydligt vill ha (traction)", "Möjlighet att bli marknadsledande globalt"],
    channels: [
      { name: "Nätverk och rekommendationer", text: "De bästa affärerna kommer ofta via andra grundare, änglainvesterare och tidigare entreprenörer." },
      { name: "Inkommande förfrågningar", text: "Tusentals pitchar per år – en bråkdel får ett möte." },
      { name: "Universitet och acceleratorer", text: "Teknik från forskning och program som samlar unga bolag." },
    ],
    value: "Rekrytering, nästa finansieringsrunda, kundkontakter och strategiska råd.",
    exit: "Uppköp av ett större techbolag eller börsnotering.",
    example: "Ett AI-bolag med tre grundare och ett första kundavtal tar in 40 mkr för 20 %. Fem år senare säljs det för 4 mdkr – eller läggs ner.",
    firms: "T.ex. Creandum, Northzone, EQT Ventures",
  },
  {
    id: "infra", name: "Infrastruktur", short: "Köper tillgångar med långa, stabila kassaflöden: fiber, energi, hamnar.",
    size: "EV ofta över ~3 mdkr", ownership: "Majoritet", debt: "Hög men säker – kassaflödena är kontrakterade", target: "~8–12 % IRR", hold: "7–15 år",
    lookFor: ["Monopolliknande position eller långa kontrakt", "Skydd mot inflation (prishöjningar i avtal)", "Investeringsbehov som fonden kan finansiera", "Låg konjunkturkänslighet"],
    channels: [
      { name: "Privatiseringar och kommuner", text: "Offentliga ägare säljer t.ex. energibolag eller fibernät." },
      { name: "Avknoppningar från industri och telekom", text: "Telekombolag säljer sina mastnät, industrier sina energitillgångar." },
      { name: "Auktioner", text: "Stora infrastrukturtillgångar säljs nästan alltid i bankledda processer." },
    ],
    value: "Utbyggnad (t.ex. mer fiber eller laddinfrastruktur), effektiv drift, långsiktig finansiering.",
    exit: "Försäljning till pensionsfonder eller andra långsiktiga infrastrukturägare.",
    example: "Ett regionalt fibernät köps från en kommun och byggs ut till 200 000 hushåll under tio år.",
    firms: "T.ex. EQT Infrastructure och globala infrastrukturfonder",
  },
  {
    id: "specialsits", name: "Specialsituationer", short: "Köper bolag i kris eller förändring – hög risk, hög potentiell avkastning.",
    size: "Varierar", ownership: "Majoritet eller skuld som kan bli ägande", debt: "Ofta omstrukturerad", target: "~20 %+ IRR", hold: "2–5 år",
    lookFor: ["Bolag med bra kärnverksamhet men fel finansiering eller ledning", "Rekonstruktioner och konkurser", "Ägare som måste sälja snabbt"],
    channels: [
      { name: "Rekonstruktioner", text: "Kontakter med rekonstruktörer, advokater och banker som har problemkrediter." },
      { name: "Köp av skuld", text: "Fonden köper bolagets lån billigt och tar över ägandet när skulden skrivs om." },
      { name: "Tvångssituationer", text: "Säljare som behöver pengar snabbt accepterar lägre pris för säkerhet och snabbhet." },
    ],
    value: "Ny kapitalstruktur, ny ledning, fokus på kärnverksamheten, nedskärningar.",
    exit: "Försäljning när bolaget är stabiliserat.",
    example: "En lönsam tillverkare med för mycket lån efter ett misslyckat förvärv rekonstrueras; fonden tar över, säljer sidoverksamheter och vänder bolaget på tre år.",
    firms: "Specialiserade fonder och delar av större PE-hus",
  },
];

/** Typisk PE-tratt per år (tumregel för en medelstor fond). */
export const PE_FUNNEL: [string, number][] = [
  ["Bolag som screenas", 1000], ["Första möte / teaser läst", 150], ["Djupare analys", 40], ["Indikativt bud", 12], ["Due diligence", 4], ["Genomförda affärer", 2],
];

/** IB-avdelningar. */
export const IB_DIVISIONS = [
  { id: "ma", name: "M&A", text: "Rådgivning vid köp och försäljning av bolag. Säljsida: driva auktionen. Köpsida: värdera och förhandla. Kärnan i många corporate finance-avdelningar.", concept: "ma-process" },
  { id: "ecm", name: "ECM", text: "Equity capital markets: börsnoteringar, nyemissioner och blockförsäljningar av stora aktieposter. Nära kontakt med investerare.", concept: "ipo" },
  { id: "dcm", name: "DCM", text: "Debt capital markets: obligationer för bolag, banker och stater. Bedömer vilken ränta marknaden kräver.", concept: "wacc" },
  { id: "levfin", name: "Leveraged finance", text: "Lån och högavkastande obligationer till PE-fondernas köp. Arbetar tätt med PE-bolagen.", concept: "leverage-multiple" },
  { id: "coverage", name: "Branschteam (coverage)", text: "Bankers som äger relationen med kunder i en viss bransch (t.ex. industri, vård, tech) och tar in uppdrag som produktteamen sedan genomför.", concept: "investment-banking" },
  { id: "restructuring", name: "Rekonstruktion", text: "Hjälper bolag med för mycket skuld att förhandla om sina lån – eller långivarna att få tillbaka sina pengar.", concept: "interest-coverage" },
];
