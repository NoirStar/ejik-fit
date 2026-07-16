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
    captured: list[tuple[list[dict], int]] = []
    monkeypatch.setattr(
        crawler,
        "_capture_run_market_snapshot",
        lambda results, total: (
            captured.append((results, total))
            or {
                "observed_on": "2026-07-15",
                "open_postings": 2,
                "verified_sources": 1,
                "total_sources": total,
                "skill_count": 1,
            }
        ),
    )

    report = crawler.run_all_sources()

    assert report["sources"] == 2
    assert report["failed"] == 1
    assert report["ingested"] == 2
    assert captured and captured[0][1] == 2
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
    monkeypatch.setattr(
        crawler,
        "_capture_run_market_snapshot",
        lambda results, total: {
            "observed_on": "2026-07-15",
            "open_postings": 1,
            "verified_sources": 1,
            "total_sources": total,
            "skill_count": 1,
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
    assert "market snapshot captured: date=2026-07-15" in output


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


class RoundhrFetcher:
    def __init__(self, bootstrap_html: str, listing_json: str) -> None:
        self.bootstrap_html = bootstrap_html
        self.listing_json = listing_json
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
        text = self.bootstrap_html if len(self.urls) == 1 else self.listing_json
        return crawler.FetchedPage(
            url=url,
            text=text,
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


class PaginatedAmazonFetcher:
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
        offset = 100 if "offset=100" in url else 0
        jobs = [
            {
                "id_icims": str(index),
                "title": f"Solutions Architect {index}",
                "job_path": f"/en/jobs/{index}/solutions-architect-{index}",
                "job_category": "Solutions Architect",
                "country_code": "KOR",
            }
            for index in range(offset, min(offset + 100, 103))
        ]
        return crawler.FetchedPage(
            url=url,
            text=json.dumps({"hits": 103, "jobs": jobs}),
            status_code=200,
            headers={},
        )


class PaginatedWorkdayFetcher:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: object | None = None,
    ) -> crawler.FetchedPage:
        self.calls.append({"url": url, "method": method, "json_body": json_body})
        body = json_body if isinstance(json_body, dict) else {}
        offset = body.get("offset", 0)
        indexes = range(0, 2) if offset == 0 else range(2, 3)
        return crawler.FetchedPage(
            url=url,
            text=json.dumps(
                {
                    "total": 3 if offset == 0 else 0,
                    "jobPostings": [
                        {
                            "title": f"Software Engineer {index}",
                            "externalPath": f"/job/Korea-Seoul/role-{index}_JR{index}",
                            "locationsText": (
                                "2 Locations" if index == 0 else "Korea, Seoul"
                            ),
                            "bulletFields": [f"JR{index}"],
                        }
                        for index in indexes
                    ],
                }
            ),
            status_code=200,
            headers={},
        )


class WorkdayDetailFetcher:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: object | None = None,
    ) -> crawler.FetchedPage:
        self.calls.append({"url": url, "method": method, "json_body": json_body})
        if method == "POST":
            payload = {
                "total": 1,
                "jobPostings": [
                    {
                        "title": "Developer Technology Engineer - AI",
                        "externalPath": "/job/Korea-Seoul/ai-engineer_JR2021112",
                        "locationsText": "Korea, Seoul",
                        "bulletFields": ["JR2021112"],
                    }
                ],
            }
        else:
            payload = {
                "jobPostingInfo": {
                    "jobReqId": "JR2021112",
                    "title": "Developer Technology Engineer - AI",
                    "externalUrl": (
                        "https://nvidia.wd5.myworkdayjobs.com/"
                        "NVIDIAExternalCareerSite/job/Korea-Seoul/"
                        "ai-engineer_JR2021112"
                    ),
                    "location": "Korea, Seoul",
                    "timeType": "Full time",
                    "jobDescription": (
                        "<p>Build CUDA and Python systems for deep learning.</p>"
                    ),
                    "startDate": "2026-07-10",
                }
            }
        return crawler.FetchedPage(
            url=url,
            text=json.dumps(payload),
            status_code=200,
            headers={},
        )


def _apple_hydration_html(loader_data: dict[str, object]) -> str:
    payload = json.dumps({"loaderData": loader_data}, ensure_ascii=False)
    return (
        "<script>window.__staticRouterHydrationData = JSON.parse("
        f"{json.dumps(payload, ensure_ascii=False)})</script>"
    )


def _apple_search_job(index: int) -> dict[str, object]:
    return {
        "id": f"20060000{index}-3631",
        "positionId": f"20060000{index}",
        "postingTitle": f"Software Engineer {index}",
        "transformedPostingTitle": f"software-engineer-{index}",
        "jobSummary": "Build Apple software.",
        "locations": [{"name": "Seoul", "countryName": "Korea"}],
        "team": {"teamCode": "SFTWR"},
        "postExternal": True,
    }


class PaginatedAppleFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: object | None = None,
    ) -> crawler.FetchedPage:
        self.urls.append(url)
        indexes = (2,) if "page=2" in url else (0, 1)
        return crawler.FetchedPage(
            url=url,
            text=_apple_hydration_html(
                {
                    "search": {
                        "totalRecords": 3,
                        "searchResults": [
                            _apple_search_job(index) for index in indexes
                        ],
                    }
                }
            ),
            status_code=200,
            headers={},
        )


class AppleDetailFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: object | None = None,
    ) -> crawler.FetchedPage:
        self.urls.append(url)
        if "/search" in url:
            text = _apple_hydration_html(
                {
                    "search": {
                        "totalRecords": 1,
                        "searchResults": [_apple_search_job(1)],
                    }
                }
            )
        else:
            text = _apple_hydration_html(
                {
                    "jobDetails": {
                        "jobsData": {
                            "jobNumber": "200600001-3631",
                            "postingTitle": "Software Engineer 1",
                            "jobSummary": "Build Apple software.",
                            "description": "Own production services.",
                            "minimumQualifications": (
                                "3+ years of experience with Swift and Python"
                            ),
                            "selectedLocation": {
                                "name": "서울",
                                "countryName": "대한민국",
                            },
                            "employmentType": "Standard",
                        }
                    }
                }
            )
        return crawler.FetchedPage(
            url=url,
            text=text,
            status_code=200,
            headers={},
        )


def _microsoft_search_position(index: int) -> dict[str, object]:
    return {
        "id": 1970393556800000 + index,
        "displayJobId": f"20003000{index}",
        "name": f"Software Solution Engineer {index}",
        "locations": ["Korea, Seoul, Seoul"],
        "department": "Solution Engineering",
        "positionUrl": f"/careers/job/{1970393556800000 + index}",
    }


class PaginatedMicrosoftFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: object | None = None,
    ) -> crawler.FetchedPage:
        self.urls.append(url)
        indexes = (2,) if "start=2" in url else (0, 1)
        payload = {
            "status": 200,
            "error": {"message": "", "body": ""},
            "data": {
                "count": 3,
                "positions": [
                    _microsoft_search_position(index) for index in indexes
                ],
            },
            "metadata": None,
        }
        return crawler.FetchedPage(
            url=url,
            text=json.dumps(payload),
            status_code=200,
            headers={},
        )


class MicrosoftDetailFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: object | None = None,
    ) -> crawler.FetchedPage:
        self.urls.append(url)
        if "/search" in url:
            payload = {
                "status": 200,
                "error": {"message": "", "body": ""},
                "data": {
                    "count": 1,
                    "positions": [_microsoft_search_position(1)],
                },
            }
        else:
            payload = {
                "status": 200,
                "error": {"message": "", "body": ""},
                "data": {
                    **_microsoft_search_position(1),
                    "publicUrl": (
                        "https://apply.careers.microsoft.com/careers/job/"
                        "1970393556800001"
                    ),
                    "jobDescription": (
                        "<div>Build Azure services with Python.</div>"
                        "<div>Required Qualifications</div>"
                        "<ul><li>4+ years of engineering experience</li></ul>"
                    ),
                    "location": "Korea, Seoul, Seoul",
                    "efcustomTextEmploymentType": ["Full-Time"],
                },
            }
        return crawler.FetchedPage(
            url=url,
            text=json.dumps(payload),
            status_code=200,
            headers={},
        )


class QualcommDetailFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: object | None = None,
    ) -> crawler.FetchedPage:
        self.urls.append(url)
        position = {
            "id": 446719415948,
            "displayJobId": "3093300",
            "name": "Audio ML Systems Engineer",
            "positionUrl": "/careers/job/446719415948",
            "locations": ["Suwon, Gyeonggi-do, Korea, Republic of"],
            "postedTs": 1783036800,
            "department": "Systems Engineering",
        }
        if "/search" in url:
            payload = {
                "status": 200,
                "error": {"message": "", "body": ""},
                "data": {"count": 1, "positions": [position]},
            }
        else:
            payload = {
                "status": 200,
                "error": {"message": "", "body": ""},
                "data": {
                    **position,
                    "publicUrl": (
                        "https://careers.qualcomm.com/careers/job/"
                        "446719415948"
                    ),
                    "jobDescription": (
                        "<div>Build audio ML systems with Python.</div>"
                        "<div>Minimum Qualifications</div>"
                        "<ul><li>3+ years of engineering experience</li></ul>"
                    ),
                    "location": "Suwon, Gyeonggi-do, Korea, Republic of",
                },
            }
        return crawler.FetchedPage(
            url=url,
            text=json.dumps(payload),
            status_code=200,
            headers={},
        )


class SapDetailFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: object | None = None,
    ) -> crawler.FetchedPage:
        self.urls.append(url)
        if "/search/" in url:
            text = """
            <div class="paginationLabel">Results 1 – 1 of 1</div>
            <table id="searchresults"><tbody>
              <tr class="data-row">
                <td class="colTitle"><a class="jobTitle-link"
                  href="/job/Seoul-HANA-Cloud-Developer-06578/1270982501/">
                  HANA Cloud Developer
                </a></td>
                <td class="colLocation">
                  <span class="jobLocation">Seoul, KR, 06578</span>
                </td>
              </tr>
            </tbody></table>
            """
        else:
            text = """
            <div itemscope itemtype="http://schema.org/JobPosting">
              <meta itemprop="datePosted" content="Sun Jun 21 02:00:00 UTC 2026">
              <h1><span itemprop="title" data-careersite-propertyid="title">
                HANA Cloud Developer
              </span></h1>
              <span data-careersite-propertyid="department">Development</span>
              <span itemprop="description" data-careersite-propertyid="description">
                Build SAP HANA Cloud services with Python and SQL for production.
                Minimum of 4 years of software engineering experience is required.
              </span>
              <span data-careersite-propertyid="customfield3">Professional</span>
              <span data-careersite-propertyid="shifttype">Regular Full Time</span>
              <span data-careersite-propertyid="location">Seoul, KR, 06578</span>
            </div>
            """
        return crawler.FetchedPage(
            url=url,
            text=text,
            status_code=200,
            headers={},
        )


class GoogleDetailFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: object | None = None,
    ) -> crawler.FetchedPage:
        self.urls.append(url)
        if "q=engineer" in url:
            text = """
            <div class="rZt9ff"><span class="SWhIm">1</span> jobs matched</div>
            <div class="Ln1EL">
              <h3 class="QJPWVe">Software Engineer III, Camera System Software</h3>
              <span class="r0wTof">Seoul, South Korea</span>
              <a aria-label="Learn more about Software Engineer III, Camera System Software"
                 href="jobs/results/100776713255822022-software-engineer-iii-camera-system-software">
                Learn more
              </a>
            </div>
            """
        else:
            text = """
            <div class="DkhPwc" data-id="100776713255822022">
              <h2 class="p1N2lc">Software Engineer III, Camera System Software</h2>
              <div class="op1BBf">
                <span class="r0wTof">Seoul, South Korea</span>
                <span class="wVSTAb">Mid</span>
              </div>
              <div class="KwJkGe">
                <h3>Minimum qualifications:</h3>
                <ul>
                  <li>2 years of experience with software development in C++.</li>
                </ul>
                <h3>Preferred qualifications:</h3>
                <ul><li>Experience building camera systems with Python.</li></ul>
              </div>
              <div class="aG5W3">
                <h3>About the job</h3>
                <p>Build and operate the production camera software stack for Pixel devices.</p>
              </div>
              <div class="BDNOWe">
                <h3>Responsibilities</h3>
                <ul><li>Design reliable mobile software with partner teams.</li></ul>
              </div>
            </div>
            """
        return crawler.FetchedPage(
            url=url,
            text=text,
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


def test_fetch_listing_page_bootstraps_roundhr_organization_code() -> None:
    source = CareerSource(
        company=Company(name="리디", slug="ridi"),
        base_url="https://ridi.recruit.roundhr.com/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        connector_family="roundhr_public_api_tech",
    )
    bootstrap = json.dumps(
        {
            "props": {
                "pageProps": {
                    "site_config": {"organization": {"code": "TAERFmj4QT"}}
                }
            }
        }
    )
    fetcher = RoundhrFetcher(
        (
            '<script id="__NEXT_DATA__" type="application/json">'
            f"{bootstrap}</script>"
        ),
        '{"page":{"total":0,"pages":1,"current":1},"results":[]}',
    )

    page = asyncio.run(crawler._fetch_listing_page(source, fetcher, None))

    assert fetcher.urls == [
        "https://ridi.recruit.roundhr.com/",
        (
            "https://api-prod.roundhr.com/api/site/jobs?"
            "code=TAERFmj4QT&per=100&page=1"
        ),
    ]
    assert page.text == fetcher.listing_json


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


def test_fetch_listing_page_collects_every_amazon_korea_page() -> None:
    source = CareerSource(
        company=Company(
            name="Amazon Web Services Korea",
            slug="amazon-web-services-korea",
        ),
        base_url=(
            "https://www.amazon.jobs/en/search.json?"
            "country=KOR&result_limit=100&offset=0"
        ),
        source_type=SourceType.ENTERPRISE_JSON,
        connector_family="amazon_jobs_korea_tech",
    )
    fetcher = PaginatedAmazonFetcher()

    page = asyncio.run(crawler._fetch_listing_page(source, fetcher, None))
    payload = json.loads(page.text)

    assert fetcher.urls == [
        source.base_url,
        (
            "https://www.amazon.jobs/en/search.json?"
            "country=KOR&result_limit=100&offset=100"
        ),
    ]
    assert payload["hits"] == 103
    assert len(payload["jobs"]) == 103
    openings = crawler._parse_listing_openings(
        source.source_type,
        page.text,
        page.url,
        source.connector_family,
    )
    assert len(openings) == 103
    assert validate_listing_response(
        source.source_type,
        page.text,
        page.url,
        openings_count=len(openings),
    )


def test_fetch_listing_page_collects_every_workday_page() -> None:
    listing_url = (
        "https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/"
        "NVIDIAExternalCareerSite/jobs"
    )
    source = CareerSource(
        company=Company(name="NVIDIA Korea", slug="nvidia-korea"),
        base_url=listing_url,
        source_type=SourceType.WORKDAY,
        connector_family="workday_public_api_korea_tech",
        request_method="POST",
        request_body={
            "appliedFacets": {},
            "limit": 2,
            "offset": 0,
            "searchText": "Korea",
        },
    )
    fetcher = PaginatedWorkdayFetcher()

    page = asyncio.run(crawler._fetch_listing_page(source, fetcher, None))
    payload = json.loads(page.text)

    assert [call["json_body"] for call in fetcher.calls] == [
        source.request_body,
        {**source.request_body, "offset": 2},
    ]
    assert payload["total"] == 3
    assert len(payload["jobPostings"]) == 3
    openings = crawler._parse_listing_openings(
        source.source_type,
        page.text,
        page.url,
        source.connector_family,
    )
    assert [opening.external_id for opening in openings] == ["JR0", "JR1", "JR2"]
    assert len(crawler._apply_source_opening_filters(source, openings)) == 3


def test_fetch_listing_page_collects_every_apple_korea_page() -> None:
    listing_url = (
        "https://jobs.apple.com/en-us/search?location=korea-republic-of-KOR"
    )
    source = CareerSource(
        company=Company(name="Apple Korea", slug="apple-korea"),
        base_url=listing_url,
        source_type=SourceType.ENTERPRISE_JSON,
        connector_family="apple_jobs_korea_tech",
    )
    fetcher = PaginatedAppleFetcher()

    page = asyncio.run(crawler._fetch_listing_page(source, fetcher, None))
    payload = json.loads(page.text)

    assert fetcher.urls == [listing_url, f"{listing_url}&page=2"]
    assert payload["total"] == 3
    assert len(payload["jobs"]) == 3
    openings = crawler._parse_listing_openings(
        source.source_type,
        page.text,
        page.url,
        source.connector_family,
    )
    assert len(openings) == 3
    assert validate_listing_response(
        source.source_type,
        page.text,
        page.url,
        openings_count=len(openings),
    )


def test_fetch_listing_page_collects_every_microsoft_korea_page() -> None:
    listing_url = (
        "https://apply.careers.microsoft.com/api/pcsx/search?"
        "domain=microsoft.com&query=&location=South%20Korea&start=0"
    )
    source = CareerSource(
        company=Company(name="Microsoft Korea", slug="microsoft-korea"),
        base_url=listing_url,
        source_type=SourceType.ENTERPRISE_JSON,
        connector_family="microsoft_pcsx_korea_tech",
    )
    fetcher = PaginatedMicrosoftFetcher()

    page = asyncio.run(crawler._fetch_listing_page(source, fetcher, None))
    payload = json.loads(page.text)

    assert fetcher.urls == [
        listing_url,
        (
            "https://apply.careers.microsoft.com/api/pcsx/search?"
            "domain=microsoft.com&query=&location=South+Korea&start=2"
        ),
    ]
    assert payload["total"] == 3
    assert len(payload["jobs"]) == 3
    openings = crawler._parse_listing_openings(
        source.source_type,
        page.text,
        page.url,
        source.connector_family,
    )
    assert len(openings) == 3
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


def test_amazon_hits_and_result_limit_expose_partial_listing() -> None:
    payload = json.dumps(
        {
            "hits": 103,
            "jobs": [{"id_icims": str(index)} for index in range(100)],
        }
    )

    assert not validate_listing_response(
        SourceType.ENTERPRISE_JSON,
        payload,
        (
            "https://www.amazon.jobs/en/search.json?"
            "country=KOR&result_limit=100&offset=0"
        ),
        openings_count=100,
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
            tech_job_priority=5,
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
                                    },
                                    {
                                        "postingId": "ENT-201",
                                        "postingTitle": "경영전략 Staff",
                                        "jobDetailUrl": "/jobs/ENT-201",
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


def test_crawl_source_routes_jibe_korea_engineering_jobs() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)

    with Session(engine) as session:
        source = CareerSource(
            company=Company(name="AMD Korea", slug="amd-korea"),
            base_url=(
                "https://careers.amd.com/api/jobs?"
                "location=Korea%2C%20South&limit=100"
            ),
            source_type=SourceType.ENTERPRISE_JSON,
            connector_family="jibe_api_korea_tech",
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
                            "totalCount": 2,
                            "jobs": [
                                {
                                    "data": {
                                        "req_id": "87669",
                                        "title": "Software Development Engineer",
                                        "description": "Build GPU software in C++.",
                                        "full_location": "Seoul, Korea, South",
                                        "country_code": "KR",
                                        "categories": [{"name": "Engineering"}],
                                        "searchable": True,
                                        "applyable": True,
                                        "meta_data": {
                                            "canonical_url": (
                                                "https://careers.amd.com/jobs/"
                                                "87669?lang=en-us"
                                            )
                                        },
                                    }
                                },
                                {
                                    "data": {
                                        "req_id": "79860",
                                        "title": "AI Business Development Manager",
                                        "country_code": "KR",
                                        "categories": [
                                            {"name": "Sales / Marketing"}
                                        ],
                                        "searchable": True,
                                        "applyable": True,
                                    }
                                },
                            ],
                        }
                    )
                ),
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        posting = session.scalar(select(JobPosting))
        assert result == crawler.CrawlResult(discovered=1, ingested=1)
        assert posting is not None
        assert posting.external_id == "87669"
        assert posting.description_text == "Build GPU software in C++."
        assert source.last_error_code is None


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
            connector_family="lever_greenhouse_korea_tech",
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
                                    "absolute_url": (
                                        "https://boards.greenhouse.io/"
                                        "acme/jobs/3300"
                                    ),
                                    "location": {"name": "Seoul"},
                                    "departments": [{"name": "Engineering"}],
                                    "active": True,
                                },
                                {
                                    "id": 3301,
                                    "title": "Backend Engineer",
                                    "absolute_url": (
                                        "https://boards.greenhouse.io/"
                                        "acme/jobs/3301"
                                    ),
                                    "location": {"name": "San Mateo, United States"},
                                    "departments": [{"name": "Engineering"}],
                                    "active": True,
                                },
                                {
                                    "id": 3302,
                                    "title": "Digital Marketing Manager",
                                    "absolute_url": (
                                        "https://boards.greenhouse.io/"
                                        "acme/jobs/3302"
                                    ),
                                    "location": {"name": "Seoul, South Korea"},
                                    "departments": [{"name": "Marketing"}],
                                    "active": True,
                                },
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


