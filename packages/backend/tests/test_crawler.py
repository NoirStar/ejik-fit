import asyncio
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit import crawler
from ejikfit.config import Settings
from ejikfit.crawler import contains_access_challenge, next_missing_state
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PostingStatus,
    SourceStatus,
    SourceType,
)
from ejikfit.storage import MemorySnapshotStore


def test_failed_listing_never_advances_missing_counter() -> None:
    assert next_missing_state(
        2,
        successful_listing=False,
        seen=False,
    ) == (2, PostingStatus.OPEN)


def test_three_successful_absences_close_posting() -> None:
    assert next_missing_state(
        0,
        successful_listing=True,
        seen=False,
    ) == (1, PostingStatus.OPEN)
    assert next_missing_state(
        1,
        successful_listing=True,
        seen=False,
    ) == (2, PostingStatus.OPEN)
    assert next_missing_state(
        2,
        successful_listing=True,
        seen=False,
    ) == (3, PostingStatus.CLOSED)


def test_seen_posting_resets_counter() -> None:
    assert next_missing_state(
        2,
        successful_listing=True,
        seen=True,
    ) == (0, PostingStatus.OPEN)


def test_access_challenge_detection_avoids_job_description_false_positive() -> None:
    assert contains_access_challenge(
        "<p>CAPTCHA abuse detection experience is preferred.</p>"
    ) is False
    assert contains_access_challenge(
        '<div class="g-recaptcha">verify you are human</div>'
    ) is True


def test_crawl_all_continues_after_one_source_failure_and_preserves_labels(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        crawler,
        "_allowed_sources",
        lambda: [
            crawler.SourceRunTarget("first", "네이버 / naver_json"),
            crawler.SourceRunTarget("second", "카카오 / kakao_json"),
        ],
    )

    def fake_run(source_id: str) -> dict[str, int]:
        if source_id == "first":
            return {
                "discovered": 0,
                "ingested": 0,
                "failed": 1,
                "closed": 0,
            }
        return {
            "discovered": 2,
            "ingested": 2,
            "failed": 0,
            "closed": 0,
        }

    monkeypatch.setattr(crawler, "run_source_by_id", fake_run)

    report = crawler.run_all_sources()

    assert report["sources"] == 2
    assert report["failed"] == 1
    assert report["ingested"] == 2
    assert [item["source_id"] for item in report["results"]] == [
        "first",
        "second",
    ]
    assert [item["source_label"] for item in report["results"]] == [
        "네이버 / naver_json",
        "카카오 / kakao_json",
    ]
    assert (
        "| 네이버 / naver_json | 0 | 0 | 1 | 0 |"
        in crawler.render_crawl_summary(report)
    )


def test_crawl_all_prints_source_progress(monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        crawler,
        "_allowed_sources",
        lambda: [crawler.SourceRunTarget("first", "네이버 / naver_json")],
    )
    monkeypatch.setattr(
        crawler,
        "run_source_by_id",
        lambda source_id: {
            "discovered": 1,
            "ingested": 1,
            "failed": 0,
            "closed": 0,
        },
    )

    report = crawler.run_all_sources()
    output = capsys.readouterr().out

    assert "crawl source 1/1 started: 네이버 / naver_json" in output
    assert (
        "crawl source 1/1 finished: 네이버 / naver_json "
        "discovered=1 ingested=1 failed=0 closed=0"
    ) in output
    assert isinstance(report["results"][0]["elapsed_seconds"], float)


class StaticFetcher:
    def __init__(self, text: str) -> None:
        self.text = text

    async def fetch(self, url: str) -> crawler.FetchedPage:
        return crawler.FetchedPage(
            url=url,
            text=self.text,
            status_code=200,
            headers={},
        )


def test_crawl_source_routes_naver_json_into_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="네이버", slug="naver")
        session.add(company)
        session.flush()
        source = CareerSource(
            company_id=company.id,
            base_url="https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
            source_type=SourceType.NAVER_JSON,
            status=SourceStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher(
                    '{"list":[{"annoId":1001,'
                    '"annoSubject":"Backend Engineer",'
                    '"jobDetailLink":"https://recruit.navercorp.com/rcrt/view.do?annoId=1001"}]}'
                ),
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 9, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert postings[0].external_id == "1001"
        assert postings[0].title == "Backend Engineer"


def test_postgres_crawler_does_not_construct_meilisearch() -> None:
    settings = Settings(search_backend="postgres")

    assert crawler._posting_index(settings) is None
