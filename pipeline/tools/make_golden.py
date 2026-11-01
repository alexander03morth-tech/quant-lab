"""Skapar golden-filer: verkliga par → resultat från statsmodels och våra verifierade Python-funktioner.
web/src/lib/stats/*.test.ts kontrollerar att TypeScript-implementationen ger samma siffror."""
import json, sys, warnings
from pathlib import Path
import numpy as np, pandas as pd
from statsmodels.tsa.stattools import adfuller, coint
from statsmodels.tsa.vector_ar.vecm import coint_johansen

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
from stats.core import half_life, hurst, kalman_hedge, kalman_init, ols  # noqa
warnings.filterwarnings("ignore")

df = pd.read_csv(ROOT / "data/prices.csv", parse_dates=["date"])
close = df.pivot(index="date", columns="ticker", values="close")
# Fast slutdatum så att golden-filen inte ändras när ny data hämtas
close = close.loc[:"2026-10-30"]
CASES = [("NDA-SE.ST", "SWED-A.ST", 1260), ("EPI-A.ST", "SAND.ST", 756),
         ("ERIC-B.ST", "VOLV-B.ST", 504), ("ATCO-A.ST", "SKF-B.ST", 252)]
out = []
for a, b, n in CASES:
    w = np.log(close[[a, b]].dropna().iloc[-n:])
    y, x = w[a].values, w[b].values
    alpha, beta = ols(y, x)
    s = y - alpha - beta * x
    adf = adfuller(s, autolag="AIC")
    adf_n = adfuller(s, regression="n", autolag="AIC")
    eg = coint(y, x, trend="c", autolag="aic")
    joh = coint_johansen(np.column_stack([y, x]), 0, 1)
    k = kalman_hedge(y, x, 1e-4, 1e-3)
    v = joh.evec[:, 0]
    ki = kalman_init(y, x, 60)
    k2 = kalman_hedge(y[60:], x[60:], 1e-7, ki["ve"], ki["theta"], ki["P"])
    out.append({
        "a": a, "b": b, "y": [round(float(t), 10) for t in y], "x": [round(float(t), 10) for t in x],
        "ols": {"alpha": alpha, "beta": beta},
        "adf": {"stat": adf[0], "p": adf[1], "lag": adf[2], "nobs": adf[3], "crit": adf[4], "ic": adf[5]},
        "adfN": {"stat": adf_n[0], "p": adf_n[1], "lag": adf_n[2]},
        "coint": {"stat": eg[0], "p": eg[1], "crit": list(eg[2])},
        "johansen": {"eig": list(joh.eig), "trace": list(joh.lr1), "maxEig": list(joh.lr2),
                     "vector": [1.0, float(v[1] / v[0])]},
        "halfLife": half_life(s), "hurst": hurst(s),
        "kalman": {"beta": k["beta"][::25].tolist(), "alpha": k["alpha"][::25].tolist(),
                   "betaLast": float(k["beta"][-1]), "eLast": float(k["e"][-1]), "QLast": float(k["Q"][-1])},
        "kalmanInit": {"theta": ki["theta"].tolist(), "ve": ki["ve"], "P": ki["P"].tolist(),
                       "beta": k2["beta"][::25].tolist(), "e": k2["e"][::25].tolist()},
    })
dst = ROOT / "web/src/lib/stats/__golden__/golden.json"
dst.write_text(json.dumps(out))
print(f"{len(out)} fall → {dst.relative_to(ROOT)}")
