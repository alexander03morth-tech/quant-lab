"""Nyckeltal för PE-/LBO-analys från Yahoo Finance → web/public/data/fundamentals.json.

Fallgropar som hanteras:
  - Valuta: vissa bolag rapporterar i EUR/USD/CHF men handlas i SEK. Yahoo blandar ihop dem
    (EV i SEK, EBITDA i EUR → EV/EBITDA blir fel). Allt räknas om till SEK med aktuell växelkurs.
  - Banker och investmentbolag kan inte analyseras med en LBO (skulden är deras råvara) → lbo=False.
  - Siffrorna är rullande 12 månader enligt Yahoo och ska ses som ungefärliga.
"""
from __future__ import annotations

import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import WEB_DATA, load_universe  # noqa: E402

NOT_LBO = {"finans"}  # banker, investmentbolag och kapitalförvaltare


def fx_to_sek(cur: str, cache: dict) -> float:
    if cur in (None, "SEK"):
        return 1.0
    if cur not in cache:
        h = yf.Ticker(f"{cur}SEK=X").history(period="5d")
        cache[cur] = float(h["Close"].dropna().iloc[-1])
    return cache[cur]


def clean(v):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def history_rows(tk: yf.Ticker, fx: float) -> list[dict]:
    """Omsättning och EBITDA per år (senaste ~4 åren) för att se trend och tillväxt."""
    try:
        inc = tk.income_stmt
    except Exception:
        return []
    out = []
    for col in inc.columns[:5]:
        def g(*names):
            for nm in names:
                if nm in inc.index:
                    v = clean(inc.loc[nm, col])
                    if v is not None:
                        return v * fx
            return None
        rev = g("Total Revenue", "Operating Revenue")
        ebitda = g("EBITDA", "Normalized EBITDA")
        ebit = g("EBIT", "Operating Income")
        if rev:
            out.append({"year": int(str(col)[:4]), "revenue": rev, "ebitda": ebitda, "ebit": ebit})
    return sorted(out, key=lambda r: r["year"])


def main() -> None:
    uni = load_universe()
    fxc: dict = {}
    out, failed = {}, []
    for s in uni["stocks"]:
        t = s["ticker"]
        try:
            tk = yf.Ticker(t)
            i = tk.info
            fin_cur = i.get("financialCurrency") or "SEK"
            fx = fx_to_sek(fin_cur, fxc)
            price = clean(i.get("currentPrice") or i.get("regularMarketPrice"))
            shares = clean(i.get("sharesOutstanding"))
            mcap = clean(i.get("marketCap")) or (price * shares if price and shares else None)  # marketCap är i SEK
            ebitda = clean(i.get("ebitda"))
            rev = clean(i.get("totalRevenue"))
            debt = clean(i.get("totalDebt"))
            cash = clean(i.get("totalCash"))
            ocf = clean(i.get("operatingCashflow"))
            fcf = clean(i.get("freeCashflow"))
            conv = lambda v: v * fx if v is not None else None  # noqa: E731
            ebitda, rev, debt, cash, ocf, fcf = map(conv, (ebitda, rev, debt, cash, ocf, fcf))
            net_debt = (debt or 0) - (cash or 0) if debt is not None else None
            ev = mcap + net_debt if mcap is not None and net_debt is not None else None
            capex = (ocf - fcf) if ocf is not None and fcf is not None else None
            capex_est = False
            if capex is None or rev is None or capex <= 0 or capex / rev > 0.3:
                # Yahoo ger ibland orimliga värden (FCF > operativt kassaflöde). Använd 5 % av omsättningen.
                capex = 0.05 * rev if rev else None
                capex_est = True
            hist = history_rows(tk, fx)
            lbo = s["sector"] not in NOT_LBO and ebitda is not None and ebitda > 0
            out[t] = {
                "name": s["name"], "sector": s["sector"], "currency": fin_cur, "fx": fx,
                "price": price, "shares": shares, "marketCap": mcap, "ev": ev, "netDebt": net_debt,
                "debt": debt, "cash": cash, "ebitda": ebitda, "revenue": rev,
                "ebitdaMargin": ebitda / rev if ebitda and rev else None,
                "revenueGrowth": clean(i.get("revenueGrowth")),
                "fcf": fcf, "capex": capex, "capexPct": capex / rev if capex is not None and rev else None, "capexEstimated": capex_est,
                "evEbitda": ev / ebitda if ev and ebitda and ebitda > 0 else None,
                "netDebtEbitda": net_debt / ebitda if net_debt is not None and ebitda and ebitda > 0 else None,
                "fcfYield": fcf / mcap if fcf is not None and mcap else None,
                "high52": clean(i.get("fiftyTwoWeekHigh")), "low52": clean(i.get("fiftyTwoWeekLow")),
                "lbo": lbo,
                "lboNote": None if lbo else ("Bank, investmentbolag eller kapitalförvaltare – skulden är en del av affären, så en LBO-analys är inte meningsfull."
                                             if s["sector"] in NOT_LBO else "Saknar positiv EBITDA i datan."),
                "history": hist,
            }
        except Exception as e:
            failed.append(t)
            print(f"VARNING {t}: {e}", file=sys.stderr)
        time.sleep(0.5)
    dst = WEB_DATA / "fundamentals.json"
    if len(out) < 20:
        raise SystemExit(f"för få bolag hämtades ({len(out)}) – behåller gamla filen")
    dst.write_text(json.dumps({"fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                               "fx": fxc, "source": "Yahoo Finance (rullande 12 mån)", "items": out},
                              ensure_ascii=False, separators=(",", ":")))
    print(f"fundamentals.json: {len(out)} bolag, valutor {fxc}" + (f", misslyckades: {failed}" if failed else ""))


if __name__ == "__main__":
    main()
