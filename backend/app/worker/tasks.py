"""
Batch 5.4/5.5 — مهمة Celery المجدولة أسبوعياً لإرسال تنبيهات البريد الإلكتروني.

مفصولة عمداً عن app/services/email_notifications.py: هذا الملف طبقة "Celery wrapper" رفيعة
فقط (فتح/إغلاق جلسة قاعدة بيانات + إعادة المحاولة عند الفشل)، بينما كل منطق العمل الفعلي
(بناء الملخص، توليد HTML، الإرسال عبر SMTP) يعيش في الخدمة، بحيث يمكن اختبار المنطق مباشرة
دون أي حاجة لـ Celery أو Redis (انظر tests/test_email_notifications.py).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.worker.celery_app import celery_app
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.mongo import cv_tasks_collection, extractions_collection, mongo_db, uploads_collection
from app.models.mysql_models import User
from app.services.cv_extraction import extract_cv_data
from app.services.email_notifications import send_weekly_progress_emails

logger = logging.getLogger("career_compass.tasks")


def _is_account_and_upload_active(file_id: str, user_id: int) -> tuple[bool, dict | None]:
    """Verifies the user still exists in SQL, is not marked deleted in Mongo, and the upload record exists."""
    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        return False, None

    auth_doc = mongo_db["user_auth_state"].find_one({"_id": uid}, {"deleted_at_ts": 1})
    if auth_doc and auth_doc.get("deleted_at_ts") is not None:
        return False, None

    with SessionLocal() as db:
        user_row = db.query(User.id).filter(User.id == uid).first()
        if user_row is None:
            return False, None

    upload = uploads_collection.find_one({"file_id": file_id, "user_id": uid})
    if upload is None:
        return False, None

    return True, upload


def _unlink_upload_safely(file_path: str | None) -> None:
    if not file_path:
        return
    try:
        upload_root = Path(settings.UPLOAD_DIR).resolve()
        resolved = Path(file_path).resolve()
        if resolved.is_relative_to(upload_root):
            resolved.unlink(missing_ok=True)
    except OSError:
        pass


@celery_app.task(
    name="app.tasks.send_weekly_progress_emails_task",
    bind=True,
    max_retries=2,
    default_retry_delay=300,  # 5 دقائق بين المحاولات عند الفشل (مثال: مشكلة اتصال SMTP مؤقتة)
)
def send_weekly_progress_emails_task(self):
    """يُشغَّل أسبوعياً عبر celery beat (الجدولة مُعرَّفة في app/celery_app.py).

    يفتح جلسة قاعدة بيانات خاصة به عبر SessionLocal مباشرة (وليس عبر get_db المُستخدمة في
    الـ API فقط داخل FastAPI Dependency Injection)، لأن هذه المهمة تُنفَّذ في عملية Celery
    Worker مستقلة تماماً عن عملية الـ API، ولا يوجد فيها طلب HTTP لحقن الجلسة عبره.
    """
    db = SessionLocal()
    try:
        report = send_weekly_progress_emails(db)
        logger.info("Weekly email task finished: %s", report)
        return report
    except Exception as exc:  # لا نُفشل المهمة نهائياً من أول محاولة — نُعيد جدولتها للمحاولة لاحقاً
        logger.exception("Weekly email task failed, scheduling retry")
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.parse_cv_task",
    bind=True,
)
def parse_cv_task(self, file_id: str, user_id: int, task_id: str | None = None) -> dict:
    """Phase 2 (Section 7.1): Celery Asynchronous PDF Worker for CV parsing (`parse_cv_task`).

    Reads the uploaded PDF file in the background, extracts structured CV data via AI/Heuristics,
    stores the result in `extractions_collection`, and updates `cv_tasks_collection` for `/cv/status/{task_id}`.
    """
    effective_task_id = task_id or getattr(self.request, "id", None) or str(uuid.uuid4())
    upload_path: str | None = None
    try:
        active_before, upload = _is_account_and_upload_active(file_id, user_id)
        if not active_before or upload is None:
            logger.info("Aborting parse_cv_task %s: account or upload %s already deleted", effective_task_id, file_id)
            return {"status": "aborted", "task_id": effective_task_id}

        upload_path = upload.get("path")
        extracted = extract_cv_data(upload_path, user_id=user_id)
        extraction_id = str(uuid.uuid4())
        is_linkedin = getattr(extracted, "is_linkedin", False)

        projects_list = [p.__dict__ if hasattr(p, "__dict__") else p for p in extracted.projects]
        education_list = [e.__dict__ if hasattr(e, "__dict__") else e for e in extracted.education]
        experience_list = [e.__dict__ if hasattr(e, "__dict__") else e for e in extracted.experience]

        # Re-verify user/upload state right before persisting extracted data (erasure guard)
        active_after, _ = _is_account_and_upload_active(file_id, user_id)
        if not active_after:
            _unlink_upload_safely(upload_path)
            logger.info("Aborting parse_cv_task %s mid-flight: account or upload deleted", effective_task_id)
            return {"status": "aborted", "task_id": effective_task_id}

        document = {
            "extraction_id": extraction_id,
            "user_id": user_id,
            "file_id": file_id,
            "skills": extracted.skills,
            "projects": projects_list,
            "education": education_list,
            "experience": experience_list,
            "is_linkedin": is_linkedin,
            "status": "extracted",
            "created_at": datetime.now(timezone.utc),
        }
        extractions_collection.insert_one(document)

        result_payload = {
            "extraction_id": extraction_id,
            "skills": extracted.skills,
            "projects": projects_list,
            "education": education_list,
            "experience": experience_list,
            "is_linkedin": is_linkedin,
        }

        cv_tasks_collection.update_one(
            {"task_id": effective_task_id},
            {
                "$set": {
                    "task_id": effective_task_id,
                    "user_id": user_id,
                    "file_id": file_id,
                    "status": "completed",
                    "extraction_id": extraction_id,
                    "result": result_payload,
                    "error": None,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        # Minimize returned Celery result payload so raw CV data is never retained in Redis
        return {
            "status": "completed",
            "task_id": effective_task_id,
            "extraction_id": extraction_id,
        }
    except Exception as exc:
        logger.exception("Async CV parse task %s failed", effective_task_id)
        active_on_err, _ = _is_account_and_upload_active(file_id, user_id)
        if not active_on_err:
            _unlink_upload_safely(upload_path)
            return {"status": "aborted", "task_id": effective_task_id}
        if isinstance(exc, ValueError) and str(exc) in {
            "Uploaded file not found",
            "PDF exceeds maximum allowed page limit (30 pages)",
            "PDF exceeds maximum allowed object/stream complexity",
            "Invalid uploaded file path",
        }:
            safe_error = str(exc)
        else:
            safe_error = "CV processing failed. Please verify the PDF file and try again."
        cv_tasks_collection.update_one(
            {"task_id": effective_task_id},
            {
                "$set": {
                    "status": "failed",
                    "error": safe_error,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        raise
