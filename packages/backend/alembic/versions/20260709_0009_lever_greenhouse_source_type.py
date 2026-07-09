"""Add Lever and Greenhouse source type.

Revision ID: 20260709_0009
Revises: 20260709_0008
Create Date: 2026-07-09
"""

from collections.abc import Sequence

from alembic import context, op


revision: str = "20260709_0009"
down_revision: str | None = "20260709_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SOURCE_TYPE_VALUES = ("LEVER_GREENHOUSE",)


def _add_source_type_values() -> None:
    for value in SOURCE_TYPE_VALUES:
        op.execute(f"ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS '{value}'")


def upgrade() -> None:
    if context.is_offline_mode():
        _add_source_type_values()
        return

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        _add_source_type_values()


def downgrade() -> None:
    pass
