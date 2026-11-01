"""Genererar web/src/lib/stats/mackinnon.ts från statsmodels tabeller (så koefficienterna är identiska)."""
import json
from pathlib import Path
from statsmodels.tsa import adfvalues as av

out = {}
for reg in ["c", "n"]:
    out[reg] = {
        "max": [float(v) for v in av._tau_maxs[reg][:2]],
        "min": [float(v) for v in av._tau_mins[reg][:2]],
        "star": [float(v) for v in av._tau_stars[reg][:2]],
        "small": [[float(c) for c in av._tau_smallps[reg][i]] for i in range(2)],
        "large": [[float(c) for c in av._tau_largeps[reg][i]] for i in range(2)],
        "crit2010": [[[float(c) for c in row] for row in av.tau_2010s[reg][i]] for i in range(min(2, len(av.tau_2010s[reg])))],
    }
ts = (
    "// AUTOGENERERAD av pipeline/tools/gen_mackinnon_ts.py – ändra inte för hand.\n"
    "// MacKinnon (1994) p-värden och MacKinnon (2010) kritiska värden, från statsmodels.\n"
    "// Index 0 = N=1 (ADF), index 1 = N=2 (Engle-Granger med två serier).\n"
    f"export const MACKINNON = {json.dumps(out, indent=1)} as const;\n"
)
Path(__file__).resolve().parents[2].joinpath("web/src/lib/stats/mackinnon.ts").write_text(ts)
print("ok")
