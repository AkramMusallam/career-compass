"""
حماية الخادم: تحديد معدل الطلبات (Sliding-Window Rate Limiter) وترويسات الأمان القياسية.
"""
from __future__ import annotations

import ipaddress
import threading
import time
from collections import defaultdict, deque

from fastapi import Request, status
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings


def is_trusted_proxy_ip(client_ip: str, trusted_proxies: set[str]) -> bool:
    """يتحقق مما إذا كان عنوان IP ينتمي لقائمة أو نطاقات البروكسي الموثوقة (تدعم عناوين مفردة أو CIDR)."""
    if client_ip in trusted_proxies:
        return True
    try:
        addr = ipaddress.ip_address(client_ip)
        for net in trusted_proxies:
            try:
                if "/" in net and addr in ipaddress.ip_network(net, strict=False):
                    return True
            except ValueError:
                pass
    except ValueError:
        pass
    return False


def _is_valid_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def _get_client_ip(request: Request) -> str:
    """Extracts client IP safely from trusted proxy headers (rightmost untrusted X-Forwarded-For)."""
    client_ip = request.client.host if request.client else "unknown"
    if not is_trusted_proxy_ip(client_ip, settings.TRUSTED_PROXY_IPS):
        return client_ip

    real_ip = request.headers.get("X-Real-IP", "").strip()
    if real_ip and _is_valid_ip(real_ip) and not is_trusted_proxy_ip(real_ip, settings.TRUSTED_PROXY_IPS):
        return real_ip

    xff_raw = request.headers.get("X-Forwarded-For", "")
    if xff_raw:
        candidates = [part.strip() for part in xff_raw.split(",") if part.strip()]
        for candidate in reversed(candidates):
            if _is_valid_ip(candidate) and not is_trusted_proxy_ip(candidate, settings.TRUSTED_PROXY_IPS):
                return candidate
        for candidate in reversed(candidates):
            if _is_valid_ip(candidate):
                return candidate
    return client_ip


def _extract_rate_limit_subject(request: Request, client_ip: str) -> str:
    """Keys rate-limit buckets by verified JWT sub + client IP, never raw unverified headers."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            try:
                payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
                sub = payload.get("sub")
                if payload.get("type") == "access" and sub is not None:
                    return f"user:{sub}:{client_ip}"
            except JWTError:
                pass
    return f"ip:{client_ip}"


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
# المسارات الثقيلة والحساسة (حماية للذكاء الاصطناعي والقرص والمعالج وبوابات الدفع والشركات والدعم)
HEAVY_PREFIXES = (
    "/upload-cv",
    "/extract",
    "/analyze",
    "/interview",
    "/recruiter",
    "/extension",
    "/subscriptions/checkout-session",
    "/subscriptions/webhook",
    "/shared",
    "/companies",
    "/support",
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        client_ip = _get_client_ip(request)

        if (path in AUTH_PATHS and request.method == "POST") or (
            path == "/settings/password" and request.method == "PUT"
        ):
            allowed, retry_after = rate_limiter.is_allowed(f"auth:{client_ip}:{path}", max_requests=15, window_seconds=60.0)
            if not allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many authentication attempts. Please try again later."},
                    headers={"Retry-After": str(retry_after)},
                )
        elif path.startswith(HEAVY_PREFIXES) and request.method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
            subject_key = _extract_rate_limit_subject(request, client_ip)
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
        response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        if settings.ENV == "production" or request.url.path not in ("/docs", "/redoc"):
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
            )
        if settings.ENV == "production":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response
