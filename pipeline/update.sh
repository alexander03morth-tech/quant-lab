#!/usr/bin/env bash
# Hela datauppdateringen: hämta → rensa → tunga beräkningar. Körs lokalt och av GitHub Action.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PYTHON:-python}
$PY pipeline/fetch.py
$PY pipeline/precompute.py
# Nyheter får aldrig stoppa datauppdateringen
$PY pipeline/news.py || echo "nyhetshämtning misslyckades – fortsätter"
$PY pipeline/market_summary.py
$PY pipeline/fundamentals.py || echo "nyckeltal misslyckades – behåller gårdagens"
# "Det här behöver du veta" (dag/vecka/månad). Hämtar global marknadsdata; får aldrig stoppa uppdateringen
$PY pipeline/briefing.py || echo "briefing misslyckades – behåller gårdagens"
