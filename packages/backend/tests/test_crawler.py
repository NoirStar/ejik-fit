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
    PolicyStatus,
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


class BlockedFetcher:
    async def fetch(self, url: str) -> crawler.FetchedPage:
        raise crawler.BlockedSourceError("source denied access with 403")


class TemporaryFailureFetcher:
    async def fetch(self, url: str) -> crawler.FetchedPage:
        raise crawler.RetryableFetchError("temporary upstream status 503")


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def test_crawl_source_routes_naver_json_into_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 9, tzinfo=timezone.utc)

    with Session(engine) as session:
        company = Company(name="네이버", slug="naver")
        session.add(company)
        session.flush()
        source = CareerSource(
            company_id=company.id,
            base_url="https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
            source_type=SourceType.NAVER_JSON,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
            last_error_code="temporary_fetch_error",
            last_error_reason="previous failure",
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
                now=now,
                request_delay_seconds=0,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert postings[0].external_id == "1001"
        assert postings[0].title == "Backend Engineer"
        assert source.last_success_at is not None
        assert source.last_discovered_at is not None
        assert _as_utc(source.last_success_at) == now
        assert _as_utc(source.last_discovered_at) == now
        assert source.last_error_code is None
        assert source.last_error_reason is None


def test_blocked_listing_marks_source_blocked_without_closing_postings() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="테스트 기업", slug="test-company")
        source = CareerSource(
            company=company,
            base_url="https://example.com/careers",
            source_type=SourceType.JSON_LD,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        posting = JobPosting(
            company=company,
            source=source,
            external_id="existing",
            url="https://example.com/jobs/existing",
            title="Backend Engineer",
            missing_runs=2,
        )
        session.add(posting)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=BlockedFetcher(),
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 9, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        assert result.failed == 1
        assert source.status == SourceStatus.BLOCKED
        assert source.policy_status == PolicyStatus.BLOCKED
        assert source.last_error_code == "blocked"
        assert "403" in (source.last_error_reason or "")
        assert posting.missing_runs == 2
        assert posting.status == PostingStatus.OPEN


def test_temporary_listing_failure_records_error_without_blocking_source() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="테스트 기업", slug="test-company")
        source = CareerSource(
            company=company,
            base_url="https://example.com/careers",
            source_type=SourceType.JSON_LD,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        posting = JobPosting(
            company=company,
            source=source,
            external_id="existing",
            url="https://example.com/jobs/existing",
            title="Backend Engineer",
            missing_runs=2,
        )
        session.add(posting)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=TemporaryFailureFetcher(),
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 9, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        assert result.failed == 1
        assert source.status == SourceStatus.ALLOWED
        assert source.policy_status == PolicyStatus.ALLOWED
        assert source.last_error_code == "temporary_fetch_error"
        assert "503" in (source.last_error_reason or "")
        assert posting.missing_runs == 2
        assert posting.status == PostingStatus.OPEN


def test_unsupported_allowed_connector_fails_without_closing_postings() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="현대자동차", slug="hyundai-motor")
        source = CareerSource(
            company=company,
            base_url="https://talent.hyundai.com/eng/apply/applyList.hc",
            source_type=SourceType.HTML_LISTING_DETAIL,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        posting = JobPosting(
            company=company,
            source=source,
            external_id="existing",
            url="https://talent.hyundai.com/eng/apply/existing",
            title="Backend Engineer",
            missing_runs=2,
        )
        session.add(posting)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher("<html><body>No parser yet</body></html>"),
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 9, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        assert result.failed == 1
        assert source.status == SourceStatus.NEEDS_CONNECTOR
        assert source.policy_status == PolicyStatus.ALLOWED
        assert source.last_error_code == "unsupported_connector"
        assert "html_listing_detail" in (source.last_error_reason or "")
        assert posting.missing_runs == 2
        assert posting.status == PostingStatus.OPEN


def test_postgres_crawler_does_not_construct_meilisearch() -> None:
    settings = Settings(search_backend="postgres")

    assert crawler._posting_index(settings) is None
