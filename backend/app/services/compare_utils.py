"""
Batch 2.1 — B2.2: حساب الفرق (delta) بين تحليلين على مستوى الخادم، لتخفيف الحمل عن الفرونت.

نُعرّف "المهارات المتوفرة" لكل تحليل بأنها اتحاد matched_skills عبر كل الوظائف الخمس المقترحة
(top_jobs) — نفس الحقل الذي تعرضه صفحة Results أصلاً لكل وظيفة، فلا حاجة لإعادة حساب أي شيء
من قاعدة البيانات العلائقية.
"""
from __future__ import annotations


def compute_matched_skills_set(analysis_doc: dict) -> set[str]:
    skills: set[str] = set()
    for job in analysis_doc.get("top_jobs", []):
        skills.update(job.get("matched_skills", []))
    return skills


def compute_comparison(doc_a: dict, doc_b: dict) -> dict:
    """يحسب الفرق بين تحليلين. doc_b يُعتبر الأحدث/المرجع الثاني (delta = b - a)."""
    score_a = doc_a.get("career_score", 0.0)
    score_b = doc_b.get("career_score", 0.0)

    matched_a = compute_matched_skills_set(doc_a)
    matched_b = compute_matched_skills_set(doc_b)

    return {
        "career_score_delta": round(score_b - score_a, 2),
        "new_skills_gained": sorted(matched_b - matched_a),
        "skills_lost": sorted(matched_a - matched_b),
    }
