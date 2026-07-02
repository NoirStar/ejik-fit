"""Create the initial recruitment source schema.

Revision ID: 20260703_0001
Revises:
Create Date: 2026-07-03
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260703_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


source_type = sa.Enum("GREETING", "JSON_LD", name="sourcetype")
source_status = sa.Enum("ALLOWED", "REVIEW", "STOPPED", name="sourcestatus")
posting_status = sa.Enum("OPEN", "CLOSED", "DELAYED", name="postingstatus")


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("homepage_url", sa.String(length=1000), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_companies_slug", "companies", ["slug"], unique=True)

    op.create_table(
        "career_sources",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("base_url", sa.String(length=1000), nullable=False),
        sa.Column("source_type", source_type, nullable=False),
        sa.Column("status", source_status, nullable=False),
        sa.Column("crawl_interval_minutes", sa.Integer(), nullable=False),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("base_url"),
    )
    op.create_index(
        "ix_career_sources_company_id", "career_sources", ["company_id"]
    )

    op.create_table(
        "raw_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("storage_key", sa.String(length=1000), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=False),
        sa.Column("etag", sa.String(length=500), nullable=True),
        sa.Column("last_modified", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["source_id"], ["career_sources.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_raw_snapshots_content_hash", "raw_snapshots", ["content_hash"]
    )
    op.create_index("ix_raw_snapshots_source_id", "raw_snapshots", ["source_id"])

    op.create_table(
        "job_postings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("status", posting_status, nullable=False),
        sa.Column("description_html", sa.Text(), nullable=False),
        sa.Column("description_text", sa.Text(), nullable=False),
        sa.Column("employment_type", sa.String(length=100), nullable=True),
        sa.Column("career_type", sa.String(length=100), nullable=True),
        sa.Column("career_min", sa.Integer(), nullable=True),
        sa.Column("career_max", sa.Integer(), nullable=True),
        sa.Column("location", sa.String(length=500), nullable=True),
        sa.Column("opens_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("missing_runs", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["source_id"], ["career_sources.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_id",
            "external_id",
            name="uq_posting_source_external",
        ),
        sa.UniqueConstraint("url"),
    )
    op.create_index(
        "ix_job_postings_company_id", "job_postings", ["company_id"]
    )
    op.create_index("ix_job_postings_source_id", "job_postings", ["source_id"])
    op.create_index("ix_job_postings_title", "job_postings", ["title"])

    op.create_table(
        "job_revisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("posting_id", sa.Uuid(), nullable=False),
        sa.Column("snapshot_id", sa.Uuid(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["posting_id"], ["job_postings.id"]),
        sa.ForeignKeyConstraint(["snapshot_id"], ["raw_snapshots.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "posting_id",
            "content_hash",
            name="uq_revision_posting_hash",
        ),
    )
    op.create_index(
        "ix_job_revisions_posting_id", "job_revisions", ["posting_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_job_revisions_posting_id", table_name="job_revisions")
    op.drop_table("job_revisions")
    op.drop_index("ix_job_postings_title", table_name="job_postings")
    op.drop_index("ix_job_postings_source_id", table_name="job_postings")
    op.drop_index("ix_job_postings_company_id", table_name="job_postings")
    op.drop_table("job_postings")
    op.drop_index("ix_raw_snapshots_source_id", table_name="raw_snapshots")
    op.drop_index("ix_raw_snapshots_content_hash", table_name="raw_snapshots")
    op.drop_table("raw_snapshots")
    op.drop_index("ix_career_sources_company_id", table_name="career_sources")
    op.drop_table("career_sources")
    op.drop_index("ix_companies_slug", table_name="companies")
    op.drop_table("companies")
    posting_status.drop(op.get_bind(), checkfirst=True)
    source_status.drop(op.get_bind(), checkfirst=True)
    source_type.drop(op.get_bind(), checkfirst=True)
