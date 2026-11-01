import katex from "katex";
import { useMemo } from "react";
import "katex/dist/katex.min.css";

export function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(children, { displayMode: block, throwOnError: false, strict: false }),
    [children, block],
  );
  return <span className={block ? "tex-block" : "tex"} dangerouslySetInnerHTML={{ __html: html }} />;
}
