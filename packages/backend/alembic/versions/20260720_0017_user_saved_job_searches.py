"""Add private saved job searches.

Revision ID: 20260720_0017
Revises: 20260715_0016
Create Date: 2026-07-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260720_0017"
down_revision: str | None = "20260715_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgresql() -> bool:
    return op.get_context().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        "user_saved_job_searches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column(
            "query_text",
            sa.String(length=200),
            server_default=sa.text("''"),
            nullable=False,
        ),
        sa.Column(
            "query_key",
            sa.String(length=200),
            server_default=sa.text("''"),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.String(length=32),
            server_default=sa.text("''"),
            nullable=False,
        ),
        sa.Column(
            "career_type",
            sa.String(length=32),
            server_default=sa.text("''"),
            nullable=False,
        ),
        sa.Column(
            "is_enabled",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=False),
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
            "query_key <> '' OR category <> '' OR career_type <> ''",
            name="ck_user_saved_job_search_has_filter",
        ),
        sa.CheckConstraint(
            "category IN ('', 'language', 'frontend', 'backend', 'infra', "
            "'data', 'ai', 'security', 'game', 'robotics', 'mobile', "
            "'design', 'embedded', 'qa')",
            name="ck_user_saved_job_search_category",
        ),
        sa.CheckConstraint(
            "career_type IN ('', 'new_comer', 'experienced', 'mixed')",
            name="ck_user_saved_job_search_career_type",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "query_key",
            "category",
            "career_type",
            name="uq_user_saved_job_search_filter",
        ),
    )
    op.create_index(
        "ix_user_saved_job_searches_user_id",
        "user_saved_job_searches",
        ["user_id"],
    )
    if not _is_postgresql():
        return

    op.execute(
        "ALTER TABLE user_saved_job_searches ENABLE ROW LEVEL SECURITY"
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF to_regclass('auth.users') IS NOT NULL THEN
            ALTER TABLE user_saved_job_searches
              ADD CONSTRAINT fk_user_saved_job_searches_auth_user
              FOREIGN KEY (user_id) REFERENCES auth.users(id)
              ON DELETE CASCADE;
          END IF;

          IF EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
          ) AND to_regprocedure('auth.uid()') IS NOT NULL THEN
            GRANT SELECT, INSERT, UPDATE, DELETE
              ON user_saved_job_searches TO authenticated;
            CREATE POLICY user_saved_job_searches_owner
              ON user_saved_job_searches
              FOR ALL TO authenticated
              USING (auth.uid() = user_id)
              WITH CHECK (auth.uid() = user_id);
          END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_saved_job_searches_user_id",
        table_name="user_saved_job_searches",
    )
    op.drop_table("user_saved_job_searches")
