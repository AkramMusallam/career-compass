"""
سكريبت تعبئة قاعدة البيانات بالبيانات المرجعية الأولية.
يُشغَّل مرة واحدة عند إعداد المشروع (أو تلقائياً عند أول تشغيل في وضع التطوير):

    python -m app.seed.seed_runner
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models.mysql_models import Course, ImportanceLevel, Job, JobSkill, Question, QuestionOption, QuestionType, Skill
from app.seed.assessment_data import QUESTIONS, SKILL_QUESTION_OPTION_BONUS
from app.seed.courses_data import COURSES
from app.seed.jobs_data import JOBS
from app.seed.skills_data import SKILLS


def seed_skills(db: Session) -> dict[str, Skill]:
    existing = {s.name: s for s in db.query(Skill).all()}
    for name, (category, _axis) in SKILLS.items():
        if name not in existing:
            skill = Skill(name=name, category=category)
            db.add(skill)
            existing[name] = skill
    db.commit()
    return {s.name: s for s in db.query(Skill).all()}


def seed_jobs(db: Session, skills_by_name: dict[str, Skill]) -> None:
    existing_jobs = {j.title for j in db.query(Job).all()}
    for title, field, essential, important, bonus in JOBS:
        if title in existing_jobs:
            continue
        job = Job(title=title, field=field, description=f"{title} — {field}")
        db.add(job)
        db.flush()  # للحصول على job.id قبل الـ commit النهائي

        for skill_name in essential:
            db.add(JobSkill(job_id=job.id, skill_id=skills_by_name[skill_name].id, importance_level=ImportanceLevel.essential))
        for skill_name in important:
            db.add(JobSkill(job_id=job.id, skill_id=skills_by_name[skill_name].id, importance_level=ImportanceLevel.important))
        for skill_name in bonus:
            db.add(JobSkill(job_id=job.id, skill_id=skills_by_name[skill_name].id, importance_level=ImportanceLevel.bonus))
    db.commit()


def seed_questions(db: Session, skills_by_name: dict[str, Skill]) -> None:
    if db.query(Question).count() > 0:
        return
    for order_index, q in enumerate(QUESTIONS):
        related_skill_id = None
        if q["related_skill"]:
            related_skill_id = skills_by_name[q["related_skill"]].id

        question = Question(
            text=q["text"],
            type=QuestionType(q["type"]),
            required=q["required"],
            order_index=order_index,
            related_skill_id=related_skill_id,
            dna_axis=q["dna_axis"],
        )
        db.add(question)
        db.flush()

        for opt_index, opt_text in enumerate(q["options"]):
            bonus_points = SKILL_QUESTION_OPTION_BONUS.get(opt_text, 0) if q["related_skill"] else 0
            db.add(
                QuestionOption(
                    question_id=question.id,
                    text=opt_text,
                    order_index=opt_index,
                    bonus_points=bonus_points,
                )
            )
    db.commit()


def seed_courses(db: Session, skills_by_name: dict[str, Skill]) -> None:
    if db.query(Course).count() > 0:
        return
    for title, platform, url, skill_name in COURSES:
        skill = skills_by_name.get(skill_name)
        if skill is None:
            continue
        db.add(Course(title=title, platform=platform, url=url, covers_skill_id=skill.id))
    db.commit()


def run_seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        skills_by_name = seed_skills(db)
        seed_jobs(db, skills_by_name)
        seed_questions(db, skills_by_name)
        seed_courses(db, skills_by_name)
        print("✅ Seed data inserted successfully.")
        print(f"   Skills: {db.query(Skill).count()}")
        print(f"   Jobs: {db.query(Job).count()}")
        print(f"   Job-Skill links: {db.query(JobSkill).count()}")
        print(f"   Questions: {db.query(Question).count()}")
        print(f"   Courses: {db.query(Course).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
