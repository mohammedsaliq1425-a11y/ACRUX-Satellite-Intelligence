from __future__ import annotations

from datetime import datetime, timezone


def envelope(data, *, source: str, source_url: str, kind: str = "observation",
             notes: list[str] | None = None, cached: bool = False,
             retrieved_at: str | None = None) -> dict:
    """Uniform response wrapper so the UI can always show source, time and kind.

    kind: observation | forecast | reanalysis | catalogue | derived | simulation
    """
    return {
        "data": data,
        "meta": {
            "source": source, "source_url": source_url, "kind": kind,
            "retrieved_at": retrieved_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "cached": cached, "notes": notes or [],
        },
    }
