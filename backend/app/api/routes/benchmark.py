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

MIN_DISTINCT_USERS_FOR_BENCHMARK = 5
MIN_SAMPLE_SIZE_FOR_JOB_BREAKDOWN = MIN_DISTINCT_USERS_FOR_BENCHMARK


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

    # Projection: نجلب فقط user_id و career_score وأول عنصر من top_jobs لتجميع مشارك واحد لكل مستخدم فريد
    cursor = analysis_results_collection.find(
        {"user_id": {"$in": opted_in_user_ids}},
        {"user_id": 1, "career_score": 1, "top_jobs": {"$slice": 1}, "_id": 1},
    ).sort([("date", -1), ("_id", -1)])

    latest_by_user: dict[int, dict] = {}
    for doc in cursor:
        uid = doc.get("user_id")
        score = doc.get("career_score")
        if not isinstance(uid, int) or uid in latest_by_user:
            continue
        if not isinstance(score, (int, float)) or isinstance(score, bool):
            continue
        latest_by_user[uid] = doc

    distinct_user_count = len(latest_by_user)
    if distinct_user_count < MIN_DISTINCT_USERS_FOR_BENCHMARK:
        res = BenchmarkResponse(
            average_career_score=None,
            sample_size=distinct_user_count,
            by_job_title={},
        )
        set_cached_benchmark(res)
        return res

    scores = [float(doc["career_score"]) for doc in latest_by_user.values()]
    average_score = sum(scores) / len(scores)

    scores_by_job: dict[str, list[float]] = defaultdict(list)
    for doc in latest_by_user.values():
        top_jobs = doc.get("top_jobs", [])
        if top_jobs and isinstance(top_jobs[0], dict) and top_jobs[0].get("job_title"):
            scores_by_job[top_jobs[0]["job_title"]].append(float(doc["career_score"]))

    by_job_title = {
        job_title: round(sum(job_scores) / len(job_scores), 2)
        for job_title, job_scores in scores_by_job.items()
        if len(job_scores) >= MIN_DISTINCT_USERS_FOR_BENCHMARK
    }

    res = BenchmarkResponse(
        average_career_score=round(average_score, 2),
        sample_size=distinct_user_count,
        by_job_title=by_job_title,
    )
    set_cached_benchmark(res)
    return res
