/**
 * Private equity-spåret: tre fokuserade flikar så att det aldrig blir för mycket på en gång.
 *   Översikt  – vad PE är (4-stegsflöde) + PE-nyheter
 *   LBO-modell – räkna på ett köp av ett riktigt OMXS30-bolag
 *   Screen    – vilka börsbolag skulle en PE-köpare kunna räkna hem?
 */
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { LboView } from "./LboView";
import { PeOverview } from "./PeOverview";
import { PeScreen } from "./PeScreen";

export function PeView() {
  return (
    <div className="page">
      <nav className="subnav" aria-label="Private equity">
        <NavLink to="/pe/oversikt">Översikt & nyheter</NavLink>
        <NavLink to="/pe/lbo">LBO-modell</NavLink>
        <NavLink to="/pe/screen">Take-private-screen</NavLink>
      </nav>
      <Routes>
        <Route path="oversikt" element={<PeOverview />} />
        <Route path="lbo" element={<LboView />} />
        <Route path="lbo/:ticker" element={<LboView />} />
        <Route path="screen" element={<PeScreen />} />
        <Route path="*" element={<Navigate to="oversikt" replace />} />
      </Routes>
    </div>
  );
}
