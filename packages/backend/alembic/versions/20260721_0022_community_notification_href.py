"""Use the canonical route for community follow notifications.

Revision ID: 20260721_0022
Revises: 20260721_0021
Create Date: 2026-07-21
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260721_0022"
down_revision: str | None = "20260721_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _replace_function_route(source: str, target: str) -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    op.execute(
        f"""
        DO $route_fix$
        DECLARE
          definition text;
        BEGIN
          SELECT pg_get_functiondef(
            'public.community_create_notification()'::regprocedure
          ) INTO definition;
          IF position('{source}' IN definition) = 0 THEN
            RAISE EXCEPTION 'community notification route % was not found', '{source}';
          END IF;
          definition := replace(definition, '{source}', '{target}');
          EXECUTE definition;
        END;
        $route_fix$;
        """
    )


def upgrade() -> None:
    _replace_function_route("/career/my-posts", "/career/questions")


def downgrade() -> None:
    _replace_function_route("/career/questions", "/career/my-posts")
