# Project Acrux

**Observe Earth. Understand Space. Predict the Future.**

An integrated satellite-intelligence platform: Earth observation, wildfire and earthquake monitoring,
weather, satellite communication, GNSS positioning, astronomy and near-Earth objects, orbital debris, a 3D
satellite digital twin with simulated telemetry, multimodal analysis, an AI assistant and reports.
It runs **locally on your computer** (React + Vite + TypeScript + Tailwind frontend, Python FastAPI backend).
Nothing in it deploys, publishes or uploads anything.

> **Read this first — verification status.** This project was built in a sandbox with **no internet access**,
> so `npm install`, `pip install`, the Vite build, the dev server, a browser, and every live API were
> unavailable. Everything below is labelled by what was and was not actually executed. Expect to fix a few
> small first-run issues. See [Feature status](#feature-status).

## Quick start (Windows PowerShell)

Prerequisites: Python 3.11+, Node.js 18.18+ (20+ recommended), VS Code optional.

```powershell
cd project-acrux
.\scripts\setup.ps1            # venv + pip install + npm install + creates .env (all keys optional)
.\scripts\start-backend.ps1    # terminal 1 -> http://127.0.0.1:8000/docs
.\scripts\start-frontend.ps1   # terminal 2 -> open http://localhost:5173
```

Manual equivalent:

```powershell
cd backend ; python -m venv .venv ; .\.venv\Scripts\Activate.ps1 ; pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# second terminal
cd frontend ; npm install ; npm run dev
```

The top bar shows **Backend online** when the two halves are connected. Tests:
`.\scripts\run-tests.ps1` (or `pytest` in `backend`, `npm run typecheck` in `frontend`).

## Using VS Code

Open the `project-acrux` folder (**File → Open Folder…**) and accept the recommended extensions prompt. The
included `.vscode` folder adds: **Terminal → Run Task…** → `Acrux: Setup (one time)`, then `Acrux: Start both`
(starts backend and frontend in two terminal panels; also bound to `Ctrl+Shift+B`) and `Acrux: Run tests`
(`Acrux: Open in browser` opens the app). Under **Run and Debug** (`Ctrl+Shift+D`), `Acrux: Debug backend (FastAPI)`
lets you set breakpoints in Python, and `Acrux: Full stack` also opens Chrome. Select the interpreter once with
`Ctrl+Shift+P` → *Python: Select Interpreter* → `backend\.venv\Scripts\python.exe`. These VS Code configs are
syntax- and cross-reference-checked but were never run in VS Code itself.

## API keys (all optional)

Copy `.env.example` to `.env` (setup does this) and fill only what you need, then restart the backend.
Open **Settings & Data Sources** and press **Test connection** to verify each source for real.

| Setting | Enables | Where to get it |
|---|---|---|
| `FIRMS_MAP_KEY` | Wildfire hotspots | <https://firms.modaps.eosdis.nasa.gov/api/map_key/> |
| `NASA_API_KEY` | NeoWs / APOD (else shared, tightly limited `DEMO_KEY`) | <https://api.nasa.gov/> |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | AI assistant | <https://openrouter.ai/keys>, model ids at <https://openrouter.ai/models> (none hardcoded) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Optional saved locations/reports/run summaries | Supabase project → Settings → API (service/secret key only); run `docs/supabase/schema.sql` first |

No key needed: Open-Meteo, JPL, NASA Exoplanet Archive, NASA Image Library, NASA GIBS tiles, USGS earthquakes, CelesTrak.
Keys live only in the backend `.env`; the browser never sees them (the dev server proxies `/api`).
**Supabase and "local only":** it is optional and backend-only. A cloud project stores what you explicitly save
(locations, reports, simulation summaries — never keys) on Supabase's servers; the Supabase CLI
(`supabase start`, needs Docker) gives a fully local database at `SUPABASE_URL=http://127.0.0.1:54321`.

## The 15 pages and 12 modules

| Page | What it does |
|---|---|
| Home | Cinematic hero (stylised illustration), 12 module cards, workflow, live NASA imagery, highlights, twin preview, source status |
| 12 Mission Control | Map of USGS earthquakes, weather, near-Earth objects, simulated twin status, alerts, source health, recent reports, quick navigation, refresh/location/date controls |
| 01 Earth Observation | Leaflet map + NASA GIBS satellite layers (true colour, land-surface temperature), date and two-date comparison, layer-type legend, NASA image library with metadata and CSV export |
| 02 Wildfire & Disaster | FIRMS hotspots (map, table, charts, CSV), USGS earthquakes, explicit "no integration" list for floods/cyclones/drought |
| 03 Weather & Climate | Open-Meteo geocoding, current (model-based), 48 h charts, 7-day table, historical reanalysis, unit preferences |
| 04 Satellite Communication | Diagram, link-budget calculator (documented formulas), LEO/MEO/GEO comparison, band table |
| 05 Navigation | Draggable simulated sky plot, real least-squares solver, DOP and error readouts |
| 06 Space Science | APOD, near-Earth objects, exoplanet search + charts, NASA imagery |
| 07 Digital Twin | 3D satellite (React Three Fiber), simulated telemetry charts, fault injection, rule-based anomaly detection with auditable alerts, optional ML outliers |
| 08 Debris & Asteroids | JPL close approaches + small-body orbits, CelesTrak debris groups (separate tab), educational orbit calculator |
| 09 Multimodal | Region + layer selection, combined hotspots/weather/quakes/images, derived indicators, AI interpretation |
| 10 AI Assistant | Grounded chat via OpenRouter (backend only), selectable context, retry/errors |
| 11 Reports | Reports from data you actually loaded; print-to-PDF, CSV, optional save to Supabase |
| Settings / About | Source status + real connection tests + preferences / About with no invented affiliations |

## Feature status

**Executed and passing in the sandbox — 68 backend checks:** link budget, orbit geometry, GNSS solver and DOP
(incl. a 400-seed statistical check that error ≈ HDOP × σ), telemetry simulator, rule-based detector (zero false
alerts on nominal runs; each fault type caught), IsolationForest, config/cache/rate-limit/source-registry,
Supabase validation (UUID and table allow-lists, URL validation, secret scrubbing), and all parsing/validation
logic of the API clients against *documented-shape fixtures*. A mutation check confirmed the tests fail when the
maths is broken.

**Frontend — what was verified:** all source passes `tsc --strict` against **hand-written type stubs** (the real
`react`, `react-router-dom`, `lucide-react`, `react-leaflet`, `recharts`, `three`/R3F types were unavailable, so usage
of those libraries is *not* type-checked against the real packages); 15 routes exist and every link resolves; the
pure utilities (CSV with formula-injection protection, geo maths, formatting, AI-context building, preference
validation) were run under Node; all 28 `/api` paths and their parameters used by the frontend were cross-checked
against the backend routes; the source contains no credentials.

**NOT verified (never executed):** `npm install`, `vite build`, the dev server, rendering in any browser,
responsive behaviour, keyboard/screen-reader behaviour, Leaflet/Recharts/Three.js runtime behaviour, print-to-PDF
output, and **every live HTTP call** (Open-Meteo, FIRMS, NASA, JPL, Exoplanet Archive, NASA Image Library, USGS,
CelesTrak, OpenRouter, Supabase, GIBS tiles). `backend/tests/test_api.py` (real FastAPI) is written but unrun.
The route glue was exercised only against minimal FastAPI/pydantic stand-ins. See
[`docs/api-sources.md`](docs/api-sources.md) for the short list of endpoint details to check first.

**Simulated (always labelled):** digital-twin telemetry, GNSS satellites/measurements, orbit-class comparisons,
the educational orbit calculator.

### Known limitations and gaps
* Not implemented: NASA Earthdata beyond GIBS tiles, NASA mission-status data, floods/cyclones/drought,
  image classification/segmentation/change detection, a collision/conjunction tool (deliberately), real-time
  spacecraft or GNSS data. These are shown as unavailable, never invented.
* PDF export is the browser's print-to-PDF (no PDF library), so layout depends on your browser.
* The IsolationForest cannot extrapolate beyond its training range and largely misses slow pointing drift; the
  rule-based detector is authoritative. Telemetry thresholds are placeholders for a simulated spacecraft.
* Spherical-Earth orbit maths; GEO period computes ~1435.7 min vs the sidereal day ~1436.1 min.
* Multimodal "context flags" are fixed-threshold rules (wind ≥ 30 km/h, rain ≥ 10 mm/72 h, quake ≥ M4.5), not hazard models.
* The Home hero is a stylised SVG, not a NASA photograph (no verified local assets offline); NASA imagery appears
  on Home and Earth Observation via the backend with fallbacks. Basemap tiles are OpenStreetMap (attribution shown;
  respect OSM's tile-usage policy — fine for local development, not for heavy use).
* No login: this is a single-user local tool. Local security only (see below); not security-assessed.

## Security notes (local)
Keys stay in the backend `.env` (git-ignored; `.env.example` has placeholders). CORS allows only the local frontend
origins. Inputs are validated in the browser and again in the backend; outbound requests go through one HTTP
choke-point with timeouts and scrubbed error messages; no endpoint fetches arbitrary URLs or reads arbitrary files;
saved reports are scrubbed of known secret values; CSV exports neutralise spreadsheet formulas; `httpx` URL logging
is silenced because the FIRMS key sits in the upstream URL path. The OpenRouter proxy is rate-limited and treats
shared context as untrusted data.

## Project layout
```
project-acrux/
  backend/app/   api/ core/ schemas/ services/ integrations/ analytics/ simulations/ main.py
  backend/tests/ 68 passing checks (+ test_api.py needing real FastAPI)
  frontend/src/  app/ layouts/ components/ features/ hooks/ pages/ services/ types/ utils/
  docs/          architecture.md  api-sources.md  local-setup.md  supabase/schema.sql
  .vscode/       tasks.json  launch.json  settings.json  extensions.json
  scripts/       setup.ps1  start-backend.ps1  start-frontend.ps1  run-tests.ps1
  .env.example   .gitignore   README.md
```
