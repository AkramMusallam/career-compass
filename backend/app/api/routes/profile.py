"""
الواجهة 10 (Profile) — القسم 5. تحتوي أيضاً على قائمة الإنجازات (Badges — Batch 4.3).
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.benchmark_cache import invalidate_benchmark_cache
from app.core.database import get_db
from app.core.mongo import (
    analysis_results_collection,
    assessments_collection,
    cv_tasks_collection,
    extractions_collection,
    feedback_collection,
    mongo_db,
    recruiter_jobs_collection,
    recruitment_pipeline_collection,
    subscriptions_collection,
    uploads_collection,
)
from app.core.security import (
    decode_access_token,
    get_current_user,
    mark_user_deleted_auth_state,
    oauth2_scheme,
    revoke_token_jti,
)
from app.models.mysql_models import User
from app.schemas.schemas import (
    BadgeOut,
    BadgesResponse,
    ProfileResponse,
    ProfileUpdateRequest,
    ProfileUpdateResponse,
)
from app.services.badges import compute_user_badges
from app.services.email_notifications import send_account_deletion_email

router = APIRouter(tags=["Profile"])


@router.get("/profile", response_model=ProfileResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    total_analyses = analysis_results_collection.count_documents({"user_id": current_user.id})
    highest = 0.0
    top_doc = analysis_results_collection.find_one(
        {"user_id": current_user.id},
        {"career_score": 1, "_id": 0},
        sort=[("career_score", -1)],
    )
    if top_doc:
        highest = top_doc.get("career_score", 0.0)

    is_owner = bool(mongo_db["platform_owner"].find_one({"_id": "owner", "user_id": current_user.id}))
    return ProfileResponse(
        id=str(current_user.id),
        full_name=current_user.full_name,
        email=current_user.email,
        email_verified=bool(getattr(current_user, "email_verified", False)),
        created_at=current_user.created_at,
        total_analyses=total_analyses,
        highest_career_score=highest,
        benchmark_opt_in=current_user.benchmark_opt_in,
        notifications_opt_in=current_user.notifications_opt_in,
        role=getattr(current_user, "role", "candidate") or "candidate",
        subscription_tier=getattr(current_user, "subscription_tier", "free") or "free",
        company_name=getattr(current_user, "company_name", None),
        target_role=getattr(current_user, "target_role", None),
        is_platform_owner=is_owner,
    )


@router.put("/profile", response_model=ProfileUpdateResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists")
    user.full_name = payload.full_name
    if "target_role" in payload.model_fields_set:
        user.target_role = payload.target_role
    db.commit()
    db.refresh(user)

    return ProfileUpdateResponse(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        target_role=getattr(user, "target_role", None),
    )


@router.get("/profile/badges", response_model=BadgesResponse)
def get_profile_badges(current_user: User = Depends(get_current_user)):
    analyses = list(
        analysis_results_collection.find(
            {"user_id": current_user.id},
            {"date": 1, "career_score": 1, "roadmap": 1, "completed_skills": 1, "_id": 0},
        )
    )
    badges = compute_user_badges(analyses)
    return BadgesResponse(badges=[BadgeOut(**b) for b in badges])


@router.delete("/profile", response_model=dict)
def delete_account(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists")

    user_email = user.email
    user_name = user.full_name
    had_benchmark_opt_in = bool(getattr(user, "benchmark_opt_in", False))

    if mongo_db["companies"].find_one({"owner_id": user_id}) or mongo_db["platform_owner"].find_one({"_id": "owner", "user_id": user_id}):
        raise HTTPException(status_code=409, detail="Company and platform owners cannot delete their account while they own these records")

    # Collect file paths and extraction IDs before deletion
    upload_paths = [
        doc.get("path")
        for doc in uploads_collection.find({"user_id": user_id}, {"path": 1, "_id": 0})
        if doc.get("path")
    ]
    user_extraction_ids = [
        doc.get("extraction_id")
        for doc in extractions_collection.find({"user_id": user_id}, {"extraction_id": 1, "_id": 0})
        if doc.get("extraction_id")
    ]

    # 1. Delete the user in MySQL first so a relational DB error never leaves an active user with wiped MongoDB data
    deleted_count = db.query(User).filter(User.id == user_id).delete(synchronize_session=False)
    if not deleted_count:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists")
    db.commit()

    # Invalidate active sessions & mark deleted in Mongo to guard against SQLite ID reuse
    mark_user_deleted_auth_state(user_id)
    if token:
        try:
            token_payload = decode_access_token(token)
            revoke_token_jti(token_payload.get("jti"), user_id, token_payload.get("exp"))
        except HTTPException:
            pass
    if had_benchmark_opt_in:
        invalidate_benchmark_cache()

    # 2. Delete all associated user data in MongoDB
    for coll in (
        analysis_results_collection,
        uploads_collection,
        extractions_collection,
        assessments_collection,
        feedback_collection,
        cv_tasks_collection,
        subscriptions_collection,
        mongo_db["interviews"],
    ):
        coll.delete_many({"user_id": user_id})
    mongo_db["recruiter_consent"].delete_one({"_id": user_id})
    mongo_db["cloud_ai_consent"].delete_one({"_id": user_id})
    mongo_db["support_grants"].delete_many({"candidate_user_id": user_id})
    mongo_db["recruiter_approvals"].delete_one({"_id": user_id})
    # Only remove active company memberships by user_id; never delete cross-company invitations by email alone
    mongo_db["companies"].update_many(
        {"members": user_id},
        {"$pull": {"members": user_id}},
    )
    recruiter_jobs_collection.delete_many({"recruiter_id": user_id, "company_id": {"$exists": False}})
    recruitment_pipeline_collection.delete_many({"recruiter_id": user_id, "company_id": {"$exists": False}})
    if user_extraction_ids:
        recruitment_pipeline_collection.delete_many({"candidate_id": {"$in": user_extraction_ids}})

    # 3. Remove uploaded PDF files from disk
    for file_path in upload_paths:
        try:
            Path(file_path).unlink(missing_ok=True)
        except OSError:
            pass

    background_tasks.add_task(send_account_deletion_email, user_email, user_name)
    return {"detail": "Account deleted successfully"}
