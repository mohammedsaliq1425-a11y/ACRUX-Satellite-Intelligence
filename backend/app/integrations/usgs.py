"""USGS Earthquake Hazards Program: GeoJSON summary feeds (no key).
Docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
STATUS: written from the public docs; NOT executed against the live API in the build sandbox."""
from __future__ import annotations

from datetime import datetime, timezone

from ..core.cache import cache
from ..core.config import Settings
from ..core.errors import InputError, SourceError
from ..core.http import fetch
from ..services.source_registry import registry
from .common import envelope

SRC = "usgs"
DOC_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php"
FEEDS = ("all_hour", "all_day", "2.5_day", "2.5_week", "4.5_day", "4.5_week",
         "significant_week", "significant_month")
NOTE = ("Earthquake magnitudes and locations are automatic or reviewed estimates and can be revised. "
        "This is a record of events that already happened, not a prediction.")


def _iso(ms) -> str | None:
    try:
        return datetime.fromtimestamp(float(ms) / 1000.0, tz=timezone.utc).isoformat(timespec="seconds")
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def normalize(raw: dict) -> list[dict]:
    feats = raw.get("features")
    if not isinstance(feats, list):
        raise ValueError("unexpected feed shape")
    out = []
    for f in feats:
        p, g = f.get("properties") or {}, f.get("geometry") or {}
        c = g.get("coordinates") or []
        if len(c) < 2 or c[0] is None or c[1] is None:
            continue
        out.append({"id": f.get("id"), "magnitude": p.get("mag"), "magnitude_type": p.get("magType"),
                    "place": p.get("place"), "time_utc": _iso(p.get("time")), "updated_utc": _iso(p.get("updated")),
                    "longitude": c[0], "latitude": c[1], "depth_km": c[2] if len(c) > 2 else None,
                    "url": p.get("url"), "tsunami_flag": p.get("tsunami"), "significance": p.get("sig"),
                    "status": p.get("status")})
    out.sort(key=lambda r: r["time_utc"] or "", reverse=True)
    return out


async def earthquakes(settings: Settings, feed: str = "2.5_day") -> dict:
    if feed not in FEEDS:
        raise InputError(f"feed must be one of {', '.join(FEEDS)}")
    key = f"usgs:{feed}"
    if hit := cache.get(key, 300):
        return envelope(hit.value, source="USGS Earthquake Hazards Program", source_url=DOC_URL,
                        kind="observation", notes=[NOTE], cached=True, retrieved_at=hit.retrieved_at)
    raw = await fetch(SRC, f"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{feed}.geojson", settings)
    try:
        data = normalize(raw)
    except (ValueError, AttributeError, TypeError):
        registry.record_failure(SRC, "invalid_response", "Unexpected earthquake feed shape.")
        raise SourceError("invalid_response", "Unexpected earthquake feed shape.", SRC)
    registry.record_success(SRC)
    cache.set(key, data)
    return envelope(data, source="USGS Earthquake Hazards Program", source_url=DOC_URL,
                    kind="observation", notes=[NOTE])


async def probe(settings: Settings) -> bool:
    res = await earthquakes(settings, "4.5_day")
    return isinstance(res["data"], list)
