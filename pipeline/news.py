"""Hämtar nyhetsrubriker per aktie från Google News RSS (svenska) och skriver web/public/data/news.json.

Vi sparar bara rubrik, källa, tid och länk – inte artikeltext. Sökfrågan per bolag står i
config/universe.yaml (fältet news) så att namnkrockar kan uteslutas (Volvo Cars ≠ AB Volvo).
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import WEB_DATA, load_universe  # noqa: E402

MAX_PER_STOCK = 15
MAX_AGE_DAYS = 45

# Seriösa affärs- och nyhetskällor prioriteras. Övriga tas bara med om det finns för få träffar.
TRUSTED = [
    "Dagens industri", "DI", "Di.se", "Placera.se", "Placera", "Affärsvärlden", "Börsvärlden", "EFN", "Finwire",
    "Svenska Dagbladet", "SvD", "Dagens Nyheter", "DN", "SVT Nyheter", "Sveriges Radio", "Omni", "Omni Ekonomi",
    "Realtid", "Dagens PS", "Privata Affärer", "Finanstid", "Cision News", "MFN", "Ny Teknik", "Reuters",
    "Bloomberg", "Financial Times", "Nyteknik", "Breakit", "Aktiespararna", "Fastighetsvärlden", "Byggvärlden",
    "Expressen", "Aftonbladet", "TT", "Göteborgs-Posten",
]
BLOCK = re.compile(r"casino|spelpaus|esports|bonus|odds|ledare|aktiekurs|•", re.I)
ALIASES = {"AZN.ST": ["astra"], "HM-B.ST": ["hennes"], "SHB-A.ST": ["handelsbanken"], "VOLV-B.ST": ["volvo"]}


def keywords(stock: dict) -> list[str]:
    """Rubriken måste nämna bolaget – annars är träffen oftast en allmän börsartikel."""
    first = re.sub(r"\s+[ABC]$", "", stock["name"]).split()[0].lower()
    return [first] + ALIASES.get(stock["ticker"], [])

# Private equity: affärer, bud och fonder i Norden
PE_QUERIES = {
    "firmor": '"Nordic Capital" OR Triton OR Altor OR "IK Partners" OR "Summa Equity" OR Adelis OR Verdane OR Litorina OR "FSN Capital" OR Ratos',
    "eqt": '"EQT" (förvärv OR köper OR exit OR fond OR säljer OR bud)',
    "bud": 'uppköpserbjudande OR budpremie OR "lägger bud" OR "offentligt bud" OR "avnoteras"',
    "pe": '"private equity" OR riskkapitalbolag OR "riskkapitalbolaget"',
}
PE_CATEGORIES = [
    ("bud", r"bud|uppköpserbjudande|budpremie|avnoter|take.private|accepter"),
    ("forvarv", r"förvärv|köper|köp av|tar över|förvärvar"),
    ("exit", r"exit|säljer|avyttr|börsnoter|notering|ipo"),
    ("fond", r"fond|reser|kapital(?:et)?\s+till|miljarder till|dry powder"),
]


def pe_category(title: str) -> str:
    for cat, rx in PE_CATEGORIES:
        if re.search(rx, title, re.I):
            return cat
    return "ovrigt"


MARKET_QUERIES = {
    "borsen": '"Stockholmsbörsen" OR "OMXS30" OR "Stockholmsbörsen idag"',
    "makro": 'Riksbanken OR inflationen OR styrräntan OR kronan',
}


def trusted(source: str) -> bool:
    s = source.lower().strip()
    return any(s == t.lower() or s.startswith(t.lower() + " ") for t in TRUSTED)


PE_RELEVANT = re.compile(
    r"private equity|riskkapital|buyout|uppköp|budpremie|\bbud\b|budet|avnoter|förvärv|exit|"
    r"EQT|Nordic Capital|Triton|Altor|IK Partners|Summa Equity|Adelis|Verdane|Litorina|FSN|Ratos|KKR|Blackstone|Bain Capital|Carlyle|CVC|Cinven|Permira",
    re.I)


def fetch(query: str) -> list[dict]:
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": f"{query} when:{MAX_AGE_DAYS}d", "hl": "sv", "gl": "SE", "ceid": "SE:sv"})
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (QuantLab news fetcher)"})
    xml = urllib.request.urlopen(req, timeout=30).read()
    out, seen = [], set()
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    for it in ET.fromstring(xml).findall(".//item"):
        source = (it.findtext("source") or "").strip()
        title = (it.findtext("title") or "").strip()
        # Google lägger till " - Källa" i slutet av rubriken
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3].strip()
        key = re.sub(r"\W+", "", title.lower())[:80]
        if not title or key in seen:
            continue
        try:
            ts = parsedate_to_datetime(it.findtext("pubDate"))
        except Exception:
            continue
        if ts < cutoff or BLOCK.search(title) or BLOCK.search(source):
            continue
        seen.add(key)
        out.append({"t": ts.astimezone(timezone.utc).isoformat(timespec="minutes"), "title": title,
                    "source": source, "url": it.findtext("link")})
    out.sort(key=lambda x: x["t"], reverse=True)
    good = [o for o in out if trusted(o["source"])]
    rest = [o for o in out if not trusted(o["source"])]
    picked = good if len(good) >= 5 else good + rest[: 5 - len(good)]
    picked.sort(key=lambda x: x["t"], reverse=True)
    return picked[:MAX_PER_STOCK]


def main() -> None:
    uni = load_universe()
    dst = WEB_DATA / "news.json"
    old = json.loads(dst.read_text()) if dst.exists() else {"items": {}}
    items, failed = {}, []
    for s in uni["stocks"]:
        q = s.get("news") or f'"{s["name"]}"'
        try:
            kw = keywords(s)
            items[s["ticker"]] = [it for it in fetch(q) if any(k in it["title"].lower() for k in kw)][:MAX_PER_STOCK]
        except Exception as e:  # behåll gårdagens nyheter om en hämtning misslyckas
            failed.append(s["ticker"])
            items[s["ticker"]] = old.get("items", {}).get(s["ticker"], [])
            print(f"VARNING {s['ticker']}: {e}", file=sys.stderr)
        time.sleep(0.8)
    market = {}
    for key, q in MARKET_QUERIES.items():
        try:
            market[key] = [m for m in fetch(q) if trusted(m["source"])][:20]
        except Exception as e:
            market[key] = old.get("market", {}).get(key, [])
            print(f"VARNING marknad {key}: {e}", file=sys.stderr)
        time.sleep(0.8)
    pe, seen_pe = [], set()
    for key, q in PE_QUERIES.items():
        try:
            for m in fetch(q):
                k = re.sub(r"\W+", "", m["title"].lower())[:70]
                if k in seen_pe or not trusted(m["source"]) or not PE_RELEVANT.search(m["title"]):
                    continue
                seen_pe.add(k)
                pe.append({**m, "cat": pe_category(m["title"])})
        except Exception as e:
            print(f"VARNING PE {key}: {e}", file=sys.stderr)
        time.sleep(0.8)
    pe.sort(key=lambda x: x["t"], reverse=True)
    if not pe:
        pe = old.get("pe", [])
    dst.write_text(json.dumps({"pe": pe[:60], "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                               "source": "Google News (sv)", "items": items, "market": market}, ensure_ascii=False, separators=(",", ":")))
    total = sum(len(v) for v in items.values())
    print(f"news.json: {total} rubriker för {len(items)} bolag" + (f", misslyckades: {failed}" if failed else ""))


if __name__ == "__main__":
    main()
