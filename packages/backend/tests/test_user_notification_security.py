from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "20260720_0018_user_notifications.py"
)


def test_user_notification_migration_is_server_written_and_owner_readable() -> None:
    sql = MIGRATION.read_text()

    assert '"user_notifications"' in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "fk_user_notifications_auth_user" in sql
    assert "ON DELETE CASCADE" in sql
    assert "user_notifications_owner_select" in sql
    assert "user_notifications_owner_update" in sql
    assert "user_notifications_owner_delete" in sql
    assert "GRANT SELECT, DELETE" in sql
    assert "GRANT UPDATE (read_at)" in sql
    assert "GRANT INSERT" not in sql
    assert "uq_user_notification_dedupe" in sql
    assert "ck_user_notifications_internal_href" in sql

