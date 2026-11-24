"""NASA Exoplanet Archive via the TAP service (table `pscomppars`).
Docs: https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html
STATUS: written from the public docs; NOT executed against the live API in the build sandbox.
User input is never concatenated into ADQL except through strict allow-lists / sanitisers.
"""
from __future__ import annotations

import re

from ..core.cache import cache
from ..core.config import Settings
from ..core.errors import InputError, SourceError
from ..core.http import fetch
from ..services.source_registry import registry
from .common import envelope

SRC = "exoplanet_archive"
TAP_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
DOC_URL = "https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html"

COLUMNS = ["pl_name", "hostname", "discoverymethod", "disc_year", "pl_rade", "pl_bmasse",
           "pl_orbper", "pl_eqt", "sy_dist", "sy_snum", "sy_pnum"]
METHODS = ("Transit", "Radial Velocity", "Imaging", "Microlensing", "Transit Timing Variations",
           "Eclipse Timing Variations", "Orbital Brightness Modulation", "Pulsar Timing",
           "Astrometry", "Pulsation Timing Variations", "Disk Kinematics")
_NAME_OK = re.compile(r"^[A-Za-z0-9 .\-+]{1,40}$")

UNITS = {"pl_rade": "Earth radii", "pl_bmasse": "Earth masses (best estimate; may be M sin i)",
         "pl_orbper": "days", "pl_eqt": "K (model equilibrium temperature, not measured)",
         "sy_dist": "parsecs"}


def build_adql(name: str | None, method: str | None, year_min: int | None,
               year_max: int | None, limit: int) -> str:
    where = []
    if name:
        if not _NAME_OK.match(name):
            raise InputError("Name filter may contain letters, digits, spaces and . - + only.")
        where.append(f"lower(pl_name) like '%{name.lower()}%'")
    if method:
        if method not in METHODS:
            raise InputError("Unsupported discovery method.")
        where.append(f"discoverymethod = '{method}'")
    if year_min is not None:
        where.append(f"disc_year >= {int(year_min)}")
    if year_max is not None:
        where.append(f"disc_year <= {int(year_max)}")
    limit = max(1, min(int(limit), 500))
    q = f"select top {limit} {','.join(COLUMNS)} from pscomppars"
    if where:
        q += " where " + " and ".join(where)
    return q + " order by disc_year desc, pl_name"


async def search(settings: Settings, name: str | None = None, method: str | None = None,
                 year_min: int | None = None, year_max: int | None = None, limit: int = 100) -> dict:
    query = build_adql(name, method, year_min, year_max, limit)
    if hit := cache.get(f"exo:{query}", 3600):
        return envelope(hit.value, source="NASA Exoplanet Archive (TAP)", source_url=DOC_URL,
                        kind="catalogue", cached=True, retrieved_at=hit.retrieved_at)
    raw = await fetch(SRC, TAP_URL, settings, params={"query": query, "format": "json"})
    if not isinstance(raw, list):
        raise SourceError("invalid_response", "Unexpected exoplanet archive response shape.", SRC)
    registry.record_success(SRC)
    rows = [{c: r.get(c) for c in COLUMNS} for r in raw if isinstance(r, dict)]
    cache.set(f"exo:{query}", rows)
    return envelope({"planets": rows, "units": UNITS, "adql": query},
                    source="NASA Exoplanet Archive (TAP)", source_url=DOC_URL, kind="catalogue",
                    notes=["Null values mean the archive has no value; they are not zeros.",
                           "Planet parameters are published estimates with uncertainties not shown here."])


async def probe(settings: Settings) -> bool:
    res = await search(settings, limit=1)
    return isinstance(res["data"]["planets"], list)
