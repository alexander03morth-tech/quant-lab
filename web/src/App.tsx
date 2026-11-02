import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { DataProvider } from "./lib/data";
import { SettingsProvider } from "./lib/settings";
import { Glossary } from "./views/Glossary";
import { NewsView } from "./views/NewsView";
import { PortfolioView } from "./views/PortfolioView";
import { PeView } from "./views/pe/PeView";
import { AktieView } from "./views/aktie/AktieView";
import { IbView } from "./views/ib/IbView";
import { CareerView } from "./views/CareerView";
import { PairRedirect, PairView } from "./views/PairView";
import { AcademyView } from "./views/AcademyView";
import { CorrelationView } from "./views/quant/CorrelationView";
import { ScannerView } from "./views/quant/ScannerView";
import { BacktestView } from "./views/quant/BacktestView";
import { MarketView } from "./views/quant/MarketView";
import { PcaView } from "./views/quant/PcaView";

export default function App() {
  return (
    <SettingsProvider>
      <DataProvider>
        <HashRouter>
          <Shell>
            <Routes>
              <Route path="/" element={<Navigate to="/nyheter" replace />} />
              <Route path="/nyheter" element={<NewsView />} />
              <Route path="/portfolj" element={<PortfolioView />} />
              <Route path="/pe/*" element={<PeView />} />
              <Route path="/aktie/*" element={<AktieView />} />
              <Route path="/ib/*" element={<IbView />} />
              <Route path="/kvant/jobbet" element={<div className="page"><CareerView track="kvant" /></div>} />
              <Route path="/par" element={<PairRedirect />} />
              <Route path="/par/:a/:b" element={<PairView />} />
              <Route path="/ordlista" element={<Glossary />} />
              <Route path="/marknad" element={<MarketView />} />
              <Route path="/korrelation" element={<CorrelationView />} />
              <Route path="/scanner" element={<ScannerView />} />
              <Route path="/backtest" element={<BacktestView />} />
              <Route path="/pca" element={<PcaView />} />
              <Route path="/kurs" element={<AcademyView />} />
              <Route path="*" element={<Navigate to="/par" replace />} />
            </Routes>
          </Shell>
        </HashRouter>
      </DataProvider>
    </SettingsProvider>
  );
}
