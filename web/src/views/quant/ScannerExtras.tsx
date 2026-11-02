/** Fördjupning i Parscannern: dagens signaler, robusta par, p-värdesfördelning, parnätverk och guide. */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";

import { Info } from "../../components/Info";
import { cssVar, Plot } from "../../components/Plot";
import { alignedPair, useData } from "../../lib/data";
import { fmt, fmtDays, fmtP, fmtPct, fmtSigned } from "../../lib/format";
import { sectorColor, short } from "../../lib/market";
import type { PairRow, PairWindowStats, WindowKey } from "../../lib/types";

export interface ScanRow { y: string; x: string; s: PairWindowStats; stab: number | null; same: boolean; johOk: boolean }

export function ScannerGuide() {
  const steps = [
    ["Filtrera", "Börja strängt: p < 0,05, half-life under 60 dagar och β över 0,3. Det ger par som verkar hänga ihop och återgår inom rimlig tid."],
    ["Kolla stabiliteten", "Ett par som bara varit signifikant ett av fem år är troligen slump. Stabilitet över 30 % är ett bra tecken."],
    ["Fråga varför", "Finns det en ekonomisk förklaring – samma bransch, samma kunder, gemensam ägare? Utan förklaring är risken stor att sambandet försvinner."],
    ["Testa ärligt", "Öppna paret i Paranalys och kör sedan Backtest med en testperiod strategin inte sett. Räkna med kostnader."],
  ];
  return (
    <div className="guide-steps">
      {steps.map(([t, d], i) => (
        <div key={t} className="guide-step"><span className="task-n">{i + 1}</span><div><b>{t}</b><p>{d}</p></div></div>
      ))}
    </div>
  );
}

