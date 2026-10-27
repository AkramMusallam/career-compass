"""Initial Career Compass relational schema (Users, Skills, Jobs, JobSkills, Questions, QuestionOptions, Courses)

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-27 07:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("benchmark_opt_in", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("notifications_opt_in", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "skills",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False, server_default="General"),
    )
    op.create_index(op.f("ix_skills_id"), "skills", ["id"], unique=False)
    op.create_index(op.f("ix_skills_name"), "skills", ["name"], unique=True)

    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("field", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index(op.f("ix_jobs_id"), "jobs", ["id"], unique=False)
    op.create_index(op.f("ix_jobs_title"), "jobs", ["title"], unique=True)

    op.create_table(
        "job_skills",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("skill_id", sa.Integer(), sa.ForeignKey("skills.id"), nullable=False),
        sa.Column(
            "importance_level",
            sa.Enum("essential", "important", "bonus", name="importancelevel"),
            nullable=False,
        ),
        sa.UniqueConstraint("job_id", "skill_id", name="uq_job_skill"),
    )
    op.create_index(op.f("ix_job_skills_id"), "job_skills", ["id"], unique=False)

    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "type",
            sa.Enum("single_choice", "multiple_choice", "scale", name="questiontype"),
            nullable=False,
        ),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("related_skill_id", sa.Integer(), sa.ForeignKey("skills.id"), nullable=True),
        sa.Column("dna_axis", sa.String(length=50), nullable=True),
    )
    op.create_index(op.f("ix_questions_id"), "questions", ["id"], unique=False)

    op.create_table(
        "question_options",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id"), nullable=False),
        sa.Column("text", sa.String(length=255), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("bonus_points", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(op.f("ix_question_options_id"), "question_options", ["id"], unique=False)

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("platform", sa.String(length=150), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("covers_skill_id", sa.Integer(), sa.ForeignKey("skills.id"), nullable=False),
    )
    op.create_index(op.f("ix_courses_id"), "courses", ["id"], unique=False)


def downgrade() -> None:
    op.drop_table("courses")
    op.drop_table("question_options")
    op.drop_table("questions")
    op.drop_table("job_skills")
    op.drop_table("jobs")
    op.drop_table("skills")
    op.drop_table("users")
