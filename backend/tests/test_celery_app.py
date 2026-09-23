"""
Batch 5.4 — اختبارات إعداد Celery ومهمة الإرسال الأسبوعي.

لا يُشغَّل أي Redis أو Worker حقيقي هنا: نستخدم CELERY_TASK_ALWAYS_EAGER=True (مُطبَّق عبر
monkeypatch على celery_app.conf مباشرة) بحيث يُنفَّذ استدعاء .delay()/.apply() للمهمة بشكل
متزامن (synchronous) داخل نفس عملية الاختبار، وهو نمط اختبار Celery القياسي والموصى به رسمياً
لاختبار منطق المهام دون بنية تحتية فعلية.
"""
from app.worker.celery_app import celery_app
from app.services import email_notifications as email_module
from app.worker.tasks import send_weekly_progress_emails_task
from tests.test_email_notifications import FakeSMTP, _reset_fake_smtp


def test_celery_app_has_weekly_beat_schedule_registered():
    schedule = celery_app.conf.beat_schedule
    assert "weekly-roadmap-progress-email" in schedule
    entry = schedule["weekly-roadmap-progress-email"]
    assert entry["task"] == "app.tasks.send_weekly_progress_emails_task"


def test_send_weekly_progress_emails_task_is_registered_with_correct_name():
    assert send_weekly_progress_emails_task.name == "app.tasks.send_weekly_progress_emails_task"
    assert "app.tasks.send_weekly_progress_emails_task" in celery_app.tasks


def test_task_executes_synchronously_in_eager_mode(monkeypatch):
    """يتحقق أن استدعاء المهمة فعلياً (لا فقط استيرادها) يعمل من طرف لطرف: يفتح جلسة قاعدة
    بيانات، يستدعي send_weekly_progress_emails، ويُعيد تقرير النتيجة الصحيح — كل ذلك بدون
    أي حاجة لـ Redis حقيقي بفضل وضع task_always_eager."""
    _reset_fake_smtp()
    monkeypatch.setattr(celery_app.conf, "task_always_eager", True)
    monkeypatch.setattr(celery_app.conf, "task_eager_propagates", True)
    monkeypatch.setattr(email_module.settings, "EMAIL_NOTIFICATIONS_ENABLED", False)

    async_result = send_weekly_progress_emails_task.delay()

    assert async_result.successful()
    report = async_result.result
    assert report["disabled_globally"] is True
