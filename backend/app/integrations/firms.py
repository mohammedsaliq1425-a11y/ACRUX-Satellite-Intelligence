"""NASA FIRMS active-fire area API (CSV).
Docs: https://firms.modaps.eosdis.nasa.gov/api/area/
Request form: /api/area/csv/{MAP_KEY}/{SOURCE}/{west,south,east,north}/{day_range}[/{YYYY-MM-DD}]
STATUS: written from the public docs; NOT executed against the live API in the build sandbox.
The MAP_KEY is part of the upstream URL path, so it is never echoed in any response or log.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime, timezone
from statistics import mean

from ..core.cache import cache
from ..core.config import Settings
from ..core.errors import InputError, SourceError
from ..core.http import fetch
from ..services.source_registry import registry
from .common import envelope

SRC = "firms"
BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
DOC_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/"
# Near-real-time products. Verify the current list in the FIRMS docs before extending.
ALLOWED_SOURCES = ("VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT")
MAX_SPAN_DEG = 40.0
MAX_RECORDS = 5000

DISCLAIMER = ("Hotspots are satellite thermal-anomaly detections at the sensor's pixel "
              "resolution. They are observations, not confirmed fires, and do not "
              "delineate the burning area or fire perimeter.")

FIELDS = ["latitude", "longitude", "acq_date", "acq_time", "acq_datetime_utc", "satellite",
          "instrument", "confidence", "frp", "daynight", "brightness", "bright_ti4",
          "bright_ti5", "bright_t31", "scan", "track", "version"]


def validate_bbox(west: float, south: float, east: float, north: float):
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise InputError("Bounding box must satisfy -180<=west<east<=180 and -90<=south<north<=90.")
    if east - west > MAX_SPAN_DEG or north - south > MAX_SPAN_DEG:
        raise InputError(f"Bounding box is limited to {MAX_SPAN_DEG:g} degrees per side.")


def _f(v):
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


def parse_csv(text: str) -> list[dict]:
    """Parse FIRMS CSV into normalised records. Missing columns stay None."""
    reader = csv.DictReader(io.StringIO(text.strip()))
    if not reader.fieldnames or "latitude" not in reader.fieldnames:
        raise ValueError("not a FIRMS CSV")
    recs = []
    for row in reader:
        lat, lon = _f(row.get("latitude")), _f(row.get("longitude"))
        if lat is None or lon is None:
            continue
        acq_date, acq_time = row.get("acq_date"), (row.get("acq_time") or "").zfill(4)
        dt = None
        if acq_date and re.fullmatch(r"\d{4}", acq_time):
            try:
                dt = datetime.strptime(f"{acq_date} {acq_time}", "%Y-%m-%d %H%M") \
                    .replace(tzinfo=timezone.utc).isoformat(timespec="minutes")
            except ValueError:
                dt = None
        recs.append({
            "latitude": lat, "longitude": lon, "acq_date": acq_date,
            "acq_time": acq_time if acq_time != "0000" or row.get("acq_time") else None,
            "acq_datetime_utc": dt,
            "satellite": row.get("satellite") or None,
            "instrument": row.get("instrument") or None,
            "confidence": row.get("confidence") or None,   # VIIRS: l/n/h text; MODIS: 0-100
            "frp": _f(row.get("frp")), "daynight": row.get("daynight") or None,
            "brightness": _f(row.get("brightness")), "bright_ti4": _f(row.get("bright_ti4")),
            "bright_ti5": _f(row.get("bright_ti5")), "bright_t31": _f(row.get("bright_t31")),
            "scan": _f(row.get("scan")), "track": _f(row.get("track")),
            "version": row.get("version") or None,
        })
    return recs


def summarize(records: list[dict]) -> dict:
    """Aggregates computed ONLY from the retrieved records."""
    frps = [r["frp"] for r in records if r["frp"] is not None]
    by_date: dict[str, int] = {}
    by_conf: dict[str, int] = {}
    by_dn: dict[str, int] = {}
    for r in records:
        by_date[r["acq_date"] or "unknown"] = by_date.get(r["acq_date"] or "unknown", 0) + 1
        by_conf[str(r["confidence"])] = by_conf.get(str(r["confidence"]), 0) + 1
        by_dn[str(r["daynight"])] = by_dn.get(str(r["daynight"]), 0) + 1
    return {
        "count": len(records),
        "frp_mw_total": sum(frps) if frps else None,
        "frp_mw_max": max(frps) if frps else None,
        "frp_mw_mean": mean(frps) if frps else None,
        "frp_records_with_value": len(frps),
        "by_date": dict(sorted(by_date.items())),
        "by_confidence": by_conf, "by_daynight": by_dn,
    }


def records_to_csv(records: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=FIELDS, extrasaction="ignore", lineterminator="\n")
    w.writeheader()
    for r in records:
        w.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in FIELDS})
    return buf.getvalue()


async def fetch_fires(settings: Settings, west: float, south: float, east: float, north: float,
                      source: str = "VIIRS_SNPP_NRT", day_range: int = 1,
                      start_date: date | None = None) -> dict:
    if not settings.firms_map_key:
        raise SourceError("not_configured",
                          "FIRMS_MAP_KEY is not set. Request a free MAP_KEY from NASA FIRMS and add it to .env.",
                          SRC)
    validate_bbox(west, south, east, north)
    if source not in ALLOWED_SOURCES:
        raise InputError(f"source must be one of {', '.join(ALLOWED_SOURCES)}")
    if not 1 <= day_range <= 5:
        raise InputError("day_range must be between 1 and 5")
    if start_date and start_date > date.today():
        raise InputError("start_date cannot be in the future")

    area = f"{west:.4f},{south:.4f},{east:.4f},{north:.4f}"
    url = f"{BASE}/{settings.firms_map_key}/{source}/{area}/{day_range}"
    if start_date:
        url += f"/{start_date.isoformat()}"
    ckey = f"firms:{source}:{area}:{day_range}:{start_date}"
    notes = [DISCLAIMER]
    if hit := cache.get(ckey, 600):
        return envelope(hit.value, source=f"NASA FIRMS ({source})", source_url=DOC_URL,
                        kind="observation", notes=notes, cached=True, retrieved_at=hit.retrieved_at)

    text = await fetch(SRC, url, settings, expect="text")
    try:
        records = parse_csv(text)
    except ValueError:
        lowered = text.strip().lower()[:200]
        if "invalid" in lowered and "key" in lowered:
            registry.record_failure(SRC, "auth_failed", "FIRMS rejected the MAP_KEY.", settings.secret_values())
            raise SourceError("auth_failed", "FIRMS rejected the MAP_KEY (check it is correct and active).", SRC)
        registry.record_failure(SRC, "invalid_response", "FIRMS returned a non-CSV response.", settings.secret_values())
        raise SourceError("invalid_response", "FIRMS returned an unexpected (non-CSV) response.", SRC)
    registry.record_success(SRC)
    truncated = len(records) > MAX_RECORDS
    records = records[:MAX_RECORDS]
    if truncated:
        notes.append(f"Result truncated to the first {MAX_RECORDS} records; narrow the region or dates.")
    data = {"records": records, "summary": summarize(records), "truncated": truncated,
            "query": {"bbox": [west, south, east, north], "source": source,
                      "day_range": day_range, "start_date": start_date.isoformat() if start_date else None}}
    cache.set(ckey, data)
    return envelope(data, source=f"NASA FIRMS ({source})", source_url=DOC_URL,
                    kind="observation", notes=notes)


async def probe(settings: Settings) -> bool:
    """Tiny 1-day query over a small box; a valid CSV header proves key + service work."""
    res = await fetch_fires(settings, 0.0, 0.0, 1.0, 1.0, "VIIRS_SNPP_NRT", 1)
    return isinstance(res["data"]["records"], list)
