"""
حماية الخادم: تحديد معدل الطلبات (Sliding-Window Rate Limiter) وترويسات الأمان القياسية.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings


class SlidingWindowRateLimiter:
    """محدد معدل طلبات خفيف وآمن للتزامن داخل الذاكرة (Thread-safe Sliding Window)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self.force_enable_in_tests: bool = False

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def is_allowed(self, key: str, max_requests: int, window_seconds: float) -> tuple[bool, int]:
        if settings.ENV == "testing" and not self.force_enable_in_tests:
            return True, 0

        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            # Periodic pruning to prevent unbounded memory growth from unique IPs
            if len(self._hits) > 10000:
                stale_keys = [k for k, q in self._hits.items() if not q or q[-1] <= cutoff]
                for k in stale_keys:
                    self._hits.pop(k, None)

            bucket = self._hits[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= max_requests:
                retry_after = max(1, int(window_seconds - (now - bucket[0])))
                return False, retry_after
            bucket.append(now)
            return True, 0


rate_limiter = SlidingWindowRateLimiter()

# المسارات الحساسة للمصادقة (حماية من Brute-Force و Email Bombing)
AUTH_PATHS = {"/login", "/register", "/forgot-password", "/reset-password"}
# المسارات الثقيلة (حماية للذكاء الاصطناعي والقرص والمعالج وبوابات الدفع والتوظيف)
HEAVY_PREFIXES = (
    "/upload-cv",
    "/extract",
    "/analyze",
    "/interview",
    "/recruiter",
    "/extension",
    "/subscriptions/checkout-session",
    "/subscriptions/webhook",
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"
        if client_ip in settings.TRUSTED_PROXY_IPS:
            client_ip = request.headers.get("X-Real-IP", "").strip() or request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or client_ip

        if path in AUTH_PATHS and request.method == "POST":
            allowed, retry_after = rate_limiter.is_allowed(f"auth:{client_ip}:{path}", max_requests=15, window_seconds=60.0)
            if not allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many authentication attempts. Please try again later."},
                    headers={"Retry-After": str(retry_after)},
                )
        elif path.startswith(HEAVY_PREFIXES) and request.method in ("POST", "GET"):
            auth_header = request.headers.get("Authorization", "")
            subject_key = auth_header[-24:] if auth_header else client_ip
            allowed, retry_after = rate_limiter.is_allowed(f"heavy:{subject_key}:{path}", max_requests=35, window_seconds=60.0)
            if not allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded. Please wait a moment before sending more requests."},
                    headers={"Retry-After": str(retry_after)},
                )

        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """يضيف ترويسات الأمان القياسية (OWASP Secure Headers) لكل استجابات الـ API."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=(), microphone=(self)")
        return response
