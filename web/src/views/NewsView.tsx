import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Data } from "plotly.js-dist-min";
import { Info } from "../components/Info";
import { cssVar, Plot } from "../components/Plot";
import { RichText } from "../components/RichText";
import { Seg } from "../components/Slider";
import { useData } from "../lib/data";
import { timeAgo, tradingDayFor, useNews, useSummary, type NewsItem } from "../lib/extra";
import { fmt, fmtDate, fmtPct } from "../lib/format";
import { useSettings } from "../lib/settings";
import { usePortfolios } from "../lib/portfolio/store";

type Feed = "alla" | "bolag" | "borsen" | "makro" | "portfolj";

export function NewsView() {
  const { prices, meta, name } = useData();
  const news = useNews();
  const summary = useSummary();
  const { mode } = useSettings();
  const { active } = usePortfolios();
  const [feed, setFeed] = useState<Feed>("alla");
  const [stock, setStock] = useState<string | null>(null);
  const [limit, setLimit] = useState(25);

  /** Kursreaktion: aktiens avkastning den handelsdag nyheten kan ha påverkat. */
  const reaction = (ticker: string | null, iso: string) => {
    if (!ticker || !prices.series[ticker]) return null;
    const i = tradingDayFor(iso, prices.dates);
    if (i <= 0) return null;
    const c = prices.series[ticker].close, ci = prices.series[meta.benchmark.ticker].close;
    if (c[i] == null || c[i - 1] == null) return null;
    const r = (c[i] as number) / (c[i - 1] as number) - 1;
    const ri = (ci[i] as number) / (ci[i - 1] as number) - 1;
    return { r, rel: r - ri, date: prices.dates[i] };
  };

  const items = useMemo(() => {
    if (!news) return [] as (NewsItem & { ticker: string | null; tag: string })[];
    const out: (NewsItem & { ticker: string | null; tag: string })[] = [];
    const holdings = new Set(active?.holdings.map((h) => h.ticker) ?? []);
    if (feed === "alla" || feed === "bolag" || feed === "portfolj") {
      for (const [t, list] of Object.entries(news.items)) {
        if (stock && t !== stock) continue;
        if (feed === "portfolj" && !holdings.has(t)) continue;
        list.forEach((n) => out.push({ ...n, ticker: t, tag: t.replace(".ST", "") }));
      }
    }
    if (!stock && (feed === "alla" || feed === "borsen")) news.market.borsen?.forEach((n) => out.push({ ...n, ticker: null, tag: "Börsen" }));
    if (!stock && (feed === "alla" || feed === "makro")) news.market.makro?.forEach((n) => out.push({ ...n, ticker: null, tag: "Makro" }));
    const seen = new Set<string>();
    return out
      .sort((a, b) => b.t.localeCompare(a.t))
      .filter((n) => { const k = n.title.toLowerCase().slice(0, 70); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 80);
  }, [news, feed, stock, active]);

  if (summary === undefined || news === undefined) return <div className="page plot-loading" style={{ minHeight: "50vh" }}>Laddar nyheter…</div>;
  if (!summary) return <div className="page"><div className="notice"><span className="icon">!</span>Ingen börssammanfattning finns ännu – kör pipeline/update.sh.</div></div>;

  const ix = summary.index;
  const up = summary.breadth.up, down = summary.breadth.down, tot = summary.breadth.total;
  const pos = cssVar("--pos"), neg = cssVar("--neg"), mid = cssVar("--surface-2");

  // Treemap: sektor → aktie, färg = dagens avkastning
  const m = summary.movers;
  const maxAbs = Math.max(0.02, ...m.map((x) => Math.abs(x.ret)));
  const sectors = [...new Set(m.map((x) => x.sector))];
  const treemap: Data[] = [{
    type: "treemap",
    labels: [...sectors, ...m.map((x) => x.ticker.replace(".ST", ""))],
    parents: [...sectors.map(() => ""), ...m.map((x) => x.sector)],
    ids: [...sectors, ...m.map((x) => x.ticker)],
    values: [...sectors.map(() => 0), ...m.map(() => 1)],
    marker: {
      colors: [...sectors.map((s) => { const r = m.filter((x) => x.sector === s); return r.reduce((a, b) => a + b.ret, 0) / r.length; }), ...m.map((x) => x.ret)],
      colorscale: [[0, neg], [0.5, mid], [1, pos]], cmin: -maxAbs, cmax: maxAbs, line: { width: 2, color: cssVar("--bg") },
    },
    text: [...sectors.map(() => ""), ...m.map((x) => fmtPct(x.ret, 1, true))],
    texttemplate: "<b>%{label}</b><br>%{text}",
    textfont: { family: cssVar("--mono"), size: 13, color: "#fff" },
    customdata: [...sectors.map((s) => `Sektor: ${s}`), ...m.map((x) => {
      const parts = [`${x.name}: ${fmtPct(x.ret, 2, true)}`, `Bolagsspecifikt: ${fmtPct(x.abn, 2, true)} (beta ${fmt(x.beta, 2)})`];
      if (x.volRatio) parts.push(`Volym ${fmt(x.volRatio, 1)}× normalt${x.volRatio >= 2 ? " – många handlade" : ""}`);
      if (Math.abs(x.sigma) >= 2) parts.push(`Ovanligt stor rörelse: ${fmt(Math.abs(x.sigma), 1)} σ`);
      if (x.news) parts.push(`<i>${x.news.title.slice(0, 70)}${x.news.title.length > 70 ? "…" : ""}</i>`);
      return parts.join("<br>");
    })] as any,
    hovertemplate: "%{customdata}<extra></extra>",
    pathbar: { visible: false }, branchvalues: "remainder", tiling: { pad: 2 },
  } as any];

  const sectorBars: Data[] = [{
    type: "bar", orientation: "h",
    y: summary.sectors.map((s) => s.name).reverse(), x: summary.sectors.map((s) => s.ret).reverse(),
    marker: { color: summary.sectors.map((s) => (s.ret >= 0 ? pos : neg)).reverse() },
    text: summary.sectors.map((s) => fmtPct(s.ret, 1, true)).reverse(), textposition: "outside", cliponaxis: false,
    textfont: { family: cssVar("--mono"), size: 11 },
    hovertemplate: "%{y}: %{x:+.2%}<extra></extra>",
  } as any];

  return (
    <div className="page">
      <div className="hero news-hero" style={{ marginBottom: 14 }}>
        <div>
          <div className="hero-kicker"><span>Börsen idag</span><span className="live">{fmtDate(summary.date)}</span></div>
          <h1 className="hero-title" style={{ fontSize: "clamp(26px, 3.4vw, 42px)" }}>{summary.headline}</h1>
          <p className="hero-sub">En kort sammanfattning skriven automatiskt från dagens kurser och nyheter – med förklaringar för dig som är ny. Klicka på <span className="term" style={{ cursor: "default" }}>understrukna ord</span> för att lära dig vad de betyder.</p>
        </div>
        <div className="hero-right">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div className="dim" style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}>OMXS30 <Info id="index" /></div>
              <div className={`big-num ${ix.r1d >= 0 ? "pos" : "neg"}`}>{fmtPct(ix.r1d, 2, true)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="num" style={{ fontSize: 20 }}>{fmt(ix.level, 1)}</div>
              <div className="dim" style={{ fontSize: 12 }}>{fmt(Math.abs(ix.sigma), 1)} σ <Info id="sigma-move" /></div>
            </div>
          </div>
          <div>
            <div className="breadth" aria-label={`${up} upp, ${down} ner`}><div className="u" style={{ width: `${(up / tot) * 100}%` }} /><div className="d" style={{ width: `${(down / tot) * 100}%` }} /></div>
            <div className="row num" style={{ justifyContent: "space-between", fontSize: 12, marginTop: 4 }}><span className="pos">▲ {up} upp</span><span className="neg">{down} ner ▼</span></div>
          </div>
          <div className="row num" style={{ gap: 18, fontSize: 12.5 }}>
            <span><span className="dim">Vecka </span><span className={ix.r5d >= 0 ? "pos" : "neg"}>{fmtPct(ix.r5d, 1, true)}</span></span>
            <span><span className="dim">Månad </span><span className={ix.r1m >= 0 ? "pos" : "neg"}>{fmtPct(ix.r1m, 1, true)}</span></span>
            <span><span className="dim">I år </span><span className={ix.rYtd >= 0 ? "pos" : "neg"}>{fmtPct(ix.rYtd, 1, true)}</span></span>
          </div>
        </div>
      </div>

      <div className="grid">
        <section className="card span-7">
          <div className="card-head"><h2 className="card-title"><span className="idx">01</span>Vad hände på börsen?</h2><span className="dim" style={{ fontSize: 12 }}>skriven {summary.generatedAt.slice(11, 16)}</span></div>
          <div>
            {summary.sections.map((s) => (
              <div className="summary-sec" key={s.id}>
                <h3>{s.title}</h3>
                <p><RichText text={s.text} /></p>
                {s.pairs && (
                  <div className="quick-pairs" style={{ marginTop: 8 }}>
                    {s.pairs.map((p) => <Link key={p.y + p.x} className="chip" to={`/par/${p.y}/${p.x}`}>{name(p.y)} / {name(p.x)} · z {fmt(p.z, 1)}</Link>)}
                  </div>
                )}
                {mode === "beginner"
                  ? <div className="eli5"><b className="k">Förklarat enkelt</b>{s.explain}</div>
                  : <details className="eli5"><summary>Förklarat enkelt</summary>{s.explain}</details>}
              </div>
            ))}
          </div>
        </section>

        <div className="span-5 stack">
          <section className="card">
            <div className="card-head"><h2 className="card-title"><span className="idx">02</span>Värmekarta OMXS30</h2><span className="dim" style={{ fontSize: 12 }}>klicka för nyheter</span></div>
            <div className="card-body">
              <Plot ariaLabel="Värmekarta över dagens kursrörelser per sektor" data={treemap} height={380}
                onClick={(pt) => { const id = pt?.id as string; if (id && prices.series[id]) { setStock(id); setFeed("bolag"); document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" }); } }} layout={{ margin: { l: 0, r: 0, t: 0, b: 0 }, hovermode: "closest" }}
                config={{ displayModeBar: false }} />
            </div>
            {mode === "beginner" && <p className="caption">Varje ruta är en aktie, grupperad efter bransch. Grön = steg, röd = föll, starkare färg = större rörelse. Hovra för att se hur mycket som berodde på bolaget självt.</p>}
          </section>
          <section className="card">
            <div className="card-head"><h2 className="card-title"><span className="idx">03</span>Sektorer idag</h2><Info id="dispersion" /></div>
            <div className="card-body"><Plot ariaLabel="Genomsnittlig avkastning per sektor" data={sectorBars} height={240} layout={{ hovermode: "closest", xaxis: { tickformat: ".1%", zeroline: true } as any, yaxis: { side: "left", automargin: true } as any, margin: { l: 8, r: 40, t: 4, b: 8 } }} /></div>
          </section>
        </div>

        <section className="card span-12" id="feed">
          <div className="card-head">
            <h2 className="card-title"><span className="idx">04</span>Nyhetsflöde</h2>
            <div className="card-tools">
              <Seg label="Flöde" value={feed} onChange={(v) => { setFeed(v); setStock(null); }} options={[
                { value: "alla", label: "Allt" }, { value: "bolag", label: "Bolag" }, { value: "borsen", label: "Börsen" }, { value: "makro", label: "Makro" },
                ...(active ? [{ value: "portfolj" as Feed, label: `Min portfölj` }] : []),
              ]} />
              <select className="select" value={stock ?? ""} onChange={(e) => { setStock(e.target.value || null); if (e.target.value) setFeed("bolag"); }} aria-label="Filtrera på bolag">
                <option value="">Alla bolag</option>
                {[...meta.stocks].sort((a, b) => a.name.localeCompare(b.name, "sv")).map((s) => <option key={s.ticker} value={s.ticker}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="card-body">
            {mode === "beginner" && <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>Till höger om varje bolagsnyhet står hur aktien rörde sig den handelsdag nyheten kom (publicerat efter 17:30 räknas till nästa dag), och i grått hur mycket bättre eller sämre än index. Att en nyhet och en rörelse sammanfaller betyder inte att nyheten orsakade den.</p>}
            <ul className="news-list">
              {items.slice(0, limit).map((n) => {
                const re = reaction(n.ticker, n.t);
                return (
                  <li className="news-item" key={n.url}>
                    <div>
                      <a className="title" href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
                      <div className="news-meta">
                        <span className="src">{n.source}</span><span>{timeAgo(n.t)}</span>
                        {n.ticker
                          ? <button className="chip" style={{ padding: "0 8px", fontSize: 11.5 }} onClick={() => { setStock(n.ticker); setFeed("bolag"); }}>{name(n.ticker)}</button>
                          : <span className="chip" style={{ padding: "0 8px", fontSize: 11.5, cursor: "default" }}>{n.tag}</span>}
                      </div>
                    </div>
                    {re && (
                      <div className="reaction">
                        <span className={re.r >= 0 ? "pos" : "neg"}>{fmtPct(re.r, 1, true)}</span>
                        <small>{fmtPct(re.rel, 1, true)} mot index</small>
                      </div>
                    )}
                  </li>
                );
              })}
              {items.length === 0 && <li className="muted">Inga nyheter i det här flödet just nu.</li>}
            </ul>
            {items.length > limit && <button className="btn" style={{ marginTop: 10 }} onClick={() => setLimit(limit + 25)}>Visa fler ({items.length - limit} kvar)</button>}
            <p className="dim" style={{ fontSize: 12, margin: "12px 0 0" }}>Rubriker via {news?.source ?? "Google News"}, hämtade {news ? timeAgo(news.fetchedAt) : "–"}. Länkarna går till respektive källa – vissa kan kräva prenumeration. Quant Lab sparar bara rubriker, inte artiklar.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
