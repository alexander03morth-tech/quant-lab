import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PATHS, type Step } from "../content/academy";
import { CONCEPTS } from "../explain/concepts";
import { useSettings } from "../lib/settings";

const KEY = "ql.academy.v1";
function loadDone(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

export function AcademyView() {
  const [sp, setSp] = useSearchParams();
  const pid = PATHS.some((p) => p.id === sp.get("spar")) ? sp.get("spar")! : "grund";
  const path = PATHS.find((p) => p.id === pid)!;
  const [done, setDone] = useState<Record<string, boolean>>(loadDone);
  const firstOpen = path.steps.find((s) => !done[s.id])?.id ?? path.steps[0].id;
  const [open, setOpen] = useState<string>(firstOpen);
  useEffect(() => { setOpen(path.steps.find((s) => !done[s.id])?.id ?? path.steps[0].id); /* byt spår → första ej klara steg */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);
  const mark = (id: string, v: boolean) => {
    const next = { ...done, [id]: v };
    setDone(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* privat läge */ }
  };
  const total = PATHS.reduce((s, p) => s + p.steps.length, 0);
  const nDone = PATHS.reduce((s, p) => s + p.steps.filter((x) => done[x.id]).length, 0);

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Akademin</span><span className="live">{nDone} av {total} steg klara</span></div>
          <h1 className="hero-title">Lär dig kvant, aktieanalys, IB och PE</h1>
          <p className="hero-sub" style={{ maxWidth: "74ch" }}>Korta steg i rätt ordning. Varje steg tar några minuter: läs tre meningar, prova själv i verktyget och svara på en kontrollfråga. Begreppen öppnas med exempel när du klickar på dem.</p>
          <div className="academy-progress"><div style={{ width: `${(nDone / total) * 100}%` }} /></div>
        </div>
      </div>

      <div className="path-grid">
        {PATHS.map((p) => {
          const d = p.steps.filter((x) => done[x.id]).length;
          return (
            <button key={p.id} className="case path-card" aria-pressed={p.id === pid} onClick={() => setSp({ spar: p.id }, { replace: true })}>
              <span className="tl-when">{p.kicker}</span>
              <b>{p.title}</b>
              <span>{p.blurb}</span>
              <span className="path-meter"><i style={{ width: `${(d / p.steps.length) * 100}%` }} /></span>
              <span className="mono dim" style={{ fontSize: 11.5 }}>{d}/{p.steps.length} steg · {p.steps.reduce((s, x) => s + x.mins, 0)} min</span>
            </button>
          );
        })}
      </div>

      <ol className="timeline" style={{ marginTop: 18 }}>
        {path.steps.map((s, i) => (
          <li key={s.id} className="tl-step">
            <div className={`tl-dot ${done[s.id] ? "done" : ""}`}>{done[s.id] ? "✓" : String(i + 1).padStart(2, "0")}</div>
            {open === s.id
              ? <StepCard step={s} done={!!done[s.id]} onDone={(v) => { mark(s.id, v); if (v) { const nxt = path.steps[i + 1]; if (nxt) setOpen(nxt.id); } }} />
              : (
                <button className="tl-card step-collapsed" onClick={() => setOpen(s.id)}>
                  <span className="tl-title" style={{ margin: 0 }}>{s.title}</span>
                  <span className="mono dim" style={{ fontSize: 12 }}>{s.mins} min{done[s.id] ? " · klar" : ""}</span>
                </button>
              )}
          </li>
        ))}
      </ol>
      {path.steps.every((s) => done[s.id]) && (
        <div className="eli5" style={{ marginTop: 16 }}><b className="k">Spåret klart</b>Snyggt! Fortsätt med nästa spår ovan, eller öppna <Link to="/ordlista">ordlistan</Link> för att repetera begreppen.</div>
      )}
    </div>
  );
}

function StepCard({ step, done, onDone }: { step: Step; done: boolean; onDone: (v: boolean) => void }) {
  const { openExplain } = useSettings();
  const [ans, setAns] = useState<number | null>(null);
  useEffect(() => setAns(null), [step.id]);
  const right = ans === step.quiz.correct;
  return (
    <div className="tl-card step-open">
      <div className="tl-when">{step.mins} min</div>
      <div className="tl-title">{step.title}</div>
      <p>{step.text}</p>
      <div className="row" style={{ gap: 6, flexWrap: "wrap", margin: "10px 0 4px" }}>
        {step.concepts.map((c) => <button key={c} className="chip" onClick={() => openExplain(c)}>{CONCEPTS[c]?.title ?? c}</button>)}
      </div>
      <div className="step-task">
        <span className="explain-kicker">Prova själv</span>
        <span>{step.task}</span>
        <Link className="btn" to={step.link.to}>Öppna {step.link.label} →</Link>
      </div>
      <div className="step-quiz">
        <span className="explain-kicker">Kontrollfråga</span>
        <b>{step.quiz.q}</b>
        <div className="quiz-opts">
          {step.quiz.options.map((o, i) => (
            <button key={o} className={`quiz-opt ${ans == null ? "" : i === step.quiz.correct ? "right" : i === ans ? "wrong" : "dimmed"}`} disabled={ans != null && right} onClick={() => { setAns(i); if (i === step.quiz.correct && !done) onDone(true); }}>{o}</button>
          ))}
        </div>
        {ans != null && <p className={right ? "pos" : "neg"} style={{ margin: "8px 0 0" }}>{right ? "Rätt! " : "Inte riktigt – prova igen. "}<span className="muted">{right ? step.quiz.why : ""}</span></p>}
      </div>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
        <button className="btn" onClick={() => onDone(!done)}>{done ? "Markera som ej klar" : "Markera som klar"}</button>
      </div>
    </div>
  );
}
