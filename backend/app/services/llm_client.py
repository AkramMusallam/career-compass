"""
عميل موحّد لنماذج الذكاء الاصطناعي (OpenAI + Ollama المحلي).

الهدف:
- توحيد كافة استدعاءات الذكاء الاصطناعي في المشروع في مكان واحد بدلاً من تكرارها.
- دعم التبديل التلقائي (OpenAI كخيار أول عند توفر المفتاح، ثم Ollama المحلي كبديل).
- مهلة (timeout) محددة لكل طلب حتى لا يعلّق الطلب للأبد.
- keep_alive طويل حتى يبقى النموذج محمّلاً في الذاكرة.
"""
from __future__ import annotations

import logging
import os
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, NonCallableMagicMock

import httpx
import ollama

try:
    import openai
except ImportError:
    openai = None

from app.core.config import settings
from app.core.mongo import logs_collection, mongo_db

logger = logging.getLogger("career_compass.llm")

_client: ollama.Client | None = None
_client_lock = threading.Lock()

_OPENAI_FEATURE_ENV = {
    "cv": "OPENAI_CV_ENABLED",
    "interview": "OPENAI_INTERVIEW_ENABLED",
    "voice": "OPENAI_VOICE_ENABLED",
    "recruiter": "OPENAI_RECRUITER_ENABLED",
}
_TASK_TO_FEATURE = {
    "cv_extraction": "cv",
    "ats_evaluation": "cv",
    "cover_letter": "cv",
    "ats_optimize": "cv",
    "interview_reply": "interview",
    "interview_evaluation": "interview",
    "recruiter_fit_evaluation": "recruiter",
}
_EMAIL_PII_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE_PII_RE = re.compile(
    r"(?<!\w)(?:\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}|\b0\d{1,2}[\s.-]?\d{3}[\s.-]?\d{3,4}\b|\+?\d{9,15})(?!\w)"
)


def is_openai_feature_enabled(feature: str) -> bool:
    """Returns True only when OPENAI_API_KEY is configured and the explicit per-feature flag is enabled."""
    if not settings.OPENAI_API_KEY:
        return False
    env_name = _OPENAI_FEATURE_ENV.get(feature, "")
    if not env_name:
        return False
    setting_val = getattr(settings, env_name, None)
    if setting_val is not None:
        return bool(setting_val)
    return os.getenv(env_name, "0").strip().lower() in ("1", "true", "yes")


def has_cloud_ai_consent(user_id: int | None) -> bool:
    """Requires explicit user opt-in in Mongo `cloud_ai_consent` before transferring data to OpenAI."""
    if user_id is None:
        return False
    try:
        doc = mongo_db["cloud_ai_consent"].find_one({"_id": int(user_id)})
        return bool(doc and (doc.get("enabled") is True or doc.get("consented") is True))
    except Exception:
        return False


def redact_pii_text(text: str) -> str:
    """Minimizes PII (emails and phone numbers) prior to external AI egress."""
    if not text:
        return ""
    cleaned = _EMAIL_PII_RE.sub("[REDACTED_EMAIL]", str(text))
    return _PHONE_PII_RE.sub("[REDACTED_PHONE]", cleaned)


