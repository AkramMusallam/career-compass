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

from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.mongo import cv_tasks_collection, extractions_collection, uploads_collection
from app.services.cv_extraction import extract_cv_data
from app.services.email_notifications import send_weekly_progress_emails

logger = logging.getLogger("career_compass.tasks")


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
    max_retries=1,
    default_retry_delay=10,
)
def parse_cv_task(self, file_id: str, user_id: int, task_id: str | None = None) -> dict:
    """Phase 2 (Section 7.1): Celery Asynchronous PDF Worker for CV parsing (`parse_cv_task`).

    Reads the uploaded PDF file in the background, extracts structured CV data via AI/Heuristics,
    stores the result in `extractions_collection`, and updates `cv_tasks_collection` for `/cv/status/{task_id}`.
    """
    effective_task_id = task_id or getattr(self.request, "id", None) or str(uuid.uuid4())
    try:
        upload = uploads_collection.find_one({"file_id": file_id, "user_id": user_id})
        if upload is None:
            error_msg = "Uploaded file not found"
            cv_tasks_collection.update_one(
                {"task_id": effective_task_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": error_msg,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
                upsert=True,
            )
            raise ValueError(error_msg)

        extracted = extract_cv_data(upload["path"])
        extraction_id = str(uuid.uuid4())
        is_linkedin = getattr(extracted, "is_linkedin", False)

        projects_list = [p.__dict__ if hasattr(p, "__dict__") else p for p in extracted.projects]
        education_list = [e.__dict__ if hasattr(e, "__dict__") else e for e in extracted.education]
        experience_list = [e.__dict__ if hasattr(e, "__dict__") else e for e in extracted.experience]

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
        return result_payload
    except Exception as exc:
        logger.warning("Async CV parse task %s failed: %s", effective_task_id, exc)
        cv_tasks_collection.update_one(
            {"task_id": effective_task_id},
            {
                "$set": {
                    "status": "failed",
                    "error": str(exc),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        raise
