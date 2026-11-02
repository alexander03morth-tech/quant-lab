/**
 * Öva: intervjufrågor, begrepp, slutledning, räkneuppgifter och case. Frågor man har svårt för
 * kommer tillbaka oftare (enkel viktning sparad i webbläsaren). Begrepps- och räknefrågor genereras
 * slumpmässigt, så de tar aldrig slut.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExerciseCard, n0, n1, n2, type Exercise } from "../components/Learn";
import { RichText } from "../components/RichText";
import { Seg } from "../components/Slider";
import { CALC, type CalcQ } from "../content/practice/calc";
import { INTERVIEW, type Track } from "../content/practice/interview";
import { REASONING } from "../content/practice/reasoning";
import { DCF_EX, FUND_EX, LBO_EX, MA_EX } from "../content/models";
import { CONCEPTS } from "../explain/concepts";
import { EXTRAS } from "../explain/extras";
import { useData } from "../lib/data";
import { rng } from "../lib/portfolio/engine";
import { useSettings } from "../lib/settings";

type Tab = "intervju" | "begrepp" | "slutledning" | "rakna" | "case";
type TF = "alla" | Track;
const TRACKS: { value: TF; label: string }[] = [
  { value: "alla", label: "Alla" }, { value: "kvant", label: "Kvant" }, { value: "aktie", label: "Aktieanalys" }, { value: "ib", label: "IB" }, { value: "pe", label: "PE" }, { value: "allmant", label: "Allmänt" },
];
const KEY = "ql.ova.v1";
type Mem = Record<string, number>; // id → svårighetsvikt (1 = ny, högre = svår)
const loadMem = (): Mem => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
const saveMem = (m: Mem) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* privat läge */ } };

let seedCounter = Date.now() % 100000;
const nextRng = () => rng(++seedCounter * 2654435761);
function weightedPick<T extends { id: string }>(xs: T[], mem: Mem, avoid?: string): T {
  const pool = xs.length > 1 ? xs.filter((x) => x.id !== avoid) : xs;
  const w = pool.map((x) => mem[x.id] ?? 1.5);
  let u = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { u -= w[i]; if (u <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
function shuffle<T>(xs: T[]): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const conceptTrack = (id: string): Track => { const t = EXTRAS[id]?.track; return t === "marknad" || t === "portfolj" ? "allmant" : ((t as Track) ?? "kvant"); };

export function PracticeHub() {
  const [sp, setSp] = useSearchParams();
  const tab = (["intervju", "begrepp", "slutledning", "rakna", "case"].includes(sp.get("del") ?? "") ? sp.get("del") : "intervju") as Tab;
  const [track, setTrack] = useState<TF>("alla");
  const [mem, setMem] = useState<Mem>(loadMem);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });
  const rate = (id: string, w: number, correct?: boolean) => {
    const next = { ...mem, [id]: w }; setMem(next); saveMem(next);
    if (correct !== undefined) setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1, streak: correct ? s.streak + 1 : 0 }));
  };
  const go = (t: Tab) => setSp({ del: t }, { replace: true });
  const counts = { intervju: INTERVIEW.length, begrepp: Object.keys(CONCEPTS).length, slutledning: REASONING.length, rakna: CALC.length, case: 13 };

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Öva</span><span className="live">{score.total ? `${score.right}/${score.total} rätt idag · svit ${score.streak}` : "frågorna tar aldrig slut"}</span></div>
          <h1 className="hero-title">Öva tills det sitter</h1>
          <p className="hero-sub" style={{ maxWidth: "76ch" }}>Intervjufrågor, begrepp, slutledning, räkneuppgifter och hela case – för kvant, aktieanalys, IB och PE. Begrepps- och räknefrågorna genereras på nytt varje gång, och det du har svårt för kommer tillbaka oftare.</p>
        </div>
      </div>
      <div className="ova-tabs" role="tablist">
        {([["intervju", "Inför intervjun", "tekniska frågor, beteende, hjärngympa"], ["begrepp", "Begrepp", "vad betyder det?"], ["slutledning", "Slutledning", "vad händer om …?"], ["rakna", "Räkneuppgifter", "nya siffror varje gång"], ["case", "Case", "flera steg, från lätt till svår"]] as const).map(([k, l, d]) => (
          <button key={k} role="tab" aria-selected={tab === k} className="model-tab" onClick={() => go(k)}><b>{l}</b><span>{d} · {k === "begrepp" || k === "rakna" ? "∞" : counts[k]}</span></button>
        ))}
      </div>
      {tab !== "case" && <div className="row" style={{ gap: 10, margin: "12px 0", flexWrap: "wrap" }}><span className="dim" style={{ fontSize: 13 }}>Område</span><Seg label="Område" value={track} onChange={setTrack} options={TRACKS} /></div>}
      {tab === "intervju" && <InterviewMode track={track} mem={mem} rate={rate} />}
      {tab === "begrepp" && <ConceptMode track={track} mem={mem} rate={rate} />}
      {tab === "slutledning" && <ReasonMode track={track} mem={mem} rate={rate} />}
      {tab === "rakna" && <CalcMode track={track} rate={rate} />}
      {tab === "case" && <CaseMode />}
    </div>
  );
}

