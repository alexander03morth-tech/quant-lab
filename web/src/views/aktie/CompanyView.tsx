import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Caption } from "../../components/Caption";
import { Info } from "../../components/Info";
import { Metric, type Tone } from "../../components/Metric";
import { cssVar, Plot } from "../../components/Plot";
import { useData } from "../../lib/data";
import { timeAgo, useFundamentals, useNews, type Fundamentals } from "../../lib/extra";
import { fmt, fmtPct } from "../../lib/format";

const mdkr = (v: number | null | undefined) => (v == null ? "–" : `${fmt(v / 1e9, Math.abs(v) >= 1e11 ? 0 : 1)} mdkr`);

export function CompanyView() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const { meta } = useData();
  const fund = useFundamentals();
  const t = ticker && meta.stocks.some((s) => s.ticker === ticker) ? ticker : "VOLV-B.ST";
  if (fund === undefined) return <div className="plot-loading" style={{ minHeight: "40vh" }}>Laddar nyckeltal…</div>;
  const f = fund?.items[t];
  if (!f) return <div className="notice"><span className="icon">!</span>Nyckeltal saknas för det här bolaget.</div>;
  return <Company t={t} f={f} onPick={(k) => navigate(`/aktie/bolag/${k}`)} fetchedAt={fund!.fetchedAt} />;
}

