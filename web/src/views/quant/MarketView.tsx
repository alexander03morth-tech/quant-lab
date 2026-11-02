import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric } from "../../components/Metric";
import { cssVar, Plot, scene3d } from "../../components/Plot";
import { Seg } from "../../components/Slider";
import { betaVs } from "../../lib/aktie/beta";
import { useData } from "../../lib/data";
import { useFundamentals } from "../../lib/extra";
import { fmt, fmtPct } from "../../lib/format";
import { PERIODS, periodReturn, periodStart, rollingVolGrid, sectorColor, short, vol, type Period } from "../../lib/market";

type SortKey = "name" | Period | "vol" | "beta";

export function MarketView() {
  const { prices, meta } = useData();
  const fund = useFundamentals();
  const nav = useNavigate();
  const [period, setPeriod] = useState<Period>("1M");
  const [sort, setSort] = useState<SortKey>("1M");
  const bench = meta.benchmark.ticker;
  const last = prices.dates.length - 1;

  const rows = useMemo(() => meta.stocks.map((s) => ({
    ...s,
    r: Object.fromEntries(PERIODS.map((p) => [p.value, periodReturn(prices, s.ticker, p.value)])) as Record<Period, number | null>,
    vol: vol(prices, s.ticker, 252),
    beta: betaVs(prices, s.ticker, bench, 252),
  })), [prices, meta, bench]);
  const idxR = Object.fromEntries(PERIODS.map((p) => [p.value, periodReturn(prices, bench, p.value)])) as Record<Period, number | null>;

  const sorted = [...rows].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "sv");
    const v = (x: (typeof rows)[number]) => (sort === "vol" ? x.vol : sort === "beta" ? x.beta : x.r[sort]) ?? -Infinity;
    return v(b) - v(a);
  });
  const up = rows.filter((r) => (r.r[period] ?? 0) > 0).length;
  const best = [...rows].sort((a, b) => (b.r[period] ?? -9) - (a.r[period] ?? -9))[0];
  const worst = [...rows].sort((a, b) => (a.r[period] ?? 9) - (b.r[period] ?? 9))[0];
  const periodLabel = PERIODS.find((p) => p.value === period)!.label;

  // ── index ──
  const ic = prices.series[bench].close;
  const from = Math.max(0, periodStart(prices.dates, last, period === "1D" || period === "1V" ? "1M" : period));
  const x = prices.dates.slice(from);
  const iy = ic.slice(from);
  const idxData: Data[] = [
    { x, y: iy, type: "scatter", mode: "lines", line: { color: cssVar("--primary"), width: 8 }, opacity: 0.15, hoverinfo: "skip", showlegend: false },
    { x, y: iy, type: "scatter", mode: "lines", name: "OMXS30", line: { color: cssVar("--accent"), width: 1.6 }, fill: "tozeroy", fillcolor: `${cssVar("--primary")}14`, hovertemplate: "%{y:,.1f}<extra></extra>" },
  ];
  const ymin = Math.min(...(iy.filter((v) => v != null) as number[])), ymax = Math.max(...(iy.filter((v) => v != null) as number[]));

  // ── treemap: sektor → aktie, yta = börsvärde, färg = avkastning ──
  const mcap = (t: string) => fund?.items?.[t]?.marketCap ?? 1e11;
  const sectors = Object.keys(meta.sectors).filter((k) => rows.some((r) => r.sector === k));
  const secRet = (k: string) => { const rs = rows.filter((r) => r.sector === k); const w = rs.reduce((s, r) => s + mcap(r.ticker), 0); return rs.reduce((s, r) => s + (r.r[period] ?? 0) * mcap(r.ticker), 0) / w; };
  const lim = period === "1D" ? 0.03 : period === "1V" ? 0.06 : period === "1M" ? 0.1 : period === "3M" ? 0.15 : 0.3;
  const tm: Data[] = [{
    type: "treemap", branchvalues: "total",
    ids: [...sectors.map((k) => `s:${k}`), ...rows.map((r) => r.ticker)],
    labels: [...sectors.map((k) => meta.sectors[k]), ...rows.map((r) => short(r.ticker))],
    parents: [...sectors.map(() => ""), ...rows.map((r) => `s:${r.sector}`)],
    values: [...sectors.map((k) => rows.filter((r) => r.sector === k).reduce((s, r) => s + mcap(r.ticker), 0)), ...rows.map((r) => mcap(r.ticker))],
    text: [...sectors.map((k) => fmtPct(secRet(k), 1, true)), ...rows.map((r) => fmtPct(r.r[period], 1, true))] as any,
    customdata: [...sectors.map((k) => meta.sectors[k]), ...rows.map((r) => r.name)] as any,
    texttemplate: "<b>%{label}</b><br>%{text}", hovertemplate: "<b>%{customdata}</b><br>%{text} (" + periodLabel + ")<extra></extra>",
    marker: {
      colors: [...sectors.map((k) => secRet(k)), ...rows.map((r) => r.r[period] ?? 0)],
      colorscale: [[0, cssVar("--neg")], [0.5, cssVar("--surface-2")], [1, cssVar("--pos")]] as any, cmin: -lim, cmax: lim, cmid: 0,
      line: { color: cssVar("--bg"), width: 2 },
    },
    textfont: { family: cssVar("--mono"), color: "#fff", size: 13 }, pathbar: { visible: false }, tiling: { pad: 2 },
  } as any];

  // ── 3D volatilitetslandskap ──
  const ordered = [...meta.stocks].sort((a, b) => a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name, "sv"));
  const vg = useMemo(() => rollingVolGrid(prices, ordered.map((s) => s.ticker), 2520, 42, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prices, meta]);
  const surf: Data[] = [{
    type: "surface", x: vg.dates, y: ordered.map((s) => short(s.ticker)), z: vg.z, showscale: false, cmin: 0.1, cmax: 0.7,
    colorscale: [[0, cssVar("--surface-2")], [0.35, cssVar("--primary-strong")], [0.7, cssVar("--accent")], [1, "#fff4e8"]] as any,
    hovertemplate: "%{y} · %{x}<br>volatilitet %{z:.0%}/år<extra></extra>",
    lighting: { ambient: 0.65, diffuse: 0.6, specular: 0.2 },
  } as any];


  // ── fördjupning: insikter, sektorer, nedgångar, svängningar, fördelning ──
  const full = useMemo(() => {
    const idxs: number[] = [], vals: number[] = [];
    ic.forEach((v, i) => { if (v != null) { idxs.push(i); vals.push(v); } });
    const dates = idxs.map((i) => prices.dates[i]);
    const r = vals.slice(1).map((v, i) => Math.log(v / vals[i]));
    let peak = -Infinity; const dd = vals.map((v) => { peak = Math.max(peak, v); return v / peak - 1; });
    const L = 63, rv: (number | null)[] = r.map((_, i) => {
      if (i < L) return null;
      const w = r.slice(i - L + 1, i + 1), m = w.reduce((a, b) => a + b, 0) / L;
      return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (L - 1) * 252);
    });
    const m = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1));
    return { dates, dd, r, rv, m, sd };
  }, [ic, prices]);
  const secPerf = sectors.map((k) => ({ k, v: secRet(k) })).sort((a, b) => b.v - a.v);
  const contribTop = [...rows].map((r) => ({ name: r.name, c: (mcap(r.ticker) / rows.reduce((s2, x) => s2 + mcap(x.ticker), 0)) * (r.r[period] ?? 0) })).sort((a, b) => Math.abs(b.c) - Math.abs(a.c))[0];
  const nDown20 = rows.filter((r) => { const c = prices.series[r.ticker].close.slice(-252).filter((v) => v != null) as number[]; return c.length && c[c.length - 1] / Math.max(...c) - 1 < -0.2; }).length;
  const ddNow = full.dd[full.dd.length - 1], volNow = full.rv[full.rv.length - 1] ?? NaN;
  const volMed = (() => { const v = (full.rv.filter((x) => x != null) as number[]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; })();
  const nP = period === "1D" ? 1 : period === "1V" ? 5 : period === "1M" ? 21 : period === "3M" ? 63 : period === "1Y" ? 252 : period === "3Y" ? 756 : last - periodStart(prices.dates, last, "YTD");
  const zP = (idxR[period] ?? 0) / (full.sd * Math.sqrt(nP));
  const tail = full.r.filter((x) => Math.abs(x - full.m) > 3 * full.sd).length;
  const tailExp = full.r.length * 0.0027;
  const histX = full.r.map((x) => x * 100);
  const gx = Array.from({ length: 121 }, (_, i) => -6 + i * 0.1);
  const binW = 0.25;
  const normY = gx.map((x) => (full.r.length * binW) / (full.sd * 100 * Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * ((x - full.m * 100) / (full.sd * 100)) ** 2));
  const secBar: Data[] = [{ type: "bar", orientation: "h", y: secPerf.map((x) => meta.sectors[x.k]).reverse(), x: secPerf.map((x) => x.v).reverse(), marker: { color: secPerf.map((x) => (x.v >= 0 ? cssVar("--pos") : cssVar("--neg"))).reverse() }, text: secPerf.map((x) => fmtPct(x.v, 1, true)).reverse() as any, textposition: "outside", cliponaxis: false, textfont: { family: cssVar("--mono"), size: 11 }, hovertemplate: "%{y}: %{x:+.2%}<extra></extra>" } as any];
  const ddData: Data[] = [{ x: full.dates, y: full.dd, type: "scatter", mode: "lines", fill: "tozeroy", line: { color: cssVar("--neg"), width: 1 }, fillcolor: `${cssVar("--neg")}30`, hovertemplate: "%{y:.1%} från toppen<extra></extra>" }];
  const rvData: Data[] = [{ x: full.dates.slice(1), y: full.rv, type: "scatter", mode: "lines", line: { color: cssVar("--accent"), width: 1.3 }, hovertemplate: "%{y:.0%} per år<extra></extra>" }];
  const histData: Data[] = [
    { type: "histogram", x: histX, xbins: { start: -10, end: 10, size: binW }, marker: { color: cssVar("--primary") }, opacity: 0.8, name: "Verkliga dagar", hovertemplate: "%{x} %: %{y} dagar<extra></extra>" } as any,
    { type: "scatter", mode: "lines", x: gx, y: normY, name: "Normalfördelning", line: { color: cssVar("--text"), width: 1.4, dash: "dot" }, hoverinfo: "skip" },
  ];
  const ctx = { up, n: rows.length };
  const th = (k: SortKey, label: string, info?: string) => (
    <th className="num"><span className="row" style={{ gap: 4, justifyContent: "flex-end" }}><button className="th-sort" aria-pressed={sort === k} onClick={() => setSort(k)}>{label}{sort === k ? " ↓" : ""}</button>{info && <Info id={info} />}</span></th>
  );
  const cls = (v: number | null) => (v == null ? "dim" : v > 0 ? "pos" : v < 0 ? "neg" : "");

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 14, gridTemplateColumns: "1fr" }}>
        <div>
          <div className="hero-kicker"><span>Marknadsöversikt · OMXS30</span><span className="live">t.o.m. {prices.dates[last]}</span></div>
          <h1 className="hero-title">{fmt(ic[last], 1)} <span className={cls(idxR[period])} style={{ fontSize: "0.5em" }}>{fmtPct(idxR[period], 2, true)}</span></h1>
          <p className="hero-sub" style={{ maxWidth: "76ch" }}>Hela indexet på en sida: hur det gått, vilka sektorer och bolag som drivit det, och hur stökigt det är. <Info id="index" /></p>
          <Seg label="Period" value={period} onChange={(v) => { setPeriod(v); setSort(v); }} options={PERIODS} />
        </div>
      </div>

      <div className="stack">
        <div className="metrics">
          {PERIODS.map((p) => <Metric key={p.value} label={`OMXS30 ${p.label}`} value={<span className={cls(idxR[p.value])}>{fmtPct(idxR[p.value], 1, true)}</span>} />)}
        </div>

        <div className="grid">
          <section className="card span-7">
            <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Indexet</h2><span className="dim" style={{ fontSize: 12 }}>{period === "1D" || period === "1V" ? "senaste månaden" : periodLabel}</span></div>
            <div className="card-body"><Plot ariaLabel="OMXS30 över vald period" data={idxData} height={300} layout={{ showlegend: false, yaxis: { range: [ymin * 0.98, ymax * 1.01], tickformat: ",.0f" } as any }} /></div>
            <Caption>OMXS30 är ett index av de 30 mest omsatta aktierna på Stockholmsbörsen. Linjen visar indexets nivå (utan utdelningar).</Caption>
          </section>
          <section className="card span-5">
            <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Bredd</h2></div>
            <div className="card-body">
              <div className="big-num" style={{ fontSize: 44 }}>{up}<span className="dim" style={{ fontSize: 20 }}> / {rows.length}</span></div>
              <p className="muted" style={{ margin: "2px 0 14px" }}>aktier steg {periodLabel === "i år" ? "i år" : `senaste ${periodLabel}`}</p>
              <div className="breadth" style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${(up / rows.length) * 100}%`, background: cssVar("--pos") }} /><div style={{ flex: 1, background: cssVar("--neg") }} />
              </div>
              <table className="data" style={{ marginTop: 16 }}><tbody>
                <tr className="row-link" onClick={() => nav(`/aktie/bolag/${best.ticker}`)}><td>Bäst</td><td>{best.name}</td><td className="num pos">{fmtPct(best.r[period], 1, true)}</td></tr>
                <tr className="row-link" onClick={() => nav(`/aktie/bolag/${worst.ticker}`)}><td>Sämst</td><td>{worst.name}</td><td className="num neg">{fmtPct(worst.r[period], 1, true)}</td></tr>
              </tbody></table>
              <Caption>Bredd säger om uppgången är bred (många aktier upp) eller smal (några få stora bolag drar indexet).</Caption>
            </div>
          </section>

          <section className="card span-12">
            <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Karta över börsen</h2><span className="dim" style={{ fontSize: 12 }}>yta = börsvärde · färg = avkastning {periodLabel}</span></div>
            <div className="card-body"><Plot ariaLabel="Treemap: OMXS30 per sektor och bolag" data={tm} height={460} layout={{ margin: { l: 0, r: 0, t: 0, b: 0 } }} /></div>
            <Caption>Varje ruta är ett bolag, grupperat per sektor. <b>Större ruta = större bolag</b>, och större bolag påverkar indexet mer. Grönt steg, rött föll.</Caption>
          </section>

          <section className="card span-12">
            <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Alla aktier</h2><span className="dim" style={{ fontSize: 12 }}>klicka på en rad för bolagsanalys</span></div>
            <div className="card-body" style={{ overflowX: "auto" }}>
              <table className="data">
                <thead><tr>
                  <th><button className="th-sort" aria-pressed={sort === "name"} onClick={() => setSort("name")}>Bolag</button></th>
                  {PERIODS.map((p) => <th key={p.value} className="num"><button className="th-sort" aria-pressed={sort === p.value} onClick={() => setSort(p.value)}>{p.label}{sort === p.value ? " ↓" : ""}</button></th>)}
                  {th("vol", "Vol 1 år", "volatility")}{th("beta", "Beta", "beta")}
                </tr></thead>
                <tbody>
                  <tr><td><b>OMXS30</b></td>{PERIODS.map((p) => <td key={p.value} className={`num ${cls(idxR[p.value])}`}><b>{fmtPct(idxR[p.value], 1, true)}</b></td>)}<td className="num">{fmtPct(vol(prices, bench), 0)}</td><td className="num dim">1,00</td></tr>
                  {sorted.map((r) => (
                    <tr key={r.ticker} className="row-link" onClick={() => nav(`/aktie/bolag/${r.ticker}`)}>
                      <td><span className="row" style={{ gap: 6 }}><span className="sector-dot" data-s={r.sector} />{r.name}</span></td>
                      {PERIODS.map((p) => <td key={p.value} className={`num ${cls(r.r[p.value])}`}>{fmtPct(r.r[p.value], 1, true)}</td>)}
                      <td className="num">{fmtPct(r.vol, 0)}</td><td className="num">{fmt(r.beta, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>


          <section className="card span-12">
            <div className="card-head"><h2 className="card-title"><span className="idx">05</span>Det här ska du ta med dig</h2><span className="dim" style={{ fontSize: 12 }}>automatisk tolkning · {periodLabel}</span></div>
            <div className="card-body">
              <ul className="insights">
                <li><b>Hur stor var rörelsen?</b> Index {(idxR[period] ?? 0) >= 0 ? "steg" : "föll"} {fmtPct(Math.abs(idxR[period] ?? 0), 1)}. En normal period av den här längden svänger ungefär ±{fmtPct(full.sd * Math.sqrt(nP), 1)}, så det var {Math.abs(zP) >= 2 ? "ovanligt mycket" : Math.abs(zP) >= 1 ? "lite mer än vanligt" : "inom det normala"} ({fmt(Math.abs(zP), 1)} standardavvikelser). <Info id="sigma-move" /></li>
                <li><b>Bred eller smal?</b> {up} av {rows.length} aktier steg. {up / rows.length >= 0.65 ? "Uppgången är bred – det är inte bara några få bolag som drar." : up / rows.length <= 0.35 ? "De flesta aktier föll." : "Ungefär hälften upp och hälften ner – marknaden är splittrad."} Mest påverkan på index hade {contribTop.name} ({fmt(contribTop.c * 100, 2)} procentenheter).</li>
                <li><b>Sektorerna:</b> {meta.sectors[secPerf[0].k]} gick bäst ({fmtPct(secPerf[0].v, 1, true)}) och {meta.sectors[secPerf[secPerf.length - 1].k].toLowerCase()} sämst ({fmtPct(secPerf[secPerf.length - 1].v, 1, true)}). Stor skillnad mellan sektorerna betyder att det spelade roll <i>vad</i> man ägde.</li>
                <li><b>Risknivån:</b> indexets svängningar senaste kvartalet motsvarar {fmtPct(volNow, 0)} per år (mittvärdet sedan 2010 är {fmtPct(volMed, 0)}). {volNow > volMed * 1.25 ? "Det är förhöjt – räkna med större dagsrörelser." : volNow < volMed * 0.8 ? "Det är lugnare än vanligt." : "Det är ungefär normalt."} <Info id="vol-clustering" /></li>
                <li><b>Från toppen:</b> index ligger {fmtPct(Math.abs(ddNow), 1)} under sin högsta nivå någonsin, och {nDown20} av {rows.length} aktier ligger mer än 20 % under sin högsta nivå det senaste året. <Info id="max-drawdown" /></li>
              </ul>
            </div>
          </section>

          <section className="card span-5">
            <div className="card-head"><h2 className="card-title"><span className="idx">06</span>Sektorer {periodLabel}</h2></div>
            <div className="card-body"><Plot ariaLabel="Avkastning per sektor" data={secBar} height={300} layout={{ hovermode: "closest", xaxis: { tickformat: ".0%", zeroline: true, showspikes: false } as any, yaxis: { side: "left", automargin: true } as any, margin: { l: 8, r: 50, t: 4, b: 8 } }} /></div>
            <Caption>Viktat efter börsvärde. Sektorer rör sig ofta i flock eftersom de påverkas av samma saker – räntor för banker, världskonjunkturen för verkstad, kronan för exportörer.</Caption>
          </section>
          <section className="card span-7">
            <div className="card-head"><h2 className="card-title"><span className="idx">07</span>Börsens dagar: inte så normala som man tror <Info id="fat-tails" /></h2></div>
            <div className="card-body"><Plot ariaLabel="Fördelning av indexets dagliga avkastning jämfört med normalfördelning" data={histData} height={300} layout={{ hovermode: "closest", barmode: "overlay", xaxis: { range: [-6, 6], ticksuffix: " %", showspikes: false } as any, yaxis: { type: "log", title: { text: "Antal dagar (log)" } } as any }} /></div>
            <Caption>Staplarna är alla handelsdagar sedan 2010, linjen är vad en normalfördelning förutsäger. Om börsen vore "normal" skulle rörelser större än 3 standardavvikelser hända ungefär {fmt(tailExp, 0)} gånger – i verkligheten hände det <b>{tail} gånger</b>. Stora dagar är mycket vanligare än teorin säger (feta svansar).</Caption>
          </section>
          <section className="card span-6">
            <div className="card-head"><h2 className="card-title"><span className="idx">08</span>Hur långt under toppen?</h2></div>
            <div className="card-body"><Plot ariaLabel="Indexets nedgång från tidigare topp" data={ddData} height={240} layout={{ showlegend: false, yaxis: { tickformat: ".0%" } as any }} /></div>
            <Caption>Varje dal är en börsnedgång – djupet visar hur mycket man förlorat från toppen och bredden hur lång tid det tog att komma tillbaka. Index räknas utan utdelningar, så verkligheten för en ägare var något bättre.</Caption>
          </section>
          <section className="card span-6">
            <div className="card-head"><h2 className="card-title"><span className="idx">09</span>Indexets svängningar över tid <Info id="volatility" /></h2></div>
            <div className="card-body"><Plot ariaLabel="Indexets rullande volatilitet" data={rvData} height={240} layout={{ showlegend: false, yaxis: { tickformat: ".0%" } as any }} /></div>
            <Caption>Rullande 3-månadersvolatilitet. Toppar kommer plötsligt och ebbar ut långsamt – samma mönster som i 3D-landskapet nedan, fast för hela indexet.</Caption>
          </section>
          <section className="card span-12 lab3d">
            <div className="card-head"><h2 className="card-title"><span className="idx">10</span>Volatilitetslandskapet i 3D <Info id="vol-clustering" ctx={ctx} /></h2><span className="dim" style={{ fontSize: 12 }}>42-dagars volatilitet, 10 år · dra för att rotera</span></div>
            <div className="card-body"><Plot ariaLabel="3D: rullande volatilitet per aktie över tid" data={surf} height={520}
              layout={scene3d({ x: "", y: "", z: "Volatilitet/år" }, { zaxis: { tickformat: ".0%" }, yaxis: { tickfont: { size: 9 } }, aspectratio: { x: 2, y: 1.1, z: 0.6 }, camera: { eye: { x: 0.4, y: -2.0, z: 0.9 } } } as any)} /></div>
            <Caption>Varje rad är en aktie (sorterade efter sektor), tiden går från vänster till höger och höjden är hur mycket aktien svängt. <b>Bergskedjor som går tvärs över alla aktier</b> är marknadskriser – tydligast covid i mars 2020. Enskilda toppar är bolagshändelser som rapporter eller bud. Notera att stormarna kommer i kluster.</Caption>
          </section>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          {Object.entries(meta.sectors).map(([k, v]) => <span key={k} className="row dim" style={{ gap: 6, fontSize: 12.5 }}><span className="sector-dot" data-s={k} style={{ background: sectorColor(k) }} />{v}</span>)}
        </div>
      </div>
    </div>
  );
}
