import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useData } from "../lib/data";
import { fmtDate, fmtDateTime } from "../lib/format";
import { useSettings } from "../lib/settings";
import { ExplainPanel } from "./ExplainPanel";
import { Seg } from "./Slider";
import { TickerTape } from "./TickerTape";

const NAV: { group: string; items: { to: string; label: string; ready: boolean }[] }[] = [
  { group: "Utforska", items: [
    { to: "/nyheter", label: "Börsen idag", ready: true },
    { to: "/marknad", label: "Marknadsöversikt", ready: false },
    { to: "/korrelation", label: "Korrelationsmatris", ready: false },
    { to: "/scanner", label: "Parscanner", ready: false },
  ] },
  { group: "Analys", items: [
    { to: "/portfolj", label: "Portföljlabb", ready: true },
    { to: "/par", label: "Paranalys", ready: true },
    { to: "/backtest", label: "Backtest", ready: false },
    { to: "/pca", label: "PCA / faktorer", ready: false },
  ] },
  { group: "Private equity", items: [
    { to: "/pe/oversikt", label: "PE-översikt", ready: true },
    { to: "/pe/lbo", label: "LBO-modell", ready: true },
    { to: "/pe/fond", label: "Fondekonomi", ready: true },
  ] },
  { group: "Lär dig", items: [
    { to: "/kurs", label: "Lär dig quant", ready: false },
    { to: "/ordlista", label: "Ordlista", ready: true },
  ] },
];

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="0.5" y="0.5" width="25" height="25" rx="7" fill="var(--primary-soft)" stroke="var(--primary)" />
      <path d="M5 16c2.5 0 3-6 5.5-6s3 7 5.5 7 2.5-5 5-5" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5 11c2.5 0 3 5 5.5 5s3-6 5.5-6 2.5 4 5 4" fill="none" stroke="var(--text-3)" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 2" />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { meta } = useData();
  const { theme, setTheme, mode, setMode } = useSettings();
  const [navOpen, setNavOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setNavOpen(false), [loc.pathname]);
  const ageDays = (Date.now() - new Date(meta.lastTradingDay).getTime()) / 864e5;
  const stale = ageDays > 4;

  return (
    <div className={`shell ${navOpen ? "nav-open" : ""}`}>
      {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
      <nav className="sidebar" aria-label="Huvudmeny">
        <NavLink to="/" className="brand"><Mark /><span className="brand-name">Quant <span>Lab</span></span></NavLink>
        {NAV.map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-label">{g.group}</div>
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                {it.label}{!it.ready && <span className="soon">snart</span>}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <div className="toggles">
            <Seg label="Förklaringsnivå" value={mode} onChange={setMode} options={[{ value: "beginner", label: "Nybörjare" }, { value: "expert", label: "Expert" }]} />
            <Seg label="Tema" value={theme} onChange={setTheme} options={[{ value: "dark", label: "Mörk" }, { value: "light", label: "Ljus" }]} />
          </div>
          <div className="data-status" title={`Senast uppdaterad ${meta.updatedAt}`}>
            <span className={`dot ${stale ? "stale" : ""}`} />Data t.o.m. <b>{fmtDate(meta.lastTradingDay)}</b>
            <div className="dim" style={{ marginTop: 2 }}>Uppdaterad {fmtDateTime(meta.updatedAt)}</div>
          </div>
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          <button className="btn" onClick={() => setNavOpen(true)} aria-label="Öppna meny">☰</button>
          <span className="brand-name">Quant <span>Lab</span></span>
          <span className="spacer" />
          <span className="dim mono" style={{ fontSize: 12 }}>{fmtDate(meta.lastTradingDay)}</span>
        </header>
        <TickerTape />
        {children}
        <footer className="footer">
          <span>Utbildningsverktyg – inte investeringsrådgivning.</span>
          <span>Data: Yahoo Finance, justerade stängningskurser. Dagens OMXS30-lista används bakåt i tiden (survivorship bias).</span>
        </footer>
      </div>
      <ExplainPanel />
    </div>
  );
}
