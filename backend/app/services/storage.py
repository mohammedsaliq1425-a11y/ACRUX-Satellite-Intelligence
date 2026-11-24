"""Pure validation/row-building for the optional Supabase store (no network, easy to test)."""
from __future__ import annotations

import json
import re
import uuid

from ..core.errors import InputError, scrub

TABLES = frozenset({"saved_locations", "saved_reports", "simulation_runs"})
REPORT_TYPES = ("earth_observation", "wildfire", "weather", "telemetry", "astronomy", "multimodal")
MAX_PAYLOAD_BYTES = 200_000
_UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def validate_uuid(value: str) -> str:
    if not isinstance(value, str) or not _UUID.match(value):
        raise InputError("id must be a UUID.")
    return str(uuid.UUID(value))


def location_row(name: str, latitude: float, longitude: float, notes: str | None) -> dict:
    name = (name or "").strip()
    if not 1 <= len(name) <= 80:
        raise InputError("Location name must be 1-80 characters.")
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise InputError("Latitude must be in [-90, 90] and longitude in [-180, 180].")
    notes = (notes or "").strip()
    if len(notes) > 500:
        raise InputError("Notes are limited to 500 characters.")
    return {"name": name, "latitude": latitude, "longitude": longitude, "notes": notes or None}


def report_row(title: str, report_type: str, payload: dict, contains_simulated: bool,
               secrets: list[str]) -> dict:
    title = (title or "").strip()
    if not 1 <= len(title) <= 120:
        raise InputError("Report title must be 1-120 characters.")
    if report_type not in REPORT_TYPES:
        raise InputError("Unsupported report type.")
    if not isinstance(payload, dict):
        raise InputError("Report payload must be a JSON object.")
    text = json.dumps(payload, default=str, ensure_ascii=False)
    if len(text.encode("utf-8")) > MAX_PAYLOAD_BYTES:
        raise InputError("Report is too large to save (limit 200 KB).")
    # Reports must never carry credentials, even if a caller accidentally included one.
    clean = json.loads(scrub(text, secrets))
    return {"title": title, "report_type": report_type, "payload": clean,
            "contains_simulated": bool(contains_simulated)}


def run_row(seed: int, config: dict, alerts: list[dict], component_status: dict) -> dict:
    """Summary of a simulated telemetry run (not the full sample series)."""
    return {"seed": int(seed), "config": config, "alerts": alerts,
            "component_status": component_status, "simulated": True}
