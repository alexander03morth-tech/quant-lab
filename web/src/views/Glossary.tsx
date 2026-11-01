import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { RichText } from "../components/RichText";
import { CONCEPT_LIST } from "../explain/concepts";
import { useSettings } from "../lib/settings";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Glossary() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const { openExplain } = useSettings();
  const items = useMemo(() => {
    const nq = norm(q);
    return CONCEPT_LIST
      .filter((c) => !nq || norm(`${c.title} ${c.en ?? ""} ${c.what}`).includes(nq))
      .sort((a, b) => a.title.localeCompare(b.title, "sv"));
  }, [q]);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Ordlista</h1>
          <p className="page-sub">Alla begrepp i Quant Lab. Klicka för hela förklaringen med formel, tumregler och fallgropar.</p>
        </div>
        <input
          className="select" style={{ backgroundImage: "none", minWidth: 260, padding: "8px 12px" }}
          type="search" placeholder="Sök term, t.ex. half-life…" value={q} autoFocus
          onChange={(e) => setSp(e.target.value ? { q: e.target.value } : {}, { replace: true })} aria-label="Sök i ordlistan"
        />
      </div>
      <div className="grid">
        {items.map((c) => (
          <button key={c.id} className="card span-4" style={{ textAlign: "left", cursor: "pointer", padding: "14px 16px" }} onClick={() => openExplain(c.id)}>
            <div className="explain-kicker">{c.kind}</div>
            <div style={{ fontWeight: 600, fontSize: 16, margin: "2px 0 4px" }}>{c.title} {c.en && <span className="dim" style={{ fontWeight: 400, fontSize: 14 }}>({c.en})</span>}</div>
            <div className="muted" style={{ fontSize: 14 }}><RichText text={c.what} /></div>
          </button>
        ))}
        {items.length === 0 && <p className="muted span-12">Inga träffar på "{q}".</p>}
      </div>
    </div>
  );
}
