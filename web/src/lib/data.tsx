import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Meta, Pairs, Prices, Stock } from "./types";

export interface DataBundle {
  meta: Meta;
  prices: Prices;
  pairs: Pairs;
  stockByTicker: Record<string, Stock>;
  name: (ticker: string) => string;
}

const Ctx = createContext<DataBundle | null>(null);

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([getJson<Meta>("meta.json"), getJson<Prices>("prices.json"), getJson<Pairs>("pairs.json")])
      .then(([meta, prices, pairs]) => {
        const stockByTicker = Object.fromEntries(meta.stocks.map((s) => [s.ticker, s]));
        stockByTicker[meta.benchmark.ticker] = { ticker: meta.benchmark.ticker, name: meta.benchmark.name, sector: "index" };
        setData({ meta, prices, pairs, stockByTicker, name: (t) => stockByTicker[t]?.name ?? t });
      })
      .catch((e) => setError(String(e)));
  }, []);
  if (error) return <div className="page"><div className="notice"><span className="icon">!</span>Kunde inte läsa data: {error}</div></div>;
  if (!data) return <div className="page plot-loading" style={{ minHeight: "60vh" }}>Laddar kursdata…</div>;
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useData(): DataBundle {
  const d = useContext(Ctx);
  if (!d) throw new Error("useData utanför DataProvider");
  return d;
}

/** Gemensamma datum där båda serierna har kurs, de sista `n` (eller alla om n = 0). */
export function alignedPair(prices: Prices, a: string, b: string, n: number) {
  const ca = prices.series[a].close, cb = prices.series[b].close;
  const idx: number[] = [];
  for (let i = 0; i < prices.dates.length; i++) if (ca[i] != null && cb[i] != null) idx.push(i);
  const take = n > 0 ? idx.slice(-n) : idx;
  return {
    dates: take.map((i) => prices.dates[i]),
    pa: Float64Array.from(take, (i) => ca[i] as number),
    pb: Float64Array.from(take, (i) => cb[i] as number),
    available: idx.length,
  };
}
