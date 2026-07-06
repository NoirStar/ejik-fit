from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def test_offline_migration_includes_conditional_pgroonga_index() -> None:
    output = StringIO()
    config = Config(
        str(BACKEND_ROOT / "alembic.ini"),
        output_buffer=output,
    )

    command.upgrade(config, "head", sql=True)

    sql = output.getvalue()
    assert "pg_available_extensions" in sql
    assert "ix_job_postings_pgroonga" in sql
    assert "requirement_type" in sql
    assert "evidence_text" in sql
    assert "confidence" in sql
    assert "match_reason" in sql
