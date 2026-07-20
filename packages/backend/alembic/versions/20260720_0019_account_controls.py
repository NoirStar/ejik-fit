"""Add account notification preference and self-service deletion.

Revision ID: 20260720_0019
Revises: 20260720_0018
Create Date: 2026-07-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260720_0019"
down_revision: str | None = "20260720_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgresql() -> bool:
    return op.get_context().dialect.name == "postgresql"


def upgrade() -> None:
    op.add_column(
        "user_career_states",
        sa.Column(
            "job_notifications_enabled",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
    )
    if not _is_postgresql():
        return

    op.execute(
        """
        DO $account_controls$
        BEGIN
          IF to_regclass('auth.users') IS NOT NULL
             AND to_regprocedure('auth.uid()') IS NOT NULL THEN
            EXECUTE $function$
              CREATE OR REPLACE FUNCTION public.delete_current_user()
              RETURNS void
              LANGUAGE plpgsql
              SECURITY DEFINER
              SET search_path = ''
              AS $body$
              DECLARE
                requester uuid;
              BEGIN
                requester := auth.uid();
                IF requester IS NULL THEN
                  RAISE EXCEPTION 'Authentication required'
                    USING ERRCODE = '42501';
                END IF;

                DELETE FROM auth.users WHERE id = requester;
                IF NOT FOUND THEN
                  RAISE EXCEPTION 'Account not found'
                    USING ERRCODE = 'P0002';
                END IF;
              END;
              $body$
            $function$;

            REVOKE ALL
              ON FUNCTION public.delete_current_user() FROM PUBLIC;
            IF EXISTS (
              SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
            ) THEN
              GRANT EXECUTE
                ON FUNCTION public.delete_current_user() TO authenticated;
            END IF;
          END IF;
        END
        $account_controls$;
        """
    )


def downgrade() -> None:
    if _is_postgresql():
        op.execute(
            "DROP FUNCTION IF EXISTS public.delete_current_user()"
        )
    op.drop_column(
        "user_career_states",
        "job_notifications_enabled",
    )
