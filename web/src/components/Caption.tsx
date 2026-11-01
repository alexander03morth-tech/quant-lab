import type { ReactNode } from "react";
import { useSettings } from "../lib/settings";

/** Kort förklaring under en graf – syns bara i nybörjarläget. */
export function Caption({ children }: { children: ReactNode }) {
  const { mode } = useSettings();
  if (mode !== "beginner") return null;
  return <p className="caption">{children}</p>;
}
