from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PostingSkill,
    SourceStatus,
    SourceType,
)
from ejikfit.skills import sync_posting_skills


def _make_posting(session: Session, title: str, description: str) -> JobPosting:
    now = datetime(2026, 7, 4, tzinfo=timezone.utc)
    company = Company(name="기업", slug="company")
    source = CareerSource(
        company=company,
        base_url="https://example.com",
        source_type=SourceType.JSON_LD,
        status=SourceStatus.ALLOWED,
    )
    session.add(source)
    session.flush()
    posting = JobPosting(
        company_id=company.id,
        source_id=source.id,
        external_id="1",
        url="https://example.com/o/1",
        title=title,
        description_text=description,
        first_seen_at=now,
        last_seen_at=now,
        last_verified_at=now,
    )
    session.add(posting)
    session.flush()
    return posting


def _skills(session: Session, posting_id) -> list[str]:
    rows = session.scalars(
        select(PostingSkill).where(PostingSkill.posting_id == posting_id)
    ).all()
    return sorted(row.skill for row in rows)


def test_sync_stores_extracted_skills_with_categories() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        posting = _make_posting(
            session, "백엔드 엔지니어", "Python, FastAPI, PostgreSQL 경험"
        )
        returned = sync_posting_skills(session, posting)
        session.commit()

        assert returned == ["FastAPI", "PostgreSQL", "Python"]
        assert _skills(session, posting.id) == ["FastAPI", "PostgreSQL", "Python"]
        row = session.scalar(
            select(PostingSkill).where(PostingSkill.skill == "FastAPI")
        )
        assert row.category == "backend"


def test_sync_is_idempotent() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        posting = _make_posting(session, "React 개발자", "React와 TypeScript")
        sync_posting_skills(session, posting)
        session.commit()
        sync_posting_skills(session, posting)
        session.commit()

        assert _skills(session, posting.id) == ["React", "TypeScript"]
        assert (
            session.scalar(
                select(PostingSkill).where(PostingSkill.posting_id == posting.id)
            )
            is not None
        )
        count = len(
            session.scalars(
                select(PostingSkill).where(
                    PostingSkill.posting_id == posting.id
                )
            ).all()
        )
        assert count == 2


def test_sync_updates_when_text_changes() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        posting = _make_posting(session, "개발자", "Python 백엔드")
        sync_posting_skills(session, posting)
        session.commit()
        assert _skills(session, posting.id) == ["Python"]

        posting.description_text = "이제 Docker와 Kubernetes 를 씁니다"
        sync_posting_skills(session, posting)
        session.commit()
        assert _skills(session, posting.id) == ["Docker", "Kubernetes"]
