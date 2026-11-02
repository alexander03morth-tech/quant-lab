/**
 * Inlärningslager för modellerna (LBO, M&A, DCF, fondekonomi):
 *   ModelTabs – flikarna Verktyget / Så görs den / Öva själv (i URL:en som ?del=…)
 *   MethodView – modellen steg för steg med formel, exempel och vanliga misstag
 *   Practice  – övningar i tre nivåer med slumpade siffror som man räknar själv och får rättade
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { rng } from "../lib/portfolio/engine";
import { useSettings } from "../lib/settings";
import { Info } from "./Info";
import { RichText } from "./RichText";
import { Tex } from "./Tex";

type Part = "verktyg" | "metod" | "ova";

export function ModelTabs({ tool, method, practice, name }: { tool: ReactNode; method: ReactNode; practice: ReactNode; name: string }) {
  const [sp, setSp] = useSearchParams();
  const part = (["metod", "ova"].includes(sp.get("del") ?? "") ? sp.get("del") : "verktyg") as Part;
  const go = (p: Part) => { const n = new URLSearchParams(sp); if (p === "verktyg") n.delete("del"); else n.set("del", p); setSp(n, { replace: true }); };
  return (
    <>
      <div className="model-tabs" role="tablist" aria-label={name}>
        {([["verktyg", "Verktyget", "räkna på riktiga eller påhittade bolag"], ["metod", "Så görs den", "modellen steg för steg"], ["ova", "Öva själv", "räkna själv – från lätt till svår"]] as const).map(([k, l, d]) => (
          <button key={k} role="tab" aria-selected={part === k} className="model-tab" onClick={() => go(k)}><b>{l}</b><span>{d}</span></button>
        ))}
      </div>
      {part === "verktyg" ? tool : part === "metod" ? method : practice}
    </>
  );
}

export interface MethodStep { title: string; text: string; formula?: string; example?: string; excel?: string; concept?: string }
export interface Method { intro: string; why: string; steps: MethodStep[]; mistakes: { title: string; text: string }[]; levels?: string }

export function MethodView({ m, question }: { m: Method; question: string }) {
  return (
    <div className="grid">
      <section className="card span-12"><div className="card-body">
        <div className="explain-kicker">{question}</div>
        <p style={{ margin: "6px 0 0", fontSize: 15.5, lineHeight: 1.6 }}><RichText text={m.intro} /></p>
        <div className="eli5"><b className="k">Varför gör man den?</b><RichText text={m.why} /></div>
      </div></section>
      <section className="card span-8">
        <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Steg för steg</h2></div>
        <div className="card-body">
          <ol className="timeline">
            {m.steps.map((s, i) => (
              <li key={s.title} className="tl-step">
                <div className="tl-dot">{String(i + 1).padStart(2, "0")}</div>
                <div className="tl-card">
                  <div className="tl-title">{s.title} {s.concept && <Info id={s.concept} />}</div>
                  <p><RichText text={s.text} /></p>
                  {s.formula && <div className="method-formula"><Tex block>{s.formula}</Tex></div>}
                  {s.example && <div className="method-ex"><b>Exempel:</b> <RichText text={s.example} /></div>}
                  {s.excel && <div className="method-excel"><span className="mono">Excel</span> {s.excel}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <aside className="span-4 stack">
        <section className="card"><div className="card-body">
          <div className="explain-kicker">Vanliga misstag</div>
          <ul className="plain-list">{m.mistakes.map((x) => <li key={x.title}><b>{x.title}.</b> <span className="muted">{x.text}</span></li>)}</ul>
        </div></section>
        {m.levels && <section className="card"><div className="card-body">
          <div className="explain-kicker">Nästa steg</div>
          <p className="muted" style={{ margin: "6px 0 0" }}><RichText text={m.levels} /></p>
        </div></section>}
      </aside>
    </div>
  );
}

// ── Övningar ──
export interface ExStep { q: string; unit: string; answer: number; tol?: number; hint: string; solution: string }
export interface ExCase { story: string; givens: [string, string][]; steps: ExStep[]; takeaway: string }
export interface Exercise { level: 1 | 2 | 3; title: string; skills: string; make: (r: () => number) => ExCase }

/** Hjälp för slumpade men "snygga" siffror. */
export const R = {
  int: (r: () => number, lo: number, hi: number, step = 1) => lo + Math.floor(r() * ((hi - lo) / step + 1)) * step,
  pick: <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)],
};
export const n0 = (v: number) => Math.round(v).toLocaleString("sv-SE").replace("-", "−");
export const n1 = (v: number) => v.toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace("-", "−");
export const n2 = (v: number) => v.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace("-", "−");

function parse(s: string): number {
  const v = s.replace(/\s| /g, "").replace(/[%x×]|mkr|kr|bp/gi, "").replace("−", "-").replace(",", ".");
  return v === "" ? NaN : Number(v);
}

