"""Open-Meteo: geocoding, forecast, and historical (reanalysis) weather.
Docs: https://open-meteo.com/en/docs  |  https://open-meteo.com/en/docs/historical-weather-api
STATUS: written from the public docs; NOT executed against the live API in the build sandbox.
"""
from __future__ import annotations

from datetime import date, timedelta

from ..core.cache import cache
from ..core.config import Settings
from ..core.errors import InputError, SourceError
from ..core.http import fetch
from ..services.source_registry import registry
from .common import envelope

SRC = "open_meteo"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
DOC_URL = "https://open-meteo.com/en/docs"

TEMP_UNITS = ("celsius", "fahrenheit")
WIND_UNITS = ("kmh", "ms", "mph", "kn")
PRECIP_UNITS = ("mm", "inch")

CURRENT_VARS = ["temperature_2m", "apparent_temperature", "relative_humidity_2m",
                "precipitation", "cloud_cover", "wind_speed_10m", "wind_direction_10m",
                "is_day", "weather_code"]
HOURLY_VARS = ["temperature_2m", "relative_humidity_2m", "precipitation",
               "cloud_cover", "wind_speed_10m"]
DAILY_VARS = ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "wind_speed_10m_max"]
ARCHIVE_DAILY = ["temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
                 "precipitation_sum", "wind_speed_10m_max"]


def _check_coords(lat: float, lon: float):
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise InputError("Latitude must be in [-90, 90] and longitude in [-180, 180].")


def _check_units(t, w, p):
    if t not in TEMP_UNITS or w not in WIND_UNITS or p not in PRECIP_UNITS:
        raise InputError("Unsupported unit selection.")


async def geocode(settings: Settings, query: str, count: int = 5) -> dict:
    q = query.strip()
    if not 2 <= len(q) <= 100:
        raise InputError("Location search must be 2-100 characters.")
    count = max(1, min(count, 10))
    key = f"om:geo:{q.lower()}:{count}"
    if hit := cache.get(key, 3600):
        return envelope(hit.value, source="Open-Meteo Geocoding", source_url=DOC_URL,
                        kind="catalogue", cached=True, retrieved_at=hit.retrieved_at)
    raw = await fetch(SRC, GEOCODE_URL, settings,
                      params={"name": q, "count": count, "language": "en", "format": "json"})
    results = raw.get("results") if isinstance(raw, dict) else None
    places = [{
        "name": r.get("name"), "latitude": r.get("latitude"), "longitude": r.get("longitude"),
        "elevation_m": r.get("elevation"), "country": r.get("country"),
        "admin1": r.get("admin1"), "timezone": r.get("timezone"),
        "population": r.get("population"),
    } for r in (results or []) if r.get("latitude") is not None and r.get("longitude") is not None]
    registry.record_success(SRC)
    cache.set(key, places)
    return envelope(places, source="Open-Meteo Geocoding", source_url=DOC_URL, kind="catalogue",
                    notes=[] if places else ["No matching locations were found."])


async def forecast(settings: Settings, lat: float, lon: float, *,
                   temperature_unit: str = "celsius", wind_speed_unit: str = "kmh",
                   precipitation_unit: str = "mm", forecast_days: int = 7) -> dict:
    _check_coords(lat, lon)
    _check_units(temperature_unit, wind_speed_unit, precipitation_unit)
    forecast_days = max(1, min(forecast_days, 16))
    params = {
        "latitude": round(lat, 4), "longitude": round(lon, 4),
        "current": ",".join(CURRENT_VARS), "hourly": ",".join(HOURLY_VARS),
        "daily": ",".join(DAILY_VARS), "timezone": "auto", "forecast_days": forecast_days,
        "temperature_unit": temperature_unit, "wind_speed_unit": wind_speed_unit,
        "precipitation_unit": precipitation_unit,
    }
    key = f"om:fc:{sorted(params.items())}"
    notes = [
        "'Current' values are Open-Meteo's model-based conditions for the latest interval, "
        "not a direct station or satellite measurement.",
        "Hourly and daily series are model FORECASTS.",
        "Time values are local to the returned time zone (see utc_offset_seconds).",
    ]
    if hit := cache.get(key, 600):
        return envelope(hit.value, source="Open-Meteo Forecast API", source_url=DOC_URL,
                        kind="forecast", notes=notes, cached=True, retrieved_at=hit.retrieved_at)
    raw = await fetch(SRC, FORECAST_URL, settings, params=params)
    if not isinstance(raw, dict) or "current" not in raw or "hourly" not in raw:
        registry.record_failure(SRC, "invalid_response", "Forecast response missing expected fields.")
        raise SourceError("invalid_response", "Forecast response missing expected fields.", SRC)
    registry.record_success(SRC)
    data = {k: raw.get(k) for k in (
        "latitude", "longitude", "elevation", "timezone", "timezone_abbreviation",
        "utc_offset_seconds", "current_units", "current", "hourly_units", "hourly",
        "daily_units", "daily")}
    cache.set(key, data)
    return envelope(data, source="Open-Meteo Forecast API", source_url=DOC_URL,
                    kind="forecast", notes=notes)


async def history(settings: Settings, lat: float, lon: float, start: date, end: date, *,
                  temperature_unit: str = "celsius", wind_speed_unit: str = "kmh",
                  precipitation_unit: str = "mm") -> dict:
    _check_coords(lat, lon)
    _check_units(temperature_unit, wind_speed_unit, precipitation_unit)
    today = date.today()
    if start > end:
        raise InputError("Start date must not be after end date.")
    if end > today:
        raise InputError("End date cannot be in the future.")
    if (end - start).days > 366:
        raise InputError("Historical range is limited to 366 days per request.")
    if start < date(1940, 1, 1):
        raise InputError("Historical data starts in 1940.")
    params = {
        "latitude": round(lat, 4), "longitude": round(lon, 4),
        "start_date": start.isoformat(), "end_date": end.isoformat(),
        "daily": ",".join(ARCHIVE_DAILY), "timezone": "auto",
        "temperature_unit": temperature_unit, "wind_speed_unit": wind_speed_unit,
        "precipitation_unit": precipitation_unit,
    }
    raw = await fetch(SRC, ARCHIVE_URL, settings, params=params)
    if not isinstance(raw, dict) or "daily" not in raw:
        raise SourceError("invalid_response", "Historical response missing expected fields.", SRC)
    registry.record_success(SRC)
    data = {k: raw.get(k) for k in ("latitude", "longitude", "elevation", "timezone",
                                     "daily_units", "daily")}
    notes = ["Historical values come from reanalysis/archive models, not direct station readings.",
             "The most recent days may be missing (null) because the archive lags real time."]
    return envelope(data, source="Open-Meteo Historical Weather API", source_url=DOC_URL,
                    kind="reanalysis", notes=notes)


async def probe(settings: Settings) -> bool:
    raw = await fetch(SRC, FORECAST_URL, settings,
                      params={"latitude": 0, "longitude": 0, "current": "temperature_2m"})
    ok = isinstance(raw, dict) and "current" in raw
    registry.record_success(SRC, usable=ok)
    return ok
