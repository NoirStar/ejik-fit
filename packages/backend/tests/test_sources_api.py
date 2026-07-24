from datetime import datetime, timedelta, timezone

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ejikfit.api.app import create_app
from ejikfit.api.sources import OfficialDunamuJobsReader, source_activity_status
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PolicyStatus,
    PostingStatus,
    SourceStatus,
    SourceType,
)


class FakeSourceDirectoryReader:
    def list(self) -> list[dict]:
        return [
            {
                "company_name": "네이버",
                "company_slug": "naver",
                "homepage_url": "https://www.navercorp.com",
                "careers_url": "https://recruit.navercorp.com",
                "collection_status": "collecting",
                "activity_status": "active",
                "preparation_reason": None,
                "open_postings": 12,
                "last_success_at": datetime(
                    2026,
                    7,
                    15,
                    3,
                    20,
                    tzinfo=timezone.utc,
                ),
                "last_error_reason": "이 내부 운영 정보는 공개하면 안 됩니다.",
            }
        ]


class FakeDunamuJobsReader:
    def read(self) -> dict:
        return {
            "content": {
                "jobBoardName": "Dunamu",
                "jobNoticeResponses": [
                    {
                        "id": 588,
                        "name": "Frontend Engineer",
                        "jobGroupCode": "T_ENGINEERING",
                        "experienceLevel": "EXPERIENCED",
                        "employmentType": "FULL_TIME",
                    }
                ],
            },
            "statusCode": 200,
        }


def test_public_source_directory_exposes_only_safe_company_fields() -> None:
    client = TestClient(
        create_app(source_directory_reader=FakeSourceDirectoryReader())
    )

    response = client.get("/api/sources")

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "company_name": "네이버",
                "company_slug": "naver",
                "homepage_url": "https://www.navercorp.com",
                "careers_url": "https://recruit.navercorp.com",
                "collection_status": "collecting",
                "activity_status": "active",
                "preparation_reason": None,
                "open_postings": 12,
                "last_success_at": "2026-07-15T03:20:00Z",
            }
        ],
        "total": 1,
        "collecting_count": 1,
        "preparing_count": 0,
        "open_postings": 12,
    }


def test_source_activity_status_distinguishes_quiet_and_stale_sources() -> None:
    now = datetime(2026, 7, 24, 3, 0, tzinfo=timezone.utc)

    assert source_activity_status(
        collection_status="collecting",
        open_postings=4,
        last_success_at=now - timedelta(hours=2),
        now=now,
    ) == "active"
    assert source_activity_status(
        collection_status="collecting",
        open_postings=0,
        last_success_at=now - timedelta(hours=2),
        now=now,
    ) == "quiet"
    assert source_activity_status(
        collection_status="collecting",
        open_postings=0,
        last_success_at=now - timedelta(hours=48),
        now=now,
    ) == "quiet"
    assert source_activity_status(
        collection_status="collecting",
        open_postings=0,
        last_success_at=now - timedelta(hours=49),
        now=now,
    ) == "attention"
    assert source_activity_status(
        collection_status="collecting",
        open_postings=1,
        last_success_at=(now - timedelta(hours=49)).replace(tzinfo=None),
        now=now,
    ) == "attention"
    assert source_activity_status(
        collection_status="preparing",
        open_postings=0,
        last_success_at=None,
        now=now,
    ) == "preparing"


def test_dunamu_current_jobs_proxy_exposes_only_fixed_official_payload() -> None:
    client = TestClient(
        create_app(
            source_directory_reader=FakeSourceDirectoryReader(),
            dunamu_jobs_reader=FakeDunamuJobsReader(),
        )
    )

    response = client.get("/api/sources/dunamu/current-jobs")

    assert response.status_code == 200
    assert response.headers["cache-control"] == (
        "public, s-maxage=300, stale-while-revalidate=900"
    )
    assert response.json()["content"]["jobNoticeResponses"][0]["id"] == 588


def test_official_dunamu_jobs_reader_calls_only_the_allowlisted_api() -> None:
    requested_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested_urls.append(str(request.url))
        return httpx.Response(
            200,
            json=FakeDunamuJobsReader().read(),
        )

    reader = OfficialDunamuJobsReader(
        transport=httpx.MockTransport(handler),
    )

    payload = reader.read()

    assert payload["statusCode"] == 200
    assert requested_urls == [
        "https://careers.dunamu.com/api/job-boards/"
        "jd0wjv/job-notices?lang=ko"
    ]


