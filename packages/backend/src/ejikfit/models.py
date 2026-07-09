import enum
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
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
    NAVER_JSON = "naver_json"
    KAKAO_JSON = "kakao_json"
    LINE_GATSBY = "line_gatsby"
    HTML_LISTING_DETAIL = "html_listing_detail"
    STATIC_NEXT_DATA = "static_next_data"
    ENTERPRISE_JSON = "enterprise_json"
    LEVER_GREENHOUSE = "lever_greenhouse"
    WORKDAY = "workday"
    SAP_SUCCESSFACTORS = "sap_successfactors"
    SITEMAP_DISCOVERY = "sitemap_discovery"
    BROWSER_PUBLIC_RENDER = "browser_public_render"


class SourceStatus(str, enum.Enum):
    ALLOWED = "allowed"
    NEEDS_CONNECTOR = "needs_connector"
    NEEDS_BROWSER = "needs_browser"
    REVIEW = "review"
    BLOCKED = "blocked"
    STOPPED = "stopped"


class PolicyStatus(str, enum.Enum):
    ALLOWED = "allowed"
    REVIEW = "review"
    BLOCKED = "blocked"
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

    def __init__(self, **kwargs: Any) -> None:
        source_type = kwargs.get("source_type")
        if "connector_family" not in kwargs and source_type is not None:
            if isinstance(source_type, SourceType):
                kwargs["connector_family"] = source_type.value
            else:
                kwargs["connector_family"] = str(source_type)
        kwargs.setdefault("policy_status", PolicyStatus.REVIEW)
        kwargs.setdefault("brand_tier_weight", 0)
        kwargs.setdefault("tech_job_priority", 0)
        kwargs.setdefault("expected_job_volume", 0)
        kwargs.setdefault("connector_reuse_score", 0)
        kwargs.setdefault("policy_risk", 0)
        kwargs.setdefault("non_tech_noise", 0)
        super().__init__(**kwargs)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id"), index=True
    )
    base_url: Mapped[str] = mapped_column(String(1000), unique=True)
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType))
    status: Mapped[SourceStatus] = mapped_column(
        Enum(SourceStatus), default=SourceStatus.REVIEW
    )
    policy_status: Mapped[PolicyStatus] = mapped_column(
        Enum(PolicyStatus), default=PolicyStatus.REVIEW
    )
    connector_family: Mapped[str] = mapped_column(String(80), default="")
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    brand_tier_weight: Mapped[int] = mapped_column(Integer, default=0)
    tech_job_priority: Mapped[int] = mapped_column(Integer, default=0)
    expected_job_volume: Mapped[int] = mapped_column(Integer, default=0)
    connector_reuse_score: Mapped[int] = mapped_column(Integer, default=0)
    policy_risk: Mapped[int] = mapped_column(Integer, default=0)
    non_tech_noise: Mapped[int] = mapped_column(Integer, default=0)
    crawl_interval_minutes: Mapped[int] = mapped_column(Integer, default=360)
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_discovered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_success_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_error_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    company: Mapped[Company] = relationship(back_populates="sources")

    @property
    def external_id_namespace(self) -> str:
        return self.source_type.value

    @property
    def priority_score(self) -> int:
        return (
            (self.brand_tier_weight or 0)
            + (self.tech_job_priority or 0)
            + (self.expected_job_volume or 0)
            + (self.connector_reuse_score or 0)
            - (self.policy_risk or 0)
            - (self.non_tech_noise or 0)
        )


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
    requirement_type: Mapped[str] = mapped_column(
        String(20), default="unspecified"
    )
    evidence_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    match_reason: Mapped[str] = mapped_column(
        String(100), default="legacy_backfill"
    )


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
