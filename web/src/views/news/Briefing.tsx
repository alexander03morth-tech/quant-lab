import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Info } from "../../components/Info";
import { cssVar, Plot } from "../../components/Plot";
import { RichText } from "../../components/RichText";
import { Seg } from "../../components/Slider";
import { useData } from "../../lib/data";
import { useBriefing, timeAgo, type BriefingSection } from "../../lib/extra";
import { fmt, fmtDate, fmtPct } from "../../lib/format";
import { useSettings } from "../../lib/settings";

type Key = "day" | "week" | "month";
const ICON: Record<BriefingSection["id"], string> = { vad: "◎", varfor: "?", problem: "!", fordelar: "+", framtid: "→" };

/** "Det här behöver du veta" om dagen, veckan och månaden. Texten skrivs varje kväll av pipeline/briefing.py. */
export function Briefing() {
  const b = useBriefing();
  const { prices, meta } = useData();
  const { mode } = useSettings();
  const [k, setK] = useState<Key>("day");
  if (b === undefined) return <section className="card span-12"><div className="card-body plot-loading" style={{ minHeight: 200 }}>Laddar…</div></section>;
  if (!b) return null;
  const p = b.periods[k];
  const s = p.stats;
  const noun = k === "day" ? "dagen" : k === "week" ? "veckan" : "månaden";

  // indexkurva för perioden (för "dagen": de senaste 10 dagarna med sista dagen markerad)
  const ic = prices.series[meta.benchmark.ticker].close;
  const endI = prices.dates.indexOf(p.to) >= 0 ? prices.dates.indexOf(p.to) : prices.dates.length - 1;
  const fromI = Math.max(0, endI - Math.max(p.days, 9));
  const x = prices.dates.slice(fromI, endI + 1), y = ic.slice(fromI, endI + 1);
  const startI = prices.dates.indexOf(p.from);
  const col = s.ret >= 0 ? cssVar("--pos") : cssVar("--neg");
  const idxData: Data[] = [
    { x, y, type: "scatter", mode: "lines", line: { color: cssVar("--text-3"), width: 1.2 }, hovertemplate: "%{y:,.1f}<extra></extra>", showlegend: false },
    { x: prices.dates.slice(startI, endI + 1), y: ic.slice(startI, endI + 1), type: "scatter", mode: "lines+markers", line: { color: col, width: 2.4 }, marker: { size: 5, color: col }, fill: "tozeroy", fillcolor: `${col}18`, hovertemplate: "%{y:,.1f}<extra></extra>", showlegend: false },
  ];
  const yv = (y.filter((v) => v != null) as number[]);

  // bidrag till index (procentenheter)
  const top = [...p.contrib.slice(0, 4), ...p.contrib.slice(-4)].filter((c, i, a) => a.findIndex((d) => d.ticker === c.ticker) === i);
  const contrib: Data[] = [{
    type: "bar", orientation: "h", y: top.map((c) => c.name), x: top.map((c) => c.c * 100),
    marker: { color: top.map((c) => (c.c >= 0 ? cssVar("--pos") : cssVar("--neg"))) },
    customdata: top.map((c) => fmtPct(c.ret, 1, true)) as any,
    hovertemplate: "%{y}: %{x:+.2f} procentenheter<br>aktien %{customdata}<extra></extra>",
  }];

  const tone = (id: string) => (id === "problem" ? "neg" : id === "fordelar" ? "pos" : id === "framtid" ? "accent" : id === "varfor" ? "prim" : "neutral");

  return (
    <section className="card span-12 brief">
      <div className="card-head">
        <h2 className="card-title"><span className="idx">00</span>Det här behöver du veta om {noun}</h2>
        <div className="card-tools">
          <Seg label="Period" value={k} onChange={setK} options={[{ value: "day", label: "Dagen" }, { value: "week", label: "Veckan" }, { value: "month", label: "Månaden" }]} />
        </div>
      </div>
      <div className="card-body">
        <div className="brief-head">
          <div>
            <div className="dim mono" style={{ fontSize: 12 }}>{k === "day" ? fmtDate(p.to) : `${fmtDate(p.from)} – ${fmtDate(p.to)}`} · skriven {timeAgo(b.generatedAt)}</div>
            <h3 className="brief-title">{p.headline}</h3>
          </div>
          <div className="brief-kpis">
            <div><span className="dim">OMXS30</span><b className={s.ret >= 0 ? "pos" : "neg"}>{fmtPct(s.ret, 1, true)}</b><small>{fmt(Math.abs(s.z), 1)} σ <Info id="sigma-move" /></small></div>
            <div><span className="dim">Upp</span><b>{s.up}/{s.total}</b><small>aktier</small></div>
            <div><span className="dim">Svängningar</span><b>{fmtPct(s.vol, 0)}</b><small>per år <Info id="volatility" /></small></div>
            <div><span className="dim">Från toppen</span><b>{fmtPct(s.drawdown, 1)}</b><small>52 v <Info id="max-drawdown" /></small></div>
          </div>
        </div>

        <div className="grid" style={{ marginTop: 14 }}>
          <div className="span-7 brief-secs">
            {p.sections.map((sec) => (
              <div key={sec.id} className={`brief-sec t-${tone(sec.id)}`}>
                <div className="brief-sec-head"><span className="brief-icon">{ICON[sec.id]}</span>{sec.title}</div>
                {sec.text && <p><RichText text={sec.text} /></p>}
                {sec.bullets && <ul>{sec.bullets.map((t, i) => <li key={i}><RichText text={t} /></li>)}</ul>}
                {mode === "beginner"
                  ? <div className="eli5"><b className="k">Förklarat enkelt</b>{sec.explain}</div>
                  : <details className="eli5"><summary>Förklarat enkelt</summary>{sec.explain}</details>}
              </div>
            ))}
          </div>

          <aside className="span-5 stack">
            <div className="brief-box">
              <div className="explain-kicker">Index {k === "day" ? "senaste två veckorna" : noun}</div>
              <Plot ariaLabel={`OMXS30 under ${noun}`} data={idxData} height={180} layout={{ yaxis: { range: [Math.min(...yv) * 0.995, Math.max(...yv) * 1.005], tickformat: ",.0f" } as any, margin: { l: 4, r: 8, t: 6, b: 4 } }} />
            </div>
            <div className="brief-box">
              <div className="explain-kicker">Vilka flyttade index? <Info id="index" /></div>
              <Plot ariaLabel="Största bidrag till indexets rörelse" data={contrib} height={230} layout={{ hovermode: "closest", xaxis: { ticksuffix: " pe", zeroline: true, showspikes: false } as any, yaxis: { side: "left", automargin: true, tickfont: { size: 11 } } as any, margin: { l: 4, r: 8, t: 4, b: 4 } }} />
              {mode === "beginner" && <p className="caption" style={{ padding: 0, margin: "6px 0 0" }}>Bidrag = hur många procentenheter av indexets rörelse bolaget stod för (ungefär vikt × kursrörelse). Stora bolag kan flytta index mer med en mindre rörelse.</p>}
            </div>
            <div className="brief-box">
              <div className="explain-kicker">Omvärlden {k === "day" ? "(USA: gårdagens handel)" : `under ${noun}`}</div>
              <table className="data" style={{ marginTop: 4 }}><tbody>
                {p.global.map((g) => (
                  <tr key={g.ticker} title={g.desc}>
                    <td>{g.label}<div className="dim" style={{ fontSize: 11.5 }}>{g.desc}</div></td>
                    <td className="num">{g.isRate ? `${fmt(g.level, 2)} %` : fmt(g.level, g.level > 100 ? 0 : 2)}</td>
                    <td className={`num ${g.chg > 0 ? "pos" : g.chg < 0 ? "neg" : ""}`}>{g.isRate ? `${g.chg >= 0 ? "+" : "−"}${fmt(Math.abs(g.chg) * 100, 0)} bp` : fmtPct(g.chg, 1, true)}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
            <div className="brief-box">
              <div className="explain-kicker">Historiken: nästa {k === "day" ? "dag" : k === "week" ? "vecka" : "månad"} plus</div>
              <div className="hit-row"><span>Efter liknande {k === "day" ? "dagar" : k === "week" ? "veckor" : "månader"}</span><div className="hit-bar"><i style={{ width: `${p.baseRates.hit * 100}%` }} /></div><b>{fmtPct(p.baseRates.hit, 0)}</b></div>
              <div className="hit-row"><span>Alla perioder</span><div className="hit-bar"><i style={{ width: `${p.baseRates.allHit * 100}%`, background: cssVar("--text-3") }} /></div><b>{fmtPct(p.baseRates.allHit, 0)}</b></div>
              <p className="dim" style={{ fontSize: 12.5, margin: "8px 0 0" }}>8 av 10 utfall hamnade mellan {fmtPct(p.baseRates.p10, 1, true)} och {fmtPct(p.baseRates.p90, 1, true)}. Sedan 2010, {p.baseRates.n} liknande tillfällen. Ingen prognos.</p>
            </div>
            {p.news.length > 0 && (
              <div className="brief-box">
                <div className="explain-kicker">Rubriker under {noun}</div>
                <ul className="plain-list" style={{ fontSize: 13.5 }}>
                  {p.news.map((n) => <li key={n.url}><a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a> <span className="dim">· {n.source}</span></li>)}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
