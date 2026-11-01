import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { CareerView } from "../CareerView";
import { CompanyView } from "./CompanyView";
import { CompsView } from "./CompsView";
import { DcfView } from "./DcfView";

/** Aktieanalys-spåret: tre flikar med var sitt jobb. */
export function AktieView() {
  return (
    <div className="page">
      <nav className="subnav" aria-label="Aktieanalys">
        <NavLink to="/aktie/bolag">Bolagsanalys</NavLink>
        <NavLink to="/aktie/dcf">DCF-värdering</NavLink>
        <NavLink to="/aktie/jamfor">Jämförelse</NavLink>
        <NavLink to="/aktie/jobbet">Så funkar jobbet</NavLink>
      </nav>
      <Routes>
        <Route path="bolag" element={<CompanyView />} />
        <Route path="bolag/:ticker" element={<CompanyView />} />
        <Route path="dcf" element={<DcfView />} />
        <Route path="dcf/:ticker" element={<DcfView />} />
        <Route path="jamfor" element={<CompsView />} />
        <Route path="jobbet" element={<CareerView track="aktie" />} />
        <Route path="*" element={<Navigate to="bolag" replace />} />
      </Routes>
    </div>
  );
}
