from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.mongo import analysis_results_collection
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

    candidate_skills = analysis.get("skills", [])
    job_match = analysis.get("job_match", {})
    target_role = job_match.get("top_job", "")

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