def _record_ai_inference_log(
    *,
    task: str,
    provider: str,
    model: str,
    status: str,
    latency_ms: int,
    error_type: str | None = None,
) -> None:
    """Persists sanitized AI inference telemetry (never stores raw prompts/CVs)."""
    try:
        logs_collection.insert_one(
            {
                "event": "ai_inference",
                "task": (task or "general")[:80],
                "provider": provider[:40],
                "model": model[:80],
                "status": status[:32],
                "latency_ms": max(0, int(latency_ms)),
                "error_type": error_type[:80] if error_type else None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception:
        pass


def get_client() -> ollama.Client:
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = ollama.Client(host=settings.OLLAMA_HOST, timeout=settings.OLLAMA_TIMEOUT)
    return _client


def is_ollama_mocked() -> bool:
    return isinstance(
        getattr(ollama.Client, "chat", None), (MagicMock, NonCallableMagicMock, AsyncMock)
    )


def strip_json_fences(raw_str: str) -> str:
    clean = (raw_str or "").strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    elif clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    return clean.strip()


def sanitize_prompt_input(value: Any, max_len: int | None = None) -> str:
    """Escapes angle brackets and strips control chars to prevent XML prompt-tag breakouts."""
    text = str(value or "")
    text = "".join(ch for ch in text if ch in ("\n", "\r", "\t") or ord(ch) >= 32)
    if max_len is not None:
        text = text[:max_len]
    return text.replace("<", "&lt;").replace(">", "&gt;")


def ollama_chat(
    messages: list[dict[str, Any]],
    *,
    json_mode: bool = False,
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout: float | None = None,
    task: str = "general",
) -> str:
    """يستدعي نموذج Ollama المحلي ويعيد نص الرد."""
    options: dict[str, Any] = {
        "num_ctx": settings.OLLAMA_NUM_CTX,
        "num_thread": 4,
    }
    if temperature is not None:
        options["temperature"] = temperature
    if max_tokens is not None:
        options["num_predict"] = max_tokens

    kwargs: dict[str, Any] = {
        "model": settings.OLLAMA_MODEL,
        "messages": messages,
        "options": options,
        "keep_alive": settings.OLLAMA_KEEP_ALIVE,
    }
    if json_mode:
        kwargs["format"] = "json"

    if settings.ENV == "testing" and not is_ollama_mocked():
        raise ConnectionError("Ollama network calls disabled in testing environment")

    client = (
        ollama.Client(host=settings.OLLAMA_HOST, timeout=timeout)
        if timeout is not None
        else get_client()
    )

    attempts = 1 if (settings.ENV == "testing" or timeout is not None) else 2
    for attempt in range(1, attempts + 1):
        started = time.monotonic()
        try:
            response = client.chat(**kwargs)
            elapsed = time.monotonic() - started
            logger.info("Ollama call ok in %.1fs (model=%s)", elapsed, settings.OLLAMA_MODEL)
            _record_ai_inference_log(
                task=task,
                provider="ollama",
                model=settings.OLLAMA_MODEL,
                status="ok",
                latency_ms=int(elapsed * 1000),
            )
            return response["message"]["content"] or ""
        except (httpx.ConnectError, httpx.RemoteProtocolError, ConnectionError) as exc:
            elapsed = time.monotonic() - started
            logger.warning("Ollama connection error (attempt %d/%d): %s", attempt, attempts, exc)
            if attempt == attempts:
                _record_ai_inference_log(
                    task=task,
                    provider="ollama",
                    model=settings.OLLAMA_MODEL,
                    status="error",
                    latency_ms=int(elapsed * 1000),
                    error_type=type(exc).__name__,
                )
                raise
            time.sleep(1.5)
        except httpx.TimeoutException as exc:
            elapsed = time.monotonic() - started
            logger.warning("Ollama call timed out after %.0fs", timeout or settings.OLLAMA_TIMEOUT)
            _record_ai_inference_log(
                task=task,
                provider="ollama",
                model=settings.OLLAMA_MODEL,
                status="timeout",
                latency_ms=int(elapsed * 1000),
                error_type=type(exc).__name__,
            )
            raise
    raise RuntimeError("unreachable")


def call_llm_messages(
    messages: list[dict[str, Any]],
    *,
    system_instruction: str = "",
    is_json: bool = False,
    temperature: float = 0.4,
    max_tokens: int | None = 220,
    timeout: float | None = 15.0,
    task: str = "general",
    user_id: int | None = None,
    feature: str | None = None,
) -> str:
    """دالة موحدة لاستدعاء OpenAI (عند تفعيل الميزة وموافقة المستخدم) مع التراجع إلى Ollama المحلي."""
    full_messages: list[dict[str, Any]] = []
    if system_instruction:
        full_messages.append({"role": "system", "content": system_instruction})
    full_messages.extend(messages)

    # الحفاظ على رسالة النظام + آخر 6 رسائل لضمان سرعة الاستجابة على CPU
    if len(full_messages) > 7:
        sys_msgs = [m for m in full_messages[:1] if m.get("role") == "system"]
        recent_msgs = [m for m in full_messages if m.get("role") != "system"][-6:]
        full_messages = sys_msgs + recent_msgs

    resolved_feature = feature or _TASK_TO_FEATURE.get(task, "")
    if (
        openai is not None
        and resolved_feature
        and is_openai_feature_enabled(resolved_feature)
        and has_cloud_ai_consent(user_id)
    ):
        egress_messages = [
            {**m, "content": redact_pii_text(m["content"])}
            if isinstance(m.get("content"), str)
            else m
            for m in full_messages
        ]
        started = time.monotonic()
        try:
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY, timeout=timeout or 15.0)
            kwargs: dict[str, Any] = {
                "model": "gpt-3.5-turbo",
                "messages": egress_messages,
                "temperature": temperature,
            }
            if max_tokens is not None:
                kwargs["max_tokens"] = max_tokens
            if is_json:
                kwargs["response_format"] = {"type": "json_object"}

            resp = client.chat.completions.create(**kwargs)
            elapsed = time.monotonic() - started
            _record_ai_inference_log(
                task=task,
                provider="openai",
                model="gpt-3.5-turbo",
                status="ok",
                latency_ms=int(elapsed * 1000),
            )
            return resp.choices[0].message.content or ""
        except Exception as exc:
            elapsed = time.monotonic() - started
            _record_ai_inference_log(
                task=task,
                provider="openai",
                model="gpt-3.5-turbo",
                status="fallback",
                latency_ms=int(elapsed * 1000),
                error_type=type(exc).__name__,
            )
            logger.warning("OpenAI call failed (%s), falling back to Ollama...", exc)

    return ollama_chat(
        full_messages,
        json_mode=is_json,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
        task=task,
    )


def call_llm(
    prompt: str,
    system_prompt: str,
    is_json: bool = False,
    max_tokens: int | None = 220,
    timeout: float | None = 15.0,
    task: str = "general",
    user_id: int | None = None,
    feature: str | None = None,
) -> str:
    """واجهة مختصرة لإرسال prompt + system_prompt عبر العميل الموحّد."""
    return call_llm_messages(
        [{"role": "user", "content": prompt}],
        system_instruction=system_prompt,
        is_json=is_json,
        temperature=0.4,
        max_tokens=max_tokens,
        timeout=timeout,
        task=task,
        user_id=user_id,
        feature=feature,
    )


def warmup_model_async() -> None:
    """يحمّل النموذج في الذاكرة في الخلفية دون تأخير إقلاع التطبيق."""
    all_cloud_enabled = all(
        is_openai_feature_enabled(f) for f in ("cv", "interview", "voice", "recruiter")
    )
    if not settings.OLLAMA_WARMUP or all_cloud_enabled or settings.ENV == "testing":
        return

    def _run() -> None:
        try:
            get_client().generate(model=settings.OLLAMA_MODEL, prompt="", keep_alive=settings.OLLAMA_KEEP_ALIVE)
            logger.info("Ollama model '%s' warmed up and pinned in memory.", settings.OLLAMA_MODEL)
        except Exception as exc:
            logger.warning("Ollama warm-up skipped: %s", exc)

    threading.Thread(target=_run, name="ollama-warmup", daemon=True).start()
