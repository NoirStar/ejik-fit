from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "20260720_0019_account_controls.py"
)


def test_account_controls_migration_scopes_deletion_to_authenticated_user() -> None:
    sql = MIGRATION.read_text()

    assert '"job_notifications_enabled"' in sql
    assert "SECURITY DEFINER" in sql
    assert "SET search_path = ''" in sql
    assert "requester := auth.uid()" in sql
    assert "DELETE FROM auth.users WHERE id = requester" in sql
    assert "REVOKE ALL" in sql
    assert "GRANT EXECUTE" in sql
    assert "service_role" not in sql
