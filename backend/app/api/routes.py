"""HTTP routes. Handlers are thin: validation -> pure function / integration -> JSON."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from ..analytics import anomaly, gnss, link_budget as lb
from ..analytics.ml_anomaly import MLDetector
from ..core.config import get_settings
from ..core.errors import InputError, SourceError
from ..core.ratelimit import RateLimiter
from ..integrations import (celestrak, exoplanets, firms, jpl_ssd, nasa, nasa_images,
                            open_meteo, openrouter, supabase, usgs)
from ..schemas.requests import (ChatRequest, GnssRequest, LinkBudgetRequest, LocationIn,
                                OrbitComparisonRequest, ReportIn, TelemetryRequest)
from ..services import ai_context, storage
from ..services.source_registry import BY_ID, registry
from ..simulations.telemetry import Fault, FAULT_KINDS, SimConfig, generate, DISCLAIMER

router = APIRouter(prefix="/api")
_ai_limiter = RateLimiter(max_calls=20, window_s=60)
_ml: MLDetector | None = None   # fitted lazily on first use (a second or two)

PROBES = {
    "open_meteo": open_meteo.probe, "nasa_api": nasa.probe, "firms": firms.probe,
    "jpl_ssd": jpl_ssd.probe, "exoplanet_archive": exoplanets.probe,
    "nasa_images": nasa_images.probe, "openrouter": openrouter.probe,
    "supabase": supabase.probe, "usgs": usgs.probe, "celestrak": celestrak.probe,
}


# ---------------------------------------------------------------- health / sources
@router.get("/health")
async def health():
    return {"status": "ok", "service": "Project Acrux backend",
            "time_utc": datetime.now(timezone.utc).isoformat(timespec="seconds")}


@router.get("/sources")
async def sources():
    return {"sources": registry.snapshot(get_settings())}


@router.post("/sources/{source_id}/test")
async def test_source(source_id: str):
    if source_id not in BY_ID:
        raise HTTPException(404, "Unknown source")
    settings = get_settings()
    d = BY_ID[source_id]
    if d.auth == "required" and not registry.is_configured(d, settings):
        raise SourceError("not_configured", f"{d.name} is not configured; nothing to test.", source_id)
    try:
        ok = await PROBES[source_id](settings)
    except SourceError:
        ok = False   # failure already recorded in the registry
    snap = next(s for s in registry.snapshot(settings) if s["id"] == source_id)
    return {"ok": ok, "source": snap}


# ---------------------------------------------------------------- calculators
@router.post("/calc/link-budget")
async def link_budget(req: LinkBudgetRequest):
    return lb.compute_link_budget(lb.LinkInputs(**req.model_dump()))


@router.post("/calc/orbit-comparison")
async def orbit_comparison(req: OrbitComparisonRequest):
    return {"rows": lb.orbit_comparison(req.freq_ghz, req.min_elevation_deg),
            "note": "Illustrative generic orbit classes; not real operator constellations.",
            "kind": "calculation"}


@router.post("/calc/gnss")
async def gnss_sim(req: GnssRequest):
    sats = [gnss.SimSat(s.prn, s.az_deg, s.el_deg) for s in req.satellites]
    return gnss.simulate_fix(req.lat_deg, req.lon_deg, req.height_m, sats,
                             req.noise_sigma_m, req.clock_bias_m, req.elevation_mask_deg,
                             seed=req.seed)


# ---------------------------------------------------------------- telemetry
@router.get("/telemetry/fault-kinds")
async def fault_kinds():
    return {"fault_kinds": FAULT_KINDS, "disclaimer": DISCLAIMER}


@router.post("/telemetry/simulate")
async def telemetry(req: TelemetryRequest):
    global _ml
    cfg = SimConfig(duration_min=req.duration_min, step_s=req.step_s, seed=req.seed,
                    faults=[Fault(**f.model_dump()) for f in req.faults])
    sim = generate(cfg)
    samples = sim["samples"]
    events = anomaly.detect(samples)
    out = {**sim, "alerts": events, "component_status": anomaly.component_status(events),
           "detector": {"method": "rule-based threshold detector",
                        "thresholds": anomaly.DetectorConfig().__dict__,
                        "machine_learning": False}}
    if req.include_ml:
        if _ml is None:
            _ml = MLDetector()
        out["ml_outliers"] = _ml.score(samples)
        out["ml_detector"] = _ml.describe()
    for smp in out["samples"]:
        smp.pop("_true_fault_kinds", None)   # ground truth is for offline evaluation only
    if req.save_run:
        # Saving is optional; the simulation result is returned either way.
        try:
            row = storage.run_row(req.seed, sim["config"], events, out["component_status"])
            saved = await supabase.insert_row(get_settings(), "simulation_runs", row)
            out["storage"] = {"saved": True, "id": saved["data"].get("id")}
        except SourceError as e:
            out["storage"] = {"saved": False, "reason": e.message}
    return out


# ---------------------------------------------------------------- weather
@router.get("/weather/geocode")
async def weather_geocode(q: str = Query(min_length=2, max_length=100), count: int = 5):
    return await open_meteo.geocode(get_settings(), q, count)


@router.get("/weather/forecast")
async def weather_forecast(lat: float, lon: float, temperature_unit: str = "celsius",
                           wind_speed_unit: str = "kmh", precipitation_unit: str = "mm",
                           days: int = 7):
    return await open_meteo.forecast(get_settings(), lat, lon, temperature_unit=temperature_unit,
                                     wind_speed_unit=wind_speed_unit,
                                     precipitation_unit=precipitation_unit, forecast_days=days)


@router.get("/weather/history")
async def weather_history(lat: float, lon: float, start: date, end: date,
                          temperature_unit: str = "celsius", wind_speed_unit: str = "kmh",
                          precipitation_unit: str = "mm"):
    return await open_meteo.history(get_settings(), lat, lon, start, end,
                                    temperature_unit=temperature_unit,
                                    wind_speed_unit=wind_speed_unit,
                                    precipitation_unit=precipitation_unit)


# ---------------------------------------------------------------- fires
@router.get("/fires")
async def fires(west: float, south: float, east: float, north: float,
                source: str = "VIIRS_SNPP_NRT", day_range: int = 1, start_date: date | None = None):
    return await firms.fetch_fires(get_settings(), west, south, east, north, source,
                                   day_range, start_date)


@router.get("/fires/export.csv", response_class=PlainTextResponse)
async def fires_csv(west: float, south: float, east: float, north: float,
                    source: str = "VIIRS_SNPP_NRT", day_range: int = 1, start_date: date | None = None):
    res = await firms.fetch_fires(get_settings(), west, south, east, north, source,
                                  day_range, start_date)
    return PlainTextResponse(firms.records_to_csv(res["data"]["records"]), media_type="text/csv",
                             headers={"Content-Disposition": 'attachment; filename="acrux_firms_hotspots.csv"'})


# ---------------------------------------------------------------- space
@router.get("/space/apod")
async def space_apod(day: date | None = None):
    return await nasa.apod(get_settings(), day)


@router.get("/space/neo-feed")
async def space_neo_feed(start: date | None = None, end: date | None = None):
    s = start or date.today()
    return await nasa.neo_feed(get_settings(), s, end or s + timedelta(days=6))


@router.get("/space/close-approaches")
async def space_cad(date_min: date | None = None, date_max: date | None = None,
                    dist_max_au: float = 0.05, limit: int = 100):
    dmin = date_min or date.today()
    return await jpl_ssd.close_approaches(get_settings(), dmin, date_max or dmin + timedelta(days=60),
                                          dist_max_au, limit)


@router.get("/space/small-body")
async def space_sbdb(q: str = Query(min_length=1, max_length=60)):
    return await jpl_ssd.small_body(get_settings(), q)


@router.get("/space/exoplanets")
async def space_exoplanets(name: str | None = None, method: str | None = None,
                           year_min: int | None = None, year_max: int | None = None,
                           limit: int = 100):
    return await exoplanets.search(get_settings(), name, method, year_min, year_max, limit)


@router.get("/space/images")
async def space_images(q: str = Query(min_length=2, max_length=80), page_size: int = 12, page: int = 1):
    return await nasa_images.search_images(get_settings(), q, page_size, page)


# ---------------------------------------------------------------- AI
@router.get("/ai/status")
async def ai_status():
    s = get_settings()
    return {"configured": bool(s.openrouter_api_key and s.openrouter_model),
            "has_key": bool(s.openrouter_api_key), "has_model": bool(s.openrouter_model)}


@router.post("/ai/chat")
async def ai_chat(req: ChatRequest, request: Request):
    settings = get_settings()
    openrouter.require_configured(settings)       # clear 503 before spending a rate-limit slot
    client = request.client.host if request.client else "local"
    allowed, retry = _ai_limiter.check(client)
    if not allowed:
        raise SourceError("rate_limited", f"Too many assistant requests. Try again in {retry:.0f}s.", "openrouter")
    messages = ai_context.build_messages([m.model_dump() for m in req.history], req.message,
                                         [c.model_dump() for c in req.context])
    res = await openrouter.chat(settings, messages)
    res["meta"]["context_items_used"] = [{"id": f"C{i}", "label": c.label, "kind": c.kind,
                                          "source": c.source, "timestamp": c.timestamp}
                                         for i, c in enumerate(ai_context.sanitize_items(
                                             [c.model_dump() for c in req.context]), 1)]
    return res


# ---------------------------------------------------------------- optional storage (Supabase)
@router.get("/storage/status")
async def storage_status():
    s = get_settings()
    return {"configured": bool(s.supabase_url and s.supabase_service_key),
            "has_url": bool(s.supabase_url), "has_key": bool(s.supabase_service_key),
            "note": "Optional. When unset, saving is disabled and everything else works."}


@router.get("/storage/locations")
async def list_locations(limit: int = 50):
    return await supabase.list_rows(get_settings(), "saved_locations", limit)


@router.post("/storage/locations")
async def save_location(req: LocationIn):
    row = storage.location_row(req.name, req.latitude, req.longitude, req.notes)
    return await supabase.insert_row(get_settings(), "saved_locations", row)


@router.delete("/storage/locations/{row_id}")
async def delete_location(row_id: str):
    return await supabase.delete_row(get_settings(), "saved_locations", row_id)


@router.get("/storage/reports")
async def list_reports(limit: int = 50):
    return await supabase.list_rows(get_settings(), "saved_reports", limit)


@router.post("/storage/reports")
async def save_report(req: ReportIn):
    settings = get_settings()
    row = storage.report_row(req.title, req.report_type, req.payload, req.contains_simulated,
                             settings.secret_values())
    return await supabase.insert_row(settings, "saved_reports", row)


@router.delete("/storage/reports/{row_id}")
async def delete_report(row_id: str):
    return await supabase.delete_row(get_settings(), "saved_reports", row_id)


@router.get("/storage/simulation-runs")
async def list_runs(limit: int = 50):
    return await supabase.list_rows(get_settings(), "simulation_runs", limit)


# ---------------------------------------------------------------- disasters / debris
@router.get("/disasters/earthquakes")
async def disasters_earthquakes(feed: str = "2.5_day"):
    return await usgs.earthquakes(get_settings(), feed)


@router.get("/space/debris")
async def space_debris(group: str = "iridium-33-debris"):
    return await celestrak.debris_group(get_settings(), group)
