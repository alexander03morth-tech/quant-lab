import { useState } from "react";
import { Info } from "../../components/Info";
import { Seg } from "../../components/Slider";
import { useData } from "../../lib/data";
import { fmt } from "../../lib/format";
import type { Rebalance } from "../../lib/portfolio/engine";
import { encodePortfolio, PRESETS, usePortfolios, type Portfolio } from "../../lib/portfolio/store";

export function Builder({ p, onOptimize }: { p: Portfolio; onOptimize: (kind: "minvar" | "maxsharpe") => void }) {
  const { meta, name } = useData();
  const { list, setActive, save, create, remove } = usePortfolios();
  const [copied, setCopied] = useState(false);
  const [allowShort, setAllowShort] = useState(p.holdings.some((h) => h.weight < 0));
  const total = p.holdings.reduce((s, h) => s + h.weight, 0);
  const held = new Set(p.holdings.map((h) => h.ticker));
  const sectors = Object.entries(meta.sectors);

  const update = (holdings: Portfolio["holdings"]) => save({ ...p, holdings });
  const setW = (t: string, w: number) => update(p.holdings.map((h) => (h.ticker === t ? { ...h, weight: w } : h)));
  const add = (t: string) => {
    if (!t || held.has(t)) return;
    const n = p.holdings.length + 1;
    // ny aktie får lika vikt; övriga skalas ned proportionellt
    update([...p.holdings.map((h) => ({ ...h, weight: (h.weight * (n - 1)) / n })), { ticker: t, weight: 1 / n }]);
  };
  const equal = () => update(p.holdings.map((h) => ({ ...h, weight: 1 / p.holdings.length })));
  const normalize = () => total !== 0 && update(p.holdings.map((h) => ({ ...h, weight: h.weight / total })));
  const share = async () => {
    const url = `${location.origin}${location.pathname}#/portfolj?p=${encodePortfolio(p)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { prompt("Kopiera länken:", url); }
  };

  return (
    <section className="card span-12 builder">
      <div className="card-head">
        <h2 className="card-title"><span className="idx">01</span>Bygg portfölj <Info id="portfolio-weights" /></h2>
        <div className="card-tools">
          <select className="select" value={p.id} onChange={(e) => setActive(e.target.value)} aria-label="Välj portfölj">
            {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button className="btn" onClick={() => create({ name: "Ny portfölj", rebalance: "monthly", value: 100000, holdings: [] })}>+ Ny</button>
          <button className="btn" onClick={() => create({ ...p, name: `${p.name} (kopia)` })}>Kopiera</button>
          <button className="btn" onClick={share}>{copied ? "Länk kopierad ✓" : "Dela länk"}</button>
          <button className="btn" onClick={() => { if (confirmDelete(p.name)) remove(p.id); }} title="Ta bort portföljen">Ta bort</button>
        </div>
      </div>
      <div className="card-body">
        <div className="builder-grid">
          <div>
            <div className="row" style={{ marginBottom: 10 }}>
              <input className="select name-input" value={p.name} onChange={(e) => save({ ...p, name: e.target.value })} aria-label="Portföljens namn" />
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                Värde
                <input className="select num" style={{ width: 120, backgroundImage: "none", padding: "6px 10px" }} type="number" min={1000} step={10000} value={p.value}
                  onChange={(e) => save({ ...p, value: Math.max(1000, Number(e.target.value) || 100000) })} aria-label="Portföljens värde i kronor" />
                kr
              </label>
            </div>
            <table className="data holdings">
              <thead><tr><th>Aktie</th><th>Vikt</th><th className="num">%</th><th /></tr></thead>
              <tbody>
                {p.holdings.map((h) => (
                  <tr key={h.ticker}>
                    <td><span className="row" style={{ gap: 8 }}><span className="sector-dot" data-s={meta.stocks.find((s) => s.ticker === h.ticker)?.sector} />{name(h.ticker)}</span></td>
                    <td style={{ width: "45%" }}>
                      <input type="range" min={allowShort ? -0.5 : 0} max={1} step={0.005} value={h.weight} aria-label={`Vikt ${name(h.ticker)}`}
                        style={{ ["--fill" as string]: `${((h.weight - (allowShort ? -0.5 : 0)) / (allowShort ? 1.5 : 1)) * 100}%` }}
                        onChange={(e) => setW(h.ticker, Number(e.target.value))} />
                    </td>
                    <td className="num">
                      <input className="w-input num" type="number" step={0.5} value={Math.round(h.weight * 1000) / 10}
                        onChange={(e) => setW(h.ticker, (Number(e.target.value) || 0) / 100)} aria-label={`Vikt i procent för ${name(h.ticker)}`} />
                    </td>
                    <td style={{ width: 28 }}><button className="close-btn" style={{ width: 26, height: 26 }} onClick={() => update(p.holdings.filter((x) => x.ticker !== h.ticker))} aria-label={`Ta bort ${name(h.ticker)}`}>✕</button></td>
                  </tr>
                ))}
                {p.holdings.length === 0 && <tr><td colSpan={4} className="muted">Lägg till aktier nedan eller välj en färdig mall.</td></tr>}
              </tbody>
              <tfoot><tr><td className="dim">Summa</td><td /><td className={`num ${Math.abs(total - 1) > 0.005 ? "warn" : ""}`}>{fmt(total * 100, 1)} %</td><td /></tr></tfoot>
            </table>
            {Math.abs(total - 1) > 0.005 && p.holdings.length > 0 && (
              <div className="notice" style={{ marginTop: 8 }}><span className="icon">!</span><span>Vikterna summerar till {fmt(total * 100, 1)} %. Analysen räknar som om resten ligger i kontanter (eller är lånat om över 100 %). <button className="btn" onClick={normalize}>Skala till 100 %</button></span></div>
            )}
          </div>
          <div className="stack" style={{ gap: 12 }}>
            <label className="field">Lägg till aktie
              <select className="select" value="" onChange={(e) => add(e.target.value)} aria-label="Lägg till aktie">
                <option value="">Välj aktie…</option>
                {sectors.map(([k, label]) => (
                  <optgroup key={k} label={label}>
                    {meta.stocks.filter((s) => s.sector === k && !held.has(s.ticker)).sort((a, b) => a.name.localeCompare(b.name, "sv")).map((s) => <option key={s.ticker} value={s.ticker}>{s.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div>
              <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>Snabbval</div>
              <div className="quick-pairs">
                <button className="chip" onClick={equal} disabled={!p.holdings.length}>Lika vikt</button>
                <button className="chip" onClick={() => onOptimize("minvar")} disabled={p.holdings.length < 2}>Minsta risk</button>
                <button className="chip" onClick={() => onOptimize("maxsharpe")} disabled={p.holdings.length < 2}>Max Sharpe ⚠</button>
                <button className="chip" onClick={() => update(meta.stocks.map((s) => ({ ticker: s.ticker, weight: 1 / meta.stocks.length })))}>Hela OMXS30</button>
              </div>
            </div>
            <div>
              <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>Färdiga mallar</div>
              <div className="quick-pairs">
                {PRESETS.map((pr) => <button key={pr.name} className="chip" onClick={() => save({ ...p, holdings: pr.holdings, name: p.holdings.length ? p.name : pr.name })}>{pr.name}</button>)}
              </div>
            </div>
            <div className="row">
              <span className="dim" style={{ fontSize: 12.5, display: "inline-flex", gap: 6, alignItems: "center" }}>Ombalansering <Info id="rebalancing" /></span>
              <Seg label="Ombalansering" value={p.rebalance} onChange={(v: Rebalance) => save({ ...p, rebalance: v })} options={[{ value: "monthly", label: "Månad" }, { value: "quarterly", label: "Kvartal" }, { value: "none", label: "Aldrig" }]} />
            </div>
            <label className="row" style={{ fontSize: 13, gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={allowShort} onChange={(e) => setAllowShort(e.target.checked)} />
              Tillåt blankning (negativa vikter) <Info id="short-costs" />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

function confirmDelete(n: string) {
  // window.confirm är ok här: en tydlig, sällsynt destruktiv handling
  return window.confirm(`Ta bort portföljen "${n}"?`);
}
