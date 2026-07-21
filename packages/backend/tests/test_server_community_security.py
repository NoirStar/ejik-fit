from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "20260721_0021_server_community.py"
)


def migration_source() -> str:
    assert MIGRATION.exists(), "server community migration is missing"
    return MIGRATION.read_text(encoding="utf-8")


def test_server_community_migration_defines_the_complete_contract() -> None:
    source = migration_source()

    assert 'revision: str = "20260721_0021"' in source
    assert 'down_revision: str | None = "20260721_0020"' in source
    for table in (
        "community_posts",
        "community_comments",
        "community_post_reactions",
        "community_post_saves",
        "community_author_follows",
        "community_reports",
    ):
        assert f'"{table}"' in source
    assert (
        'f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY"'
        in source
    )

    assert "_replace_notification_kind_constraint(\"'job', 'community'\")" in source
    assert "community_adjust_post_counter" in source
    assert "community_create_notification" in source
    assert "community_set_updated_at" in source
    assert "SECURITY DEFINER" in source
    assert "SET search_path = ''" in source
    assert "REVOKE ALL" in source


def test_public_content_and_private_membership_have_different_grants() -> None:
    source = " ".join(migration_source().split())

    assert (
        "GRANT SELECT ( id, author_id, category, title, body, tags, "
        "reaction_count, comment_count, save_count, created_at, updated_at ) "
        "ON public.community_posts TO anon, authenticated"
    ) in source
    assert "GRANT SELECT ON public.community_post_reactions TO authenticated" in source
    assert "GRANT SELECT ON public.community_post_saves TO authenticated" in source
    assert "GRANT SELECT ON public.community_author_follows TO authenticated" in source
    assert "GRANT SELECT ON public.community_post_reactions TO anon" not in source
    assert "GRANT SELECT ON public.community_post_saves TO anon" not in source
    assert "GRANT SELECT ON public.community_author_follows TO anon" not in source

    assert "GRANT UPDATE ON public.community_posts" not in source
    assert "GRANT UPDATE ON public.community_comments" not in source
    assert "GRANT UPDATE ON public.community_reports" not in source
    assert "GRANT UPDATE ( category, title, body, tags )" in source
    assert "GRANT UPDATE ( body )" in source
    assert "GRANT UPDATE ( category, title, body, tags, updated_at )" not in source


def test_owner_policies_and_notification_guards_are_explicit() -> None:
    source = migration_source()

    for policy in (
        "community_posts_owner_insert",
        "community_posts_owner_update",
        "community_posts_owner_delete",
        "community_comments_owner_insert",
        "community_comments_owner_update",
        "community_comments_owner_delete",
        "community_reactions_owner_all",
        "community_saves_owner_all",
        "community_follows_owner_all",
        "community_reports_owner_insert",
        "community_reports_owner_select",
    ):
        assert policy in source

    assert "auth.uid() = author_id" in source
    assert "auth.uid() = user_id" in source
    assert "auth.uid() = follower_id" in source
    assert "auth.uid() = reporter_id" in source
    assert "recipient_id = actor_id" in source
    assert "kind, dedupe_key, title, body, href, metadata" in source
