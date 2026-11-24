"""Optional persistence through Supabase's PostgREST API (backend-only).

Design notes
* Uses the *service* key, which bypasses Row Level Security. It therefore must stay on the
  backend; it is never sent to the browser. Tables have RLS enabled with NO policies, so the
  public anon/publishable key cannot read or write them (see docs/supabase/schema.sql).
* The app has no user accounts (single-user local tool), so rows are not per-user.
* Only three fixed tables are reachable and ids are validated as UUIDs, so user input cannot
  alter the PostgREST filter or table name.
STATUS: written from the public docs; NOT executed against a real Supabase project in the build sandbox.
"""
from __future__ import annotations

from ..core.config import Settings
from ..core.errors import InputError, SourceError
from ..core.http import fetch
from ..services.source_registry import registry
from ..services.storage import TABLES, validate_uuid
from .common import envelope

SRC = "supabase"
DOC_URL = "https://supabase.com/docs/guides/api"
SCHEMA_HINT = ("Run docs/supabase/schema.sql in the Supabase SQL editor to create the tables, "
               "then retry.")


def require_configured(settings: Settings) -> None:
    if not (settings.supabase_url and settings.supabase_service_key):
        raise SourceError("not_configured",
                          "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env "
                          "(optional: Project Acrux works without a database).", SRC)


def _headers(settings: Settings, *, write: bool = False) -> dict[str, str]:
    key = settings.supabase_service_key or ""
    h = {"apikey": key}
    # Legacy service_role keys are JWTs and may be sent as a Bearer token; newer
    # non-JWT "secret" keys are accepted through the apikey header alone.
    if key.startswith("eyJ"):
        h["Authorization"] = f"Bearer {key}"
    if write:
        h["Prefer"] = "return=representation"
    return h


def _url(settings: Settings, table: str) -> str:
    if table not in TABLES:
        raise InputError("Unknown table.")
    return f"{settings.supabase_url}/rest/v1/{table}"


async def _call(settings: Settings, table: str, **kw):
    try:
        return await fetch(SRC, _url(settings, table), settings, soft_statuses=(404,), **kw)
    except SourceError as e:
        if e.kind == "not_found":
            raise SourceError("not_found", f"Table '{table}' was not found. {SCHEMA_HINT}", SRC, 404)
        raise


def _rows(raw: object) -> list[dict]:
    if not isinstance(raw, list):
        raise SourceError("invalid_response", "Unexpected response from Supabase.", SRC)
    return [r for r in raw if isinstance(r, dict)]


async def list_rows(settings: Settings, table: str, limit: int = 50) -> dict:
    require_configured(settings)
    limit = max(1, min(int(limit), 200))
    raw = await _call(settings, table, headers=_headers(settings),
                      params={"select": "*", "order": "created_at.desc", "limit": limit})
    rows = _rows(raw)
    registry.record_success(SRC)
    return envelope(rows, source="Supabase (user-saved data)", source_url=DOC_URL, kind="derived",
                    notes=["User-saved records; not source observations."])


async def insert_row(settings: Settings, table: str, row: dict) -> dict:
    require_configured(settings)
    raw = await _call(settings, table, method="POST", headers=_headers(settings, write=True), json_body=row)
    rows = _rows(raw)
    if not rows:
        raise SourceError("invalid_response", "Supabase did not return the saved record.", SRC)
    registry.record_success(SRC)
    return envelope(rows[0], source="Supabase (user-saved data)", source_url=DOC_URL, kind="derived")


async def delete_row(settings: Settings, table: str, row_id: str) -> dict:
    require_configured(settings)
    rid = validate_uuid(row_id)
    raw = await _call(settings, table, method="DELETE", headers=_headers(settings, write=True),
                      params={"id": f"eq.{rid}"})
    deleted = _rows(raw)
    registry.record_success(SRC)
    return {"deleted": len(deleted), "id": rid}


async def probe(settings: Settings) -> bool:
    """Reads one row from each table: proves URL, key and schema together."""
    require_configured(settings)
    for t in sorted(TABLES):
        await _call(settings, t, headers=_headers(settings), params={"select": "id", "limit": 1})
    registry.record_success(SRC)
    return True
