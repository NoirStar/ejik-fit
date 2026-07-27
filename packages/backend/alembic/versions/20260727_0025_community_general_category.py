"""Allow general community posts.

Revision ID: 20260727_0025
Revises: 20260723_0024
Create Date: 2026-07-27
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260727_0025"
down_revision: str | None = "20260723_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CURRENT_CATEGORIES = "'일반', '커리어 질문', '커리어 고민', '면접 후기'"
PREVIOUS_CATEGORIES = "'커리어 질문', '커리어 고민', '면접 후기'"


def _is_postgresql() -> bool:
    return op.get_context().dialect.name == "postgresql"


def _replace_category_constraint(categories: str) -> None:
    if _is_postgresql():
        op.drop_constraint(
            "ck_community_posts_category",
            "community_posts",
            type_="check",
        )
        op.create_check_constraint(
            "ck_community_posts_category",
            "community_posts",
            f"category IN ({categories})",
        )
        return

    with op.batch_alter_table("community_posts") as batch_op:
        batch_op.drop_constraint(
            "ck_community_posts_category",
            type_="check",
        )
        batch_op.create_check_constraint(
            "ck_community_posts_category",
            f"category IN ({categories})",
        )


def upgrade() -> None:
    _replace_category_constraint(CURRENT_CATEGORIES)


def downgrade() -> None:
    op.execute(
        "UPDATE community_posts "
        "SET category = '커리어 질문' "
        "WHERE category = '일반'"
    )
    _replace_category_constraint(PREVIOUS_CATEGORIES)
