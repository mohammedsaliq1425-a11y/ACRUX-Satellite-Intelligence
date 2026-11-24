"""Single choke-point for outbound HTTP.

* Only URLs built from constants in the integration modules are requested
  (user input is only ever placed in query parameters / validated path parts).
* Timeouts everywhere; redirects are not followed.
* Errors are translated to SourceError with *scrubbed*, user-safe messages
  (never the raw exception text, which can contain URLs with secrets).
* Every outcome is recorded in the source registry.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from ..services.source_registry import registry
from .config import Settings
from .errors import SourceError, classify_http_status

log = logging.getLogger("acrux.http")

SOFT_STATUS_KINDS = {404: "not_found", 300: "ambiguous"}


async def fetch(source_id: str, url: str, settings: Settings, *,
                params: dict[str, Any] | None = None,
                headers: dict[str, str] | None = None,
                method: str = "GET", json_body: Any = None,
                expect: str = "json", soft_statuses: tuple[int, ...] = (),
                timeout_s: float | None = None) -> Any:
    secrets = settings.secret_values()
    timeout = httpx.Timeout(timeout_s or settings.http_timeout_s)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            resp = await client.request(method, url, params=params, headers=headers,
                                        json=json_body)
    except httpx.TimeoutException:
        _fail(source_id, "timeout", "The data source did not respond in time.", secrets)
    except httpx.HTTPError:
        _fail(source_id, "unavailable", "Could not connect to the data source.", secrets)

    status = resp.status_code
    if status in soft_statuses:   # server answered meaningfully (e.g. object not found)
        registry.record_success(source_id, usable=False)
        raise SourceError(SOFT_STATUS_KINDS.get(status, "invalid_response"),
                          "The data source reports no unique match for this request.",
                          source_id, status)
    kind = classify_http_status(status)
    if kind:
        msg = {
            "auth_failed": "The data source rejected the credentials (check the API key).",
            "rate_limited": "The data source rate limit was reached. Wait and retry.",
            "bad_request": "The data source rejected the request parameters.",
            "unavailable": "The data source is temporarily unavailable.",
            "not_found": "The data source returned 'not found' for this request.",
        }.get(kind, f"Unexpected response from the data source (HTTP {status}).")
        _fail(source_id, kind, msg, secrets, status)

    if expect == "text":
        return resp.text
    try:
        return resp.json()
    except ValueError:
        _fail(source_id, "invalid_response",
              "The data source returned a response that is not valid JSON.", secrets, status)


def _fail(source_id: str, kind: str, message: str, secrets: list[str],
          status: int | None = None):
    registry.record_failure(source_id, kind, message, secrets)
    log.warning("source=%s kind=%s upstream_status=%s", source_id, kind, status)
    raise SourceError(kind, message, source_id, status)
