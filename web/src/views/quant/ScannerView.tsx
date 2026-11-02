import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric } from "../../components/Metric";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Seg, Slider } from "../../components/Slider";
import { useData } from "../../lib/data";
import { fmt, fmtDays, fmtP, fmtPct, fmtSigned } from "../../lib/format";

import type { WindowKey } from "../../lib/types";

type SortKey = "p" | "q" | "hl" | "hurst" | "corr" | "stab" | "z";
const COLS: { key: SortKey; label: string; info: string; asc: boolean }[] = [
  { key: "p", label: "EG p", info: "cointegration", asc: true },
  { key: "q", label: "q", info: "multiple-testing", asc: true },
  { key: "hl", label: "Half-life", info: "half-life", asc: true },
  { key: "hurst", label: "Hurst", info: "hurst", asc: true },
  { key: "corr", label: "Korr.", info: "correlation", asc: false },
  { key: "stab", label: "Stabilitet", info: "stability", asc: false },
  { key: "z", label: "z nu", info: "zscore", asc: false },
];

export function ScannerView() {
  const { pairs, meta, name } = useData();
  const nav = useNavigate();
  const [w, setW] = useState<WindowKey>("3Y");
  const [maxP, setMaxP] = useState(0.05);
  const [maxHl, setMaxHl] = useState(60);
  const [minCorr, setMinCorr] = useState(0.3);
  const [minBeta, setMinBeta] = useState(0.3);
  const [sect, setSect] = useState<"all" | "same">("all");
  const [joh, setJoh] = useState<"any" | "yes">("any");
  const [sort, setSort] = useState<SortKey>("p");
  const [shown, setShown] = useState(25);
  const sector = (t: string) => meta.stocks.find((s) => s.ticker === t)?.sector ?? "";

  const rows = useMemo(() => pairs.pairs.flatMap((p) => {
    const s = p.w[w];
    if (!s) return [];
    const [y, x] = s.dep === "a" ? [p.a, p.b] : [p.b, p.a];
    return [{ y, x, s, stab: p.stab, same: sector(p.a) === sector(p.b), johOk: s.joh0 > s.joh0c }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pairs, w]);

  const pass = useMemo(() => rows.filter((r) =>
    r.s.p <= maxP && (r.s.hl ?? Infinity) <= maxHl && r.s.corr >= minCorr && (sect === "all" || r.same) && (joh === "any" || r.johOk) && r.s.beta >= Math.max(minBeta, 1e-9),
  ), [rows, maxP, maxHl, minCorr, sect, joh, minBeta]);

  // dominerar en enskild aktie listan? (då är det oftast aktien själv som rört sig i ett band, inte paret)
  const dom = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of pass) { c[r.y] = (c[r.y] ?? 0) + 1; c[r.x] = (c[r.x] ?? 0) + 1; }
    const top = Object.entries(c).sort((u, v) => v[1] - u[1])[0];
    return top && pass.length >= 8 && top[1] / pass.length > 0.35 ? { t: top[0], n: top[1] } : null;
  }, [pass]);

  const sorted = useMemo(() => {
    const col = COLS.find((c) => c.key === sort)!;
    const val = (r: (typeof rows)[number]) => sort === "stab" ? r.stab ?? -1 : sort === "z" ? Math.abs(r.s.z) : sort === "hl" ? r.s.hl ?? Infinity : sort === "q" ? r.s.q ?? 1 : (r.s as any)[sort];
    return [...pass].sort((a, b) => (col.asc ? val(a) - val(b) : val(b) - val(a)));
  }, [pass, sort]);

  const nTested = rows.length;
  const nSig = rows.filter((r) => r.s.p < 0.05).length;
  const nQ = rows.filter((r) => (r.s.q ?? 1) < 0.05).length;
  const expected = nTested * 0.05;
  const signalNow = pass.filter((r) => Math.abs(r.s.z) >= 2).length;
  const ctx = { nTested, nSig, expected };
  const winLabel = w === "1Y" ? "1 år" : w === "3Y" ? "3 år" : "5 år";

  // ── grafer ──
  const passSet = new Set(pass.map((r) => r.y + r.x));
  const pts = rows.filter((r) => r.s.hl != null && r.s.hl > 0);
  const col = (r: (typeof rows)[number]) => (passSet.has(r.y + r.x) ? cssVar("--accent") : cssVar("--text-3"));
  const label = (r: (typeof rows)[number]) => `${name(r.y)} / ${name(r.x)}`;
  const hov = pts.map((r) => `<b>${label(r)}</b><br>p = ${fmtP(r.s.p)} · half-life ${fmtDays(r.s.hl)}<br>stabilitet ${r.stab == null ? "–" : fmtPct(r.stab, 0)} · z ${fmtSigned(r.s.z, 2)}`);
  const scatter: Data[] = [{
    type: "scatter", mode: "markers", x: pts.map((r) => r.s.p), y: pts.map((r) => r.s.hl), text: hov as any, hovertemplate: "%{text}<extra></extra>",
    marker: { size: pts.map((r) => 5 + Math.min(10, Math.abs(r.s.z) * 3)), color: pts.map(col), opacity: pts.map((r) => (passSet.has(r.y + r.x) ? 0.95 : 0.35)), line: { width: 0 } },
    customdata: pts.map((r) => [r.y, r.x]) as any,
  }];
  const vline = (x: number, color: string, dash: string) => ({ type: "line", xref: "x", yref: "paper", x0: x, x1: x, y0: 0, y1: 1, line: { color, width: 1, dash } });
  const s3d: Data[] = [{
    type: "scatter3d", mode: "markers", x: pts.map((r) => -Math.log10(r.s.p)), y: pts.map((r) => Math.min(r.s.hl!, 200)), z: pts.map((r) => r.stab ?? 0),
    text: hov as any, hovertemplate: "%{text}<extra></extra>", customdata: pts.map((r) => [r.y, r.x]) as any,
    marker: { size: pts.map((r) => (passSet.has(r.y + r.x) ? 6 : 3)), color: pts.map(col), opacity: 0.85, line: { width: 0 } },
  } as any];
  const open = (pt: any) => { const c = pt?.customdata; if (c) nav(`/par/${c[0]}/${c[1]}`); };

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Parscanner · OMXS30</span><span className="live">{nTested} par · data t.o.m. {pairs.asOf}</span></div>
          <h1 className="hero-title">Hitta par att testa</h1>
          <p className="hero-sub" style={{ maxWidth: "76ch" }}>Alla {nTested} möjliga par bland de 30 aktierna är testade i förväg. Filtrera fram de som ser lovande ut – men kom ihåg att när man testar så många kommer en del att se bra ut helt av slump.</p>
        </div>
      </div>

      <div className="stack">
        <div className="notice"><span className="icon">!</span>
          <span><b>{nSig} par</b> har p &lt; 0,05 på {winLabel}. Om inga par alls var samintegrerade skulle man ändå vänta sig ungefär <b>{fmt(expected, 0)}</b> sådana av ren slump. Efter korrigering för många test (q &lt; 0,05) återstår <b>{nQ}</b>. Se listan som en lista över kandidater att undersöka – inte som färdiga affärer. <Info id="multiple-testing" ctx={ctx} /></span>
        </div>

        <div className="metrics">
          <Metric label="Klarar filtret" value={pass.length} sub={`av ${nTested}`} />
          <Metric label="p < 0,05" info="p-value" ctx={ctx} value={nSig} sub={`slumpen ger ~${fmt(expected, 0)}`} tone={nSig > expected * 1.5 ? "good" : "mid"} toneLabel={nSig > expected * 1.5 ? "fler än slump" : "nära slump"} />
          <Metric label="q < 0,05" info="multiple-testing" ctx={ctx} value={nQ} sub="efter korrigering" />
          <Metric label="Signal nu (|z| ≥ 2)" info="zscore" value={signalNow} sub="bland filtrerade" />
        </div>

        <section className="card">
          <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Filter</h2>
            <div className="card-tools">
              <Seg label="Fönster" value={w} onChange={(v) => { setW(v); setShown(25); }} options={[{ value: "1Y", label: "1 år" }, { value: "3Y", label: "3 år" }, { value: "5Y", label: "5 år" }]} />
            </div>
          </div>
          <div className="card-body">
            <div className="grid" style={{ gap: "10px 22px" }}>
              <div className="span-3"><div className="slider-head"><span className="label">Max p-värde <Info id="p-value" /></span></div>
                <Seg label="Max p" value={maxP} onChange={setMaxP} options={[{ value: 0.01, label: "0,01" }, { value: 0.05, label: "0,05" }, { value: 0.1, label: "0,10" }, { value: 1, label: "alla" }]} /></div>
              <div className="span-3"><Slider label="Max half-life" info="half-life" value={maxHl} min={5} max={250} step={5} onChange={setMaxHl} format={(v) => (v >= 250 ? "alla" : `${v} d`)} /></div>
              <div className="span-3"><Slider label="Min korrelation" info="correlation" value={minCorr} min={0} max={0.8} step={0.05} onChange={setMinCorr} format={(v) => fmt(v, 2)} /></div>
              <div className="span-3"><Slider label="Min β" info="hedge-ratio" value={minBeta} min={0} max={1} step={0.05} onChange={setMinBeta} format={(v) => fmt(v, 2)} /></div>
              <div className="span-3"><div className="slider-head"><span className="label">Sektor</span></div>
                <Seg label="Sektor" value={sect} onChange={setSect} options={[{ value: "all", label: "Alla" }, { value: "same", label: "Samma" }]} /></div>
              <div className="span-3"><div className="slider-head"><span className="label">Johansen <Info id="johansen" /></span></div>
                <Seg label="Johansen" value={joh} onChange={setJoh} options={[{ value: "any", label: "Alla" }, { value: "yes", label: "Bekräftar" }]} /></div>
            </div>
          </div>
        </section>

        {dom && (
          <div className="notice"><span className="icon">!</span>
            <span><b>{name(dom.t)}</b> finns i {dom.n} av {pass.length} par. Då är det oftast den aktien själv som har rört sig i ett band under perioden – den andra aktien gör nästan ingenting i "paret". Höj <i>Min β</i> eller titta på stabiliteten innan du litar på de paren.</span>
          </div>
        )}

        <section className="card">
          <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Kandidater</h2><span className="dim" style={{ fontSize: 12 }}>klicka på en rad för full analys · klicka på en rubrik för att sortera</span></div>
          <div className="card-body" style={{ overflowX: "auto" }}>
            {sorted.length === 0 ? <p className="muted">Inga par klarar filtret. Lätta på kraven, t.ex. högre p-värde eller längre half-life.</p> : (
              <table className="data">
                <thead><tr>
                  <th>Par (y / x)</th>
                  {COLS.map((c) => <th key={c.key} className="num"><button className="th-sort" aria-pressed={sort === c.key} onClick={() => setSort(c.key)}>{c.label}{sort === c.key ? (c.asc ? " ↑" : " ↓") : ""}</button></th>)}
                  <th className="num">β</th>
                </tr></thead>
                <tbody>
                  {sorted.slice(0, shown).map((r) => (
                    <tr key={r.y + r.x} className="row-link" onClick={() => nav(`/par/${r.y}/${r.x}`)}>
                      <td><span className="row" style={{ gap: 6 }}><span className="sector-dot" data-s={sector(r.y)} /><span className="sector-dot" data-s={sector(r.x)} />{name(r.y)} / {name(r.x)}</span></td>
                      <td className="num">{fmtP(r.s.p)}</td>
                      <td className={`num ${(r.s.q ?? 1) < 0.05 ? "pos" : (r.s.q ?? 1) < 0.2 ? "" : "dim"}`}>{r.s.q == null ? "–" : fmt(r.s.q, 2)}</td>
                      <td className={`num ${r.s.hl != null && r.s.hl <= 30 ? "pos" : ""}`}>{fmtDays(r.s.hl)}</td>
                      <td className="num">{fmt(r.s.hurst, 2)}</td>
                      <td className="num">{fmt(r.s.corr, 2)}</td>
                      <td className={`num ${(r.stab ?? 0) >= 0.3 ? "pos" : "dim"}`}>{r.stab == null ? "–" : fmtPct(r.stab, 0)}</td>
                      <td className={`num ${Math.abs(r.s.z) >= 2 ? (r.s.z > 0 ? "neg" : "pos") : "dim"}`}>{fmtSigned(r.s.z, 2)}</td>
                      <td className="num dim">{fmt(r.s.beta, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {sorted.length > shown && <button className="btn" style={{ marginTop: 10 }} onClick={() => setShown(shown + 50)}>Visa fler ({sorted.length - shown} kvar)</button>}
          </div>
          <Caption>Grönt = bra värde. <b>Stabilitet</b> är andelen ettårsfönster de senaste fem åren där paret var signifikant – det bästa skyddet mot slumpträffar. <b>z nu</b> visar om spreaden just nu är ovanligt långt från sitt medel (grönt = köp spreaden, rött = sälj).</Caption>
        </section>

        <div className="grid">
          <section className="card span-6">
            <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Alla par: p-värde mot half-life</h2></div>
            <div className="card-body"><Plot ariaLabel="Spridningsdiagram: p-värde mot half-life för alla par" data={scatter} height={380} onClick={open}
              layout={{ hovermode: "closest", xaxis: { type: "log", title: { text: "EG p-värde (log)" }, showspikes: false } as any, yaxis: { type: "log", title: { text: "Half-life, dagar (log)" }, side: "left" } as any, shapes: [vline(0.05, cssVar("--primary"), "dash"), vline(0.05 / nTested, cssVar("--pos"), "dot")] as any }} /></div>
            <Caption>Varje prick är ett par; ljusa prickar klarar dina filter, större prick = större |z| just nu. Bästa hörnet är <b>nere till vänster</b>: lågt p och snabb återgång. Streckad linje = p 0,05; prickad = den mycket hårdare gränsen 0,05/{nTested} (Bonferroni).</Caption>
          </section>
          <section className="card span-6 lab3d">
            <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Parrymden i 3D</h2><span className="dim" style={{ fontSize: 12 }}>dra för att rotera · klicka på ett par</span></div>
            <div className="card-body"><Plot ariaLabel="3D: styrka, half-life och stabilitet för alla par" data={s3d} height={380} onClick={open}
              layout={scene3d({ x: "Styrka (−log₁₀ p)", y: "Half-life (d)", z: "Stabilitet" }, { zaxis: { tickformat: ".0%" }, camera: { eye: { x: 1.6, y: -1.5, z: 0.8 } } } as any)} /></div>
            <Caption>Samma par i tre dimensioner. Leta efter prickar <b>långt ut på styrka, lågt på half-life och högt på stabilitet</b> – de är signifikanta, snabba och har hållit i flera år.</Caption>
          </section>
        </div>
        <p className="dim" style={{ fontSize: 12.5 }}>Statistiken räknas varje kväll i Python (statsmodels) på data t.o.m. {pairs.asOf}. Riktning (vilken aktie som är y) väljs efter lägst p.</p>
      </div>
    </div>
  );
}