def test_crawl_source_fetches_workday_details_before_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)
    listing_url = (
        "https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/"
        "NVIDIAExternalCareerSite/jobs"
    )

    with Session(engine) as session:
        company = Company(name="NVIDIA Korea", slug="nvidia-korea")
        source = CareerSource(
            company=company,
            base_url=listing_url,
            source_type=SourceType.WORKDAY,
            connector_family="workday_public_api_korea_tech",
            request_method="POST",
            request_body={
                "appliedFacets": {},
                "limit": 20,
                "offset": 0,
                "searchText": "Korea",
            },
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        fetcher = WorkdayDetailFetcher()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=fetcher,
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        posting = session.scalar(select(JobPosting))
        assert result == crawler.CrawlResult(discovered=1, ingested=1)
        assert posting is not None
        assert posting.external_id == "JR2021112"
        assert posting.description_text == (
            "Build CUDA and Python systems for deep learning."
        )
        assert fetcher.calls[1] == {
            "url": (
                "https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/"
                "NVIDIAExternalCareerSite/job/Korea-Seoul/"
                "ai-engineer_JR2021112"
            ),
            "method": "GET",
            "json_body": None,
        }


def test_crawl_source_fetches_apple_details_before_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)
    listing_url = (
        "https://jobs.apple.com/en-us/search?location=korea-republic-of-KOR"
    )

    with Session(engine) as session:
        company = Company(name="Apple Korea", slug="apple-korea")
        source = CareerSource(
            company=company,
            base_url=listing_url,
            source_type=SourceType.ENTERPRISE_JSON,
            connector_family="apple_jobs_korea_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        fetcher = AppleDetailFetcher()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=fetcher,
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        posting = session.scalar(select(JobPosting))
        assert result == crawler.CrawlResult(discovered=1, ingested=1)
        assert posting is not None
        assert posting.external_id == "200600001-3631"
        assert posting.description_text == (
            "Build Apple software. Own production services. "
            "3+ years of experience with Swift and Python"
        )
        assert posting.career_min == 3
        assert posting.location == "서울 · 대한민국"
        assert fetcher.urls == [
            listing_url,
            (
                "https://jobs.apple.com/en-us/details/200600001-3631/"
                "software-engineer-1?team=SFTWR"
            ),
        ]


def test_crawl_source_fetches_microsoft_details_before_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)
    listing_url = (
        "https://apply.careers.microsoft.com/api/pcsx/search?"
        "domain=microsoft.com&query=&location=South%20Korea&start=0"
    )

    with Session(engine) as session:
        source = CareerSource(
            company=Company(name="Microsoft Korea", slug="microsoft-korea"),
            base_url=listing_url,
            source_type=SourceType.ENTERPRISE_JSON,
            connector_family="microsoft_pcsx_korea_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        fetcher = MicrosoftDetailFetcher()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=fetcher,
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        posting = session.scalar(select(JobPosting))
        assert result == crawler.CrawlResult(discovered=1, ingested=1)
        assert posting is not None
        assert posting.external_id == "200030001"
        assert posting.description_text == (
            "Build Azure services with Python. Required Qualifications "
            "4+ years of engineering experience"
        )
        assert posting.career_min == 4
        assert posting.employment_type == "정규직"
        assert fetcher.urls == [
            listing_url,
            (
                "https://apply.careers.microsoft.com/api/pcsx/"
                "position_details?position_id=1970393556800001&"
                "domain=microsoft.com&hl=en&queried_location=South+Korea"
            ),
        ]


def test_crawl_source_fetches_qualcomm_details_before_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)
    listing_url = (
        "https://careers.qualcomm.com/api/pcsx/search?"
        "domain=qualcomm.com&query=&location=Korea%2C%20Republic%20of&start=0"
    )

    with Session(engine) as session:
        source = CareerSource(
            company=Company(name="Qualcomm Korea", slug="qualcomm-korea"),
            base_url=listing_url,
            source_type=SourceType.ENTERPRISE_JSON,
            connector_family="qualcomm_pcsx_korea_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        fetcher = QualcommDetailFetcher()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=fetcher,
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        posting = session.scalar(select(JobPosting))
        assert result == crawler.CrawlResult(discovered=1, ingested=1)
        assert posting is not None
        assert posting.external_id == "3093300"
        assert posting.description_text == (
            "Build audio ML systems with Python. Minimum Qualifications "
            "3+ years of engineering experience"
        )
        assert posting.career_min == 3
        assert posting.location == "Suwon, Gyeonggi-do, Korea, Republic of"
        assert fetcher.urls == [
            listing_url,
            (
                "https://careers.qualcomm.com/api/pcsx/position_details?"
                "position_id=446719415948&domain=qualcomm.com&hl=en&"
                "queried_location=Korea%2C+Republic+of"
            ),
        ]


def test_crawl_source_fetches_sap_details_before_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)
    listing_url = "https://jobs.sap.com/search/?q=&locationsearch=Korea"

    with Session(engine) as session:
        source = CareerSource(
            company=Company(name="SAP Korea", slug="sap-korea"),
            base_url=listing_url,
            source_type=SourceType.HTML_LISTING_DETAIL,
            connector_family="sap_public_jobs_korea_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        fetcher = SapDetailFetcher()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=fetcher,
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        posting = session.scalar(select(JobPosting))
        assert result == crawler.CrawlResult(discovered=1, ingested=1)
        assert posting is not None
        assert posting.external_id == "1270982501"
        assert "Python and SQL" in posting.description_text
        assert posting.career_min == 4
        assert posting.employment_type == "정규직"
        assert fetcher.urls == [
            listing_url,
            (
                "https://jobs.sap.com/job/Seoul-HANA-Cloud-Developer-06578/"
                "1270982501/"
            ),
        ]


def test_crawl_source_fetches_google_details_before_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)
    listing_url = (
        "https://www.google.com/about/careers/applications/jobs/results/"
        "?distance=50&location=Seoul%2C%20South%20Korea&q=engineer"
    )

    with Session(engine) as session:
        source = CareerSource(
            company=Company(name="Google Korea", slug="google-korea"),
            base_url=listing_url,
            source_type=SourceType.HTML_LISTING_DETAIL,
            connector_family="google_careers_korea_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        fetcher = GoogleDetailFetcher()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=fetcher,
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        posting = session.scalar(select(JobPosting))
        assert result == crawler.CrawlResult(discovered=1, ingested=1)
        assert posting is not None
        assert posting.external_id == "100776713255822022"
        assert posting.location == "Seoul, South Korea"
        assert posting.career_min == 2
        assert posting.career_type == "experienced"
        assert fetcher.urls == [
            listing_url,
            (
                "https://www.google.com/about/careers/applications/jobs/results/"
                "100776713255822022-software-engineer-iii-camera-system-software"
            ),
        ]


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


def test_crawl_source_fetches_shiftup_public_form_and_ingests_technical_jobs() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)
    form = {
        "workType": "get_recruit_list",
        "code": "recruit",
        "cat_idx": "0",
        "searchkey": "",
    }
    fetcher = RecordingFetcher(
        json.dumps(
            {
                "result": "000",
                "list": [
                    {
                        "subject": "서버 프로그래머 (보충역)",
                        "content": "<p>Go와 Kubernetes 기반 게임 서버 개발</p>",
                        "addinfo4": "무관",
                        "addinfo5": "정규직",
                        "addinfo6": "https://career.shiftup.co.kr/o/69850/apply",
                        "addinfo7": "Programmer",
                        "status": "1",
                    }
                ],
            },
            ensure_ascii=False,
        )
    )

    with Session(engine) as session:
        company = Company(name="시프트업", slug="shiftup")
        source = CareerSource(
            company=company,
            base_url="https://shiftup.co.kr/recruit/recruit.php",
            source_type=SourceType.HTML_LISTING_DETAIL,
            connector_family="shiftup_public_api_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
            request_method="POST",
            request_body=form,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=fetcher,
                store=MemorySnapshotStore(),
                now=now,
                request_delay_seconds=0,
            )
        )

        posting = session.scalar(select(JobPosting))
        assert fetcher.calls == [
            {
                "url": "https://shiftup.co.kr/comm/lib/client_lib.php",
                "method": "POST",
                "json_body": None,
                "form_body": form,
            }
        ]
        assert result.discovered == 1
        assert result.ingested == 1
        assert posting is not None
        assert posting.external_id == "69850"
        assert posting.title == "서버 프로그래머 (보충역)"
        assert posting.url == "https://career.shiftup.co.kr/o/69850"
        assert source.last_error_code is None
        assert source.last_success_at is not None


