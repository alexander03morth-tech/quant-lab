import { useState } from "react";
import { Link } from "react-router-dom";
import { Info } from "../../components/Info";
import { Seg } from "../../components/Slider";

const MA = [
  { w: "v. 1–4", t: "Förberedelse", d: "Banken och säljaren tar fram en säljpromemoria (information memorandum), en värdering och en lista med möjliga köpare.", c: "ma-process" },
  { w: "v. 4–8", t: "Första kontakt", d: "Ett kort anonymt underlag (teaser) skickas till 30–50 tänkbara köpare. De intresserade skriver på sekretessavtal (NDA).", c: "ma-process" },
  { w: "v. 8–12", t: "Indikativa bud", d: "Köparna lämnar icke-bindande bud baserade på promemorian. Säljaren väljer ut 3–6 för nästa steg.", c: "football-field" },
  { w: "v. 12–20", t: "Due diligence", d: "Köparna granskar bolaget på djupet i ett datarum: ekonomi, juridik, skatt, kunder, IT. Möten med ledningen.", c: "ma-process" },
  { w: "v. 20–24", t: "Bindande bud", d: "Slutliga bud med finansiering klar och avtalsutkast. Banken jämför pris, villkor och säkerhet.", c: "accretion-dilution" },
  { w: "v. 24+", t: "Avtal & tillträde", d: "Köpeavtal skrivs (signing). Efter godkännanden från t.ex. konkurrensmyndigheter tar köparen över (closing).", c: "synergies" },
];
const IPO = [
  { w: "v. 1–6", t: "Förberedelse", d: "Banker utses, bolaget gör sig redo för börsen: styrelse, rapportering, juridisk struktur.", c: "ipo" },
  { w: "v. 6–14", t: "Prospekt & granskning", d: "Prospektet skrivs och granskas av Finansinspektionen. Bankernas analytiker presenterar bolaget för investerare (pilot fishing).", c: "ipo" },
  { w: "v. 14–16", t: "Ankarinvesterare", d: "Stora investerare åtar sig i förväg att köpa en del av aktierna (cornerstones). Det skapar trygghet för andra.", c: "bookbuilding" },
  { w: "v. 16–18", t: "Bookbuilding", d: "Prisintervall offentliggörs, ledningen träffar investerare (roadshow) och bankerna samlar in order.", c: "bookbuilding" },
  { w: "Dag 1", t: "Prissättning & första handelsdag", d: "Priset sätts utifrån efterfrågan. Aktien börjar handlas – första dagens kursrörelse blir ett kvitto på prissättningen.", c: "ipo" },
];

export function ProcessView() {
  const [kind, setKind] = useState<"ma" | "ipo">("ma");
  const steps = kind === "ma" ? MA : IPO;
  return (
    <>
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Affärsprocessen</span><span className="live">så går det till</span></div>
          <h1 className="hero-title">Från första samtal till klar affär</h1>
          <p className="hero-sub">Investmentbanker styr de stora affärerna på börsen. Här är de två vanligaste processerna steg för steg. <Info id="investment-banking" /></p>
          <Seg label="Process" value={kind} onChange={setKind} options={[{ value: "ma", label: "Försäljning av ett bolag (M&A)" }, { value: "ipo", label: "Börsnotering (IPO)" }]} />
        </div>
      </div>
      <ol className="timeline">
        {steps.map((s, i) => (
          <li key={s.t} className="tl-step">
            <div className="tl-dot">{String(i + 1).padStart(2, "0")}</div>
            <div className="tl-card">
              <div className="tl-when">{s.w}</div>
              <div className="tl-title">{s.t} <Info id={s.c} /></div>
              <p>{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="grid" style={{ marginTop: 14 }}>
        <section className="card span-6"><div className="card-body">
          <div className="explain-kicker">Prova själv</div>
          <p style={{ margin: "6px 0 10px" }}>Se hur en bank värderar ett bolag inför en affär, eller räkna på om ett uppköp höjer köparens vinst per aktie.</p>
          <div className="row"><Link className="btn primary" to="/ib/vardering">Värderingsöversikt →</Link><Link className="btn" to="/ib/ma">M&A-kalkyl →</Link></div>
        </div></section>
        <section className="card span-6"><div className="card-body">
          <div className="explain-kicker">Följ affärerna</div>
          <p style={{ margin: "6px 0 10px" }}>Bud, avnoteringar och börsnoteringar i Norden samlas automatiskt varje kväll.</p>
          <div className="row"><Link className="btn" to="/pe/oversikt">Affärsnyheter →</Link></div>
        </div></section>
      </div>
    </>
  );
}