type RateFn = (id: string, w: number, correct?: boolean) => void;

function InterviewMode({ track, mem, rate }: { track: TF; mem: Mem; rate: RateFn }) {
  const [kind, setKind] = useState<string>("alla");
  const pool = INTERVIEW.filter((q) => (track === "alla" || q.track === track) && (kind === "alla" || q.kind === kind));
  const [cur, setCur] = useState(() => weightedPick(pool.length ? pool : INTERVIEW, mem));
  const [shown, setShown] = useState(false);
  const q = pool.includes(cur) ? cur : pool[0] ?? INTERVIEW[0];
  const next = (w?: number) => { if (w != null) rate(q.id, w, w < 1); setShown(false); setCur(weightedPick(pool.length ? pool : INTERVIEW, { ...mem, ...(w != null ? { [q.id]: w } : {}) }, q.id)); };
  const seen = pool.filter((x) => mem[x.id] != null).length;
  return (
    <div className="grid">
      <section className="card span-8">
        <div className="card-head">
          <h2 className="card-title"><span className="tag neutral">{q.kind}</span> <span className="dim" style={{ fontSize: 13 }}>{TRACKS.find((t) => t.value === q.track)?.label} · nivå {q.level}</span></h2>
          <Seg label="Typ" value={kind} onChange={setKind} options={[{ value: "alla", label: "Alla" }, { value: "Teknisk", label: "Teknisk" }, { value: "Beteende", label: "Beteende" }, { value: "Hjärngympa", label: "Hjärngympa" }, { value: "Marknad", label: "Marknad" }]} />
        </div>
        <div className="card-body">
          <p className="ova-q">{q.q}</p>
          {!shown ? (
            <>
              <p className="muted" style={{ fontSize: 13.5 }}>Svara högt eller skriv stödord innan du tittar – som på en riktig intervju. Försök hålla dig under två minuter.</p>
              <button className="btn primary" onClick={() => setShown(true)}>Visa lösningsförslag</button>
            </>
          ) : (
            <>
              <div className="ova-answer">{q.answer.split("\n").map((l, i) => <p key={i}><RichText text={l} /></p>)}</div>
              {q.lookFor && <div className="eli5"><b className="k">Det intervjuaren letar efter</b>{q.lookFor}</div>}
              <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <span className="dim" style={{ fontSize: 13 }}>Hur gick det?</span>
                <button className="btn" onClick={() => next(3)}>Kunde inte</button>
                <button className="btn" onClick={() => next(1.8)}>Delvis</button>
                <button className="btn" onClick={() => next(0.4)}>Kunde det</button>
              </div>
            </>
          )}
        </div>
      </section>
      <aside className="span-4 stack">
        <section className="card"><div className="card-body">
          <div className="explain-kicker">Din bank</div>
          <p style={{ margin: "6px 0 0" }}><b>{pool.length}</b> frågor i urvalet, <b>{seen}</b> sedda. Frågor du markerat som svåra visas oftare.</p>
          <button className="btn" style={{ marginTop: 10 }} onClick={() => next()}>Hoppa över →</button>
        </div></section>
        <section className="card"><div className="card-body">
          <div className="explain-kicker">Tips inför intervjun</div>
          <ul className="plain-list" style={{ fontSize: 13.5 }}>
            <li>Börja med slutsatsen, förklara sedan.</li>
            <li>Säg dina antaganden högt i räknefrågor.</li>
            <li>Beteendefrågor: STAR – situation, uppgift, handling, resultat.</li>
            <li>Ha två affärer och en aktiepitch förberedda.</li>
          </ul>
        </div></section>
      </aside>
    </div>
  );
}

