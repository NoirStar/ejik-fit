"""Add followed companies to private user career state.

Revision ID: 20260715_0016
Revises: 20260715_0015
Create Date: 2026-07-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260715_0016"
down_revision: str | None = "20260715_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgresql() -> bool:
    return op.get_context().dialect.name == "postgresql"


def upgrade() -> None:
    if _is_postgresql():
        column_type = postgresql.JSONB(astext_type=sa.Text())
        server_default = sa.text("'[]'::jsonb")
    else:
        column_type = sa.JSON()
        server_default = sa.text("'[]'")
    op.add_column(
        "user_career_states",
        sa.Column(
            "followed_company_slugs",
            column_type,
            server_default=server_default,
            nullable=False,
        ),
    )
    if not _is_postgresql():
        return

    op.create_check_constraint(
        "ck_user_career_states_followed_companies",
        "user_career_states",
        "jsonb_typeof(followed_company_slugs) = 'array' AND "
        "jsonb_array_length(followed_company_slugs) <= 60 AND "
        "octet_length(followed_company_slugs::text) <= 8192",
    )


def downgrade() -> None:
    if _is_postgresql():
        op.drop_constraint(
            "ck_user_career_states_followed_companies",
            "user_career_states",
            type_="check",
        )
    op.drop_column("user_career_states", "followed_company_slugs")
