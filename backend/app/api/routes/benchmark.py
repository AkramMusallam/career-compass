"""
الواجهة الخاصة بمقارنة الأقران المجهولة (Anonymous Benchmark) — Batch 4.2 (B4.4).
"""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.benchmark_cache import get_cached_benchmark, set_cached_benchmark
from app.core.database import get_db
from app.core.mongo import analysis_results_collection
from app.core.security import get_current_user
from app.models.mysql_models import User
from app.schemas.schemas import BenchmarkResponse

router = APIRouter(tags=["Benchmark"])

MIN_SAMPLE_SIZE_FOR_JOB_BREAKDOWN = 3


@router.get("/benchmark", response_model=BenchmarkResponse)
def get_benchmark(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cached = get_cached_benchmark()
    if cached is not None:
        return cached

    opted_in_user_ids = [
        row[0] for row in db.query(User.id).filter(User.benchmark_opt_in.is_(True)).all()
    ]

    if not opted_in_user_ids:
        res = BenchmarkResponse(average_career_score=None, sample_size=0, by_job_title={})
        set_cached_benchmark(res)
        return res

    # Projection: نجلب فقط career_score وأول عنصر من top_jobs لتوفير استهلاك الذاكرة والشبكة
    docs = list(
        analysis_results_collection.find(
            {"user_id": {"$in": opted_in_user_ids}},
            {"career_score": 1, "top_jobs": {"$slice": 1}, "_id": 0},
        )
    )
    if not docs:
        res = BenchmarkResponse(average_career_score=None, sample_size=0, by_job_title={})
        set_cached_benchmark(res)
        return res

    scores = [d["career_score"] for d in docs]
    average_score = sum(scores) / len(scores)

    scores_by_job: dict = defaultdict(list)
    for doc in docs:
        top_jobs = doc.get("top_jobs", [])
        if top_jobs:
            scores_by_job[top_jobs[0]["job_title"]].append(doc["career_score"])

    by_job_title = {
        job_title: round(sum(job_scores) / len(job_scores), 2)
        for job_title, job_scores in scores_by_job.items()
        if len(job_scores) >= MIN_SAMPLE_SIZE_FOR_JOB_BREAKDOWN
    }

    res = BenchmarkResponse(
        average_career_score=round(average_score, 2),
        sample_size=len(docs),
        by_job_title=by_job_title,
    )
    set_cached_benchmark(res)
    return res
