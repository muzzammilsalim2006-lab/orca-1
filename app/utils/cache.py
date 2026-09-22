import threading
import time
from typing import Any


class TTLCache:
    """Tiny in-process TTL cache. Good enough for a prototype; swap for Redis later."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lock:
            entry = self._data.get(key)
            if entry and entry[1] > now:
                self.hits += 1
                return entry[0]
            if entry:
                self._data.pop(key, None)
            self.misses += 1
            return None

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        with self._lock:
            self._data[key] = (value, time.monotonic() + ttl_seconds)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def stats(self) -> dict:
        with self._lock:
            return {"entries": len(self._data), "hits": self.hits, "misses": self.misses}