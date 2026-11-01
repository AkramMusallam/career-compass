"""
مسارات واجهات بوابة التوظيف والشركات (Recruiter & B2B Portal Routes)
القسم 7.2 من وثيقة المواصفات: B2B Expansion & Commercialization.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.mysql_models import User
from app.schemas.schemas import (
    CandidateListResponse,
    CandidateProfileDetail,
    RecruiterJobCreate,
    RecruiterJobResponse,
    RecruiterJobUpdate,
    SwitchRoleRequest,
    UpdateCandidatePipelineRequest,
)
from app.services import recruiter_service

router = APIRouter(prefix="/recruiter", tags=["Recruiter Portal (B2B)"])


def require_recruiter_or_active(current_user: User = Depends(get_current_user)) -> User:
    """التحقق من صلاحية مسؤول التوظيف أو اشتراك الشركات."""
    role = getattr(current_user, "role", "candidate") or "candidate"
    tier = getattr(current_user, "subscription_tier", "free") or "free"
    if role not in ("recruiter", "admin") and tier != "enterprise":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter or Enterprise access required. Please activate recruiter mode first.",
        )
    return current_user


@router.post("/jobs", response_model=RecruiterJobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: RecruiterJobCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """نشر شاغر وظيفي جديد من قبل الشركة (مع تفعيل صلاحية التوظيف تلقائياً عند نشر أول شاغر)."""
    role = getattr(current_user, "role", "candidate") or "candidate"
    if role not in ("recruiter", "admin"):
        db_user = db.query(User).filter(User.id == current_user.id).first()
        if db_user:
            db_user.role = "recruiter"
            if payload.company_name and not db_user.company_name:
                db_user.company_name = payload.company_name.strip()[:200]
            db.commit()
            db.refresh(db_user)
            current_user = db_user

    doc = recruiter_service.create_job_posting(current_user, payload.model_dump())
    return RecruiterJobResponse(**doc)


@router.get("/jobs", response_model=List[RecruiterJobResponse])
def list_jobs(
    status: Optional[str] = Query(None, description="فلترة حسب الحالة (active / closed)"),
    current_user: User = Depends(get_current_user),
):
    """عرض جميع شواغر الشركة المعلنة وإحصائيات المرشحين."""
    jobs = recruiter_service.get_recruiter_jobs(current_user.id, status_filter=status)
    return [RecruiterJobResponse(**j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=RecruiterJobResponse)
def get_job(
    job_id: str,
    current_user: User = Depends(require_recruiter_or_active),
):
    """جلب تفاصيل شاغر محدد."""
    job = recruiter_service.get_job_by_id(job_id, current_user.id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found")
    return RecruiterJobResponse(**job)


@router.put("/jobs/{job_id}", response_model=RecruiterJobResponse)
def update_job(
    job_id: str,
    payload: RecruiterJobUpdate,
    current_user: User = Depends(require_recruiter_or_active),
):
    """تعديل متطلبات أو حالة الشاغر."""
    updated = recruiter_service.update_job(job_id, current_user.id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found or unauthorized")
    return RecruiterJobResponse(**updated)


@router.delete("/jobs/{job_id}", status_code=status.HTTP_200_OK)
def delete_job(
    job_id: str,
    current_user: User = Depends(require_recruiter_or_active),
):
    """إلغاء أو حذف شاغر وظيفي."""
    success = recruiter_service.delete_job(job_id, current_user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found or unauthorized")
    return {"detail": "Job posting deleted successfully"}


@router.get("/jobs/{job_id}/candidates", response_model=CandidateListResponse)
def get_ranked_candidates(
    job_id: str,
    min_match: int = Query(0, ge=0, le=100, description="الحد الأدنى لنسبة التطابق"),
    skill_filter: Optional[str] = Query(None, description="تصفية حسب مهارة محددة"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_recruiter_or_active),
):
    """اكتشاف، مطابقة وترتيب الكفاءات والسير الذاتية المؤكدة للشاغر."""
    job = recruiter_service.get_job_by_id(job_id, current_user.id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found")

    result = recruiter_service.discover_and_rank_candidates(
        job_id=job_id,
        recruiter_id=current_user.id,
        min_match=min_match,
        skill_filter=skill_filter,
        limit=limit,
    )
    return CandidateListResponse(**result)


@router.post("/jobs/{job_id}/candidates/{candidate_id}/status", status_code=status.HTTP_200_OK)
def update_candidate_status(
    job_id: str,
    candidate_id: str,
    payload: UpdateCandidatePipelineRequest,
    current_user: User = Depends(require_recruiter_or_active),
):
    """تحديث مرحلة المرشح في مسار التوظيف (Shortlist, Contact, Interview, Reject)."""
    try:
        updated = recruiter_service.update_candidate_pipeline_status(
            job_id=job_id,
            candidate_id=candidate_id,
            recruiter_id=current_user.id,
            pipeline_status=payload.pipeline_status,
            notes=payload.notes,
        )
        return {"detail": "Candidate pipeline status updated successfully", "record": updated}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/candidates/{candidate_id}/profile", response_model=CandidateProfileDetail)
def get_candidate_profile(
    candidate_id: str,
    current_user: User = Depends(require_recruiter_or_active),
):
    """معاينة الملف التقني المفصّل للمرشح."""
    profile_data = recruiter_service.get_candidate_profile_detail(candidate_id, recruiter_id=current_user.id)
    if not profile_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate profile not found")
    return CandidateProfileDetail(**profile_data)


@router.post("/switch-role", status_code=status.HTTP_200_OK)
def switch_to_recruiter(
    company_name: Optional[str] = Query(None, max_length=200),
    payload: Optional[SwitchRoleRequest] = Body(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """تفعيل ميزات مسؤول التوظيف (Recruiter) لحساب المستخدم."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.role = "recruiter"
    resolved_company = company_name or (payload.company_name if payload else None)
    if resolved_company:
        user.company_name = resolved_company.strip()[:200]
    db.commit()
    db.refresh(user)

    return {
        "detail": "Account upgraded to recruiter portal successfully",
        "role": user.role,
        "company_name": user.company_name,
    }
