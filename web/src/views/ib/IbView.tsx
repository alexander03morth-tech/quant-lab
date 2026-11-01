import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { CareerView } from "../CareerView";
import { FootballField } from "./FootballField";
import { MergerView } from "./MergerView";
import { ProcessView } from "./ProcessView";

/** Investment banking-spåret: värdering, M&A-kalkyl och hur affärer går till. */
export function IbView() {
  return (
    <div className="page">
      <nav className="subnav" aria-label="Investment banking">
        <NavLink to="/ib/vardering">Värderingsöversikt</NavLink>
        <NavLink to="/ib/ma">M&A-kalkyl</NavLink>
        <NavLink to="/ib/process">Affärsprocessen</NavLink>
        <NavLink to="/ib/jobbet">Så funkar jobbet</NavLink>
      </nav>
      <Routes>
        <Route path="vardering" element={<FootballField />} />
        <Route path="vardering/:ticker" element={<FootballField />} />
        <Route path="ma" element={<MergerView />} />
        <Route path="process" element={<ProcessView />} />
        <Route path="jobbet" element={<CareerView track="ib" />} />
        <Route path="*" element={<Navigate to="vardering" replace />} />
      </Routes>
    </div>
  );
}
