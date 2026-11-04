"""
الواجهة 8 (Results) — POST /analyze يشغّل محرك التوصية الكامل (القسم 6) ويحفظ النتيجة
تلقائياً في MongoDB (analysis_results) فور توليدها، دون انتظار إجراء إضافي من المستخدم
(ملاحظة الباك في الواجهة 8)، بحيث تظهر مباشرة في History.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.benchmark_cache import invalidate_benchmark_cache
from app.core.database import get_db
from app.core.mongo import analysis_results_collection, assessments_collection, extractions_collection
from app.core.security import get_current_user
from app.models.mysql_models import Job, JobSkill, Question, User
from app.schemas.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    JobMatchOut,
    RoadmapMonthOut,
    SkillGapOut,
    SuggestedCourseOut,
)
from app.services.recommendation_engine import UserProfileInput, calculate_recommendation

router = APIRouter(tags=["Analysis"])


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    extraction = extractions_collection.find_one(
        {"extraction_id": payload.extraction_id, "user_id": current_user.id}
    )
    if extraction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction not found")

    assessment = assessments_collection.find_one(
        {"assessment_id": payload.assessment_id, "user_id": current_user.id}
    )
    if assessment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    profile_input = UserProfileInput(
        skills=extraction.get("skills", []),
        projects=extraction.get("projects", []),
        education=extraction.get("education", []),
        experience=extraction.get("experience", []),
        assessment_answers=assessment.get("answers", []),
    )

    # Eager loading: يمنع مشكلة الـ 141 استعلام N+1 ويختزلها إلى 3 استعلامات فقط
    all_jobs = (
        db.query(Job)
        .options(joinedload(Job.skills).joinedload(JobSkill.skill))
        .all()
    )
    all_questions = (
        db.query(Question)
        .options(selectinload(Question.options), joinedload(Question.related_skill))
        .all()
    )

    result = calculate_recommendation(profile_input, all_jobs, all_questions, db)

    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    document = {
        "analysis_id": analysis_id,
        "user_id": current_user.id,
        "date": now,
        "career_score": result.career_score,
        "career_dna": result.career_dna,
        "top_jobs": [
            {
                "job_title": j.job_title,
                "match_percentage": j.match_percentage,
                "matched_skills": j.matched_skills,
                "missing_skills": j.missing_skills,
                "explanation": j.explanation,
            }
            for j in result.top_jobs
        ],
        "strengths": result.strengths,
        "weaknesses": result.weaknesses,
        "skill_gap": result.skill_gap,
        "roadmap": result.roadmap,
        "suggested_courses": result.suggested_courses,
        "extraction_id": payload.extraction_id,
        "assessment_id": payload.assessment_id,
        "skills": profile_input.skills,
        "completed_skills": [],  # Batch 2.2 — Skill Checklist تفاعلي على الـ Roadmap
        "share_token": None,  # Batch 4.1 — لا يوجد رابط مشاركة حتى يطلبه المستخدم صراحة
    }
    # الحفظ التلقائي والفوري — ملاحظة الباك في الواجهة 8
    analysis_results_collection.insert_one(document)
    if current_user.benchmark_opt_in:
        invalidate_benchmark_cache()

    return AnalyzeResponse(
        analysis_id=analysis_id,
        date=now,
        career_score=result.career_score,
        career_dna=result.career_dna,
        top_jobs=[
            JobMatchOut(
                job_title=j.job_title,
                match_percentage=j.match_percentage,
                matched_skills=j.matched_skills,
                missing_skills=j.missing_skills,
                explanation=j.explanation,
            )
            for j in result.top_jobs
        ],
        strengths=result.strengths,
        weaknesses=result.weaknesses,
        skill_gap=SkillGapOut(**result.skill_gap),
        roadmap=[RoadmapMonthOut(**m) for m in result.roadmap],
        suggested_courses=[SuggestedCourseOut(**c) for c in result.suggested_courses],
        skills=profile_input.skills,
        completed_skills=[],
    )
