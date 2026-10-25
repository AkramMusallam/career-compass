"""
عميل موحّد لنموذج Ollama المحلي.

الهدف: جعل استدعاءات الذكاء الاصطناعي مستقرة وسريعة قدر الإمكان على سيرفر CPU:
- مهلة (timeout) محددة لكل طلب حتى لا يعلّق الطلب للأبد ويظهر للمستخدم "تعذر الاتصال بالخادم".
- keep_alive طويل حتى يبقى النموذج محمّلاً في الذاكرة (بدونه يُفرَّغ بعد 5 دقائق ويصبح الطلب التالي بطيئاً جداً).
- إعادة محاولة واحدة عند أخطاء الاتصال المؤقتة (مثل إعادة تشغيل حاوية ollama).
- تحميل مسبق (warm-up) للنموذج عند إقلاع التطبيق.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any

import httpx
import ollama

from app.core.config import settings

logger = logging.getLogger("career_compass.llm")

_client: ollama.Client | None = None
_client_lock = threading.Lock()


def get_client() -> ollama.Client:
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = ollama.Client(host=settings.OLLAMA_HOST, timeout=settings.OLLAMA_TIMEOUT)
    return _client


def ollama_chat(
    messages: list[dict[str, Any]],
    *,
    json_mode: bool = False,
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout: float | None = None,
) -> str:
    """يستدعي النموذج ويعيد نص الرد. يرفع استثناء عند الفشل ليتولى المستدعي المنطق الاحتياطي."""
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

    from unittest.mock import AsyncMock, MagicMock, NonCallableMagicMock

    if settings.ENV == "testing" and not isinstance(
        getattr(ollama.Client, "chat", None), (MagicMock, NonCallableMagicMock, AsyncMock)
    ):
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
            return response["message"]["content"] or ""
        except (httpx.ConnectError, httpx.RemoteProtocolError, ConnectionError) as exc:
            # خطأ اتصال مؤقت: نعيد المحاولة مرة واحدة فقط
            logger.warning("Ollama connection error (attempt %d/%d): %s", attempt, attempts, exc)
            if attempt == attempts:
                raise
            time.sleep(1.5)
        except httpx.TimeoutException:
            # لا نعيد المحاولة عند انتهاء المهلة حتى لا نضاعف زمن الانتظار على المستخدم
            logger.warning("Ollama call timed out after %.0fs", settings.OLLAMA_TIMEOUT)
            raise
    raise RuntimeError("unreachable")


def warmup_model_async() -> None:
    """يحمّل النموذج في الذاكرة في الخلفية دون تأخير إقلاع التطبيق."""
    if not settings.OLLAMA_WARMUP or settings.OPENAI_API_KEY or settings.ENV == "testing":
        return

    def _run() -> None:
        try:
            get_client().generate(model=settings.OLLAMA_MODEL, prompt="", keep_alive=settings.OLLAMA_KEEP_ALIVE)
            logger.info("Ollama model '%s' warmed up and pinned in memory.", settings.OLLAMA_MODEL)
        except Exception as exc:  # التطبيق يعمل بالمنطق الاحتياطي إن لم يتوفر النموذج
            logger.warning("Ollama warm-up skipped: %s", exc)

    threading.Thread(target=_run, name="ollama-warmup", daemon=True).start()
