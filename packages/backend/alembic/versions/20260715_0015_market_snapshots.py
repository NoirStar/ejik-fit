"""Add real market demand snapshots.

Revision ID: 20260715_0015
Revises: 20260715_0014
Create Date: 2026-07-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260715_0015"
down_revision: str | None = "20260715_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "market_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("observed_on", sa.Date(), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open_postings", sa.Integer(), nullable=False),
        sa.Column("verified_sources", sa.Integer(), nullable=False),
        sa.Column("total_sources", sa.Integer(), nullable=False),
        sa.Column("skill_count", sa.Integer(), nullable=False),
        sa.CheckConstraint("open_postings >= 0", name="ck_market_open_postings"),
        sa.CheckConstraint(
            "verified_sources >= 0 AND verified_sources <= total_sources",
            name="ck_market_verified_sources",
        ),
        sa.CheckConstraint("skill_count >= 0", name="ck_market_skill_count"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_market_snapshots_observed_on",
        "market_snapshots",
        ["observed_on"],
        unique=True,
    )
    op.create_table(
        "skill_demand_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("market_snapshot_id", sa.Uuid(), nullable=False),
        sa.Column("skill", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("posting_count", sa.Integer(), nullable=False),
        sa.Column("required_count", sa.Integer(), nullable=False),
        sa.Column("preferred_count", sa.Integer(), nullable=False),
        sa.Column("unspecified_count", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "posting_count >= 0 AND required_count >= 0 AND "
            "preferred_count >= 0 AND unspecified_count >= 0",
            name="ck_skill_demand_non_negative",
        ),
        sa.CheckConstraint(
            "required_count + preferred_count + unspecified_count = "
            "posting_count",
            name="ck_skill_demand_composition",
        ),
        sa.ForeignKeyConstraint(
            ["market_snapshot_id"],
            ["market_snapshots.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "market_snapshot_id",
            "skill",
            name="uq_skill_demand_snapshot_skill",
        ),
    )
    op.create_index(
        "ix_skill_demand_snapshots_market_snapshot_id",
        "skill_demand_snapshots",
        ["market_snapshot_id"],
    )
    op.create_index(
        "ix_skill_demand_snapshots_skill",
        "skill_demand_snapshots",
        ["skill"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_skill_demand_snapshots_skill",
        table_name="skill_demand_snapshots",
    )
    op.drop_index(
        "ix_skill_demand_snapshots_market_snapshot_id",
        table_name="skill_demand_snapshots",
    )
    op.drop_table("skill_demand_snapshots")
    op.drop_index(
        "ix_market_snapshots_observed_on",
        table_name="market_snapshots",
    )
    op.drop_table("market_snapshots")
