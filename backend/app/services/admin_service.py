"""
خدمة بوابة مدير النظام ومراقبة جودة الذكاء الاصطناعي وضبط قوالب الأوامر
(System Administrator Governance, AI Telemetry & Prompt Template Store).
"""
from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import func

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.mongo import (
    analysis_results_collection,
    extractions_collection,
    logs_collection,
    mongo_db,
    recruiter_jobs_collection,
)
from app.core.security import get_user_suspension, set_user_suspension
from app.models.mysql_models import User

logger = logging.getLogger("career_compass.admin")

PROMPT_CACHE_TTL_SECONDS = 30.0
_prompt_cache: dict[str, tuple[float, str]] = {}
_prompt_cache_lock = threading.Lock()

PROMPT_DEFINITIONS: dict[str, dict[str, str]] = {
    "cv_extraction": {
        "label": "استخراج بيانات السيرة الذاتية (CV Extraction)",
        "description": "التعليمات الأساسية لنموذج استخراج المهارات والخبرات والمشاريع بصيغة JSON.",
        "default_prompt": "You are a precise data extraction API that only outputs valid JSON.",
    },
    "ats_evaluation": {
        "label": "تقييم توافق أنظمة الفرز (ATS Evaluation)",
        "description": "التعليمات المنظمة لتقييم جودة السيرة الذاتية وتوافقها مع أنظمة ATS.",
        "default_prompt": "You are a precise JSON-only ATS evaluator.",
    },
    "cover_letter": {
        "label": "كتابة خطاب التغطية (Cover Letter Generator)",
        "description": "موجه كتابة خطاب التغطية الاحترافي الموجز المخصص لكل وظيفة.",
        "default_prompt": "You are a concise professional cover letter writer.",
    },
    "roadmap_generation": {
        "label": "توليد خطة التطوير 3 أشهر (AI Roadmap)",
        "description": "التعليمات الخاصة ببناء خطة التعلم لسد فجوات المهارات بصيغة JSON.",
        "default_prompt": "You are a career advisor API that strictly outputs JSON arrays.",
    },
    "interview_reply": {
        "label": "محاور المقابلات التقنية (Mock Interviewer)",
        "description": "شخصية وأسلوب المحاور التقني الذكي أثناء المقابلة الصوتية والنصية.",
        "default_prompt": (
            "أنت محاور تقني محترف وودود في Career Compass. "
            "اطرح سؤالاً تقنياً موجزاً ومحدداً في كل رد بالعربية أو الإنجليزية المهنية."
        ),
    },
    "interview_evaluation": {
        "label": "تقييم المقابلة النهائية (Interview Scorer)",
        "description": "تعليمات استخراج التقييم العددي ونقاط القوة والضعف والأجوبة النموذجية.",
        "default_prompt": "You are an expert technical interview evaluator that strictly outputs valid JSON in Arabic.",
    },
    "recruiter_fit_evaluation": {
        "label": "ملاءمة المرشح لبوابة الشركات (B2B Candidate Fit)",
        "description": "تعليمات نموذج النطاق لتقييم ملاءمة المرشحين لوظائف الشركات الإقليمية.",
        "default_prompt": (
            "أنت خبير توظيف تقني أول متخصص في أسواق التكنولوجيا الإقليمية والعالمية. "
            "أرجع تقييماً موضوعياً ومختصراً بصيغة JSON صالحة فقط."
        ),
    },
}


def _sanitize_system_prompt(raw: str) -> str:
    cleaned = "".join(ch for ch in str(raw or "") if ch in ("\n", "\r", "\t") or ord(ch) >= 32)
    cleaned = cleaned.replace("<", "").replace(">", "").strip()
    return cleaned


def invalidate_prompt_cache(key: Optional[str] = None) -> None:
    with _prompt_cache_lock:
        if key is None:
            _prompt_cache.clear()
        else:
            _prompt_cache.pop(key, None)


def get_effective_system_prompt(key: str, fallback: Optional[str] = None) -> str:
    """Returns active system prompt from Mongo override or curated default with short TTL cache."""
    defn = PROMPT_DEFINITIONS.get(key)
    default_val = fallback or (defn["default_prompt"] if defn else "")
    now = time.monotonic()

    with _prompt_cache_lock:
        cached = _prompt_cache.get(key)
        if cached and cached[0] > now:
            return cached[1]

    effective = default_val
    try:
        doc = mongo_db["prompt_templates"].find_one({"key": key}, {"system_prompt": 1})
        if doc and isinstance(doc.get("system_prompt"), str) and doc["system_prompt"].strip():
            effective = doc["system_prompt"].strip()
    except Exception:
        pass

    with _prompt_cache_lock:
        _prompt_cache[key] = (now + PROMPT_CACHE_TTL_SECONDS, effective)
    return effective


