"""
Batch 5.4 — تطبيق Celery للمهام المجدولة (التنبيهات البريدية الأسبوعية).

قرار هندسي (بناءً على قرار الفريق الصريح لهذه الدفعة): Celery + Redis بدل APScheduler.
السبب: Celery يشغّل الـ Worker والـ Beat (المجدوِل) في عمليتين منفصلتين تماماً عن عملية الـ
API نفسها — فلا تتأثر المهمة الأسبوعية بإعادة تشغيل الـ API، ولا يُبطئ تنفيذها استجابة أي
طلب HTTP، وتدعم Celery إعادة المحاولة التلقائية عند الفشل (انظر app/tasks.py)، وقابلة للتوسّع
بعدة Workers لاحقاً دون أي تغيير في الكود عند الحاجة.

التشغيل (محلياً، بجانب: uvicorn app.main:app):
    celery -A app.celery_app worker --loglevel=info
    celery -A app.celery_app beat --loglevel=info
(كلاهما مُعرَّفان أيضاً كخدمتين منفصلتين في docker-compose.yml: celery-worker و celery-beat)
"""
from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "career_compass",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.worker.tasks", "app.tasks"],
)

celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    task_eager_propagates=True,
    task_track_started=True,
    worker_hijack_root_logger=False,
    broker_connection_retry_on_startup=True,
)

# جدولة المهمة الأسبوعية الوحيدة الحالية (الدفعة 5.3 / B5.4-B5.5)
celery_app.conf.beat_schedule = {
    "weekly-roadmap-progress-email": {
        "task": "app.tasks.send_weekly_progress_emails_task",
        "schedule": crontab(
            day_of_week=settings.WEEKLY_EMAIL_DAY_OF_WEEK,
            hour=settings.WEEKLY_EMAIL_HOUR,
            minute=settings.WEEKLY_EMAIL_MINUTE,
        ),
    }
}
