from __future__ import annotations

import logging
from typing import Any, Dict, List, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.mongo import analysis_results_collection, extractions_collection, recruiter_jobs_collection, mongo_db
from app.core.security import get_current_user
from app.models.mysql_models import User
from app.services.live_jobs_service import fetch_live_external_jobs
from app.services.recommendation_engine import _is_job_skill_match

logger = logging.getLogger("career_compass.jobs")

router = APIRouter(prefix="/jobs", tags=["Live Job Matches"])


def _score_job_entry(
    *,
    job_id: str,
    title: str,
    company: str,
    location: str,
    work_type: str,
    experience_level: str,
    salary_range: str,
    description: str,
    posted_date: str,
    required: List[str],
    bonus: List[str],
    candidate_skills: List[str],
    target_role: str,
    source: str,
    source_name: str,
    apply_url: str | None = None,
    company_url: str | None = None,
) -> Dict[str, Any]:
    matching = [s for s in required + bonus if _is_job_skill_match(s, candidate_skills)]
    missing = [s for s in required if not _is_job_skill_match(s, candidate_skills)]
    bonus_missing = [s for s in bonus if not _is_job_skill_match(s, candidate_skills)]
    total_w = len(required) + 0.3 * len(bonus)
    earned = (len(required) - len(missing)) + 0.3 * sum(
        1 for s in bonus if _is_job_skill_match(s, candidate_skills)
    )
    score = (earned / total_w) * 100.0 if total_w > 0 else (35.0 if source == "external" else 0.0)

    if target_role and title:
        role_terms = [t for t in target_role.lower().split() if len(t) >= 3]
        title_lower = title.lower()
        if any(term in title_lower for term in role_terms):
            score = min(100.0, score + 8.0)

    return {
        "id": job_id,
        "title": title,
        "company": company,
        "company_url": company_url,
        "location": location,
        "type": work_type,
        "experience_level": experience_level,
        "salary_range": salary_range or "غير محدد",
        "description": description,
        "apply_url": apply_url,
        "posted_date": posted_date,
        "source": source,
        "source_name": source_name,
        "match_percentage": round(score, 1),
        "matched_skills": matching,
        "missing_skills": missing,
        "bonus_skills_missing": bonus_missing,
    }


@router.get("/matched")
def get_matched_jobs(
    analysis_id: str = Query(..., description="ID of the completed analysis"),
    limit: int = Query(50, ge=1, le=200, description="Max matched jobs to return"),
    offset: int = Query(0, ge=0, description="Number of matched jobs to skip"),
    source: Literal["all", "internal", "external"] = Query("all", description="Filter by job source"),
    include_external: bool = Query(True, description="Include live external job boards when available"),
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

    target_role = (
        str(analysis.get("target_role") or getattr(current_user, "target_role", "") or "").strip()
    )

    matched: List[Dict[str, Any]] = []
    if source in ("all", "internal"):
        approved_ids = mongo_db["companies"].distinct("company_id", {"status": "approved"})
        for job in recruiter_jobs_collection.find({"status": "active", "company_id": {"$in": approved_ids}}):
            matched.append(
                _score_job_entry(
                    job_id=job["job_id"],
                    title=job["title"],
                    company=job["company_name"],
                    location=job.get("location", ""),
                    work_type=job.get("work_type", ""),
                    experience_level=job.get("experience_level", ""),
                    salary_range=job.get("salary_range") or "غير محدد",
                    description=job.get("description", ""),
                    posted_date=job.get("created_at", ""),
                    required=list(job.get("required_skills") or []),
                    bonus=list(job.get("bonus_skills") or []),
                    candidate_skills=candidate_skills,
                    target_role=target_role,
                    source="internal",
                    source_name="Career Compass",
                )
            )

    if include_external and source in ("all", "external"):
        external_jobs = fetch_live_external_jobs(target_role=target_role)
        scored_external: List[Dict[str, Any]] = []
        for ext_job in external_jobs:
            scored = _score_job_entry(
                job_id=str(ext_job.get("id") or ""),
                title=str(ext_job.get("title") or ""),
                company=str(ext_job.get("company") or ""),
                location=str(ext_job.get("location") or "Remote"),
                work_type=str(ext_job.get("type") or "Full-time"),
                experience_level=str(ext_job.get("experience_level") or ""),
                salary_range=str(ext_job.get("salary_range") or "حسب السوق"),
                description=str(ext_job.get("description") or ""),
                posted_date=str(ext_job.get("posted_date") or ""),
                required=list(ext_job.get("required_skills") or []),
                bonus=list(ext_job.get("bonus_skills") or []),
                candidate_skills=candidate_skills,
                target_role=target_role,
                source="external",
                source_name=str(ext_job.get("source_name") or "Market"),
                apply_url=ext_job.get("apply_url"),
                company_url=ext_job.get("company_url"),
            )
            if not candidate_skills or scored["match_percentage"] > 0:
                scored_external.append(scored)
        scored_external.sort(key=lambda j: j["match_percentage"], reverse=True)
        matched.extend(scored_external[:40])

    matched.sort(
        key=lambda job: (job["match_percentage"], 1 if job.get("source") == "internal" else 0),
        reverse=True,
    )
    paginated_jobs = matched[offset : offset + limit]

    return {
        "analysis_id": analysis_id,
        "total": len(matched),
        "limit": limit,
        "offset": offset,
        "jobs": paginated_jobs,
    }
