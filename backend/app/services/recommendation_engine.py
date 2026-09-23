"""
Career Recommendation Engine — تطبيق حرفي لخوارزمية القسم 6 من دليل التطوير التقني.

الخطوات (نفس ترقيم القسم 6.5):
1. حساب درجة إتقان كل مهارة يملكها المستخدم (skill_proficiency) — القسم 6.2
2. حساب نسبة التوافق مع كل وظيفة من الـ 30 (job_match_percentage) — القسم 6.3
3. ترتيب الوظائف واختيار أفضل 5
4. حساب Career Score الإجمالي — القسم 6.4
5. بناء Career DNA
6. تحديد نقاط القوة والضعف
7. تحديد فجوة المهارات لأفضل وظيفة (skill_gap)
8. بناء Roadmap لثلاثة أشهر
9. اقتراح كورسات لكل مهارة في skill_gap

يُبنى هذا المحرك كخدمة مستقلة (وليس داخل route مباشرة) تماماً كما توصي "ملاحظة للباك" في القسم 6.5،
لتسهيل الاختبار الوحدوي لكل دالة على حدة (انظر backend/tests/test_recommendation_engine.py).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.orm import Session

from app.models.mysql_models import Course, Job, JobSkill, Question, Skill
from app.seed.skills_data import SKILLS

DNA_TECHNICAL_AXES = ("Programming", "Data Handling", "System Design")
DNA_ASSESSMENT_AXES = ("Communication", "Problem Solving")
ALL_DNA_AXES = ("Programming", "Problem Solving", "Communication", "System Design", "Data Handling")


# ============================================================
# بنى بيانات وسيطة
# ============================================================


@dataclass
class UserProfileInput:
    """كل المعطيات اللازمة لتشغيل الخوارزمية على مستخدم واحد."""

    skills: list[str]
    projects: list[dict]  # كل عنصر: {"title","description","technologies":[...]}
    education: list[dict]  # كل عنصر: {"degree","institution","year"}
    experience: list[dict]  # كل عنصر: {"title","company","duration_months","description"}
    assessment_answers: list[dict]  # كل عنصر: {"question_id","value"}


@dataclass
class JobMatchResult:
    job_title: str
    match_percentage: float
    matched_skills: list[str]
    missing_skills: list[str]
    essential_skills: list[str]
    missing_essential: list[str]
    missing_important: list[str]
    missing_bonus: list[str]
    explanation: str = ""  # Batch 3.1 — جملة توضيحية مبنية من نفس البيانات أعلاه


@dataclass
class RecommendationResult:
    career_score: float
    career_dna: dict
    top_jobs: list[JobMatchResult]
    strengths: list[str]
    weaknesses: list[str]
    skill_gap: dict
    roadmap: list[dict]
    suggested_courses: list[dict]
    user_skill_profile: dict = field(default_factory=dict)


# ============================================================
# 1. skill_proficiency — القسم 6.2
# ============================================================


def _project_usage_count(skill: str, projects: list[dict]) -> int:
    count = 0
    for p in projects:
        techs = [t.lower() for t in p.get("technologies", [])]
        if skill.lower() in techs:
            count += 1
    return count


def _experience_months_for_skill(skill: str, experience: list[dict]) -> int:
    """يجمع أشهر الخبرة من كل عمل يذكر المهارة في عنوانه أو وصفه (heuristic القسم 6.2)."""
    total = 0
    for exp in experience:
        haystack = f"{exp.get('title', '')} {exp.get('description', '')}".lower()
        if skill.lower() in haystack:
            total += int(exp.get("duration_months", 0) or 0)
    return total


def _assessment_bonus_for_skill(skill: str, assessment_answers: list[dict], questions_by_id: dict[str, Question]) -> float:
    """يستخرج نقاط bonus (0-10) من إجابات الأسئلة المرتبطة صريحاً بهذه المهارة (related_skill_id)."""
    for ans in assessment_answers:
        question = questions_by_id.get(str(ans.get("question_id")))
        if question is None or question.related_skill_id is None:
            continue
        if question.related_skill_id_name != skill:  # يُضبط خارجياً، انظر build_questions_index
            continue
        value = ans.get("value")
        for opt in question.options:
            if str(value) == opt.text:
                return min(10, opt.bonus_points)
    return 0.0


def calculate_skill_proficiency(
    skill: str,
    user_skills: list[str],
    projects: list[dict],
    experience: list[dict],
    assessment_answers: list[dict],
    questions_by_id: dict[str, Question],
) -> float:
    base_presence = 30.0 if skill in user_skills else 0.0
    project_points = min(45.0, _project_usage_count(skill, projects) * 15.0)
    exp_months = _experience_months_for_skill(skill, experience)
    experience_points = min(25.0, (exp_months / 6.0) * 10.0)
    assessment_bonus = _assessment_bonus_for_skill(skill, assessment_answers, questions_by_id)

    total = base_presence + project_points + experience_points + assessment_bonus
    return min(100.0, round(total, 2))


def build_user_skill_profile(
    profile_input: UserProfileInput,
    questions_by_id: dict[str, Question],
) -> dict[str, float]:
    """يحسب درجة إتقان كل مهارة يملكها المستخدم (الخطوة 1 من القسم 6.5)."""
    proficiency: dict[str, float] = {}
    for skill in profile_input.skills:
        proficiency[skill] = calculate_skill_proficiency(
            skill,
            profile_input.skills,
            profile_input.projects,
            profile_input.experience,
            profile_input.assessment_answers,
            questions_by_id,
        )
    return proficiency


# ============================================================
# 2. job_match_percentage — القسم 6.3
# ============================================================


def calculate_job_match(
    user_skill_profile: dict[str, float],
    essential_skills: list[str],
    important_skills: list[str],
    bonus_skills: list[str],
) -> tuple[float, list[str], list[str], list[str]]:
    def avg_proficiency(skills: list[str]) -> float:
        if not skills:
            return 0.0
        return sum(user_skill_profile.get(s, 0.0) for s in skills) / len(skills)

    essential_score = avg_proficiency(essential_skills) * 0.60
    important_score = avg_proficiency(important_skills) * 0.30
    bonus_score = avg_proficiency(bonus_skills) * 0.10

    missing_essential = [s for s in essential_skills if user_skill_profile.get(s, 0.0) == 0.0]
    missing_important = [s for s in important_skills if user_skill_profile.get(s, 0.0) == 0.0]
    missing_bonus = [s for s in bonus_skills if user_skill_profile.get(s, 0.0) == 0.0]

    # قاعدة العقاب: خصم 5 نقاط من essential_score عن كل مهارة أساسية مفقودة تماماً
    essential_score = max(0.0, essential_score - 5.0 * len(missing_essential))

    job_match_percentage = min(100.0, max(0.0, essential_score + important_score + bonus_score))
    return round(job_match_percentage, 2), missing_essential, missing_important, missing_bonus


def generate_explanation(job_match: JobMatchResult) -> str:
    """Batch 3.1 — يبني جملة توضيحية ذكية (Template) من matched_skills و missing_essential
    الموجودة أصلاً في JobMatchResult، دون الحاجة لأي نموذج AI خارجي.
    """
    matched_sample = "، ".join(job_match.matched_skills[:3]) if job_match.matched_skills else None
    missing_sample = "، ".join(job_match.missing_essential[:2]) if job_match.missing_essential else None

    if not job_match.missing_essential:
        if matched_sample:
            return f"تمتلك جميع المهارات الأساسية المطلوبة لهذه الوظيفة مثل {matched_sample}، مما يجعلها خياراً قوياً لك."
        return "تمتلك جميع المهارات الأساسية المطلوبة لهذه الوظيفة."

    if matched_sample:
        base = f"تمتلك مهارات مهمة مثل {matched_sample}"
    else:
        base = "لا تمتلك حالياً معظم المهارات الأساسية المطلوبة لهذه الوظيفة"

    return f"{base}، لكن يُنصح بتطوير {missing_sample} لرفع نسبة توافقك مع هذه الوظيفة."


def calculate_all_job_matches(
    user_skill_profile: dict[str, float],
    jobs: list[Job],
) -> list[JobMatchResult]:
    results: list[JobMatchResult] = []
    for job in jobs:
        essential = [js.skill.name for js in job.skills if js.importance_level.value == "essential"]
        important = [js.skill.name for js in job.skills if js.importance_level.value == "important"]
        bonus = [js.skill.name for js in job.skills if js.importance_level.value == "bonus"]

        match_pct, missing_essential, missing_important, missing_bonus = calculate_job_match(
            user_skill_profile, essential, important, bonus
        )

        all_required = essential + important + bonus
        matched = [s for s in all_required if user_skill_profile.get(s, 0.0) > 0.0]
        missing = missing_essential + missing_important + missing_bonus

        job_match = JobMatchResult(
            job_title=job.title,
            match_percentage=match_pct,
            matched_skills=matched,
            missing_skills=missing,
            essential_skills=essential,
            missing_essential=missing_essential,
            missing_important=missing_important,
            missing_bonus=missing_bonus,
        )
        job_match.explanation = generate_explanation(job_match)  # Batch 3.2
        results.append(job_match)
    results.sort(key=lambda r: r.match_percentage, reverse=True)
    return results


# ============================================================
# 4. Career Score الإجمالي — القسم 6.4
# ============================================================


def calculate_profile_completeness(profile_input: UserProfileInput) -> float:
    missing_sections = 0
    if not profile_input.projects:
        missing_sections += 1
    if not profile_input.experience:
        missing_sections += 1
    if not profile_input.education:
        missing_sections += 1
    return max(0.0, 100.0 - 25.0 * missing_sections)


def calculate_skill_diversity(user_skills: list[str]) -> float:
    categories = set()
    for skill in user_skills:
        info = SKILLS.get(skill)
        if info:
            categories.add(info[0])
    return min(100.0, (len(categories) / 4.0) * 100.0)


def calculate_experience_score(profile_input: UserProfileInput) -> float:
    total_months = sum(int(e.get("duration_months", 0) or 0) for e in profile_input.experience)
    return min(100.0, total_months * 2.5)


def calculate_career_score(
    top_5_matches: list[JobMatchResult],
    profile_input: UserProfileInput,
) -> float:
    avg_top5 = sum(m.match_percentage for m in top_5_matches) / len(top_5_matches) if top_5_matches else 0.0
    completeness = calculate_profile_completeness(profile_input)
    diversity = calculate_skill_diversity(profile_input.skills)
    experience = calculate_experience_score(profile_input)

    score = avg_top5 * 0.50 + completeness * 0.20 + diversity * 0.15 + experience * 0.15
    return round(min(100.0, max(0.0, score)), 2)


# ============================================================
# 5. Career DNA
# ============================================================


def calculate_career_dna(
    user_skill_profile: dict[str, float],
    assessment_answers: list[dict],
    questions_by_id: dict[str, Question],
) -> dict[str, float]:
    dna: dict[str, float] = {}

    # المحاور التقنية: متوسط إتقان كل المهارات المرتبطة بهذا المحور
    for axis in DNA_TECHNICAL_AXES:
        axis_skills = [s for s, info in SKILLS.items() if info[1] == axis and s in user_skill_profile]
        if axis_skills:
            dna[axis] = round(sum(user_skill_profile[s] for s in axis_skills) / len(axis_skills), 2)
        else:
            dna[axis] = 0.0

    # محورا Communication و Problem Solving: من أسئلة scale المخصصة (dna_axis)
    axis_key_map = {"communication": "Communication", "problem_solving": "Problem Solving"}
    for question in questions_by_id.values():
        if not question.dna_axis:
            continue
        axis_name = axis_key_map.get(question.dna_axis)
        if not axis_name:
            continue
        for ans in assessment_answers:
            if str(ans.get("question_id")) == str(question.id):
                try:
                    scale_value = float(ans.get("value"))
                    dna[axis_name] = round(min(100.0, max(0.0, scale_value * 20.0)), 2)
                except (TypeError, ValueError):
                    pass

    for axis in ALL_DNA_AXES:
        dna.setdefault(axis, 50.0)  # قيمة افتراضية معتدلة إذا لم تتوفر بيانات كافية

    return dna


# ============================================================
# 6. نقاط القوة والضعف
# ============================================================


def calculate_strengths_and_weaknesses(
    user_skill_profile: dict[str, float],
    top_5_matches: list[JobMatchResult],
) -> tuple[list[str], list[str]]:
    strengths = [s for s, _ in sorted(user_skill_profile.items(), key=lambda kv: kv[1], reverse=True)][:5]

    missing_essential_counter: dict[str, int] = {}
    for match in top_5_matches:
        for skill in match.missing_essential:
            missing_essential_counter[skill] = missing_essential_counter.get(skill, 0) + 1

    weaknesses = [skill for skill, count in missing_essential_counter.items() if count > 1]
    if not weaknesses:
        weaknesses = list(missing_essential_counter.keys())[:5]
    return strengths[:5], weaknesses[:5]


# ============================================================
# 7. Skill Gap لأفضل وظيفة
# ============================================================


def build_skill_gap(top_job: Optional[JobMatchResult]) -> dict[str, list[str]]:
    if top_job is None:
        return {"critical": [], "recommended": [], "nice_to_have": []}
    return {
        "critical": top_job.missing_essential,
        "recommended": top_job.missing_important,
        "nice_to_have": top_job.missing_bonus,
    }


# ============================================================
# 8. Roadmap لثلاثة أشهر
# ============================================================


import ollama
import json
import logging

logger = logging.getLogger(__name__)

def build_three_month_roadmap(skill_gap: dict[str, list[str]], target_job: JobMatchResult | None = None) -> list[dict]:
    # Try using AI (Ollama) to generate a personalized roadmap
    all_missing = skill_gap["critical"] + skill_gap["recommended"] + skill_gap["nice_to_have"]
    job_title = target_job.job_title if target_job else "your next role"
    
    if all_missing:
        prompt = f"""
