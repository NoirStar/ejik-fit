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

    def stats(
        self,
        career_type: str | None = None,
        category: str | None = None,
        limit: int = 30,
    ) -> list[dict]:
        self.calls.append(
            {
                "career_type": career_type,
                "category": category,
                "limit": limit,
            }
        )
        return [
            {
                "skill": "Python",
                "category": "language",
                "count": 12,
                "required_count": 7,
                "preferred_count": 3,
                "unspecified_count": 2,
            }
        ]


class FakeSkillTrendReader:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def trends(
        self,
        skills: list[str],
        *,
        weeks: int = 12,
        minimum_weeks: int = 4,
    ) -> dict:
        self.calls.append(
            {
                "skills": skills,
                "weeks": weeks,
                "minimum_weeks": minimum_weeks,
            }
        )
        return {
            "status": "collecting",
            "collected_weeks": 2,
            "minimum_weeks": minimum_weeks,
            "latest_snapshot_at": "2026-07-15T00:00:00Z",
            "series": [],
        }


def test_skill_stats_endpoint_returns_ranked_items() -> None:
    reader = FakeSkillStatsReader()
    client = TestClient(create_app(skill_stats_reader=reader))

    response = client.get(
        "/api/skills/stats?career_type=new_comer&category=infra&limit=5"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0] == {
        "skill": "Python",
        "category": "language",
        "count": 12,
        "required_count": 7,
        "preferred_count": 3,
        "unspecified_count": 2,
    }
    assert body["total"] == 1
    assert reader.calls == [
        {"career_type": "new_comer", "category": "infra", "limit": 5}
    ]


def test_skill_trends_endpoint_exposes_collection_progress_without_fake_data() -> None:
    reader = FakeSkillTrendReader()
    client = TestClient(create_app(skill_trend_reader=reader))

    response = client.get(
        "/api/skills/trends?skills=Python&skills=Kubernetes&weeks=12"
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "collecting",
        "collected_weeks": 2,
        "minimum_weeks": 4,
        "latest_snapshot_at": "2026-07-15T00:00:00Z",
        "series": [],
    }
    assert reader.calls == [
        {
            "skills": ["Python", "Kubernetes"],
            "weeks": 12,
            "minimum_weeks": 4,
        }
    ]

    too_many = client.get(
        "/api/skills/trends?skills=Python&skills=Go&skills=Java&skills=Rust"
    )
    assert too_many.status_code == 422


def _add_posting(
    session: Session,
    company: Company,
    source: CareerSource,
    external_id: str,
    *,
    career_type: str,
    status: PostingStatus,
    skills: list[tuple[str, str, str, float]],
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
    for skill, category, requirement_type, confidence in skills:
        session.add(
            PostingSkill(
                posting_id=posting.id,
                skill=skill,
                category=category,
                requirement_type=requirement_type,
                confidence=confidence,
                match_reason="test",
            )
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
            skills=[
                ("Python", "language", "required", 1.0),
                ("AWS", "infra", "unspecified", 1.0),
                ("Go", "language", "required", 0.5),
            ],
        )
        _add_posting(
            session, company, source, "2",
            career_type="experienced", status=PostingStatus.OPEN,
            skills=[("Python", "language", "preferred", 1.0)],
        )
        _add_posting(
            session, company, source, "3",
            career_type="new_comer", status=PostingStatus.CLOSED,
            skills=[("Python", "language", "required", 1.0)],
        )
        session.commit()

    reader = DatabaseSkillStatsReader(session_factory=factory)

    # closed posting is excluded, so Python appears in 2 open postings.
    everything = reader.stats()
    assert everything[0] == {
        "skill": "Python",
        "category": "language",
        "count": 2,
        "required_count": 1,
        "preferred_count": 1,
        "unspecified_count": 0,
    }
    assert {
        "skill": "AWS",
        "category": "infra",
        "count": 1,
        "required_count": 0,
        "preferred_count": 0,
        "unspecified_count": 1,
    } in everything
    assert not any(item["skill"] == "Go" for item in everything)

    # career_type filter narrows to the single new_comer open posting.
    newcomer = reader.stats(career_type="new_comer")
    assert {
        "skill": "Python",
        "category": "language",
        "count": 1,
        "required_count": 1,
        "preferred_count": 0,
        "unspecified_count": 0,
    } in newcomer
    assert {
        "skill": "AWS",
        "category": "infra",
        "count": 1,
        "required_count": 0,
        "preferred_count": 0,
        "unspecified_count": 1,
    } in newcomer

    # Category selects postings containing confirmed infra evidence, then
    # aggregates every confirmed skill from those postings.
    infra_market = reader.stats(category="infra")
    assert {
        "skill": "Python",
        "category": "language",
        "count": 1,
        "required_count": 1,
        "preferred_count": 0,
        "unspecified_count": 0,
    } in infra_market
    assert {
        "skill": "AWS",
        "category": "infra",
        "count": 1,
        "required_count": 0,
        "preferred_count": 0,
        "unspecified_count": 1,
    } in infra_market
    assert not any(item["count"] == 2 for item in infra_market)
    assert reader.stats(category="ai") == []
