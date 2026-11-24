"""Registry of external data sources and their *observed* health.

A key being present proves nothing about reachability, so status is driven by
the outcome of real requests (including the explicit 'test connection' probes),
never by configuration alone.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock

from ..core.config import Settings
from ..core.errors import scrub

STATUSES = ("not_configured", "configured_untested", "reachable",
            "returning_data", "rate_limited", "unavailable", "auth_failed")

KIND_TO_STATUS = {
    "auth_failed": "auth_failed",
    "rate_limited": "rate_limited",
    "unavailable": "unavailable",
    "timeout": "unavailable",
    "invalid_response": "reachable",   # server answered, but not with usable data
}


@dataclass(frozen=True)
class SourceDef:
    id: str
    name: str
    purpose: str
    auth: str                 # "required" | "optional" | "none"
    key_env: str | None
    docs_url: str
    probe: bool = True        # whether a genuine test request is implemented


SOURCES: list[SourceDef] = [
    SourceDef("open_meteo", "Open-Meteo", "Weather forecast, history and geocoding",
              "none", None, "https://open-meteo.com/en/docs"),
    SourceDef("nasa_api", "NASA Open APIs (NeoWs, APOD)", "Near-Earth objects and astronomy picture of the day",
              "optional", "NASA_API_KEY", "https://api.nasa.gov/"),
    SourceDef("firms", "NASA FIRMS", "Satellite fire hotspot detections",
              "required", "FIRMS_MAP_KEY", "https://firms.modaps.eosdis.nasa.gov/api/area/"),
    SourceDef("jpl_ssd", "JPL Small-Body Database & Close-Approach API", "Asteroid/comet orbits, physical parameters, close approaches",
              "none", None, "https://ssd-api.jpl.nasa.gov/doc/"),
    SourceDef("exoplanet_archive", "NASA Exoplanet Archive (TAP)", "Confirmed exoplanet catalogue",
              "none", None, "https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html"),
    SourceDef("nasa_images", "NASA Image and Video Library", "Public NASA imagery metadata and previews",
              "none", None, "https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf"),
    SourceDef("openrouter", "OpenRouter", "LLM gateway for the AI assistant (backend only)",
              "required", "OPENROUTER_API_KEY", "https://openrouter.ai/docs"),
    SourceDef("usgs", "USGS Earthquake Hazards Program", "Recent earthquake events (GeoJSON feeds)",
              "none", None, "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php"),
    SourceDef("celestrak", "CelesTrak GP orbital elements", "Orbital elements for human-made debris groups",
              "none", None, "https://celestrak.org/NORAD/documentation/gp-data-formats.php"),
    SourceDef("supabase", "Supabase (optional database)", "Saved locations, saved reports and simulation-run history (backend-only)",
              "required", "SUPABASE_SERVICE_KEY", "https://supabase.com/docs/guides/api"),
]
BY_ID = {s.id: s for s in SOURCES}


@dataclass
class SourceState:
    status: str | None = None
    last_success_at: str | None = None
    last_checked_at: str | None = None
    last_error: str | None = None
    last_error_kind: str | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class SourceRegistry:
    def __init__(self):
        self._state: dict[str, SourceState] = {s.id: SourceState() for s in SOURCES}
        self._lock = Lock()

    def record_success(self, source_id: str, usable: bool = True) -> None:
        with self._lock:
            st = self._state[source_id]
            st.last_checked_at = _now()
            st.status = "returning_data" if usable else "reachable"
            if usable:
                st.last_success_at = st.last_checked_at
                st.last_error = st.last_error_kind = None

    def record_failure(self, source_id: str, kind: str, message: str,
                       secrets: list[str] | None = None) -> None:
        with self._lock:
            st = self._state[source_id]
            st.last_checked_at = _now()
            st.status = KIND_TO_STATUS.get(kind, "unavailable")
            st.last_error_kind = kind
            st.last_error = scrub(message, secrets or [])[:300]

    def reset(self) -> None:
        with self._lock:
            self._state = {s.id: SourceState() for s in SOURCES}

    def is_configured(self, d: SourceDef, settings: Settings) -> bool:
        if d.id == "openrouter":
            return bool(settings.openrouter_api_key and settings.openrouter_model)
        if d.id == "supabase":
            return bool(settings.supabase_url and settings.supabase_service_key)
        if d.key_env is None:
            return True
        return {"NASA_API_KEY": settings.nasa_api_key,
                "FIRMS_MAP_KEY": settings.firms_map_key}.get(d.key_env) is not None

    def snapshot(self, settings: Settings) -> list[dict]:
        out = []
        with self._lock:
            for d in SOURCES:
                st = self._state[d.id]
                configured = self.is_configured(d, settings)
                if d.auth == "required" and not configured:
                    status = "not_configured"
                else:
                    status = st.status or "configured_untested"
                note = None
                if d.id == "nasa_api" and settings.nasa_api_key is None:
                    note = "No key set: using NASA's shared DEMO_KEY, which is heavily rate limited."
                if d.id == "openrouter" and settings.openrouter_api_key and not settings.openrouter_model:
                    note = "API key set but OPENROUTER_MODEL is not."
                if d.id == "supabase" and bool(settings.supabase_url) != bool(settings.supabase_service_key):
                    note = "Set both SUPABASE_URL and SUPABASE_SERVICE_KEY (and check the URL is a bare https://<project>.supabase.co origin)."
                out.append({
                    "id": d.id, "name": d.name, "purpose": d.purpose,
                    "auth_requirement": d.auth, "key_env_var": d.key_env,
                    "key_configured": configured if d.key_env else None,
                    "status": status, "note": note,
                    "last_success_at": st.last_success_at,
                    "last_checked_at": st.last_checked_at,
                    "last_error": st.last_error,
                    "docs_url": d.docs_url, "test_available": d.probe,
                })
        return out


registry = SourceRegistry()