You are an expert career coach. The user wants to become a {job_title}.
They are missing these skills: {', '.join(all_missing)}.
Create a realistic 3-month learning roadmap.
Return ONLY a valid JSON array with 3 objects. Format exactly like this:
[
  {{"month": 1, "goals": ["Goal 1", "Goal 2"], "skills_to_learn": ["Skill A"]}},
  {{"month": 2, "goals": ["Goal 1"], "skills_to_learn": ["Skill B"]}},
  {{"month": 3, "goals": ["Goal 1"], "skills_to_learn": ["Skill C"]}}
]
"""
        try:
            response = ollama.chat(model='llama3.2', messages=[
                {'role': 'system', 'content': 'You are a career advisor API that strictly outputs JSON arrays.'},
                {'role': 'user', 'content': prompt}
            ], format='json')
            
            ai_roadmap = json.loads(response['message']['content'])
            if isinstance(ai_roadmap, list) and len(ai_roadmap) > 0:
                logger.info("Successfully generated AI personalized roadmap.")
                return ai_roadmap
        except Exception as e:
            logger.warning(f"AI Roadmap generation failed, falling back to static roadmap: {e}")

    # Fallback static roadmap
    roadmap = [
        {
            "month": 1,
            "goals": [f"Learn basics of {s}" for s in skill_gap["critical"]] or ["Build strong foundations"],
            "skills_to_learn": skill_gap["critical"],
        },
        {
            "month": 2,
            "goals": [f"Develop intermediate skills in {s}" for s in skill_gap["recommended"]] or ["Advance your core stack"],
            "skills_to_learn": skill_gap["recommended"],
        },
        {
            "month": 3,
            "goals": (
                [f"Explore {s}" for s in skill_gap["nice_to_have"]]
                + ["Build a capstone project utilizing your new skills"]
            ),
            "skills_to_learn": skill_gap["nice_to_have"],
        },
    ]
    return roadmap


# ============================================================
# 9. اقتراح كورسات
# ============================================================


def match_courses_to_skills(skill_gap: dict[str, list[str]], db: Session) -> list[dict]:
    all_missing = skill_gap["critical"] + skill_gap["recommended"] + skill_gap["nice_to_have"]
    if not all_missing:
        return []

    skills = db.query(Skill).filter(Skill.name.in_(all_missing)).all()
    skill_ids = [s.id for s in skills]
    if not skill_ids:
        return []

    courses = db.query(Course).filter(Course.covers_skill_id.in_(skill_ids)).all()
    seen_titles = set()
    result = []
    for course in courses:
        if course.title in seen_titles:
            continue
        seen_titles.add(course.title)
        result.append(
            {
                "title": course.title,
                "platform": course.platform,
                "url": course.url,
                "covers_skill": course.skill.name,
            }
        )
    return result


# ============================================================
# الدالة الرئيسية calculateRecommendation — القسم 6.5
# ============================================================


def build_questions_index(questions: list[Question]) -> dict[str, Question]:
    """يبني فهرساً {question_id: Question} ويُلحق باسم المهارة المرتبطة لتسهيل البحث السريع."""
    index: dict[str, Question] = {}
    for q in questions:
        q.related_skill_id_name = q.related_skill.name if q.related_skill else None  # type: ignore[attr-defined]
        index[str(q.id)] = q
    return index


def calculate_recommendation(
    profile_input: UserProfileInput,
    all_jobs: list[Job],
    questions: list[Question],
    db: Session,
) -> RecommendationResult:
    questions_by_id = build_questions_index(questions)

    # 1. درجة إتقان كل مهارة
    user_skill_profile = build_user_skill_profile(profile_input, questions_by_id)

    # 2. نسبة التوافق مع كل وظيفة
    job_matches = calculate_all_job_matches(user_skill_profile, all_jobs)

    # 3. أفضل 5 وظائف (مرتّبة مسبقاً تنازلياً)
    top_5 = job_matches[:5]

    # 4. Career Score
    career_score = calculate_career_score(top_5, profile_input)

    # 5. Career DNA
    career_dna = calculate_career_dna(user_skill_profile, profile_input.assessment_answers, questions_by_id)

    # 6. نقاط القوة والضعف
    strengths, weaknesses = calculate_strengths_and_weaknesses(user_skill_profile, top_5)

    # 7. Skill Gap لأفضل وظيفة
    skill_gap = build_skill_gap(top_5[0] if top_5 else None)

    # 8. Roadmap
    roadmap = build_three_month_roadmap(skill_gap, top_5[0] if top_5 else None)

    # 9. الدورات المقترحة
    courses = match_courses_to_skills(skill_gap, db)

    return RecommendationResult(
        career_score=career_score,
        career_dna=career_dna,
        top_jobs=top_5,
        strengths=strengths,
        weaknesses=weaknesses,
        skill_gap=skill_gap,
        roadmap=roadmap,
        suggested_courses=courses,
        user_skill_profile=user_skill_profile,
    )
