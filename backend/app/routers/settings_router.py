"""
الواجهة 11 (Settings) — تغيير كلمة المرور + تفضيل المشاركة في Benchmark (Batch 4.2).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.mysql_models import User
from app.schemas.schemas import (
    BenchmarkOptInRequest,
    BenchmarkOptInResponse,
    NotificationsPreferenceRequest,
    NotificationsPreferenceResponse,
    PasswordUpdateRequest,
    PasswordUpdateResponse,
)
from app.security import get_current_user, hash_password, verify_password

router = APIRouter(tags=["Settings"])


@router.put("/settings/password", response_model=PasswordUpdateResponse)
def update_password(
    payload: PasswordUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        # ملاحظة هندسية مهمة (خلل حقيقي اكتُشف بمراجعة شاملة وتم إصلاحه هنا): هذا الخطأ
        # يجب أن يكون 400 (Bad Request) وليس 401 (Unauthorized) رغم أن الاثنين متشابهان
        # لفظياً — لأن المستخدم هنا *مُصادَق بالفعل* (يملك JWT صالحاً تماماً، وإلا لما وصل
        # حتى إلى get_current_user أعلاه)؛ الخطأ هو في بيانات النموذج (كلمة مرور خاطئة)، وليس
        # في صلاحية الجلسة. الفرونت إند (api/client.js) لديه معالج عام يُسجّل خروج المستخدم
        # تلقائياً ويوجّهه لصفحة تسجيل الدخول عند استقبال أي 401 في أي مكان بالتطبيق (بافتراض
        # أنه يعني دائماً "الجلسة/التوكن غير صالح") — استخدام 401 هنا كان يتسبب فعلياً في
        # تسجيل خروج المستخدم بشكل مفاجئ وغير متوقع بمجرد كتابة كلمة مروره الحالية بشكل خاطئ،
        # بدل عرض رسالة الخطأ المناسبة داخل صفحة الإعدادات نفسها كما هو مصمَّم في Settings.jsx.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()

    return PasswordUpdateResponse(status="password_updated")


@router.put("/settings/benchmark-opt-in", response_model=BenchmarkOptInResponse)
def update_benchmark_opt_in(
    payload: BenchmarkOptInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch 4.2 — تفعيل/تعطيل مشاركة Career Score ضمن متوسط الأقران المجهول (Opt-in)."""
    current_user.benchmark_opt_in = payload.opted_in
    db.add(current_user)
    db.commit()

    return BenchmarkOptInResponse(opted_in=current_user.benchmark_opt_in)


@router.put("/settings/notifications", response_model=NotificationsPreferenceResponse)
def update_notifications_preference(
    payload: NotificationsPreferenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch 5.6 (F5.2) — تفعيل/تعطيل التنبيهات البريدية الأسبوعية بحالة تقدّم الـ Roadmap.

    يقرأ send_weekly_progress_emails (الدفعة 5.5) هذا الحقل مباشرة من جدول users قبل إرسال أي
    بريد، لذا تعطيل هذا المفتاح يوقف الإرسال فوراً بدءاً من التشغيل الأسبوعي التالي للمهمة.
    """
    current_user.notifications_opt_in = payload.notifications_opt_in
    db.add(current_user)
    db.commit()

    return NotificationsPreferenceResponse(notifications_opt_in=current_user.notifications_opt_in)

