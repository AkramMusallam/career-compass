"""
الواجهة العامة لعرض النتائج المشتركة — Batch 4.1 (B4.2).

**بدون أي حماية JWT عمداً** — هذا هو الغرض من الرابط العام (Shared Link).
قرار الخصوصية المعتمد: النسخة المعروضة هنا تقتصر حصراً على Career Score و Career DNA
و Top Jobs (بما فيها matched/missing skills والجملة التوضيحية). لا تُعرض أبداً: بيانات
تعريف شخصية (الاسم، البريد الإلكتروني)، تفاصيل المشاريع/الخبرة، الـ Roadmap الشخصي، أو
الكورسات المقترحة — لهذا استُخدم schema مستقل تماماً (SharedAnalysisResponse) بدل إعادة
استخدام AnalyzeResponse الكامل، لضمان عدم تسرّب أي حقل جديد لهذا الـ endpoint العام تلقائياً
لو أُضيف مستقبلاً لتحليل المستخدم دون مراجعة صريحة لهذا الملف.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.mongo import analysis_results_collection
from app.schemas.schemas import SharedAnalysisResponse, SharedJobMatchOut

router = APIRouter(tags=["Shared Results"])


@router.get("/shared/{share_token}", response_model=SharedAnalysisResponse)
def get_shared_analysis(share_token: str):
    doc = analysis_results_collection.find_one({"share_token": share_token})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This shared link was not found or has been revoked by its owner",
        )

    return SharedAnalysisResponse(
        career_score=doc["career_score"],
        career_dna=doc["career_dna"],
        top_jobs=[
            SharedJobMatchOut(
                job_title=j["job_title"],
                match_percentage=j["match_percentage"],
                matched_skills=j["matched_skills"],
                missing_skills=j["missing_skills"],
                explanation=j.get("explanation", ""),
            )
            for j in doc["top_jobs"]
        ],
        date=doc["date"],
    )
