import enum
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ejikfit.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SourceType(str, enum.Enum):
    GREETING = "greeting"
    JSON_LD = "json_ld"


class SourceStatus(str, enum.Enum):
    ALLOWED = "allowed"
    REVIEW = "review"
    STOPPED = "stopped"


class PostingStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    DELAYED = "delayed"


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    homepage_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    sources: Mapped[list["CareerSource"]] = relationship(back_populates="company")


class CareerSource(Base):
    __tablename__ = "career_sources"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id"), index=True
    )
    base_url: Mapped[str] = mapped_column(String(1000), unique=True)
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType))
    status: Mapped[SourceStatus] = mapped_column(
        Enum(SourceStatus), default=SourceStatus.REVIEW
    )
    crawl_interval_minutes: Mapped[int] = mapped_column(Integer, default=360)
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    company: Mapped[Company] = relationship(back_populates="sources")

    @property
    def external_id_namespace(self) -> str:
        return self.source_type.value


class RawSnapshot(Base):
    __tablename__ = "raw_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("career_sources.id"), index=True
    )
    url: Mapped[str] = mapped_column(String(1000))
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    storage_key: Mapped[str] = mapped_column(String(1000))
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    http_status: Mapped[int] = mapped_column(Integer)
    etag: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_modified: Mapped[str | None] = mapped_column(String(500), nullable=True)


class JobPosting(Base):
    __tablename__ = "job_postings"
    __table_args__ = (
        UniqueConstraint(
            "source_id", "external_id", name="uq_posting_source_external"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id"), index=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("career_sources.id"), index=True
    )
    external_id: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(1000), unique=True)
    title: Mapped[str] = mapped_column(String(500), index=True)
    status: Mapped[PostingStatus] = mapped_column(
        Enum(PostingStatus), default=PostingStatus.OPEN
    )
    description_html: Mapped[str] = mapped_column(Text, default="")
    description_text: Mapped[str] = mapped_column(Text, default="")
    employment_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    career_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    career_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    career_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    opens_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closes_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    last_verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    missing_runs: Mapped[int] = mapped_column(Integer, default=0)
    company: Mapped[Company] = relationship()
    source: Mapped[CareerSource] = relationship()
    skills: Mapped[list["PostingSkill"]] = relationship(
        "PostingSkill", cascade="all, delete-orphan"
    )


class PostingSkill(Base):
    __tablename__ = "posting_skills"
    __table_args__ = (
        UniqueConstraint("posting_id", "skill", name="uq_posting_skill"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    posting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_postings.id"), index=True
    )
    skill: Mapped[str] = mapped_column(String(100), index=True)
    category: Mapped[str] = mapped_column(String(50))


class JobRevision(Base):
    __tablename__ = "job_revisions"
    __table_args__ = (
        UniqueConstraint(
            "posting_id", "content_hash", name="uq_revision_posting_hash"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    posting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_postings.id"), index=True
    )
    snapshot_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("raw_snapshots.id")
    )
    content_hash: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
