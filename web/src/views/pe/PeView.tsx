/**
 * Private equity-spåret: tre fokuserade flikar så att det aldrig blir för mycket på en gång.
 *   Översikt  – vad PE är (4-stegsflöde) + PE-nyheter
 *   LBO-modell – räkna på ett köp av ett exempelbolag eller eget bolag
 *   Fondekonomi – J-kurva, avgifter, carry och brutto mot netto
 */
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { CareerView } from "../CareerView";
import { LboView } from "./LboView";
import { PeOverview } from "./PeOverview";
import { FundView } from "./FundView";
import { MethodView, ModelTabs, Practice } from "../../components/Learn";
import { FUND_EX, FUND_METHOD, LBO_EX, LBO_METHOD } from "../../content/models";

export function PeView() {
  return (
    <div className="page">
      <nav className="subnav" aria-label="Private equity">
        <NavLink to="/pe/oversikt">Översikt & nyheter</NavLink>
        <NavLink to="/pe/lbo">LBO-modell</NavLink>
        <NavLink to="/pe/fond">Fondekonomi</NavLink>
        <NavLink to="/pe/jobbet">Så funkar jobbet</NavLink>
      </nav>
      <Routes>
        <Route path="oversikt" element={<PeOverview />} />
        <Route path="lbo" element={<ModelTabs name="LBO-modell" tool={<LboView />} method={<MethodView m={LBO_METHOD} question="Vad är en LBO?" />} practice={<Practice exercises={LBO_EX} />} />} />
        <Route path="fond" element={<ModelTabs name="Fondekonomi" tool={<FundView />} method={<MethodView m={FUND_METHOD} question="Hur fungerar en PE-fond ekonomiskt?" />} practice={<Practice exercises={FUND_EX} />} />} />
        <Route path="jobbet" element={<CareerView track="pe" />} />
        <Route path="*" element={<Navigate to="oversikt" replace />} />
      </Routes>
    </div>
  );
}
