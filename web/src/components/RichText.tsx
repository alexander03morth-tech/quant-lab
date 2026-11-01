import { Fragment } from "react";
import { CONCEPTS } from "../explain/concepts";
import { useSettings } from "../lib/settings";
import { Tex } from "./Tex";

/** Minimal markup: **fet**, $inline-tex$ och [[begrepp|text]] (öppnar förklaringspanelen). */
export function RichText({ text }: { text: string }) {
  const { openExplain } = useSettings();
  const parts = text.split(/(\$[^$]+\$|\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("$") && p.endsWith("$") && p.length > 2) return <Tex key={i}>{p.slice(1, -1)}</Tex>;
        if (p.startsWith("**") && p.endsWith("**")) return <b key={i}>{p.slice(2, -2)}</b>;
        if (p.startsWith("[[") && p.endsWith("]]")) {
          const [id, label] = p.slice(2, -2).split("|");
          if (!CONCEPTS[id]) return <Fragment key={i}>{label ?? id}</Fragment>;
          return <button key={i} type="button" className="term" onClick={() => openExplain(id)} title={`Förklara: ${CONCEPTS[id].title}`}>{label ?? CONCEPTS[id].title}</button>;
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
