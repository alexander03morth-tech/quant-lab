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
import { PairRedirect, PairView } from "./views/PairView";
import { Placeholder } from "./views/Placeholder";

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
              <Route path="/par" element={<PairRedirect />} />
              <Route path="/par/:a/:b" element={<PairView />} />
              <Route path="/ordlista" element={<Glossary />} />
              <Route path="/marknad" element={<Placeholder title="Marknadsöversikt" />} />
              <Route path="/korrelation" element={<Placeholder title="Korrelationsmatris" />} />
              <Route path="/scanner" element={<Placeholder title="Parscanner" />} />
              <Route path="/backtest" element={<Placeholder title="Backtest" />} />
              <Route path="/pca" element={<Placeholder title="PCA / faktorbaserad stat arb" />} />
              <Route path="/kurs" element={<Placeholder title="Lär dig quant" />} />
              <Route path="*" element={<Navigate to="/par" replace />} />
            </Routes>
          </Shell>
        </HashRouter>
      </DataProvider>
    </SettingsProvider>
  );
}