export function Practice({ exercises }: { exercises: Exercise[] }) {
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const list = exercises.filter((e) => e.level === level);
  const [idx, setIdx] = useState(0);
  const [seed, setSeed] = useState(1);
  useEffect(() => setIdx(0), [level]);
  const ex = list[Math.min(idx, list.length - 1)];
  const c = useMemo(() => ex.make(rng(seed * 7919 + level * 31 + idx)), [ex, seed, level, idx]);
  return (
    <div className="grid">
      <section className="card span-12">
        <div className="card-body">
          <div className="level-row">
            {([1, 2, 3] as const).map((l) => (
              <button key={l} className="case level-card" aria-pressed={level === l} onClick={() => setLevel(l)}>
                <span className="tl-when">Nivå {l}</span><b>{l === 1 ? "Grund" : l === 2 ? "Mellan" : "Avancerad"}</b>
                <span>{exercises.filter((e) => e.level === l).map((e) => e.title).join(" · ")}</span>
              </button>
            ))}
          </div>
          {list.length > 1 && (
            <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {list.map((e, i) => <button key={e.title} className="chip" aria-pressed={i === idx} onClick={() => setIdx(i)}>{e.title}</button>)}
            </div>
          )}
        </div>
      </section>
      <ExerciseCard key={`${level}-${idx}-${seed}`} ex={ex} c={c} onNew={() => setSeed(seed + 1)} />
    </div>
  );
}

export function ExerciseCard({ ex, c, onNew }: { ex: Exercise; c: ExCase; onNew: () => void }) {
  const { mode } = useSettings();
  const [vals, setVals] = useState<string[]>(c.steps.map(() => ""));
  const [state, setState] = useState<("" | "ok" | "fel" | "visad")[]>(c.steps.map(() => ""));
  const check = (i: number) => {
    const s = c.steps[i], v = parse(vals[i]);
    const tol = s.tol ?? Math.max(Math.abs(s.answer) * 0.01, 0.05);
    setState((o) => o.map((x, k) => (k === i ? (Number.isFinite(v) && Math.abs(v - s.answer) <= tol ? "ok" : "fel") : x)));
  };
  const show = (i: number) => setState((o) => o.map((x, k) => (k === i ? "visad" : x)));
  const done = state.filter((x) => x === "ok" || x === "visad").length;
  const right = state.filter((x) => x === "ok").length;
  return (
    <>
      <section className="card span-5">
        <div className="card-head"><h2 className="card-title"><span className="idx">N{ex.level}</span>{ex.title}</h2><button className="btn" onClick={onNew}>Nya siffror ↻</button></div>
        <div className="card-body">
          <p style={{ marginTop: 0, lineHeight: 1.6 }}><RichText text={c.story} /></p>
          <table className="data"><tbody>{c.givens.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num"><b>{v}</b></td></tr>)}</tbody></table>
          <p className="dim" style={{ fontSize: 12.5, margin: "10px 0 0" }}>Tränar: {ex.skills}. Skriv svaren med komma eller punkt; enheter behövs inte. Avrundning på ungefär 1 % godkänns.</p>
          <div className="ex-progress"><div style={{ width: `${(done / c.steps.length) * 100}%` }} /></div>
          <p className="mono dim" style={{ fontSize: 12, margin: "6px 0 0" }}>{right} rätt · {done}/{c.steps.length} klara</p>
          {done === c.steps.length && <div className="eli5"><b className="k">Klart! {right === c.steps.length ? "Alla rätt 🎯" : ""}</b><RichText text={c.takeaway} /></div>}
        </div>
      </section>
      <section className="card span-7">
        <div className="card-head"><h2 className="card-title">Räkna steg för steg</h2></div>
        <div className="card-body">
          <ol className="ex-steps">
            {c.steps.map((s, i) => (
              <li key={i} className={`ex-step ${state[i]}`}>
                <div className="ex-q"><span className="ex-n">{i + 1}</span><RichText text={s.q} /></div>
                <div className="ex-input">
                  <input className="name-input" inputMode="decimal" value={vals[i]} placeholder="ditt svar" aria-label={`Svar steg ${i + 1}`}
                    disabled={state[i] === "ok" || state[i] === "visad"}
                    onChange={(e) => setVals((o) => o.map((x, k) => (k === i ? e.target.value : x)))}
                    onKeyDown={(e) => { if (e.key === "Enter") check(i); }} />
                  <span className="dim">{s.unit}</span>
                  {state[i] !== "ok" && state[i] !== "visad" && <><button className="btn" onClick={() => check(i)}>Kolla</button><button className="btn ghost" onClick={() => show(i)}>Visa lösning</button></>}
                  {state[i] === "ok" && <span className="pos">✓ Rätt</span>}
                  {state[i] === "fel" && <span className="neg">Inte riktigt – försök igen</span>}
                </div>
                {state[i] === "fel" && <div className="ex-hint"><b>Tips:</b> <RichText text={s.hint} /></div>}
                {(state[i] === "ok" || state[i] === "visad") && <div className="ex-sol"><RichText text={s.solution} /></div>}
                {mode === "beginner" && state[i] === "" && i === 0 && <div className="ex-hint dim">Fastnar du? Tryck "Visa lösning" – det är också ett sätt att lära sig.</div>}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
