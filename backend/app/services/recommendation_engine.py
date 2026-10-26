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
from app.core.config import settings

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
            from app.services.llm_client import ollama_chat
            
            ai_raw = json.loads(ollama_chat([
                {'role': 'system', 'content': 'You are a career advisor API that strictly outputs JSON arrays.'},
                {'role': 'user', 'content': prompt}
            ], json_mode=True))
            if isinstance(ai_raw, dict):
                for val in ai_raw.values():
                    if isinstance(val, list):
                        ai_raw = val
                        break
            if isinstance(ai_raw, list) and len(ai_raw) > 0:
                valid_roadmap = []
                for idx, item in enumerate(ai_raw[:3], start=1):
                    if isinstance(item, dict):
                        valid_roadmap.append(
                            {
                                "month": int(item.get("month") or idx),
                                "goals": [str(g) for g in (item.get("goals") or []) if g] or [f"Month {idx} learning goals"],
                                "skills_to_learn": [str(s) for s in (item.get("skills_to_learn") or []) if s],
                            }
                        )
                if valid_roadmap:
                    logger.info("Successfully generated AI personalized roadmap.")
                    return valid_roadmap
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
    
    courses_out = []
    if skill_ids:
        courses = db.query(Course).filter(Course.covers_skill_id.in_(skill_ids)).all()
        courses_out = [
            {
                "title": c.title,
                "platform": c.platform,
                "url": c.url,
                "covers_skill": c.skill.name
            }
            for c in courses
        ]

    # Phase 2: Dynamic Resource Recommendation Engine
    covered_skills = {c["covers_skill"] for c in courses_out}
    for skill_name in all_missing:
        if skill_name not in covered_skills:
            courses_out.append({
                "title": f"Learn {skill_name} - Full Course",
                "platform": "YouTube",
                "url": f"https://www.youtube.com/results?search_query=Learn+{skill_name.replace(' ', '+')}+full+course",
                "covers_skill": skill_name
            })
            courses_out.append({
                "title": f"{skill_name} Specialization",
                "platform": "Coursera",
                "url": f"https://www.coursera.org/search?query={skill_name.replace(' ', '%20')}",
                "covers_skill": skill_name
            })
            covered_skills.add(skill_name)
            
    return courses_out


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


# ============================================================
# Feature 6.5: Real Job Matching Engine & Postings Database
# ============================================================

