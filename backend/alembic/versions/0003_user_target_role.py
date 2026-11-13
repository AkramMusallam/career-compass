"""Add target_role column to users table

Revision ID: 0003_user_target_role
Revises: 0002_phase3_b2b_monetization
Create Date: 2026-11-13 15:20:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_user_target_role"
down_revision: Union[str, None] = "0002_phase3_b2b_monetization"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("target_role", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "target_role")
