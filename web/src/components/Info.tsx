import { useSettings } from "../lib/settings";
import { CONCEPTS } from "../explain/concepts";

/** ⓘ-knapp som öppnar förklaringspanelen för ett begrepp. ctx skickas till begreppets exempel. */
export function Info({ id, ctx }: { id: string; ctx?: Record<string, unknown> }) {
  const { openExplain, explain } = useSettings();
  const c = CONCEPTS[id];
  if (!c) { console.warn("okänt begrepp", id); return null; }
  return (
    <button
      type="button"
      className="info-btn"
      aria-label={`Förklara: ${c.title}`}
      aria-expanded={explain?.id === id}
      title={`Vad är ${c.title.toLowerCase()}?`}
      onClick={(e) => { e.stopPropagation(); openExplain(id, ctx); }}
    >i</button>
  );
}
