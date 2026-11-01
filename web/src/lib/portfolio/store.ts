/**
 * Sparade portföljer. Lagras i webbläsaren (localStorage) – bara på den här enheten.
 * En portfölj kan delas via länk: vikterna kodas i URL:en (?p=...).
 */
import { useCallback, useEffect, useState } from "react";
import type { Holding, Rebalance } from "./engine";

export interface Portfolio {
  id: string;
  name: string;
  holdings: Holding[];
  rebalance: Rebalance;
  value: number; // kronor, för att räkna VaR i kr
}

const KEY = "ql-portfolios-v1";
const ACTIVE = "ql-portfolio-active";

export const PRESETS: Omit<Portfolio, "id">[] = [
  { name: "Storbankerna", rebalance: "monthly", value: 100000, holdings: ["NDA-SE.ST", "SEB-A.ST", "SHB-A.ST", "SWED-A.ST"].map((t) => ({ ticker: t, weight: 0.25 })) },
  { name: "Verkstad", rebalance: "monthly", value: 100000, holdings: ["ATCO-A.ST", "SAND.ST", "EPI-A.ST", "VOLV-B.ST", "ALFA.ST", "SKF-B.ST", "ABB.ST"].map((t) => ({ ticker: t, weight: 1 / 7 })) },
  { name: "Defensiv", rebalance: "monthly", value: 100000, holdings: ["TELIA.ST", "TEL2-B.ST", "ESSITY-B.ST", "AZN.ST", "INVE-B.ST"].map((t) => ({ ticker: t, weight: 0.2 })) },
  { name: "Wallenbergsfären", rebalance: "monthly", value: 100000, holdings: ["INVE-B.ST", "ATCO-A.ST", "ABB.ST", "AZN.ST", "ERIC-B.ST", "SEB-A.ST", "SAAB-B.ST", "EPI-A.ST", "EQT.ST"].map((t) => ({ ticker: t, weight: 1 / 9 })) },
];

const uid = () => Math.random().toString(36).slice(2, 9);

function read(): Portfolio[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(v) && v.length) return v;
  } catch { /* tomt eller blockerat */ }
  return PRESETS.map((p) => ({ ...p, id: uid() }));
}
function write(list: Portfolio[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* privat läge */ } }

// Enkel global prenumeration så att alla vyer ser samma lista
let state: Portfolio[] | null = null;
let activeId: string | null = null;
const subs = new Set<() => void>();
function ensure() {
  if (state) return;
  state = read();
  try { activeId = localStorage.getItem(ACTIVE); } catch { activeId = null; }
  if (!state.some((p) => p.id === activeId)) activeId = state[0]?.id ?? null;
}
function emit() { if (state) write(state); try { if (activeId) localStorage.setItem(ACTIVE, activeId); } catch { /* */ } subs.forEach((f) => f()); }

export function usePortfolios() {
  ensure();
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((x) => x + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  const list = state!;
  const active = list.find((p) => p.id === activeId) ?? null;
  const setActive = useCallback((id: string) => { activeId = id; emit(); }, []);
  const save = useCallback((p: Portfolio) => {
    const i = state!.findIndex((x) => x.id === p.id);
    state = i >= 0 ? state!.map((x) => (x.id === p.id ? p : x)) : [...state!, p];
    emit();
  }, []);
  const create = useCallback((p: Omit<Portfolio, "id">) => { const np = { ...p, id: uid() }; state = [...state!, np]; activeId = np.id; emit(); return np; }, []);
  const remove = useCallback((id: string) => {
    state = state!.filter((x) => x.id !== id);
    if (!state.length) state = PRESETS.map((p) => ({ ...p, id: uid() }));
    if (activeId === id) activeId = state[0].id;
    emit();
  }, []);
  return { list, active, setActive, save, create, remove };
}

/** Kodar en portfölj för delning via länk. */
export function encodePortfolio(p: Portfolio): string {
  const compact = { n: p.name, r: p.rebalance, h: p.holdings.map((h) => [h.ticker.replace(".ST", ""), Math.round(h.weight * 10000)]) };
  return btoa(unescape(encodeURIComponent(JSON.stringify(compact)))).replace(/=+$/, "");
}
export function decodePortfolio(s: string): Omit<Portfolio, "id"> | null {
  try {
    const c = JSON.parse(decodeURIComponent(escape(atob(s))));
    return { name: String(c.n).slice(0, 60), rebalance: c.r, value: 100000, holdings: c.h.map(([t, w]: [string, number]) => ({ ticker: t.startsWith("^") ? t : `${t}.ST`, weight: w / 10000 })) };
  } catch { return null; }
}
