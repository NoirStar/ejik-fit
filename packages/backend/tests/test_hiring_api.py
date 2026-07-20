from datetime import date, datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ejikfit.api.app import create_app
from ejikfit.api.hiring import DatabaseHiringOverviewReader
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PostingStatus,
    SourceStatus,
    SourceType,
)


class FakeHiringOverviewReader:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def overview(
        self,
        *,
        start: date,
        end: date,
        activity_days: int,
        limit: int,
        now: datetime,
    ) -> dict:
        self.calls.append(
            {
                "start": start,
                "end": end,
                "activity_days": activity_days,
                "limit": limit,
                "now": now,
            }
        )
        return {
            "range_start": start,
            "range_end": end,
            "activity_since": now,
            "deadline_total": 1,
            "closing_next_7_days": 1,
            "undated_open_postings": 3,
            "activity_company_total": 1,
            "deadlines": [
                {
                    "id": "00000000-0000-0000-0000-000000000001",
                    "title": "백엔드 개발자",
                    "company_name": "테스트 기업",
                    "company_slug": "test-company",
                    "status": "open",
                    "source_url": "https://example.com/jobs/1",
                    "last_verified_at": now,
                    "closes_at": datetime(
                        2026,
                        7,
                        31,
                        14,
                        59,
                        tzinfo=timezone.utc,
                    ),
                }
            ],
            "activities": [
                {
                    "company_name": "테스트 기업",
                    "company_slug": "test-company",
                    "new_postings": 2,
                    "latest_first_seen_at": now,
                    "nearest_deadline_at": None,
                }
            ],
        }


def test_hiring_overview_api_validates_and_forwards_the_range() -> None:
    reader = FakeHiringOverviewReader()
    client = TestClient(create_app(hiring_overview_reader=reader))

    response = client.get(
        "/api/hiring/overview"
        "?start=2026-07-01&end=2026-08-01&activity_days=14&limit=120"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["deadline_total"] == 1
    assert body["closing_next_7_days"] == 1
    assert body["undated_open_postings"] == 3
    assert body["activity_company_total"] == 1
    assert body["deadlines"][0]["company_slug"] == "test-company"
    assert body["activities"][0]["new_postings"] == 2
    assert reader.calls[0]["start"] == date(2026, 7, 1)
    assert reader.calls[0]["end"] == date(2026, 8, 1)
    assert reader.calls[0]["activity_days"] == 14
    assert reader.calls[0]["limit"] == 120
    assert response.headers["cache-control"] == (
        "public, s-maxage=300, stale-while-revalidate=900"
    )

    invalid = client.get(
        "/api/hiring/overview?start=2026-07-01&end=2026-10-01"
    )
    assert invalid.status_code == 422
    assert len(reader.calls) == 1


def test_database_hiring_overview_uses_real_deadlines_and_first_seen_activity() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    now = datetime(2026, 7, 20, 3, tzinfo=timezone.utc)

    with Session(engine) as session:
        active_company = Company(name="활동 기업", slug="active-company")
        quiet_company = Company(name="조용한 기업", slug="quiet-company")
        active_source = CareerSource(
            company=active_company,
            base_url="https://active.example.com/jobs",
            source_type=SourceType.JSON_LD,
            status=SourceStatus.ALLOWED,
        )
        quiet_source = CareerSource(
            company=quiet_company,
            base_url="https://quiet.example.com/jobs",
            source_type=SourceType.JSON_LD,
            status=SourceStatus.ALLOWED,
        )
        session.add_all([active_source, quiet_source])
        session.flush()

        def posting(
            company: Company,
            source: CareerSource,
            external_id: str,
            *,
            first_seen_at: datetime,
            closes_at: datetime | None,
            status: PostingStatus = PostingStatus.OPEN,
        ) -> JobPosting:
            return JobPosting(
                company=company,
                source=source,
                external_id=external_id,
                url=f"https://example.com/jobs/{external_id}",
                title=f"공고 {external_id}",
                status=status,
                first_seen_at=first_seen_at,
                last_seen_at=now,
                last_verified_at=now,
                closes_at=closes_at,
            )

        session.add_all(
            [
                posting(
                    active_company,
                    active_source,
                    "inside",
                    first_seen_at=datetime(
                        2026,
                        7,
                        19,
                        tzinfo=timezone.utc,
                    ),
                    closes_at=datetime(
                        2026,
                        7,
                        25,
                        tzinfo=timezone.utc,
                    ),
                ),
                posting(
                    active_company,
                    active_source,
                    "undated",
                    first_seen_at=datetime(
                        2026,
                        7,
                        18,
                        tzinfo=timezone.utc,
                    ),
                    closes_at=None,
                ),
                posting(
                    active_company,
                    active_source,
                    "closed",
                    first_seen_at=datetime(
                        2026,
                        7,
                        19,
                        tzinfo=timezone.utc,
                    ),
                    closes_at=datetime(
                        2026,
                        7,
                        26,
                        tzinfo=timezone.utc,
                    ),
                    status=PostingStatus.CLOSED,
                ),
                posting(
                    quiet_company,
                    quiet_source,
                    "old",
                    first_seen_at=datetime(
                        2026,
                        6,
                        1,
                        tzinfo=timezone.utc,
                    ),
                    closes_at=datetime(
                        2026,
                        8,
                        1,
                        15,
                        tzinfo=timezone.utc,
                    ),
                ),
            ]
        )
        session.commit()

    result = DatabaseHiringOverviewReader(session_factory=factory).overview(
        start=date(2026, 7, 1),
        end=date(2026, 8, 1),
        activity_days=14,
        limit=100,
        now=now,
    )

    assert result["deadline_total"] == 1
    assert [item["title"] for item in result["deadlines"]] == ["공고 inside"]
    assert result["closing_next_7_days"] == 1
    assert result["undated_open_postings"] == 1
    assert result["activity_company_total"] == 1
    assert result["activities"] == [
        {
            "company_name": "활동 기업",
            "company_slug": "active-company",
            "new_postings": 2,
            "latest_first_seen_at": datetime(2026, 7, 19),
            "nearest_deadline_at": datetime(2026, 7, 25),
        }
    ]
