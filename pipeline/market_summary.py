"""Skriver en kort börssammanfattning för senaste handelsdagen, med förklaringar för nybörjare.

Allt bygger på data – inga påhittade orsaker. När en stor kursrörelse sammanfaller med en
nyhetsrubrik samma dag visas rubriken – utan att påstå att den är orsaken.

Markup i texterna (renderas av webben):
  **fet**          fetstil
  [[id|text]]      klickbar länk till begreppet `id` i förklaringslagret
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, time as dtime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATA_DIR, WEB_DATA, load_universe  # noqa: E402

STO = ZoneInfo("Europe/Stockholm")
MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti",
          "september", "oktober", "november", "december"]
WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"]


def pct(v: float, d: int = 1, sign: bool = True) -> str:
    s = f"{abs(v) * 100:.{d}f}".replace(".", ",")
    if not sign:
        return f"{s} %"
    return f"{'+' if v > 0 else '−' if v < 0 else '±'}{s} %"


def num(v: float, d: int = 1) -> str:
    return f"{v:.{d}f}".replace(".", ",").replace("-", "−")


def swe_date(d: pd.Timestamp) -> str:
    return f"{WEEKDAYS[d.weekday()]} {d.day} {MONTHS[d.month - 1]}"


def news_for_day(items: list[dict], day: pd.Timestamp) -> list[dict]:
    """Nyheter som kan ha påverkat stängningskursen dag `day`: publicerade efter förra dagens
    stängning (17:30) och före dagens stängning."""
    end = datetime.combine(day.date(), dtime(17, 30), STO)
    start = end - timedelta(days=3 if day.weekday() == 0 else 1)
    out = []
    for it in items:
        ts = datetime.fromisoformat(it["t"]).astimezone(STO)
        if start <= ts <= end:
            out.append(it)
    return out


def main() -> None:
    uni = load_universe()
    bench = uni["benchmark"]["ticker"]
    names = {s["ticker"]: s["name"] for s in uni["stocks"]}
    sectors = {s["ticker"]: uni["sectors"][s["sector"]] for s in uni["stocks"]}
    df = pd.read_csv(DATA_DIR / "prices.csv.gz", parse_dates=["date"])
    close = df.pivot(index="date", columns="ticker", values="close").sort_index()
    vol = df.pivot(index="date", columns="ticker", values="volume").sort_index()
    news = json.loads((WEB_DATA / "news.json").read_text()) if (WEB_DATA / "news.json").exists() else {"items": {}, "market": {}}
    pairs = json.loads((WEB_DATA / "pairs.json").read_text())

    ret = close.pct_change()
    day = close.index[-1]
    r = ret.iloc[-1]
    stocks = [t for t in names if t in close.columns and pd.notna(r.get(t))]

    # ── Index ──
    idx_r = float(r[bench])
    idx_sd = float(ret[bench].iloc[-64:-1].std())
    sigma = idx_r / idx_sd if idx_sd > 0 else 0.0
    def idx_ret(days: int) -> float:
        return float(close[bench].iloc[-1] / close[bench].iloc[-1 - days] - 1)
    ytd_base = close[bench][close.index.year < day.year].iloc[-1]
    idx = {"level": float(close[bench].iloc[-1]), "r1d": idx_r, "r5d": idx_ret(5), "r1m": idx_ret(21),
           "rYtd": float(close[bench].iloc[-1] / ytd_base - 1), "sigma": sigma, "sd": idx_sd}

    # ── Aktier: avkastning, abnormal avkastning (mot beta), volym ──
    window = ret.iloc[-253:-1]
    rows = []
    for t in stocks:
        x = window[[t, bench]].dropna()
        beta = float(np.cov(x[t], x[bench])[0, 1] / x[bench].var()) if len(x) > 60 else 1.0
        vmed = float(vol[t].iloc[-21:-1].median())
        vr = float(vol[t].iloc[-1] / vmed) if vmed > 0 else None
        sd = float(window[t].std())
        items = news_for_day(news["items"].get(t, []), day)
        rows.append({"ticker": t, "name": names[t], "sector": sectors[t], "ret": float(r[t]),
                     "abn": float(r[t] - beta * idx_r), "beta": beta, "volRatio": vr,
                     "sigma": float(r[t] / sd) if sd > 0 else 0.0,
                     "news": items[0] if items else None})
    rows.sort(key=lambda z: z["ret"], reverse=True)
    up = sum(1 for z in rows if z["ret"] > 0)
    down = sum(1 for z in rows if z["ret"] < 0)

    sec: dict[str, list[float]] = {}
    for z in rows:
        sec.setdefault(z["sector"], []).append(z["ret"])
    sector_rows = sorted(({"name": k, "ret": float(np.mean(v)), "n": len(v)} for k, v in sec.items()),
                         key=lambda z: z["ret"], reverse=True)

    # Spridning (dispersion): standardavvikelse mellan aktiernas avkastning idag, jämfört med senaste året
    disp_series = ret[stocks].iloc[-253:].std(axis=1)
    disp = float(disp_series.iloc[-1])
    disp_pct = float((disp_series.iloc[:-1] < disp).mean())

    # Par med störst |z| bland par som är samintegrerade på 3 år (p<0,05)
    hot = []
    for p in pairs["pairs"]:
        w = p["w"].get("3Y")
        if w and w["p"] < 0.05 and w["z"] is not None and abs(w["z"]) >= 1.5:
            y, x = (p["a"], p["b"]) if w["dep"] == "a" else (p["b"], p["a"])
            hot.append({"y": y, "x": x, "z": w["z"], "p": w["p"], "hl": w["hl"]})
    hot.sort(key=lambda h: -abs(h["z"]))
    hot = hot[:4]

    # ── Text ──
    verb = "steg" if idx_r > 0.002 else "föll" if idx_r < -0.002 else "stod nästan still"
    best, worst = rows[0], rows[-1]
    top_sector = sector_rows[0] if idx_r >= 0 else sector_rows[-1]
    headline = (f"Stockholmsbörsen {verb} {pct(idx_r, 1, False) if verb != 'stod nästan still' else f'({pct(idx_r)})'}"
                + (f" – {top_sector['name'].lower()} {'drog uppåt' if idx_r >= 0 else 'tyngde mest'}" if abs(idx_r) > 0.002 else ""))
    size = ("en ovanligt stor rörelse" if abs(sigma) >= 2 else "en lite större rörelse än vanligt" if abs(sigma) >= 1
            else "en helt normal dag")

    sections = []
    sections.append({
        "id": "day", "title": "Dagen i korthet",
        "text": (f"[[index|OMXS30]] {verb} {pct(idx_r, 1, False) if abs(idx_r) > 0.002 else f'({pct(idx_r)})'} och stängde på {num(idx['level'], 1)} punkter {swe_date(day)}. "
                 f"{up} av {len(rows)} aktier gick upp och {down} ner. "
                 f"En vanlig dag rör sig index ungefär ±{pct(idx_sd, 1, False)}, så dagens rörelse var {num(abs(sigma), 1)} "
                 f"[[sigma-move|standardavvikelser]] – {size}."),
        "explain": ("OMXS30 är ett mått på hur de 30 största och mest handlade bolagen på Stockholmsbörsen gick tillsammans. "
                    "Att jämföra dagens rörelse med en \"vanlig dag\" är ett sätt att avgöra om något speciellt hände, "
                    "eller om det bara var vardagligt brus. Under 1 standardavvikelse händer ungefär två dagar av tre."),
    })
    def mover(z: dict) -> str:
        s = f"**{z['name']}** {pct(z['ret'])}"
        extra = []
        if z["volRatio"] and z["volRatio"] >= 1.8:
            extra.append(f"{num(z['volRatio'], 1)} gånger normal [[volume|volym]]")
        if extra:
            s += f" ({', '.join(extra)})"
        if z["news"]:
            s += f". I nyheterna samma dag: ”{z['news']['title']}” ({z['news']['source']})"
        return s
    gainers = [z for z in rows[:3] if z["ret"] > 0]
    losers = [z for z in reversed(rows[-3:]) if z["ret"] < 0]
    mtxt = ""
    if gainers:
        mtxt += "Bäst gick " + "; ".join(mover(z) for z in gainers) + ". "
    if losers:
        mtxt += "Sämst gick " + "; ".join(mover(z) for z in losers) + ". "
    big_abn = max(rows, key=lambda z: abs(z["abn"]))
    mtxt += (f"Rensat för hur mycket aktien brukar följa börsen ([[beta|beta]]) stack {big_abn['name']} ut mest, "
             f"med en [[abnormal-return|bolagsspecifik rörelse]] på {pct(big_abn['abn'])}.")
    sections.append({
        "id": "movers", "title": "Vinnare och förlorare", "text": mtxt,
        "explain": ("En aktie kan röra sig av två skäl: hela marknaden rör sig, eller något händer i just det bolaget "
                    "(en rapport, en order, en vinstvarning). Den bolagsspecifika delen är den intressanta för en kvant – "
                    "det är den som kan få två annars likadana aktier att glida isär. Hög volym betyder att många handlade, "
                    "vilket ofta tyder på ny information snarare än slump."),
    })
    sections.append({
        "id": "sectors", "title": "Sektorer",
        "text": (f"Bäst gick {sector_rows[0]['name'].lower()} ({pct(sector_rows[0]['ret'])} i snitt) och sämst "
                 f"{sector_rows[-1]['name'].lower()} ({pct(sector_rows[-1]['ret'])}). "
                 f"Spridningen mellan aktierna ([[dispersion|dispersion]]) var {pct(disp, 2, False)}, högre än "
                 f"{round(disp_pct * 100)} % av dagarna det senaste året."),
        "explain": ("Bolag i samma bransch påverkas av samma saker – räntor för bankerna, världskonjunkturen för verkstadsbolagen. "
                    "Därför rör de sig ofta i flock. När spridningen mellan aktierna är stor går marknaden \"isär\": "
                    "det är just då par som brukar följas åt kan få tillfälliga avvikelser att handla på."),
    })
    sections.append({
        "id": "trend", "title": "Veckan, månaden och året",
        "text": (f"Senaste veckan har OMXS30 gått {pct(idx['r5d'])}, senaste månaden {pct(idx['r1m'])} "
                 f"och hittills i år {pct(idx['rYtd'])}."),
        "explain": ("En enskild dag säger lite. Längre perioder visar trenden. Tänk på att aktier i snitt har stigit "
                    "ungefär 7–9 % per år historiskt, men med stora svängningar på vägen."),
    })
    if hot:
        htxt = "Par som är [[cointegration|samintegrerade]] på tre år och där avståndet nu är ovanligt stort: " + "; ".join(
            f"**{names[h['y']]}/{names[h['x']]}** z = {num(h['z'], 1)}" for h in hot) + "."
        htxt += " Det är inte en köprekommendation – se [[multiple-testing|multipel testning]] innan du litar på ett enskilt par."
        sections.append({
            "id": "statarb", "title": "För stat arb-spanaren", "text": htxt,
            "explain": ("Ett z-värde på ±2 betyder att avståndet mellan två aktier som brukar följas åt är ovanligt stort. "
                        "Pairs trading satsar på att det krymper igen. Klicka på ett par för att se hela analysen."),
            "pairs": hot,
        })

    out = {
        "date": day.strftime("%Y-%m-%d"),
        "generatedAt": datetime.now(STO).isoformat(timespec="minutes"),
        "headline": headline,
        "index": idx,
        "breadth": {"up": up, "down": down, "total": len(rows)},
        "sectors": sector_rows,
        "dispersion": {"today": disp, "percentile": disp_pct},
        "movers": rows,
        "sections": sections,
    }
    (WEB_DATA / "summary.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"summary.json: {headline}")


if __name__ == "__main__":
    main()
