from pathlib import Path


MIGRATION = (
    Path(__file__).parents[1]
    / "alembic"
    / "versions"
    / "20260715_0013_user_career_states.py"
)


def test_user_career_state_migration_enforces_owner_rls() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "TO authenticated" in sql
    assert "auth.uid() = user_id" in sql
    assert "WITH CHECK" in sql
    assert "rolname = 'authenticated'" in sql
    assert "REFERENCES auth.users(id)" in sql
    assert "ON DELETE CASCADE" in sql
