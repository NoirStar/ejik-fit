from pathlib import Path


MIGRATION = (
    Path(__file__).parents[1]
    / "alembic"
    / "versions"
    / "20260715_0013_user_career_states.py"
)
FOLLOWED_COMPANIES_MIGRATION = (
    Path(__file__).parents[1]
    / "alembic"
    / "versions"
    / "20260715_0016_followed_companies.py"
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


def test_followed_companies_migration_bounds_private_account_payload() -> None:
    sql = FOLLOWED_COMPANIES_MIGRATION.read_text(encoding="utf-8")

    assert "down_revision: str | None = \"20260715_0015\"" in sql
    assert "followed_company_slugs" in sql
    assert "jsonb_typeof(followed_company_slugs) = 'array'" in sql
    assert "jsonb_array_length(followed_company_slugs) <= 60" in sql
    assert "octet_length(followed_company_slugs::text) <= 8192" in sql
    assert "nullable=False" in sql
