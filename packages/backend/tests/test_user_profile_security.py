from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "20260721_0020_user_profiles.py"
)


def test_user_profile_migration_exposes_only_public_name_and_owner_updates() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert '"user_profiles"' in sql
    assert "REFERENCES auth.users(id)" in sql
    assert "ON DELETE CASCADE" in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "FOR SELECT" in sql
    assert "TO anon, authenticated" in sql
    assert "FOR UPDATE TO authenticated" in sql
    assert "auth.uid() = user_id" in sql
    assert "SECURITY DEFINER" in sql
    assert "SET search_path = ''" in sql
    assert "raw_user_meta_data" in sql
    assert "INSERT INTO public.user_profiles" in sql
    assert "GRANT INSERT" not in sql
    assert "GRANT DELETE" not in sql
    assert "email" not in sql.lower()
