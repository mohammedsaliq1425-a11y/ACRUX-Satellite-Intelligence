"""NASA Open APIs: NeoWs (near-Earth object feed) and APOD.
Docs: https://api.nasa.gov/
STATUS: written from the public docs; NOT executed against the live API in the build sandbox.
Without NASA_API_KEY the shared DEMO_KEY is used (low hourly/daily limits).
"""
from __future__ import annotations

from datetime import date

from ..core.cache import cache
from ..core.config import Settings
from ..core.errors import InputError, SourceError
from ..core.http import fetch
from ..services.source_registry import registry
from .common import envelope

SRC = "nasa_api"
NEO_FEED = "https://api.nasa.gov/neo/rest/v1/feed"
APOD = "https://api.nasa.gov/planetary/apod"
DOC_URL = "https://api.nasa.gov/"

NEO_NOTE = ("A close approach is a flyby at the listed distance, not an impact prediction. "
            "'Potentially hazardous' is a classification from orbit and brightness thresholds.")


def normalize_neo_feed(raw: dict) -> list[dict]:
    out = []
    for day, objs in (raw.get("near_earth_objects") or {}).items():
        for o in objs:
            diam = ((o.get("estimated_diameter") or {}).get("meters") or {})
            for ca in o.get("close_approach_data") or []:
                def num(path, d=ca):
                    cur = d
                    for p in path:
                        cur = (cur or {}).get(p)
                    try:
                        return float(cur) if cur is not None else None
                    except (TypeError, ValueError):
                        return None
                out.append({
                    "id": o.get("id"), "name": o.get("name"),
                    "jpl_url": o.get("nasa_jpl_url"),
                    "absolute_magnitude_h": o.get("absolute_magnitude_h"),
                    "diameter_m_min": diam.get("estimated_diameter_min"),
                    "diameter_m_max": diam.get("estimated_diameter_max"),
                    "potentially_hazardous": o.get("is_potentially_hazardous_asteroid"),
                    "sentry_object": o.get("is_sentry_object"),
                    "approach_date": ca.get("close_approach_date"),
                    "approach_datetime": ca.get("close_approach_date_full"),
                    "velocity_km_s": num(["relative_velocity", "kilometers_per_second"]),
                    "miss_distance_km": num(["miss_distance", "kilometers"]),
                    "miss_distance_lunar": num(["miss_distance", "lunar"]),
                    "miss_distance_au": num(["miss_distance", "astronomical"]),
                    "orbiting_body": ca.get("orbiting_body"),
                })
    out.sort(key=lambda r: (r["approach_datetime"] or r["approach_date"] or ""))
    return out


async def neo_feed(settings: Settings, start: date, end: date) -> dict:
    if start > end:
        raise InputError("Start date must not be after end date.")
    if (end - start).days > 7:
        raise InputError("NeoWs feed supports at most a 7-day range per request.")
    key = f"nasa:neo:{start}:{end}"
    if hit := cache.get(key, 1800):
        return envelope(hit.value, source="NASA NeoWs", source_url=DOC_URL, kind="catalogue",
                        notes=[NEO_NOTE], cached=True, retrieved_at=hit.retrieved_at)
    raw = await fetch(SRC, NEO_FEED, settings, params={
        "start_date": start.isoformat(), "end_date": end.isoformat(),
        "api_key": settings.effective_nasa_key})
    if not isinstance(raw, dict) or "near_earth_objects" not in raw:
        raise SourceError("invalid_response", "NeoWs response missing expected fields.", SRC)
    registry.record_success(SRC)
    data = normalize_neo_feed(raw)
    cache.set(key, data)
    notes = [NEO_NOTE]
    if settings.nasa_api_key is None:
        notes.append("Using the shared DEMO_KEY; add NASA_API_KEY to avoid tight rate limits.")
    return envelope(data, source="NASA NeoWs", source_url=DOC_URL, kind="catalogue", notes=notes)


async def apod(settings: Settings, day: date | None = None) -> dict:
    params = {"api_key": settings.effective_nasa_key}
    if day:
        params["date"] = day.isoformat()
    key = f"nasa:apod:{day}"
    if hit := cache.get(key, 3600):
        return envelope(hit.value, source="NASA APOD", source_url=DOC_URL, kind="catalogue",
                        cached=True, retrieved_at=hit.retrieved_at)
    raw = await fetch(SRC, APOD, settings, params=params)
    if not isinstance(raw, dict) or "title" not in raw:
        raise SourceError("invalid_response", "APOD response missing expected fields.", SRC)
    registry.record_success(SRC)
    data = {k: raw.get(k) for k in ("title", "date", "explanation", "media_type", "url",
                                    "hdurl", "copyright", "thumbnail_url")}
    cache.set(key, data)
    notes = ["Some APOD images are copyrighted by their creators; see the 'copyright' field."]
    return envelope(data, source="NASA APOD", source_url=DOC_URL, kind="catalogue", notes=notes)


async def probe(settings: Settings) -> bool:
    today = date.today()
    res = await neo_feed(settings, today, today)
    return isinstance(res["data"], list)
