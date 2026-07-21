"""Add account-backed community content and interactions.

Revision ID: 20260721_0021
Revises: 20260721_0020
Create Date: 2026-07-21
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260721_0021"
down_revision: str | None = "20260721_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgresql() -> bool:
    return op.get_context().dialect.name == "postgresql"


def _tags_column() -> sa.Column:
    if _is_postgresql():
        column_type = postgresql.JSONB(astext_type=sa.Text())
        server_default = sa.text("'[]'::jsonb")
    else:
        column_type = sa.JSON()
        server_default = sa.text("'[]'")
    return sa.Column(
        "tags",
        column_type,
        server_default=server_default,
        nullable=False,
    )


def _replace_notification_kind_constraint(kinds: str) -> None:
    if _is_postgresql():
        op.drop_constraint(
            "ck_user_notifications_kind",
            "user_notifications",
            type_="check",
        )
        op.create_check_constraint(
            "ck_user_notifications_kind",
            "user_notifications",
            f"kind IN ({kinds})",
        )
        return

    with op.batch_alter_table("user_notifications") as batch_op:
        batch_op.drop_constraint(
            "ck_user_notifications_kind",
            type_="check",
        )
        batch_op.create_check_constraint(
            "ck_user_notifications_kind",
            f"kind IN ({kinds})",
        )


def upgrade() -> None:
    if _is_postgresql():
        op.execute(
            """
            CREATE OR REPLACE FUNCTION public.community_tags_are_valid(
              candidate jsonb
            )
            RETURNS boolean
            LANGUAGE sql
            IMMUTABLE
            PARALLEL SAFE
            SET search_path = ''
            AS $body$
              SELECT CASE
                WHEN jsonb_typeof(candidate) <> 'array' THEN false
                ELSE
                  jsonb_array_length(candidate) <= 4
                  AND NOT EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(candidate) AS item(value)
                    WHERE jsonb_typeof(value) <> 'string'
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(candidate) AS item(value)
                    WHERE value <> btrim(value)
                       OR char_length(value) NOT BETWEEN 1 AND 40
                       OR value ~ '[[:cntrl:]]'
                  )
                  AND (
                    SELECT count(*) = count(DISTINCT lower(value))
                    FROM jsonb_array_elements_text(candidate) AS item(value)
                  )
              END
            $body$;
            """
        )

    _replace_notification_kind_constraint("'job', 'community'")

    post_constraints: list[sa.CheckConstraint] = []
    if _is_postgresql():
        post_constraints.append(
            sa.CheckConstraint(
                "public.community_tags_are_valid(tags)",
                name="ck_community_posts_tags",
            )
        )

    op.create_table(
        "community_posts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        _tags_column(),
        sa.Column(
            "reaction_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "comment_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "save_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("client_origin_id", sa.String(length=200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        *post_constraints,
        sa.CheckConstraint(
            "category IN ('커리어 질문', '커리어 고민', '면접 후기')",
            name="ck_community_posts_category",
        ),
        sa.CheckConstraint(
            "title = btrim(title) AND char_length(title) BETWEEN 1 AND 80"
            if _is_postgresql()
            else "title = trim(title) AND length(title) BETWEEN 1 AND 80",
            name="ck_community_posts_title",
        ),
        sa.CheckConstraint(
            "body = btrim(body) AND char_length(body) BETWEEN 1 AND 1200"
            if _is_postgresql()
            else "body = trim(body) AND length(body) BETWEEN 1 AND 1200",
            name="ck_community_posts_body",
        ),
        sa.CheckConstraint(
            "client_origin_id IS NULL OR (client_origin_id = btrim(client_origin_id) "
            "AND char_length(client_origin_id) BETWEEN 1 AND 200)"
            if _is_postgresql()
            else "client_origin_id IS NULL OR (client_origin_id = trim(client_origin_id) "
            "AND length(client_origin_id) BETWEEN 1 AND 200)",
            name="ck_community_posts_origin",
        ),
        sa.CheckConstraint(
            "reaction_count >= 0 AND comment_count >= 0 AND save_count >= 0",
            name="ck_community_posts_counts",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["user_profiles.user_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "author_id",
            "client_origin_id",
            name="uq_community_posts_author_origin",
        ),
    )
    op.create_index(
        "ix_community_posts_created_at",
        "community_posts",
        ["created_at"],
    )
    op.create_index(
        "ix_community_posts_author_created",
        "community_posts",
        ["author_id", "created_at"],
    )

    op.create_table(
        "community_comments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("client_origin_id", sa.String(length=200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "body = btrim(body) AND char_length(body) BETWEEN 1 AND 600"
            if _is_postgresql()
            else "body = trim(body) AND length(body) BETWEEN 1 AND 600",
            name="ck_community_comments_body",
        ),
        sa.CheckConstraint(
            "client_origin_id IS NULL OR (client_origin_id = btrim(client_origin_id) "
            "AND char_length(client_origin_id) BETWEEN 1 AND 200)"
            if _is_postgresql()
            else "client_origin_id IS NULL OR (client_origin_id = trim(client_origin_id) "
            "AND length(client_origin_id) BETWEEN 1 AND 200)",
            name="ck_community_comments_origin",
        ),
        sa.ForeignKeyConstraint(
            ["post_id"],
            ["community_posts.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["user_profiles.user_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "author_id",
            "client_origin_id",
            name="uq_community_comments_author_origin",
        ),
    )
    op.create_index(
        "ix_community_comments_post_created",
        "community_comments",
        ["post_id", "created_at"],
    )
    op.create_index(
        "ix_community_comments_author_id",
        "community_comments",
        ["author_id"],
    )

    op.create_table(
        "community_post_reactions",
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["post_id"],
            ["community_posts.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_profiles.user_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("post_id", "user_id"),
    )
    op.create_index(
        "ix_community_post_reactions_user_id",
        "community_post_reactions",
        ["user_id"],
    )

    op.create_table(
        "community_post_saves",
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["post_id"],
            ["community_posts.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_profiles.user_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("post_id", "user_id"),
    )
    op.create_index(
        "ix_community_post_saves_user_id",
        "community_post_saves",
        ["user_id"],
    )

    op.create_table(
        "community_author_follows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("follower_id", sa.Uuid(), nullable=False),
        sa.Column("followed_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "follower_id <> followed_id",
            name="ck_community_author_follows_not_self",
        ),
        sa.ForeignKeyConstraint(
            ["follower_id"],
            ["user_profiles.user_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["followed_id"],
            ["user_profiles.user_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "follower_id",
            "followed_id",
            name="uq_community_author_follows_pair",
        ),
    )
    op.create_index(
        "ix_community_author_follows_follower_id",
        "community_author_follows",
        ["follower_id"],
    )
    op.create_index(
        "ix_community_author_follows_followed_id",
        "community_author_follows",
        ["followed_id"],
    )

    op.create_table(
        "community_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reporter_id", sa.Uuid(), nullable=False),
        sa.Column("target_type", sa.String(length=16), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("details", sa.String(length=500), nullable=True),
        sa.Column(
            "status",
            sa.String(length=24),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "target_type IN ('post', 'comment')",
            name="ck_community_reports_target_type",
        ),
        sa.CheckConstraint(
            "reason IN ('spam', 'harassment', 'privacy', 'misinformation', 'other')",
            name="ck_community_reports_reason",
        ),
        sa.CheckConstraint(
            "details IS NULL OR (details = btrim(details) "
            "AND char_length(details) BETWEEN 1 AND 500)"
            if _is_postgresql()
            else "details IS NULL OR (details = trim(details) "
            "AND length(details) BETWEEN 1 AND 500)",
            name="ck_community_reports_details",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'reviewed', 'dismissed', 'actioned')",
            name="ck_community_reports_status",
        ),
        sa.ForeignKeyConstraint(
            ["reporter_id"],
            ["user_profiles.user_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "reporter_id",
            "target_type",
            "target_id",
            name="uq_community_reports_reporter_target",
        ),
    )
    op.create_index(
        "ix_community_reports_reporter_id",
        "community_reports",
        ["reporter_id"],
    )
    op.create_index(
        "ix_community_reports_target",
        "community_reports",
        ["target_type", "target_id"],
    )

    if not _is_postgresql():
        return

    for table in (
        "community_posts",
        "community_comments",
        "community_post_reactions",
        "community_post_saves",
        "community_author_follows",
        "community_reports",
    ):
        op.execute(
            f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY"
        )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.community_set_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = ''
        AS $body$
        BEGIN
          NEW.updated_at := now();
          RETURN NEW;
        END;
        $body$;

        CREATE OR REPLACE FUNCTION public.community_adjust_post_counter()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = ''
        AS $body$
        DECLARE
          row_data jsonb;
          target_post_id uuid;
          delta integer;
        BEGIN
          row_data := CASE
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            ELSE to_jsonb(NEW)
          END;
          target_post_id := (row_data ->> 'post_id')::uuid;
          delta := CASE WHEN TG_OP = 'DELETE' THEN -1 ELSE 1 END;

          IF TG_TABLE_NAME = 'community_comments' THEN
            UPDATE public.community_posts
            SET comment_count = greatest(0, comment_count + delta)
            WHERE id = target_post_id;
          ELSIF TG_TABLE_NAME = 'community_post_reactions' THEN
            UPDATE public.community_posts
            SET reaction_count = greatest(0, reaction_count + delta)
            WHERE id = target_post_id;
          ELSIF TG_TABLE_NAME = 'community_post_saves' THEN
            UPDATE public.community_posts
            SET save_count = greatest(0, save_count + delta)
            WHERE id = target_post_id;
          END IF;

          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END;
        $body$;

        CREATE OR REPLACE FUNCTION public.community_create_notification()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = ''
        AS $body$
        DECLARE
          row_data jsonb;
          action_id uuid;
          actor_id uuid;
          recipient_id uuid;
          target_post_id uuid;
          actor_nickname text;
          notification_title text;
          notification_body text;
          notification_href text;
          notification_key text;
          notification_metadata jsonb;
        BEGIN
          row_data := to_jsonb(NEW);
          action_id := (row_data ->> 'id')::uuid;

          IF TG_TABLE_NAME = 'community_comments' THEN
            actor_id := (row_data ->> 'author_id')::uuid;
            target_post_id := (row_data ->> 'post_id')::uuid;
            SELECT author_id
              INTO recipient_id
              FROM public.community_posts
             WHERE id = target_post_id;
            notification_title := '새 댓글이 달렸어요';
            notification_href := '/posts/' || target_post_id::text;
            notification_key := 'community:comment:' || action_id::text;
            notification_metadata := jsonb_build_object(
              'action', 'comment',
              'actor_id', actor_id,
              'post_id', target_post_id,
              'comment_id', action_id
            );
          ELSIF TG_TABLE_NAME = 'community_author_follows' THEN
            actor_id := (row_data ->> 'follower_id')::uuid;
            recipient_id := (row_data ->> 'followed_id')::uuid;
            notification_title := '새 팔로워가 생겼어요';
            notification_href := '/career/my-posts';
            notification_key := 'community:follow:' || action_id::text;
            notification_metadata := jsonb_build_object(
              'action', 'follow',
              'actor_id', actor_id
            );
          ELSE
            RETURN NEW;
          END IF;

          IF recipient_id IS NULL OR recipient_id = actor_id THEN
            RETURN NEW;
          END IF;

          SELECT nickname
            INTO actor_nickname
            FROM public.user_profiles
           WHERE user_id = actor_id;
          notification_body := COALESCE(actor_nickname, '이직핏 사용자') ||
            CASE
              WHEN TG_TABLE_NAME = 'community_comments'
                THEN '님이 댓글을 남겼습니다.'
              ELSE '님이 회원님을 팔로우했습니다.'
            END;

          INSERT INTO public.user_notifications (
            id, user_id, kind, dedupe_key, title, body, href, metadata
          ) VALUES (
            action_id,
            recipient_id,
            'community',
            notification_key,
            notification_title,
            notification_body,
            notification_href,
            notification_metadata
          )
          ON CONFLICT (user_id, dedupe_key) DO NOTHING;

          RETURN NEW;
        END;
        $body$;

        REVOKE ALL
          ON FUNCTION public.community_set_updated_at() FROM PUBLIC;
        REVOKE ALL
          ON FUNCTION public.community_adjust_post_counter() FROM PUBLIC;
        REVOKE ALL
          ON FUNCTION public.community_create_notification() FROM PUBLIC;

        CREATE TRIGGER community_posts_touch_updated_at
          BEFORE UPDATE OF category, title, body, tags
          ON public.community_posts
          FOR EACH ROW EXECUTE FUNCTION public.community_set_updated_at();
        CREATE TRIGGER community_comments_touch_updated_at
          BEFORE UPDATE OF body
          ON public.community_comments
          FOR EACH ROW EXECUTE FUNCTION public.community_set_updated_at();
        CREATE TRIGGER community_reports_touch_updated_at
          BEFORE UPDATE OF status, details
          ON public.community_reports
          FOR EACH ROW EXECUTE FUNCTION public.community_set_updated_at();

        CREATE TRIGGER community_comments_adjust_count
          AFTER INSERT OR DELETE ON public.community_comments
          FOR EACH ROW EXECUTE FUNCTION public.community_adjust_post_counter();
        CREATE TRIGGER community_reactions_adjust_count
          AFTER INSERT OR DELETE ON public.community_post_reactions
          FOR EACH ROW EXECUTE FUNCTION public.community_adjust_post_counter();
        CREATE TRIGGER community_saves_adjust_count
          AFTER INSERT OR DELETE ON public.community_post_saves
          FOR EACH ROW EXECUTE FUNCTION public.community_adjust_post_counter();

        CREATE TRIGGER community_comments_notify
          AFTER INSERT ON public.community_comments
          FOR EACH ROW EXECUTE FUNCTION public.community_create_notification();
        CREATE TRIGGER community_follows_notify
          AFTER INSERT ON public.community_author_follows
          FOR EACH ROW EXECUTE FUNCTION public.community_create_notification();
        """
    )

    op.execute(
        """
        DO $community_access$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'anon'
          ) AND EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
          ) THEN
            REVOKE ALL ON public.community_posts FROM anon, authenticated;
            REVOKE ALL ON public.community_comments FROM anon, authenticated;
            REVOKE ALL ON public.community_post_reactions FROM anon, authenticated;
            REVOKE ALL ON public.community_post_saves FROM anon, authenticated;
            REVOKE ALL ON public.community_author_follows FROM anon, authenticated;
            REVOKE ALL ON public.community_reports FROM anon, authenticated;

            GRANT SELECT (
              id, author_id, category, title, body, tags,
              reaction_count, comment_count, save_count, created_at, updated_at
            ) ON public.community_posts TO anon, authenticated;
            GRANT SELECT (
              id, post_id, author_id, body, created_at, updated_at
            ) ON public.community_comments TO anon, authenticated;

            CREATE POLICY community_posts_public_select
              ON public.community_posts
              FOR SELECT TO anon, authenticated
              USING (true);
            CREATE POLICY community_comments_public_select
              ON public.community_comments
              FOR SELECT TO anon, authenticated
              USING (true);
          END IF;

          IF EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
          ) AND to_regprocedure('auth.uid()') IS NOT NULL THEN
            GRANT INSERT (
              id, author_id, category, title, body, tags, client_origin_id
            ) ON public.community_posts TO authenticated;
            GRANT UPDATE (
              category, title, body, tags
            ) ON public.community_posts TO authenticated;
            GRANT DELETE ON public.community_posts TO authenticated;

            GRANT INSERT (
              id, post_id, author_id, body, client_origin_id
            ) ON public.community_comments TO authenticated;
            GRANT UPDATE (
              body
            ) ON public.community_comments TO authenticated;
            GRANT DELETE ON public.community_comments TO authenticated;

            GRANT SELECT ON public.community_post_reactions TO authenticated;
            GRANT INSERT (
              post_id, user_id
            ) ON public.community_post_reactions TO authenticated;
            GRANT DELETE ON public.community_post_reactions TO authenticated;

            GRANT SELECT ON public.community_post_saves TO authenticated;
            GRANT INSERT (
              post_id, user_id
            ) ON public.community_post_saves TO authenticated;
            GRANT DELETE ON public.community_post_saves TO authenticated;

            GRANT SELECT ON public.community_author_follows TO authenticated;
            GRANT INSERT (
              id, follower_id, followed_id
            ) ON public.community_author_follows TO authenticated;
            GRANT DELETE ON public.community_author_follows TO authenticated;

            GRANT SELECT ON public.community_reports TO authenticated;
            GRANT INSERT (
              id, reporter_id, target_type, target_id, reason, details
            ) ON public.community_reports TO authenticated;

            CREATE POLICY community_posts_owner_insert
              ON public.community_posts
              FOR INSERT TO authenticated
              WITH CHECK (auth.uid() = author_id);
            CREATE POLICY community_posts_owner_update
              ON public.community_posts
              FOR UPDATE TO authenticated
              USING (auth.uid() = author_id)
              WITH CHECK (auth.uid() = author_id);
            CREATE POLICY community_posts_owner_delete
              ON public.community_posts
              FOR DELETE TO authenticated
              USING (auth.uid() = author_id);

            CREATE POLICY community_comments_owner_insert
              ON public.community_comments
              FOR INSERT TO authenticated
              WITH CHECK (auth.uid() = author_id);
            CREATE POLICY community_comments_owner_update
              ON public.community_comments
              FOR UPDATE TO authenticated
              USING (auth.uid() = author_id)
              WITH CHECK (auth.uid() = author_id);
            CREATE POLICY community_comments_owner_delete
              ON public.community_comments
              FOR DELETE TO authenticated
              USING (auth.uid() = author_id);

            CREATE POLICY community_reactions_owner_all
              ON public.community_post_reactions
              FOR ALL TO authenticated
              USING (auth.uid() = user_id)
              WITH CHECK (auth.uid() = user_id);
            CREATE POLICY community_saves_owner_all
              ON public.community_post_saves
              FOR ALL TO authenticated
              USING (auth.uid() = user_id)
              WITH CHECK (auth.uid() = user_id);
            CREATE POLICY community_follows_owner_all
              ON public.community_author_follows
              FOR ALL TO authenticated
              USING (auth.uid() = follower_id)
              WITH CHECK (auth.uid() = follower_id);

            CREATE POLICY community_reports_owner_insert
              ON public.community_reports
              FOR INSERT TO authenticated
              WITH CHECK (auth.uid() = reporter_id);
            CREATE POLICY community_reports_owner_select
              ON public.community_reports
              FOR SELECT TO authenticated
              USING (auth.uid() = reporter_id);
          END IF;
        END
        $community_access$;

        NOTIFY pgrst, 'reload schema';
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_community_reports_target",
        table_name="community_reports",
    )
    op.drop_index(
        "ix_community_reports_reporter_id",
        table_name="community_reports",
    )
    op.drop_table("community_reports")

    op.drop_index(
        "ix_community_author_follows_followed_id",
        table_name="community_author_follows",
    )
    op.drop_index(
        "ix_community_author_follows_follower_id",
        table_name="community_author_follows",
    )
    op.drop_table("community_author_follows")

    op.drop_index(
        "ix_community_post_saves_user_id",
        table_name="community_post_saves",
    )
    op.drop_table("community_post_saves")

    op.drop_index(
        "ix_community_post_reactions_user_id",
        table_name="community_post_reactions",
    )
    op.drop_table("community_post_reactions")

    op.drop_index(
        "ix_community_comments_author_id",
        table_name="community_comments",
    )
    op.drop_index(
        "ix_community_comments_post_created",
        table_name="community_comments",
    )
    op.drop_table("community_comments")

    op.drop_index(
        "ix_community_posts_author_created",
        table_name="community_posts",
    )
    op.drop_index(
        "ix_community_posts_created_at",
        table_name="community_posts",
    )
    op.drop_table("community_posts")

    if _is_postgresql():
        op.execute(
            """
            DROP FUNCTION IF EXISTS public.community_create_notification();
            DROP FUNCTION IF EXISTS public.community_adjust_post_counter();
            DROP FUNCTION IF EXISTS public.community_set_updated_at();
            """
        )
        op.execute(
            "DROP FUNCTION IF EXISTS public.community_tags_are_valid(jsonb)"
        )
        op.execute(
            "DELETE FROM public.user_notifications WHERE kind = 'community'"
        )
    else:
        op.execute(
            "DELETE FROM user_notifications WHERE kind = 'community'"
        )
    _replace_notification_kind_constraint("'job'")
