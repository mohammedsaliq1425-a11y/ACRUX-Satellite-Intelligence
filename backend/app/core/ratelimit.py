"""Sliding-window rate limiter (per key, in memory). Used on the AI endpoint so a
local bug or runaway loop cannot burn through an OpenRouter budget."""
from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Callable


class RateLimiter:
    def __init__(self, max_calls: int, window_s: float,
                 clock: Callable[[], float] = time.monotonic):
        self.max_calls, self.window_s, self._clock = max_calls, window_s, clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> tuple[bool, float]:
        """Return (allowed, retry_after_seconds)."""
        now = self._clock()
        q = self._hits[key]
        while q and now - q[0] >= self.window_s:
            q.popleft()
        if len(q) >= self.max_calls:
            return False, max(0.0, self.window_s - (now - q[0]))
        q.append(now)
        return True, 0.0
