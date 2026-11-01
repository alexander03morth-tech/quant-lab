import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { RichText } from "../components/RichText";
import { Seg } from "../components/Slider";
import { CONCEPT_LIST } from "../explain/concepts";
import { EXTRAS, type Track } from "../explain/extras";
import { useSettings } from "../lib/settings";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const TRACKS: { value: Track | "alla"; label: string }[] = [
  { value: "alla", label: "Alla" }, { value: "kvant", label: "Kvant" }, { value: "marknad", label: "Marknad" },
  { value: "portfolj", label: "Portfölj & risk" }, { value: "pe", label: "Private equity" },
];

export function Glossary() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const track = (sp.get("spar") ?? "alla") as Track | "alla";
  const { openExplain } = useSettings();
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v && v !== "alla") n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const items = useMemo(() => {
    const nq = norm(q);
    return CONCEPT_LIST
      .filter((c) => track === "alla" || EXTRAS[c.id]?.track === track)
      .filter((c) => !nq || norm(`${c.title} ${c.en ?? ""} ${c.what} ${EXTRAS[c.id]?.analogy ?? ""}`).includes(nq))
      .sort((a, b) => a.title.localeCompare(b.title, "sv"));
  }, [q, track]);
  const counts = useMemo(() => Object.fromEntries(TRACKS.map((t) => [t.value, CONCEPT_LIST.filter((c) => t.value === "alla" || EXTRAS[c.id]?.track === t.value).length])), []);
  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Ordlista</span><span className="live">{CONCEPT_LIST.length} begrepp</span></div>
          <h1 className="hero-title">Alla begrepp, förklarade enkelt</h1>
          <p className="hero-sub">Klicka på ett kort för hela förklaringen: vad det är, en vardagsliknelse, varför det spelar roll, tumregler, formel, ett räkneexempel och vanliga fallgropar.</p>
          <div className="row" style={{ marginTop: 6 }}>
            <input className="select" style={{ backgroundImage: "none", minWidth: 260, padding: "8px 12px", flex: "1 1 260px", maxWidth: 420 }}
              type="search" placeholder="Sök, t.ex. half-life eller skuld…" value={q} onChange={(e) => setParam("q", e.target.value)} aria-label="Sök i ordlistan" />
            <Seg label="Spår" value={track} onChange={(v) => setParam("spar", v)} options={TRACKS.map((t) => ({ value: t.value, label: `${t.label} ${counts[t.value]}` }))} />
          </div>
        </div>
      </div>
      <div className="grid">
        {items.map((c) => (
          <button key={c.id} className="card span-4 gloss-card" onClick={() => openExplain(c.id)}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="explain-kicker">{c.kind}</span>
              {EXTRAS[c.id] && <span className={`track-tag t-${EXTRAS[c.id].track}`}>{TRACKS.find((t) => t.value === EXTRAS[c.id].track)?.label}</span>}
            </div>
            <div className="gloss-title">{c.title} {c.en && <span className="dim">({c.en})</span>}</div>
            <div className="muted" style={{ fontSize: 14 }}><RichText text={c.what} /></div>
            {EXTRAS[c.id]?.analogy && <div className="gloss-analogy">“{EXTRAS[c.id].analogy}”</div>}
          </button>
        ))}
        {items.length === 0 && <p className="muted span-12">Inga träffar på "{q}".</p>}
      </div>
    </div>
  );
}
