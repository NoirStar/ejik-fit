import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from ejikfit import crawler
from ejikfit.config import Settings
from ejikfit.crawler import contains_access_challenge, next_missing_state
from ejikfit.listing_validation import ListingValidationError, validate_listing_response
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


def test_seen_explicitly_closed_posting_stays_closed() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="테스트 기업", slug="closed-listing")
        source = CareerSource(
            company=company,
            base_url="https://example.com/jobs",
            source_type=SourceType.KAKAO_JSON,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        posting = JobPosting(
            company=company,
            source=source,
            external_id="closed-1",
            url="https://example.com/jobs/closed-1",
            title="Closed Engineer",
            status=PostingStatus.CLOSED,
            missing_runs=2,
        )
        session.add(posting)
        session.commit()

        closed = crawler.reconcile_missing(
            session,
            source.id,
            {"closed-1"},
            successful_listing=True,
        )

        assert closed == 0
        assert posting.missing_runs == 0
        assert posting.status == PostingStatus.CLOSED


def test_access_challenge_detection_avoids_job_description_false_positive() -> None:
    assert contains_access_challenge(
        "<p>CAPTCHA abuse detection experience is preferred.</p>"
    ) is False
    assert contains_access_challenge(
        '<div class="g-recaptcha">verify you are human</div>'
    ) is True


def test_playwright_renderer_uses_domcontentloaded_and_tolerates_networkidle_timeout(
    monkeypatch,
) -> None:
    fake_page = _FakePlaywrightPage()
    fake_module = ModuleType("playwright.async_api")
    fake_module.async_playwright = lambda: _FakePlaywrightManager(fake_page)
    monkeypatch.setitem(sys.modules, "playwright", ModuleType("playwright"))
    monkeypatch.setitem(sys.modules, "playwright.async_api", fake_module)

    result = asyncio.run(
        crawler.PlaywrightBrowserRenderer(
            timeout_ms=20_000,
            settle_timeout_ms=5_000,
        ).render("https://example.com/careers")
    )

    assert fake_page.goto_wait_until == "domcontentloaded"
    assert fake_page.waited_load_states == [("networkidle", 5_000)]
    assert result.url == "https://example.com/rendered"
    assert result.text == "<html><body>Rendered jobs</body></html>"


class _FakePlaywrightResponse:
    def __init__(self, status: int = 200) -> None:
        self.status = status


class _FakePlaywrightPage:
    url = "https://example.com/rendered"

    def __init__(self, response_status: int = 200) -> None:
        self.goto_wait_until: str | None = None
        self.waited_load_states: list[tuple[str, int]] = []
        self.response_status = response_status

    async def goto(
        self,
        url: str,
        *,
        wait_until: str,
        timeout: int,
    ) -> _FakePlaywrightResponse:
        self.goto_wait_until = wait_until
        return _FakePlaywrightResponse(self.response_status)

    async def wait_for_load_state(self, state: str, *, timeout: int) -> None:
        self.waited_load_states.append((state, timeout))
        raise TimeoutError("network never went idle")

    async def content(self) -> str:
        return "<html><body>Rendered jobs</body></html>"


class _FakePlaywrightBrowser:
    def __init__(self, page: _FakePlaywrightPage) -> None:
        self.page = page

    async def new_page(self) -> _FakePlaywrightPage:
        return self.page

    async def close(self) -> None:
        pass


class _FakePlaywrightChromium:
    def __init__(self, page: _FakePlaywrightPage) -> None:
        self.page = page

    async def launch(self, *, headless: bool) -> _FakePlaywrightBrowser:
        return _FakePlaywrightBrowser(self.page)


class _FakePlaywright:
    def __init__(self, page: _FakePlaywrightPage) -> None:
        self.chromium = _FakePlaywrightChromium(page)


class _FakePlaywrightManager:
    def __init__(self, page: _FakePlaywrightPage) -> None:
        self.page = page

    async def __aenter__(self) -> _FakePlaywright:
        return _FakePlaywright(self.page)

    async def __aexit__(self, exc_type, exc, tb) -> None:
        pass


def test_playwright_renderer_rejects_any_browser_4xx(monkeypatch) -> None:
    fake_page = _FakePlaywrightPage(response_status=404)
    fake_module = ModuleType("playwright.async_api")
    fake_module.async_playwright = lambda: _FakePlaywrightManager(fake_page)
    monkeypatch.setitem(sys.modules, "playwright", ModuleType("playwright"))
    monkeypatch.setitem(sys.modules, "playwright.async_api", fake_module)

    with pytest.raises(crawler.RetryableFetchError, match="404"):
        asyncio.run(
            crawler.PlaywrightBrowserRenderer().render(
                "https://example.com/missing"
            )
        )


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


class RecordingFetcher:
    def __init__(self, text: str) -> None:
        self.text = text
        self.calls: list[dict[str, object]] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
    ) -> crawler.FetchedPage:
        self.calls.append(
            {
                "url": url,
                "method": method,
                "json_body": json_body,
                "form_body": form_body,
            }
        )
        return crawler.FetchedPage(
            url=url,
            text=self.text,
            status_code=200,
            headers={},
        )


class PaginatedLgeFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
    ) -> crawler.FetchedPage:
        self.urls.append(url)
        page = 2 if "page=2" in url else 1
        jobs = (
            [
                {"id": "lge-1", "title": "Platform Engineer"},
                {"id": "lge-2", "title": "Data Engineer"},
            ]
            if page == 1
            else [{"id": "lge-3", "title": "Cloud Engineer"}]
        )
        return crawler.FetchedPage(
            url=url,
            text=json.dumps(
                {
                    "successOrNot": "Y",
                    "statusCode": "SUCCESS",
                    "data": {
                        "total": 3,
                        "size": len(jobs),
                        "pageSize": 2,
                        "pageNum": page,
                        "pages": 2,
                        "nextPage": 2 if page == 1 else 0,
                        "hasNextPage": page == 1,
                        "isLastPage": page == 2,
                        "list": jobs,
                    },
                }
            ),
            status_code=200,
            headers={},
        )


class StaticBrowserRenderer:
    def __init__(self, text: str) -> None:
        self.text = text
        self.rendered_urls: list[str] = []

    async def render(self, url: str) -> crawler.FetchedPage:
        self.rendered_urls.append(url)
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


@pytest.mark.parametrize(
    ("source_status", "policy_status"),
    [
        (SourceStatus.ALLOWED, PolicyStatus.REVIEW),
        (SourceStatus.ALLOWED, PolicyStatus.BLOCKED),
        (SourceStatus.ALLOWED, PolicyStatus.STOPPED),
        (SourceStatus.STOPPED, PolicyStatus.ALLOWED),
    ],
)
def test_non_runnable_source_never_fetches(
    source_status: SourceStatus,
    policy_status: PolicyStatus,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="정책 테스트", slug="policy-test")
        source = CareerSource(
            company=company,
            base_url="https://example.com/jobs",
            source_type=SourceType.ENTERPRISE_JSON,
            status=source_status,
            policy_status=policy_status,
        )
        session.add(source)
        session.commit()
        fetcher = RecordingFetcher('{"data":{"jobs":[]}}')

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=fetcher,
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 15, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        assert result == crawler.CrawlResult()
        assert fetcher.calls == []