/** Par som klarar kvalitetskraven och där spreaden just nu är långt från sitt medel. */
export function SignalCards({ rows, w }: { rows: ScanRow[]; w: WindowKey }) {
  const { prices, pairs, name } = useData();
  const nav = useNavigate();
  const n = pairs.windows[w];
  const cands = rows
    .filter((r) => r.s.p < 0.05 && r.s.hl != null && r.s.hl >= 3 && r.s.hl <= 60 && r.s.beta >= 0.3 && Math.abs(r.s.z) >= 1.5)
    .sort((a, b) => Math.abs(b.s.z) * (0.5 + (b.stab ?? 0)) - Math.abs(a.s.z) * (0.5 + (a.stab ?? 0)))
    .slice(0, 6);
  if (!cands.length) return <p className="muted">Inga kvalitetspar har en ovanligt stor avvikelse just nu (|z| ≥ 1,5). Det är helt normalt – signaler är sällsynta.</p>;
  return (
    <div className="signal-grid">
      {cands.map((r) => {
        const al = alignedPair(prices, r.y, r.x, n);
        const sp = Array.from(al.pa, (v, i) => Math.log(v) - r.s.alpha - r.s.beta * Math.log(al.pb[i]));
        const m = sp.reduce((a, b) => a + b, 0) / sp.length;
        const sd = Math.sqrt(sp.reduce((a, b) => a + (b - m) ** 2, 0) / (sp.length - 1));
        const z = sp.map((v) => (v - m) / sd);
        const tail = 126;
        const zz = z.slice(-tail), xx = al.dates.slice(-tail);
        const hi = r.s.z > 0;
        const data: Data[] = [
          { x: xx, y: zz, type: "scatter", mode: "lines", line: { color: cssVar("--accent"), width: 1.5 }, hovertemplate: "%{x}: z %{y:.2f}<extra></extra>" },
          { x: [xx[xx.length - 1]], y: [zz[zz.length - 1]], type: "scatter", mode: "markers", marker: { size: 8, color: hi ? cssVar("--neg") : cssVar("--pos") }, hoverinfo: "skip" },
        ];
        const hl = (y: number) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: cssVar("--primary"), width: 1, dash: "dash" } });
        return (
          <button key={r.y + r.x} className="signal-card" onClick={() => nav(`/par/${r.y}/${r.x}`)}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>{name(r.y)} / {name(r.x)}</b>
              <span className={`tag ${hi ? "bad" : "good"}`}>z {fmtSigned(r.s.z, 1)}</span>
            </div>
            <Plot ariaLabel={`Spread för ${name(r.y)} och ${name(r.x)}`} data={data} height={100}
              layout={{ showlegend: false, margin: { l: 2, r: 30, t: 4, b: 2 }, xaxis: { visible: false } as any, yaxis: { tickfont: { size: 9 }, zeroline: true } as any, shapes: [hl(2), hl(-2)] as any }} config={{ staticPlot: true }} />
            <span className="muted" style={{ fontSize: 13 }}>
              {hi ? <>{name(r.y)} är dyr relativt {name(r.x)}. En parstrategi skulle <b>sälja {short(r.y)}</b> och köpa {fmt(r.s.beta, 2)}× {short(r.x)}.</>
                : <>{name(r.y)} är billig relativt {name(r.x)}. En parstrategi skulle <b>köpa {short(r.y)}</b> och blanka {fmt(r.s.beta, 2)}× {short(r.x)}.</>}
            </span>
            <span className="mono dim" style={{ fontSize: 11.5 }}>p {fmtP(r.s.p)} · half-life {fmtDays(r.s.hl)} · stabilitet {r.stab == null ? "–" : fmtPct(r.stab, 0)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Par som är signifikanta i flera tidsfönster (1, 3 och 5 år) – det starkaste skyddet mot slumpträffar i den här datan. */
export function RobustPairs() {
  const { pairs, name } = useData();
  const nav = useNavigate();
  const K: WindowKey[] = ["1Y", "3Y", "5Y"];
  const scored = pairs.pairs.map((p) => ({ p, k: K.filter((k) => p.w[k] && p.w[k]!.p < 0.05 && p.w[k]!.beta > 0).length }));
  const all3 = scored.filter((x) => x.k === 3).length;
  const list = scored.filter((x) => x.k >= 2).sort((a, b) => b.k - a.k || (b.p.stab ?? 0) - (a.p.stab ?? 0)).slice(0, 15);
  const dir = (p: PairRow) => { const w = p.w["3Y"] ?? p.w["5Y"] ?? p.w["1Y"]!; return w.dep === "a" ? [p.a, p.b] : [p.b, p.a]; };
  return (
    <>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
        {all3 === 0 ? <>Inget par är signifikant i <b>alla tre</b> fönstren just nu – ett tecken på hur sällan samband håller över tid. Nedan visas par som klarar <b>två av tre</b>.</>
          : <><b>{all3}</b> par är signifikanta i alla tre fönstren. Nedan visas de, följt av par som klarar två av tre.</>}
      </p>
      {list.length === 0 ? <p className="muted">Inga par klarar ens två fönster.</p> : (
        <table className="data">
          <thead><tr><th>Par</th><th className="num">Fönster</th><th className="num">p 1 år</th><th className="num">p 3 år</th><th className="num">p 5 år</th><th className="num">Half-life 3 år</th><th className="num">Stabilitet</th></tr></thead>
          <tbody>{list.map(({ p, k }) => {
            const [y, x] = dir(p);
            return (
              <tr key={p.a + p.b} className="row-link" onClick={() => nav(`/par/${y}/${x}`)}>
                <td>{name(y)} / {name(x)}</td>
                <td className={`num ${k === 3 ? "pos" : ""}`}>{k}/3</td>
                {K.map((w) => <td key={w} className={`num ${p.w[w] && p.w[w]!.p < 0.05 ? "" : "dim"}`}>{fmtP(p.w[w]?.p)}</td>)}
                <td className="num">{fmtDays(p.w["3Y"]?.hl)}</td>
                <td className={`num ${(p.stab ?? 0) >= 0.3 ? "pos" : ""}`}>{p.stab == null ? "–" : fmtPct(p.stab, 0)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
    </>
  );
}

/** Fördelningen av p-värden. Om inga par vore samintegrerade skulle staplarna vara ungefär lika höga (likformig fördelning). */
export function PHistogram({ rows }: { rows: ScanRow[] }) {
  const bins = 20, exp = rows.length / bins;
  const data: Data[] = [{
    type: "histogram", x: rows.map((r) => r.s.p), xbins: { start: 0, end: 1, size: 1 / bins }, marker: { color: rows.length ? cssVar("--accent") : "" }, opacity: 0.85,
    hovertemplate: "p %{x}: %{y} par<extra></extra>",
  } as any];
  const first = rows.filter((r) => r.s.p < 0.05).length;
  return (
    <>
      <Plot ariaLabel="Fördelning av p-värden för alla par" data={data} height={260}
        layout={{ hovermode: "closest", bargap: 0.05, xaxis: { title: { text: "p-värde" }, range: [0, 1], showspikes: false } as any, yaxis: { title: { text: "Antal par" } } as any,
          shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: exp, y1: exp, line: { color: cssVar("--text-3"), dash: "dash", width: 1 } }] as any,
          annotations: [{ xref: "paper", x: 1, y: exp, yanchor: "bottom", xanchor: "right", text: "ren slump", showarrow: false, font: { size: 11, color: cssVar("--text-3") } }] as any }} />
      <p className="muted" style={{ fontSize: 13.5, margin: "8px 0 0" }}>
        Första stapeln (p &lt; 0,05) har <b>{first}</b> par mot ~{fmt(exp, 0)} om allt vore slump – {first > exp * 1.5 ? "fler än slumpen, så en del samband är troligen verkliga." : "ungefär vad slumpen ger, så var extra skeptisk."}
      </p>
    </>
  );
}

/** Nätverk: aktierna i en ring per sektor, linjer = par som klarar filtret. */
export function PairNetwork({ pass }: { pass: ScanRow[] }) {
  const { meta, name } = useData();
  const nav = useNavigate();
  const stocks = useMemo(() => [...meta.stocks].sort((a, b) => a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name, "sv")), [meta]);
  const pos = Object.fromEntries(stocks.map((s, i) => { const a = (i / stocks.length) * 2 * Math.PI; return [s.ticker, [Math.cos(a), Math.sin(a)]]; }));
  const deg: Record<string, number> = {};
  pass.forEach((r) => { deg[r.y] = (deg[r.y] ?? 0) + 1; deg[r.x] = (deg[r.x] ?? 0) + 1; });
  const ex: (number | null)[] = [], ey: (number | null)[] = [];
  pass.forEach((r) => { ex.push(pos[r.y][0], pos[r.x][0], null); ey.push(pos[r.y][1], pos[r.x][1], null); });
  const data: Data[] = [
    { type: "scatter", mode: "lines", x: ex, y: ey, line: { color: cssVar("--primary"), width: 1 }, opacity: 0.55, hoverinfo: "skip" },
    { type: "scatter", mode: "markers+text", x: stocks.map((s) => pos[s.ticker][0] * 1), y: stocks.map((s) => pos[s.ticker][1]),
      text: stocks.map((s) => short(s.ticker)) as any, textposition: stocks.map((s) => (pos[s.ticker][0] >= 0 ? "middle right" : "middle left")) as any,
      textfont: { size: 10, color: cssVar("--text-2") },
      marker: { size: stocks.map((s) => 8 + (deg[s.ticker] ?? 0) * 2), color: stocks.map((s) => sectorColor(s.sector)), line: { color: cssVar("--bg"), width: 1.5 } },
      customdata: stocks.map((s) => [name(s.ticker), deg[s.ticker] ?? 0, meta.sectors[s.sector]]) as any,
      hovertemplate: "<b>%{customdata[0]}</b> (%{customdata[2]})<br>%{customdata[1]} par i filtret<extra></extra>" },
  ];
  const top = Object.entries(deg).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <>
      <Plot ariaLabel="Nätverk över par som klarar filtret" data={data} height={420} onClick={(pt) => { const t = stocks[pt?.pointNumber]?.ticker; if (t && pt.curveNumber === 1) nav(`/aktie/bolag/${t}`); }}
        layout={{ hovermode: "closest", showlegend: false, xaxis: { visible: false, range: [-1.45, 1.45] } as any, yaxis: { visible: false, range: [-1.15, 1.15], scaleanchor: "x" } as any, margin: { l: 0, r: 0, t: 0, b: 0 } }} />
      {top.length > 0 && <p className="muted" style={{ fontSize: 13.5, margin: "8px 0 0" }}>Flest kopplingar: {top.map(([t, c]) => `${name(t)} (${c})`).join(", ")}. En aktie med väldigt många kopplingar är ofta själv "bandbunden" snarare än en del av många riktiga par. <Info id="stability" /></p>}
    </>
  );
}

export function NextSteps() {
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <Link className="btn" to="/korrelation">Korrelationsmatrisen →</Link>
      <Link className="btn" to="/backtest?mode=portfolio">Ärlig backtest av en parportfölj →</Link>
      <Link className="btn" to="/kurs?spar=kvant">Kvantspåret i Akademin →</Link>
    </div>
  );
}