def test_shiftup_complete_non_technical_listing_can_reconcile_missing_jobs() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    fetcher = RecordingFetcher(
        json.dumps(
            {
                "result": "000",
                "list": [
                    {
                        "subject": "마케팅 매니저",
                        "content": "<p>글로벌 마케팅</p>",
                        "addinfo6": "https://career.shiftup.co.kr/o/226149/apply",
                        "addinfo7": "사업",
                        "status": "1",
                    }
                ],
            },
            ensure_ascii=False,
        )
    )

    with Session(engine) as session:
        company = Company(name="시프트업", slug="shiftup-empty-tech")
        source = CareerSource(
            company=company,
            base_url="https://shiftup.co.kr/recruit/recruit.php",
            source_type=SourceType.HTML_LISTING_DETAIL,
            connector_family="shiftup_public_api_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        posting = JobPosting(
            company=company,
            source=source,
            external_id="old-programmer",
            url="https://career.shiftup.co.kr/o/old-programmer",
            title="이전 서버 프로그래머",
            missing_runs=2,
        )
        session.add(posting)
        session.commit()

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

        assert result.discovered == 0
        assert result.failed == 0
        assert result.closed == 1
        assert posting.missing_runs == 3
        assert posting.status == PostingStatus.CLOSED


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


class SitemapDetailFetcher:
    def __init__(self, listing_url: str, listing: str, details: dict[str, str]) -> None:
        self.listing_url = listing_url
        self.listing = listing
        self.details = details
        self.urls: list[str] = []

    async def fetch(self, url: str) -> crawler.FetchedPage:
        self.urls.append(url)
        return crawler.FetchedPage(
            url=url,
            text=self.listing if url == self.listing_url else self.details[url],
            status_code=200,
            headers={},
        )


