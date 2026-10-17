from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.mongo import analysis_results_collection, extractions_collection
from app.core.security import get_current_user
from app.models.mysql_models import User
from app.services.recommendation_engine import match_candidate_to_job_postings

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis report not found",
        )

    candidate_skills: list[str] = list(analysis.get("skills") or [])
    if not candidate_skills and analysis.get("extraction_id"):
        extraction = extractions_collection.find_one(
            {"extraction_id": analysis["extraction_id"], "user_id": current_user.id}
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

    job_match = analysis.get("job_match") or {}
    target_role = job_match.get("top_job", "") if isinstance(job_match, dict) else ""
    if not target_role:
        top_jobs = analysis.get("top_jobs") or []
        if top_jobs and isinstance(top_jobs[0], dict):
            target_role = top_jobs[0].get("job_title", "")

    matched = match_candidate_to_job_postings(
        candidate_skills=candidate_skills,
        target_role=target_role,
        min_match_percentage=15,
    )

    return {
        "analysis_id": analysis_id,
        "total": len(matched),
        "jobs": matched,
    }
