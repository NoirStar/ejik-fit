"""Add public JSON detail source type.

Revision ID: 20260715_0014
Revises: 20260715_0013
Create Date: 2026-07-15
"""

from collections.abc import Sequence

from alembic import context, op


revision: str = "20260715_0014"
down_revision: str | None = "20260715_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_source_type_value() -> None:
    op.execute(
        "ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'PUBLIC_JSON_DETAIL'"
    )


def upgrade() -> None:
    if context.is_offline_mode():
        _add_source_type_value()
        return

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        _add_source_type_value()


def downgrade() -> None:
    raise RuntimeError(
        "20260715_0014 is intentionally irreversible: PostgreSQL enum values "
        "require an explicit forward data migration"
    )
