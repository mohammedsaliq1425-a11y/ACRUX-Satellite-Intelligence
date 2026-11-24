"""OpenRouter chat completions (backend-only; the key never reaches the browser).
Docs: https://openrouter.ai/docs/api-reference/overview
STATUS: written from the public docs; NOT executed against the live API in the build sandbox.
The model id comes from OPENROUTER_MODEL; nothing is hardcoded or assumed free.
"""
from __future__ import annotations

from ..core.config import Settings
from ..core.errors import SourceError
from ..core.http import fetch
from ..services.source_registry import registry
from .common import envelope

SRC = "openrouter"
CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
KEY_URL = "https://openrouter.ai/api/v1/key"
DOC_URL = "https://openrouter.ai/docs"


def _headers(settings: Settings) -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.openrouter_site_url,
            "X-Title": settings.openrouter_app_name}


def require_configured(settings: Settings) -> None:
    if not settings.openrouter_api_key:
        raise SourceError("not_configured", "OPENROUTER_API_KEY is not set. The AI assistant is "
                          "disabled; the rest of Project Acrux works without it.", SRC)
    if not settings.openrouter_model:
        raise SourceError("not_configured", "OPENROUTER_MODEL is not set. Choose a current model id "
                          "from openrouter.ai/models and add it to .env.", SRC)


def extract_reply(raw: object) -> str:
    """Validate the provider response and return the assistant text."""
    try:
        text = raw["choices"][0]["message"]["content"]  # type: ignore[index]
    except (KeyError, IndexError, TypeError):
        err = raw.get("error") if isinstance(raw, dict) else None
        if isinstance(err, dict):
            raise SourceError("unavailable", "The model provider returned an error for this request.", SRC)
        raise SourceError("invalid_response", "The model provider returned an unexpected response.", SRC)
    if not isinstance(text, str) or not text.strip():
        raise SourceError("invalid_response", "The model returned an empty answer.", SRC)
    return text.strip()


async def chat(settings: Settings, messages: list[dict], max_tokens: int = 800,
               temperature: float = 0.3) -> dict:
    require_configured(settings)
    raw = await fetch(SRC, CHAT_URL, settings, method="POST", headers=_headers(settings),
                      json_body={"model": settings.openrouter_model, "messages": messages,
                                 "max_tokens": max_tokens, "temperature": temperature},
                      timeout_s=max(settings.http_timeout_s, 45.0))
    reply = extract_reply(raw)
    registry.record_success(SRC)
    return envelope({"reply": reply, "model": raw.get("model") or settings.openrouter_model},
                    source="OpenRouter", source_url=DOC_URL, kind="derived",
                    notes=["AI-generated text: an interpretation, not a measurement."])


async def probe(settings: Settings) -> bool:
    """Validate the key via GET /api/v1/key (not a billable completion)."""
    if not settings.openrouter_api_key:
        raise SourceError("not_configured", "OPENROUTER_API_KEY is not set.", SRC)
    raw = await fetch(SRC, KEY_URL, settings, headers=_headers(settings))
    ok = isinstance(raw, dict) and "data" in raw
    registry.record_success(SRC, usable=ok)
    return ok
