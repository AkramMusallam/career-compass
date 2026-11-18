"""Add email_verified and token_version columns to users table

Revision ID: 0004_security_remediation_columns
Revises: 0003_user_target_role
Create Date: 2026-11-18 12:20:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_security_remediation_columns"
down_revision: Union[str, None] = "0003_user_target_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
    op.drop_column("users", "email_verified")
