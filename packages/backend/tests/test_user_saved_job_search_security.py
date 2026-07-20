from pathlib import Path


MIGRATION = (
    Path(__file__).parents[1]
    / "alembic"
    / "versions"
    / "20260720_0017_user_saved_job_searches.py"
)


def test_saved_job_search_migration_is_private_and_bounded() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert 'down_revision: str | None = "20260715_0016"' in sql
    assert '"user_saved_job_searches"' in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "REFERENCES auth.users(id)" in sql
    assert "ON DELETE CASCADE" in sql
    assert "TO authenticated" in sql
    assert "auth.uid() = user_id" in sql
    assert "WITH CHECK" in sql
    assert "uq_user_saved_job_search_filter" in sql
    assert "ck_user_saved_job_search_has_filter" in sql
    assert "ck_user_saved_job_search_category" in sql
    assert "ck_user_saved_job_search_career_type" in sql
