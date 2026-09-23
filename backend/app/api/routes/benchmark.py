"""
الواجهة الخاصة بمقارنة الأقران المجهولة (Anonymous Benchmark) — Batch 4.2 (B4.4).

قرار الخصوصية المعتمد: **Opt-in فقط** — لا تدخل بيانات أي مستخدم في هذا المتوسط إلا لو
فعّل صراحة "المشاركة في متوسط الأقران" من صفحة الإعدادات (PUT /settings/benchmark-opt-in).
محمي بـ JWT (لا حاجة أن يكون عاماً — الغرض منه مقارنة المستخدم المسجّل بنفسه).

حماية إضافية للخصوصية: تفصيل by_job_title لا يظهر إلا لمجموعات فيها 3 تحليلات موافقة عليها
أو أكثر، لتفادي تمييز مستخدم وحيد ضمن مجموعة صغيرة جداً حتى مع موافقته المسبقة.
"""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.mysql_models import User
from app.core.mongo import analysis_results_collection
from app.schemas.schemas import BenchmarkResponse
from app.core.security import get_current_user

router = APIRouter(tags=["Benchmark"])

MIN_SAMPLE_SIZE_FOR_JOB_BREAKDOWN = 3


@router.get("/benchmark", response_model=BenchmarkResponse)
def get_benchmark(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    opted_in_user_ids = [u.id for u in db.query(User).filter(User.benchmark_opt_in.is_(True)).all()]

    if not opted_in_user_ids:
        return BenchmarkResponse(average_career_score=None, sample_size=0, by_job_title={})

    docs = list(analysis_results_collection.find({"user_id": {"$in": opted_in_user_ids}}))
    if not docs:
        return BenchmarkResponse(average_career_score=None, sample_size=0, by_job_title={})

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

    return BenchmarkResponse(
        average_career_score=round(average_score, 2),
        sample_size=len(docs),
        by_job_title=by_job_title,
    )
