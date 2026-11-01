import { useEffect, useRef, useState } from "react";
import type { Config, Data, Layout, PlotlyHTMLElement } from "plotly.js-dist-min";
import { useSettings } from "../lib/settings";

type PlotlyLib = typeof import("plotly.js-dist-min");
let plotlyPromise: Promise<PlotlyLib> | null = null;
const loadPlotly = () => (plotlyPromise ??= import("plotly.js-dist-min").then((m) => (m as any).default ?? m));

export const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Gemensam layout i Inveztly-/quant-stil. Läser färger från CSS-variablerna så att temat följer med. */
export function baseLayout(): Partial<Layout> {
  const grid = cssVar("--grid"), text = cssVar("--text-2");
  const axis = {
    gridcolor: grid, zerolinecolor: cssVar("--zero"), linecolor: cssVar("--border"),
    tickfont: { family: cssVar("--mono"), size: 11, color: cssVar("--text-3") },
    title: { font: { size: 12, color: text } },
    automargin: true,
  };
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: cssVar("--font"), color: text, size: 12 },
    margin: { l: 8, r: 12, t: 8, b: 8 },
    separators: ", ",
    hovermode: "x unified",
    hoverlabel: {
      bgcolor: cssVar("--surface-2"), bordercolor: cssVar("--border-strong"),
      font: { family: cssVar("--font"), color: cssVar("--text"), size: 12.5 }, align: "left",
    },
    legend: { orientation: "h", x: 0, y: 1.02, yanchor: "bottom", font: { size: 12 }, bgcolor: "rgba(0,0,0,0)" },
    xaxis: { ...axis, showspikes: true, spikemode: "across", spikethickness: 1, spikecolor: cssVar("--border-strong"), spikedash: "solid" },
    yaxis: { ...axis, side: "right" },
    dragmode: isTouch ? false : "zoom",
  } as Partial<Layout>;
}

/** Layout för 3D-grafer (Plotly gl3d) i samma tema. */
export function scene3d(titles: { x: string; y: string; z: string }, extra: Record<string, unknown> = {}): Partial<Layout> {
  const ax = (title: string) => ({
    title: { text: title, font: { size: 12, color: cssVar("--text-2") } },
    gridcolor: cssVar("--border"), zerolinecolor: cssVar("--border-strong"), showbackground: true,
    backgroundcolor: "rgba(0,0,0,0)", color: cssVar("--text-3"),
    tickfont: { family: cssVar("--mono"), size: 10, color: cssVar("--text-3") }, showspikes: false,
  });
  return {
    hovermode: "closest",
    dragmode: "turntable",
    showlegend: false,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    scene: {
      xaxis: ax(titles.x), yaxis: ax(titles.y), zaxis: ax(titles.z),
      camera: { eye: { x: 1.25, y: -1.3, z: 0.75 }, center: { x: 0, y: 0, z: -0.12 } },
      aspectmode: "manual", aspectratio: { x: 1.5, y: 1.1, z: 0.8 },
      ...extra,
    },
  } as Partial<Layout>;
}

export interface PlotProps {
  data: Data[];
  layout?: Partial<Layout>;
  height?: number;
  xRange?: [string, string] | null;
  onXRange?: (r: [string, string] | null) => void;
  config?: Partial<Config>;
  ariaLabel: string;
}

export function Plot({ data, layout, height = 300, xRange, onXRange, config, ariaLabel }: PlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useSettings();
  const cbRef = useRef(onXRange);
  cbRef.current = onXRange;

  useEffect(() => {
    let cancelled = false;
    loadPlotly().then((Plotly) => {
      if (cancelled || !ref.current) return;
      const base = baseLayout();
      const merged: Partial<Layout> = {
        ...base, ...layout, height,
        xaxis: { ...(base.xaxis as object), ...(layout?.xaxis as object), ...(xRange ? { range: xRange, autorange: false } : { autorange: true }) },
        yaxis: { ...(base.yaxis as object), ...(layout?.yaxis as object) },
      };
      if (layout?.yaxis2) merged.yaxis2 = { ...(base.yaxis as object), ...(layout.yaxis2 as object) };
      Plotly.react(ref.current, data, merged, {
        displaylogo: false, responsive: true, displayModeBar: false, scrollZoom: false, ...config,
      }).then((el: PlotlyHTMLElement) => {
        setReady(true);
        el.removeAllListeners?.("plotly_relayout");
        el.on("plotly_relayout", (ev: any) => {
          if (!cbRef.current) return;
          if (ev["xaxis.autorange"]) cbRef.current(null);
          else if (ev["xaxis.range[0]"]) cbRef.current([String(ev["xaxis.range[0]"]), String(ev["xaxis.range[1]"])]);
        });
      });
    });
    return () => { cancelled = true; };
  }, [data, layout, height, xRange, config, theme]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => loadPlotly().then((P) => el.isConnected && ready && P.Plots.resize(el)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => () => { if (ref.current) loadPlotly().then((P) => ref.current && P.purge(ref.current)); }, []);

  return (
    <div role="img" aria-label={ariaLabel} style={{ position: "relative", height }}>
      {!ready && <div className="plot-loading" style={{ position: "absolute", inset: 0 }}>Ritar graf…</div>}
      <div ref={ref} className="plot" style={{ height }} />
    </div>
  );
}
