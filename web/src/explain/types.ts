/** Kontext som en vy skickar till ett begrepps exempel (siffror för det aktuella paret osv.). */
export type Ctx = Record<string, any>;

export interface Concept {
  id: string;
  title: string;
  /** engelsk facktem */
  en?: string;
  kind: "Mått" | "Test" | "Modell" | "Parameter" | "Graf" | "Fallgrop" | "Grundbegrepp" | "Strategi";
  /** Vad är det? 1–2 meningar. Stöder **fet** och $tex$. */
  what: string;
  /** Varför tittar man på det? Vilket problem löser det i stat arb? */
  why: string;
  /** Tumregler för tolkning */
  interpret: string[];
  formula?: string;
  symbols?: [string, string][];
  /** Exempel i aktuell data. Returnera null om kontexten saknas. */
  example?: (c: Ctx) => string | null;
  pitfalls?: { title: string; text: string }[];
  related?: string[];
  /** steg i kursen som tar upp begreppet */
  learn?: string;
}
