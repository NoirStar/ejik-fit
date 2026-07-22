"""Add RLS-safe full community search.

Revision ID: 20260723_0023
Revises: 20260721_0022
Create Date: 2026-07-23
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260723_0023"
down_revision: str | None = "20260721_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgresql() -> bool:
    return op.get_context().dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgresql():
        return

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.search_community_posts(
          search_query text,
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
        PARALLEL SAFE
        SECURITY INVOKER
        SET search_path = ''
        AS $search$
          WITH normalized AS (
            SELECT btrim(search_query) AS query
          )
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
          CROSS JOIN normalized
          WHERE char_length(normalized.query) BETWEEN 2 AND 80
            AND (
              (before_created_at IS NULL AND before_id IS NULL)
              OR (
                before_created_at IS NOT NULL
                AND before_id IS NOT NULL
                AND (p.created_at, p.id) < (before_created_at, before_id)
              )
            )
            AND (
              p.title ILIKE '%' || normalized.query || '%'
              OR p.body ILIKE '%' || normalized.query || '%'
              OR p.category ILIKE '%' || normalized.query || '%'
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(p.tags) AS tag(value)
                WHERE tag.value ILIKE '%' || normalized.query || '%'
              )
            )
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT LEAST(GREATEST(COALESCE(result_limit, 20), 1), 51)
        $search$;

        REVOKE ALL ON FUNCTION public.search_community_posts(text, timestamptz, uuid, integer) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.search_community_posts(text, timestamptz, uuid, integer) TO anon, authenticated;
        """
    )

    op.execute(
        """
        DO $trgm$
        DECLARE
          extension_schema text;
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_available_extensions
            WHERE name = 'pg_trgm'
          ) THEN
            BEGIN
              CREATE EXTENSION IF NOT EXISTS pg_trgm;
            EXCEPTION
              WHEN insufficient_privilege THEN
                NULL;
            END;
          END IF;

          SELECT namespace.nspname
          INTO extension_schema
          FROM pg_extension AS extension
          JOIN pg_namespace AS namespace
            ON namespace.oid = extension.extnamespace
          WHERE extension.extname = 'pg_trgm';

          IF extension_schema IS NOT NULL THEN
            EXECUTE format(
              'CREATE INDEX IF NOT EXISTS ix_community_posts_title_trgm '
              'ON public.community_posts USING gin (title %I.gin_trgm_ops)',
              extension_schema
            );
            EXECUTE format(
              'CREATE INDEX IF NOT EXISTS ix_community_posts_body_trgm '
              'ON public.community_posts USING gin (body %I.gin_trgm_ops)',
              extension_schema
            );
          END IF;
        END;
        $trgm$;
        """
    )


def downgrade() -> None:
    if not _is_postgresql():
        return

    op.execute("DROP INDEX IF EXISTS public.ix_community_posts_body_trgm")
    op.execute("DROP INDEX IF EXISTS public.ix_community_posts_title_trgm")
    op.execute(
        """
        DROP FUNCTION IF EXISTS public.search_community_posts(
          text, timestamptz, uuid, integer
        )
        """
    )
