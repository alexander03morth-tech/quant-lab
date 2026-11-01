# Quant Lab

En pedagogisk plattform för att lära sig kvantitativ finans, portföljteori och private equity, med riktig data från Stockholmsbörsen. Allt på svenska, och varje mått, graf och modell har en ⓘ-knapp som förklarar vad det är, varför det spelar roll, hur man tolkar det, formeln, ett räkneexempel och vanliga fallgropar.

> Utbildningsverktyg – inte investeringsrådgivning.

## Innehåll

| Del | Vad man gör |
|---|---|
| **Börsen idag** | Automatisk börssammanfattning med förklaringar, värmekarta, nyheter med kursreaktion |
| **Portföljlabb** | Bygg och spara portföljer, risk, drawdown, riskbidrag, effektiva fronten och Monte Carlo i 3D |
| **Paranalys** | Samintegration (Engle-Granger, Johansen), Kalmanfilter, z-score-signaler, 3D-labb |
| **Private equity** | PE-nyheter, LBO-modell på exempelbolag eller eget bolag, fondekonomi (J-kurva, carry) |
| **Ordlista** | Alla begrepp med vardagsliknelse och räkneexempel |

## Struktur

```
config/          universe.yaml (OMXS30-listan, nyhetssökningar), corrections.yaml (rättelser av Yahoo-data)
pipeline/        Python: fetch → precompute → news → market_summary → fundamentals
  stats/         egna implementationer (half-life, Hurst, Kalman) – testade mot statsmodels/pykalman
  tests/         pytest
  tools/         genererar MacKinnon-tabeller och golden-filer för TypeScript-testerna
data/            rådata (prices.csv) och kvalitetsrapport
web/             React + Vite + TypeScript, Plotly, KaTeX
  public/data/   JSON som pipelinen skriver: prices, pairs, meta, news, summary, fundamentals
  src/lib/stats  ADF, Engle-Granger, Johansen, Kalman, OU, backtest, nyckeltal (Vitest mot statsmodels)
  src/lib/pe     LBO- och fondmodell
  src/explain    förklaringslagret (begrepp, liknelser, räkneexempel)
.github/workflows/update.yml   daglig uppdatering + deploy till GitHub Pages
```

## Köra lokalt

```bash
# Data (Python 3.9+)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
PYTHON=.venv/bin/python bash pipeline/update.sh     # ~3 min: kurser, 435 par, nyheter, nyckeltal
.venv/bin/python -m pytest pipeline/tests

# Webb (Node 20+)
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # 50+ tester, bl.a. ADF/EG/Johansen/Kalman mot statsmodels
npm run build
```

## Så uppdateras datan

GitHub Action `update.yml` körs varje vardag 16:45 UTC (17:45/18:45 svensk tid, efter börsens stängning 17:30):

1. Python-testerna körs.
2. `pipeline/update.sh` hämtar kurser (yfinance), rättar kända Yahoo-fel, räknar samintegration för alla 435 par, hämtar nyheter (Google News, filtrerade på seriösa källor) och nyckeltal, och skriver börssammanfattningen.
3. Ny data committas till repot.
4. Webben testas, byggs och publiceras på GitHub Pages.

Tunga beräkningar (alla par, stabilitet, q-värden) görs i Python vid uppdateringen. Allt användaren ändrar interaktivt räknas i webbläsaren. Tiden för senaste uppdatering visas alltid i menyn.

Går en nyhets- eller nyckeltalshämtning fel behålls gårdagens data – kursdatan stoppar däremot körningen hellre än att skriva över bra data med trasig.

## Begränsningar

- **Survivorship bias:** dagens OMXS30-lista används bakåt i tiden.
- **Yahoo-data** har fel ibland; kända fel rättas i `config/corrections.yaml` och okända hopp > 20 % visas som varningar.
- **Blankning** kostar (lån + utdelningar); backtesten räknar med en schablon.
- **LBO-exempelbolagen är påhittade** med branschtypiska siffror. Nyhetsrubriker visas aldrig som orsak till en kursrörelse.
- Riskfri ränta antas vara 0 i Sharpe-kvoter.

## Ändra indexlistan

Redigera `config/universe.yaml` (ticker, namn, sektor och nyhetssökning) och kör pipelinen. Nasdaq ser över OMXS30 i juni och december.