def test_database_source_directory_groups_companies_and_hides_blocked_sources() -> None:
    from ejikfit.api.sources import DatabaseSourceDirectoryReader

    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)

    with Session(engine) as session:
        naver = Company(
            name="네이버",
            slug="naver",
            homepage_url="https://www.navercorp.com",
        )
        naver_source = CareerSource(
            company=naver,
            base_url="https://recruit.navercorp.com/rcrt/list.do",
            source_type=SourceType.NAVER_JSON,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
            last_success_at=now,
        )
        hyundai = Company(
            name="현대자동차",
            slug="hyundai-motor",
            homepage_url="https://www.hyundai.com",
        )
        hyundai_source = CareerSource(
            company=hyundai,
            base_url="https://talent.hyundai.com/apply/list.hc",
            source_type=SourceType.HTML_LISTING_DETAIL,
            status=SourceStatus.NEEDS_CONNECTOR,
            policy_status=PolicyStatus.ALLOWED,
        )
        nexon = Company(
            name="넥슨",
            slug="nexon",
            homepage_url="https://www.nexon.com",
        )
        nexon_source = CareerSource(
            company=nexon,
            base_url="https://careers.nexon.com/",
            source_type=SourceType.BROWSER_PUBLIC_RENDER,
            status=SourceStatus.NEEDS_BROWSER,
            policy_status=PolicyStatus.ALLOWED,
        )
        blocked = Company(name="비공개 운영 대상", slug="blocked-company")
        blocked_source = CareerSource(
            company=blocked,
            base_url="https://blocked.example.com/jobs",
            source_type=SourceType.JSON_LD,
            status=SourceStatus.BLOCKED,
            policy_status=PolicyStatus.BLOCKED,
        )
        session.add_all(
            [naver_source, hyundai_source, nexon_source, blocked_source]
        )
        session.flush()
        session.add_all(
            [
                JobPosting(
                    company=naver,
                    source=naver_source,
                    external_id="open-1",
                    url="https://recruit.navercorp.com/jobs/1",
                    title="Backend Engineer",
                    status=PostingStatus.OPEN,
                ),
                JobPosting(
                    company=naver,
                    source=naver_source,
                    external_id="closed-1",
                    url="https://recruit.navercorp.com/jobs/2",
                    title="Closed Role",
                    status=PostingStatus.CLOSED,
                ),
            ]
        )
        session.commit()

    items = DatabaseSourceDirectoryReader(
        session_factory=factory,
        now_factory=lambda: now + timedelta(hours=2),
    ).list()

    assert items == [
        {
            "company_name": "네이버",
            "company_slug": "naver",
            "homepage_url": "https://www.navercorp.com",
            "careers_url": "https://recruit.navercorp.com/rcrt/list.do",
            "collection_status": "collecting",
            "activity_status": "active",
            "preparation_reason": None,
            "open_postings": 1,
            # SQLite drops timezone information for DateTime columns.
            "last_success_at": now.replace(tzinfo=None),
        },
        {
            "company_name": "넥슨",
            "company_slug": "nexon",
            "homepage_url": "https://www.nexon.com",
            "careers_url": "https://careers.nexon.com/",
            "collection_status": "preparing",
            "activity_status": "preparing",
            "preparation_reason": "access_limited",
            "open_postings": 0,
            "last_success_at": None,
        },
        {
            "company_name": "현대자동차",
            "company_slug": "hyundai-motor",
            "homepage_url": "https://www.hyundai.com",
            "careers_url": "https://talent.hyundai.com/apply/list.hc",
            "collection_status": "preparing",
            "activity_status": "preparing",
            "preparation_reason": "connector_pending",
            "open_postings": 0,
            "last_success_at": None,
        },
    ]


def test_company_activity_uses_only_runnable_source_success_time() -> None:
    from ejikfit.api.sources import DatabaseSourceDirectoryReader

    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    now = datetime(2026, 7, 24, tzinfo=timezone.utc)
    runnable_success = now - timedelta(hours=72)

    with Session(engine) as session:
        company = Company(name="복수 소스 기업", slug="multi-source")
        session.add_all(
            [
                CareerSource(
                    company=company,
                    base_url="https://a.example.com/jobs",
                    source_type=SourceType.JSON_LD,
                    status=SourceStatus.ALLOWED,
                    policy_status=PolicyStatus.ALLOWED,
                    last_success_at=runnable_success,
                ),
                CareerSource(
                    company=company,
                    base_url="https://b.example.com/jobs",
                    source_type=SourceType.HTML_LISTING_DETAIL,
                    status=SourceStatus.NEEDS_CONNECTOR,
                    policy_status=PolicyStatus.ALLOWED,
                    last_success_at=now,
                ),
            ]
        )
        session.commit()

    items = DatabaseSourceDirectoryReader(
        session_factory=factory,
        now_factory=lambda: now,
    ).list()

    assert len(items) == 1
    assert items[0]["collection_status"] == "collecting"
    assert items[0]["activity_status"] == "attention"
    assert items[0]["last_success_at"] == runnable_success.replace(tzinfo=None)
