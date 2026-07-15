"""Add operational registry fields to career sources.

Revision ID: 20260709_0006
Revises: 20260709_0005
Create Date: 2026-07-09
"""

from collections.abc import Sequence

from alembic import context, op
import sqlalchemy as sa


revision: str = "20260709_0006"
down_revision: str | None = "20260709_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SOURCE_STATUS_VALUES = ("NEEDS_CONNECTOR", "NEEDS_BROWSER", "BLOCKED")
POLICY_STATUS_ENUM = sa.Enum(
    "ALLOWED",
    "REVIEW",
    "BLOCKED",
    "STOPPED",
    name="policystatus",
)


def _add_source_status_values() -> None:
    for value in SOURCE_STATUS_VALUES:
        op.execute(f"ALTER TYPE sourcestatus ADD VALUE IF NOT EXISTS '{value}'")


def _create_policy_status_type() -> None:
    if context.is_offline_mode():
        op.execute(
            "CREATE TYPE policystatus AS ENUM "
            "('ALLOWED', 'REVIEW', 'BLOCKED', 'STOPPED')"
        )
        return

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        POLICY_STATUS_ENUM.create(bind, checkfirst=True)


def upgrade() -> None:
    if context.is_offline_mode():
        _add_source_status_values()
        _create_policy_status_type()
    else:
        bind = op.get_bind()
        if bind.dialect.name == "postgresql":
            _add_source_status_values()
            _create_policy_status_type()

    op.add_column(
        "career_sources",
        sa.Column(
            "policy_status",
            POLICY_STATUS_ENUM,
            server_default="REVIEW",
            nullable=False,
        ),
    )
    op.add_column(
        "career_sources",
        sa.Column(
            "connector_family",
            sa.String(length=80),
            server_default="",
            nullable=False,
        ),
    )
    op.add_column(
        "career_sources",
        sa.Column("sector", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "career_sources",
        sa.Column(
            "brand_tier_weight",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "career_sources",
        sa.Column(
            "tech_job_priority",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "career_sources",
        sa.Column(
            "expected_job_volume",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "career_sources",
        sa.Column(
            "connector_reuse_score",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "career_sources",
        sa.Column(
            "policy_risk",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "career_sources",
        sa.Column(
            "non_tech_noise",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "career_sources",
        sa.Column("last_discovered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "career_sources",
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "career_sources",
        sa.Column("last_error_code", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "career_sources",
        sa.Column("last_error_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "career_sources",
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    raise RuntimeError(
        "20260709_0006 is intentionally irreversible: source status enum "
        "values and operational policy data need an explicit forward migration"
    )
