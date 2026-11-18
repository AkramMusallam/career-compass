"""
الواجهة 11 (Settings) — تغيير كلمة المرور + تفضيل المشاركة في Benchmark (Batch 4.2).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.mongo import mongo_db
from app.core.benchmark_cache import invalidate_benchmark_cache
from app.core.security import (
    bump_user_token_version,
    get_current_user,
    get_user_token_version,
    hash_password,
    verify_password,
)
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


@router.get("/settings/recruiter-consent")
def get_recruiter_consent(current_user: User = Depends(get_current_user)):
    return {"opted_in": mongo_db["recruiter_consent"].find_one({"_id": current_user.id}) is not None}


@router.put("/settings/recruiter-consent")
def update_recruiter_consent(
    payload: BenchmarkOptInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists")
    consent = mongo_db["recruiter_consent"]
    if payload.opted_in:
        consent.update_one({"_id": user.id}, {"$set": {"enabled": True}}, upsert=True)
    else:
        consent.delete_one({"_id": user.id})
    return {"opted_in": payload.opted_in}


@router.get("/settings/cloud-ai-consent")
def get_cloud_ai_consent(current_user: User = Depends(get_current_user)):
    doc = mongo_db["cloud_ai_consent"].find_one({"_id": current_user.id})
    return {"opted_in": bool(doc and doc.get("enabled") is True)}


@router.put("/settings/cloud-ai-consent")
def update_cloud_ai_consent(
    payload: BenchmarkOptInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists")
    consent = mongo_db["cloud_ai_consent"]
    if payload.opted_in:
        consent.update_one({"_id": user.id}, {"$set": {"enabled": True}}, upsert=True)
    else:
        consent.delete_one({"_id": user.id})
    return {"opted_in": payload.opted_in}


@router.put("/settings/password", response_model=PasswordUpdateResponse)
def update_password(
    payload: PasswordUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists")
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    current_tv = get_user_token_version(user.id, getattr(user, "token_version", 1))
    new_tv = current_tv + 1
    user.hashed_password = hash_password(payload.new_password)
    user.token_version = new_tv
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    try:
        bump_user_token_version(user.id, min_version=new_tv)
    except Exception:
        pass

    return PasswordUpdateResponse(status="password_updated")


@router.put("/settings/benchmark-opt-in", response_model=BenchmarkOptInResponse)
def update_benchmark_opt_in(
    payload: BenchmarkOptInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch 4.2 — تفعيل/تعطيل مشاركة Career Score ضمن متوسط الأقران المجهول (Opt-in)."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists")
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
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists")
    user.notifications_opt_in = payload.notifications_opt_in
    db.commit()

    return NotificationsPreferenceResponse(notifications_opt_in=user.notifications_opt_in)
