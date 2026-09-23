"""
Batch 5.5 — خدمة البريد الإلكتروني (SMTP) لإرسال تذكير أسبوعي بحالة تقدّم الـ Roadmap.

قرارات هندسية:
1. smtplib (مكتبة قياسية في بايثون) بدل أي مكتبة خارجية إضافية — كافية تماماً لإرسال بريد
   عبر أي مزوّد SMTP قياسي (Gmail، SendGrid SMTP relay، Amazon SES SMTP، ...) دون اعتماديات
   إضافية، وسهلة الاختبار عبر monkeypatch على smtplib.SMTP (انظر tests/test_email_notifications.py).
2. مفتاح إيقاف شامل EMAIL_NOTIFICATIONS_ENABLED (افتراضياً False) في app/config.py: يمنع أي
   إرسال فعلي في بيئة التطوير/الاختبار قبل ضبط بيانات اعتماد SMTP حقيقية صراحة — قرار أمان
   متعمّد لتفادي إرسال رسائل حقيقية بالخطأ من بيئة غير الإنتاج.
3. فشل إرسال بريد واحد لا يُسقط بقية عملية الإرسال الجماعي الأسبوعية — يُسجَّل ويُكمل الباقي.
4. مستخدم بلا أي تحليل سابق يُستثنى تماماً من الإرسال (لا فائدة من "تذكير بتقدّم" لا وجود له
   بعد، وقد يكون مربكاً لمستخدم جديد لم يُكمل حتى الخطوة الأولى).
"""
from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models.mysql_models import User
from app.mongo import analysis_results_collection

logger = logging.getLogger("career_compass.email_notifications")

# نظام الألوان الرسمي للمنصة (نفس الألوان المستخدمة في pdf_export.py، القسم 3.1 من الدليل الأصلي)
PRIMARY_COLOR = "#1E40AF"
SECONDARY_COLOR = "#059669"


@dataclass
class WeeklySummary:
    """ملخص بيانات جاهز لبناء نص/HTML الإيميل — مفصول عن منطق الإرسال لتسهيل الاختبار المستقل."""

    user_email: str
    user_name: str
    career_score: float
    top_job_title: str
    total_roadmap_skills: int
    completed_skills_count: int
    progress_percent: float
    analysis_id: str


def _compute_roadmap_progress(analysis_doc: dict) -> tuple[int, int]:
    """يحسب (إجمالي مهارات الـ Roadmap، عدد المكتمل منها) لتحليل واحد، بنفس منطق F2.5
    (شريط التقدّم في Results.jsx) لضمان اتساق الرقم المعروض في الإيميل مع المعروض بالمنصة."""
    roadmap = analysis_doc.get("roadmap", [])
    all_skills = {s for month in roadmap for s in month.get("skills_to_learn", [])}
    completed = set(analysis_doc.get("completed_skills", [])) & all_skills
    return len(all_skills), len(completed)


def build_weekly_summary_for_user(user: User) -> Optional[WeeklySummary]:
    """يبني ملخص التقدّم الأسبوعي لمستخدم واحد بالاعتماد على آخر تحليل له (بحسب date تنازلياً).

    يُعيد None إذا لم يكن للمستخدم أي تحليل بعد — قرار عمل موثّق أعلاه في docstring الوحدة.
    """
    latest = analysis_results_collection.find_one({"user_id": user.id}, sort=[("date", -1)])
    if latest is None:
        return None

    total_skills, completed_count = _compute_roadmap_progress(latest)
    progress_percent = round((completed_count / total_skills) * 100, 1) if total_skills else 0.0
    top_job_title = latest["top_jobs"][0]["job_title"] if latest.get("top_jobs") else "—"

    return WeeklySummary(
        user_email=user.email,
        user_name=user.full_name,
        career_score=latest.get("career_score", 0.0),
        top_job_title=top_job_title,
        total_roadmap_skills=total_skills,
        completed_skills_count=completed_count,
        progress_percent=progress_percent,
        analysis_id=latest["analysis_id"],
    )


def _progress_sentence(summary: WeeklySummary) -> str:
    if not summary.total_roadmap_skills:
        return "لم تُحدَّد بعد أي مهارات في خطة تعلّمك — راجع خطتك وابدأ بالخطوة الأولى."
    return (
        f"أنجزت {summary.completed_skills_count} من {summary.total_roadmap_skills} مهارة "
        f"({summary.progress_percent}%) من خطة التعلم."
    )


def render_weekly_email_html(summary: WeeklySummary) -> str:
    """يبني نسخة HTML بسيطة ومتجاوبة للإيميل، بنفس ألوان هوية المنصة، باتجاه RTL كامل."""
    results_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/results/{summary.analysis_id}"
    progress_note = _progress_sentence(summary)
    return f"""<div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; max-width: 560px; margin: 0 auto; color: #1E293B;">
  <div style="background: {PRIMARY_COLOR}; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Career Compass</h1>
  </div>
  <div style="border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
    <p style="font-size: 16px;">مرحباً {summary.user_name}،</p>
    <p style="font-size: 14px; line-height: 1.8;">هذا تذكيرك الأسبوعي بحالة تقدّمك المهني على Career Compass:</p>
    <div style="background: #F8FAFC; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0; font-size: 14px;"><b>Career Score الحالي:</b> {round(summary.career_score)}/100</p>
      <p style="margin: 4px 0; font-size: 14px;"><b>أفضل وظيفة مطابقة:</b> {summary.top_job_title}</p>
      <p style="margin: 4px 0; font-size: 14px; color: {SECONDARY_COLOR};"><b>تقدّم خطة التعلم:</b> {progress_note}</p>
    </div>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{results_url}" style="background: {SECONDARY_COLOR}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">عرض النتائج الكاملة</a>
    </div>
    <p style="font-size: 12px; color: #64748B; line-height: 1.6;">
      تصلك هذه الرسالة لأنك مفعّل تفضيل التنبيهات البريدية في إعدادات حسابك — يمكنك إيقافها
      في أي وقت من صفحة الإعدادات.
    </p>
  </div>
</div>"""


