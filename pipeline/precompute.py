"""Tunga beräkningar som körs vid varje datauppdatering (inte i webbläsaren).

För alla 435 par och tre fönster (1, 3, 5 år):
  - Engle-Granger (statsmodels.coint) i båda riktningar → bästa riktningen
  - OLS hedge ratio, ADF på spreaden, half-life (OU), Hurst, korrelation (log-avkastning)
  - Johansen (trace-statistik för r=0 och r<=1, 95 %-kritiska värden)
  - nuvarande z-score
  - Benjamini-Hochberg q-värde (korrigering för 435 samtidiga tester)
  - stabilitet: andel rullande 1-årsfönster de senaste 5 åren med EG p < 0,05

Skriver web/public/data/pairs.json och meta.json.
"""
from __future__ import annotations

import json
import sys
import time
import warnings
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller, coint
from statsmodels.tsa.vector_ar.vecm import coint_johansen

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATA_DIR, ROOT, WEB_DATA, load_universe  # noqa: E402
from stats.core import half_life, hurst, ols  # noqa: E402

warnings.filterwarnings("ignore")

WINDOWS = {"1Y": 252, "3Y": 756, "5Y": 1260}
STAB_WIN, STAB_STEP, STAB_SPAN = 252, 21, 1260


def r(v, nd=4):
    if v is None or not np.isfinite(v):
        return None
    return round(float(v), nd)


def pair_stats(la: np.ndarray, lb: np.ndarray, ra: np.ndarray, rb: np.ndarray) -> dict:
    """la, lb: log-priser (samma längd, utan NaN). ra, rb: log-avkastningar."""
    # Engle-Granger åt båda håll; samintegrationstestet är inte symmetriskt.
    t_ab, p_ab, _ = coint(la, lb, trend="c", autolag="aic")
    t_ba, p_ba, _ = coint(lb, la, trend="c", autolag="aic")
    if p_ab <= p_ba:
        y, x, dep, tstat, p = la, lb, "a", t_ab, p_ab
    else:
        y, x, dep, tstat, p = lb, la, "b", t_ba, p_ba
    alpha, beta = ols(y, x)
    spread = y - alpha - beta * x
    adf_stat, adf_p, adf_lag, *_ = adfuller(spread, autolag="AIC")
    joh = coint_johansen(np.column_stack([la, lb]), det_order=0, k_ar_diff=1)
    z = (spread[-1] - spread.mean()) / spread.std()
    return {
        "dep": dep,            # vilken aktie som är y (beroende variabel)
        "p": r(p, 5), "t": r(tstat, 3),
        "beta": r(beta), "alpha": r(alpha),
        "adf": r(adf_stat, 3), "adfP": r(adf_p, 5), "adfLag": int(adf_lag),
        "hl": r(half_life(spread), 2),
        "hurst": r(hurst(spread), 3),
        "corr": r(np.corrcoef(ra, rb)[0, 1], 3),
        "joh0": r(joh.lr1[0], 2), "joh1": r(joh.lr1[1], 2),
        "joh0c": r(joh.cvt[0, 1], 2), "joh1c": r(joh.cvt[1, 1], 2),
        "z": r(z, 2),
        "n": int(len(la)),
    }


def stability(la_full: np.ndarray, lb_full: np.ndarray) -> float | None:
    """Andel rullande 1-årsfönster (steg 1 månad) under senaste 5 åren där EG p < 0,05.
    Ett par som bara är samintegrerat i ett enda fönster är troligen en slump."""
    n = len(la_full)
    if n < STAB_SPAN:
        return None
    la, lb = la_full[-STAB_SPAN:], lb_full[-STAB_SPAN:]
    hits = tot = 0
    for end in range(STAB_WIN, STAB_SPAN + 1, STAB_STEP):
        a, b = la[end - STAB_WIN:end], lb[end - STAB_WIN:end]
        p = min(coint(a, b, trend="c", maxlag=1, autolag=None)[1],
                coint(b, a, trend="c", maxlag=1, autolag=None)[1])
        hits += p < 0.05
        tot += 1
    return hits / tot


def main() -> None:
    t0 = time.time()
    uni = load_universe()
    df = pd.read_csv(DATA_DIR / "prices.csv.gz", parse_dates=["date"])
    close = df.pivot(index="date", columns="ticker", values="close").sort_index()
    stocks = [s["ticker"] for s in uni["stocks"] if s["ticker"] in close.columns]
    logp = np.log(close[stocks])
    logr = logp.diff()

    pairs = []
    for a, b in combinations(stocks, 2):
        entry = {"a": a, "b": b, "w": {}}
        both = logp[[a, b]].dropna()
        for name, n in WINDOWS.items():
            if len(both) < n:
                continue
            win = both.iloc[-n:]
            rets = logr.loc[win.index, [a, b]].iloc[1:].fillna(0.0)
            entry["w"][name] = pair_stats(win[a].values, win[b].values, rets[a].values, rets[b].values)
        entry["stab"] = r(stability(both[a].values, both[b].values), 3)
        pairs.append(entry)
    # Benjamini-Hochberg: med 435 tester ger p<0,05 ~22 falska träffar av ren slump.
    # q-värdet är den lägsta falska upptäcktsandel (FDR) vid vilken paret räknas som signifikant.
    for name in WINDOWS:
        rows = [e["w"][name] for e in pairs if name in e["w"]]
        ps = np.array([row["p"] for row in rows])
        order = np.argsort(ps)
        m = len(ps)
        q = np.empty(m)
        q[order] = np.minimum.accumulate((ps[order] * m / np.arange(1, m + 1))[::-1])[::-1]
        for row, qv in zip(rows, np.minimum(q, 1.0)):
            row["q"] = r(qv, 4)
    print(f"{len(pairs)} par beräknade på {time.time() - t0:.0f} s")

    last_date = close.index[-1].strftime("%Y-%m-%d")
    quality = json.loads((DATA_DIR / "quality.json").read_text()) if (DATA_DIR / "quality.json").exists() else {}
    (WEB_DATA / "pairs.json").write_text(json.dumps(
        {"asOf": last_date, "windows": WINDOWS, "pairs": pairs}, separators=(",", ":")))

    meta = {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lastTradingDay": last_date,
        "firstDate": close.index[0].strftime("%Y-%m-%d"),
        "universeAsOf": uni["as_of"],
        "benchmark": uni["benchmark"],
        "sectors": uni["sectors"],
        "stocks": [s for s in uni["stocks"] if s["ticker"] in close.columns],
        "quality": quality,
    }
    (WEB_DATA / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    print(f"meta.json: senaste handelsdag {last_date}")


if __name__ == "__main__":
    main()