JOB_POSTINGS = [
    {
        "id": "job-pal-01",
        "title": "Junior Backend Developer (Python / FastAPI)",
        "company": "Asal Technologies",
        "company_url": "https://www.asaltech.com",
        "location": "Ramallah / Hybrid",
        "type": "Full-time",
        "experience_level": "Entry / Junior (0-2 years)",
        "salary_range": "$1,400 - $2,200",
        "required_skills": ["Python", "SQL", "API Design", "Git", "REST"],
        "bonus_skills": ["Docker", "FastAPI", "PostgreSQL"],
        "description": "انضم إلى فريق تطوير الخدمات الخلفية لبناء وتطوير واجهات برمجة التطبيقات (APIs) للعملاء الدوليين باستخدام Python وقواعد البيانات العلائقية.",
        "apply_url": "https://www.asaltech.com/careers",
        "posted_date": "منذ يومين",
    },
    {
        "id": "job-pal-02",
        "title": "Frontend React Developer",
        "company": "Exalt Technologies",
        "company_url": "https://www.exalt.ps",
        "location": "Ramallah / Nablus (Hybrid)",
        "type": "Full-time",
        "experience_level": "Junior - Mid",
        "salary_range": "$1,600 - $2,600",
        "required_skills": ["JavaScript", "React", "HTML/CSS", "Git", "Tailwind CSS"],
        "bonus_skills": ["TypeScript", "Next.js", "Redux"],
        "description": "مطلوب مطور واجهات أمامية للعمل على لوحات تحكم متقدمة وتطبيقات ويب سريعة الاستجابة باستخدام React و Tailwind CSS.",
        "apply_url": "https://www.exalt.ps/careers",
        "posted_date": "منذ 4 أيام",
    },
    {
        "id": "job-pal-03",
        "title": "Full Stack Engineer (React & Node.js)",
        "company": "Harri",
        "company_url": "https://harri.ai",
        "location": "Ramallah, Palestine",
        "type": "Full-time",
        "experience_level": "Mid-Level (2-4 years)",
        "salary_range": "$2,200 - $3,500",
        "required_skills": ["JavaScript", "React", "Node.js", "SQL", "API Design", "Git"],
        "bonus_skills": ["Docker", "TypeScript", "AWS"],
        "description": "فرصة للمساهمة في بناء منصة Harri العالمية لإدارة الضيافة والموارد البشرية، وتطوير دورة حياة الميزات من الواجهة إلى قاعدة البيانات.",
        "apply_url": "https://harri.ai/careers/",
        "posted_date": "منذ أسبوع",
    },
    {
        "id": "job-pal-04",
        "title": "Software Engineer (Backend & Cloud)",
        "company": "Foothill Technology Solutions",
        "company_url": "https://foothillsolutions.com/",
        "location": "Nablus / Remote",
        "type": "Full-time",
        "experience_level": "Junior - Mid",
        "salary_range": "$1,700 - $2,800",
        "required_skills": ["OOP", "Python", "SQL", "Git", "Docker"],
        "bonus_skills": ["CI/CD", "AWS", "Microservices"],
        "description": "تطوير أنظمة سحابية وخدمات مصغرة لشركات رعاية صحية وتكنولوجيا في أمريكا الشمالية بالتعاون مع فرق هندسية متميزة.",
        "apply_url": "https://foothill.na.teamtailor.com/",
        "posted_date": "مفتوحة حديثاً",
    },
    {
        "id": "job-rem-05",
        "title": "Remote Junior Python & Data Automation Engineer",
        "company": "Canonical (Ubuntu)",
        "company_url": "https://canonical.com",
        "location": "Worldwide Remote (Palestine Eligible)",
        "type": "Remote",
        "experience_level": "Entry / Graduate",
        "salary_range": "$2,500 - $3,800",
        "required_skills": ["Python", "Linux", "Git", "SQL"],
        "bonus_skills": ["Docker", "Bash", "Testing (Pytest)"],
        "description": "وظيفة عالمية عن بُعد بالكامل تركز على أتمتة الأنظمة وبناء أدوات المراقبة وإدارة الحزم في بيئات لينكس وسحابية متقدمة.",
        "apply_url": "https://canonical.com/careers",
        "posted_date": "منذ 3 أيام",
    },
    {
        "id": "job-rem-06",
        "title": "Associate DevOps & Infrastructure Specialist",
        "company": "GitLab",
        "company_url": "https://about.gitlab.com",
        "location": "Remote",
        "type": "Full-time Remote",
        "experience_level": "Junior - Mid",
        "salary_range": "$3,000 - $4,500",
        "required_skills": ["Git", "CI/CD", "Docker", "Linux"],
        "bonus_skills": ["Kubernetes", "AWS", "Terraform", "Python"],
        "description": "المشاركة في تحسين خطوط الأنابيب الآلية (CI/CD)، وضمان موثوقية البنية التحتية، وتوفير بيئات تشغيل مرنة ومستقرة للمطورين.",
        "apply_url": "https://about.gitlab.com/jobs/",
        "posted_date": "منذ 5 أيام",
    },
    {
        "id": "job-pal-07",
        "title": "Mobile App Developer (Flutter / React Native)",
        "company": "Souktel Digital Solutions",
        "company_url": "https://www.linkedin.com/company/souktel",
        "location": "Ramallah / Hybrid",
        "type": "Full-time",
        "experience_level": "Mid-Level",
        "salary_range": "$1,800 - $3,000",
        "required_skills": ["Flutter", "React Native", "API Design", "Git", "OOP"],
        "bonus_skills": ["State Management", "Firebase", "Offline Sync"],
        "description": "بناء تطبيقات هواتف ذكية موثوقة لمشاريع إنسانية وتنموية تخدم ملايين المستخدمين في الشرق الأوسط وإفريقيا.",
        "apply_url": "https://www.souktel.org/",
        "posted_date": "منذ أسبوعين",
    },
    {
        "id": "job-pal-08",
        "title": "Data Analyst & Business Intelligence Specialist",
        "company": "WalaPlus",
        "company_url": "https://www.walaplus.com",
        "location": "Remote / Palestine",
        "type": "Full-time",
        "experience_level": "Entry / Mid",
        "salary_range": "$1,500 - $2,400",
        "required_skills": ["SQL", "Python", "Data Analysis", "Statistics"],
        "bonus_skills": ["Power BI", "Data Visualization", "Excel"],
        "description": "تحليل بيانات العملاء وسلوك المستخدمين واستخراج مؤشرات أداء دقيقة لدعم اتخاذ القرارات الإستراتيجية للمنصة.",
        "apply_url": "https://walaplus.zohorecruit.com/jobs/Careers",
        "posted_date": "منذ 3 أيام",
    },
    {
        "id": "job-pal-09",
        "title": "Software QA & Automation Engineer",
        "company": "Progineer Technologies",
        "company_url": "https://progineer.net",
        "location": "Ramallah, Palestine",
        "type": "Full-time",
        "experience_level": "Entry / Mid",
        "salary_range": "$1,500 - $2,500",
        "required_skills": ["Software Testing", "Selenium", "Python", "Git", "API Testing"],
        "bonus_skills": ["CI/CD", "Docker", "Linux"],
        "description": "المشاركة في فحص وضمان جودة الأنظمة البرمجية المتقدمة لعملاء عالميين، وكتابة سيناريوهات الاختبار المؤتمتة باستخدام Python و Selenium.",
        "apply_url": "https://progineer.net/careers/",
        "posted_date": "منذ 3 أيام",
    },
    {
        "id": "job-rem-10",
        "title": "Remote Web Developer (JavaScript / React / PHP)",
        "company": "Automattic",
        "company_url": "https://automattic.com",
        "location": "Worldwide Remote",
        "type": "Full-time Remote",
        "experience_level": "Junior - Mid",
        "salary_range": "$3,000 - $4,800",
        "required_skills": ["JavaScript", "React", "HTML/CSS", "Git", "REST"],
        "bonus_skills": ["TypeScript", "PHP", "Docker"],
        "description": "تطوير المنصات الرقمية وتطبيقات الويب مفتوحة المصدر لملايين المستخدمين حول العالم ضمن بيئة عمل مرنة وعالمية عن بُعد.",
        "apply_url": "https://automattic.com/work-with-us/",
        "posted_date": "منذ 4 أيام",
    },
    {
        "id": "job-pal-11",
        "title": "Network & Systems Infrastructure Specialist",
        "company": "Paltel Group",
        "company_url": "https://www.paltelgroup.ps/",
        "location": "Ramallah / Nablus",
        "type": "Full-time",
        "experience_level": "Entry / Mid",
        "salary_range": "$1,400 - $2,300",
        "required_skills": ["Linux", "Networking Fundamentals", "Bash", "Git"],
        "bonus_skills": ["Python", "Docker", "Cybersecurity Fundamentals"],
        "description": "إدارة وصيانة شبكات الاتصالات والبنى التحتية للخوادم والأنظمة السحابية لخدمة كبرى المؤسسات في فلسطين.",
        "apply_url": "https://www.paltelgroup.ps/",
        "posted_date": "منذ أسبوع",
    },
    {
        "id": "job-rem-12",
        "title": "Junior Cloud & Data Infrastructure Engineer",
        "company": "Spotify",
        "company_url": "https://spotify.com",
        "location": "Remote (EMEA)",
        "type": "Full-time Remote",
        "experience_level": "Junior - Mid",
        "salary_range": "$3,500 - $5,200",
        "required_skills": ["Python", "SQL", "Docker", "Git", "Linux"],
        "bonus_skills": ["AWS", "Kubernetes", "ETL Pipelines"],
        "description": "بناء وتطوير خطوط نقل ومعالجة البيانات السحابية الضخمة لدعم ملايين المستخدمين في الاستماع التفاعلي واقتراحات الذكاء الاصطناعي.",
        "apply_url": "https://www.lifeatspotify.com/jobs",
        "posted_date": "مفتوحة حديثاً",
    },
]
_TECH_SYNONYMS: dict[str, list[str]] = {
    "sql": ["postgresql", "mysql", "sqlite", "tsql", "plsql", "postgres"],
    "rest": ["rest api", "rest apis", "restful", "restful api"],
    "git": ["github", "gitlab", "version control", "git vcs"],
    "react": ["react.js", "reactjs"],
    "node.js": ["nodejs", "node"],
    "vue.js": ["vuejs", "vue"],
    "tailwind css": ["tailwind", "tailwindcss"],
    "html/css": ["html", "css", "html5", "css3"],
    "ci/cd": ["github actions", "gitlab ci", "jenkins"],
    "python": ["python 3", "python3"],
    "docker": ["docker containers", "containerization"],
    "api design": ["restful api", "rest api", "api development"],
}


