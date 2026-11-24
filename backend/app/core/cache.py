"""Small in-memory TTL cache. Cached values are always reported as cached,
with the original retrieval time, so the UI never presents them as current."""
from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable


@dataclass
class CacheHit:
    value: Any
    retrieved_at: str
    age_s: float


class TTLCache:
    def __init__(self, max_items: int = 256, clock: Callable[[], float] = time.monotonic):
        self._d: dict[str, tuple[float, str, Any]] = {}
        self._max = max_items
        self._clock = clock

    def get(self, key: str, ttl_s: float) -> CacheHit | None:
        item = self._d.get(key)
        if not item:
            return None
        stored, retrieved_at, value = item
        age = self._clock() - stored
        if age > ttl_s:
            self._d.pop(key, None)
            return None
        return CacheHit(value, retrieved_at, age)

    def set(self, key: str, value: Any) -> str:
        if len(self._d) >= self._max:
            oldest = min(self._d, key=lambda k: self._d[k][0])
            self._d.pop(oldest, None)
        retrieved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self._d[key] = (self._clock(), retrieved_at, value)
        return retrieved_at

    def clear(self) -> None:
        self._d.clear()


cache = TTLCache()
