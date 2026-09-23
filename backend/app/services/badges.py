"""
Batch 4.3 — B4.5/B4.6: قائمة الإنجازات (Badges) ومنطق حساب ما تحقق منها لكل مستخدم.

نبدأ بالثلاث إنجازات المحددة في وثيقة توزيع المهام فقط:
1. first_analysis — أول تحليل مكتمل
2. score_boost_10 — تحسّن Career Score بمقدار 10 نقاط أو أكثر بين تحليلين لنفس المستخدم
3. first_month_roadmap — إتمام كل مهارات الشهر الأول من خطة التعلم في أحد التحليلات
"""
from __future__ import annotations

from datetime import datetime

BADGE_CATALOGUE = [
    {
        "id": "first_analysis",
        "title": "أول خطوة",
        "description": "أكملت أول تحليل مهني على Career Compass",
    },
    {
        "id": "score_boost_10",
        "title": "تحسّن ملحوظ",
        "description": "رفعت Career Score بمقدار 10 نقاط أو أكثر بين تحليلين",
    },
    {
        "id": "first_month_roadmap",
        "title": "التزام أول شهر",
        "description": "أكملت كل مهارات الشهر الأول من خطة التعلم في أحد تحليلاتك",
    },
]


def _check_first_analysis(analyses: list[dict]) -> tuple[bool, datetime | None]:
    if not analyses:
        return False, None
    earliest = min(analyses, key=lambda a: a["date"])
    return True, earliest["date"]


def _check_score_boost_10(analyses: list[dict]) -> tuple[bool, datetime | None]:
    if len(analyses) < 2:
        return False, None
    ordered = sorted(analyses, key=lambda a: a["date"])
    min_score_so_far = ordered[0]["career_score"]
    for analysis in ordered[1:]:
        if analysis["career_score"] - min_score_so_far >= 10:
            return True, analysis["date"]
        min_score_so_far = min(min_score_so_far, analysis["career_score"])
    return False, None


def _check_first_month_roadmap(analyses: list[dict]) -> tuple[bool, datetime | None]:
    for analysis in sorted(analyses, key=lambda a: a["date"]):
        roadmap = analysis.get("roadmap", [])
        month_1 = next((m for m in roadmap if m.get("month") == 1), None)
        if not month_1:
            continue
        required_skills = set(month_1.get("skills_to_learn", []))
        if not required_skills:
            continue
        completed = set(analysis.get("completed_skills", []))
        if required_skills.issubset(completed):
            return True, analysis["date"]
    return False, None


_CHECKERS = {
    "first_analysis": _check_first_analysis,
    "score_boost_10": _check_score_boost_10,
    "first_month_roadmap": _check_first_month_roadmap,
}


def compute_user_badges(analyses: list[dict]) -> list[dict]:
    """يأخذ كل مستندات تحليل المستخدم (من MongoDB) ويُرجع حالة كل إنجاز في الكتالوج."""
    results = []
    for badge in BADGE_CATALOGUE:
        checker = _CHECKERS[badge["id"]]
        achieved, achieved_at = checker(analyses)
        results.append(
            {
                "id": badge["id"],
                "title": badge["title"],
                "description": badge["description"],
                "achieved": achieved,
                "achieved_at": achieved_at,
            }
        )
    return results
