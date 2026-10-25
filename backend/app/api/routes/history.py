"""
الواجهة 9 (History) — تُستخدم أيضاً من Dashboard (الواجهة 3) لعرض آخر 3 تحليلات.
تحتوي أيضاً على فيتشرات المرحلة الثانية من وثيقة توزيع المهام:
- Batch 1: تحميل النتائج كـ PDF (B1.1)، حلقة التقييم 👍/👎 (B1.4/B1.6)
- Batch 2: مقارنة تحليلين (B2.1/B2.2)، Skill Checklist تفاعلي على الـ Roadmap (B2.3/B2.4)
- Batch 4: مشاركة رابط عام للنتائج (B4.1/B4.3)
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.models.mysql_models import User
from app.core.mongo import analysis_results_collection, feedback_collection
from app.schemas.schemas import (
    AnalyzeResponse,
    CompareAnalysesResponse,
    FeedbackRequest,
    FeedbackResponse,
    HistoryItemOut,
    HistoryResponse,
    JobMatchOut,
    RoadmapMonthOut,
    RoadmapProgressRequest,
    RoadmapProgressResponse,
    ShareCreateResponse,
    ShareRevokeResponse,
    SkillGapOut,
    SuggestedCourseOut,
)
from app.core.security import get_current_user
from app.services.compare_utils import compute_comparison
from app.services.pdf_export import build_analysis_pdf

router = APIRouter(tags=["History"])

SORT_MAP = {
    "newest": [("date", -1)],
    "oldest": [("date", 1)],
    "highest_score": [("career_score", -1)],
}


def _doc_to_analyze_response(doc: dict) -> AnalyzeResponse:
    """محوّل مشترك من مستند MongoDB إلى AnalyzeResponse، يُستخدم في history detail والمقارنة."""
    return AnalyzeResponse(
        analysis_id=doc["analysis_id"],
        date=doc.get("date"),
        career_score=doc["career_score"],
        career_dna=doc["career_dna"],
        top_jobs=[JobMatchOut(**j) for j in doc["top_jobs"]],
        strengths=doc["strengths"],
        weaknesses=doc["weaknesses"],
        skill_gap=SkillGapOut(**doc["skill_gap"]),
        roadmap=[RoadmapMonthOut(**m) for m in doc["roadmap"]],
        suggested_courses=[SuggestedCourseOut(**c) for c in doc["suggested_courses"]],
        skills=doc.get("skills", []),
        completed_skills=doc.get("completed_skills", []),  # توافق مع تحليلات أُنشئت قبل Batch 2
        share_token=doc.get("share_token"),  # توافق مع تحليلات أُنشئت قبل Batch 4
    )


@router.get("/history", response_model=HistoryResponse)
def get_history(
    sort: Literal["newest", "oldest", "highest_score"] = Query("newest"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    query = {"user_id": current_user.id}
    total = analysis_results_collection.count_documents(query)

    cursor = (
        analysis_results_collection.find(query)
        .sort(SORT_MAP[sort])
        .skip((page - 1) * limit)
        .limit(limit)
    )

    analyses = []
    for doc in cursor:
        top_job_title = doc["top_jobs"][0]["job_title"] if doc.get("top_jobs") else "N/A"
        analyses.append(
            HistoryItemOut(
                analysis_id=doc["analysis_id"],
                date=doc["date"],
                career_score=doc["career_score"],
                top_job_title=top_job_title,
            )
        )

    return HistoryResponse(total=total, page=page, limit=limit, analyses=analyses)


# ============================================================
# Batch 2.1 — B2.1/B2.2: مقارنة تحليلين (Compare Analyses)
# مُسجَّل قبل GET /history/{analysis_id} عمداً: بما أن "compare" ليس UUID، تسجيله بعد
# المسار الديناميكي {analysis_id} كان سيجعل FastAPI يفسّره خطأً كـ analysis_id حرفي "compare".
# ============================================================


@router.get("/history/compare", response_model=CompareAnalysesResponse)
def compare_analyses(
    ids: str = Query(..., description="مُعرّفا تحليلين مفصولين بفاصلة، مثال: ?ids=id1,id2"),
    current_user: User = Depends(get_current_user),
):
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if len(id_list) != 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exactly two analysis ids are required")

    docs = {}
    for analysis_id in id_list:
        doc = analysis_results_collection.find_one({"analysis_id": analysis_id, "user_id": current_user.id})
        if doc is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analysis {analysis_id} not found")
        docs[analysis_id] = doc

    doc_a, doc_b = docs[id_list[0]], docs[id_list[1]]
    delta = compute_comparison(doc_a, doc_b)  # B2.2: يُحسب على الخادم لتخفيف الحمل عن الفرونت

    return CompareAnalysesResponse(
        analysis_a=_doc_to_analyze_response(doc_a),
        analysis_b=_doc_to_analyze_response(doc_b),
        **delta,
    )


@router.get("/history/{analysis_id}", response_model=AnalyzeResponse)
def get_history_detail(analysis_id: str, current_user: User = Depends(get_current_user)):
    doc = analysis_results_collection.find_one({"analysis_id": analysis_id, "user_id": current_user.id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    return _doc_to_analyze_response(doc)


# ============================================================
# Batch 1.1 — B1.1/B1.2/B1.3: تحميل نتائج التحليل كـ PDF
# ============================================================


@router.get("/history/{analysis_id}/export/pdf")
def export_analysis_pdf(analysis_id: str, current_user: User = Depends(get_current_user)):
    # B1.3: نفس نمط الحماية بـ JWT المستخدم في get_history_detail، مع التحقق أن analysis_id
    # يخص المستخدم الحالي حصراً قبل توليد أي محتوى.
    doc = analysis_results_collection.find_one({"analysis_id": analysis_id, "user_id": current_user.id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    pdf_bytes = build_analysis_pdf(doc)
    filename = f"career-compass-{analysis_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# Batch 1.2 — B1.4/B1.5/B1.6: Feedback Loop (👍/👎) على التوصيات
# ============================================================


@router.post("/history/{analysis_id}/feedback", response_model=FeedbackResponse)
def submit_feedback(analysis_id: str, payload: FeedbackRequest, current_user: User = Depends(get_current_user)):
    analysis = analysis_results_collection.find_one({"analysis_id": analysis_id, "user_id": current_user.id})
    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    # B1.6: منع إرسال أكثر من تقييم واحد لنفس التحليل من نفس المستخدم عبر upsert
    # على المفتاح المركّب (user_id, analysis_id) بدل insert مباشر.
    feedback_collection.update_one(
        {"user_id": current_user.id, "analysis_id": analysis_id},
        {
            "$set": {
                "useful": payload.useful,
                "comment": payload.comment,
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "user_id": current_user.id,
                "analysis_id": analysis_id,
                "created_at": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )

    return FeedbackResponse(status="recorded", useful=payload.useful)


# ============================================================
# Batch 2.2 — B2.3/B2.4: Skill Checklist تفاعلي على الـ Roadmap
# لا يُعاد حساب Career Score تلقائياً عند وضع علامة "تعلمتها" — خطوة أولى بسيطة فقط
# (كما هو محدد صراحة في وثيقة توزيع المهام).
# ============================================================


@router.patch("/history/{analysis_id}/roadmap", response_model=RoadmapProgressResponse)
def update_roadmap_progress(
    analysis_id: str, payload: RoadmapProgressRequest, current_user: User = Depends(get_current_user)
):
    doc = analysis_results_collection.find_one({"analysis_id": analysis_id, "user_id": current_user.id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    update_operator = {"$addToSet": {"completed_skills": payload.skill}} if payload.completed else {
        "$pull": {"completed_skills": payload.skill}
    }
    analysis_results_collection.update_one({"analysis_id": analysis_id, "user_id": current_user.id}, update_operator)

    updated_doc = analysis_results_collection.find_one({"analysis_id": analysis_id, "user_id": current_user.id})
    return RoadmapProgressResponse(analysis_id=analysis_id, completed_skills=updated_doc.get("completed_skills", []))


# ============================================================
# Batch 4.1 — B4.1/B4.3: مشاركة رابط عام للنتائج
# قرار الخصوصية المعتمد: الرابط لا ينتهي إلا بإلغاء يدوي صريح من المستخدم (لا مهلة زمنية).
# ============================================================


@router.post("/history/{analysis_id}/share", response_model=ShareCreateResponse)
def create_share_link(analysis_id: str, current_user: User = Depends(get_current_user)):
    doc = analysis_results_collection.find_one({"analysis_id": analysis_id, "user_id": current_user.id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    # عملية idempotent: إذا كان هناك رابط مُفعَّل مسبقاً، نعيده كما هو بدلاً من توليد رابط جديد
    # يُبطل الرابط القديم الذي ربما شاركه المستخدم فعلياً مع أحد.
    existing_token = doc.get("share_token")
    if existing_token:
        return ShareCreateResponse(share_token=existing_token, already_existed=True)

    new_token = secrets.token_urlsafe(24)
    analysis_results_collection.update_one(
        {"analysis_id": analysis_id, "user_id": current_user.id},
        {"$set": {"share_token": new_token, "shared_at": datetime.now(timezone.utc)}},
    )
    return ShareCreateResponse(share_token=new_token, already_existed=False)


@router.delete("/history/{analysis_id}/share", response_model=ShareRevokeResponse)
def revoke_share_link(analysis_id: str, current_user: User = Depends(get_current_user)):
    doc = analysis_results_collection.find_one({"analysis_id": analysis_id, "user_id": current_user.id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    # إلغاء idempotent: النجاح حتى لو لم يكن هناك رابط مُفعَّل أصلاً
    analysis_results_collection.update_one(
        {"analysis_id": analysis_id, "user_id": current_user.id},
        {"$unset": {"share_token": "", "shared_at": ""}},
    )
    return ShareRevokeResponse(status="revoked")
