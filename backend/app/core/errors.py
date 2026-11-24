"""Shared error types and helpers.

Error *kinds* are a small closed vocabulary so the frontend can render a
consistent, honest message for every external-data failure.
"""
from __future__ import annotations

from typing import Iterable

# kind -> HTTP status returned by *our* API
KIND_TO_HTTP = {
    "not_configured": 503,
    "auth_failed": 502,
    "rate_limited": 429,
    "unavailable": 503,
    "timeout": 504,
    "invalid_response": 502,
    "not_found": 404,
    "ambiguous": 409,
    "bad_request": 422,
}


class InputError(ValueError):
    """User-supplied input failed validation (maps to HTTP 422)."""


class SourceError(Exception):
    """An external data source could not provide usable data."""

    def __init__(self, kind: str, message: str, source_id: str | None = None,
                 upstream_status: int | None = None):
        super().__init__(message)
        self.kind = kind
        self.message = message
        self.source_id = source_id
        self.upstream_status = upstream_status

    @property
    def http_status(self) -> int:
        return KIND_TO_HTTP.get(self.kind, 502)

    def to_dict(self) -> dict:
        return {"error": {"kind": self.kind, "message": self.message,
                          "source": self.source_id}}


def classify_http_status(status: int) -> str | None:
    """Map an upstream HTTP status to an error kind (None = success)."""
    if 200 <= status < 300:
        return None
    if status in (401, 403):
        return "auth_failed"
    if status == 429:
        return "rate_limited"
    if status == 404:
        return "not_found"
    if status in (400, 422):
        return "bad_request"
    if status >= 500:
        return "unavailable"
    return "invalid_response"


def scrub(text: str, secrets: Iterable[str]) -> str:
    """Remove any known secret value from a string before it is logged/shown."""
    out = text or ""
    for s in secrets:
        if s and len(s) >= 4:
            out = out.replace(s, "***")
    return out
