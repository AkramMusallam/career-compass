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

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Response, status

from app.core.config import settings
from app.core.mongo import analysis_results_collection
from app.schemas.schemas import SharedAnalysisResponse, SharedExchangeRequest, SharedJobMatchOut

router = APIRouter(tags=["Shared Results"])

_NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
}


def _coerce_utc(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value)
            return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


@router.post("/shared/exchange", response_model=SharedAnalysisResponse)
def exchange_shared_analysis(payload: SharedExchangeRequest, response: Response):
    response.headers.update(_NO_STORE_HEADERS)
    share_token = payload.share_token.strip()
    if not share_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This shared link was not found or has been revoked by its owner",
            headers=_NO_STORE_HEADERS,
        )

    doc = analysis_results_collection.find_one({"share_token": share_token})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This shared link was not found or has been revoked by its owner",
            headers=_NO_STORE_HEADERS,
        )

    now = datetime.now(timezone.utc)
    expires_at = _coerce_utc(doc.get("share_expires_at"))
    if expires_at is None:
        shared_at = _coerce_utc(doc.get("shared_at"))
        if shared_at is not None:
            expires_at = shared_at + timedelta(days=settings.SHARE_LINK_EXPIRE_DAYS)
    if expires_at is not None and expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This shared link has expired or been revoked by its owner",
            headers=_NO_STORE_HEADERS,
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
