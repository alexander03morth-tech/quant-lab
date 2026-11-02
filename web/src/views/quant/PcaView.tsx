import { useMemo, useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric } from "../../components/Metric";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Seg } from "../../components/Slider";
import { useData } from "../../lib/data";
import { fmt, fmtDays, fmtPct, fmtSigned } from "../../lib/format";
import { sectorColor, short } from "../../lib/market";
import { returnMatrix } from "../../lib/portfolio/engine";
import { eigenReturns, pca, sScores } from "../../lib/stats/pca";

const WINDOWS = [{ value: 252, label: "1 år" }, { value: 504, label: "2 år" }, { value: 756, label: "3 år" }];
const ENTRY = 1.25;

export function PcaView() {
  const { prices, meta, name } = useData();
  const [win, setWin] = useState(252);
  const [pc, setPc] = useState(1);
  const [k, setK] = useState(3);
  const tickers = useMemo(() => meta.stocks.map((s) => s.ticker), [meta]);
  const sector = (t: string) => meta.stocks.find((s) => s.ticker === t)?.sector ?? "";

  const res = useMemo(() => {
    const M = returnMatrix(prices, tickers, meta.benchmark.ticker, win);
    const P = pca(M.R);
    return { M, P };
  }, [prices, tickers, meta, win]);
  const { M, P } = res;
  const nSig = P.values.filter((v) => v > P.mpMax).length;

  const al = useMemo(() => {
    const F = eigenReturns(M.R, P.vectors, P.sd, k);
    return { F, s: sScores(M.R, F, 60) };
  }, [M, P, k]);
  const [sel, setSel] = useState<string | null>(null);

  const N = tickers.length, T = M.dates.length;
  const avgCorr = (() => { let s = 0; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) s += P.corr[i][j]; return s / (N * (N - 1) / 2); })();
  const ctx = { pc1: P.explained[0], nSig, mp: P.mpMax };

  // ── scree ──
  const show = 15;
  const scree: Data[] = [{
    type: "bar", x: P.values.slice(0, show).map((_, i) => `PC${i + 1}`), y: P.values.slice(0, show),
    marker: { color: P.values.slice(0, show).map((v) => (v > P.mpMax ? cssVar("--accent") : cssVar("--surface-2"))), line: { color: cssVar("--border-strong"), width: 1 } },
    customdata: P.explained.slice(0, show) as any, hovertemplate: "%{x}: λ = %{y:.2f}<br>förklarar %{customdata:.1%}<extra></extra>",
  }];

  // ── laddningar ──
  const v = P.vectors[pc - 1];
  const ordL = tickers.map((_, i) => i).sort((a, b) => v[a] - v[b]);
  const load: Data[] = [{
    type: "bar", orientation: "h", y: ordL.map((i) => name(tickers[i])), x: ordL.map((i) => v[i]),
    marker: { color: ordL.map((i) => sectorColor(sector(tickers[i]))) }, hovertemplate: "%{y}: %{x:.3f}<extra></extra>",
  }];
  const topPos = ordL.slice(-3).reverse().map((i) => name(tickers[i])), topNeg = ordL.slice(0, 3).map((i) => name(tickers[i]));
  // "marknaden" om nästan alla laddningar har samma tecken (enstaka nära noll räknas inte)
  const allSame = v.filter((x) => x > 0.02).length >= v.length - 2 && v.every((x) => x > -0.05);

  // ── 3D ──
  const sc3: Data[] = [{
    type: "scatter3d", mode: "markers+text", x: P.vectors[0], y: P.vectors[1], z: P.vectors[2],
    text: tickers.map(short) as any, textposition: "top center", textfont: { size: 10, color: cssVar("--text-2") },
    marker: { size: 6, color: tickers.map((t) => sectorColor(sector(t))), line: { color: "#000", width: 1 } },
    customdata: tickers.map((t) => `${name(t)} · ${meta.sectors[sector(t)]}`) as any, hovertemplate: "<b>%{customdata}</b><br>PC1 %{x:.2f} · PC2 %{y:.2f} · PC3 %{z:.2f}<extra></extra>",
  } as any];

  // ── PC1 mot index ──
  const cum = (r: ArrayLike<number>, scale = 1) => { let g = 1; return Array.from(r, (x) => (g *= 1 + x * scale)); };
  const f1 = al.F[0];
  const sdF = Math.sqrt(Array.from(f1).reduce((s, x) => s + x * x, 0) / T), sdI = Math.sqrt(Array.from(M.idx).reduce((s, x) => s + x * x, 0) / T);
  const pcVsIdx: Data[] = [
    { x: M.dates, y: cum(M.idx), type: "scatter", mode: "lines", name: "OMXS30", line: { color: cssVar("--series-b"), width: 1.4 } },
    { x: M.dates, y: cum(f1, sdI / sdF), type: "scatter", mode: "lines", name: "PC1-portföljen (samma risk)", line: { color: cssVar("--accent"), width: 1.6 } },
  ];

  // ── s-scores ──
  const sRows = tickers.map((t, i) => ({ t, ...al.s[i] })).filter((r) => r.ok).sort((a, b) => a.s - b.s);
  const fast = (r: (typeof sRows)[number]) => r.halfLife <= 30;
  const sBar: Data[] = [{
    type: "bar", x: sRows.map((r) => short(r.t)), y: sRows.map((r) => r.s),
    marker: { color: sRows.map((r) => (!fast(r) ? cssVar("--surface-2") : r.s <= -ENTRY ? cssVar("--pos") : r.s >= ENTRY ? cssVar("--neg") : cssVar("--text-3"))) },
    customdata: sRows.map((r) => [name(r.t), fmtDays(r.halfLife), !fast(r) ? "för långsam återgång – ingen signal" : r.s <= -ENTRY ? "billig mot faktorerna → köp" : r.s >= ENTRY ? "dyr mot faktorerna → blanka" : "ingen signal"]) as any,
    hovertemplate: "<b>%{customdata[0]}</b><br>s = %{y:.2f} · half-life %{customdata[1]}<br><i>%{customdata[2]}</i><extra></extra>",
  }];
  const hl = (y: number, c: string) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: c, width: 1, dash: "dash" } });
  const selT = sel && tickers.includes(sel) ? sel : sRows[0]?.t;
  const si = tickers.indexOf(selT);
  const sObj = al.s[si];
  const resDates = M.dates.slice(-60);
  const resData: Data[] = sObj ? [
    { x: resDates, y: Array.from(sObj.cum), type: "scatter", mode: "lines", name: "Kumulerad residual", line: { color: cssVar("--accent"), width: 1.8 }, hovertemplate: "%{y:.2%}<extra></extra>" },
    { x: [resDates[0], resDates[59]], y: [sObj.m, sObj.m], type: "scatter", mode: "lines", name: "Jämvikt m", line: { color: cssVar("--text-3"), dash: "dot", width: 1 }, hoverinfo: "skip" },
    { x: [resDates[0], resDates[59]], y: [sObj.m + ENTRY * sObj.sigmaEq, sObj.m + ENTRY * sObj.sigmaEq], type: "scatter", mode: "lines", name: "±1,25 σ", line: { color: cssVar("--primary"), dash: "dash", width: 1 }, hoverinfo: "skip" },
    { x: [resDates[0], resDates[59]], y: [sObj.m - ENTRY * sObj.sigmaEq, sObj.m - ENTRY * sObj.sigmaEq], type: "scatter", mode: "lines", showlegend: false, line: { color: cssVar("--primary"), dash: "dash", width: 1 }, hoverinfo: "skip" },
  ] : [];

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>PCA · faktorbaserad stat arb</span><span className="live">{M.dates[0]} – {M.dates[T - 1]}</span></div>
          <h1 className="hero-title">Vad driver hela börsen?</h1>
          <p className="hero-sub" style={{ maxWidth: "78ch" }}>30 aktier rör sig inte oberoende av varandra. PCA hittar de få gemensamma krafterna bakom rörelserna. När man har rensat bort dem återstår det som är unikt för varje bolag, och det är det man handlar i faktorbaserad stat arb (Avellaneda & Lee, 2010). <Info id="pca" ctx={ctx} /></p>
          <Seg label="Fönster" value={win} onChange={setWin} options={WINDOWS} />
        </div>
      </div>

      <div className="stack">
        <div className="metrics">
          <Metric label="PC1 förklarar" info="pca" ctx={ctx} value={fmtPct(P.explained[0], 0)} sub="av all variation" />
          <Metric label="PC1–3 förklarar" value={fmtPct(P.explained[0] + P.explained[1] + P.explained[2], 0)} />
          <Metric label="Över slumpgränsen" info="marchenko-pastur" ctx={ctx} value={nSig} sub={`λ₊ = ${fmt(P.mpMax, 2)}`} />
          <Metric label="Snittkorrelation" info="avg-correlation" value={fmt(avgCorr, 2)} sub={`${N} aktier · ${T} dagar`} />
        </div>

        <div className="grid">
          <section className="card span-5">
            <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Hur många krafter finns det? <Info id="marchenko-pastur" ctx={ctx} /></h2></div>
            <div className="card-body"><Plot ariaLabel="Egenvärden per huvudkomponent med Marchenko–Pastur-gräns" data={scree} height={300}
              layout={{ hovermode: "closest", showlegend: false, yaxis: { title: { text: "Egenvärde λ" } } as any, shapes: [hl(P.mpMax, cssVar("--primary")) as any],
                annotations: [{ xref: "paper", x: 1, y: P.mpMax, yanchor: "bottom", xanchor: "right", text: "slumpgräns", showarrow: false, font: { size: 11, color: cssVar("--primary") } }] as any }} /></div>
            <Caption>Varje stapel är en kraft (komponent). Höjden visar hur mycket av rörelserna den förklarar. <b>Bara de ljusa staplarna över den streckade linjen</b> är starkare än vad slumpen kan skapa med {N} aktier och {T} dagar. Den första är mycket större än resten, och det är marknaden.</Caption>
          </section>

          <section className="card span-7">
            <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Vad består komponenten av? <Info id="eigenportfolio" /></h2>
              <div className="card-tools"><Seg label="Komponent" value={pc} onChange={setPc} options={[1, 2, 3, 4].map((i) => ({ value: i, label: `PC${i}` }))} /></div>
            </div>
            <div className="card-body"><Plot ariaLabel={`Laddningar för PC${pc}`} data={load} height={460} layout={{ hovermode: "closest", showlegend: false, margin: { l: 8, r: 8, t: 4, b: 8 }, yaxis: { side: "left", tickfont: { size: 11 } } as any, xaxis: { zeroline: true, showspikes: false } as any }} /></div>
            <div className="eli5" style={{ margin: "0 16px 16px" }}><b className="k">Tolkning</b>
              {allSame
                ? <>Alla aktier har samma tecken: PC{pc} är <b>marknaden själv</b>. När den rör sig går nästan allt åt samma håll. Den står för {fmtPct(P.explained[pc - 1], 0)} av variationen.</>
                : <>PC{pc} ställer <b>{topPos.join(", ")}</b> mot <b>{topNeg.join(", ")}</b>. En dag när den här kraften är positiv går den första gruppen bättre än den andra. Den står för {fmtPct(P.explained[pc - 1], 1)} av variationen{P.values[pc - 1] < P.mpMax ? <>, och ligger <b>under slumpgränsen</b>, så tolka den försiktigt</> : ""}.</>}
            </div>
          </section>

          <section className="card span-7 lab3d">
            <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Faktorrymden i 3D</h2><span className="dim" style={{ fontSize: 12 }}>dra för att rotera</span></div>
            <div className="card-body"><Plot ariaLabel="3D: aktiernas laddningar på PC1, PC2 och PC3" data={sc3} height={420}
              layout={scene3d({ x: "PC1 (marknaden)", y: "PC2", z: "PC3" }, { camera: { eye: { x: 1.5, y: -1.5, z: 0.9 } } } as any)} /></div>
            <Caption>Varje aktie placerad efter hur mycket den rör sig med de tre största krafterna. Färgen visar sektor. <b>Aktier som klumpar ihop sig reagerar på samma saker</b>, och det är där parkandidaterna finns. En aktie långt från alla andra har mycket egen risk.</Caption>
          </section>
          <section className="card span-5">
            <div className="card-head"><h2 className="card-title"><span className="idx">04</span>PC1 är marknaden</h2></div>
            <div className="card-body"><Plot ariaLabel="PC1-portföljen jämfört med OMXS30" data={pcVsIdx} height={420} /></div>
            <Caption>Om man köper aktierna i proportion till PC1:s laddningar får man en portfölj som följer indexet nästan exakt, trots att PCA aldrig fått se indexet. Det visar att den största gemensamma kraften är marknaden.</Caption>
          </section>

          <section className="card span-12">
            <div className="card-head"><h2 className="card-title"><span className="idx">05</span>Avellaneda–Lee: vilka aktier är billiga mot faktorerna? <Info id="s-score" ctx={sObj ? { name: name(selT), s: sObj.s } : undefined} /></h2>
              <div className="card-tools"><span className="dim" style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>Antal faktorer <Info id="factor-model" /></span>
                <Seg label="Antal faktorer" value={k} onChange={setK} options={[1, 2, 3, 4, 5].map((i) => ({ value: i, label: String(i) }))} /></div>
            </div>
            <div className="card-body"><Plot ariaLabel="s-score per aktie" data={sBar} height={280} onClick={(pt) => { const r = sRows[pt?.pointNumber]; if (r) setSel(r.t); }}
              layout={{ hovermode: "closest", showlegend: false, shapes: [hl(ENTRY, cssVar("--neg")), hl(-ENTRY, cssVar("--pos"))] as any, yaxis: { zeroline: true, title: { text: "s-score" } } as any, xaxis: { showspikes: false, tickfont: { size: 10 } } as any }} /></div>
            <Caption>För varje aktie rensas de senaste 60 dagarnas avkastning från {k} {k === 1 ? "faktor" : "faktorer"}. Det som återstår är bolagets egen rörelse, och s-score visar hur långt den ligger från sitt normala läge. <b>Grönt</b> (s ≤ −1,25) = billig, så köp aktien och blanka faktorerna. <b>Rött</b> (s ≥ 1,25) = dyr. Grått = återgången är för långsam för att räknas. Klicka på en stapel.</Caption>
          </section>

          {sObj && (
            <section className="card span-12">
              <div className="card-head"><h2 className="card-title"><span className="idx">06</span>{name(selT)}: den egna rörelsen</h2>
                <span className="dim mono" style={{ fontSize: 12 }}>s = {fmtSigned(sObj.s, 2)} · κ = {fmt(sObj.kappa, 1)}/år · half-life {fmtDays(sObj.halfLife)}</span></div>
              <div className="card-body"><Plot ariaLabel={`Kumulerad residual för ${name(selT)}`} data={resData} height={240} layout={{ yaxis: { tickformat: ".1%" } as any }} /></div>
              <Caption>Linjen är summan av {name(selT)}s egna rörelser, efter att marknaden och sektorerna dragits bort, de senaste 60 dagarna. Den antas svänga kring jämviktsnivån (prickad linje). Står linjen långt under det nedre bandet är aktien billig relativt resten av börsen.</Caption>
            </section>
          )}
        </div>
        <p className="dim" style={{ fontSize: 12.5 }}>
          Metod: PCA på korrelationsmatrisen för dagliga avkastningar i valt fönster. Egenportföljer viktade v<sub>i</sub>/σ<sub>i</sub>. Residualerna kommer från en regression av de senaste 60 dagarna på faktorerna, och en AR(1)-modell anpassas på den kumulerade residualen. m centreras över alla aktier, och bara aktier med half-life ≤ 30 dagar ger signal (Avellaneda & Lee 2010, avsnitt 4). Siffrorna visar läget idag och är ingen backtest.
        </p>
      </div>
    </div>
  );
}
