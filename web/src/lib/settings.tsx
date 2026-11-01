import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "dark" | "light";
type Mode = "beginner" | "expert";

export interface ExplainRequest { id: string; ctx?: Record<string, unknown> }

interface Settings {
  theme: Theme; setTheme: (t: Theme) => void;
  mode: Mode; setMode: (m: Mode) => void;
  explain: ExplainRequest | null;
  openExplain: (id: string, ctx?: Record<string, unknown>) => void;
  closeExplain: () => void;
}
const Ctx = createContext<Settings | null>(null);

function load<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
}
function save(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* privat läge */ } }

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeS] = useState<Theme>(() => load("ql-theme", "dark"));
  const [mode, setModeS] = useState<Mode>(() => load("ql-mode", "beginner"));
  const [explain, setExplain] = useState<ExplainRequest | null>(null);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const setTheme = useCallback((t: Theme) => { setThemeS(t); save("ql-theme", t); }, []);
  const setMode = useCallback((m: Mode) => { setModeS(m); save("ql-mode", m); }, []);
  const openExplain = useCallback((id: string, ctx?: Record<string, unknown>) => setExplain({ id, ctx }), []);
  const closeExplain = useCallback(() => setExplain(null), []);
  const value = useMemo(() => ({ theme, setTheme, mode, setMode, explain, openExplain, closeExplain }),
    [theme, setTheme, mode, setMode, explain, openExplain, closeExplain]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSettings utanför provider");
  return s;
}