class PublicJsonDetailFetcher:
    def __init__(self, listing_url: str, listing: str, details: dict[str, str]) -> None:
        self.listing_url = listing_url
        self.listing = listing
        self.details = details
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
        return crawler.FetchedPage(
            url=url,
            text=self.listing if url == self.listing_url else self.details[url],
            status_code=200,
            headers={},
        )


def test_public_json_detail_crawl_fetches_only_technical_role_details() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    listing_url = "https://career.woowahan.com/w1/recruits?page=0&size=100"
    detail_url = "https://career.woowahan.com/w1/recruits/R2606023"
    listing = json.dumps(
        {
            "code": "2000",
            "data": {
                "pageSize": 100,
                "pageNumber": 1,
                "totalPageNumber": 1,
                "totalSize": 2,
                "list": [
                    {
                        "recruitNumber": "R2606023",
                        "recruitName": "Server(배차시스템)",
                        "recruitDeleteYn": False,
                        "isHidden": False,
                        "isAfterOrEqualOpenDay": True,
                    },
                    {
                        "recruitNumber": "R2607004",
                        "recruitName": "운영지원(B마트 상품전략)",
                        "recruitDeleteYn": False,
                        "isHidden": False,
                        "isAfterOrEqualOpenDay": True,
                    },
                ],
            },
        },
        ensure_ascii=False,
    )
    details = {
        detail_url: json.dumps(
            {
                "code": "2000",
                "data": {
                    "recruitNumber": "R2606023",
                    "recruitName": "Server(배차시스템)",
                    "recruitContents": "<p>Java, Spring, AWS</p>",
                    "recruitOpenDate": "2026-06-15 16:54:40",
                    "recruitEndDate": "9999-12-31 00:00:00",
                    "careerRestrictionMinYears": 5,
                    "careerRestrictionMaxYears": 15,
                    "careerType": {"recruitItemCode": "BA003002"},
                    "employmentType": {"recruitItemCode": "BA002001"},
                    "recruitDeleteYn": False,
                    "isAfterOrEqualEndDay": False,
                },
            },
            ensure_ascii=False,
        )
    }

    with Session(engine) as session:
        source = CareerSource(
            company=Company(name="우아한형제들", slug="woowahan-brothers"),
            base_url=listing_url,
            source_type=SourceType.PUBLIC_JSON_DETAIL,
            connector_family="woowahan_public_api_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        fetcher = PublicJsonDetailFetcher(listing_url, listing, details)

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

        postings = session.scalars(select(JobPosting)).all()
        assert result == crawler.CrawlResult(discovered=1, ingested=1)
        assert [posting.external_id for posting in postings] == ["R2606023"]
        assert postings[0].url == (
            "https://career.woowahan.com/recruitment/R2606023/detail"
        )
        assert fetcher.urls == [listing_url, detail_url]
        assert source.last_success_at is not None


def test_dunamu_public_api_crawl_reuses_verified_listing_rows() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    listing_url = (
        "https://careers.dunamu.com/api/job-boards/"
        "jd0wjv/job-notices"
    )
    listing = json.dumps(
        {
            "content": {
                "jobBoardName": "Dunamu",
                "jobNoticeResponses": [
                    {
                        "id": 588,
                        "name": "Frontend Engineer_데이터 프로덕트 서비스 개발",
                        "jobGroupCode": "T_ENGINEERING",
                        "experienceLevel": "EXPERIENCED",
                        "employmentType": "FULL_TIME",
                    },
                    {
                        "id": 599,
                        "name": "PR 담당자",
                        "jobGroupCode": "T_COMMUNICATION",
                        "experienceLevel": "EXPERIENCED",
                        "employmentType": "CONTRACT",
                    },
                ],
            },
            "statusCode": 200,
        },
        ensure_ascii=False,
    )

    with Session(engine) as session:
        source = CareerSource(
            company=Company(name="두나무", slug="dunamu"),
            base_url=listing_url,
            source_type=SourceType.PUBLIC_JSON_DETAIL,
            connector_family="dunamu_server_html_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        fetcher = PublicJsonDetailFetcher(listing_url, listing, {})

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

        posting = session.scalar(select(JobPosting))
        assert result == crawler.CrawlResult(discovered=1, ingested=1)
        assert posting is not None
        assert posting.external_id == "588"
        assert posting.url == "https://careers.dunamu.com/detail/588"
        assert posting.career_type == "experienced"
        assert posting.employment_type == "regular"
        assert fetcher.urls == [listing_url]


class WorkableListingFetcher:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: object | None = None,
    ) -> crawler.FetchedPage:
        self.calls.append(
            {"url": url, "method": method, "json_body": json_body}
        )
        if url == "https://apply.workable.com/lunit/":
            text = '<meta name="subdomain" content="lunit">'
        elif json_body == {}:
            text = json.dumps(
                {
                    "total": 3,
                    "nextPage": "page-2-token",
                    "results": [
                        {"id": 1, "shortcode": "AAA111", "title": "A"},
                        {"id": 2, "shortcode": "BBB222", "title": "B"},
                    ],
                }
            )
        elif json_body == {"token": "page-2-token"}:
            text = json.dumps(
                {
                    "total": 3,
                    "nextPage": None,
                    "results": [
                        {"id": 3, "shortcode": "CCC333", "title": "C"}
                    ],
                }
            )
        else:
            raise AssertionError(f"unexpected Workable request: {url}")
        return crawler.FetchedPage(
            url=url,
            text=text,
            status_code=200,
            headers={},
        )


def test_workable_listing_fetch_paginates_to_a_complete_envelope() -> None:
    fetcher = WorkableListingFetcher()
    source = CareerSource(
        company=Company(name="루닛", slug="lunit"),
        base_url="https://apply.workable.com/lunit/",
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        connector_family="workable_public_api_tech",
        status=SourceStatus.ALLOWED,
        policy_status=PolicyStatus.ALLOWED,
    )

    page = asyncio.run(crawler._fetch_listing_page(source, fetcher, None))
    payload = json.loads(page.text)

    assert payload["total"] == 3
    assert payload["nextPage"] is None
    assert [row["id"] for row in payload["results"]] == [1, 2, 3]
    assert fetcher.calls == [
        {
            "url": "https://apply.workable.com/lunit/",
            "method": "GET",
            "json_body": None,
        },
        {
            "url": "https://apply.workable.com/api/v3/accounts/lunit/jobs",
            "method": "POST",
            "json_body": {},
        },
        {
            "url": "https://apply.workable.com/api/v3/accounts/lunit/jobs",
            "method": "POST",
            "json_body": {"token": "page-2-token"},
        },
    ]


def test_sitemap_detail_crawl_ingests_only_technical_jsonld_roles() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    listing_url = "https://careers.example.com/sitemap.xml"
    backend_url = "https://careers.example.com/jobs/role/101/"
    marketing_url = "https://careers.example.com/jobs/role/102/"
    listing = f"""
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>{backend_url}</loc></url>
      <url><loc>{marketing_url}</loc></url>
    </urlset>
    """
    details = {
        backend_url: """
          <script type="application/ld+json">
            {"@type":"JobPosting","title":"Backend Engineer",
             "description":"<p>Python과 FastAPI</p>"}
          </script>
        """,
        marketing_url: """
          <script type="application/ld+json">
            {"@type":"JobPosting","title":"Brand Marketing Manager",
             "description":"<p>브랜드 캠페인 운영</p>"}
          </script>
        """,
    }

    with Session(engine) as session:
        company = Company(name="당근", slug="daangn")
        source = CareerSource(
            company=company,
            base_url=listing_url,
            source_type=SourceType.SITEMAP_DISCOVERY,
            connector_family="sitemap_jsonld_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()
        fetcher = SitemapDetailFetcher(listing_url, listing, details)

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

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert result.failed == 0
        assert [posting.external_id for posting in postings] == ["101"]
        assert postings[0].title == "Backend Engineer"
        assert fetcher.urls == [listing_url, backend_url, marketing_url]
        assert source.last_success_at is not None


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


class GreetingDetailFetcher:
    def __init__(
        self,
        listing_html: str,
        details: dict[str, str],
    ) -> None:
        self.listing_html = listing_html
        self.details = details

    async def fetch(self, url: str) -> crawler.FetchedPage:
        text = self.listing_html
        for external_id, detail in self.details.items():
            if url.endswith(f"/o/{external_id}"):
                text = detail
                break
        return crawler.FetchedPage(
            url=url,
            text=text,
            status_code=200,
            headers={},
        )


def test_greeting_korea_crawl_does_not_ingest_foreign_details() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    fixture_dir = (
        Path(__file__).parents[3] / "tests" / "fixtures" / "greeting"
    )
    listing_html = (fixture_dir / "list.html").read_text()
    domestic_detail = (fixture_dir / "opening.html").read_text()
    foreign_detail = (
        domestic_detail.replace('"openingId": 209187', '"openingId": 205581')
        .replace('"title": "Backend Engineer"', '"title": "Security Engineer"')
        .replace("서울특별시", "Shanghai, China")
    )

    with Session(engine) as session:
        source = CareerSource(
            company=Company(name="테스트 기업", slug="greeting-korea-crawl"),
            base_url="https://sample.career.greetinghr.com/ko",
            source_type=SourceType.GREETING,
            connector_family="greeting_korea_tech",
            status=SourceStatus.ALLOWED,
            policy_status=PolicyStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=GreetingDetailFetcher(
                    listing_html,
                    {"209187": domestic_detail, "205581": foreign_detail},
                ),
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 15, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert [posting.external_id for posting in postings] == ["209187"]


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
