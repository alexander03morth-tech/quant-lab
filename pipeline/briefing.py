""""Det här behöver du veta" – dag, vecka och månad.

Skriver web/public/data/briefing.json med fem delar per period:
  vad      – vad hände (index, bredd, vinnare/förlorare, sektorer)
  varfor   – vad i datan som förklarar rörelsen (sektorer, största bidrag, omvärlden, teman i nyheterna)
  problem  – risker och svagheter som syns i datan
  fordelar – det som ser bra ut
  framtid  – en nyanserad framtidspaning byggd på historiska basfrekvenser, volatilitetens
             tröghet och kalendern. Aldrig en prognos eller rekommendation.

Princip: allt bygger på data. Nyheter beskrivs som "i nyheterna under perioden", aldrig som orsak.
Markup: **fet**, [[begrepp-id|text]] (öppnar förklaringslagret i webben).
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATA_DIR, WEB_DATA, load_universe  # noqa: E402
from market_summary import MONTHS, STO, num, pct, swe_date  # noqa: E402

MACRO = {
    "^GSPC": ("S&P 500", "USA:s storbolagsindex"),
    "^STOXX50E": ("Euro Stoxx 50", "Europas storbolagsindex"),
    "^VIX": ("VIX", "\"rädsloindex\" – förväntade svängningar i USA"),
    "SEK=X": ("USD/SEK", "kronor per dollar"),
    "EURSEK=X": ("EUR/SEK", "kronor per euro"),
    "BZ=F": ("Brentolja", "dollar per fat"),
    "^TNX": ("USA 10 år", "amerikansk 10-årsränta, %"),
    "GC=F": ("Guld", "dollar per uns"),
}
CYCLICAL = {"industri", "material", "sallanskop", "finans"}
DEFENSIVE = {"halsovard", "dagligvaror", "telekom"}
THEMES = [
    ("räntor och inflation", r"ränt|riksbank|inflation|kpi|fed\b|ecb|styrränt"),
    ("handel och tullar", r"tull|handelskrig|handelsavtal|export"),
    ("olja och energi", r"olj|energi|elpris|gas"),
    ("geopolitik", r"krig|ukraina|ryssland|israel|iran|kina|taiwan|sanktion|nato"),
    ("bolagsrapporter", r"rapport|kvartal|delårs|vinst|resultat|guidning|prognos"),
    ("AI och teknik", r"\bai\b|artificiell|chip|halvledar|nvidia|tech"),
    ("bostäder och fastigheter", r"bostad|fastighet|huspris"),
]
PERIODS = {"day": (1, "dagen", "idag"), "week": (5, "veckan", "den här veckan"), "month": (21, "månaden", "den senaste månaden")}
SING = {"day": "dag", "week": "vecka", "month": "månad"}


def load_macro() -> pd.DataFrame:
    path = DATA_DIR / "macro.csv"
    try:
        import yfinance as yf
        d = yf.download(list(MACRO), period="15y", interval="1d", auto_adjust=True, progress=False)["Close"]
        d = d.dropna(how="all")
        if len(d) > 200:
            d.round(5).to_csv(path)
            return d
    except Exception as e:  # noqa: BLE001
        print(f"makrodata kunde inte hämtas ({e}) – använder sparad fil")
    return pd.read_csv(path, index_col=0, parse_dates=True) if path.exists() else pd.DataFrame()


def update_archive(news: dict) -> list[dict]:
    """Sparar börs-/makrorubriker över tid (Google News ger bara de senaste) så att vecka/månad får underlag."""
    path = DATA_DIR / "news_archive.json"
    arch = json.loads(path.read_text()) if path.exists() else []
    seen = {a["title"].lower()[:70] for a in arch}
    for k in ("borsen", "makro"):
        for it in news.get("market", {}).get(k, []):
            key = it["title"].lower()[:70]
            if key not in seen:
                arch.append({"t": it["t"], "title": it["title"], "source": it["source"], "url": it["url"], "kind": k})
                seen.add(key)
    cutoff = (datetime.now(STO) - timedelta(days=120)).isoformat()
    arch = sorted((a for a in arch if a["t"] >= cutoff[:16]), key=lambda a: a["t"], reverse=True)
    path.write_text(json.dumps(arch, ensure_ascii=False, indent=0))
    return arch


def in_window(items: list[dict], start: pd.Timestamp, end: pd.Timestamp) -> list[dict]:
    s = datetime.combine((start + timedelta(days=0)).date(), datetime.min.time()).replace(hour=17, minute=30, tzinfo=STO)
    e = datetime.combine(end.date(), datetime.min.time()).replace(hour=23, minute=59, tzinfo=STO)
    out = []
    for it in items:
        ts = datetime.fromisoformat(it["t"]).astimezone(STO)
        if s <= ts <= e:
            out.append(it)
    return out


def base_rates(idx: pd.Series, n: int, cur: float) -> dict:
    """Historiska utfall: efter perioder (n dagar) med liknande avkastning, hur gick nästa n dagar?
    'Liknande' = samma kvintil av alla historiska n-dagarsavkastningar. Överlappande fönster (steg 1)."""
    r = idx.pct_change(n)
    fwd = idx.shift(-n) / idx - 1
    df = pd.DataFrame({"r": r, "f": fwd}).dropna()
    q = df["r"].quantile([0.2, 0.4, 0.6, 0.8]).values
    bucket = int(np.searchsorted(q, cur))
    lo = -np.inf if bucket == 0 else q[bucket - 1]
    hi = np.inf if bucket == 4 else q[bucket]
    sub = df[(df["r"] > lo) & (df["r"] <= hi)]
    return {
        "n": int(len(sub)), "bucket": bucket,
        "hit": float((sub["f"] > 0).mean()), "median": float(sub["f"].median()),
        "p10": float(sub["f"].quantile(0.1)), "p90": float(sub["f"].quantile(0.9)),
        "allHit": float((df["f"] > 0).mean()), "allMedian": float(df["f"].median()),
    }


def vol_persistence(idx: pd.Series) -> dict:
    """Hur mycket av dagens 21-dagarsvolatilitet ligger kvar nästa 21 dagar? (volatilitetskluster)"""
    lr = np.log(idx).diff()
    v = lr.rolling(21).std() * np.sqrt(252)
    nxt = v.shift(-21)
    df = pd.DataFrame({"v": v, "n": nxt}).dropna()
    cur = float(v.iloc[-1])
    q = df["v"].quantile([0.2, 0.4, 0.6, 0.8]).values
    b = int(np.searchsorted(q, cur))
    lo = -np.inf if b == 0 else q[b - 1]
    hi = np.inf if b == 4 else q[b]
    sub = df[(df["v"] > lo) & (df["v"] <= hi)]
    return {"cur": cur, "median": float(v.iloc[-252:].median()), "longMedian": float(df["v"].median()),
            "nextMedian": float(sub["n"].median()), "pct": float((v.iloc[-252 * 5:] < cur).mean())}


def avg_corr(ret: pd.DataFrame, end: int, L: int = 21) -> float:
    c = ret.iloc[end - L + 1:end + 1].dropna(axis=1).corr().values
    n = c.shape[0]
    return float((c.sum() - n) / (n * (n - 1)))


def calendar_notes(day: pd.Timestamp, horizon: str) -> list[str]:
    m = day.month
    out = []
    nxt = (day + timedelta(days=30 if horizon != "day" else 7))
    months = {m, nxt.month}
    if months & {1, 2}:
        out.append("**Rapportsäsong för helåret** (slutet av januari–februari): många bolag rapporterar och ger utdelningsförslag – enskilda aktier kan röra sig mycket.")
    if months & {4, 5}:
        out.append("**Utdelningssäsong** (april–maj): när aktier handlas utan utdelning sjunker kursen med utdelningen. OMXS30 räknas utan utdelningar och ser därför svagare ut än vad ägarna fått.")
    if months & {7}:
        out.append("**Rapportsäsong för andra kvartalet** (mitten–slutet av juli), ofta med tunn handel under semestern.")
    if months & {10, 11} and not (m == 11 and day.day > 10):
        out.append("**Rapportsäsong för tredje kvartalet** (mitten av oktober–början av november): bolagens besked om framtiden brukar väga tyngre än själva siffrorna.")
    if months & {12}:
        out.append("**December**: Nasdaq ser över vilka bolag som ingår i OMXS30, och många fonder ombalanserar inför årsskiftet.")
    return out


def nr(x: dict) -> str:
    return f"{x['name']} ({pct(x['ret'])})"


def make_period(key: str, ctx: dict) -> dict:
    n, noun, when = PERIODS[key]
    sing = SING[key]
    close, ret, names, sector_of, sector_name, mcap, macro, arch, items, bench, day = (
        ctx[k] for k in ("close", "ret", "names", "sector_of", "sector_name", "mcap", "macro", "arch", "items", "bench", "day"))
    stocks = [t for t in names if t in close.columns]
    last = len(close) - 1
    s = last - n
    start_day = close.index[s]
    idx = close[bench]
    R = float(idx.iloc[-1] / idx.iloc[s] - 1)
    sd_d = float(ret[bench].iloc[-253:-1].std())
    sigma_p = sd_d * np.sqrt(n)
    z = R / sigma_p if sigma_p > 0 else 0.0
    sr = {t: float(close[t].iloc[-1] / close[t].iloc[s] - 1) for t in stocks if pd.notna(close[t].iloc[s]) and pd.notna(close[t].iloc[-1])}
    up = sum(1 for v in sr.values() if v > 0)
    tot = len(sr)
    w = {t: mcap.get(t, 1.0) for t in sr}
    W = sum(w.values())
    contrib = sorted(({"ticker": t, "name": names[t], "ret": sr[t], "c": w[t] / W * sr[t]} for t in sr), key=lambda x: x["c"])
    ranked = sorted(sr.items(), key=lambda kv: kv[1], reverse=True)
    best = [{"ticker": t, "name": names[t], "ret": v} for t, v in ranked[:3]]
    worst = [{"ticker": t, "name": names[t], "ret": v} for t, v in ranked[-3:][::-1]]
    secs: dict[str, list[tuple[float, float]]] = {}
    for t, v in sr.items():
        secs.setdefault(sector_of[t], []).append((v, w[t]))
    sec_ret = {k: sum(v * ww for v, ww in xs) / sum(ww for _, ww in xs) for k, xs in secs.items()}
    sec_sorted = sorted(sec_ret.items(), key=lambda kv: kv[1], reverse=True)
    cyc = np.mean([v for k, v in sec_ret.items() if k in CYCLICAL])
    dfn = np.mean([v for k, v in sec_ret.items() if k in DEFENSIVE])
    top_share = abs(sum(x["c"] for x in (contrib[-3:] if R >= 0 else contrib[:3]))) / max(1e-9, abs(sum(x["c"] for x in contrib)))

    # volatilitet, korrelation, nedgång från topp
    vp = vol_persistence(idx)
    corr_now = avg_corr(ret[stocks], last, 21)
    corr_hist = [avg_corr(ret[stocks], e, 21) for e in range(last - 252, last, 10)]
    corr_pct = float(np.mean([c < corr_now for c in corr_hist]))
    high52 = float(idx.iloc[-252:].max())
    dd = float(idx.iloc[-1] / high52 - 1)

    # omvärlden: för "dagen" används gårdagens amerikanska handel (som påverkar Stockholms öppning)
    glob = []
    if not macro.empty:
        mac = macro[macro.index <= day]
        for tk, (label, desc) in MACRO.items():
            if tk not in mac.columns:
                continue
            ser = mac[tk].dropna()
            if key == "day" and tk in ("^GSPC", "^VIX", "^TNX"):
                ser = ser[ser.index < day]
            ser_p = ser[ser.index <= day]
            if key == "day":
                if len(ser_p) < 2:
                    continue
                a, b = float(ser_p.iloc[-2]), float(ser_p.iloc[-1])
            else:
                base = ser_p[ser_p.index <= start_day]
                if len(base) == 0 or len(ser_p) == 0:
                    continue
                a, b = float(base.iloc[-1]), float(ser_p.iloc[-1])
            chg = (b - a) if tk == "^TNX" else (b / a - 1)
            glob.append({"ticker": tk, "label": label, "desc": desc, "level": b, "chg": chg, "isRate": tk == "^TNX"})
    g = {x["ticker"]: x for x in glob}

    # nyheter i perioden
    news_m = in_window(arch, start_day, day)
    themes = []
    blob = " ".join(x["title"].lower() for x in news_m)
    for label, rx in THEMES:
        k = len(re.findall(rx, blob))
        if k >= 2:
            themes.append((label, k))
    themes.sort(key=lambda x: -x[1])
    mover_news = []
    for m in (best[:2] + worst[:2]):
        its = in_window(items.get(m["ticker"], []), start_day, day)
        if its:
            mover_news.append({"name": m["name"], "ret": m["ret"], "title": its[0]["title"], "source": its[0]["source"], "url": its[0]["url"]})

    # ── texter ──
    verb = "steg" if R > 0.002 else "föll" if R < -0.002 else "stod nästan still"
    size = ("ovanligt mycket" if abs(z) >= 2 else "lite mer än vanligt" if abs(z) >= 1 else "inom det normala")
    period_txt = swe_date(day) if key == "day" else f"{start_day.day} {MONTHS[start_day.month - 1]}–{day.day} {MONTHS[day.month - 1]}"
    headline = f"OMXS30 {verb} {pct(R, 1, False) if verb != 'stod nästan still' else ''} {when}".replace("  ", " ").strip()
    if abs(R) > 0.002:
        lead = sec_sorted[0] if R >= 0 else sec_sorted[-1]
        headline += f" – {sector_name[lead[0]].lower()} {'ledde' if R >= 0 else 'tyngde mest'}"

    vad = (f"[[index|OMXS30]] {verb} {pct(R, 1, False) if abs(R) > 0.002 else ''} {when} ({period_txt}) och står på {num(float(idx.iloc[-1]), 0)} punkter. "
           f"En vanlig {sing} rör sig index ungefär ±{pct(sigma_p, 1, False)}, så rörelsen var {size} ({num(abs(z), 1)} [[sigma-move|standardavvikelser]]). "
           f"**{up} av {tot}** aktier gick upp. Bäst gick {', '.join(nr(b) for b in best)}; "
           f"sämst {', '.join(nr(b) for b in worst)}.").replace("  ", " ")
    vad_ex = ("Index är ett snitt av de 30 största bolagen, där stora bolag väger mer. "
              "Att jämföra med en \"vanlig\" period visar om något särskilt hände eller om det bara var normalt brus. "
              "Under 1 standardavvikelse är vardag – det händer ungefär två gånger av tre.")

    # varför
    why = []
    lead_c = contrib[-3:][::-1] if R >= 0 else contrib[:3]
    pts = sum(c["c"] for c in lead_c)
    rest = R - pts
    why.append(f"**Största bidragen till indexet** kom från {', '.join(nr(c) for c in lead_c)}. De tre flyttade index ungefär "
               f"{num(pts * 100, 2)} procentenheter av totalt {num(R * 100, 2)}"
               + (f" – övriga bolag drog tillsammans åt andra hållet ({'+' if rest > 0 else ''}{num(rest * 100, 2)})." if np.sign(rest) != np.sign(pts) and abs(rest) > 0.0005 else ".")
               + " Stora bolag väger tyngst i indexet.")
    why.append(f"**Sektorer:** bäst gick {sector_name[sec_sorted[0][0]].lower()} ({pct(sec_sorted[0][1])}), sämst {sector_name[sec_sorted[-1][0]].lower()} ({pct(sec_sorted[-1][1])}).")
    spread = cyc - dfn
    if abs(spread) > (0.004 if key == "day" else 0.01):
        why.append(f"**Riskaptit:** konjunkturkänsliga sektorer (industri, råvaror, banker) gick {'bättre' if spread > 0 else 'sämre'} än defensiva (hälsovård, dagligvaror, telekom) med "
                   f"{num(abs(spread) * 100, 1)} procentenheter. Det mönstret brukar betyda att investerarna {'vågar ta mer risk' if spread > 0 else 'söker trygghet'}.")
    om = []
    if "^GSPC" in g:
        om.append(f"S&P 500 {pct(g['^GSPC']['chg'])}" + (" (gårdagens handel i USA)" if key == "day" else ""))
    if "^STOXX50E" in g:
        om.append(f"Euro Stoxx 50 {pct(g['^STOXX50E']['chg'])}")
    if "SEK=X" in g:
        c = g["SEK=X"]["chg"]
        om.append(f"dollarn {'steg' if c > 0 else 'föll'} {pct(abs(c), 1, False)} mot kronan ({'svagare' if c > 0 else 'starkare'} krona)")
    if "BZ=F" in g:
        om.append(f"oljan {pct(g['BZ=F']['chg'])}")
    if "^TNX" in g:
        om.append(f"USA:s 10-årsränta {'+' if g['^TNX']['chg'] >= 0 else '−'}{num(abs(g['^TNX']['chg']) * 100, 0)} punkter")
    if om:
        why.append("**Omvärlden** samma period: " + ", ".join(om) + ".")
    if themes:
        why.append("**Teman i nyheterna:** " + ", ".join(t for t, _ in themes[:3]) + ".")
    for mn in mover_news[:2]:
        why.append(f"{mn['name']} ({pct(mn['ret'])}) – i nyheterna under perioden: ”{mn['title']}” ({mn['source']}).")
    why_ex = ("Börsen rör sig av många skäl samtidigt, och ingen vet exakt varför. Här visas det som syns i datan: vilka bolag som "
              "flyttade index mest, vilka branscher som drog och vad som hände i omvärlden. Nyheter visas som \"i nyheterna\" – "
              "att två saker händer samtidigt betyder inte att den ena orsakade den andra.")

    # problem / fördelar
    prob: list[tuple[float, str]] = []
    good: list[tuple[float, str]] = []
    breadth = up / max(tot, 1)
    if R > 0 and breadth < 0.5:
        prob.append((3, f"**Smal uppgång:** index steg men bara {up} av {tot} aktier gick upp. När få stora bolag bär uppgången är den mer sårbar."))
    if top_share > 0.6 and abs(R) > 0.005:
        prob.append((2, "**Koncentration:** tre bolag stod för " + ("mer än hela indexets rörelse" if top_share > 1 else f"ungefär {round(top_share * 100)} % av rörelsen") + ". Indexet säger då mindre om hur börsen i stort gick."))
    if R < -0.002:
        prob.append((2.5, f"**Nedgång:** den som ägde en indexfond förlorade ungefär {pct(abs(R), 1, False)} {when} (före utdelningar)."))
    if vp["pct"] > 0.7:
        prob.append((3, f"**Större svängningar än vanligt:** indexets [[volatility|volatilitet]] senaste månaden motsvarar {pct(vp['cur'], 0, False)} per år, högre än {round(vp['pct'] * 100)} % av dagarna de senaste fem åren. [[vol-clustering|Oro brukar komma i vågor]]."))
    if corr_pct > 0.75:
        prob.append((2.5, f"**Allt rör sig ihop:** [[avg-correlation|snittkorrelationen]] är {num(corr_now, 2)}, högre än {round(corr_pct * 100)} % av året. Då hjälper det mindre att sprida pengarna på många aktier."))
    if dd < -0.1:
        prob.append((2, f"**Långt från toppen:** index ligger {pct(abs(dd), 1, False)} under sin högsta nivå det senaste året."))
    if "SEK=X" in g and g["SEK=X"]["chg"] < -(0.005 if key == "day" else 0.015):
        prob.append((1.5, "**Starkare krona:** exportbolag som säljer i dollar och euro får mindre kvar räknat i kronor. Många OMXS30-bolag är stora exportörer."))
    if "BZ=F" in g and g["BZ=F"]["chg"] > (0.03 if key == "day" else 0.08):
        prob.append((1.5, f"**Dyrare olja** ({pct(g['BZ=F']['chg'])}): höjer kostnader för industri och transporter och kan hålla uppe inflationen – och därmed räntorna."))
    if "^TNX" in g and g["^TNX"]["chg"] > (0.08 if key == "day" else 0.2):
        prob.append((1.5, "**Stigande räntor i USA:** högre ränta gör framtida vinster mindre värda idag ([[dcf|diskontering]]) och brukar pressa tillväxtbolag mest."))
    if "^VIX" in g and g["^VIX"]["level"] > 25:
        prob.append((2, f"**Oro i USA:** VIX står på {num(g['^VIX']['level'], 1)} (normalt runt 15–20). Marknaden räknar med stora svängningar framöver."))
    if R > 2.5 * sigma_p:
        prob.append((1, "**Snabb uppgång:** efter kraftiga rörelser är det vanligt med rekyler. Mycket goda nyheter kan redan vara inräknade i priset."))

    if breadth >= 0.65 and R > 0:
        good.append((3, f"**Bred uppgång:** {up} av {tot} aktier steg – det är inte bara några få bolag som drar."))
    if vp["pct"] < 0.35:
        good.append((2, f"**Lugnt:** svängningarna är mindre än vanligt ({pct(vp['cur'], 0, False)} per år), vilket gör det lättare att sitta still."))
    if corr_pct < 0.35:
        good.append((2.5, f"**Aktierna går isär:** låg [[avg-correlation|snittkorrelation]] ({num(corr_now, 2)}) betyder att det spelar roll *vilka* bolag man äger – bra för aktieval och för [[spread|parstrategier]]."))
    if dd > -0.03:
        good.append((2, f"**Nära toppen:** index är bara {pct(abs(dd), 1, False)} från sin högsta nivå det senaste året."))
    if "SEK=X" in g and g["SEK=X"]["chg"] > (0.005 if key == "day" else 0.015):
        good.append((1.5, "**Svagare krona:** exportbolagens intäkter i dollar och euro blir fler kronor, vilket lyfter vinsterna räknat i SEK."))
    if "BZ=F" in g and g["BZ=F"]["chg"] < -(0.03 if key == "day" else 0.08):
        good.append((1.5, f"**Billigare olja** ({pct(g['BZ=F']['chg'])}): lägre kostnader för industri och transporter, och mindre tryck på inflationen."))
    if "^TNX" in g and g["^TNX"]["chg"] < -(0.08 if key == "day" else 0.2):
        good.append((1.5, "**Fallande räntor i USA:** gör framtida vinster mer värda idag och brukar gynna aktier, särskilt tillväxtbolag."))
    if R < -0.002 and dfn > 0:
        good.append((2, "**Defensiva bolag höll emot:** hälsovård, dagligvaror och telekom steg fast index föll – ett exempel på att [[diversification|spridning]] fungerar."))
    if R < -0.01:
        good.append((1, "**Lägre priser:** för den som sparar varje månad betyder en nedgång att man får fler aktier för pengarna."))
    if "^VIX" in g and g["^VIX"]["level"] < 16:
        good.append((1, f"**Lugn i USA:** VIX står på {num(g['^VIX']['level'], 1)} – låg förväntad oro."))
    if R > 0.002 and not any("Bred" in t for _, t in good):
        good.append((1, f"**Uppgång:** den som ägde en indexfond tjänade ungefär {pct(R, 1, False)} {when}."))
    fallback_p = "**Ingenting sticker ut som särskilt oroande** i datan just nu – men lugna perioder kan ta slut snabbt."
    fallback_g = "**Inga tydliga ljuspunkter** sticker ut i datan – perioden var mest normal."
    prob_b = [t for _, t in sorted(prob, key=lambda x: -x[0])[:4]] or [fallback_p]
    good_b = [t for _, t in sorted(good, key=lambda x: -x[0])[:4]] or [fallback_g]

    # framtidspaning
    br = base_rates(idx.dropna(), n, R)
    bucket_txt = ["mycket svag", "svag", "normal", "stark", "mycket stark"][br["bucket"]]
    diff = br["hit"] - br["allHit"]
    fut = []
    fut.append(f"**Vad historiken säger:** sedan 2010 har {noun} efter en {bucket_txt} {sing} ({br['n']} tillfällen) slutat plus i "
               f"**{round(br['hit'] * 100)} %** av fallen, med en mittenavkastning på {pct(br['median'])}. Det kan jämföras med {round(br['allHit'] * 100)} % och {pct(br['allMedian'])} för alla perioder. "
               + ("Skillnaden är liten – **historiken ger ingen tydlig riktning**." if abs(diff) < 0.05 else
                  f"Det är {'något bättre' if diff > 0 else 'något sämre'} än vanligt, men spridningen är stor: i 8 fall av 10 hamnade utfallet mellan {pct(br['p10'])} och {pct(br['p90'])}."))
    vol_txt = ("högre än normalt" if vp["cur"] > vp["longMedian"] * 1.15 else "lägre än normalt" if vp["cur"] < vp["longMedian"] * 0.85 else "ungefär normala")
    fut.append(f"**Svängningar:** de senaste veckornas svängningar är {vol_txt}. Volatilitet är trögrörlig: när den legat på den här nivån har den nästa månad i snitt legat runt "
               f"{pct(vp['nextMedian'], 0, False)} per år (normalt {pct(vp['longMedian'], 0, False)}). Det säger något om *hur mycket* börsen kan röra sig – inte åt vilket håll.")
    watch = []
    if themes:
        watch.append(f"nyheter om {themes[0][0]}")
    if "SEK=X" in g:
        watch.append("kronans utveckling (viktigt för exportbolagen)")
    if "^TNX" in g:
        watch.append("räntorna i USA och besked från Riksbanken")
    if watch:
        fut.append("**Att hålla koll på:** " + ", ".join(watch) + ".")
    fut += calendar_notes(day, key)
    fut.append("*Det här är ingen prognos och inget investeringsråd. Ingen kan förutsäga börsen på kort sikt – historiska mönster är svaga och kan sluta gälla.*")
    fut_ex = ("En nyanserad framtidspaning tittar på hur det brukar gå efter liknande perioder (basfrekvenser), "
              "på att svängningar kommer i vågor och på kända händelser i kalendern. Det ger en känsla för vad som är normalt – "
              "inte ett svar på om börsen går upp eller ner.")

    return {
        "label": noun.capitalize(), "from": start_day.strftime("%Y-%m-%d"), "to": day.strftime("%Y-%m-%d"), "days": n,
        "headline": headline,
        "stats": {"ret": R, "z": z, "sigma": sigma_p, "up": up, "total": tot, "vol": vp["cur"], "volPct": vp["pct"],
                  "corr": corr_now, "corrPct": corr_pct, "drawdown": dd, "cycMinusDef": float(spread)},
        "contrib": [{"ticker": c["ticker"], "name": c["name"], "ret": c["ret"], "c": c["c"]} for c in contrib],
        "sectors": [{"id": k, "name": sector_name[k], "ret": v} for k, v in sec_sorted],
        "global": glob,
        "baseRates": br,
        "news": news_m[:5],
        "sections": [
            {"id": "vad", "title": "Vad hände?", "text": vad, "explain": vad_ex},
            {"id": "varfor", "title": "Varför?", "bullets": why, "explain": why_ex},
            {"id": "problem", "title": "Problem och risker", "bullets": prob_b,
             "explain": "Det här är saker i datan som kan vara svagheter eller risker. Det betyder inte att börsen kommer att falla – bara att det finns mer att vara uppmärksam på."},
            {"id": "fordelar", "title": "Det som ser bra ut", "bullets": good_b,
             "explain": "Ljuspunkter i datan. Precis som riskerna säger de något om läget just nu, inte om vad som händer i morgon."},
            {"id": "framtid", "title": "Framtidspaning", "bullets": fut, "explain": fut_ex},
        ],
    }


def main() -> None:
    uni = load_universe()
    bench = uni["benchmark"]["ticker"]
    names = {s["ticker"]: s["name"] for s in uni["stocks"]}
    sector_of = {s["ticker"]: s["sector"] for s in uni["stocks"]}
    df = pd.read_csv(DATA_DIR / "prices.csv", parse_dates=["date"])
    close = df.pivot(index="date", columns="ticker", values="close").sort_index()
    ret = close.pct_change(fill_method=None)
    fpath = WEB_DATA / "fundamentals.json"
    fund = json.loads(fpath.read_text())["items"] if fpath.exists() else {}
    mcap = {t: float(v["marketCap"]) for t, v in fund.items() if v.get("marketCap")}
    news = json.loads((WEB_DATA / "news.json").read_text()) if (WEB_DATA / "news.json").exists() else {"items": {}, "market": {}}
    arch = update_archive(news)
    macro = load_macro()
    ctx = dict(close=close, ret=ret, names=names, sector_of=sector_of, sector_name=uni["sectors"], mcap=mcap,
               macro=macro, arch=arch, items=news.get("items", {}), bench=bench, day=close.index[-1])
    out = {"date": close.index[-1].strftime("%Y-%m-%d"), "generatedAt": datetime.now(STO).isoformat(timespec="minutes"),
           "periods": {k: make_period(k, ctx) for k in PERIODS}}
    (WEB_DATA / "briefing.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for k, p in out["periods"].items():
        print(f"briefing {k}: {p['headline']}")


if __name__ == "__main__":
    main()
