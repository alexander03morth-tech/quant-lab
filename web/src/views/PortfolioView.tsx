import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../components/Caption";
import { Info } from "../components/Info";
import { Metric, type Tone } from "../components/Metric";
import { cssVar, Plot } from "../components/Plot";
import { Seg } from "../components/Slider";
import { useData } from "../lib/data";
import { fmt, fmtPct, fmtSigned } from "../lib/format";
import { covariance, diversificationRatio, maxSharpe, meanReturns, minVariance, returnMatrix, riskContrib, simulate } from "../lib/portfolio/engine";
import { decodePortfolio, usePortfolios } from "../lib/portfolio/store";
import { betaAlpha, drawdown, equityFrom, perf } from "../lib/stats/perf";
import { Builder } from "./portfolio/Builder";
import { Portfolio3D } from "./portfolio/Portfolio3D";

const WINDOWS = [
  { value: "1Y", label: "1 år", days: 252 }, { value: "3Y", label: "3 år", days: 756 },
  { value: "5Y", label: "5 år", days: 1260 }, { value: "10Y", label: "10 år", days: 2520 }, { value: "MAX", label: "Max", days: 0 },
];

export function PortfolioView() {
  const { prices, meta, name } = useData();
  const { active, create, save } = usePortfolios();
  const [sp, setSp] = useSearchParams();
  const [w, setW] = useState("5Y");
  const [hedged, setHedged] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const bench = meta.benchmark.ticker;

  // Import från delad länk
  useEffect(() => {
    const code = sp.get("p");
    if (!code) return;
    const p = decodePortfolio(code);
    if (p) create({ ...p, holdings: p.holdings.filter((h) => prices.series[h.ticker]) });
    sp.delete("p"); setSp(sp, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const p = active;
  const holdings = (p?.holdings ?? []).filter((h) => prices.series[h.ticker]);
  const tickers = holdings.map((h) => h.ticker);
  const weights = holdings.map((h) => h.weight);
  const days = WINDOWS.find((x) => x.value === w)!.days;

  const M = useMemo(() => (tickers.length ? returnMatrix(prices, tickers, bench, days) : null), [prices, tickers.join(","), bench, days]); // eslint-disable-line react-hooks/exhaustive-deps

  const res = useMemo(() => {
    if (!M || M.dates.length < 30) return null;
    const sim = simulate(M, weights, p!.rebalance);
    const ba = betaAlpha(sim.ret, M.idx);
    const hedgedRet = Float64Array.from(sim.ret, (r, t) => r - ba.beta * M.idx[t]);
    const C = covariance(M.R);
    const rc = riskContrib(C, weights);
    const vols = C.map((row, i) => Math.sqrt(row[i] * 252));
    const corr = C.map((row, i) => row.map((c, j) => c / Math.sqrt(C[i][i] * C[j][j])));
    return {
      sim, ba, hedgedRet, C, rc, vols, corr,
      perf: perf(sim.ret), idxPerf: perf(M.idx), hedgedPerf: perf(hedgedRet),
      eq: equityFrom(sim.ret), idxEq: equityFrom(M.idx), hedgedEq: equityFrom(hedgedRet),
      dr: diversificationRatio(C, weights),
    };
  }, [M, weights.join(","), p?.rebalance]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null;

  const optimize = (kind: "minvar" | "maxsharpe") => {
    if (!M) return;
    const C = covariance(M.R);
    const wts = kind === "minvar" ? minVariance(C) : maxSharpe(meanReturns(M.R), C);
    save({ ...p, holdings: holdings.map((h, i) => ({ ...h, weight: Math.round(wts[i] * 1000) / 1000 })) });
  };

  const colA = cssVar("--series-a"), colB = cssVar("--series-b"), colC = cssVar("--series-c"), neg = cssVar("--neg"), txt3 = cssVar("--text-3"), prim = cssVar("--primary");

  let body: React.ReactNode = null;
  if (!M || !res) {
    body = <div className="notice span-12"><span className="icon">!</span>Lägg till minst en aktie för att se analysen{M && M.dates.length < 30 ? " – för kort gemensam historik" : ""}.</div>;
  } else {
    const x = M.dates;
    const pf = res.perf, ip = res.idxPerf;
    const ctx = {
      name: p.name, total: pf.totalReturn, cagr: pf.cagr, sharpe: pf.sharpe, idxSharpe: ip.sharpe, maxDD: pf.maxDD,
      ddStart: x[pf.maxDDStart], ddEnd: x[pf.maxDDEnd], beta: res.ba.beta, var: pf.var95, cvar: pf.cvar95, value: p.value,
      dr: res.dr, vol: pf.vol,
      ...(() => {
        const j = res.rc.share.reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0);
        return { topRisk: name(tickers[j]), topRiskShare: res.rc.share[j], topRiskWeight: weights[j] };
      })(),
    };
    const better = (a: number, b: number) => (a > b ? "good" : "bad") as Tone;
    const ddP = drawdown(res.eq), ddI = drawdown(res.idxEq);
    const eqHover = (v: number) => `${fmt(v * p.value, 0)} kr`;

    const eqData: Data[] = [
      { x, y: Array.from(res.eq), type: "scatter", mode: "lines", line: { color: colA, width: 9 }, opacity: 0.15, hoverinfo: "skip", showlegend: false },
      { x, y: Array.from(res.eq), type: "scatter", mode: "lines", name: p.name, line: { color: colA, width: 2 }, customdata: Array.from(res.eq, eqHover) as any, hovertemplate: `${p.name}: %{y:.2f} (%{customdata})<extra></extra>` },
      { x, y: Array.from(res.idxEq), type: "scatter", mode: "lines", name: "OMXS30", line: { color: colB, width: 1.4 }, hovertemplate: "OMXS30: %{y:.2f}<extra></extra>" },
      ...(hedged ? [{ x, y: Array.from(res.hedgedEq), type: "scatter", mode: "lines", name: `Betahedgad (β ${fmt(res.ba.beta, 2)})`, line: { color: colC, width: 1.6, dash: "dot" }, hovertemplate: "Hedgad: %{y:.2f}<br><i>bara den bolagsspecifika delen</i><extra></extra>" } as Data] : []),
    ];
    const ddData: Data[] = [
      { x, y: Array.from(ddP), type: "scatter", mode: "lines", name: p.name, fill: "tozeroy", fillcolor: `${neg}33`, line: { color: neg, width: 1.2 }, hovertemplate: `${p.name}: %{y:.1%} från toppen<extra></extra>` },
      { x, y: Array.from(ddI), type: "scatter", mode: "lines", name: "OMXS30", line: { color: txt3, width: 1, dash: "dot" }, hovertemplate: "OMXS30: %{y:.1%}<extra></extra>" },
    ];
    const order = tickers.map((_, i) => i).sort((a, b) => res.rc.share[b] - res.rc.share[a]);
    const rcData: Data[] = [
      { type: "bar", name: "Vikt", y: order.map((i) => name(tickers[i])), x: order.map((i) => weights[i]), orientation: "h", marker: { color: colB }, hovertemplate: "%{y}: vikt %{x:.1%}<extra></extra>" },
      { type: "bar", name: "Andel av risken", y: order.map((i) => name(tickers[i])), x: order.map((i) => res.rc.share[i]), orientation: "h", marker: { color: colA },
        customdata: order.map((i) => (res.rc.share[i] > weights[i] * 1.25 ? "tar mer risk än vikten antyder" : res.rc.share[i] < weights[i] * 0.75 ? "diversifierar – mindre risk än vikten" : "ungefär i proportion till vikten")) as any,
        hovertemplate: "%{y}: %{x:.1%} av risken<br><i>%{customdata}</i><extra></extra>" },
    ];
    const short = (t: string) => t.replace(".ST", "");
    const heat: Data[] = [{
      type: "heatmap", z: res.corr, x: tickers.map(short), y: tickers.map(short), zmin: -1, zmax: 1,
      colorscale: [[0, cssVar("--series-b")], [0.5, cssVar("--surface-2")], [1, cssVar("--accent")]],
      text: res.corr.map((row) => row.map((v) => fmt(v, 2))) as any, texttemplate: tickers.length <= 12 ? "%{text}" : "", textfont: { family: cssVar("--mono"), size: 10 },
      customdata: res.corr.map((row) => row.map((v) => (v > 0.7 ? "rör sig nästan ihop – lite diversifiering" : v > 0.4 ? "måttligt samband" : v > 0 ? "svagt samband – bra diversifiering" : "rör sig åt olika håll"))) as any,
      hovertemplate: "%{y} / %{x}: %{z:.2f}<br><i>%{customdata}</i><extra></extra>",
      colorbar: { thickness: 8, len: 0.8, tickfont: { family: cssVar("--mono"), size: 10 } } as any,
    } as any];
    // histogram + normalkurva
    const r = Array.from(res.sim.ret);
    const mu = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - mu) ** 2, 0) / r.length);
    const bw = sd / 4, xs = Array.from({ length: 121 }, (_, i) => mu - 6 * sd + (i * 12 * sd) / 120);
    const histData: Data[] = [
      { type: "histogram", x: r, xbins: { size: bw }, name: "Faktiska dagar", marker: { color: colA, line: { width: 0 } }, opacity: 0.85, hovertemplate: "%{x:.2%}: %{y} dagar<extra></extra>" },
      { type: "scatter", mode: "lines", x: xs, y: xs.map((v) => (r.length * bw * Math.exp(-0.5 * ((v - mu) / sd) ** 2)) / (sd * Math.sqrt(2 * Math.PI))), name: "Normalfördelning", line: { color: txt3, dash: "dash", width: 1.5 }, hoverinfo: "skip" },
    ];
    const tailCount = r.filter((v) => Math.abs(v - mu) > 3 * sd).length;
    const expectedTail = r.length * 0.0027;
    const histShapes = [
      { type: "line", x0: -pf.var95, x1: -pf.var95, yref: "paper", y0: 0, y1: 1, line: { color: prim, width: 1.5, dash: "dash" } },
      { type: "line", x0: -pf.cvar95, x1: -pf.cvar95, yref: "paper", y0: 0, y1: 1, line: { color: neg, width: 1.5, dash: "dot" } },
    ];

    body = (
      <>
        <div className="metrics span-12">
          <Metric label="Total avkastning" info="total-return" ctx={ctx} value={fmtPct(pf.totalReturn, 1, true)} sub={`OMXS30 ${fmtPct(ip.totalReturn, 1, true)}`} tone={better(pf.totalReturn, ip.totalReturn)} toneLabel={pf.totalReturn > ip.totalReturn ? "slog index" : "efter index"} />
          <Metric label="CAGR" info="total-return" ctx={ctx} value={fmtPct(pf.cagr, 1, true)} sub={`index ${fmtPct(ip.cagr, 1, true)}`} />
          <Metric label="Volatilitet" info="volatility" ctx={ctx} value={fmtPct(pf.vol, 1)} sub={`index ${fmtPct(ip.vol, 1)}`} />
          <Metric label="Sharpe" info="sharpe" ctx={ctx} value={fmt(pf.sharpe, 2)} tone={pf.sharpe > ip.sharpe ? "good" : "mid"} toneLabel={`index ${fmt(ip.sharpe, 2)}`} />
          <Metric label="Sortino" info="sortino" ctx={ctx} value={fmt(pf.sortino, 2)} />
          <Metric label="Max drawdown" info="max-drawdown" ctx={ctx} value={fmtPct(pf.maxDD, 1)} sub={`index ${fmtPct(ip.maxDD, 1)}`} />
          <Metric label="Calmar" info="calmar" ctx={ctx} value={fmt(pf.calmar, 2)} />
          <Metric label="Beta" info="beta" ctx={ctx} value={fmt(res.ba.beta, 2)} sub={`korr ${fmt(res.ba.corr, 2)}`} />
          <Metric label="Alfa / år" info="alpha" ctx={ctx} value={fmtPct(res.ba.alpha, 1, true)} />
          <Metric label="VaR 95 % / dag" info="var" ctx={ctx} value={`${fmt(pf.var95 * p.value, 0)} kr`} sub={fmtPct(pf.var95, 2)} />
          <Metric label="CVaR 95 %" info="cvar" ctx={ctx} value={`${fmt(pf.cvar95 * p.value, 0)} kr`} sub={fmtPct(pf.cvar95, 2)} />
          <Metric label="Diversifiering" info="diversification" ctx={ctx} value={fmt(res.dr, 2)} tone={res.dr > 1.3 ? "good" : res.dr > 1.1 ? "mid" : "bad"} toneLabel={res.dr > 1.3 ? "bra spridning" : res.dr > 1.1 ? "viss" : "låg"} />
        </div>
        {M.limitedBy && M.available < (days || Infinity) && (
          <div className="notice span-12"><span className="icon">!</span>Historiken begränsas av {name(M.limitedBy)} – gemensam data finns från {M.dates[0]}.</div>
        )}

        <section className="card span-12">
          <div className="card-head">
            <h2 className="card-title"><span className="idx">02</span>Utveckling mot OMXS30 <Info id="total-return" ctx={ctx} /></h2>
            <div className="card-tools">
              <Seg label="Fönster" value={w} onChange={setW} options={WINDOWS.map(({ value, label }) => ({ value, label }))} />
              <button className="btn" aria-pressed={hedged} onClick={() => setHedged(!hedged)} style={hedged ? { borderColor: colC, color: cssVar("--text") } : undefined}>Betahedge</button>
              <Info id="beta-hedge" ctx={ctx} />
              <button className="btn" aria-pressed={logScale} onClick={() => setLogScale(!logScale)}>{logScale ? "Log" : "Linjär"}</button>
            </div>
          </div>
          <div className="card-body"><Plot ariaLabel="Portföljens värdeutveckling jämfört med OMXS30" data={eqData} height={320} layout={{ yaxis: { type: logScale ? "log" : "linear", tickformat: ".2f" } as any }} /></div>
          <Caption>
            1,00 = det du satte in. Kopparlinjen är din portfölj, den blå är OMXS30. {hedged ? <>Den streckade lila linjen visar vad som blir kvar om man tar bort marknadens påverkan (<b>betahedge</b>): stiger den har dina aktier gjort det bättre än börsen, även justerat för risk.</> : <>Tryck på <b>Betahedge</b> för att se hur portföljen hade gått om marknadens upp- och nedgångar tagits bort.</>} Hovra för värdet i kronor.
          </Caption>
        </section>

        <section className="card span-6">
          <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Drawdown <Info id="max-drawdown" ctx={ctx} /></h2></div>
          <div className="card-body"><Plot ariaLabel="Drawdown: fall från senaste topp" data={ddData} height={240} layout={{ yaxis: { tickformat: ".0%" } as any }} /></div>
          <Caption>Hur långt under sin tidigare topp portföljen låg varje dag. 0 % = på toppen. Den djupaste dalen är <b>max drawdown</b> ({fmtPct(pf.maxDD, 1)}) – det värsta du hade behövt sitta igenom.</Caption>
        </section>

        <section className="card span-6">
          <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Vikt mot riskbidrag <Info id="risk-contribution" ctx={ctx} /></h2></div>
          <div className="card-body"><Plot ariaLabel="Varje akties vikt jämfört med dess andel av risken" data={rcData} height={Math.max(240, 26 * tickers.length + 60)} layout={{ barmode: "group", hovermode: "closest", xaxis: { tickformat: ".0%" } as any, yaxis: { side: "left", autorange: "reversed" } as any, bargap: 0.25 }} /></div>
          <Caption>Blå stapel = hur mycket pengar som ligger i aktien. Koppar = hur stor del av portföljens <b>svängningar</b> som kommer därifrån. När koppar är mycket längre än blå dominerar aktien risken – trots att vikten ser oskyldig ut.</Caption>
        </section>

        <section className="card span-6">
          <div className="card-head"><h2 className="card-title"><span className="idx">05</span>Korrelation mellan innehaven <Info id="correlation" ctx={ctx} /></h2><Info id="diversification" ctx={ctx} /></div>
          <div className="card-body"><Plot ariaLabel="Korrelationsmatris för portföljens aktier" data={heat} height={Math.max(260, 24 * tickers.length + 80)} layout={{ hovermode: "closest", xaxis: { side: "bottom", tickangle: -45 } as any, yaxis: { side: "left", autorange: "reversed" } as any }} /></div>
          <Caption>Varje ruta visar hur två av dina aktier rör sig ihop (−1 till +1). <b>Mycket kopparfärg = aktierna följs åt</b> och skyddar dåligt mot varandra. Blått = de går åt olika håll, vilket sänker portföljens risk.</Caption>
        </section>

        <section className="card span-6">
          <div className="card-head"><h2 className="card-title"><span className="idx">06</span>Fördelning av dagliga avkastningar <Info id="fat-tails" ctx={ctx} /></h2><Info id="var" ctx={ctx} /></div>
          <div className="card-body"><Plot ariaLabel="Histogram över dagliga avkastningar med normalfördelning" data={histData} height={260} layout={{ hovermode: "closest", bargap: 0.05, shapes: histShapes as any, xaxis: { tickformat: ".1%", range: [mu - 5 * sd, mu + 5 * sd] } as any }} /></div>
          <Caption>
            Staplarna visar hur många dagar portföljen gick upp eller ner olika mycket. Den streckade kurvan är vad en normalfördelning förutsäger.
            Koppar streck = <b>VaR</b> (en dag av tjugo är värre), rött = <b>CVaR</b> (snittet av de dagarna). Dagar med rörelse över 3σ: <b>{tailCount}</b> mot {fmt(expectedTail, 1)} väntat – {tailCount > expectedTail * 1.5 ? "feta svansar, precis som teorin varnar för." : "ungefär som normalfördelningen."}
          </Caption>
        </section>

        <Portfolio3D M={M} weights={weights} ret={res.sim.ret} drift={res.sim.drift} tickers={tickers} value={p.value} ctx={ctx} name={name} />

        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">08</span>Innehav i detalj</h2></div>
          <div className="card-body" style={{ overflowX: "auto" }}>
            <table className="data">
              <thead><tr><th>Aktie</th><th className="num">Vikt</th><th className="num">Vikt idag*</th><th className="num">Volatilitet</th><th className="num">Riskbidrag</th><th className="num">Avkastning</th><th className="num">Bidrag till avk.</th></tr></thead>
              <tbody>
                {tickers.map((t, i) => {
                  const tot = M.R[i].reduce((a, v) => a * (1 + v), 1) - 1;
                  const contrib = M.R[i].reduce((s, v, k) => s + v * (k === 0 ? weights[i] : res.sim.drift[i][k - 1]), 0);
                  return (
                    <tr key={t}>
                      <td>{name(t)}</td><td className="num">{fmtPct(weights[i], 1)}</td><td className="num dim">{fmtPct(res.sim.drift[i][res.sim.drift[i].length - 1], 1)}</td>
                      <td className="num">{fmtPct(res.vols[i], 1)}</td><td className="num">{fmtPct(res.rc.share[i], 1)}</td>
                      <td className={`num ${tot >= 0 ? "pos" : "neg"}`}>{fmtPct(tot, 1, true)}</td><td className={`num ${contrib >= 0 ? "pos" : "neg"}`}>{fmtSigned(contrib * 100, 1)} pe</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>* Vikten efter kursrörelserna sedan senaste ombalansering. Bidrag till avkastning i procentenheter (summan av daglig vikt × avkastning). Avgifter och courtage ingår inte. Riskfri ränta antas vara 0.</p>
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Portföljlabb</span><span className="live">{holdings.length} innehav</span></div>
          <h1 className="hero-title">{p.name}</h1>
          <p className="hero-sub">Välj aktier, sätt vikter och se hur portföljen hade gått, hur riskfylld den är och vad som driver risken. Allt räknas i din webbläsare och sparas bara här på enheten.</p>
        </div>
      </div>
      <div className="grid">
        <Builder p={p} onOptimize={optimize} />
        {body}
      </div>
    </div>
  );
}
