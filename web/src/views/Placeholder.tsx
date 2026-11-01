import { Link } from "react-router-dom";

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>
      <p className="page-sub">Den här vyn byggs i steg 3. Börja med <Link to="/par">Paranalys</Link>, kärnan i verktyget.</p>
    </div>
  );
}
