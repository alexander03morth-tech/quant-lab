/** Data som laddas vid behov (inte blockerande): nyheter och börssammanfattning. */
import { useEffect, useState } from "react";

export interface NewsItem { t: string; title: string; source: string; url: string }
export interface NewsFile { fetchedAt: string; source: string; items: Record<string, NewsItem[]>; market: Record<string, NewsItem[]>; pe?: (NewsItem & { cat: string })[] }
export interface SummarySection { id: string; title: string; text: string; explain: string; pairs?: { y: string; x: string; z: number; p: number; hl: number }[] }
export interface Mover { ticker: string; name: string; sector: string; ret: number; abn: number; beta: number; volRatio: number | null; sigma: number; news: NewsItem | null }
export interface Summary {
  date: string; generatedAt: string; headline: string;
  index: { level: number; r1d: number; r5d: number; r1m: number; rYtd: number; sigma: number; sd: number };
  breadth: { up: number; down: number; total: number };
  sectors: { name: string; ret: number; n: number }[];
  dispersion: { today: number; percentile: number };
  movers: Mover[];
  sections: SummarySection[];
}

const cache = new Map<string, Promise<unknown>>();
function load<T>(file: string): Promise<T> {
  if (!cache.has(file)) cache.set(file, fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(file) as Promise<T>;
}
function useFile<T>(file: string): T | null | undefined {
  const [v, setV] = useState<T | null | undefined>(undefined);
  useEffect(() => { let on = true; load<T>(file).then((d) => on && setV(d)); return () => { on = false; }; }, [file]);
  return v;
}
export const useNews = () => useFile<NewsFile>("news.json");
export const useSummary = () => useFile<Summary>("summary.json");

export function timeAgo(iso: string) {
  const m = (Date.now() - new Date(iso).getTime()) / 6e4;
  if (m < 60) return `${Math.max(1, Math.round(m))} min sedan`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h sedan`;
  const d = Math.round(m / 1440);
  return d === 1 ? "i går" : `${d} dagar sedan`;
}

/** Handelsdag som en nyhet påverkar: publicerad efter 17:30 Stockholmstid → nästa handelsdag. */
export function tradingDayFor(iso: string, dates: string[]): number {
  const dt = new Date(iso);
  const sto = new Date(dt.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
  let day = sto.toISOString().slice(0, 10);
  if (sto.getHours() * 60 + sto.getMinutes() > 17 * 60 + 30) {
    const n = new Date(sto); n.setDate(n.getDate() + 1); day = n.toISOString().slice(0, 10);
  }
  // första handelsdag >= day
  let lo = 0, hi = dates.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (dates[mid] < day) lo = mid + 1; else hi = mid; }
  return lo < dates.length ? lo : -1;
}

export interface Fundamentals {
  name: string; sector: string; currency: string; fx: number; price: number | null; shares: number | null;
  marketCap: number | null; ev: number | null; netDebt: number | null; debt: number | null; cash: number | null;
  ebitda: number | null; revenue: number | null; ebitdaMargin: number | null; revenueGrowth: number | null;
  fcf: number | null; capex: number | null; capexPct: number | null; capexEstimated?: boolean;
  evEbitda: number | null; netDebtEbitda: number | null; fcfYield: number | null;
  high52: number | null; low52: number | null; lbo: boolean; lboNote: string | null;
  history: { year: number; revenue: number; ebitda: number | null; ebit: number | null }[];
  netIncome: number | null; equity: number | null; pe: number | null; pb: number | null; roe: number | null;
  profitMargin: number | null; operatingMargin: number | null; grossMargin: number | null; earningsGrowth: number | null;
  divYield: number | null; divPerShare: number | null; payout: number | null;
  targetMean: number | null; targetHigh: number | null; targetLow: number | null; analysts: number | null; recommendation: number | null;
  employees: number | null; summary: string; industry: string | null; website: string | null;
}
export interface FundamentalsFile { fetchedAt: string; fx: Record<string, number>; source: string; items: Record<string, Fundamentals> }
export const useFundamentals = () => useFile<FundamentalsFile>("fundamentals.json");

export interface BriefingSection { id: "vad" | "varfor" | "problem" | "fordelar" | "framtid"; title: string; text?: string; bullets?: string[]; explain: string }
export interface BriefingPeriod {
  label: string; from: string; to: string; days: number; headline: string;
  stats: { ret: number; z: number; sigma: number; up: number; total: number; vol: number; volPct: number; corr: number; corrPct: number; drawdown: number; cycMinusDef: number };
  contrib: { ticker: string; name: string; ret: number; c: number }[];
  sectors: { id: string; name: string; ret: number }[];
  global: { ticker: string; label: string; desc: string; level: number; chg: number; isRate: boolean }[];
  baseRates: { n: number; bucket: number; hit: number; median: number; p10: number; p90: number; allHit: number; allMedian: number };
  news: (NewsItem & { kind: string })[];
  sections: BriefingSection[];
}
export interface Briefing { date: string; generatedAt: string; periods: Record<"day" | "week" | "month", BriefingPeriod> }
export const useBriefing = () => useFile<Briefing>("briefing.json");
