"""JPL Solar System Dynamics APIs: Close-Approach Data (CAD) and Small-Body Database (SBDB).
Docs: https://ssd-api.jpl.nasa.gov/doc/cad.html  |  https://ssd-api.jpl.nasa.gov/doc/sbdb.html
STATUS: written from the public docs; NOT executed against the live API in the build sandbox.
"""
from __future__ import annotations

import re
from datetime import date, datetime

from ..core.cache import cache
from ..core.config import Settings
from ..core.errors import InputError, SourceError
from ..core.http import fetch
from ..services.source_registry import registry
from .common import envelope

SRC = "jpl_ssd"
CAD_URL = "https://ssd-api.jpl.nasa.gov/cad.api"
SBDB_URL = "https://ssd-api.jpl.nasa.gov/sbdb.api"
AU_KM = 149_597_870.7
LUNAR_DISTANCE_KM = 384_400.0
NOTE = ("Close-approach data lists predicted flyby geometry from current orbit solutions; "
        "it is not an impact forecast. Distances carry uncertainty (see dist_min/dist_max).")


def _num(v):
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


def _parse_cd(cd: str | None) -> str | None:
    """CAD calendar date like '2026-Oct-11 12:34' (TDB) -> ISO-like string, else raw."""
    if not cd:
        return None
    try:
        return datetime.strptime(cd, "%Y-%b-%d %H:%M").isoformat(timespec="minutes")
    except ValueError:
        return cd


def normalize_cad(raw: dict) -> list[dict]:
    fields, rows = raw.get("fields"), raw.get("data")
    if not isinstance(fields, list) or not isinstance(rows, list):
        raise ValueError("unexpected CAD shape")
    out = []
    for row in rows:
        r = dict(zip(fields, row))
        dist_au = _num(r.get("dist"))
        out.append({
            "designation": r.get("fullname") or r.get("des"),
            "des": r.get("des"), "orbit_id": r.get("orbit_id"),
            "approach_time_tdb": _parse_cd(r.get("cd")), "jd": _num(r.get("jd")),
            "distance_au": dist_au,
            "distance_km": None if dist_au is None else dist_au * AU_KM,
            "distance_lunar": None if dist_au is None else dist_au * AU_KM / LUNAR_DISTANCE_KM,
            "distance_min_au": _num(r.get("dist_min")), "distance_max_au": _num(r.get("dist_max")),
            "v_rel_km_s": _num(r.get("v_rel")), "v_inf_km_s": _num(r.get("v_inf")),
            "time_uncertainty": r.get("t_sigma_f"),
            "absolute_magnitude_h": _num(r.get("h")),
            "diameter_km": _num(r.get("diameter")),
        })
    return out


async def close_approaches(settings: Settings, date_min: date, date_max: date,
                           dist_max_au: float = 0.05, limit: int = 100) -> dict:
    if date_min > date_max:
        raise InputError("date_min must not be after date_max.")
    if (date_max - date_min).days > 366:
        raise InputError("Range limited to 366 days per request.")
    if not 0 < dist_max_au <= 0.2:
        raise InputError("dist_max_au must be in (0, 0.2].")
    limit = max(1, min(limit, 500))
    params = {"date-min": date_min.isoformat(), "date-max": date_max.isoformat(),
              "dist-max": f"{dist_max_au:g}", "sort": "date", "limit": limit,
              "fullname": "true", "diameter": "true"}
    key = f"jpl:cad:{sorted(params.items())}"
    if hit := cache.get(key, 1800):
        return envelope(hit.value, source="JPL SSD Close-Approach Data API", source_url=CAD_URL,
                        kind="catalogue", notes=[NOTE], cached=True, retrieved_at=hit.retrieved_at)
    raw = await fetch(SRC, CAD_URL, settings, params=params)
    try:
        data = normalize_cad(raw)
    except (ValueError, AttributeError, TypeError):
        registry.record_failure(SRC, "invalid_response", "Unexpected CAD response shape.")
        raise SourceError("invalid_response", "Unexpected close-approach response shape.", SRC)
    registry.record_success(SRC)
    cache.set(key, data)
    return envelope(data, source="JPL SSD Close-Approach Data API", source_url=CAD_URL,
                    kind="catalogue", notes=[NOTE])


_SSTR = re.compile(r"^[A-Za-z0-9 .()/\-_+]{1,60}$")


def normalize_sbdb(raw: dict) -> dict:
    obj = raw.get("object") or {}
    orbit = raw.get("orbit") or {}
    elements = {}
    for e in orbit.get("elements") or []:
        if e.get("name"):
            elements[e["name"]] = {"value": _num(e.get("value")), "sigma": _num(e.get("sigma")),
                                   "units": e.get("units"), "title": e.get("title")}
    phys = {}
    for p in raw.get("phys_par") or []:
        if p.get("name"):
            phys[p["name"]] = {"value": p.get("value"), "units": p.get("units"),
                               "title": p.get("title"), "sigma": p.get("sigma"),
                               "ref": p.get("ref")}
    return {
        "full_name": obj.get("fullname"), "designation": obj.get("des"), "spkid": obj.get("spkid"),
        "kind": obj.get("kind"), "neo": obj.get("neo"), "pha": obj.get("pha"),
        "orbit_class": (obj.get("orbit_class") or {}).get("name"),
        "orbit": {"epoch_jd": _num(orbit.get("epoch")), "condition_code": orbit.get("condition_code"),
                  "first_obs": orbit.get("first_obs"), "last_obs": orbit.get("last_obs"),
                  "n_obs_used": orbit.get("n_obs_used"), "moid_au": _num(orbit.get("moid")),
                  "elements": elements, "frame": "heliocentric ecliptic J2000 (per SBDB docs)"},
        "physical": phys,
    }


async def small_body(settings: Settings, sstr: str) -> dict:
    sstr = sstr.strip()
    if not _SSTR.match(sstr):
        raise InputError("Search text may contain letters, digits, spaces and . ( ) / - _ + only (max 60).")
    key = f"jpl:sbdb:{sstr.lower()}"
    if hit := cache.get(key, 3600):
        return envelope(hit.value, source="JPL Small-Body Database API", source_url=SBDB_URL,
                        kind="catalogue", cached=True, retrieved_at=hit.retrieved_at)
    raw = await fetch(SRC, SBDB_URL, settings, params={"sstr": sstr, "phys-par": 1},
                      soft_statuses=(404, 300))
    if not isinstance(raw, dict) or "object" not in raw:
        raise SourceError("invalid_response", "Unexpected SBDB response shape.", SRC)
    registry.record_success(SRC)
    data = normalize_sbdb(raw)
    cache.set(key, data)
    return envelope(data, source="JPL Small-Body Database API", source_url=SBDB_URL, kind="catalogue",
                    notes=["Orbital elements are as published by JPL for the stated epoch; "
                           "physical parameters are often missing for small objects."])


async def probe(settings: Settings) -> bool:
    raw = await fetch(SRC, CAD_URL, settings, params={"limit": 1, "date-min": "now", "date-max": "+30"})
    ok = isinstance(raw, dict) and "data" in raw
    registry.record_success(SRC, usable=ok)
    return ok
