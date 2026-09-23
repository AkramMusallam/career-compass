"""
Batch 5.4/5.5 — مهمة Celery المجدولة أسبوعياً لإرسال تنبيهات البريد الإلكتروني.

مفصولة عمداً عن app/services/email_notifications.py: هذا الملف طبقة "Celery wrapper" رفيعة
فقط (فتح/إغلاق جلسة قاعدة بيانات + إعادة المحاولة عند الفشل)، بينما كل منطق العمل الفعلي
(بناء الملخص، توليد HTML، الإرسال عبر SMTP) يعيش في الخدمة، بحيث يمكن اختبار المنطق مباشرة
دون أي حاجة لـ Celery أو Redis (انظر tests/test_email_notifications.py).
"""
from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.database import SessionLocal
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
