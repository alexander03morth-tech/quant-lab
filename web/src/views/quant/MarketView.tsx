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

          <section className="card span-12 lab3d">
            <div className="card-head"><h2 className="card-title"><span className="idx">05</span>Volatilitetslandskapet i 3D <Info id="vol-clustering" ctx={ctx} /></h2><span className="dim" style={{ fontSize: 12 }}>42-dagars volatilitet, 10 år · dra för att rotera</span></div>
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
