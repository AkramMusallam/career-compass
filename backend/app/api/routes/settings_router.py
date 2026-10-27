"""
الواجهة 11 (Settings) — تغيير كلمة المرور + تفضيل المشاركة في Benchmark (Batch 4.2).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core. benchmark_cache import invalidate_benchmark_cache
from app.core.security import get_current_user, hash_password, verify_password
from app.models.mysql_models import User
from app.schemas.schemas import (
    BenchmarkOptInRequest,
    BenchmarkOptInResponse,
    NotificationsPreferenceRequest,
    NotificationsPreferenceResponse,
    PasswordUpdateRequest,
    PasswordUpdateResponse,
)

router = APIRouter(tags=["Settings"])


@router.put("/settings/password", response_model=PasswordUpdateResponse)
def update_password(
    payload: PasswordUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    user = db.merge(current_user)
    user.hashed_password = hash_password(payload.new_password)
    db.commit()

    return PasswordUpdateResponse(status="password_updated")


@router.put("/settings/benchmark-opt-in", response_model=BenchmarkOptInResponse)
def update_benchmark_opt_in(
    payload: BenchmarkOptInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch 4.2 — تفعيل/تعطيل مشاركة Career Score ضمن متوسط الأقران المجهول (Opt-in)."""
    user = db.merge(current_user)
    user.benchmark_opt_in = payload.opted_in
    db.commit()
    invalidate_benchmark_cache()

    return BenchmarkOptInResponse(opted_in=user.benchmark_opt_in)


@router.put("/settings/notifications", response_model=NotificationsPreferenceResponse)
def update_notifications_preference(
    payload: NotificationsPreferenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch 5.6 (F5.2) — تفعيل/تعطيل التنبيهات البريدية الأسبوعية بحالة تقدّم الـ Roadmap."""
    user = db.merge(current_user)
    user.notifications_opt_in = payload.notifications_opt_in
    db.commit()

    return NotificationsPreferenceResponse(notifications_opt_in=user.notifications_opt_in)
