"""Add requirement type and evidence to extracted posting skills.

Revision ID: 20260706_0004
Revises: 20260704_0003
Create Date: 2026-07-06
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260706_0004"
down_revision: str | None = "20260704_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "posting_skills",
        sa.Column(
            "requirement_type",
            sa.String(length=20),
            server_default="unspecified",
            nullable=False,
        ),
    )
    op.add_column(
        "posting_skills",
        sa.Column("evidence_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "posting_skills",
        sa.Column(
            "confidence",
            sa.Float(),
            server_default=sa.text("0.5"),
            nullable=False,
        ),
    )
    op.add_column(
        "posting_skills",
        sa.Column(
            "match_reason",
            sa.String(length=100),
            server_default="legacy_backfill",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("posting_skills", "match_reason")
    op.drop_column("posting_skills", "confidence")
    op.drop_column("posting_skills", "evidence_text")
    op.drop_column("posting_skills", "requirement_type")
