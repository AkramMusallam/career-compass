from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.mongo import analysis_results_collection, extractions_collection, recruiter_jobs_collection, mongo_db
from app.core.security import get_current_user
from app.models.mysql_models import User
from app.services.recommendation_engine import _is_job_skill_match

logger = logging.getLogger("career_compass.jobs")

router = APIRouter(prefix="/jobs", tags=["Live Job Matches"])


@router.get("/matched")
def get_matched_jobs(
    analysis_id: str = Query(..., description="ID of the completed analysis"),
    current_user: User = Depends(get_current_user),
):
    """Epic 6 Feature 6.5: Live Market Job Matching Endpoint.

    Matches candidate's analyzed skills and target role against live market vacancies.
    """
    analysis = analysis_results_collection.find_one(
        {"analysis_id": analysis_id, "user_id": current_user.id}
    )
    if not analysis:
        analysis = analysis_results_collection.find_one(
            {"analysis_id": analysis_id, "user_id": str(current_user.id)}
        )
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis report not found",
        )

    candidate_skills: list[str] = list(analysis.get("skills") or [])
    if not candidate_skills and analysis.get("extraction_id"):
        extraction = extractions_collection.find_one(
            {"extraction_id": analysis["extraction_id"]}
        )
        if extraction and extraction.get("skills"):
            candidate_skills = list(extraction["skills"])

    if not candidate_skills:
        seen_skills: set[str] = set()
        for s in analysis.get("strengths") or []:
            if s and s not in seen_skills:
                seen_skills.add(s)
                candidate_skills.append(s)
        for job in analysis.get("top_jobs") or []:
            if isinstance(job, dict):
                for s in job.get("matched_skills") or []:
                    if s and s not in seen_skills:
                        seen_skills.add(s)
                        candidate_skills.append(s)

    matched = []
    approved_ids = mongo_db["companies"].distinct("company_id", {"status": "approved"})
    for job in recruiter_jobs_collection.find({"status": "active", "company_id": {"$in": approved_ids}}):
        required = job.get("required_skills") or []
        bonus = job.get("bonus_skills") or []
        matching = [s for s in required + bonus if _is_job_skill_match(s, candidate_skills)]
        missing = [s for s in required if s not in matching]
        total = len(required) + 0.3 * len(bonus)
        score = (len(required) - len(missing) + 0.3 * sum(s in matching for s in bonus)) / total * 100 if total else 0
        matched.append({
            "id": job["job_id"], "title": job["title"], "company": job["company_name"],
            "location": job.get("location", ""), "type": job.get("work_type", ""),
            "experience_level": job.get("experience_level", ""),
            "salary_range": job.get("salary_range") or "غير محدد",
            "description": job.get("description", ""), "posted_date": job.get("created_at", ""),
            "match_percentage": round(score, 1), "matched_skills": matching,
            "missing_skills": missing, "bonus_skills_missing": [s for s in bonus if s not in matching],
        })
    matched.sort(key=lambda job: job["match_percentage"], reverse=True)

    return {
        "analysis_id": analysis_id,
        "total": len(matched),
        "jobs": matched,
    }
