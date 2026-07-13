from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ejikfit.api.postings import DatabasePostingReader
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PostingSkill,
    SourceStatus,
    SourceType,
)
from ejikfit.search import posting_document


def _posting_with_skills(session: Session) -> JobPosting:
    now = datetime(2026, 7, 14, tzinfo=timezone.utc)
    company = Company(name="검증 기업", slug="verified-company")
    source = CareerSource(
        company=company,
        base_url="https://careers.example.com",
        source_type=SourceType.JSON_LD,
        status=SourceStatus.ALLOWED,
    )
    posting = JobPosting(
        company=company,
        source=source,
        external_id="job-1",
        url="https://careers.example.com/job-1",
        title="플랫폼 엔지니어",
        description_text="Python, Docker, Linux",
        opens_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
        closes_at=datetime(2026, 7, 31, tzinfo=timezone.utc),
        first_seen_at=now,
        last_seen_at=now,
        last_verified_at=now,
    )
    posting.skills = [
        PostingSkill(
            skill="Python",
            category="language",
            requirement_type="required",
            confidence=1.0,
            match_reason="distinct_alias",
        ),
        PostingSkill(
            skill="Docker",
            category="infra",
            requirement_type="preferred",
            confidence=0.95,
            match_reason="distinct_alias",
        ),
        PostingSkill(
            skill="Linux",
            category="infra",
            requirement_type="unspecified",
            confidence=0.9,
            match_reason="distinct_alias",
        ),
        PostingSkill(
            skill="Go",
            category="language",
            requirement_type="required",
            confidence=0.5,
            match_reason="strict_alias_without_context",
        ),
    ]
    session.add(posting)
    session.commit()
    return posting


def test_database_list_exposes_confirmed_requirement_evidence() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    with factory() as session:
        _posting_with_skills(session)

    item = DatabasePostingReader(session_factory=factory).list(limit=10)[0]

    assert item["opens_at"].date().isoformat() == "2026-07-01"
    assert item["closes_at"].date().isoformat() == "2026-07-31"
    assert item["required_skills"] == ["Python"]
    assert item["preferred_skills"] == ["Docker"]
    assert item["unspecified_skills"] == ["Linux"]


def test_database_detail_restores_plain_text_structure_from_source_html() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    with factory() as session:
        posting = _posting_with_skills(session)
        posting.description_html = (
            "<h2>주요 업무</h2><ul><li>Python API 개발</li>"
            "<li>Docker 운영</li></ul>"
        )
        posting.description_text = (
            "주요 업무 Python API 개발 Docker 운영 RustUnique"
        )
        posting_id = str(posting.id)
        session.commit()

    item = DatabasePostingReader(session_factory=factory).get(posting_id)

    assert item is not None
    assert item["description_text"] == (
        "## 주요 업무\n• Python API 개발\n• Docker 운영\nRustUnique"
    )


def test_search_document_keeps_the_same_confirmed_evidence_contract() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        posting = _posting_with_skills(session)
        document = posting_document(posting)

    assert document["opens_at"] == "2026-07-01T00:00:00"
    assert document["closes_at"] == "2026-07-31T00:00:00"
    assert document["required_skills"] == ["Python"]
    assert document["preferred_skills"] == ["Docker"]
    assert document["unspecified_skills"] == ["Linux"]


def test_database_search_matches_only_confirmed_canonical_skills() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    with factory() as session:
        posting = _posting_with_skills(session)
        posting.description_text = "플랫폼 운영"
        posting.skills.append(
            PostingSkill(
                skill="Kubernetes",
                category="infra",
                requirement_type="preferred",
                confidence=0.95,
                match_reason="distinct_alias",
            )
        )
        session.commit()

    reader = DatabasePostingReader(session_factory=factory)

    assert len(reader.list(q="Kubernetes", limit=10)) == 1
    assert reader.list(q="Go", limit=10) == []
