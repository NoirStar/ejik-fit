"""Add request options to career sources.

Revision ID: 20260710_0012
Revises: 20260709_0011
Create Date: 2026-07-10
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260710_0012"
down_revision: str | None = "20260709_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "career_sources",
        sa.Column(
            "request_method",
            sa.String(length=12),
            server_default="GET",
            nullable=False,
        ),
    )
    op.add_column(
        "career_sources",
        sa.Column("request_body", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("career_sources", "request_body")
    op.drop_column("career_sources", "request_method")
