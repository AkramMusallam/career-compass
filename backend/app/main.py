"""
نقطة الدخول الرئيسية لتطبيق Career Compass API.

تشغيل محلي:
    uvicorn app.main:app --reload
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db
from app.core.mongo import ensure_mongo_indexes
from app.api.routes import analyze, assessment, auth, benchmark, cv, history, profile, settings_router, shared, interview, jobs_router

logging.basicConfig(level=logging.INFO)
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


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Career Compass — منصة تحليل السيرة الذاتية والتوصية بالمسار المهني المناسب.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
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
    logger.exception("Unhandled error while processing %s %s", request.method, request.url)
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "Internal server error"})


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}


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
