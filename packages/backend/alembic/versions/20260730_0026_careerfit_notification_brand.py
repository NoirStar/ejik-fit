"""Use the CareerFit brand in community notification fallbacks.

Revision ID: 20260730_0026
Revises: 20260727_0025
Create Date: 2026-07-30
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260730_0026"
down_revision: str | None = "20260727_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _replace_notification_brand(source: str, target: str) -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    op.execute(
        f"""
        DO $brand_fix$
        DECLARE
          definition text;
        BEGIN
          SELECT pg_get_functiondef(
            'public.community_create_notification()'::regprocedure
          ) INTO definition;

          IF position('{source}' IN definition) > 0 THEN
            definition := replace(definition, '{source}', '{target}');
            EXECUTE definition;
          ELSIF position('{target}' IN definition) = 0 THEN
            RAISE EXCEPTION
              'community notification brand % was not found', '{source}';
          END IF;
        END;
        $brand_fix$;
        """
    )


def upgrade() -> None:
    _replace_notification_brand("이직핏 사용자", "커리어핏 사용자")


def downgrade() -> None:
    _replace_notification_brand("커리어핏 사용자", "이직핏 사용자")