def _is_job_skill_match(required_skill: str, candidate_skills: list[str]) -> bool:
    req = required_skill.strip().lower()
    for cand in candidate_skills:
        c = cand.strip().lower()
        if req == c:
            return True
        if (req in c or c in req) and len(req) >= 3 and len(c) >= 3:
            return True
        if req in _TECH_SYNONYMS and any(syn in c for syn in _TECH_SYNONYMS[req]):
            return True
        if c in _TECH_SYNONYMS and any(syn in req for syn in _TECH_SYNONYMS[c]):
            return True
    return False


def match_candidate_to_job_postings(
    candidate_skills: list[str],
    target_role: str = "",
    min_match_percentage: int = 15,
) -> list[dict]:
    results = []

    for posting in JOB_POSTINGS:
        required = posting.get("required_skills", [])
        bonus = posting.get("bonus_skills", [])

        matched_required = [r for r in required if _is_job_skill_match(r, candidate_skills)]
        missing_required = [r for r in required if not _is_job_skill_match(r, candidate_skills)]
        matched_bonus = [b for b in bonus if _is_job_skill_match(b, candidate_skills)]
        missing_bonus = [b for b in bonus if not _is_job_skill_match(b, candidate_skills)]

        total_req_w = len(required) * 1.0
        total_bon_w = len(bonus) * 0.3
        total_possible = total_req_w + total_bon_w

        if total_possible == 0:
            match_pct = 50.0
        else:
            earned = (len(matched_required) * 1.0) + (len(matched_bonus) * 0.3)
            match_pct = min(100.0, (earned / total_possible) * 100.0)

        if target_role:
            target_norm = target_role.lower()
            job_norm = posting["title"].lower()
            if any(term in job_norm for term in target_norm.split()):
                match_pct = min(100.0, match_pct + 5.0)

        final_pct = round(match_pct, 1)
        if final_pct >= min_match_percentage:
            results.append(
                {
                    "id": posting["id"],
                    "title": posting["title"],
                    "company": posting["company"],
                    "company_url": posting.get("company_url", posting.get("apply_url", "")),
                    "location": posting["location"],
                    "type": posting["type"],
                    "experience_level": posting["experience_level"],
                    "salary_range": posting.get("salary_range", "حسب الخبرة"),
                    "description": posting["description"],
                    "apply_url": posting["apply_url"],
                    "posted_date": posting.get("posted_date", "حديثاً"),
                    "match_percentage": final_pct,
                    "matched_skills": matched_required + matched_bonus,
                    "missing_skills": missing_required,
                    "bonus_skills_missing": missing_bonus,
                }
            )

    results.sort(key=lambda x: x["match_percentage"], reverse=True)
    return results

