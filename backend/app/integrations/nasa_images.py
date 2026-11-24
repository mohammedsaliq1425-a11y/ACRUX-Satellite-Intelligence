"""NASA Image and Video Library search (images-api.nasa.gov, no key).
Docs: https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf
STATUS: written from the public docs; NOT executed against the live API in the build sandbox.
NASA media is generally free to use but individual items can carry restrictions; always show credit.
"""
from __future__ import annotations

from ..core.cache import cache
from ..core.config import Settings
from ..core.errors import InputError, SourceError
from ..core.http import fetch
from ..services.source_registry import registry
from .common import envelope

SRC = "nasa_images"
URL = "https://images-api.nasa.gov/search"
DOC_URL = "https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf"


def normalize(raw: dict) -> list[dict]:
    items = ((raw.get("collection") or {}).get("items")) or []
    out = []
    for it in items:
        d = (it.get("data") or [{}])[0]
        preview = next((l.get("href") for l in (it.get("links") or [])
                        if l.get("rel") == "preview"), None)
        out.append({
            "nasa_id": d.get("nasa_id"), "title": d.get("title"), "description": d.get("description"),
            "date_created": d.get("date_created"), "center": d.get("center"),
            "photographer": d.get("photographer"), "secondary_creator": d.get("secondary_creator"),
            "keywords": d.get("keywords"), "preview_url": preview, "media_type": d.get("media_type"),
        })
    return out


async def search_images(settings: Settings, q: str, page_size: int = 12, page: int = 1) -> dict:
    q = q.strip()
    if not 2 <= len(q) <= 80:
        raise InputError("Search text must be 2-80 characters.")
    page_size, page = max(1, min(page_size, 50)), max(1, min(page, 50))
    key = f"nasaimg:{q.lower()}:{page_size}:{page}"
    if hit := cache.get(key, 3600):
        return envelope(hit.value, source="NASA Image and Video Library", source_url=DOC_URL,
                        kind="catalogue", cached=True, retrieved_at=hit.retrieved_at)
    raw = await fetch(SRC, URL, settings, params={"q": q, "media_type": "image",
                                                   "page_size": page_size, "page": page})
    if not isinstance(raw, dict) or "collection" not in raw:
        raise SourceError("invalid_response", "Unexpected image-library response shape.", SRC)
    registry.record_success(SRC)
    data = normalize(raw)
    cache.set(key, data)
    return envelope(data, source="NASA Image and Video Library", source_url=DOC_URL, kind="catalogue",
                    notes=["These are catalogue images/illustrations, not a live view of any location.",
                           "Credit the creator/center shown; some items have usage restrictions."])


async def probe(settings: Settings) -> bool:
    res = await search_images(settings, "earth", page_size=1)
    return isinstance(res["data"], list)
