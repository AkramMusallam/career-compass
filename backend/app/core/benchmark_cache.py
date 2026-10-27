"""
تخزين مؤقت خفيف لنتائج متوسط الأقران (Benchmark Cache) لمنع المسح المتكرر لـ MongoDB.
"""
from __future__ import annotations

import threading
import time
from typing import Any

from app.core.config import settings

_lock = threading.Lock()
_cached_value: Any = None
_cached_until: float = 0.0
CACHE_TTL_SECONDS = 30.0


def get_cached_benchmark() -> Any:
    if settings.ENV == "testing":
        return None
    with _lock:
        if _cached_value is not None and time.monotonic() < _cached_until:
            return _cached_value
        return None


def set_cached_benchmark(value: Any) -> None:
    if settings.ENV == "testing":
        return
    global _cached_value, _cached_until
    with _lock:
        _cached_value = value
        _cached_until = time.monotonic() + CACHE_TTL_SECONDS


def invalidate_benchmark_cache() -> None:
    global _cached_value, _cached_until
    with _lock:
        _cached_value = None
        _cached_until = 0.0
