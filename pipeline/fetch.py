"""Hämtar dagliga justerade stängningskurser och volym för OMXS30 + index via yfinance.

Rensar datan enligt config/corrections.yaml (avknoppningar, felaktiga tick) och skriver:
  web/public/data/prices.json  – kolumnärt format: {dates, series: {ticker: {close, volume}}}
  data/prices.csv.gz           – samma data i långt format för Python-steget
  data/quality.json            – vilka korrigeringar som gjordes + kvarvarande varningar

Kör:  python pipeline/fetch.py
"""
from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import pandas as pd
import yaml
import yfinance as yf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATA_DIR, ROOT, WEB_DATA, load_universe  # noqa: E402


def download(tickers: list[str], start: str, retries: int = 3) -> pd.DataFrame:
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            df = yf.download(
                tickers, start=start, auto_adjust=True, group_by="ticker",
                progress=False, threads=True,
            )
            if df.empty:
                raise RuntimeError("tom respons från Yahoo")
            return df
        except Exception as e:  # nätverksfel, rate limit
            last_err = e
            print(f"försök {attempt} misslyckades: {e}", file=sys.stderr)
            time.sleep(5 * attempt)
    raise RuntimeError(f"kunde inte hämta data: {last_err}")


def clean(close: pd.DataFrame, bench: str) -> tuple[pd.DataFrame, dict]:
    """Applicerar korrigeringar. Returnerar rensade kurser + kvalitetsrapport."""
    cfg = yaml.safe_load((ROOT / "config" / "corrections.yaml").read_text(encoding="utf-8"))
    close = close.copy()
    report: dict = {"adjustments": [], "spikes": [], "warnings": []}

    # 1) Enskilda felaktiga kurser (spik som direkt går tillbaka)
    for t in close.columns:
        s = close[t]
        prev, nxt = s.shift(1), s.shift(-1)
        r = s / prev - 1
        spike = (r.abs() > cfg["spike_threshold"]) & ((nxt / prev - 1).abs() < cfg["spike_revert"])
        for d in s.index[spike.fillna(False)]:
            report["spikes"].append({"ticker": t, "date": d.strftime("%Y-%m-%d"),
                                     "bad": round(float(s[d]), 3), "replaced_with": round(float(prev[d]), 3)})
            close.loc[d, t] = prev[d]

    # 2) Avknoppningar/extrautdelningar som Yahoo missat
    idx_ret = close[bench] / close[bench].shift(1) - 1
    for adj in cfg.get("adjustments", []):
        t, d = adj["ticker"], pd.Timestamp(adj["date"])
        if t not in close.columns or d not in close.index:
            continue
        i = close.index.get_loc(d)
        if adj["method"] == "index_neutral":
            f = (close[t].iloc[i] / close[t].iloc[i - 1]) / (1 + idx_ret.iloc[i])
        else:
            f = float(adj["factor"])
        close.iloc[:i, close.columns.get_loc(t)] *= f
        report["adjustments"].append({"ticker": t, "date": adj["date"], "factor": round(float(f), 5),
                                      "note": adj.get("note", "")})

    # 3) Kvarvarande stora rörelser → varningar (visas i UI)
    known = {(k["ticker"], k["date"]) for k in cfg.get("known_moves", [])}
    rets = close / close.shift(1) - 1
    for t in close.columns:
        for d, v in rets[t][rets[t].abs() > cfg["warn_threshold"]].items():
            key = (t, d.strftime("%Y-%m-%d"))
            if key not in known:
                report["warnings"].append({"ticker": t, "date": key[1], "return": round(float(v), 4)})
    return close, report


def main() -> None:
    uni = load_universe()
    tickers = [s["ticker"] for s in uni["stocks"]] + [uni["benchmark"]["ticker"]]
    raw = download(tickers, uni["start_date"])

    close = pd.DataFrame({t: raw[t]["Close"] for t in tickers if t in raw.columns.get_level_values(0)})
    volume = pd.DataFrame({t: raw[t]["Volume"] for t in tickers if t in raw.columns.get_level_values(0)})
    missing = [t for t in tickers if t not in close.columns or close[t].dropna().empty]
    if missing:
        print(f"VARNING: ingen data för {missing}", file=sys.stderr)

    # Handelsdagar = dagar då index eller minst hälften av aktierna handlades.
    close.index = pd.to_datetime(close.index).tz_localize(None)
    volume.index = close.index
    valid = close.notna().sum(axis=1) >= len(close.columns) // 2
    close, volume = close[valid], volume[valid]

    # Säkerhetskontroll: avbryt hellre än att skriva över bra data med trasig.
    n_ok = sum(close[t].notna().sum() > 250 for t in close.columns)
    if n_ok < 25:
        raise SystemExit(f"för få serier med data ({n_ok}) – avbryter utan att skriva")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    WEB_DATA.mkdir(parents=True, exist_ok=True)

    close, report = clean(close, uni["benchmark"]["ticker"])
    (DATA_DIR / "quality.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"korrigeringar: {len(report['adjustments'])}, spikar: {len(report['spikes'])}, "
          f"varningar: {len(report['warnings'])}")

    long = close.stack().rename("close").to_frame().join(volume.stack().rename("volume"))
    long.index.names = ["date", "ticker"]
    long.reset_index().to_csv(DATA_DIR / "prices.csv.gz", index=False, compression="gzip")

    def num(v, nd):
        return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(float(v), nd)

    out = {
        "dates": [d.strftime("%Y-%m-%d") for d in close.index],
        "series": {
            t: {
                "close": [num(v, 3) for v in close[t].tolist()],
                "volume": [None if pd.isna(v) else int(v) for v in volume[t].tolist()],
            }
            for t in close.columns
        },
    }
    (WEB_DATA / "prices.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"prices.json: {len(out['dates'])} dagar, {len(out['series'])} serier, "
          f"{out['dates'][0]} → {out['dates'][-1]}")


if __name__ == "__main__":
    main()