def list_prompt_templates() -> List[Dict[str, Any]]:
    stored_map: dict[str, dict[str, Any]] = {}
    for doc in mongo_db["prompt_templates"].find({}):
        if doc.get("key"):
            stored_map[doc["key"]] = doc

    items: List[Dict[str, Any]] = []
    for key, meta in PROMPT_DEFINITIONS.items():
        override = stored_map.get(key)
        is_customized = bool(override and isinstance(override.get("system_prompt"), str) and override["system_prompt"].strip())
        items.append(
            {
                "key": key,
                "label": meta["label"],
                "description": meta["description"],
                "default_prompt": meta["default_prompt"],
                "system_prompt": override["system_prompt"].strip() if is_customized else meta["default_prompt"],
                "is_customized": is_customized,
                "updated_at": override.get("updated_at") if override else None,
                "updated_by": override.get("updated_by") if override else None,
            }
        )
    return items


def update_prompt_template(key: str, system_prompt: str, actor_user_id: int) -> Dict[str, Any]:
    if key not in PROMPT_DEFINITIONS:
        raise ValueError(f"Unknown prompt template key: {key}")

    cleaned = _sanitize_system_prompt(system_prompt)
    if len(cleaned) < 10 or len(cleaned) > 2000:
        raise ValueError("system_prompt must be between 10 and 2000 characters")

    now_iso = datetime.now(timezone.utc).isoformat()
    mongo_db["prompt_templates"].update_one(
        {"key": key},
        {
            "$set": {
                "key": key,
                "system_prompt": cleaned,
                "updated_by": int(actor_user_id),
                "updated_at": now_iso,
            }
        },
        upsert=True,
    )
    invalidate_prompt_cache(key)
    logs_collection.insert_one(
        {
            "event": "admin_prompt_updated",
            "prompt_key": key,
            "actor_user_id": int(actor_user_id),
            "timestamp": now_iso,
        }
    )
    return next(item for item in list_prompt_templates() if item["key"] == key)


