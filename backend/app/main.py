"""
نقطة الدخول الرئيسية لتطبيق Career Compass API.

تشغيل محلي:
    uvicorn app.main:app --reload
"""
from __future__ import annotations

import logging
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.mongo import ensure_mongo_indexes, mongo_db
from app.core.rate_limit import RateLimitMiddleware, SecurityHeadersMiddleware
from app.api.routes import (
    admin,
    analyze,
    assessment,
    auth,
    benchmark,
    cv,
    history,
    interview,
    jobs_router,
    profile,
    settings_router,
    shared,
    recruiter,
    companies,
    support,
    subscriptions,
    extension,
)

_TOKEN_PATH_RE = re.compile(
    r"(/(?:reset-password|company-invitation|shared|verify-email)/)[^\s\"'&?#]+",
    re.IGNORECASE,
)
_BEARER_TOKEN_RE = re.compile(r"(Bearer\s+)[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE)
_QUERY_SECRET_RE = re.compile(
    r"([?&](?:app_id|app_key|token|access_token)=)[^&\s\"']+",
    re.IGNORECASE,
)


def redact_sensitive_text(text: str) -> str:
    """Redacts bearer tokens, URL token paths, and Adzuna query credentials from log strings."""
    if not text:
        return ""
    cleaned = _TOKEN_PATH_RE.sub(r"\1[REDACTED]", str(text))
    cleaned = _BEARER_TOKEN_RE.sub(r"\1[REDACTED]", cleaned)
    cleaned = _QUERY_SECRET_RE.sub(r"\1[REDACTED]", cleaned)
    return cleaned


class CredentialRedactingFilter(logging.Filter):
    """Logging filter that strips sensitive tokens and provider credentials from log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            rendered = record.getMessage()
            record.msg = redact_sensitive_text(rendered)
            record.args = None
        except Exception:
            if isinstance(record.msg, str):
                record.msg = redact_sensitive_text(record.msg)
            if isinstance(record.args, tuple):
                record.args = tuple(
                    redact_sensitive_text(a) if isinstance(a, str) else a for a in record.args
                )
        if record.exc_text:
            record.exc_text = redact_sensitive_text(record.exc_text)
        return True


def _install_log_redaction() -> CredentialRedactingFilter:
    redactor = CredentialRedactingFilter()
    for logger_name in (None, "uvicorn.access", "uvicorn.error", "httpx", "career_compass"):
        target = logging.getLogger(logger_name)
        if not any(isinstance(f, CredentialRedactingFilter) for f in target.filters):
            target.addFilter(redactor)
        for handler in target.handlers:
            if not any(isinstance(f, CredentialRedactingFilter) for f in handler.filters):
                handler.addFilter(redactor)
    return redactor


logging.basicConfig(level=logging.INFO)
_credential_redacting_filter = _install_log_redaction()
logger = logging.getLogger("career_compass")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_mongo_indexes()
    if settings.ENV in ("development", "testing"):
        from app.seed.seed_runner import run_seed

        try:
            run_seed()
        except Exception:  # لا نُفشل الإقلاع بسبب مشكلة في التعبئة الأولية فقط
            logger.exception("Seed data insertion skipped due to an error")
    from app.services.llm_client import warmup_model_async

    warmup_model_async()
    yield


_is_production = settings.ENV == "production"

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Career Compass — منصة تحليل السيرة الذاتية والتوصية بالمسار المهني المناسب.",
    lifespan=lifespan,
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

_cors_origins = list(settings.CORS_ORIGINS) + [
    f"chrome-extension://{ext_id}" for ext_id in settings.ALLOWED_EXTENSION_IDS
]
_cors_origin_regex = (
    r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|chrome-extension://[a-z]{32})$"
    if settings.ENV in ("development", "testing")
    else None
)

# Register RateLimitMiddleware before SecurityHeadersMiddleware (LIFO execution -> SecurityHeaders wraps 429s)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """يحوّل أخطاء تحقق Pydantic إلى شكل {"detail": "..."}"  الموحّد مع باقي أخطاء الـ API."""
    first_error = exc.errors()[0] if exc.errors() else {"msg": "Invalid request"}
    field = ".".join(str(x) for x in first_error.get("loc", [])[1:])
    message = f"{field}: {first_error.get('msg')}" if field else first_error.get("msg")
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": message})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    safe_url = redact_sensitive_text(str(request.url))
    logger.error(
        "Unhandled error (%s) while processing %s %s",
        type(exc).__name__,
        request.method,
        safe_url,
    )
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "Internal server error"})


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/health", tags=["Health"])
def health_check():
    checks = {"sql": "ok", "mongo": "ok"}
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        checks["sql"] = "degraded"

    try:
        _ = mongo_db.list_collection_names()
    except Exception:
        checks["mongo"] = "degraded"

    overall = "healthy" if all(v == "ok" for v in checks.values()) else "degraded"
    http_status = status.HTTP_200_OK if overall == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(status_code=http_status, content={"status": overall, "checks": checks})


app.include_router(auth.router)
app.include_router(cv.router)
app.include_router(assessment.router)
app.include_router(analyze.router)
app.include_router(history.router)
app.include_router(profile.router)
app.include_router(settings_router.router)
app.include_router(shared.router)
app.include_router(benchmark.router)
app.include_router(interview.router)
app.include_router(jobs_router.router)
app.include_router(recruiter.router)
app.include_router(companies.router)
app.include_router(support.router)
app.include_router(subscriptions.router)
app.include_router(extension.router)
app.include_router(admin.router)
