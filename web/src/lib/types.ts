export interface Stock { ticker: string; name: string; sector: string }

export interface Meta {
  updatedAt: string;
  lastTradingDay: string;
  firstDate: string;
  universeAsOf: string;
  benchmark: { ticker: string; name: string };
  sectors: Record<string, string>;
  stocks: Stock[];
  quality: {
    adjustments?: { ticker: string; date: string; factor: number; note: string }[];
    spikes?: { ticker: string; date: string; bad: number; replaced_with: number }[];
    warnings?: { ticker: string; date: string; return: number }[];
  };
}

export interface Prices {
  dates: string[];
  series: Record<string, { close: (number | null)[]; volume: (number | null)[] }>;
}

export interface PairWindowStats {
  dep: "a" | "b";
  p: number; t: number; q?: number;
  beta: number; alpha: number;
  adf: number; adfP: number; adfLag: number;
  hl: number | null; hurst: number; corr: number;
  joh0: number; joh1: number; joh0c: number; joh1c: number;
  z: number; n: number;
}
export interface PairRow { a: string; b: string; w: Partial<Record<WindowKey, PairWindowStats>>; stab: number | null }
export type WindowKey = "1Y" | "3Y" | "5Y";
export interface Pairs { asOf: string; windows: Record<WindowKey, number>; pairs: PairRow[] }
