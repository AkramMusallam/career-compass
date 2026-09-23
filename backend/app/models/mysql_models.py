"""
نماذج قاعدة البيانات العلائقية (MySQL) — القسم 2 و 7 من دليل التطوير.
الجداول السبعة: Users, Jobs, Skills, Job_Skills, Questions, Question_Options, Courses.
"""
from __future__ import annotations

import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class ImportanceLevel(str, enum.Enum):
    essential = "essential"
    important = "important"
    bonus = "bonus"


class QuestionType(str, enum.Enum):
    single_choice = "single_choice"
    multiple_choice = "multiple_choice"
    scale = "scale"


class User(Base):
    """جدول المستخدمين — الواجهة 1 (Login) و 2 (Register) و 10 (Profile)."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    # Batch 4.2 — مشاركة اختيارية (Opt-in) ببيانات Career Score ضمن متوسط الأقران المجهول
    benchmark_opt_in = Column(Boolean, default=False, nullable=False)
    # Batch 5.6 — تفعيل/تعطيل التنبيهات البريدية الأسبوعية بحالة تقدّم الـ Roadmap (افتراضياً
    # مُفعَّلة، بما يطابق حالة المفتاح الافتراضية في واجهة Settings.jsx الحالية).
    # ملاحظة هندسية: كما هو الحال مع benchmark_opt_in أعلاه، هذا المشروع لا يستخدم أداة
    # Migrations (مثل Alembic) — الجداول تُنشأ عبر Base.metadata.create_all فقط، والتي لا
    # تُضيف أعمدة جديدة لجدول موجود مسبقاً في MySQL بيئة إنتاج قائمة فعلياً. لذلك: أي قاعدة
    # بيانات MySQL منشأة قبل هذه الدفعة تحتاج تشغيل يدوي لمرة واحدة:
    #   ALTER TABLE users ADD COLUMN notifications_opt_in BOOLEAN NOT NULL DEFAULT TRUE;
    # (بيئة SQLite/الاختبار غير متأثرة لأنها تُنشأ من الصفر في كل مرة).
    notifications_opt_in = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Skill(Base):
    """جدول المهارات المرجعي — يُستخدم في Job_Skills وفي مطابقة استخراج الـ CV."""

    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, index=True, nullable=False)
    category = Column(String(100), nullable=False, default="General")
    # مثال على الفئات: Frontend, Backend, Data, DevOps, Security, Design, Mobile, Soft Skills

    job_links = relationship("JobSkill", back_populates="skill", cascade="all, delete-orphan")


class Job(Base):
    """جدول الوظائف الثلاثين المرجعية — القسم 7."""

    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), unique=True, index=True, nullable=False)
    field = Column(String(150), nullable=False)  # المجال (Development, AI & Data, ...)
    description = Column(Text, nullable=True)

    skills = relationship("JobSkill", back_populates="job", cascade="all, delete-orphan")


class JobSkill(Base):
    """جدول العلاقة Job_Skills — أهم جدول في محرك التوصية (القسم 7.1)."""

    __tablename__ = "job_skills"
    __table_args__ = (UniqueConstraint("job_id", "skill_id", name="uq_job_skill"),)

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    importance_level = Column(Enum(ImportanceLevel), nullable=False)

    job = relationship("Job", back_populates="skills")
    skill = relationship("Skill", back_populates="job_links")


class Question(Base):
    """جدول الأسئلة التقييمية — الواجهة 6 (Assessment Questions)."""

    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    type = Column(Enum(QuestionType), nullable=False)
    required = Column(Boolean, default=True, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    # وزن اختياري يُستخدم في assessment_bonus لدرجة إتقان المهارة المرتبطة (إن وُجدت)
    related_skill_id = Column(Integer, ForeignKey("skills.id"), nullable=True)
    # يُستخدم فقط لأسئلة النوع scale التي تغذّي محاور Career DNA غير التقنية مباشرة
    # (القيم الممكنة: "communication" أو "problem_solving")
    dna_axis = Column(String(50), nullable=True)

    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan")
    related_skill = relationship("Skill")


class QuestionOption(Base):
    """خيارات كل سؤال (لأسئلة single_choice و multiple_choice)."""

    __tablename__ = "question_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    text = Column(String(255), nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    # نقاط اختيارية تُضاف إلى assessment_bonus عند اختيار هذا الخيار
    bonus_points = Column(Integer, default=0, nullable=False)

    question = relationship("Question", back_populates="options")


class Course(Base):
    """جدول الكورسات المقترحة — يُستخدم في matchCoursesToSkills (القسم 6.5)."""

    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    platform = Column(String(150), nullable=False)
    url = Column(String(500), nullable=False)
    covers_skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)

    skill = relationship("Skill")