interface MCQ { id: string; q: string; options: string[]; correct: number; explain: string; concept?: string }

function makeConceptQ(track: TF, mem: Mem, avoid?: string): MCQ {
  const all = Object.values(CONCEPTS).filter((c) => track === "alla" || conceptTrack(c.id) === track);
  const pool = all.length >= 4 ? all : Object.values(CONCEPTS);
  const c = weightedPick(pool, mem, avoid);
  const others = shuffle(pool.filter((x) => x.id !== c.id)).slice(0, 3);
  const strip = (s: string) => s.replace(/\*\*/g, "").replace(/\$[^$]*\$/g, "…");
  const types = ["def", "term", ...(c.en ? ["en"] : []), ...(EXTRAS[c.id]?.analogy ? ["analogy"] : [])];
  const t = types[Math.floor(Math.random() * types.length)];
  const hide = (s: string) => { let out = strip(s); for (const w of [c.title, ...c.title.split(/[ ()/]+/).filter((x) => x.length > 4)]) out = out.split(w).join("___"); return out; };
  let q: string, opts: string[];
  if (t === "def") { q = `Vilket begrepp beskrivs?\n\n”${hide(c.what)}”`; opts = [c.title, ...others.map((o) => o.title)]; }
  else if (t === "analogy") { q = `Vilket begrepp passar liknelsen?\n\n”${hide(EXTRAS[c.id]!.analogy!)}”`; opts = [c.title, ...others.map((o) => o.title)]; }
  else if (t === "en") { const withEn = others.filter((o) => o.en); q = `Vad heter **${c.title}** på engelska?`; opts = [c.en!, ...(withEn.length >= 3 ? withEn : shuffle(pool.filter((x) => x.en && x.id !== c.id)).slice(0, 3)).slice(0, 3).map((o) => o.en!)]; }
  else { q = `Vad betyder **${c.title}**?`; opts = [strip(c.what), ...others.map((o) => strip(o.what))]; }
  const order = shuffle([0, 1, 2, 3].slice(0, opts.length));
  return { id: c.id, q, options: order.map((i) => opts[i]), correct: order.indexOf(0), explain: `**${c.title}**${c.en ? ` (${c.en})` : ""}: ${c.what}${EXTRAS[c.id]?.worked ? `\n\n**Exempel:** ${EXTRAS[c.id]!.worked}` : ""}`, concept: c.id };
}

