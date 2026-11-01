import { Fragment } from "react";
import { Tex } from "./Tex";

/** Minimal markup: **fet** och $inline-tex$. Används i förklaringstexter. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("$") && p.endsWith("$") && p.length > 2) return <Tex key={i}>{p.slice(1, -1)}</Tex>;
        if (p.startsWith("**") && p.endsWith("**")) return <b key={i}>{p.slice(2, -2)}</b>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
