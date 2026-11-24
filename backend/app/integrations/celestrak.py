"""CelesTrak GP orbital elements (JSON, no key) for human-made orbital debris groups.
Docs: https://celestrak.org/NORAD/documentation/gp-data-formats.php
STATUS: written from the public docs; NOT executed against the live API in the build sandbox.
CelesTrak asks clients not to poll more often than every ~2 hours, so results are cached for 2 h.
Derived values (semi-major axis, perigee/apogee altitude) come from MEAN elements with two-body maths;
this is NOT an orbit propagation and gives no collision or conjunction information."""
from __future__ import annotations

import math

from ..analytics.orbital import EARTH_RADIUS_KM, MU_EARTH_KM3_S2
from ..core.cache import cache
from ..core.config import Settings
from ..core.errors import InputError, SourceError
from ..core.http import fetch
from ..services.source_registry import registry
from .common import envelope

SRC = "celestrak"
URL = "https://celestrak.org/NORAD/elements/gp.php"
DOC_URL = "https://celestrak.org/NORAD/documentation/gp-data-formats.php"
# Fragment-debris groups from named breakup/collision events. Verify against the CelesTrak catalogue.
GROUPS = {"cosmos-2251-debris": "Cosmos 2251 collision debris", "iridium-33-debris": "Iridium 33 collision debris",
          "fengyun-1c-debris": "Fengyun-1C anti-satellite test debris"}
NOTE = ("Orbital elements are mean elements from CelesTrak/Space-Track data at the listed epoch. Altitudes here are "
        "derived with two-body formulas for educational comparison. This is not a conjunction, collision-risk or tracking product.")


def _f(v):
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def derive(rec: dict) -> dict:
    n, e = _f(rec.get("MEAN_MOTION")), _f(rec.get("ECCENTRICITY"))
    a = peri = apo = period = None
    if n and n > 0 and e is not None and 0 <= e < 1:
        n_rad_s = n * 2 * math.pi / 86400.0
        a = (MU_EARTH_KM3_S2 / n_rad_s ** 2) ** (1 / 3)
        peri, apo, period = a * (1 - e) - EARTH_RADIUS_KM, a * (1 + e) - EARTH_RADIUS_KM, 1440.0 / n
    return {"name": rec.get("OBJECT_NAME"), "norad_id": rec.get("NORAD_CAT_ID"), "intl_designator": rec.get("OBJECT_ID"),
            "epoch": rec.get("EPOCH"), "inclination_deg": _f(rec.get("INCLINATION")), "eccentricity": e,
            "mean_motion_rev_per_day": n, "raan_deg": _f(rec.get("RA_OF_ASC_NODE")),
            "arg_perigee_deg": _f(rec.get("ARG_OF_PERICENTER")), "mean_anomaly_deg": _f(rec.get("MEAN_ANOMALY")),
            "semi_major_axis_km": a, "perigee_alt_km": peri, "apogee_alt_km": apo, "period_min": period}


async def debris_group(settings: Settings, group: str) -> dict:
    if group not in GROUPS:
        raise InputError(f"group must be one of {', '.join(GROUPS)}")
    key = f"celestrak:{group}"
    if hit := cache.get(key, 7200):
        return envelope(hit.value, source="CelesTrak GP data", source_url=DOC_URL, kind="catalogue",
                        notes=[NOTE], cached=True, retrieved_at=hit.retrieved_at)
    raw = await fetch(SRC, URL, settings, params={"GROUP": group, "FORMAT": "json"})
    if not isinstance(raw, list):
        registry.record_failure(SRC, "invalid_response", "Unexpected CelesTrak response.")
        raise SourceError("invalid_response", "Unexpected CelesTrak response.", SRC)
    registry.record_success(SRC)
    data = {"group": group, "group_label": GROUPS[group], "objects": [derive(r) for r in raw if isinstance(r, dict)]}
    cache.set(key, data)
    return envelope(data, source="CelesTrak GP data", source_url=DOC_URL, kind="catalogue", notes=[NOTE])


async def probe(settings: Settings) -> bool:
    res = await debris_group(settings, "iridium-33-debris")
    return isinstance(res["data"]["objects"], list)
