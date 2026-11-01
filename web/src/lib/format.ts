const cache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number, extra: Intl.NumberFormatOptions = {}) {
  const key = `${min}-${max}-${JSON.stringify(extra)}`;
  if (!cache.has(key)) cache.set(key, new Intl.NumberFormat("sv-SE", { minimumFractionDigits: min, maximumFractionDigits: max, ...extra }));
  return cache.get(key)!;
}
/** Svensk decimalformatering med decimalkomma och riktigt minustecken. */
export const fmt = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "–" : nf(d, d).format(v).replace("-", "−");
export const fmtPct = (v: number | null | undefined, d = 1, sign = false) =>
  v == null || !Number.isFinite(v) ? "–" : (sign && v > 0 ? "+" : "") + fmt(v * 100, d) + " %";
export const fmtSigned = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "–" : (v > 0 ? "+" : "") + fmt(v, d);
export function fmtP(p: number | null | undefined) {
  if (p == null || !Number.isFinite(p)) return "–";
  if (p < 0.0001) return "< 0,0001";
  return fmt(p, p < 0.01 ? 4 : 3);
}
export const fmtDays = (d: number | null | undefined) =>
  d == null || !Number.isFinite(d) ? "∞" : `${fmt(d, d < 10 ? 1 : 0)} d`;

const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
export function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}
export function fmtDateTime(iso: string) {
  const dt = new Date(iso);
  return dt.toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" });
}
