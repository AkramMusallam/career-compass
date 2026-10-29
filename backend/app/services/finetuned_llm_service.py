"""
خدمة الذكاء الاصطناعي المدرب على النطاق الإقليمي (Domain Fine-Tuned LLM Pipeline & Regional Recruiter Intelligence)
تُعنى بتوليد تحليلات ملائمة المرشحين وتطبيق القوالب التخصصية المدربة لسوق العمل الإقليمي.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.services.llm_client import call_llm_messages, strip_json_fences
from app.services.regional_taxonomy import normalize_regional_job_title

logger = logging.getLogger(__name__)


def generate_candidate_fit_evaluation(
    candidate_name: str,
    target_role: str,
    candidate_skills: List[str],
    job_title: str,
    required_skills: List[str],
    bonus_skills: List[str],
    matched_skills: List[str],
    missing_skills: List[str],
    match_percentage: int,
) -> Dict[str, Any]:
    """توليد تقرير ملاءمة معمّق للمرشح لصالح مسؤولي التوظيف والشركات بالاستناد لمعايير النطاق."""
    prompt = f"""أنت خبير توظيف تقني أول (Senior Technical Recruiter) متخصص في أسواق التكنولوجيا الإقليمية والعالمية.
قم بتقييم مدى ملاءمة المرشح التالي لفرصة العمل الشاغرة لدى الشركة.

معلومات المرشح:
- الاسم: {candidate_name}
- المسمى الحالي/المستهدف: {target_role}
- مهارات المرشح: {', '.join(candidate_skills[:15])}

متطلبات الوظيفة الشاغرة:
- المسمى المطلوب: {job_title}
- المهارات الإلزامية: {', '.join(required_skills)}
- المهارات الإضافية: {', '.join(bonus_skills)}

نتائج المطابقة الخوارزمية:
- نسبة التطابق: {match_percentage}%
- المهارات المتوفرة: {', '.join(matched_skills) if matched_skills else 'لا توجد مهارات مطابقة مباشرة'}
- المهارات الناقصة: {', '.join(missing_skills) if missing_skills else 'لا توجد متطلبات ناقصة'}

المطلوب: أعد كائن JSON صالحاً تماماً يحتوي على:
{{
  "verdict": "توصية موجزة بجملة واحدة (مثال: موصى به بقوة للمقابلة الفنية الأولى)",
  "fit_summary": "فقرة تحليلية من 2-3 أسطر باللغة العربية تشرح نقاط قوة المرشح ونقاط التطوير المطلوبة للوظيفة",
  "interview_focus_areas": ["سؤال مقترح أول في المهارة المفقودة", "سؤال مقترح ثان في مهارة معمارية"],
  "hiring_readiness": "High" | "Medium" | "Needs Upskilling"
}}
أرجع فقط كود JSON بدون أي مقدمات أو علامات نصية خارجية.
"""

    raw = ""
    try:
        raw = call_llm_messages(
            [{"role": "user", "content": prompt}],
            is_json=True,
            temperature=0.3,
            max_tokens=400,
            timeout=10.0,
        )
    except Exception:
        pass

    if raw:
        try:
            cleaned = strip_json_fences(raw)
            data = json.loads(cleaned.strip())
            return {
                "verdict": data.get("verdict", "مرشح واعد للدور الوظيفي"),
                "fit_summary": data.get("fit_summary", f"المرشح يحقق نسبة تطابق {match_percentage}% مع المتطلبات الأساسية."),
                "interview_focus_areas": data.get("interview_focus_areas", [f"التركيز على مهارة {missing_skills[0]}" if missing_skills else "فحص خبرة المشاريع الحقيقية"]),
                "hiring_readiness": data.get("hiring_readiness", "High" if match_percentage >= 70 else "Medium"),
            }
        except Exception:
            logger.warning("Failed to parse LLM candidate fit evaluation, using deterministic fallback")

    # البديل الحتمي السريع والموثوق
    if match_percentage >= 75:
        verdict = "مرشح متميز - موصى به للمقابلة الفنية المباشرة"
        readiness = "High"
        summary = f"يمتلك المرشح {candidate_name} خلفية تقنية قوية تغطي معظم المهارات الأساسية المطلوبة بنسبة {match_percentage}%، مع جاهزية عالية للإنتاجية الفورية."
    elif match_percentage >= 45:
        verdict = "مرشح مناسب مع الحاجة لتقييم فني مركّز"
        readiness = "Medium"
        missing_preview = ", ".join(missing_skills[:2]) if missing_skills else "المهارات المتخصصة"
        summary = f"المرشح يمتلك أساساً جيداً بنسبة {match_percentage}%، ويُنصح باختبار مهاراته في {missing_preview} قبل اتخاذ القرار النهائي."
    else:
        verdict = "يحتاج إلى تدريب وتطوير إضافي (Upskilling)"
        readiness = "Needs Upskilling"
        summary = f"المرشح يفتقر لعدة متطلبات جوهرية لهذا الدور المتقدم بنسبة توافق {match_percentage}%، وقد يكون مناسباً لأدوار تدرجية أو برامج تدريب داخلي."

    focus_areas = [
        f"اختبار إتقان المرشح العملي لـ {matched_skills[0]}" if matched_skills else "فحص المبادئ الأساسية في هندسة البرمجيات",
        f"استكشاف إمكانية تعلّم وسد فجوة {missing_skills[0]}" if missing_skills else "تقييم حل المشكلات وتصميم النظم",
    ]

    return {
        "verdict": verdict,
        "fit_summary": summary,
        "interview_focus_areas": focus_areas,
        "hiring_readiness": readiness,
    }
