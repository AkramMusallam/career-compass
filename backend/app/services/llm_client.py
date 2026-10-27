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
import threading
import time
from typing import Any
from unittest.mock import AsyncMock, MagicMock, NonCallableMagicMock

import httpx
import ollama

try:
    import openai
except ImportError:
    openai = None

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


def ollama_chat(
    messages: list[dict[str, Any]],
    *,
    json_mode: bool = False,
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout: float | None = None,
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
            return response["message"]["content"] or ""
        except (httpx.ConnectError, httpx.RemoteProtocolError, ConnectionError) as exc:
            logger.warning("Ollama connection error (attempt %d/%d): %s", attempt, attempts, exc)
            if attempt == attempts:
                raise
            time.sleep(1.5)
        except httpx.TimeoutException:
            logger.warning("Ollama call timed out after %.0fs", timeout or settings.OLLAMA_TIMEOUT)
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
) -> str:
    """دالة موحدة لاستدعاء OpenAI (إن توفر المفتاح) مع التراجع التلقائي إلى Ollama المحلي."""
    full_messages: list[dict[str, Any]] = []
    if system_instruction:
        full_messages.append({"role": "system", "content": system_instruction})
    full_messages.extend(messages)

    # الحفاظ على رسالة النظام + آخر 6 رسائل لضمان سرعة الاستجابة على CPU
    if len(full_messages) > 7:
        sys_msgs = [m for m in full_messages[:1] if m.get("role") == "system"]
        recent_msgs = [m for m in full_messages if m.get("role") != "system"][-6:]
        full_messages = sys_msgs + recent_msgs

    if settings.OPENAI_API_KEY and openai is not None:
        try:
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY, timeout=timeout or 15.0)
            kwargs: dict[str, Any] = {
                "model": "gpt-3.5-turbo",
                "messages": full_messages,
                "temperature": temperature,
            }
            if max_tokens is not None:
                kwargs["max_tokens"] = max_tokens
            if is_json:
                kwargs["response_format"] = {"type": "json_object"}

            resp = client.chat.completions.create(**kwargs)
            return resp.choices[0].message.content or ""
        except Exception as exc:
            logger.warning("OpenAI call failed (%s), falling back to Ollama...", exc)

    return ollama_chat(
        full_messages,
        json_mode=is_json,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
    )


def call_llm(
    prompt: str,
    system_prompt: str,
    is_json: bool = False,
    max_tokens: int | None = 220,
    timeout: float | None = 15.0,
) -> str:
    """واجهة مختصرة لإرسال prompt + system_prompt عبر العميل الموحّد."""
    return call_llm_messages(
        [{"role": "user", "content": prompt}],
        system_instruction=system_prompt,
        is_json=is_json,
        temperature=0.4,
        max_tokens=max_tokens,
        timeout=timeout,
    )


def warmup_model_async() -> None:
    """يحمّل النموذج في الذاكرة في الخلفية دون تأخير إقلاع التطبيق."""
    if not settings.OLLAMA_WARMUP or settings.OPENAI_API_KEY or settings.ENV == "testing":
        return

    def _run() -> None:
        try:
            get_client().generate(model=settings.OLLAMA_MODEL, prompt="", keep_alive=settings.OLLAMA_KEEP_ALIVE)
            logger.info("Ollama model '%s' warmed up and pinned in memory.", settings.OLLAMA_MODEL)
        except Exception as exc:
            logger.warning("Ollama warm-up skipped: %s", exc)

    threading.Thread(target=_run, name="ollama-warmup", daemon=True).start()