function MCCard({ q, onAnswer, onNext, rateIt }: { q: MCQ; onAnswer: (ok: boolean) => void; onNext: () => void; rateIt?: ReactNode }) {
  const [ans, setAns] = useState<number | null>(null);
  const { openExplain } = useSettings();
  const ok = ans === q.correct;
  return (
    <section className="card span-8">
      <div className="card-body">
        <div className="ova-q">{q.q.split("\n").map((l, i) => (l ? <p key={i} style={{ margin: "0 0 6px" }}><RichText text={l} /></p> : null))}</div>
        <div className="quiz-opts">
          {q.options.map((o, i) => (
            <button key={i} className={`quiz-opt ${ans == null ? "" : i === q.correct ? "right" : i === ans ? "wrong" : "dimmed"}`} disabled={ans != null}
              onClick={() => { setAns(i); onAnswer(i === q.correct); }}><RichText text={o} /></button>
          ))}
        </div>
        {ans != null && (
          <>
            <div className={`eli5`} style={{ marginTop: 12 }}><b className="k">{ok ? "Rätt!" : "Inte riktigt"}</b>{q.explain.split("\n").map((l, i) => (l ? <p key={i} style={{ margin: "4px 0" }}><RichText text={l} /></p> : null))}</div>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn primary" onClick={onNext}>Nästa fråga →</button>
              {q.concept && <button className="btn" onClick={() => openExplain(q.concept!)}>Läs mer om begreppet</button>}
              {rateIt}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ConceptMode({ track, mem, rate }: { track: TF; mem: Mem; rate: RateFn }) {
  const [q, setQ] = useState(() => makeConceptQ(track, mem));
  const [key, setKey] = useState(0);
  const cur = useMemo(() => q, [q]);
  const next = () => { setQ(makeConceptQ(track, mem, cur.id)); setKey(key + 1); };
  // byt fråga när området ändras
  const [lastTrack, setLastTrack] = useState(track);
  if (lastTrack !== track) { setLastTrack(track); setQ(makeConceptQ(track, mem)); setKey(key + 1); }
  return (
    <div className="grid">
      <MCCard key={key} q={cur} onAnswer={(ok) => rate(cur.id, ok ? Math.max(0.4, (mem[cur.id] ?? 1.5) * 0.6) : 3, ok)} onNext={next} />
      <aside className="span-4 stack"><section className="card"><div className="card-body">
        <div className="explain-kicker">Så funkar det</div>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>Frågorna skapas från alla {Object.keys(CONCEPTS).length} begrepp i <Link to="/ordlista">ordlistan</Link>: definitioner, liknelser och engelska termer. Begrepp du svarar fel på kommer tillbaka oftare.</p>
      </div></section></aside>
    </div>
  );
}

function ReasonMode({ track, mem, rate }: { track: TF; mem: Mem; rate: RateFn }) {
  const pool = REASONING.filter((q) => track === "alla" || q.track === track);
  const build = (avoid?: string): MCQ => {
    const r = weightedPick(pool.length ? pool : REASONING, mem, avoid);
    const order = shuffle(r.options.map((_, i) => i));
    return { id: r.id, q: r.q, options: order.map((i) => r.options[i]), correct: order.indexOf(r.correct), explain: r.why };
  };
  const [q, setQ] = useState(() => build());
  const [key, setKey] = useState(0);
  const [lastTrack, setLastTrack] = useState(track);
  if (lastTrack !== track) { setLastTrack(track); setQ(build()); setKey(key + 1); }
  return (
    <div className="grid">
      <MCCard key={key} q={q} onAnswer={(ok) => rate(q.id, ok ? 0.5 : 3, ok)} onNext={() => { setQ(build(q.id)); setKey(key + 1); }} />
      <aside className="span-4 stack"><section className="card"><div className="card-body">
        <div className="explain-kicker">Tänk i orsak och verkan</div>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>Slutledningsfrågor testar förståelse, inte räknande: vad händer med värdet, risken eller avkastningen när något ändras? Det är exakt vad intervjuare frågar för att se om du förstår modellerna. {pool.length} frågor i urvalet.</p>
      </div></section></aside>
    </div>
  );
}

function CalcMode({ track, rate }: { track: TF; rate: RateFn }) {
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  const pool = CALC.filter((g) => (track === "alla" || g.track === track) && (level === 0 || g.level === level));
  const make = () => { const g = pool.length ? pool[Math.floor(Math.random() * pool.length)] : CALC[0]; return { g, c: g.make(nextRng()) }; };
  const [cur, setCur] = useState(make);
  const [val, setVal] = useState("");
  const [st, setSt] = useState<"" | "ok" | "fel" | "visad">("");
  const [lastKey, setLastKey] = useState(`${track}-${level}`);
  if (lastKey !== `${track}-${level}`) { setLastKey(`${track}-${level}`); setCur(make()); setVal(""); setSt(""); }
  const c: CalcQ = cur.c;
  const check = () => {
    const v = Number(val.replace(/\s/g, "").replace(/[%x×]|kr|mkr/gi, "").replace("−", "-").replace(",", "."));
    const tol = c.tol ?? Math.max(Math.abs(c.answer) * 0.01, 0.05);
    const ok = Number.isFinite(v) && Math.abs(v - c.answer) <= tol;
    setSt(ok ? "ok" : "fel");
    if (ok) rate(`calc-${cur.g.id}`, 0.5, true); else rate(`calc-${cur.g.id}`, 3, false);
  };
  const next = () => { setCur(make()); setVal(""); setSt(""); };
  const fmtAns = Math.abs(c.answer) >= 100 ? n0(c.answer) : Math.abs(c.answer) >= 10 ? n1(c.answer) : n2(c.answer);
  return (
    <div className="grid">
      <section className="card span-8">
        <div className="card-head"><h2 className="card-title"><span className="tag neutral">{cur.g.title}</span> <span className="dim" style={{ fontSize: 13 }}>nivå {cur.g.level}</span></h2>
          <Seg label="Nivå" value={level} onChange={setLevel} options={[{ value: 0, label: "Alla" }, { value: 1, label: "Grund" }, { value: 2, label: "Mellan" }]} /></div>
        <div className="card-body">
          <p className="ova-q"><RichText text={c.q} /></p>
          <div className="ex-input" style={{ marginLeft: 0 }}>
            <input className="name-input" style={{ width: 180, flex: "0 0 180px" }} inputMode="decimal" value={val} placeholder="ditt svar" aria-label="Svar"
              disabled={st === "ok" || st === "visad"} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (st === "ok" || st === "visad" ? next() : check()); }} />
            <span className="dim">{c.unit}</span>
            {st !== "ok" && st !== "visad" && <><button className="btn primary" onClick={check}>Kolla</button><button className="btn ghost" onClick={() => setSt("visad")}>Visa lösning</button></>}
            {st === "ok" && <span className="pos">✓ Rätt</span>}
            {st === "fel" && <span className="neg">Inte riktigt – försök igen</span>}
          </div>
          {st === "fel" && <div className="ex-hint" style={{ marginLeft: 0 }}><b>Tips:</b> <RichText text={c.hint} /></div>}
          {(st === "ok" || st === "visad") && (
            <>
              <div className="ex-sol" style={{ marginLeft: 0 }}><b>Svar: {fmtAns} {c.unit}</b><br /><RichText text={c.solution} /></div>
              <button className="btn primary" style={{ marginTop: 12 }} onClick={next}>Ny uppgift →</button>
            </>
          )}
        </div>
      </section>
      <aside className="span-4 stack"><section className="card"><div className="card-body">
        <div className="explain-kicker">{pool.length} uppgiftstyper</div>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>Siffrorna slumpas varje gång. Avrundning på ungefär 1 % godkänns. Tryck Enter för att kolla och Enter igen för nästa uppgift.</p>
        <div className="row" style={{ gap: 4, flexWrap: "wrap", marginTop: 8 }}>{pool.map((g) => <span key={g.id} className="chip" style={{ fontSize: 11.5, cursor: "default" }}>{g.title}</span>)}</div>
      </div></section></aside>
    </div>
  );
}

/** Par-case med riktig data: ett slumpat samintegrerat par ur dagens statistik. */
function usePairCase(): Exercise {
  const { pairs, name } = useData();
  return useMemo(() => ({
    level: 2, title: "Par-case med riktig data", skills: "multipel testning, half-life, positionsstorlek, kostnader",
    make: (r) => {
      const cands = pairs.pairs.filter((p) => p.w["3Y"] && p.w["3Y"]!.p < 0.05 && p.w["3Y"]!.hl != null && p.w["3Y"]!.hl! > 2 && p.w["3Y"]!.hl! < 80 && p.w["3Y"]!.beta > 0.2);
      const p = cands[Math.floor(r() * cands.length)] ?? pairs.pairs[0];
      const w = p.w["3Y"]!; const [y, x] = w.dep === "a" ? [p.a, p.b] : [p.b, p.a];
      const z = Math.abs(w.z) >= 0.5 ? w.z : 2.2 * (r() < 0.5 ? -1 : 1), hl = w.hl!, n = pairs.pairs.length, cap = 100000, cost = 10;
      const shortAmt = w.beta * cap, gross = cap + shortAmt, costKr = 4 * (cost / 1e4) * gross;
      return {
        story: `Ur dagens statistik: **${name(y)} / ${name(x)}** är samintegrerade på 3 år med p = ${w.p.toLocaleString("sv-SE")}, half-life **${n1(hl)} dagar**, hedge ratio β = **${n2(w.beta)}** och z-score just nu **${n2(z)}**${Math.abs(w.z) < 0.5 ? " (tänkt läge för övningen)" : ""}. ${n} par testades.`,
        givens: [["Par (y / x)", `${name(y)} / ${name(x)}`], ["p-värde 3 år", w.p.toLocaleString("sv-SE")], ["Half-life", `${n1(hl)} d`], ["β", n2(w.beta)], ["z nu", n2(z)], ["Antal testade par", String(n)], ["Kapital i y", "100 000 kr"], ["Kostnad", "10 bp per transaktion"]],
        steps: [
          { q: `Hur många av de ${n} paren väntas få p < 0,05 av ren slump?`, unit: "par", answer: n * 0.05, tol: 0.6, hint: "Antal × 5 %.", solution: `$${n} \\times 0{,}05 = ${n1(n * 0.05)}$ par. Därför räcker inte p < 0,05 ensamt.` },
          { q: `Om spreaden återgår som half-life säger, ungefär vilket z väntas om ${n1(hl)} dagar?`, unit: "", answer: z / 2, tol: 0.05, hint: "Avvikelsen halveras på en half-life.", solution: `$${n2(z)}/2 = ${n2(z / 2)}$.` },
          { q: `… och om ${n1(2 * hl)} dagar?`, unit: "", answer: z / 4, tol: 0.05, hint: "Två half-lives → en fjärdedel kvar.", solution: `$${n2(z)}/4 = ${n2(z / 4)}$.` },
          { q: `Du ${z > 0 ? "blankar" : "köper"} ${name(y)} för 100 000 kr. Hur mycket ${name(x)} ska du ${z > 0 ? "köpa" : "blanka"}?`, unit: "kr", answer: shortAmt, hint: "β × 100 000.", solution: `$${n2(w.beta)} \\times 100\\,000 = ${n0(shortAmt)}$ kr. Signalen: z ${z > 0 ? "> 0 → y dyr → sälj y, köp x" : "< 0 → y billig → köp y, blanka x"}.` },
          { q: "Vad kostar en hel affär (öppna + stänga båda benen) i courtage och spread?", unit: "kr", answer: costKr, tol: Math.max(2, costKr * 0.02), hint: "4 transaktioner × 10 bp × bruttoexponering (båda benen).", solution: `Brutto $= 100\\,000 + ${n0(shortAmt)} = ${n0(gross)}$. $4 \\times 0{,}001 \\times ${n0(gross)} = ${n0(costKr)}$ kr.` },
        ],
        takeaway: `Öppna ${name(y)} / ${name(x)} i Paranalys för att se om sambandet har varit stabilt över tid – p-värdet ensamt säger lite när ${n} par testas.`,
      };
    },
  }), [pairs, name]);
}

function CaseMode() {
  const pairCase = usePairCase();
  const groups: { name: string; list: Exercise[] }[] = [
    { name: "Kvant", list: [pairCase] }, { name: "PE · LBO", list: LBO_EX }, { name: "IB · M&A", list: MA_EX }, { name: "Aktie · DCF", list: DCF_EX }, { name: "PE · Fond", list: FUND_EX },
  ];
  const flat = groups.flatMap((g) => g.list.map((e) => ({ g: g.name, e })));
  const [i, setI] = useState(0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const cur = flat[i];
  const c = useMemo(() => cur.e.make(rng(seed)), [cur, seed]);
  return (
    <div className="grid">
      <section className="card span-12"><div className="card-body">
        <div className="case-pick">
          {groups.map((g) => (
            <div key={g.name}><div className="explain-kicker" style={{ marginBottom: 6 }}>{g.name}</div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {g.list.map((e) => { const k = flat.findIndex((f) => f.e === e); return <button key={e.title} className="chip" aria-pressed={k === i} onClick={() => { setI(k); setSeed(Math.floor(Math.random() * 1e6)); }}>N{e.level} · {e.title}</button>; })}
              </div></div>
          ))}
        </div>
        <p className="dim" style={{ fontSize: 12.5, margin: "10px 0 0" }}>Varje case slumpar nya siffror när du trycker "Nya siffror". Vill du läsa metoden först finns "Så görs den" i <Link to="/pe/lbo?del=metod">LBO</Link>, <Link to="/ib/ma?del=metod">M&A</Link>, <Link to="/aktie/dcf?del=metod">DCF</Link> och <Link to="/pe/fond?del=metod">Fondekonomi</Link>.</p>
      </div></section>
      <ExerciseCard key={`${i}-${seed}`} ex={cur.e} c={c} onNew={() => setSeed(seed + 1)} />
    </div>
  );
}
