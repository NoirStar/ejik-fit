from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ejikfit.api.app import create_app
from ejikfit.api.skills import DatabaseSkillStatsReader
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PostingSkill,
    PostingStatus,
    SourceStatus,
    SourceType,
)


class FakeSkillStatsReader:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def stats(self, career_type: str | None = None, limit: int = 30) -> list[dict]:
        self.calls.append({"career_type": career_type, "limit": limit})
        return [{"skill": "Python", "category": "language", "count": 12}]


def test_skill_stats_endpoint_returns_ranked_items() -> None:
    reader = FakeSkillStatsReader()
    client = TestClient(create_app(skill_stats_reader=reader))

    response = client.get("/api/skills/stats?career_type=new_comer&limit=5")

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0] == {"skill": "Python", "category": "language", "count": 12}
    assert body["total"] == 1
    assert reader.calls == [{"career_type": "new_comer", "limit": 5}]


def _add_posting(
    session: Session,
    company: Company,
    source: CareerSource,
    external_id: str,
    *,
    career_type: str,
    status: PostingStatus,
    skills: list[tuple[str, str]],
) -> None:
    now = datetime(2026, 7, 4, tzinfo=timezone.utc)
    posting = JobPosting(
        company_id=company.id,
        source_id=source.id,
        external_id=external_id,
        url=f"https://example.com/o/{external_id}",
        title=f"공고 {external_id}",
        status=status,
        career_type=career_type,
        first_seen_at=now,
        last_seen_at=now,
        last_verified_at=now,
    )
    session.add(posting)
    session.flush()
    for skill, category in skills:
        session.add(
            PostingSkill(posting_id=posting.id, skill=skill, category=category)
        )


def test_database_reader_counts_and_filters() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    with factory() as session:
        company = Company(name="기업", slug="company")
        source = CareerSource(
            company=company,
            base_url="https://example.com",
            source_type=SourceType.JSON_LD,
            status=SourceStatus.ALLOWED,
        )
        session.add(source)
        session.flush()
        _add_posting(
            session, company, source, "1",
            career_type="new_comer", status=PostingStatus.OPEN,
            skills=[("Python", "language"), ("AWS", "infra")],
        )
        _add_posting(
            session, company, source, "2",
            career_type="experienced", status=PostingStatus.OPEN,
            skills=[("Python", "language")],
        )
        _add_posting(
            session, company, source, "3",
            career_type="new_comer", status=PostingStatus.CLOSED,
            skills=[("Python", "language")],
        )
        session.commit()

    reader = DatabaseSkillStatsReader(session_factory=factory)

    # closed posting is excluded, so Python appears in 2 open postings.
    everything = reader.stats()
    assert everything[0] == {"skill": "Python", "category": "language", "count": 2}
    assert {"skill": "AWS", "category": "infra", "count": 1} in everything

    # career_type filter narrows to the single new_comer open posting.
    newcomer = reader.stats(career_type="new_comer")
    assert {"skill": "Python", "category": "language", "count": 1} in newcomer
    assert {"skill": "AWS", "category": "infra", "count": 1} in newcomer
