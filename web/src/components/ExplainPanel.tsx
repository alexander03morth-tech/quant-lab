import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { CONCEPTS } from "../explain/concepts";
import { EXTRAS } from "../explain/extras";
import { useSettings } from "../lib/settings";
import { RichText } from "./RichText";
import { Tex } from "./Tex";

export function ExplainPanel() {
  const { explain, openExplain, closeExplain } = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  const c = explain ? CONCEPTS[explain.id] : null;

  useEffect(() => {
    if (!explain) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeExplain();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>(".close-btn")?.focus();
    ref.current?.querySelector(".explain-body")?.scrollTo({ top: 0 });
    return () => window.removeEventListener("keydown", onKey);
  }, [explain, closeExplain]);

  if (!c || !explain) return null;
  const ex = EXTRAS[c.id];
  let example: string | null = null;
  try { example = c.example && explain.ctx ? c.example(explain.ctx) : null; } catch { example = null; }

  return (
    <>
      <div className="explain-scrim" onClick={closeExplain} />
      <aside className="explain" ref={ref} role="dialog" aria-modal="true" aria-labelledby="explain-title">
        <div className="explain-head">
          <div>
            <div className="explain-kicker">{c.kind}</div>
            <h2 className="explain-title" id="explain-title">
              {c.title} {c.en && <span className="explain-en">({c.en})</span>}
            </h2>
          </div>
          <button className="close-btn" onClick={closeExplain} aria-label="Stäng förklaring">✕</button>
        </div>
        <div className="explain-body">
          <section className="explain-sec">
            <h3>Vad är det?</h3>
            <p><RichText text={c.what} /></p>
          </section>
          {ex?.analogy && (
            <section className="explain-sec">
              <h3>Som i vardagen</h3>
              <p className="analogy">{ex.analogy}</p>
            </section>
          )}
          <section className="explain-sec">
            <h3>Varför tittar man på det?</h3>
            <p><RichText text={c.why} /></p>
          </section>
          <section className="explain-sec">
            <h3>Hur tolkar jag det?</h3>
            <ul>{c.interpret.map((t, i) => <li key={i}><RichText text={t} /></li>)}</ul>
          </section>
          {c.formula && (
            <section className="explain-sec">
              <h3>Formeln</h3>
              <div className="formula"><Tex block>{c.formula}</Tex></div>
              {c.symbols && (
                <div className="symbols">
                  {c.symbols.map(([s, d], i) => (
                    <div key={i} style={{ display: "contents" }}>
                      <span className="sym"><Tex>{s}</Tex></span>
                      <span className="muted">{d}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          {ex?.worked && (
            <section className="explain-sec">
              <h3>Räkneexempel</h3>
              <div className="worked"><RichText text={ex.worked} /></div>
            </section>
          )}
          {example && (
            <section className="explain-sec">
              <h3>I den aktuella datan</h3>
              <div className="example"><RichText text={example} /></div>
            </section>
          )}
          {c.pitfalls && c.pitfalls.length > 0 && (
            <section className="explain-sec">
              <h3>Fallgropar</h3>
              {c.pitfalls.map((p, i) => <div className="pitfall" key={i}><b>{p.title}.</b> <RichText text={p.text} /></div>)}
            </section>
          )}
          {c.related && c.related.length > 0 && (
            <section className="explain-sec">
              <h3>Relaterat</h3>
              <div className="related">
                {c.related.filter((r) => CONCEPTS[r]).map((r) => (
                  <button key={r} className="chip" onClick={() => openExplain(r, explain.ctx)}>{CONCEPTS[r].title}</button>
                ))}
                {ex?.view && <Link className="chip" to={ex.view.to} onClick={closeExplain} style={{ borderColor: "var(--primary)", color: "var(--text)" }}>Se det i {ex.view.label} →</Link>}
                <Link className="chip" to={`/ordlista?q=${encodeURIComponent(c.title)}`} onClick={closeExplain}>Ordlistan →</Link>
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
