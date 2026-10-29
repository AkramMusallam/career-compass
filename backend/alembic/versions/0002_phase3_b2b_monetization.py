"""Phase 3: Add role, subscription_tier, and company_name to users table

Revision ID: 0002_phase3_b2b_monetization
Revises: 0001_initial_schema
Create Date: 2026-10-29 18:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_phase3_b2b_monetization"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=50), nullable=False, server_default="candidate"))
    op.add_column("users", sa.Column("subscription_tier", sa.String(length=50), nullable=False, server_default="free"))
    op.add_column("users", sa.Column("company_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "company_name")
    op.drop_column("users", "subscription_tier")
    op.drop_column("users", "role")
