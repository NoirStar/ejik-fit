"""Add official source connector enum values.

Revision ID: 20260709_0005
Revises: 20260706_0004
Create Date: 2026-07-09
"""

from collections.abc import Sequence

from alembic import context, op


revision: str = "20260709_0005"
down_revision: str | None = "20260706_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SOURCE_TYPE_VALUES = ("NAVER_JSON", "KAKAO_JSON", "LINE_GATSBY")


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
    raise RuntimeError(
        "20260709_0005 is intentionally irreversible: PostgreSQL enum values "
        "and rows using them require an explicit forward data migration"
    )
