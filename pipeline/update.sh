#!/usr/bin/env bash
# Hela datauppdateringen: hämta → rensa → tunga beräkningar. Körs lokalt och av GitHub Action.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PYTHON:-python}
$PY pipeline/fetch.py
$PY pipeline/precompute.py
