"""Add private server-written user notifications.

Revision ID: 20260720_0018
Revises: 20260720_0017
Create Date: 2026-07-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260720_0018"
down_revision: str | None = "20260720_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgresql() -> bool:
    return op.get_context().dialect.name == "postgresql"


def upgrade() -> None:
    op.add_column(
        "user_career_states",
        sa.Column(
            "company_notifications_checked_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_table(
        "user_notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            sa.String(length=32),
            server_default=sa.text("'job'"),
            nullable=False,
        ),
        sa.Column("dedupe_key", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("body", sa.String(length=500), nullable=False),
        sa.Column("href", sa.String(length=500), nullable=False),
        sa.Column(
            "metadata",
            sa.JSON(),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ('job')",
            name="ck_user_notifications_kind",
        ),
        sa.CheckConstraint(
            "href LIKE '/%' AND href NOT LIKE '//%'",
            name="ck_user_notifications_internal_href",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "dedupe_key",
            name="uq_user_notification_dedupe",
        ),
    )
    op.create_index(
        "ix_user_notifications_user_id",
        "user_notifications",
        ["user_id"],
    )
    op.create_index(
        "ix_user_notifications_user_created",
        "user_notifications",
        ["user_id", "created_at"],
    )
    if not _is_postgresql():
        return

    op.execute("ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        DO $$
        BEGIN
          IF to_regclass('auth.users') IS NOT NULL THEN
            ALTER TABLE user_notifications
              ADD CONSTRAINT fk_user_notifications_auth_user
              FOREIGN KEY (user_id) REFERENCES auth.users(id)
              ON DELETE CASCADE;
          END IF;

          IF EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
          ) AND to_regprocedure('auth.uid()') IS NOT NULL THEN
            GRANT SELECT, DELETE
              ON user_notifications TO authenticated;
            GRANT UPDATE (read_at)
              ON user_notifications TO authenticated;

            CREATE POLICY user_notifications_owner_select
              ON user_notifications
              FOR SELECT TO authenticated
              USING (auth.uid() = user_id);
            CREATE POLICY user_notifications_owner_update
              ON user_notifications
              FOR UPDATE TO authenticated
              USING (auth.uid() = user_id)
              WITH CHECK (auth.uid() = user_id);
            CREATE POLICY user_notifications_owner_delete
              ON user_notifications
              FOR DELETE TO authenticated
              USING (auth.uid() = user_id);
          END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_notifications_user_created",
        table_name="user_notifications",
    )
    op.drop_index(
        "ix_user_notifications_user_id",
        table_name="user_notifications",
    )
    op.drop_table("user_notifications")
    op.drop_column(
        "user_career_states",
        "company_notifications_checked_at",
    )