def render_weekly_email_text(summary: WeeklySummary) -> str:
    """نسخة نصية بسيطة (fallback) لعملاء البريد التي لا تعرض HTML."""
    results_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/results/{summary.analysis_id}"
    return (
        f"مرحباً {summary.user_name}،\n\n"
        f"Career Score الحالي: {round(summary.career_score)}/100\n"
        f"أفضل وظيفة مطابقة: {summary.top_job_title}\n"
        f"تقدّم خطة التعلم: {_progress_sentence(summary)}\n\n"
        f"عرض النتائج الكاملة: {results_url}\n\n"
        "يمكنك إيقاف هذه التنبيهات من صفحة الإعدادات في أي وقت."
    )


def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """يرسل بريداً إلكترونياً واحداً عبر SMTP (مع STARTTLS إن كان مفعّلاً في الإعدادات).

    يُعيد True عند النجاح و False عند أي فشل (يُسجَّل بالـ logger دون رفع استثناء للأعلى)، حتى
    لا يوقف فشل إرسال بريد مستخدم واحد بقية عملية الإرسال الجماعي الأسبوعية لبقية المستخدمين.
    """
    if not settings.SMTP_HOST:
        logger.warning("SMTP_HOST غير مضبوط — تم تخطي إرسال البريد إلى %s", to_email)
        return False

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    message.attach(MIMEText(text_body, "plain", "utf-8"))
    message.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], message.as_string())
        return True
    except Exception:
        logger.exception("فشل إرسال البريد الأسبوعي إلى %s", to_email)
        return False


def send_password_reset_email(to_email: str, user_name: str, token: str) -> bool:
    """Send a password reset link to the user."""
    reset_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password/{token}"
    subject = "استعادة كلمة المرور - Career Compass"
    
    html_body = f"""<div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; max-width: 560px; margin: 0 auto; color: #1E293B;">
  <div style="background: {PRIMARY_COLOR}; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Career Compass</h1>
  </div>
  <div style="border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
    <p style="font-size: 16px;">مرحباً {user_name}،</p>
    <p style="font-size: 14px; line-height: 1.8;">لقد طلبنا استعادة كلمة المرور لحسابك. يمكنك تعيين كلمة مرور جديدة من خلال الضغط على الزر أدناه:</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{reset_url}" style="background: {SECONDARY_COLOR}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">تعيين كلمة مرور جديدة</a>
    </div>
    <p style="font-size: 12px; color: #64748B; line-height: 1.6;">
      هذا الرابط صالح لمدة 15 دقيقة. إذا لم تطلب استعادة كلمة المرور، يرجى تجاهل هذه الرسالة.
    </p>
  </div>
</div>"""

    text_body = (
        f"مرحباً {user_name}،\n\n"
        f"لقد طلبنا استعادة كلمة المرور لحسابك. لتعيين كلمة مرور جديدة، يرجى زيارة الرابط التالي:\n"
        f"{reset_url}\n\n"
        "هذا الرابط صالح لمدة 15 دقيقة. إذا لم تطلب ذلك، يرجى تجاهل هذه الرسالة."
    )

    return send_email(to_email, subject, html_body, text_body)


def send_weekly_progress_emails(db: Session) -> dict:
    """نقطة الدخول التي تستدعيها مهمة Celery المجدولة أسبوعياً (app/tasks.py).

    يُرجع تقرير تنفيذ صغير قابل للتسجيل (logging) وللاختبار الآلي المباشر بدون أي حاجة لـ
    Redis أو SMTP حقيقيين (انظر tests/test_email_notifications.py).
    """
    report = {"sent": 0, "skipped_no_analysis": 0, "failed": 0, "disabled_globally": False}

    if not settings.EMAIL_NOTIFICATIONS_ENABLED:
        logger.info("EMAIL_NOTIFICATIONS_ENABLED=0 — تم تخطي التشغيل الأسبوعي بالكامل")
        report["disabled_globally"] = True
        return report

    users = db.query(User).filter(User.notifications_opt_in.is_(True)).all()
    for user in users:
        summary = build_weekly_summary_for_user(user)
        if summary is None:
            report["skipped_no_analysis"] += 1
            continue

        sent = send_email(
            to_email=summary.user_email,
            subject="ملخصك الأسبوعي على Career Compass",
            html_body=render_weekly_email_html(summary),
            text_body=render_weekly_email_text(summary),
        )
        if sent:
            report["sent"] += 1
        else:
            report["failed"] += 1

    logger.info("تقرير الإرسال الأسبوعي: %s", report)
    return report
