import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Info } from "../../components/Info";
import { Seg } from "../../components/Slider";
import { timeAgo, useNews } from "../../lib/extra";
import { useSettings } from "../../lib/settings";

const CATS: { value: string; label: string; explain: string }[] = [
  { value: "alla", label: "Allt", explain: "" },
  { value: "bud", label: "Bud & avnoteringar", explain: "Någon erbjuder sig att köpa alla aktier i ett börsbolag, oftast med en premie. Lyckas budet lämnar bolaget börsen." },
  { value: "forvarv", label: "Förvärv", explain: "En PE-fond köper ett bolag – ofta ett privat bolag som aldrig varit på börsen." },
  { value: "exit", label: "Exits", explain: "Fonden säljer ett bolag den äger, till en annan köpare eller via börsnotering. Det är här vinsten realiseras." },
  { value: "fond", label: "Fonder", explain: "PE-bolaget samlar in nya pengar från investerare till en ny fond – \"krut\" för framtida köp." },
  { value: "ovrigt", label: "Övrigt", explain: "Annat som rör branschen: personal, skatter, trender." },
];

const STEPS = [
  { n: "01", t: "Samla in", d: "Pensionsfonder och andra stora investerare lovar pengar till en fond som lever ~10 år.", c: "private-equity" },
  { n: "02", t: "Köp med lån", d: "Fonden köper ett bolag och lånar en stor del av köpeskillingen – i bolagets namn.", c: "lbo" },
  { n: "03", t: "Förbättra", d: "Ny ledning, tillväxt, tilläggsförvärv, effektivisering. Kassaflödet betalar av lånen.", c: "value-creation-bridge" },
  { n: "04", t: "Sälj", d: "Efter 3–7 år säljs bolaget. Vinsten delas: ~80 % till investerarna, ~20 % till PE-bolaget.", c: "irr" },
];

export function PeOverview() {
  const news = useNews();
  const { mode } = useSettings();
  const [cat, setCat] = useState("alla");
  const items = useMemo(() => (news?.pe ?? []).filter((n) => cat === "alla" || n.cat === cat), [news, cat]);
  const counts = useMemo(() => Object.fromEntries(CATS.map((c) => [c.value, (news?.pe ?? []).filter((n) => c.value === "alla" || n.cat === c.value).length])), [news]);
  const catInfo = CATS.find((c) => c.value === cat)!;

  return (
    <>
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Private equity</span><span className="live">{news?.pe?.length ?? 0} affärsnyheter</span></div>
          <h1 className="hero-title">Köp. Förbättra. Sälj.</h1>
          <p className="hero-sub">Private equity köper hela företag, ofta med mycket lån, och säljer dem några år senare. Här ser du vad som händer i branschen just nu – och kan räkna på ett köp själv i <Link className="term" to="/pe/lbo">LBO-modellen</Link>.</p>
        </div>
      </div>

      <div className="pe-steps">
        {STEPS.map((s, i) => (
          <div className="pe-step" key={s.n}>
            <div className="pe-step-n">{s.n}</div>
            <div className="pe-step-t">{s.t} <Info id={s.c} /></div>
            <p>{s.d}</p>
            {i < STEPS.length - 1 && <span className="pe-arrow" aria-hidden="true">→</span>}
          </div>
        ))}
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        <section className="card span-8">
          <div className="card-head">
            <h2 className="card-title"><span className="idx">01</span>Nyheter från PE-världen</h2>
            <Seg label="Kategori" value={cat} onChange={setCat} options={CATS.map((c) => ({ value: c.value, label: `${c.label} ${counts[c.value] ?? 0}` }))} />
          </div>
          <div className="card-body">
            {cat !== "alla" && mode === "beginner" && <div className="eli5" style={{ marginTop: 0, marginBottom: 8 }}><b className="k">Vad betyder det?</b>{catInfo.explain}</div>}
            <ul className="news-list">
              {items.slice(0, 30).map((n) => (
                <li className="news-item" key={n.url}>
                  <div>
                    <a className="title" href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
                    <div className="news-meta"><span className="src">{n.source}</span><span>{timeAgo(n.t)}</span><span className={`chip cat-${n.cat}`} style={{ padding: "0 8px", fontSize: 11.5, cursor: "default" }}>{CATS.find((c) => c.value === n.cat)?.label}</span></div>
                  </div>
                </li>
              ))}
              {items.length === 0 && <li className="muted">Inga nyheter i den här kategorin just nu.</li>}
            </ul>
            <p className="dim" style={{ fontSize: 12, margin: "10px 0 0" }}>Rubriker via Google News från svenska affärsmedier, sorterade automatiskt efter nyckelord – kategorin kan ibland bli fel.</p>
          </div>
        </section>
        <aside className="span-4 stack">
          <section className="card">
            <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Fem ord du behöver</h2></div>
            <div className="card-body">
              <ul className="concept-list">
                {[["enterprise-value", "Vad hela bolaget kostar"], ["ebitda", "Bolagets kassagenerering"], ["ev-ebitda", "Priset i \"gånger EBITDA\""], ["irr", "Årlig avkastning"], ["moic", "Hur många gånger pengarna växte"]].map(([id, d]) => (
                  <li key={id}><Info id={id} /><span><b>{id === "enterprise-value" ? "EV" : id === "ev-ebitda" ? "EV/EBITDA" : id.toUpperCase()}</b> – {d}</span></li>
                ))}
              </ul>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Prova själv</h2></div>
            <div className="card-body stack" style={{ gap: 8 }}>
              <Link className="btn primary" to="/pe/lbo">Räkna på ett uppköp →</Link>
              <Link className="btn" to="/pe/fond">Hur tjänar en PE-fond pengar? →</Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
