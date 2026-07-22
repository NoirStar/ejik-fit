import importlib.util
from pathlib import Path
from types import ModuleType
from unittest.mock import Mock


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "20260723_0024_community_following_feed.py"
)


def load_migration() -> ModuleType:
    assert MIGRATION.exists(), "community following feed migration is missing"
    spec = importlib.util.spec_from_file_location(
        "community_following_feed_migration", MIGRATION
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def emitted_sql(monkeypatch) -> tuple[str, str]:
    module = load_migration()
    execute = Mock()
    monkeypatch.setattr(module, "_is_postgresql", lambda: True)
    monkeypatch.setattr(module.op, "execute", execute)

    module.upgrade()
    upgrade_sql = "\n".join(str(call.args[0]) for call in execute.call_args_list)
    execute.reset_mock()
    module.downgrade()
    downgrade_sql = "\n".join(str(call.args[0]) for call in execute.call_args_list)
    return upgrade_sql, downgrade_sql


def test_following_feed_is_invoker_scoped_to_the_authenticated_user(monkeypatch) -> None:
    upgrade_sql, _ = emitted_sql(monkeypatch)
    normalized = " ".join(upgrade_sql.split())

    assert "CREATE OR REPLACE FUNCTION public.list_community_following_posts" in normalized
    assert "SECURITY INVOKER" in normalized
    assert "SECURITY DEFINER" not in normalized
    assert "SET search_path = ''" in normalized
    assert "f.follower_id = auth.uid()" in normalized
    assert "f.followed_id = p.author_id" in normalized
    assert "auth.users" not in normalized
    assert "email" not in normalized
    assert "client_origin_id" not in normalized
    assert "TO authenticated" in normalized
    assert "TO anon" not in normalized


def test_following_feed_has_stable_cursor_and_bounded_page(monkeypatch) -> None:
    upgrade_sql, downgrade_sql = emitted_sql(monkeypatch)
    normalized = " ".join(upgrade_sql.split())

    assert "(p.created_at, p.id) < (before_created_at, before_id)" in normalized
    assert "ORDER BY p.created_at DESC, p.id DESC" in normalized
    assert "LEAST(GREATEST(COALESCE(result_limit, 20), 1), 51)" in normalized
    assert "author_nickname" in normalized
    assert "DROP FUNCTION IF EXISTS public.list_community_following_posts" in downgrade_sql


def test_saved_feed_is_complete_auth_scoped_and_cursor_paginated(monkeypatch) -> None:
    upgrade_sql, downgrade_sql = emitted_sql(monkeypatch)
    normalized = " ".join(upgrade_sql.split())

    assert "CREATE OR REPLACE FUNCTION public.list_community_saved_posts" in normalized
    assert "s.user_id = auth.uid()" in normalized
    assert "(s.created_at, p.id) < (before_created_at, before_id)" in normalized
    assert "ORDER BY s.created_at DESC, p.id DESC" in normalized
    assert "s.created_at AS membership_created_at" in normalized
    assert "DROP FUNCTION IF EXISTS public.list_community_saved_posts" in downgrade_sql


def test_non_postgresql_upgrade_and_downgrade_are_noops(monkeypatch) -> None:
    module = load_migration()
    execute = Mock()
    monkeypatch.setattr(module, "_is_postgresql", lambda: False)
    monkeypatch.setattr(module.op, "execute", execute)

    module.upgrade()
    module.downgrade()

    execute.assert_not_called()