function Company({ t, f, onPick, fetchedAt }: { t: string; f: Fundamentals; onPick: (t: string) => void; fetchedAt: string }) {
  const { prices, meta } = useData();
  const news = useNews();
  const bank = f.sector === "finans";
  const series = useMemo(() => {
    const c = prices.series[t].close, ci = prices.series[meta.benchmark.ticker].close;
    const idx: number[] = [];
    for (let i = 0; i < prices.dates.length; i++) if (c[i] != null && ci[i] != null) idx.push(i);
    const take = idx.slice(-1260);
    const a0 = c[take[0]] as number, b0 = ci[take[0]] as number;
    const last = c[idx[idx.length - 1]] as number, prev = c[idx[idx.length - 2]] as number;
    const y1 = c[idx[Math.max(0, idx.length - 253)]] as number;
    return { x: take.map((i) => prices.dates[i]), a: take.map((i) => (100 * (c[i] as number)) / a0), b: take.map((i) => (100 * (ci[i] as number)) / b0), last, d1: last / prev - 1, y1: last / y1 - 1 };
  }, [prices, t, meta]);

  const ctx = { name: f.name, pe: f.pe, roe: f.roe, divYield: f.divYield, evEbitda: f.evEbitda, target: f.targetMean, price: f.price, analysts: f.analysts };
  const colA = cssVar("--series-a"), colB = cssVar("--series-b"), pos = cssVar("--pos");

  // kvalitetskort
  const checks: { ok: boolean | null; label: string; detail: string; info: string }[] = [
    { ok: f.roe == null ? null : f.roe >= 0.15, label: "Lönsamt (ROE ≥ 15 %)", detail: fmtPct(f.roe, 0), info: "roe" },
    bank ? { ok: f.pb == null ? null : f.pb <= 1.5, label: "Rimligt prissatt mot eget kapital (P/B ≤ 1,5)", detail: f.pb == null ? "–" : `${fmt(f.pb, 1)}×`, info: "pb" }
      : { ok: f.netDebtEbitda == null ? null : f.netDebtEbitda <= 2, label: "Låg skuld (nettoskuld ≤ 2× EBITDA)", detail: f.netDebtEbitda == null ? "–" : `${fmt(f.netDebtEbitda, 1)}×`, info: "leverage-multiple" },
    { ok: f.revenueGrowth == null ? null : f.revenueGrowth > 0.03, label: "Växer (omsättning > 3 %)", detail: fmtPct(f.revenueGrowth, 1, true), info: "total-return" },
    bank ? { ok: f.divYield == null ? null : f.divYield >= 0.03, label: "Delar ut (≥ 3 %)", detail: fmtPct(f.divYield, 1), info: "div-yield" }
      : { ok: f.fcfYield == null ? null : f.fcfYield >= 0.03, label: "Starkt kassaflöde (FCF ≥ 3 % av börsvärdet)", detail: fmtPct(f.fcfYield, 1), info: "fcf-yield" },
    { ok: f.pe == null ? null : f.pe <= 20, label: "Inte för dyrt (P/E ≤ 20)", detail: f.pe == null ? "–" : fmt(f.pe, 1), info: "pe" },
  ];
  const score = checks.filter((c) => c.ok).length;

  const hist = f.history.filter((h) => h.revenue);
  const histData: Data[] = [
    { type: "bar", name: "Omsättning", x: hist.map((h) => String(h.year)), y: hist.map((h) => h.revenue / 1e9), marker: { color: colB }, hovertemplate: "%{x}: omsättning %{y:.1f} mdkr<extra></extra>" },
    ...(!bank ? [{ type: "bar", name: "EBITDA", x: hist.map((h) => String(h.year)), y: hist.map((h) => (h.ebitda ?? 0) / 1e9), marker: { color: colA }, hovertemplate: "%{x}: EBITDA %{y:.1f} mdkr<extra></extra>" } as Data] : []),
    ...(!bank ? [{ type: "scatter", mode: "lines+markers", name: "EBITDA-marginal", x: hist.map((h) => String(h.year)), y: hist.map((h) => (h.ebitda ?? NaN) / h.revenue), yaxis: "y2", line: { color: pos, width: 2 }, hovertemplate: "%{x}: marginal %{y:.1%}<extra></extra>" } as Data] : []),
  ];
  const priceData: Data[] = [
    { x: series.x, y: series.a, type: "scatter", mode: "lines", line: { color: colA, width: 8 }, opacity: 0.14, hoverinfo: "skip", showlegend: false },
    { x: series.x, y: series.a, type: "scatter", mode: "lines", name: f.name, line: { color: colA, width: 1.8 }, hovertemplate: `${f.name}: %{y:.0f}<extra></extra>` },
    { x: series.x, y: series.b, type: "scatter", mode: "lines", name: "OMXS30", line: { color: colB, width: 1.3 }, hovertemplate: "OMXS30: %{y:.0f}<extra></extra>" },
  ];
  const lo = f.low52 ?? 0, hi = f.high52 ?? 1, pos52 = Math.max(0, Math.min(1, ((f.price ?? lo) - lo) / (hi - lo || 1)));
  const items = news?.items[t]?.slice(0, 6) ?? [];
  const tgtLo = f.targetLow, tgtHi = f.targetHigh, tgt = f.targetMean, price = f.price;

  return (
    <>
      <div className="hero" style={{ marginBottom: 14 }}>
        <div>
          <div className="hero-kicker"><span>Bolagsanalys</span><span className="live">{meta.sectors[f.sector]}{f.industry ? ` · ${f.industry}` : ""}</span></div>
          <h1 className="hero-title">{f.name}</h1>
          <div className="row">
            <select className="select" value={t} onChange={(e) => onPick(e.target.value)} aria-label="Välj bolag">
              {[...meta.stocks].sort((a, b) => a.name.localeCompare(b.name, "sv")).map((s) => <option key={s.ticker} value={s.ticker}>{s.name}</option>)}
            </select>
            {!bank && <Link className="btn" to={`/aktie/dcf/${t}`}>Värdera med DCF →</Link>}
            <Link className="btn" to="/aktie/jamfor">Jämför med branschen →</Link>
          </div>
        </div>
        <div className="hero-right">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div><div className="dim" style={{ fontSize: 12.5 }}>Kurs</div><div className="big-num" style={{ textShadow: "none" }}>{fmt(series.last, 2)}</div></div>
            <div style={{ textAlign: "right" }} className="num">
              <div className={series.d1 >= 0 ? "pos" : "neg"} style={{ fontSize: 20 }}>{fmtPct(series.d1, 2, true)} idag</div>
              <div className={series.y1 >= 0 ? "pos" : "neg"} style={{ fontSize: 14 }}>{fmtPct(series.y1, 1, true)} på ett år</div>
            </div>
          </div>
          <div>
            <div className="dim" style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}><span>52 v lägst {fmt(lo, 0)}</span><span>52-veckorsintervall <Info id="range-52w" /></span><span>högst {fmt(hi, 0)}</span></div>
            <div className="range52"><div className="range52-fill" style={{ width: `${pos52 * 100}%` }} /><div className="range52-dot" style={{ left: `${pos52 * 100}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="metrics span-12">
          <Metric label="Börsvärde" value={mdkr(f.marketCap)} sub={f.employees ? `${fmt(f.employees, 0)} anställda` : undefined} info="enterprise-value" ctx={ctx} />
          <Metric label="P/E" info="pe" ctx={ctx} value={f.pe == null ? "–" : fmt(f.pe, 1)} tone={f.pe == null ? undefined : f.pe < 12 ? "good" : f.pe < 22 ? "neutral" : "mid"} toneLabel={f.pe == null ? undefined : f.pe < 12 ? "lågt" : f.pe < 22 ? "normalt" : "högt"} />
          {bank ? <Metric label="P/B" info="pb" ctx={ctx} value={f.pb == null ? "–" : `${fmt(f.pb, 2)}×`} /> : <Metric label="EV/EBITDA" info="ev-ebitda" ctx={ctx} value={f.evEbitda == null ? "–" : `${fmt(f.evEbitda, 1)}×`} />}
          <Metric label="ROE" info="roe" ctx={ctx} value={fmtPct(f.roe, 0)} tone={f.roe == null ? undefined : (f.roe >= 0.15 ? "good" : f.roe >= 0.08 ? "mid" : "bad") as Tone} toneLabel={f.roe == null ? undefined : f.roe >= 0.15 ? "hög" : f.roe >= 0.08 ? "ok" : "låg"} />
          {!bank && <Metric label="EBITDA-marginal" info="margins" ctx={ctx} value={fmtPct(f.ebitdaMargin, 0)} />}
          <Metric label="Direktavkastning" info="div-yield" ctx={ctx} value={fmtPct(f.divYield, 1)} sub={f.divPerShare ? `${fmt(f.divPerShare, 2)} kr/aktie` : undefined} />
          {!bank && <Metric label="Nettoskuld / EBITDA" info="leverage-multiple" ctx={ctx} value={f.netDebtEbitda == null ? "–" : `${fmt(f.netDebtEbitda, 1)}×`} />}
        </div>

        <section className="card span-8">
          <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Kurs mot OMXS30, 5 år <Info id="index" /></h2></div>
          <div className="card-body"><Plot ariaLabel={`${f.name} mot OMXS30 senaste fem åren`} data={priceData} height={280} /></div>
          <Caption>Båda startar på 100 för fem år sedan. Ligger koppar över blått har {f.name} gått bättre än börsen som helhet.</Caption>
        </section>

        <section className="card span-4">
          <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Kvalitetskort <Info id="quality-score" /></h2><span className={`tag ${score >= 4 ? "good" : score >= 3 ? "mid" : "bad"}`}>{score}/5</span></div>
          <div className="card-body">
            <table className="data"><tbody>
              {checks.map((c) => (
                <tr key={c.label}><td style={{ width: 22 }} className={c.ok == null ? "dim" : c.ok ? "pos" : "neg"}>{c.ok == null ? "–" : c.ok ? "✓" : "✕"}</td>
                  <td><span className="row" style={{ gap: 6 }}>{c.label} <Info id={c.info} ctx={ctx} /></span></td><td className="num dim">{c.detail}</td></tr>
              ))}
            </tbody></table>
          </div>
        </section>

        <section className="card span-6">
          <div className="card-head"><h2 className="card-title"><span className="idx">03</span>{bank ? "Intäkter per år" : "Omsättning, EBITDA och marginal"} <Info id={bank ? "margins" : "ebitda"} /></h2></div>
          <div className="card-body">{hist.length ? <Plot ariaLabel="Historisk omsättning och EBITDA" data={histData} height={260} layout={{ barmode: "group", hovermode: "closest", xaxis: { type: "category" } as any, yaxis: { ticksuffix: " md", side: "left" } as any, yaxis2: { overlaying: "y", side: "right", tickformat: ".1%", showgrid: false } as any }} /> : <p className="muted">Historik saknas.</p>}</div>
          <Caption>Staplarna visar hur stort bolaget är och hur mycket det tjänar före avskrivningar, år för år. Den gröna linjen är marginalen – <b>stigande marginal betyder att bolaget tjänar mer på varje såld krona</b>.</Caption>
        </section>

        <section className="card span-6">
          <div className="card-head"><h2 className="card-title"><span className="idx">04</span>Vad tror analytikerna? <Info id="analyst-target" ctx={ctx} /></h2><span className="dim" style={{ fontSize: 12 }}>{f.analysts ? `${fmt(f.analysts, 0)} analytiker` : ""}</span></div>
          <div className="card-body">
            {tgt && price && tgtLo && tgtHi ? (() => {
              const min = Math.min(tgtLo, price) * 0.95, max = Math.max(tgtHi, price) * 1.05, x = (v: number) => `${((v - min) / (max - min)) * 100}%`;
              return (
                <div className="target-viz">
                  <div className="target-bar"><div className="target-range" style={{ left: x(tgtLo), width: `calc(${x(tgtHi)} - ${x(tgtLo)})` }} />
                    <div className="target-mark price" style={{ left: x(price) }}><span>Kurs {fmt(price, 0)}</span></div>
                    <div className="target-mark mean" style={{ left: x(tgt) }}><span>Snitt {fmt(tgt, 0)}</span></div>
                  </div>
                  <div className="row num" style={{ justifyContent: "space-between", fontSize: 12, color: "var(--text-3)" }}><span>lägsta {fmt(tgtLo, 0)}</span><span>högsta {fmt(tgtHi, 0)}</span></div>
                  <div className="row" style={{ gap: 24, marginTop: 14 }}>
                    <div><div className="dim" style={{ fontSize: 12 }}>Uppsida till snittet</div><div className={`num ${tgt >= price ? "pos" : "neg"}`} style={{ fontSize: 24 }}>{fmtPct(tgt / price - 1, 0, true)}</div></div>
                    {f.recommendation && <div><div className="dim" style={{ fontSize: 12 }}>Rekommendation (1 köp – 5 sälj)</div><div className="num" style={{ fontSize: 24 }}>{fmt(f.recommendation, 1)} <span className="dim" style={{ fontSize: 14 }}>{f.recommendation <= 2 ? "köp" : f.recommendation <= 3 ? "behåll" : "sälj"}</span></div></div>}
                  </div>
                </div>
              );
            })() : <p className="muted">Inga analytikerdata.</p>}
          </div>
          <Caption>Det kopparfärgade bandet är spannet mellan den lägsta och högsta riktkursen. Ju bredare band, desto oenigare är analytikerna. Riktkurser är förväntningar, inte facit.</Caption>
        </section>

        <section className="card span-12">
          <div className="card-head"><h2 className="card-title"><span className="idx">05</span>Senaste nyheterna</h2><Link className="btn" to="/nyheter">Alla nyheter →</Link></div>
          <div className="card-body">
            <ul className="news-list">
              {items.map((n) => (
                <li className="news-item" key={n.url}><div><a className="title" href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a><div className="news-meta"><span className="src">{n.source}</span><span>{timeAgo(n.t)}</span></div></div></li>
              ))}
              {items.length === 0 && <li className="muted">Inga nyheter de senaste veckorna.</li>}
            </ul>
            {f.summary && <details style={{ marginTop: 10 }}><summary className="dim" style={{ cursor: "pointer", fontSize: 13 }}>Om bolaget (beskrivning på engelska från Yahoo)</summary><p className="muted" style={{ fontSize: 13.5 }}>{f.summary}…</p></details>}
            <p className="dim" style={{ fontSize: 12, margin: "10px 0 0" }}>Nyckeltal från Yahoo Finance (rullande 12 månader), omräknade till SEK, hämtade {fetchedAt.slice(0, 10)}. Kontrollera mot bolagets rapporter innan du drar slutsatser.</p>
          </div>
        </section>
      </div>
    </>
  );
}
