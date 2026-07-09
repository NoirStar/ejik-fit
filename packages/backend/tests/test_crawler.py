import asyncio
import json
import sys
from datetime import datetime, timezone
from types import ModuleType

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
    status = 200


class _FakePlaywrightPage:
    url = "https://example.com/rendered"

    def __init__(self) -> None:
        self.goto_wait_until: str | None = None
        self.waited_load_states: list[tuple[str, int]] = []

    async def goto(
        self,
        url: str,
        *,
        wait_until: str,
        timeout: int,
    ) -> _FakePlaywrightResponse:
        self.goto_wait_until = wait_until
        return _FakePlaywrightResponse()

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
    ) -> crawler.FetchedPage:
        self.calls.append(
            {"url": url, "method": method, "json_body": json_body}
        )
        return crawler.FetchedPage(
            url=url,
            text=self.text,
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
