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

    assert item["company_slug"] == "verified-company"
    assert item["opens_at"].date().isoformat() == "2026-07-01"
    assert item["closes_at"].date().isoformat() == "2026-07-31"
    assert item["required_skills"] == ["Python"]
    assert item["preferred_skills"] == ["Docker"]
    assert item["unspecified_skills"] == ["Linux"]


def test_database_list_orders_by_first_discovery_not_recrawl_time() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    with factory() as session:
        company = Company(name="발견 순서 기업", slug="discovery-order")
        source = CareerSource(
            company=company,
            base_url="https://careers.example.com/discovery-order",
            source_type=SourceType.JSON_LD,
            status=SourceStatus.ALLOWED,
        )
        old_discovery = JobPosting(
            company=company,
            source=source,
            external_id="old-discovery",
            url="https://careers.example.com/old-discovery",
            title="오래전에 발견하고 오늘 재확인한 공고",
            first_seen_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
            last_seen_at=datetime(2026, 7, 15, tzinfo=timezone.utc),
            last_verified_at=datetime(2026, 7, 15, tzinfo=timezone.utc),
        )
        new_discovery = JobPosting(
            company=company,
            source=source,
            external_id="new-discovery",
            url="https://careers.example.com/new-discovery",
            title="최근 처음 발견한 공고",
            first_seen_at=datetime(2026, 7, 14, tzinfo=timezone.utc),
            last_seen_at=datetime(2026, 7, 14, tzinfo=timezone.utc),
            last_verified_at=datetime(2026, 7, 14, tzinfo=timezone.utc),
        )
        session.add_all([old_discovery, new_discovery])
        session.commit()

    items = DatabasePostingReader(session_factory=factory).list(limit=10)

    assert [item["title"] for item in items] == [
        "최근 처음 발견한 공고",
        "오래전에 발견하고 오늘 재확인한 공고",
    ]
    assert items[0]["first_seen_at"].date().isoformat() == "2026-07-14"


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
    assert item["company_slug"] == "verified-company"
    assert item["description_text"] == (
        "## 주요 업무\n• Python API 개발\n• Docker 운영\nRustUnique"
    )


def test_search_document_keeps_the_same_confirmed_evidence_contract() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        posting = _posting_with_skills(session)
        document = posting_document(posting)

    assert document["company_slug"] == "verified-company"
    assert document["first_seen_at"] == "2026-07-14T00:00:00"
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


def test_database_list_filters_by_confirmed_skill_category() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    with factory() as session:
        _posting_with_skills(session)

    reader = DatabasePostingReader(session_factory=factory)

    assert len(reader.list(category="infra", limit=10)) == 1
    assert len(reader.list(category="language", limit=10)) == 1
    assert reader.list(category="ai", limit=10) == []
    assert reader.list(category="infra", limit=10, offset=1) == []
    assert reader.count(category="infra") == 1
    assert reader.count(category="ai") == 0


def test_database_list_filters_multiple_company_slugs_in_one_query() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)
    with factory() as session:
        for slug in ("naver", "kakao", "unrelated"):
            company = Company(name=slug, slug=slug)
            source = CareerSource(
                company=company,
                base_url=f"https://careers.example.com/{slug}",
                source_type=SourceType.JSON_LD,
                status=SourceStatus.ALLOWED,
            )
            session.add(
                JobPosting(
                    company=company,
                    source=source,
                    external_id=f"job-{slug}",
                    url=f"https://careers.example.com/{slug}/job",
                    title=f"{slug} 공고",
                    first_seen_at=now,
                    last_seen_at=now,
                    last_verified_at=now,
                )
            )
        session.commit()

    reader = DatabasePostingReader(session_factory=factory)

    items = reader.list(company="naver,kakao", limit=10)
    assert {item["company_slug"] for item in items} == {"naver", "kakao"}
    assert reader.count(company="naver,kakao") == 2


def test_category_search_uses_database_until_the_index_has_category_fields() -> None:
    class EmptySearchIndex:
        def __init__(self) -> None:
            self.calls = 0

        def search(self, *args, **kwargs) -> list[dict]:
            self.calls += 1
            return []

    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    with factory() as session:
        _posting_with_skills(session)

    index = EmptySearchIndex()
    reader = DatabasePostingReader(
        session_factory=factory,
        search_index=index,  # type: ignore[arg-type]
    )

    assert len(reader.list(q="플랫폼", category="infra", limit=10)) == 1
    assert index.calls == 0
