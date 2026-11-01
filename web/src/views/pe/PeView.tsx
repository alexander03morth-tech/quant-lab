/**
 * Private equity-spåret: tre fokuserade flikar så att det aldrig blir för mycket på en gång.
 *   Översikt  – vad PE är (4-stegsflöde) + PE-nyheter
 *   LBO-modell – räkna på ett köp av ett exempelbolag eller eget bolag
 *   Fondekonomi – J-kurva, avgifter, carry och brutto mot netto
 */
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { LboView } from "./LboView";
import { PeOverview } from "./PeOverview";
import { FundView } from "./FundView";

export function PeView() {
  return (
    <div className="page">
      <nav className="subnav" aria-label="Private equity">
        <NavLink to="/pe/oversikt">Översikt & nyheter</NavLink>
        <NavLink to="/pe/lbo">LBO-modell</NavLink>
        <NavLink to="/pe/fond">Fondekonomi</NavLink>
      </nav>
      <Routes>
        <Route path="oversikt" element={<PeOverview />} />
        <Route path="lbo" element={<LboView />} />
        <Route path="fond" element={<FundView />} />
        <Route path="*" element={<Navigate to="oversikt" replace />} />
      </Routes>
    </div>
  );
}