def test_crawl_all_targets_require_source_and_policy_allowed(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        for index, (source_status, policy_status) in enumerate(
            [
                (SourceStatus.ALLOWED, PolicyStatus.ALLOWED),
                (SourceStatus.ALLOWED, PolicyStatus.BLOCKED),
                (SourceStatus.ALLOWED, PolicyStatus.STOPPED),
                (SourceStatus.REVIEW, PolicyStatus.ALLOWED),
            ]
        ):
            company = Company(name=f"기업 {index}", slug=f"company-{index}")
            session.add(
                CareerSource(
                    company=company,
                    base_url=f"https://example.com/jobs/{index}",
                    source_type=SourceType.ENTERPRISE_JSON,
                    status=source_status,
                    policy_status=policy_status,
                )
            )
        session.commit()

    monkeypatch.setattr(crawler, "SessionLocal", sessionmaker(bind=engine))

    targets = crawler._allowed_sources()

    assert [target.label for target in targets] == [
        "기업 0 / enterprise_json"
    ]


def test_fetch_listing_page_uses_source_post_json_request_options() -> None:
    company = Company(name="LG CNS", slug="lg-cns")
    source = CareerSource(
        company=company,
        base_url="https://api.careers.lg.com/rmk/job/retrieveJobNoticesList",
        source_type=SourceType.ENTERPRISE_JSON,
        request_method="POST",
        request_body={"companyCodeList": ["CNS"]},
    )
    fetcher = RecordingFetcher('{"data":{"jobNoticeList":[]}}')

    page = asyncio.run(crawler._fetch_listing_page(source, fetcher, None))

    assert page.url == source.base_url
    assert fetcher.calls == [
        {
            "url": "https://api.careers.lg.com/rmk/job/retrieveJobNoticesList",
            "method": "POST",
            "json_body": {"companyCodeList": ["CNS"]},
            "form_body": None,
        }
    ]


def test_fetch_listing_page_collects_every_lg_electronics_page() -> None:
    source = CareerSource(
        company=Company(name="LG전자", slug="lg-electronics"),
        base_url=(
            "https://globalcareers.lge.com/api/job/v1/jobs/"
            "?page=1&size=2"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
    )
    fetcher = PaginatedLgeFetcher()

    page = asyncio.run(crawler._fetch_listing_page(source, fetcher, None))
    payload = json.loads(page.text)

    assert fetcher.urls == [
        "https://globalcareers.lge.com/api/job/v1/jobs/?page=1&size=2",
        "https://globalcareers.lge.com/api/job/v1/jobs/?page=2&size=2",
    ]
    assert [job["id"] for job in payload["data"]["list"]] == [
        "lge-1",
        "lge-2",
        "lge-3",
    ]
    assert payload["data"]["nextPage"] == 0
    openings = crawler._parse_listing_openings(
        source.source_type,
        page.text,
        page.url,
    )
    assert validate_listing_response(
        source.source_type,
        page.text,
        page.url,
        openings_count=len(openings),
    )


def test_fetch_listing_page_uses_form_body_for_html_post_sources() -> None:
    company = Company(name="삼성SDS", slug="samsung-sds")
    source = CareerSource(
        company=company,
        base_url="https://www.samsungcareers.com/hr/list.data",
        source_type=SourceType.HTML_LISTING_DETAIL,
        request_method="POST",
        request_body={"currentPageNo": "1", "strCompany": "C60"},
    )
    fetcher = RecordingFetcher("<div class='noData'></div>")

    page = asyncio.run(crawler._fetch_listing_page(source, fetcher, None))

    assert page.url == source.base_url
    assert fetcher.calls == [
        {
            "url": "https://www.samsungcareers.com/hr/list.data",
            "method": "POST",
            "json_body": None,
            "form_body": {"currentPageNo": "1", "strCompany": "C60"},
        }
    ]


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


@pytest.mark.parametrize(
    "payload",
    [
        '{"error":"maintenance"}',
        '{"data":[],"message":"maintenance","statusCode":503}',
        '{"isSuccess":false,"errorMessage":"maintenance","data":[]}',
        '{"data":{"statusCode":503,"list":[]}}',
        '{"data":[],"message":"maintenance"}',
        '{"status":"F","msg":"maintenance","jobNoticeList":[]}',
        '{"status":500,"data":{"list":[]}}',
        '{"items":[]}',
        '{"list":[]}',
    ],
)
def test_unknown_success_payload_is_a_parse_failure_and_never_closes(
    payload: str,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="테스트 기업", slug="unknown-payload")
        source = CareerSource(
            company=company,
            base_url="https://example.com/api/jobs",
            source_type=SourceType.ENTERPRISE_JSON,
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
                fetcher=StaticFetcher(payload),
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 15, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        assert result.failed == 1
        assert source.last_error_code == "listing_parse_error"
        assert source.last_success_at is None
        assert posting.missing_runs == 2
        assert posting.status == PostingStatus.OPEN


def test_unexpected_parser_exception_is_persisted_as_a_source_error() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="테스트 기업", slug="overflow-parser")
        source = CareerSource(
            company=company,
            base_url="https://api.lever.co/v0/postings/example",
            source_type=SourceType.LEVER_GREENHOUSE,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        payload = json.dumps(
            [
                {
                    "id": "job-1",
                    "text": "Platform Engineer",
                    "hostedUrl": "https://jobs.example.com/job-1",
                    "createdAt": 10**100,
                }
            ]
        )

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher(payload),
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 15, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        assert result.failed == 1
        assert source.last_error_code == "listing_parse_error"
        assert "timestamp" in (source.last_error_reason or "").lower()


def test_filtered_total_proves_hanwha_listing_is_complete() -> None:
    payload = {
        "data": {
            "filteredCount": 23,
            "totalCount": 70,
            "hasNext": False,
            "page": 0,
            "size": 100,
            "list": [{"id": index} for index in range(23)],
        }
    }

    assert validate_listing_response(
        SourceType.ENTERPRISE_JSON,
        json.dumps(payload),
        "https://example.com/jobs?page=0&size=100",
        openings_count=23,
    )


def test_page_only_listing_is_partial_and_query_keys_are_case_insensitive() -> None:
    payload = json.dumps({"jobs": [{"id": "job-1"}]})

    assert not validate_listing_response(
        SourceType.ENTERPRISE_JSON,
        payload,
        "https://example.com/jobs?PAGENO=1",
        openings_count=1,
    )
    assert validate_listing_response(
        SourceType.ENTERPRISE_JSON,
        payload,
        "https://example.com/jobs?PAGENO=1&ROWNO=100",
        openings_count=1,
    )
    assert not validate_listing_response(
        SourceType.ENTERPRISE_JSON,
        payload,
        "https://example.com/jobs?page=2&size=20",
        openings_count=1,
    )
    assert not validate_listing_response(
        SourceType.ENTERPRISE_JSON,
        json.dumps(
            {
                "status": 200,
                "data": {
                    "page": 2,
                    "totalPages": 2,
                    "hasNext": False,
                    "list": [{"id": "job-1"}],
                },
            }
        ),
        "https://example.com/jobs",
        openings_count=1,
    )


@pytest.mark.parametrize(
    ("source_type", "payload"),
    [
        (SourceType.NAVER_JSON, '{"jobs":[]}'),
        (SourceType.LINE_GATSBY, '{"list":[]}'),
    ],
)
def test_typed_connectors_reject_empty_collections_from_other_schemas(
    source_type: SourceType,
    payload: str,
) -> None:
    with pytest.raises(ListingValidationError):
        validate_listing_response(
            source_type,
            payload,
            "https://example.com/jobs",
            openings_count=0,
        )


def test_generic_html_empty_class_is_not_job_feed_evidence() -> None:
    with pytest.raises(ListingValidationError):
        validate_listing_response(
            SourceType.HTML_LISTING_DETAIL,
            '<p>maintenance</p><div class="empty"></div>',
            "https://example.com/jobs",
            openings_count=0,
        )

    assert validate_listing_response(
        SourceType.HTML_LISTING_DETAIL,
        '<div class="noData">현재 채용중인 공고가 없습니다.</div>',
        "https://www.samsungcareers.com/hr/list.data",
        openings_count=0,
    )


def test_kakao_total_metadata_proves_the_first_page_is_complete() -> None:
    payload = {
        "jobList": [{"realId": f"job-{index}"} for index in range(7)],
        "totalJobCount": 7,
        "totalPage": 1,
    }

    assert validate_listing_response(
        SourceType.KAKAO_JSON,
        json.dumps(payload),
        "https://careers.kakao.com/public/api/job-list?page=1",
        openings_count=7,
    )


def test_successful_listing_with_only_inactive_jobs_is_a_valid_empty_result() -> None:
    payload = {
        "successOrNot": "Y",
        "statusCode": "SUCCESS",
        "data": {
            "total": 1,
            "list": [
                {
                    "id": "inactive-1",
                    "title": "Inactive Engineer",
                    "status": "OPEN",
                    "active": False,
                    "live": False,
                }
            ],
        },
    }

    assert validate_listing_response(
        SourceType.ENTERPRISE_JSON,
        json.dumps(payload),
        "https://globalcareers.lge.com/api/job/v1/jobs?page=1&size=20",
        openings_count=0,
    )

    assert validate_listing_response(
        SourceType.ENTERPRISE_JSON,
        "list([])",
        (
            "https://recruit.cj.net/recruit/ko/common/common/jobListInfo.fo"
            "?COMPANY=E10&ROWNO=100&PAGENO=1&callback=list"
        ),
        openings_count=0,
    )

    assert validate_listing_response(
        SourceType.ENTERPRISE_JSON,
        json.dumps({"summary": [{"TOT_CNT": 0}], "recuList": []}),
        (
            "https://recruit.posco.com/h22a01-recruit/H22A1000/list"
            "?rowCount=20&pageSize=10&currPage=1&offset=0"
        ),
        openings_count=0,
    )


def test_partial_paginated_listing_ingests_but_never_reconciles_absences() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)

    with Session(engine) as session:
        company = Company(name="LG전자", slug="lg-partial")
        source = CareerSource(
            company=company,
            base_url=(
                "https://globalcareers.lge.com/api/job/v1/jobs/"
                "?page=1&size=20"
            ),
            source_type=SourceType.ENTERPRISE_JSON,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        missing_posting = JobPosting(
            company=company,
            source=source,
            external_id="existing",
            url="https://globalcareers.lge.com/jobs/existing",
            title="Existing Engineer",
            missing_runs=2,
        )
        session.add(missing_posting)
        session.commit()
        payload = {
            "successOrNot": "Y",
            "statusCode": "SUCCESS",
            "data": {
                "total": 40,
                "list": [
                    {
                        "id": "new-1",
                        "title": "New Platform Engineer",
                        "status": "OPEN",
                        "active": True,
                        "live": True,
                    }
                ],
            },
        }

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher(json.dumps(payload)),
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        assert result.discovered == 1
        assert result.ingested == 1
        assert result.failed == 1
        assert result.closed == 0
        assert source.last_error_code == "incomplete_listing"
        assert source.last_success_at is None
        assert missing_posting.missing_runs == 2
        assert missing_posting.status == PostingStatus.OPEN


def test_unsupported_allowed_browser_connector_fails_without_closing_postings() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="현대자동차", slug="hyundai-motor")
        source = CareerSource(
            company=company,
            base_url="https://careers.example.com/rendered",
            source_type=SourceType.BROWSER_PUBLIC_RENDER,
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
        assert source.status == SourceStatus.NEEDS_BROWSER
        assert source.policy_status == PolicyStatus.ALLOWED
        assert source.last_error_code == "unsupported_connector"
        assert "browser renderer is not configured" in (
            source.last_error_reason or ""
        )
        assert posting.missing_runs == 2
        assert posting.status == PostingStatus.OPEN


def test_crawl_source_routes_browser_public_render_into_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 9, tzinfo=timezone.utc)
    renderer = StaticBrowserRenderer(
        """
        <article>
          <a href="/jobs/rendered-backend">Rendered Backend Engineer</a>
          <p>정규직 · 경력 · 서울</p>
        </article>
        """
    )

    with Session(engine) as session:
        company = Company(name="브라우저 기업", slug="browser-company")
        source = CareerSource(
            company=company,
            base_url="https://careers.example.com/careers",
            source_type=SourceType.BROWSER_PUBLIC_RENDER,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
            last_error_code="unsupported_connector",
            last_error_reason="previous missing renderer",
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher("ordinary fetch should not be used"),
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
                browser_renderer=renderer,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert renderer.rendered_urls == ["https://careers.example.com/careers"]
        assert result.discovered == 1
        assert result.ingested == 1
        assert postings[0].external_id == "rendered-backend"
        assert postings[0].title == "Rendered Backend Engineer"
        assert postings[0].url == "https://careers.example.com/jobs/rendered-backend"
        assert source.status == SourceStatus.ALLOWED
        assert source.last_error_code is None
        assert source.last_error_reason is None
        assert source.last_success_at is not None


def test_crawl_source_routes_static_next_data_into_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 9, tzinfo=timezone.utc)

    with Session(engine) as session:
        company = Company(name="LG CNS", slug="lg-cns")
        source = CareerSource(
            company=company,
            base_url="https://careers.lg.com/apply?c=CNS",
            source_type=SourceType.STATIC_NEXT_DATA,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher(
                    json.dumps(
                        {
                            "props": {
                                "pageProps": {
                                    "jobs": [
                                        {
                                            "id": "LG-CNS-200",
                                            "title": "Cloud Backend Engineer",
                                            "detailUrl": "/apply/jobs/LG-CNS-200",
                                            "location": "서울",
                                            "employmentType": "정규직",
                                            "careerType": "경력",
                                            "isPublic": True,
                                        }
                                    ]
                                }
                            }
                        },
                        ensure_ascii=False,
                    )
                ),
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert postings[0].external_id == "LG-CNS-200"
        assert postings[0].title == "Cloud Backend Engineer"
        assert postings[0].url == "https://careers.lg.com/apply/jobs/LG-CNS-200"
        assert source.last_error_code is None
        assert source.last_success_at is not None


def test_crawl_source_routes_enterprise_json_into_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 9, tzinfo=timezone.utc)

    with Session(engine) as session:
        company = Company(name="테스트 엔터프라이즈", slug="enterprise")
        source = CareerSource(
            company=company,
            base_url="https://careers.example.com/api/jobs",
            source_type=SourceType.ENTERPRISE_JSON,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher(
                    json.dumps(
                        {
                            "data": {
                                "jobs": [
                                    {
                                        "postingId": "ENT-200",
                                        "postingTitle": "Platform Engineer",
                                        "jobDetailUrl": "/jobs/ENT-200",
                                        "workLocation": "서울",
                                        "employmentType": "정규직",
                                        "public": True,
                                    }
                                ]
                            }
                        },
                        ensure_ascii=False,
                    )
                ),
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert postings[0].external_id == "ENT-200"
        assert postings[0].title == "Platform Engineer"
        assert postings[0].url == "https://careers.example.com/jobs/ENT-200"
        assert source.last_error_code is None
        assert source.last_success_at is not None


def test_crawl_source_routes_lever_greenhouse_into_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 9, tzinfo=timezone.utc)

    with Session(engine) as session:
        company = Company(name="테스트 ATS", slug="ats-company")
        source = CareerSource(
            company=company,
            base_url="https://boards.greenhouse.io/acme",
            source_type=SourceType.LEVER_GREENHOUSE,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher(
                    json.dumps(
                        {
                            "jobs": [
                                {
                                    "id": 3300,
                                    "title": "Backend Engineer",
                                    "absolute_url": "https://boards.greenhouse.io/acme/jobs/3300",
                                    "location": {"name": "Seoul"},
                                    "departments": [{"name": "Engineering"}],
                                    "active": True,
                                }
                            ]
                        },
                        ensure_ascii=False,
                    )
                ),
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert postings[0].external_id == "3300"
        assert postings[0].title == "Backend Engineer"
        assert postings[0].url == "https://boards.greenhouse.io/acme/jobs/3300"
        assert source.last_error_code is None
        assert source.last_success_at is not None


def test_crawl_source_routes_workday_into_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 9, tzinfo=timezone.utc)

    with Session(engine) as session:
        company = Company(name="Workday 기업", slug="workday-company")
        source = CareerSource(
            company=company,
            base_url="https://acme.wd1.myworkdayjobs.com/en-US/acme",
            source_type=SourceType.WORKDAY,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher(
                    json.dumps(
                        {
                            "jobPostings": [
                                {
                                    "jobReqId": "JR-300",
                                    "title": "Workday Backend Engineer",
                                    "externalPath": "/en-US/acme/job/JR-300",
                                    "locationsText": "Seoul",
                                    "timeType": "Full time",
                                }
                            ]
                        },
                        ensure_ascii=False,
                    )
                ),
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert postings[0].external_id == "JR-300"
        assert postings[0].title == "Workday Backend Engineer"
        assert postings[0].url == "https://acme.wd1.myworkdayjobs.com/en-US/acme/job/JR-300"
        assert source.last_error_code is None
        assert source.last_success_at is not None


def test_crawl_source_routes_successfactors_into_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 9, tzinfo=timezone.utc)

    with Session(engine) as session:
        company = Company(name="SAP 기업", slug="sap-company")
        source = CareerSource(
            company=company,
            base_url="https://jobs.example.com/career",
            source_type=SourceType.SAP_SUCCESSFACTORS,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher(
                    json.dumps(
                        {
                            "results": [
                                {
                                    "jobReqId": "SF-300",
                                    "externalTitle": "SAP Backend Engineer",
                                    "jobDetailsUrl": "/career/job/SF-300",
                                    "location": "Seoul",
                                    "status": "OPEN",
                                }
                            ]
                        },
                        ensure_ascii=False,
                    )
                ),
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert postings[0].external_id == "SF-300"
        assert postings[0].title == "SAP Backend Engineer"
        assert postings[0].url == "https://jobs.example.com/career/job/SF-300"
        assert source.last_error_code is None
        assert source.last_success_at is not None


def test_crawl_source_routes_html_listing_detail_into_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 9, tzinfo=timezone.utc)

    with Session(engine) as session:
        company = Company(name="현대자동차", slug="hyundai-motor")
        source = CareerSource(
            company=company,
            base_url="https://talent.hyundai.com/eng/apply/applyList.hc",
            source_type=SourceType.HTML_LISTING_DETAIL,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher(
                    """
                    <article>
                      <a href="/eng/apply/detail/backend-1">Backend Engineer</a>
                      <p>정규직 · 경력 · 서울</p>
                      <span>2026.07.01 ~ 2026.07.31</span>
                    </article>
                    """
                ),
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert postings[0].external_id == "backend-1"
        assert postings[0].title == "Backend Engineer"
        assert postings[0].employment_type == "regular"
        assert source.last_error_code is None
        assert source.last_success_at is not None


def test_preview_source_parses_listing_without_persisting_or_mutating() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="현대자동차", slug="hyundai-motor")
        source = CareerSource(
            company=company,
            base_url="https://talent.hyundai.com/eng/apply/applyList.hc",
            source_type=SourceType.HTML_LISTING_DETAIL,
            status=SourceStatus.NEEDS_CONNECTOR,
            policy_status=PolicyStatus.ALLOWED,
            last_error_code="previous_error",
            last_error_reason="previous reason",
        )
        session.add(source)
        session.commit()

        preview = asyncio.run(
            crawler.preview_source(
                source=source,
                fetcher=StaticFetcher(
                    """
                    <article>
                      <a href="/eng/apply/detail/backend-1">Backend Engineer</a>
                      <p>정규직 · 경력 · 서울</p>
                    </article>
                    """
                ),
                sample_limit=3,
            )
        )

        assert preview["source_id"] == str(source.id)
        assert preview["source_label"] == "현대자동차 / html_listing_detail"
        assert preview["source_type"] == "html_listing_detail"
        assert preview["discovered"] == 1
        assert preview["sample_openings"] == [
            {
                "external_id": "backend-1",
                "title": "Backend Engineer",
                "url": "https://talent.hyundai.com/eng/apply/detail/backend-1",
            }
        ]
        assert preview["error"] is None
        assert session.scalars(select(JobPosting)).all() == []
        assert source.status == SourceStatus.NEEDS_CONNECTOR
        assert source.last_error_code == "previous_error"
        assert source.last_error_reason == "previous reason"


def test_preview_source_parses_greeting_listing_without_fetching_details() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    listing_html = (
        Path(__file__).parents[3]
        / "tests"
        / "fixtures"
        / "greeting"
        / "list.html"
    ).read_text()

    with Session(engine) as session:
        company = Company(name="카카오게임즈", slug="kakao-games")
        source = CareerSource(
            company=company,
            base_url="https://recruit.kakaogames.com/ko",
            source_type=SourceType.GREETING,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        fetcher = RecordingFetcher(listing_html)

        preview = asyncio.run(
            crawler.preview_source(
                source=source,
                fetcher=fetcher,
                sample_limit=2,
            )
        )

        assert preview["discovered"] == 2
        assert preview["sample_openings"] == [
            {
                "external_id": "209187",
                "title": "Backend Engineer",
                "url": "https://recruit.kakaogames.com/ko/o/209187",
            },
            {
                "external_id": "205581",
                "title": "Security Engineer",
                "url": "https://recruit.kakaogames.com/ko/o/205581",
            },
        ]
        assert preview["error"] is None
        assert fetcher.calls == [
            {
                "url": "https://recruit.kakaogames.com/ko",
                "method": "GET",
                "json_body": None,
                "form_body": None,
            }
        ]
        assert session.scalars(select(JobPosting)).all() == []


def test_greeting_listing_parse_failure_is_persisted() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="그리팅 실패", slug="greeting-failure")
        source = CareerSource(
            company=company,
            base_url="https://example.com/careers",
            source_type=SourceType.GREETING,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher("<html><body>maintenance</body></html>"),
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 15, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        assert result.failed == 1
        assert source.last_error_code == "listing_parse_error"
        assert source.last_success_at is None


class GreetingDetailBlockedFetcher:
    def __init__(self, listing_html: str) -> None:
        self.listing_html = listing_html
        self.calls = 0

    async def fetch(self, url: str) -> crawler.FetchedPage:
        self.calls += 1
        if self.calls == 1:
            return crawler.FetchedPage(
                url=url,
                text=self.listing_html,
                status_code=200,
                headers={},
            )
        raise crawler.BlockedSourceError("source denied access with 403")


def test_greeting_blocked_detail_never_gets_cleared_by_success() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    listing_html = (
        Path(__file__).parents[3]
        / "tests"
        / "fixtures"
        / "greeting"
        / "list.html"
    ).read_text()
    previous_success = datetime(2026, 7, 1, tzinfo=timezone.utc)

    with Session(engine) as session:
        company = Company(name="그리팅 차단", slug="greeting-blocked")
        source = CareerSource(
            company=company,
            base_url="https://example.com/careers",
            source_type=SourceType.GREETING,
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
            last_success_at=previous_success,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=GreetingDetailBlockedFetcher(listing_html),
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 15, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        assert result.discovered == 2
        assert result.ingested == 0
        assert result.failed == 1
        assert source.status == SourceStatus.BLOCKED
        assert source.policy_status == PolicyStatus.BLOCKED
        assert source.last_error_code == "blocked"
        assert _as_utc(source.last_success_at) == previous_success


def test_preview_source_reports_unsupported_browser_connector_without_mutating() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="LG CNS", slug="lg-cns")
        source = CareerSource(
            company=company,
            base_url="https://careers.example.com/rendered",
            source_type=SourceType.BROWSER_PUBLIC_RENDER,
            status=SourceStatus.NEEDS_BROWSER,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        preview = asyncio.run(
            crawler.preview_source(
                source=source,
                fetcher=StaticFetcher("{}"),
            )
        )

        assert preview["discovered"] == 0
        assert preview["sample_openings"] == []
        assert preview["error"] == {
            "code": "unsupported_connector",
            "reason": "browser renderer is not configured",
        }
        assert source.status == SourceStatus.NEEDS_BROWSER
        assert source.last_error_code is None


def test_preview_source_parses_browser_public_render_without_persisting_or_mutating() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    renderer = StaticBrowserRenderer(
        """
        <article>
          <a href="/jobs/rendered-backend">Rendered Backend Engineer</a>
          <p>정규직 · 경력 · 서울</p>
        </article>
        """
    )

    with Session(engine) as session:
        company = Company(name="브라우저 기업", slug="browser-company")
        source = CareerSource(
            company=company,
            base_url="https://careers.example.com/careers",
            source_type=SourceType.BROWSER_PUBLIC_RENDER,
            status=SourceStatus.NEEDS_BROWSER,
            policy_status=PolicyStatus.ALLOWED,
            last_error_code="unsupported_connector",
            last_error_reason="previous missing renderer",
        )
        session.add(source)
        session.commit()

        preview = asyncio.run(
            crawler.preview_source(
                source=source,
                fetcher=StaticFetcher("ordinary fetch should not be used"),
                sample_limit=3,
                browser_renderer=renderer,
            )
        )

        assert renderer.rendered_urls == ["https://careers.example.com/careers"]
        assert preview["source_label"] == "브라우저 기업 / browser_public_render"
        assert preview["source_type"] == "browser_public_render"
        assert preview["discovered"] == 1
        assert preview["sample_openings"] == [
            {
                "external_id": "rendered-backend",
                "title": "Rendered Backend Engineer",
                "url": "https://careers.example.com/jobs/rendered-backend",
            }
        ]
        assert preview["error"] is None
        assert session.scalars(select(JobPosting)).all() == []
        assert source.status == SourceStatus.NEEDS_BROWSER
        assert source.last_error_code == "unsupported_connector"
        assert source.last_error_reason == "previous missing renderer"


def test_postgres_crawler_does_not_construct_meilisearch() -> None:
    settings = Settings(search_backend="postgres")

    assert crawler._posting_index(settings) is None
