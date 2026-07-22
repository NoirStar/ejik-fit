"""Add complete authenticated following and saved community feeds.

Revision ID: 20260723_0024
Revises: 20260723_0023
Create Date: 2026-07-23
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260723_0024"
down_revision: str | None = "20260723_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgresql() -> bool:
    return op.get_context().dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgresql():
        return

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.list_community_following_posts(
          before_created_at timestamptz DEFAULT NULL,
          before_id uuid DEFAULT NULL,
          result_limit integer DEFAULT 20
        )
        RETURNS TABLE (
          id uuid,
          author_id uuid,
          category varchar(32),
          title varchar(80),
          body text,
          tags jsonb,
          reaction_count integer,
          comment_count integer,
          save_count integer,
          created_at timestamptz,
          updated_at timestamptz,
          author_nickname varchar(20)
        )
        LANGUAGE sql
        STABLE
        SECURITY INVOKER
        SET search_path = ''
        AS $following$
          SELECT
            p.id,
            p.author_id,
            p.category,
            p.title,
            p.body,
            p.tags,
            p.reaction_count,
            p.comment_count,
            p.save_count,
            p.created_at,
            p.updated_at,
            profile.nickname AS author_nickname
          FROM public.community_posts AS p
          JOIN public.user_profiles AS profile
            ON profile.user_id = p.author_id
          WHERE auth.uid() IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.community_author_follows AS f
              WHERE f.follower_id = auth.uid()
                AND f.followed_id = p.author_id
            )
            AND (
              (before_created_at IS NULL AND before_id IS NULL)
              OR (
                before_created_at IS NOT NULL
                AND before_id IS NOT NULL
                AND (p.created_at, p.id) < (before_created_at, before_id)
              )
            )
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT LEAST(GREATEST(COALESCE(result_limit, 20), 1), 51)
        $following$;

        CREATE OR REPLACE FUNCTION public.list_community_saved_posts(
          before_created_at timestamptz DEFAULT NULL,
          before_id uuid DEFAULT NULL,
          result_limit integer DEFAULT 20
        )
        RETURNS TABLE (
          id uuid,
          author_id uuid,
          category varchar(32),
          title varchar(80),
          body text,
          tags jsonb,
          reaction_count integer,
          comment_count integer,
          save_count integer,
          created_at timestamptz,
          updated_at timestamptz,
          author_nickname varchar(20),
          membership_created_at timestamptz
        )
        LANGUAGE sql
        STABLE
        SECURITY INVOKER
        SET search_path = ''
        AS $saved$
          SELECT
            p.id,
            p.author_id,
            p.category,
            p.title,
            p.body,
            p.tags,
            p.reaction_count,
            p.comment_count,
            p.save_count,
            p.created_at,
            p.updated_at,
            profile.nickname AS author_nickname,
            s.created_at AS membership_created_at
          FROM public.community_post_saves AS s
          JOIN public.community_posts AS p
            ON p.id = s.post_id
          JOIN public.user_profiles AS profile
            ON profile.user_id = p.author_id
          WHERE auth.uid() IS NOT NULL
            AND s.user_id = auth.uid()
            AND (
              (before_created_at IS NULL AND before_id IS NULL)
              OR (
                before_created_at IS NOT NULL
                AND before_id IS NOT NULL
                AND (s.created_at, p.id) < (before_created_at, before_id)
              )
            )
          ORDER BY s.created_at DESC, p.id DESC
          LIMIT LEAST(GREATEST(COALESCE(result_limit, 20), 1), 51)
        $saved$;

        REVOKE ALL ON FUNCTION public.list_community_following_posts(
          timestamptz, uuid, integer
        ) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.list_community_following_posts(
          timestamptz, uuid, integer
        ) TO authenticated;
        REVOKE ALL ON FUNCTION public.list_community_saved_posts(
          timestamptz, uuid, integer
        ) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.list_community_saved_posts(
          timestamptz, uuid, integer
        ) TO authenticated;

        NOTIFY pgrst, 'reload schema';
        """
    )


def downgrade() -> None:
    if not _is_postgresql():
        return

    op.execute(
        """
        DROP FUNCTION IF EXISTS public.list_community_saved_posts(
          timestamptz, uuid, integer
        );
        DROP FUNCTION IF EXISTS public.list_community_following_posts(
          timestamptz, uuid, integer
        )
        """
    )
