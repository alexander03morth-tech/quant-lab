import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric } from "../../components/Metric";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Seg } from "../../components/Slider";
import { useData } from "../../lib/data";
import { fmt, fmtPct } from "../../lib/format";
import { rollingAvgCorr, sectorColor, short } from "../../lib/market";
import { returnMatrix } from "../../lib/portfolio/engine";
import { clusterOrder, corrMatrix } from "../../lib/stats/pca";

const WINDOWS = [{ value: 63, label: "3 mån" }, { value: 252, label: "1 år" }, { value: 756, label: "3 år" }, { value: 1260, label: "5 år" }];

export function CorrelationView() {
  const { prices, meta, name } = useData();
  const nav = useNavigate();
  const [win, setWin] = useState(252);
  const [order, setOrder] = useState<"cluster" | "sector">("cluster");
  const tickers = useMemo(() => meta.stocks.map((s) => s.ticker), [meta]);
  const sector = (t: string) => meta.stocks.find((s) => s.ticker === t)?.sector ?? "";

  const m = useMemo(() => {
    const M = returnMatrix(prices, tickers, meta.benchmark.ticker, win);
    const C = corrMatrix(M.R);
    // föregående lika långa period (för att se vad som förändrats)
    const M2 = returnMatrix(prices, tickers, meta.benchmark.ticker, win * 2);
    const prev = M2.R[0].length >= win * 2 ? corrMatrix(M2.R.map((r) => r.subarray(0, win))) : null;
    return { C, M, prev };
  }, [prices, tickers, meta, win]);

  const ord = useMemo(() => {
    if (order === "cluster") return clusterOrder(m.C);
    return tickers.map((_, i) => i).sort((i, j) => sector(tickers[i]).localeCompare(sector(tickers[j])) || name(tickers[i]).localeCompare(name(tickers[j]), "sv"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, order, tickers]);

  const roll = useMemo(() => rollingAvgCorr(prices, tickers, 63, 5), [prices, tickers]);

  const pairsSorted = useMemo(() => {
    const out: { i: number; j: number; r: number }[] = [];
    for (let i = 0; i < tickers.length; i++) for (let j = i + 1; j < tickers.length; j++) out.push({ i, j, r: m.C[i][j] });
    return out.sort((a, b) => b.r - a.r);
  }, [m, tickers]);

  const avgNow = pairsSorted.reduce((s, p) => s + p.r, 0) / pairsSorted.length;
  const rollNow = roll.avg[roll.avg.length - 1];
  const pct = roll.avg.filter((v) => v < rollNow).length / roll.avg.length;
  const rollMax = Math.max(...roll.avg), rollMaxDate = roll.dates[roll.avg.indexOf(rollMax)];
  const top = pairsSorted[0];
  const ctx = { A: name(tickers[top.i]), B: name(tickers[top.j]), rho: top.r, avgNow: rollNow, avgPct: pct };

  const labels = ord.map((i) => short(tickers[i]));
  const z = ord.map((i) => ord.map((j) => m.C[i][j]));
  const interp = (r: number) => r >= 0.7 ? "rör sig nästan alltid ihop" : r >= 0.5 ? "rör sig ofta ihop" : r >= 0.3 ? "visst samband" : r >= 0.1 ? "svagt samband" : "i stort sett oberoende";
  const hover = ord.map((i) => ord.map((j) => i === j ? `${name(tickers[i])}` : `${name(tickers[i])} – ${name(tickers[j])}<br>ρ = ${fmt(m.C[i][j], 2)}: ${interp(m.C[i][j])}<br><i>klicka för paranalys</i>`));
  const scale: [number, string][] = [[0, cssVar("--series-b")], [0.23, cssVar("--surface-2")], [0.62, cssVar("--primary")], [1, cssVar("--accent")]];

  const heat: Data[] = [{
    type: "heatmap", x: labels, y: labels, z, zmin: -0.3, zmax: 1, colorscale: scale as any, text: hover as any, hovertemplate: "%{text}<extra></extra>",
    xgap: 1, ygap: 1, colorbar: { thickness: 10, outlinewidth: 0, tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") } },
  } as any];
  // sektorfärgad markering framför varje etikett
  const tickText = ord.map((i) => `<span style="color:${sectorColor(sector(tickers[i]))}">■</span> ${short(tickers[i])}`);
  const sectorStrip = { tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") }, tickmode: "array", tickvals: labels, ticktext: tickText };

  const rollData: Data[] = [
    { x: roll.dates, y: roll.avg, type: "scatter", mode: "lines", line: { color: cssVar("--primary"), width: 7 }, opacity: 0.15, hoverinfo: "skip", showlegend: false },
    { x: roll.dates, y: roll.avg, type: "scatter", mode: "lines", name: "Snittkorrelation", line: { color: cssVar("--accent"), width: 1.5 },
      customdata: roll.count as any, hovertemplate: "ρ̄ = %{y:.2f} <span style='color:#888'>(%{customdata} aktier)</span><extra></extra>" },
  ];

  const idxs = ord.map((_, k) => k);
  const surf: Data[] = [{
    type: "surface", z, x: idxs, y: idxs, colorscale: scale as any, cmin: -0.3, cmax: 1, showscale: false,
    text: hover as any, hovertemplate: "%{text}<extra></extra>",
    contours: { z: { show: true, usecolormap: true, highlightcolor: cssVar("--text"), project: { z: false } } } as any,
    lighting: { ambient: 0.6, diffuse: 0.7, specular: 0.25, roughness: 0.6 },
  } as any];

  // ── fördjupning: sektorer, förändring mot föregående period, fördelning ──
  const N = tickers.length;
  const secs = Object.keys(meta.sectors).filter((k) => tickers.some((t) => sector(t) === k));
  const secAvg = secs.map((a) => secs.map((b) => {
    let sum = 0, c = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j && sector(tickers[i]) === a && sector(tickers[j]) === b) { sum += m.C[i][j]; c++; }
    return c ? sum / c : null;
  }));
  const intra = secs.map((k, i) => ({ k, v: secAvg[i][i] })).filter((x) => x.v != null).sort((a, b) => (b.v as number) - (a.v as number));
  const stockAvg = (C: number[][], i: number) => C[i].reduce((a, v, j) => a + (j === i ? 0 : v), 0) / (N - 1);
  const avgBy = tickers.map((t, i) => ({ t, now: stockAvg(m.C, i), prev: m.prev ? stockAvg(m.prev, i) : NaN })).sort((a, b) => b.now - a.now);
  const loner = avgBy[avgBy.length - 1], social = avgBy[0];
  const prevAvg = m.prev ? (() => { let s2 = 0; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) s2 += m.prev![i][j]; return s2 / (N * (N - 1) / 2); })() : NaN;
  const changes = m.prev ? pairsSorted.map((p) => ({ ...p, d: p.r - m.prev![p.i][p.j] })).sort((a, b) => b.d - a.d) : [];
  const winLabel = WINDOWS.find((w) => w.value === win)?.label ?? "";
  const secHeat: Data[] = [{
    type: "heatmap", x: secs.map((k) => meta.sectors[k]), y: secs.map((k) => meta.sectors[k]), z: secAvg as any, zmin: -0.3, zmax: 1, colorscale: scale as any, showscale: false,
    text: secAvg.map((r) => r.map((v) => (v == null ? "" : fmt(v, 2)))) as any, texttemplate: "%{text}", textfont: { family: cssVar("--mono"), size: 11, color: cssVar("--text") },
    hovertemplate: "%{y} × %{x}: snitt ρ = %{text}<extra></extra>", xgap: 2, ygap: 2,
  } as any];
  const dumb: Data[] = m.prev ? [
    ...avgBy.map((a) => ({ type: "scatter", mode: "lines", x: [a.prev, a.now], y: [name(a.t), name(a.t)], line: { color: cssVar("--border-strong"), width: 2 }, hoverinfo: "skip", showlegend: false } as Data)),
    { type: "scatter", mode: "markers", name: "Föregående period", x: avgBy.map((a) => a.prev), y: avgBy.map((a) => name(a.t)), marker: { color: cssVar("--text-3"), size: 7 }, hovertemplate: "%{y}: %{x:.2f} (före)<extra></extra>" },
    { type: "scatter", mode: "markers", name: "Nu", x: avgBy.map((a) => a.now), y: avgBy.map((a) => name(a.t)), marker: { color: cssVar("--accent"), size: 8 }, hovertemplate: "%{y}: %{x:.2f} (nu)<extra></extra>" },
  ] : [];
  const hist: Data[] = [
    ...(m.prev ? [{ type: "histogram", x: pairsSorted.map((p) => m.prev![p.i][p.j]), name: "Föregående period", xbins: { start: -0.4, end: 1, size: 0.05 }, marker: { color: cssVar("--text-3") }, opacity: 0.45 } as Data] : []),
    { type: "histogram", x: pairsSorted.map((p) => p.r), name: "Nu", xbins: { start: -0.4, end: 1, size: 0.05 }, marker: { color: cssVar("--accent") }, opacity: 0.75 } as Data,
  ];

  const go = (a: number, b: number) => nav(`/par/${tickers[a]}/${tickers[b]}`);
  // 3D-ytan har numeriska axlar (0..29) i vald ordning → översätt tillbaka till aktier
  const on3d = (pt: any) => {
    if (!pt) return;
    const xi = Math.round(Number(pt.x)), yi = Math.round(Number(pt.y));
    const a = ord[yi], b = ord[xi];
    if (a != null && b != null && a !== b) go(a, b);
  };
  const onHeat = (pt: any) => {
    if (!pt) return;
    const a = tickers.findIndex((t) => short(t) === pt.y), b = tickers.findIndex((t) => short(t) === pt.x);
    if (a >= 0 && b >= 0 && a !== b) go(a, b);
  };

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Korrelationsmatris · OMXS30</span><span className="live">{m.M.dates[0]} – {m.M.dates[m.M.dates.length - 1]}</span></div>
          <h1 className="hero-title">Vilka aktier rör sig ihop?</h1>
          <p className="hero-sub" style={{ maxWidth: "76ch" }}>Varje ruta visar hur ofta två aktier går åt samma håll samma dag. Det avgör hur mycket du faktiskt sprider risken i en portfölj – och vilka par som är värda att testa.</p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Seg label="Fönster" value={win} onChange={setWin} options={WINDOWS} />
            <Seg label="Ordning" value={order} onChange={setOrder} options={[{ value: "cluster", label: "Klustrad" }, { value: "sector", label: "Sektor" }]} />
            <Info id={order === "cluster" ? "clustering" : "corr-matrix"} ctx={ctx} />
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="metrics">
          <Metric label="Snittkorrelation (fönster)" info="avg-correlation" ctx={ctx} value={fmt(avgNow, 2)} sub={`${pairsSorted.length} par`} />
          <Metric label="Snitt senaste 3 mån" info="avg-correlation" ctx={ctx} value={fmt(rollNow, 2)} tone={pct > 0.8 ? "bad" : pct < 0.3 ? "good" : "neutral"} toneLabel={pct > 0.8 ? "förhöjd" : pct < 0.3 ? "låg" : "normal"} sub={`högre än ${fmtPct(pct, 0)} av historiken`} />
          <Metric label="Mest lika" info="correlation" ctx={ctx} value={`${short(tickers[top.i])} / ${short(tickers[top.j])}`} sub={`ρ = ${fmt(top.r, 2)}`} />
          <Metric label="Rekord (3 mån)" info="avg-correlation" ctx={ctx} value={fmt(rollMax, 2)} sub={rollMaxDate} />
        </div>

        <div className="grid">
          <section className="card span-8">
            <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Matrisen <Info id="corr-matrix" ctx={ctx} /></h2><span className="dim" style={{ fontSize: 12 }}>dagliga avkastningar · klicka på en ruta</span></div>
            <div className="card-body">
              <Plot ariaLabel="Korrelationsmatris för OMXS30-aktierna" data={heat} height={560} onClick={onHeat}
                layout={{ hovermode: "closest", xaxis: { ...sectorStrip, tickangle: -60, showspikes: false, side: "bottom" } as any, yaxis: { ...sectorStrip, autorange: "reversed", side: "left", showspikes: false } as any, margin: { l: 8, r: 8, t: 8, b: 8 } }} />
            </div>
            <Caption>Varmare färg = rör sig mer ihop. {order === "cluster" ? <>Ordningen är <b>klustrad</b>: aktier som liknar varandra ligger bredvid varandra, så grupperna syns som ljusa block längs diagonalen.</> : <>Ordningen följer sektorerna – jämför med klustrad ordning för att se om sektorerna faktiskt är de grupper som rör sig ihop.</>} Klicka på en ruta för att testa paret.</Caption>
          </section>

          <aside className="span-4 stack">
            <section className="card"><div className="card-body">
              <div className="explain-kicker">Mest lika i fönstret</div>
              <table className="data" style={{ marginTop: 6 }}><tbody>
                {pairsSorted.slice(0, 8).map((p) => (
                  <tr key={`${p.i}-${p.j}`} className="row-link" onClick={() => go(p.i, p.j)}>
                    <td><span className="sector-dot" data-s={sector(tickers[p.i])} style={{ display: "inline-block", marginRight: 6 }} />{name(tickers[p.i])} – {name(tickers[p.j])}</td>
                    <td className="num">{fmt(p.r, 2)}</td>
                  </tr>
                ))}
              </tbody></table>
            </div></section>
            <section className="card"><div className="card-body">
              <div className="explain-kicker">Bäst för att sprida risk</div>
              <table className="data" style={{ marginTop: 6 }}><tbody>
                {pairsSorted.slice(-5).reverse().map((p) => (
                  <tr key={`${p.i}-${p.j}`} className="row-link" onClick={() => go(p.i, p.j)}>
                    <td>{name(tickers[p.i])} – {name(tickers[p.j])}</td><td className="num">{fmt(p.r, 2)}</td>
                  </tr>
                ))}
              </tbody></table>
              <p className="dim" style={{ fontSize: 12.5, margin: "8px 0 0" }}>Hög korrelation är inte samma sak som ett bra par. Ett par kräver att <i>avståndet</i> är stabilt. <Info id="corr-vs-coint" /></p>
            </div></section>
          </aside>


          <section className="card span-12">
            <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Vad matrisen säger just nu</h2><span className="dim" style={{ fontSize: 12 }}>automatisk tolkning · {winLabel}</span></div>
            <div className="card-body">
              <ul className="insights">
                <li><b>Tätaste gruppen:</b> {intra[0] ? <>{meta.sectors[intra[0].k]} – aktierna inom sektorn har i snitt korrelation {fmt(intra[0].v, 2)}{intra[1] ? <>, följt av {meta.sectors[intra[1].k].toLowerCase()} ({fmt(intra[1].v, 2)})</> : null}. Bolag i samma bransch påverkas av samma saker (räntor, konjunktur, råvarupriser).</> : "–"}</li>
                <li><b>Mest "social" aktie:</b> {name(social.t)} rör sig mest med de andra (snitt {fmt(social.now, 2)}). <b>Mest ensam:</b> {name(loner.t)} (snitt {fmt(loner.now, 2)}) – den sprider risken mest i en portfölj.</li>
                {m.prev && <li><b>Jämfört med föregående {winLabel}:</b> snittkorrelationen har {avgNow > prevAvg + 0.02 ? "stigit" : avgNow < prevAvg - 0.02 ? "sjunkit" : "legat still"} från {fmt(prevAvg, 2)} till {fmt(avgNow, 2)}. {avgNow > prevAvg + 0.02 ? "Aktierna rör sig mer i flock – diversifiering hjälper mindre." : avgNow < prevAvg - 0.02 ? "Aktierna går mer sina egna vägar – bra för aktieval och parstrategier." : "Marknadens \"flockbeteende\" är ungefär oförändrat."}</li>}
                {changes.length > 0 && <li><b>Största förändringen:</b> {name(tickers[changes[0].i])}–{name(tickers[changes[0].j])} har närmat sig varandra mest (+{fmt(changes[0].d, 2)}, nu {fmt(changes[0].r, 2)}), medan {name(tickers[changes[changes.length - 1].i])}–{name(tickers[changes[changes.length - 1].j])} har glidit isär mest ({fmt(changes[changes.length - 1].d, 2)}, nu {fmt(changes[changes.length - 1].r, 2)}). Ändrade samband kan betyda att något hänt i bolagen.</li>}
                <li><b>För pairs trading:</b> hög korrelation är en bra <i>startpunkt</i>, men det som avgör är om avståndet mellan aktierna är stabilt. Testa toppkandidaterna i <a href="#/scanner">Parscannern</a>. <Info id="corr-vs-coint" /></li>
              </ul>
            </div>
          </section>

          <section className="card span-6">
            <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Sektor mot sektor</h2></div>
            <div className="card-body"><Plot ariaLabel="Snittkorrelation mellan sektorer" data={secHeat} height={340} layout={{ hovermode: "closest", xaxis: { tickangle: -35, showspikes: false, tickfont: { size: 10 } } as any, yaxis: { side: "left", autorange: "reversed", tickfont: { size: 10 } } as any }} /></div>
            <Caption>Varje ruta är snittet av alla par mellan två sektorer. Diagonalen visar hur tätt sektorn hänger ihop internt. <b>Låga värden mellan två sektorer</b> = de kompletterar varandra i en portfölj.</Caption>
          </section>
          <section className="card span-6">
            <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Alla {pairsSorted.length} par i ett diagram</h2></div>
            <div className="card-body"><Plot ariaLabel="Fördelning av parvisa korrelationer nu och föregående period" data={hist} height={340} layout={{ barmode: "overlay", hovermode: "closest", xaxis: { title: { text: "Korrelation" }, showspikes: false } as any, yaxis: { title: { text: "Antal par" } } as any }} /></div>
            <Caption>Hur korrelationerna fördelar sig. Om hela "berget" flyttar åt höger rör sig marknaden mer i flock; åt vänster går aktierna mer isär. Grått är föregående lika långa period.</Caption>
          </section>
          {m.prev && (
            <section className="card span-12">
              <div className="card-head"><h2 className="card-title"><span className="idx">05</span>Varje akties koppling till resten – nu och förut</h2></div>
              <div className="card-body"><Plot ariaLabel="Snittkorrelation per aktie nu jämfört med föregående period" data={dumb} height={620} layout={{ hovermode: "closest", xaxis: { title: { text: "Snittkorrelation med övriga aktier" }, showspikes: false } as any, yaxis: { side: "left", autorange: "reversed", tickfont: { size: 11 } } as any, margin: { l: 8, r: 8, t: 24, b: 8 } }} /></div>
              <Caption>Guld prick = nu, grå = föregående {winLabel}. En lång linje betyder att aktien har bytt beteende – t.ex. efter ett bud, en strategiändring eller en avknoppning. Aktier längst ner är de bästa "diversifierarna".</Caption>
            </section>
          )}
          <section className="card span-12">
            <div className="card-head"><h2 className="card-title"><span className="idx">06</span>När allt faller samtidigt <Info id="avg-correlation" ctx={ctx} /></h2><span className="dim" style={{ fontSize: 12 }}>snittkorrelation, rullande 3 mån</span></div>
            <div className="card-body"><Plot ariaLabel="Rullande genomsnittlig korrelation över tid" data={rollData} height={260} layout={{ yaxis: { tickformat: ".1f" } as any }} /></div>
            <Caption>Topparna sammanfaller med kriser (euro­krisen 2011, covid i mars 2020, räntechocken 2022). Då rör sig alla aktier som en – <b>diversifieringen försvinner precis när man behöver den mest</b>. Låga perioder är bra för aktieval och stat arb.</Caption>
          </section>

          <section className="card span-12 lab3d">
            <div className="card-head"><h2 className="card-title"><span className="idx">07</span>Korrelationslandskapet i 3D</h2><span className="dim" style={{ fontSize: 12 }}>dra för att rotera · klicka på ytan för paranalys</span></div>
            <div className="card-body"><Plot ariaLabel="3D-yta av korrelationsmatrisen" data={surf} height={520} onClick={on3d}
              layout={scene3d({ x: "", y: "", z: "Korrelation" }, { xaxis: { tickfont: { size: 9 }, tickmode: "array", tickvals: idxs.filter((k) => k % 2 === 0), ticktext: labels.filter((_, k) => k % 2 === 0) }, yaxis: { tickfont: { size: 9 }, tickmode: "array", tickvals: idxs.filter((k) => k % 2 === 1), ticktext: labels.filter((_, k) => k % 2 === 1) }, zaxis: { range: [-0.3, 1] }, camera: { eye: { x: 1.5, y: 1.5, z: 1.0 } } } as any)} /></div>
            <Caption>Samma matris som ett berglandskap. <b>Bergskedjor</b> = grupper som rör sig ihop (ofta banker och investmentbolag). <b>Dalar</b> = aktier som går sin egen väg – det är de som sprider risken i en portfölj. Diagonalen är en ås på höjd 1.</Caption>
          </section>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {Object.entries(meta.sectors).map(([k, v]) => <span key={k} className="row dim" style={{ gap: 6, fontSize: 12.5 }}><span className="sector-dot" data-s={k} style={{ background: sectorColor(k) }} />{v}</span>)}
        </div>
      </div>
    </div>
  );
}
