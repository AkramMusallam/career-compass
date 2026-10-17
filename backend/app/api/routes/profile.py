"""
الواجهة 10 (Profile) — القسم 5. تحتوي أيضاً على قائمة الإنجازات (Badges — Batch 4.3).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.mysql_models import User
from app.core.mongo import analysis_results_collection
from app.schemas.schemas import BadgeOut, BadgesResponse, ProfileResponse, ProfileUpdateRequest, ProfileUpdateResponse
from app.core.security import get_current_user
from app.services.email_notifications import send_account_deletion_email
from app.services.badges import compute_user_badges

router = APIRouter(tags=["Profile"])


@router.get("/profile", response_model=ProfileResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    total_analyses = analysis_results_collection.count_documents({"user_id": current_user.id})
    highest = 0.0
    top_doc = analysis_results_collection.find_one({"user_id": current_user.id}, sort=[("career_score", -1)])
    if top_doc:
        highest = top_doc.get("career_score", 0.0)

    return ProfileResponse(
        id=str(current_user.id),
        full_name=current_user.full_name,
        email=current_user.email,
        created_at=current_user.created_at,
        total_analyses=total_analyses,
        highest_career_score=highest,
        benchmark_opt_in=current_user.benchmark_opt_in,
        notifications_opt_in=current_user.notifications_opt_in,
    )


@router.put("/profile", response_model=ProfileUpdateResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.full_name = payload.full_name
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return ProfileUpdateResponse(id=str(current_user.id), full_name=current_user.full_name, email=current_user.email)


@router.get("/profile/badges", response_model=BadgesResponse)
def get_profile_badges(current_user: User = Depends(get_current_user)):
    analyses = list(analysis_results_collection.find({"user_id": current_user.id}))
    badges = compute_user_badges(analyses)
    return BadgesResponse(badges=[BadgeOut(**b) for b in badges])


from pathlib import Path
from app.core.mongo import (
    analysis_results_collection,
    assessments_collection,
    extractions_collection,
    feedback_collection,
    mongo_db,
    uploads_collection,
)


@router.delete("/profile", response_model=dict)
def delete_account(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_email = current_user.email
    user_name = current_user.full_name
    user_id = current_user.id

    # Remove uploaded PDF files from disk before deleting upload records
    for upload_doc in uploads_collection.find({"user_id": user_id}):
        file_path = upload_doc.get("path")
        if file_path:
            try:
                Path(file_path).unlink(missing_ok=True)
            except Exception:
                pass

    # Delete all associated user data in MongoDB
    for coll in (
        analysis_results_collection,
        uploads_collection,
        extractions_collection,
        assessments_collection,
        feedback_collection,
        mongo_db["interviews"],
    ):
        coll.delete_many({"user_id": user_id})

    # Delete the user in MySQL
    db.delete(current_user)
    db.commit()

    background_tasks.add_task(send_account_deletion_email, user_email, user_name)
    return {"detail": "Account deleted successfully"}
