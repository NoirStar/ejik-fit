"""Add multilingual PostgreSQL search when PGroonga is available.

Revision ID: 20260703_0002
Revises: 20260703_0001
Create Date: 2026-07-03
"""

from collections.abc import Sequence

from alembic import context, op


revision: str = "20260703_0002"
down_revision: str | None = "20260703_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


OFFLINE_PGROONGA_SQL = """
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_available_extensions
        WHERE name = 'pgroonga'
    ) THEN
        EXECUTE 'CREATE EXTENSION IF NOT EXISTS pgroonga';
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_job_postings_pgroonga '
                'ON job_postings USING pgroonga '
                '(title, description_text, location)';
    END IF;
END
$$
"""


def upgrade() -> None:
    if context.is_offline_mode():
        op.execute(OFFLINE_PGROONGA_SQL)
        return

    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    available = bind.exec_driver_sql(
        "SELECT EXISTS ("
        "SELECT 1 FROM pg_available_extensions WHERE name = 'pgroonga'"
        ")"
    ).scalar()
    if not available:
        return

    op.execute("CREATE EXTENSION IF NOT EXISTS pgroonga")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_job_postings_pgroonga "
        "ON job_postings USING pgroonga "
        "(title, description_text, location)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_job_postings_pgroonga")
