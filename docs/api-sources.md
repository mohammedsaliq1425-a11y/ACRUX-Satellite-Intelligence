# Data sources and verification status

"Written from docs" means the client was coded from the provider's public documentation **without**
being run against the live service (the build sandbox had no network). Run **Settings → Test
connection** (`POST /api/sources/{id}/test`) after setup; it is the first real verification.

| Source | Key | Endpoint(s) used | Status |
|---|---|---|---|
| Open-Meteo | none | `geocoding-api.open-meteo.com/v1/search`, `api.open-meteo.com/v1/forecast`, `archive-api.open-meteo.com/v1/archive` | Written from docs; parsing tested on fixtures only |
| NASA FIRMS | `FIRMS_MAP_KEY` | `firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{SOURCE}/{w,s,e,n}/{1-5}[/{date}]` | Written from docs |
| NASA Open APIs | `NASA_API_KEY` (optional) | `api.nasa.gov/neo/rest/v1/feed`, `api.nasa.gov/planetary/apod` | Written from docs |
| JPL SSD | none | `ssd-api.jpl.nasa.gov/cad.api`, `/sbdb.api` | Written from docs |
| Exoplanet Archive | none | `exoplanetarchive.ipac.caltech.edu/TAP/sync` (table `pscomppars`) | Written from docs |
| NASA Image Library | none | `images-api.nasa.gov/search` | Written from docs |
| OpenRouter | key + model | `openrouter.ai/api/v1/chat/completions`, `/api/v1/key` | Written from docs |
| USGS Earthquakes | none | `earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{feed}.geojson` | Written from docs |
| CelesTrak GP | none | `celestrak.org/NORAD/elements/gp.php?GROUP=…&FORMAT=json` | Written from docs |
| NASA GIBS (browser tiles) | none | `gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/{matrix}/{z}/{y}/{x}.{ext}` | Written from docs; loaded directly by the browser |
| Supabase (optional) | URL + service key | `{SUPABASE_URL}/rest/v1/{saved_locations,saved_reports,simulation_runs}` (PostgREST) | Written from docs |

## Check these first when you run it
1. **OpenRouter key probe** uses `GET /api/v1/key`. If that path differs, the test will show an error
   even with a valid key; chat itself is unaffected. Update `KEY_URL` in `integrations/openrouter.py`.
2. **FIRMS product names** in `ALLOWED_SOURCES` (`VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`,
   `VIIRS_NOAA21_NRT`, `MODIS_NRT`). Compare with the current FIRMS API page.
3. **JPL CAD relative dates** (`date-min=now`, `date-max=+30`) in the connection probe.
4. **Exoplanet column names** in `COLUMNS` (`pl_rade`, `pl_bmasse`, `pl_orbper`, `pl_eqt`, `sy_dist`, …).
5. **FIRMS error text** for an invalid key is detected heuristically (looks for "invalid" + "key").

6. **Supabase key styles.** Non-JWT secret keys are sent in `apikey` only; JWT (`eyJ…`) keys are also sent as
   Bearer. If you get `auth_failed`, check which key type your project issues and adjust `_headers()` in
   `integrations/supabase.py`. A missing-table `404` is reported as "run docs/supabase/schema.sql".

7. **GIBS layers.** Layer ids, tile matrix sets (`GoogleMapsCompatible_Level9`/`Level7`) and extensions are in
   `GIBS_LAYERS` (`pages/EarthObservation.tsx`). If a layer renders blank, compare with the GIBS layer list; some
   layers have no data for very recent dates.
8. **CelesTrak groups** (`cosmos-2251-debris`, `iridium-33-debris`, `fengyun-1c-debris`) in `integrations/celestrak.py`;
   CelesTrak asks for ≥2 h between identical requests (the backend caches for 2 h).
9. **USGS feed names** in `integrations/usgs.py` (`2.5_day`, `4.5_week`, `significant_week`, …).

## Interpretation rules enforced by the backend
* FIRMS hotspots are detections, not confirmed fires or perimeters.
* Close approaches are flybys, not impact predictions; "potentially hazardous" is a classification.
* Open-Meteo "current" values are model-based; history is reanalysis; forecasts are forecasts.
* Every response carries `meta.kind`, `meta.source`, `meta.retrieved_at`, `meta.cached`, `meta.notes`.
  Cached results are flagged `cached: true` with the original retrieval time.
* Secrets: the FIRMS key sits in the upstream URL path, so URLs are never logged or echoed
  (`httpx` logging is raised to WARNING, error messages are fixed strings, and all stored errors
  pass through `scrub()`).
