"""
مسارات واجهات إضافة المتصفح (Chrome Browser Extension API)
القسم 7.2 من وثيقة المواصفات: Chrome Browser Extension (LinkedIn Active Matching).
"""
from __future__ import annotations

import re
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.mongo import analysis_results_collection, extractions_collection
from app.core.security import get_current_user
from app.models.mysql_models import User
from app.schemas.schemas import ExtensionMatchRequest, ExtensionMatchResponse
from app.seed.skills_data import SKILLS, normalize_and_dedupe_skills
from app.services.recommendation_engine import _is_job_skill_match

router = APIRouter(prefix="/extension", tags=["Chrome Browser Extension"])


_COMPILED_SKILL_PATTERNS = [
    (
        skill_name,
        re.compile(
            r"(?<![a-z0-9])" + re.escape(skill_name.lower()) + r"(?![a-z0-9])"
        ),
    )
    for skill_name in SKILLS.keys()
]


def _extract_skills_from_text(text: str) -> List[str]:
    """استخراج المهارات التقنية المذكورة في نص إعلان الوظيفة."""
    found = []
    lower = text.lower()
    for skill_name, compiled_re in _COMPILED_SKILL_PATTERNS:
        if compiled_re.search(lower):
            found.append(skill_name)
    return normalize_and_dedupe_skills(found)


@router.post("/match-job", response_model=ExtensionMatchResponse)
def match_extension_job(
    payload: ExtensionMatchRequest,
    current_user: User = Depends(get_current_user),
):
    """
    تحليل إعلان الوظيفة المعروض حالياً على LinkedIn أو مواقع التوظيف
    ومقارنته فورياً مع سيرة ومهارات المستخدم لتوليد نسبة التوافق والنصائح.
    """
    # جلب أحدث سيرة ذاتية مستخرجة للمستخدم
    ext = extractions_collection.find_one(
        {"user_id": current_user.id},
        sort=[("_id", -1)],
    )

    candidate_skills = ext.get("skills", []) if ext else []
    candidate_name = current_user.full_name

    # استخراج المهارات المطلوبة من نص الوظيفة إن لم تكن ممررة مسبقاً
    required_skills = payload.extracted_skills or []
    if not required_skills:
        required_skills = _extract_skills_from_text(payload.job_description)
    if not required_skills:
        # إذا لم يتم اكتشاف مهارات، استخدم مهارات عامة من العنوان
        required_skills = _extract_skills_from_text(payload.job_title) or ["Problem Solving", "Git", "Communication"]

    # حساب المطابقة
    matched = [s for s in required_skills if _is_job_skill_match(s, candidate_skills)]
    missing = [s for s in required_skills if not _is_job_skill_match(s, candidate_skills)]

    total_req = max(1, len(required_skills))
    match_score = int(round((len(matched) / total_req) * 100))
    match_score = max(10, min(98, match_score))

    # الحكم والتقييم
    if match_score >= 75:
        verdict = "تطابق ممتاز (Strong Match) 🚀"
        recommendations = [
            "ملفك الشخصي يغطي أهم متطلبات هذا الشاغر؛ قدّم الآن مباشرة!",
            "أبرز خبرتك في " + (matched[0] if matched else "مشاريعك السابقة") + " في مقدمة السيرة الذاتية.",
        ]
    elif match_score >= 45:
        verdict = "تطابق جيد مع وجود فجوات بسيطة 💡"
        recommendations = [
            f"يُفضل إضافة مشاريع أو شهادات تغطي: {', '.join(missing[:2])} إن كنت تمتلك معرفة بها.",
            "استخدم نموذج الـ Cover Letter المخصص أدناه لتوضيح مهاراتك القابلة للنقل.",
        ]
    else:
        verdict = "يحتاج لتطوير مهارات محددة 🎯"
        recommendations = [
            f"الوظيفة تركز بشكل أساسي على: {', '.join(missing[:3])}.",
            "تفقّد خطة الـ Roadmap في حسابك Career Compass لتعلم هذه التقنيات.",
        ]

    # نموذج فقرة Cover Letter مقترحة
    company_name = payload.company or "فريق التوظيف"
    cover_snippet = (
        f"يسعدني التقدم لشغل وظيفة {payload.job_title} لدى {company_name}. "
        f"بفضل خبرتي في {', '.join(matched[:3]) if matched else 'تطوير البرمجيات'}، "
        f"أثق في قدرتي على تقديم قيمة فورية لفريقكم والمساهمة في تحقيق أهدافكم التقنية."
    )

    return ExtensionMatchResponse(
        job_title=payload.job_title,
        company=payload.company or "LinkedIn Opportunity",
        candidate_name=candidate_name,
        match_score=match_score,
        verdict=verdict,
        matched_skills=matched,
        missing_skills=missing,
        recommendations=recommendations,
        suggested_cover_letter_snippet=cover_snippet,
        candidate_skills_count=len(candidate_skills),
        required_skills_count=len(required_skills),
    )
