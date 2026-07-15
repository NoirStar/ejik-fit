"""Add private user career state storage.

Revision ID: 20260715_0013
Revises: 20260710_0012
Create Date: 2026-07-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260715_0013"
down_revision: str | None = "20260710_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_career_states",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "owned_skills",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "career_preferences",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "saved_job_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "application_stages",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "jsonb_typeof(owned_skills) = 'array' AND "
            "jsonb_array_length(owned_skills) <= 100",
            name="ck_user_career_states_owned_skills",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(career_preferences) = 'object'",
            name="ck_user_career_states_preferences",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(saved_job_ids) = 'array' AND "
            "jsonb_array_length(saved_job_ids) <= 24",
            name="ck_user_career_states_saved_jobs",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(application_stages) = 'object'",
            name="ck_user_career_states_application_stages",
        ),
        sa.CheckConstraint(
            "octet_length(owned_skills::text) <= 32768 AND "
            "octet_length(career_preferences::text) <= 4096 AND "
            "octet_length(saved_job_ids::text) <= 8192 AND "
            "octet_length(application_stages::text) <= 8192",
            name="ck_user_career_states_payload_size",
        ),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.execute("ALTER TABLE user_career_states ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        DO $$
        BEGIN
          IF to_regclass('auth.users') IS NOT NULL THEN
            ALTER TABLE user_career_states
              ADD CONSTRAINT fk_user_career_states_auth_user
              FOREIGN KEY (user_id) REFERENCES auth.users(id)
              ON DELETE CASCADE;
          END IF;

          IF EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
          ) AND to_regprocedure('auth.uid()') IS NOT NULL THEN
            GRANT SELECT, INSERT, UPDATE, DELETE
              ON user_career_states TO authenticated;
            CREATE POLICY user_career_states_owner
              ON user_career_states
              FOR ALL TO authenticated
              USING (auth.uid() = user_id)
              WITH CHECK (auth.uid() = user_id);
          END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.drop_table("user_career_states")
