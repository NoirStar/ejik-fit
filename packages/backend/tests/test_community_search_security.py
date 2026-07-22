import importlib.util
from pathlib import Path
from types import ModuleType
from unittest.mock import Mock


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "20260723_0023_community_search.py"
)


def load_migration() -> ModuleType:
    assert MIGRATION.exists(), "community search migration is missing"
    spec = importlib.util.spec_from_file_location("community_search_migration", MIGRATION)
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


def test_search_function_is_invoker_scoped_and_public_only(monkeypatch) -> None:
    upgrade_sql, _ = emitted_sql(monkeypatch)
    normalized = " ".join(upgrade_sql.split())

    assert "CREATE OR REPLACE FUNCTION public.search_community_posts" in normalized
    assert "SECURITY INVOKER" in normalized
    assert "SECURITY DEFINER" not in normalized
    assert "SET search_path = ''" in normalized
    assert "public.community_posts AS p" in normalized
    assert "public.user_profiles AS profile" in normalized
    assert "profile.nickname AS author_nickname" in normalized
    assert "auth.users" not in normalized
    assert "email" not in normalized
    assert "raw_user_meta_data" not in normalized
    assert "client_origin_id" not in normalized


def test_search_function_binds_query_cursor_limit_and_role_grants(monkeypatch) -> None:
    upgrade_sql, downgrade_sql = emitted_sql(monkeypatch)
    normalized = " ".join(upgrade_sql.split())

    assert "btrim(search_query) AS query" in normalized
    assert "char_length(normalized.query) BETWEEN 2 AND 80" in normalized
    assert "ILIKE '%' || normalized.query || '%'" in normalized
    assert "jsonb_array_elements_text(p.tags)" in normalized
    assert "(p.created_at, p.id) < (before_created_at, before_id)" in normalized
    assert "ORDER BY p.created_at DESC, p.id DESC" in normalized
    assert "LEAST(GREATEST(COALESCE(result_limit, 20), 1), 51)" in normalized
    assert (
        "REVOKE ALL ON FUNCTION public.search_community_posts(text, "
        "timestamptz, uuid, integer) FROM PUBLIC"
    ) in normalized
    assert (
        "GRANT EXECUTE ON FUNCTION public.search_community_posts(text, "
        "timestamptz, uuid, integer) TO anon, authenticated"
    ) in normalized
    assert "pg_available_extensions" in normalized
    assert "pg_trgm" in normalized

    assert "DROP FUNCTION IF EXISTS public.search_community_posts" in downgrade_sql
    assert "DROP INDEX IF EXISTS public.ix_community_posts_title_trgm" in downgrade_sql
    assert "DROP INDEX IF EXISTS public.ix_community_posts_body_trgm" in downgrade_sql


def test_non_postgresql_upgrade_and_downgrade_are_noops(monkeypatch) -> None:
    module = load_migration()
    execute = Mock()
    monkeypatch.setattr(module, "_is_postgresql", lambda: False)
    monkeypatch.setattr(module.op, "execute", execute)

    module.upgrade()
    module.downgrade()

    execute.assert_not_called()
