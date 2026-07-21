"""Add public nickname profiles for verified auth users.

Revision ID: 20260721_0020
Revises: 20260720_0019
Create Date: 2026-07-21
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260721_0020"
down_revision: str | None = "20260720_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgresql() -> bool:
    return op.get_context().dialect.name == "postgresql"


def _nickname_constraint() -> sa.CheckConstraint:
    if _is_postgresql():
        expression = (
            "nickname IS NULL OR ("
            "nickname = btrim(nickname) AND "
            "char_length(nickname) BETWEEN 2 AND 20 AND "
            "nickname !~ '[[:cntrl:]]' AND "
            "position(chr(8203) in nickname) = 0 AND "
            "position(chr(8204) in nickname) = 0 AND "
            "position(chr(8205) in nickname) = 0 AND "
            "position(chr(8288) in nickname) = 0 AND "
            "position(chr(65279) in nickname) = 0"
            ")"
        )
    else:
        expression = (
            "nickname IS NULL OR (nickname = trim(nickname) AND "
            "length(nickname) BETWEEN 2 AND 20)"
        )
    return sa.CheckConstraint(
        expression,
        name="ck_user_profiles_nickname",
    )


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("nickname", sa.String(length=20), nullable=True),
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
        _nickname_constraint(),
        sa.PrimaryKeyConstraint("user_id"),
    )
    if not _is_postgresql():
        return

    op.execute("ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        DO $user_profiles$
        BEGIN
          IF to_regclass('auth.users') IS NOT NULL THEN
            ALTER TABLE public.user_profiles
              ADD CONSTRAINT fk_user_profiles_auth_user
              FOREIGN KEY (user_id) REFERENCES auth.users(id)
              ON DELETE CASCADE;

            INSERT INTO public.user_profiles (user_id, nickname)
            SELECT id, NULL
            FROM auth.users
            ON CONFLICT (user_id) DO NOTHING;

            EXECUTE $function$
              CREATE OR REPLACE FUNCTION public.create_user_profile()
              RETURNS trigger
              LANGUAGE plpgsql
              SECURITY DEFINER
              SET search_path = ''
              AS $body$
              DECLARE
                candidate text;
              BEGIN
                candidate := btrim(
                  COALESCE(NEW.raw_user_meta_data ->> 'nickname', '')
                );
                IF char_length(candidate) NOT BETWEEN 2 AND 20
                   OR candidate ~ '[[:cntrl:]]'
                   OR position(chr(8203) in candidate) > 0
                   OR position(chr(8204) in candidate) > 0
                   OR position(chr(8205) in candidate) > 0
                   OR position(chr(8288) in candidate) > 0
                   OR position(chr(65279) in candidate) > 0 THEN
                  candidate := NULL;
                END IF;

                INSERT INTO public.user_profiles (user_id, nickname)
                VALUES (NEW.id, candidate)
                ON CONFLICT (user_id) DO NOTHING;
                RETURN NEW;
              END;
              $body$
            $function$;

            REVOKE ALL
              ON FUNCTION public.create_user_profile() FROM PUBLIC;
            DROP TRIGGER IF EXISTS ejikfit_create_user_profile
              ON auth.users;
            CREATE TRIGGER ejikfit_create_user_profile
              AFTER INSERT ON auth.users
              FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();
          END IF;

          IF EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'anon'
          ) AND EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
          ) THEN
            REVOKE ALL ON public.user_profiles FROM anon, authenticated;
            GRANT SELECT (user_id, nickname)
              ON public.user_profiles TO anon, authenticated;
            CREATE POLICY user_profiles_public_select
              ON public.user_profiles
              FOR SELECT TO anon, authenticated
              USING (true);
          END IF;

          IF EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
          ) AND to_regprocedure('auth.uid()') IS NOT NULL THEN
            GRANT UPDATE (nickname, updated_at)
              ON public.user_profiles TO authenticated;
            CREATE POLICY user_profiles_owner_update
              ON public.user_profiles
              FOR UPDATE TO authenticated
              USING (auth.uid() = user_id)
              WITH CHECK (auth.uid() = user_id);
          END IF;
        END
        $user_profiles$;
        """
    )


def downgrade() -> None:
    if _is_postgresql():
        op.execute(
            """
            DO $user_profiles$
            BEGIN
              IF to_regclass('auth.users') IS NOT NULL THEN
                DROP TRIGGER IF EXISTS ejikfit_create_user_profile
                  ON auth.users;
              END IF;
            END
            $user_profiles$;
            """
        )
        op.execute(
            "DROP FUNCTION IF EXISTS public.create_user_profile()"
        )
    op.drop_table("user_profiles")
