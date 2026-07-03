"""Add extracted skills per job posting.

Revision ID: 20260704_0003
Revises: 20260703_0002
Create Date: 2026-07-04
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260704_0003"
down_revision: str | None = "20260703_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "posting_skills",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("posting_id", sa.Uuid(), nullable=False),
        sa.Column("skill", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["posting_id"], ["job_postings.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("posting_id", "skill", name="uq_posting_skill"),
    )
    op.create_index(
        "ix_posting_skills_posting_id", "posting_skills", ["posting_id"]
    )
    op.create_index("ix_posting_skills_skill", "posting_skills", ["skill"])


def downgrade() -> None:
    op.drop_index("ix_posting_skills_skill", table_name="posting_skills")
    op.drop_index("ix_posting_skills_posting_id", table_name="posting_skills")
    op.drop_table("posting_skills")