def reset_prompt_template(key: str, actor_user_id: int) -> Dict[str, Any]:
    if key not in PROMPT_DEFINITIONS:
        raise ValueError(f"Unknown prompt template key: {key}")

    mongo_db["prompt_templates"].delete_one({"key": key})
    invalidate_prompt_cache(key)
    logs_collection.insert_one(
        {
            "event": "admin_prompt_reset",
            "prompt_key": key,
            "actor_user_id": int(actor_user_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    return next(item for item in list_prompt_templates() if item["key"] == key)


def check_ollama_health() -> Dict[str, Any]:
    """Checks Ollama reachability and whether the configured domain model is present."""
    if settings.ENV == "testing":
        return {
            "status": "mocked_testing",
            "configured_model": settings.OLLAMA_MODEL,
            "model_loaded": True,
            "available_models": [settings.OLLAMA_MODEL],
        }
    try:
        base = settings.OLLAMA_HOST.rstrip("/")
        resp = httpx.get(f"{base}/api/tags", timeout=3.0)
        resp.raise_for_status()
        payload = resp.json() or {}
        names = [
            str(m.get("name"))
            for m in (payload.get("models") or [])
            if isinstance(m, dict) and m.get("name")
        ]
        target = settings.OLLAMA_MODEL
        loaded = any(n == target or n.split(":")[0] == target.split(":")[0] for n in names)
        return {
            "status": "healthy" if loaded else "model_missing",
            "configured_model": target,
            "model_loaded": loaded,
            "available_models": names[:20],
        }
    except Exception as exc:
        return {
            "status": "unreachable",
            "configured_model": settings.OLLAMA_MODEL,
            "model_loaded": False,
            "available_models": [],
            "error": type(exc).__name__,
        }


def _compute_ai_telemetry_summary() -> Dict[str, Any]:
    docs = list(
        logs_collection.find(
            {"event": "ai_inference"},
            {"task": 1, "provider": 1, "model": 1, "status": 1, "latency_ms": 1, "_id": 0},
        ).sort("timestamp", -1).limit(500)
    )
    total = len(docs)
    if total == 0:
        return {
            "total_calls": 0,
            "ok_calls": 0,
            "error_or_fallback_calls": 0,
            "avg_latency_ms": 0,
            "p95_latency_ms": 0,
            "by_task": {},
        }

    latencies = sorted(int(d.get("latency_ms") or 0) for d in docs)
    ok_calls = sum(1 for d in docs if d.get("status") == "ok")
    err_calls = total - ok_calls
    avg_lat = int(round(sum(latencies) / total))
    p95_idx = min(total - 1, max(0, int(0.95 * (total - 1))))

    by_task: dict[str, dict[str, Any]] = {}
    for d in docs:
        task_name = str(d.get("task") or "general")
        entry = by_task.setdefault(task_name, {"calls": 0, "ok": 0, "errors": 0, "_lat_sum": 0})
        entry["calls"] += 1
        if d.get("status") == "ok":
            entry["ok"] += 1
        else:
            entry["errors"] += 1
        entry["_lat_sum"] += int(d.get("latency_ms") or 0)

    clean_by_task = {
        k: {
            "calls": v["calls"],
            "ok": v["ok"],
            "errors": v["errors"],
            "avg_latency_ms": int(round(v["_lat_sum"] / max(1, v["calls"]))),
        }
        for k, v in by_task.items()
    }

    return {
        "total_calls": total,
        "ok_calls": ok_calls,
        "error_or_fallback_calls": err_calls,
        "avg_latency_ms": avg_lat,
        "p95_latency_ms": latencies[p95_idx],
        "by_task": clean_by_task,
    }


def get_admin_overview() -> Dict[str, Any]:
    with SessionLocal() as db:
        total_users = db.query(User).count()
        candidates_count = db.query(User).filter(func.lower(User.role) == "candidate").count()
        recruiters_count = db.query(User).filter(func.lower(User.role) == "recruiter").count()

    suspended_count = mongo_db["user_auth_state"].count_documents({"suspended": True})
    companies_pending = mongo_db["companies"].count_documents({"status": "pending"})
    companies_approved = mongo_db["companies"].count_documents({"status": "approved"})
    companies_rejected = mongo_db["companies"].count_documents({"status": "rejected"})
    now_iso = datetime.now(timezone.utc).isoformat()
    active_grants = mongo_db["support_grants"].count_documents(
        {"revoked": False, "expires_at": {"$gt": now_iso}}
    )

    return {
        "users": {
            "total": total_users,
            "candidates": candidates_count,
            "recruiters": recruiters_count,
            "suspended": suspended_count,
        },
        "companies": {
            "pending": companies_pending,
            "approved": companies_approved,
            "rejected": companies_rejected,
        },
        "content": {
            "extractions": extractions_collection.count_documents({}),
            "analyses": analysis_results_collection.count_documents({}),
            "recruiter_jobs_total": recruiter_jobs_collection.count_documents({}),
            "recruiter_jobs_active": recruiter_jobs_collection.count_documents({"status": "active"}),
            "active_support_grants": active_grants,
        },
        "ai_telemetry": _compute_ai_telemetry_summary(),
        "ollama": check_ollama_health(),
    }


def list_admin_users(
    *,
    q: Optional[str] = None,
    role: Optional[str] = None,
    suspended: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    owner_doc = mongo_db["platform_owner"].find_one({"_id": "owner"})
    owner_user_id = owner_doc.get("user_id") if owner_doc else None

    auth_states = {
        int(doc["_id"]): doc
        for doc in mongo_db["user_auth_state"].find({}, {"suspended": 1, "suspended_reason": 1, "suspended_at": 1})
        if doc.get("_id") is not None
    }

    with SessionLocal() as db:
        query = db.query(User)
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            query = query.filter((User.full_name.ilike(pattern)) | (User.email.ilike(pattern)))
        if role and role.strip():
            query = query.filter(func.lower(User.role) == role.strip().lower())
        all_users = query.order_by(User.id.desc()).all()
        for u in all_users:
            db.expunge(u)

    analysis_counts: dict[int, int] = {}
    for doc in analysis_results_collection.find({}, {"user_id": 1, "_id": 0}):
        uid = doc.get("user_id")
        if uid is not None:
            try:
                uid_int = int(uid)
                analysis_counts[uid_int] = analysis_counts.get(uid_int, 0) + 1
            except (TypeError, ValueError):
                pass

    rows: List[Dict[str, Any]] = []
    for u in all_users:
        state = auth_states.get(u.id, {})
        is_susp = bool(state.get("suspended", False))
        if suspended is not None and is_susp != suspended:
            continue
        rows.append(
            {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role": getattr(u, "role", "candidate") or "candidate",
                "company_name": getattr(u, "company_name", None),
                "target_role": getattr(u, "target_role", None),
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "analyses_count": analysis_counts.get(u.id, 0),
                "is_platform_owner": bool(owner_user_id is not None and u.id == owner_user_id),
                "suspended": is_susp,
                "suspended_reason": state.get("suspended_reason") if is_susp else None,
                "suspended_at": state.get("suspended_at") if is_susp else None,
            }
        )

    total = len(rows)
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "users": rows[offset : offset + limit],
    }


def update_user_suspension(
    *,
    user_id: int,
    suspended: bool,
    reason: Optional[str],
    actor_user_id: int,
) -> Dict[str, Any]:
    owner_doc = mongo_db["platform_owner"].find_one({"_id": "owner"})
    if user_id == actor_user_id or (owner_doc and owner_doc.get("user_id") == user_id):
        raise ValueError("Cannot suspend platform owner account")

    with SessionLocal() as db:
        target = db.query(User).filter(User.id == user_id).first()
        if not target:
            raise LookupError("User not found")

    result = set_user_suspension(
        user_id=user_id,
        suspended=suspended,
        reason=reason,
        actor_id=actor_user_id,
    )
    logs_collection.insert_one(
        {
            "event": "admin_user_suspension",
            "target_user_id": int(user_id),
            "suspended": bool(suspended),
            "reason": result.get("suspended_reason"),
            "actor_user_id": int(actor_user_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    return result


def list_ai_logs(
    *,
    task: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    query: dict[str, Any] = {"event": "ai_inference"}
    if task and task.strip():
        query["task"] = task.strip()
    if status_filter and status_filter.strip():
        query["status"] = status_filter.strip()

    all_logs = list(logs_collection.find(query, {"_id": 0}).sort("timestamp", -1).limit(500))
    total = len(all_logs)
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "logs": all_logs[offset : offset + limit],
        "summary": _compute_ai_telemetry_summary(),
        "ollama": check_ollama_health(),
    }


def list_admin_support_grants(
    *,
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    query: dict[str, Any] = {}
    if status_filter and status_filter.strip():
        norm = status_filter.strip().lower()
        if norm == "active":
            query = {"revoked": False, "expires_at": {"$gt": now_iso}}
        elif norm == "revoked":
            query = {"revoked": True}
        elif norm == "expired":
            query = {"revoked": False, "expires_at": {"$lte": now_iso}}

    docs = list(mongo_db["support_grants"].find(query, {"_id": 0}).sort("created_at", -1).limit(500))
    user_ids = {
        int(d.get("candidate_user_id") if d.get("candidate_user_id") is not None else d.get("user_id"))
        for d in docs
        if d.get("candidate_user_id") is not None or d.get("user_id") is not None
    }
    email_map: dict[int, tuple[str, str]] = {}
    if user_ids:
        with SessionLocal() as db:
            for u in db.query(User).filter(User.id.in_(list(user_ids))).all():
                email_map[u.id] = (u.full_name, u.email)

    enriched = []
    for d in docs:
        uid = d.get("candidate_user_id") if d.get("candidate_user_id") is not None else d.get("user_id")
        name, email = email_map.get(uid, ("", ""))
        is_revoked = bool(d.get("revoked", False))
        expires_at = str(d.get("expires_at") or "")
        computed_status = "revoked" if is_revoked else ("active" if expires_at > now_iso else "expired")
        enriched.append({**d, "user_id": uid, "status": computed_status, "user_name": name, "user_email": email})

    total = len(enriched)
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "grants": enriched[offset : offset + limit],
    }


def revoke_support_grant(grant_id: str, actor_user_id: int) -> Dict[str, Any]:
    doc = mongo_db["support_grants"].find_one({"grant_id": grant_id}, {"_id": 0})
    if not doc:
        raise LookupError("Support grant not found")
    now_iso = datetime.now(timezone.utc).isoformat()
    mongo_db["support_grants"].update_one(
        {"grant_id": grant_id},
        {"$set": {"revoked": True, "revoked_at": now_iso, "revoked_by": int(actor_user_id)}},
    )
    logs_collection.insert_one(
        {
            "event": "support_grant_revoked_by_admin",
            "grant_id": grant_id,
            "target_user_id": doc.get("candidate_user_id") or doc.get("user_id"),
            "actor_user_id": int(actor_user_id),
            "timestamp": now_iso,
        }
    )
    updated = mongo_db["support_grants"].find_one({"grant_id": grant_id}, {"_id": 0}) or doc
    return {**updated, "revoked": True, "status": "revoked", "revoked_at": now_iso}
