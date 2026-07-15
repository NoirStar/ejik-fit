import asyncio
import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Mapping, Protocol
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ejikfit.config import Settings, get_settings
from ejikfit.connectors.browser_public import parse_browser_public_render_openings
from ejikfit.connectors.channel import parse_channel_openings
from ejikfit.connectors.enterprise_json import parse_enterprise_json_openings
from ejikfit.connectors.greeting import (
    discover_corporate_greeting_openings,
    discover_grouped_greeting_openings,
    discover_openings,
    parse_opening,
)
from ejikfit.connectors.html_listing import parse_html_listing_openings
from ejikfit.connectors.jsonld import parse_jsonld_openings
from ejikfit.connectors.kakao import parse_kakao_openings
from ejikfit.connectors.lever_greenhouse import parse_lever_greenhouse_openings
from ejikfit.connectors.line_gatsby import parse_line_gatsby_openings
from ejikfit.connectors.naver import parse_naver_openings
from ejikfit.connectors.next_data import parse_static_next_data_openings
from ejikfit.connectors.public_json_detail import (
    COM2US_LISTING_API,
    COM2US_LISTING_BODY,
    COM2US_REQUEST_HEADERS,
    NETMARBLE_LISTING_API,
    NCSOFT_DETAIL_API,
    NCSOFT_LISTING_API,
    NCSOFT_LISTING_FORM,
    ROUNDHR_LISTING_API,
    WORKABLE_LISTING_API_TEMPLATE,
    PublicJsonDetailRef,
    discover_public_json_detail_refs,
    filter_public_detail_refs,
    ncsoft_session_headers,
    parse_public_json_detail,
    parse_workable_listing_page,
    public_detail_listing_is_self_validated,
    roundhr_site_code,
    workable_account_slug,
)
from ejikfit.connectors.sitemap_discovery import (
    discover_sitemap_openings,
    parse_sitemap_detail_opening,
)
from ejikfit.connectors.shiftup import (
    SHIFTUP_LISTING_API,
    SHIFTUP_LISTING_FORM,
    parse_shiftup_openings,
)
from ejikfit.connectors.successfactors import parse_successfactors_openings
from ejikfit.connectors.technical_roles import (
    is_korea_technical_role,
    is_technical_role,
)
from ejikfit.connectors.types import ParsedOpening
from ejikfit.connectors.workday import parse_workday_openings
from ejikfit.db import SessionLocal
from ejikfit.ingestion import ingest_opening
from ejikfit.listing_validation import (
    ListingValidationError,
    validate_listing_response,
)
from ejikfit.models import (
    CareerSource,
    JobPosting,
    PolicyStatus,
    PostingStatus,
    SourceStatus,
    SourceType,
)
from ejikfit.search import MeiliPostingIndex, PostingIndex
from ejikfit.skill_trends import capture_skill_demand_snapshot
from ejikfit.storage import S3SnapshotStore, SnapshotStore


logger = logging.getLogger(__name__)


def _apply_source_opening_filters(
    source: CareerSource,
    openings: list[ParsedOpening],
) -> list[ParsedOpening]:
    if not source.targets_technical_roles:
        return openings
    if source.connector_family == "amazon_jobs_korea_tech":
        return openings
    if source.connector_family in {
        "ashby_public_api_korea_tech",
        "lever_greenhouse_korea_tech",
        "channel_next_data_tech",
    }:
        return [
            opening
            for opening in openings
            if is_korea_technical_role(opening.title, opening.location)
        ]
    return [
        opening
        for opening in openings
        if is_technical_role(opening.title)
    ]


def _discover_greeting_source_refs(source: CareerSource, html: str):
    if source.connector_family == "corporate_greeting_links_tech":
        return discover_corporate_greeting_openings(
            html,
            source.base_url,
            technical_only=source.targets_technical_roles,
        )
    if source.connector_family == "grouped_greeting_links_tech":
        return discover_grouped_greeting_openings(
            html,
            source.base_url,
            technical_only=source.targets_technical_roles,
        )
    return discover_openings(
        html,
        source.base_url,
        technical_only=source.targets_technical_roles,
    )


class RetryableFetchError(RuntimeError):
    pass


class BlockedSourceError(RuntimeError):
    pass


@dataclass(frozen=True)
class FetchedPage:
    url: str
    text: str
    status_code: int
    headers: Mapping[str, str]


@dataclass(frozen=True)
class CrawlResult:
    discovered: int = 0
    ingested: int = 0
    failed: int = 0
    closed: int = 0


@dataclass(frozen=True)
class SourceRunTarget:
    source_id: str
    label: str


class BrowserRenderer(Protocol):
    async def render(self, url: str) -> FetchedPage:
        ...


def contains_access_challenge(html: str) -> bool:
    lowered = html.lower()
    challenge_markers = (
        "g-recaptcha",
        "hcaptcha",
        "cf-chl-captcha",
        "verify you are human",
        "cloudflare challenge",
        "캡차를 입력",
    )
    return any(marker in lowered for marker in challenge_markers)


class HttpFetcher:
    def __init__(self, user_agent: str) -> None:
        self.user_agent = user_agent

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        json_body: object | None = None,
        form_body: object | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> FetchedPage:
        request_method = method.upper()
        retrying = AsyncRetrying(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=1, max=8),
            retry=retry_if_exception_type(
                (RetryableFetchError, httpx.TransportError)
            ),
            reraise=True,
        )

        async for attempt in retrying:
            with attempt:
                async with httpx.AsyncClient(
                    follow_redirects=True,
                    timeout=20.0,
                    headers={
                        "User-Agent": self.user_agent,
                        **(dict(headers) if headers is not None else {}),
                    },
                ) as client:
                    response = await client.request(
                        request_method,
                        url,
                        json=json_body if request_method != "GET" else None,
                        data=form_body if request_method != "GET" else None,
                    )

                if response.status_code in {401, 403}:
                    raise BlockedSourceError(
                        f"source denied access with {response.status_code}"
                    )
                if response.status_code == 429 or response.status_code >= 500:
                    raise RetryableFetchError(
                        f"temporary upstream status {response.status_code}"
                    )
                response.raise_for_status()

                if contains_access_challenge(response.text):
                    raise BlockedSourceError("source returned an access challenge")

                return FetchedPage(
                    url=str(response.url),
                    text=response.text,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                )

        raise AssertionError("retry loop exited without a response")


class PlaywrightBrowserRenderer:
    def __init__(
        self,
        timeout_ms: int = 20_000,
        settle_timeout_ms: int = 5_000,
    ) -> None:
        self.timeout_ms = timeout_ms
        self.settle_timeout_ms = settle_timeout_ms

    async def render(self, url: str) -> FetchedPage:
        try:
            from playwright.async_api import async_playwright
        except ImportError as error:
            raise ValueError("browser renderer is not configured") from error

        try:
            async with async_playwright() as playwright:
                browser = await playwright.chromium.launch(headless=True)
                try:
                    page = await browser.new_page()
                    response = await page.goto(
                        url,
                        wait_until="domcontentloaded",
                        timeout=self.timeout_ms,
                    )
                    try:
                        await page.wait_for_load_state(
                            "networkidle",
                            timeout=self.settle_timeout_ms,
                        )
                    except Exception:
                        pass
                    text = await page.content()
                    rendered_url = page.url
                finally:
                    await browser.close()
        except Exception as error:
            raise RetryableFetchError(f"browser render failed: {error}") from error

        status_code = response.status if response is not None else 200
        if status_code in {401, 403}:
            raise BlockedSourceError(f"source denied access with {status_code}")
        if 400 <= status_code < 500:
            raise RetryableFetchError(f"browser upstream status {status_code}")
        if status_code == 429 or status_code >= 500:
            raise RetryableFetchError(
                f"temporary upstream status {status_code}"
            )
        if contains_access_challenge(text):
            raise BlockedSourceError("source returned an access challenge")

        return FetchedPage(
            url=rendered_url,
            text=text,
            status_code=status_code,
            headers={},
        )


def next_missing_state(
    current: int,
    successful_listing: bool,
    seen: bool,
) -> tuple[int, PostingStatus]:
    if not successful_listing:
        return current, PostingStatus.OPEN
    if seen:
        return 0, PostingStatus.OPEN

    updated = current + 1
    status = (
        PostingStatus.CLOSED if updated >= 3 else PostingStatus.OPEN
    )
    return updated, status


def reconcile_missing(
    session: Session,
    source_id: uuid.UUID,
    seen_external_ids: set[str],
    successful_listing: bool,
    now: datetime | None = None,
) -> int:
    postings = session.scalars(
        select(JobPosting).where(JobPosting.source_id == source_id)
    ).all()
    closed = 0

    for posting in postings:
        was_closed = posting.status == PostingStatus.CLOSED
        if not successful_listing:
            continue
        if posting.external_id in seen_external_ids:
            posting.missing_runs = 0
        else:
            posting.missing_runs, posting.status = next_missing_state(
                posting.missing_runs,
                successful_listing=True,
                seen=False,
            )
        if not was_closed and posting.status == PostingStatus.CLOSED:
            if now is not None:
                posting.last_verified_at = now
            closed += 1

    session.commit()
    return closed


def _mark_source_success(source: CareerSource, now: datetime) -> None:
    source.last_verified_at = now
    source.last_success_at = now
    source.last_error_code = None
    source.last_error_reason = None


def _mark_source_error(
    source: CareerSource,
    code: str,
    reason: str,
    *,
    status: SourceStatus | None = None,
    policy_status: PolicyStatus | None = None,
) -> None:
    if status is not None:
        source.status = status
    if policy_status is not None:
        source.policy_status = policy_status
    source.last_error_code = code
    source.last_error_reason = reason[:1000]


def _parse_list_json_openings(
    source_type: SourceType,
    text: str,
    url: str,
):
    if source_type == SourceType.NAVER_JSON:
        return parse_naver_openings(text, url)
    if source_type == SourceType.KAKAO_JSON:
        return parse_kakao_openings(text, url)
    if source_type == SourceType.LINE_GATSBY:
        return parse_line_gatsby_openings(text, url)
    raise ValueError(f"unsupported list-json source type: {source_type.value}")


def _parse_listing_openings(
    source_type: SourceType,
    text: str,
    url: str,
    connector_family: str | None = None,
):
    if source_type == SourceType.JSON_LD:
        return parse_jsonld_openings(text, url)
    if source_type in {
        SourceType.NAVER_JSON,
        SourceType.KAKAO_JSON,
        SourceType.LINE_GATSBY,
    }:
        return _parse_list_json_openings(source_type, text, url)
    if source_type == SourceType.HTML_LISTING_DETAIL:
        if connector_family == "shiftup_public_api_tech":
            return parse_shiftup_openings(text)
        return parse_html_listing_openings(text, url)
    if source_type == SourceType.STATIC_NEXT_DATA:
        if connector_family == "channel_next_data_tech":
            return parse_channel_openings(text, url)
        return parse_static_next_data_openings(text, url)
    if source_type == SourceType.ENTERPRISE_JSON:
        return parse_enterprise_json_openings(text, url)
    if source_type == SourceType.LEVER_GREENHOUSE:
        return parse_lever_greenhouse_openings(text, url)
    if source_type == SourceType.WORKDAY:
        return parse_workday_openings(text, url)
    if source_type == SourceType.SAP_SUCCESSFACTORS:
        return parse_successfactors_openings(text, url)
    if source_type == SourceType.BROWSER_PUBLIC_RENDER:
        return parse_browser_public_render_openings(text, url)
    raise ValueError(f"connector is not implemented: {source_type.value}")


def _listing_is_self_validated(connector_family: str | None) -> bool:
    return connector_family == "shiftup_public_api_tech"


def _unsupported_connector_status(source_type: SourceType) -> SourceStatus:
    if source_type == SourceType.BROWSER_PUBLIC_RENDER:
        return SourceStatus.NEEDS_BROWSER
    return SourceStatus.NEEDS_CONNECTOR


def _source_label(source: CareerSource) -> str:
    return f"{source.company.name} / {source.source_type.value}"


def _preview_payload(
    source: CareerSource,
    *,
    discovered: int = 0,
    sample_openings: list[dict[str, str]] | None = None,
    error: dict[str, str] | None = None,
    complete: bool | None = None,
) -> dict[str, Any]:
    return {
        "source_id": str(source.id),
        "source_label": _source_label(source),
        "source_type": source.source_type.value,
        "discovered": discovered,
        "sample_openings": sample_openings or [],
        "error": error,
        "complete": complete,
    }


async def _fetch_listing_page(
    source: CareerSource,
    fetcher: HttpFetcher,
    browser_renderer: BrowserRenderer | None,
) -> FetchedPage:
    if source.connector_family == "amazon_jobs_korea_tech":
        return await _fetch_all_amazon_jobs_pages(source.base_url, fetcher)
    if source.connector_family == "workable_public_api_tech":
        bootstrap = await fetcher.fetch(source.base_url)
        account = workable_account_slug(bootstrap.text, source.base_url)
        listing_url = WORKABLE_LISTING_API_TEMPLATE.format(account=account)
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Referer": source.base_url,
        }
        rows: list[dict[str, Any]] = []
        expected_total: int | None = None
        next_page: str | None = None
        seen_tokens: set[str] = set()
        latest_page: FetchedPage | None = None
        for page_number in range(1, 51):
            body = {} if page_number == 1 else {"token": next_page}
            latest_page = await fetcher.fetch(
                listing_url,
                method="POST",
                json_body=body,
                headers=headers,
            )
            page_rows, total, next_page = parse_workable_listing_page(
                latest_page.text
            )
            if expected_total is None:
                expected_total = total
            elif total != expected_total:
                raise ValueError("Workable listing total changed while paging")
            rows.extend(page_rows)

            if next_page is None:
                break
            if next_page in seen_tokens:
                raise ValueError("Workable listing repeated a page token")
            seen_tokens.add(next_page)
        else:
            raise ValueError("Workable listing exceeded the page limit")

        if latest_page is None or expected_total != len(rows):
            raise ValueError("Workable listing response is incomplete")
        return FetchedPage(
            url=listing_url,
            text=json.dumps(
                {
                    "total": expected_total,
                    "nextPage": None,
                    "results": rows,
                },
                ensure_ascii=False,
            ),
            status_code=latest_page.status_code,
            headers=latest_page.headers,
        )
    if source.connector_family == "roundhr_public_api_tech":
        bootstrap = await fetcher.fetch(source.base_url)
        organization_code = roundhr_site_code(bootstrap.text)
        listing_url = ROUNDHR_LISTING_API + "?" + urlencode(
            {"code": organization_code, "per": 100, "page": 1}
        )
        return await fetcher.fetch(listing_url)
    if source.connector_family == "com2us_jobflex_tech":
        return await fetcher.fetch(
            COM2US_LISTING_API,
            method="POST",
            json_body=COM2US_LISTING_BODY,
            headers=COM2US_REQUEST_HEADERS,
        )
    if source.connector_family == "ncsoft_session_html_tech":
        bootstrap = await fetcher.fetch(source.base_url)
        session_headers = ncsoft_session_headers(
            bootstrap.text,
            bootstrap.headers,
            source.base_url,
        )
        listing = await fetcher.fetch(
            NCSOFT_LISTING_API,
            method="POST",
            form_body=NCSOFT_LISTING_FORM,
            headers=session_headers,
        )
        return FetchedPage(
            url=listing.url,
            text=listing.text,
            status_code=listing.status_code,
            headers={**listing.headers, **session_headers},
        )
    if source.connector_family == "netmarble_public_api_tech":
        return await fetcher.fetch(NETMARBLE_LISTING_API)
    if source.connector_family == "shiftup_public_api_tech":
        return await fetcher.fetch(
            SHIFTUP_LISTING_API,
            method="POST",
            form_body=source.request_body or SHIFTUP_LISTING_FORM,
        )
    if source.source_type != SourceType.BROWSER_PUBLIC_RENDER:
        request_method = (source.request_method or "GET").upper()
        if request_method != "GET":
            if source.source_type == SourceType.HTML_LISTING_DETAIL:
                return await fetcher.fetch(
                    source.base_url,
                    method=request_method,
                    form_body=source.request_body,
                )
            return await fetcher.fetch(
                source.base_url,
                method=request_method,
                json_body=source.request_body,
            )
        if _is_lge_jobs_api(source.base_url):
            return await _fetch_all_lge_pages(source.base_url, fetcher)
        return await fetcher.fetch(source.base_url)
    if browser_renderer is None:
        raise ValueError("browser renderer is not configured")
    return await browser_renderer.render(source.base_url)


async def _fetch_public_json_detail(
    ref: PublicJsonDetailRef,
    connector_family: str,
    listing: FetchedPage,
    fetcher: HttpFetcher,
) -> FetchedPage:
    if connector_family == "com2us_jobflex_tech":
        return await fetcher.fetch(
            ref.detail_url,
            headers=COM2US_REQUEST_HEADERS,
        )
    if connector_family != "ncsoft_session_html_tech":
        return await fetcher.fetch(ref.detail_url)

    parsed = urlparse(ref.detail_url)
    query = parse_qs(parsed.query)
    company_id = query.get("companyId", [None])[0]
    job_id = query.get("jopenId", [None])[0]
    csrf = listing.headers.get("X-CSRF-TOKEN")
    cookie = listing.headers.get("Cookie")
    if not company_id or job_id != ref.external_id or not csrf or not cookie:
        raise ValueError("NC Careers detail session context is incomplete")
    return await fetcher.fetch(
        NCSOFT_DETAIL_API + f"?{urlencode({'companyId': company_id})}",
        method="POST",
        form_body={"jopenId": job_id, "regOpId": company_id},
        headers={
            "Accept": "text/html, */*; q=0.01",
            "Cookie": cookie,
            "Origin": "https://careers.ncsoft.com",
            "Referer": ref.public_url,
            "X-CSRF-TOKEN": csrf,
            "X-Requested-With": "XMLHttpRequest",
        },
    )


def _is_lge_jobs_api(url: str) -> bool:
    parsed = urlparse(url)
    return (
        parsed.hostname == "globalcareers.lge.com"
        and parsed.path.rstrip("/") == "/api/job/v1/jobs"
    )


def _page_url(url: str, page: int) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query["page"] = [str(page)]
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))


def _offset_url(url: str, offset: int) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query["offset"] = [str(offset)]
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))


async def _fetch_all_amazon_jobs_pages(
    url: str,
    fetcher: HttpFetcher,
) -> FetchedPage:
    first = await fetcher.fetch(url)
    payload = json.loads(first.text)
    jobs = payload.get("jobs") if isinstance(payload, dict) else None
    hits = payload.get("hits") if isinstance(payload, dict) else None
    if not isinstance(jobs, list) or not isinstance(hits, int):
        return first
    if hits <= len(jobs):
        return first
    if not jobs:
        raise ValueError("Amazon Jobs reports results but returned an empty page")

    combined_jobs = list(jobs)
    seen_ids = {
        str(job.get("id_icims") or job.get("id"))
        for job in jobs
        if isinstance(job, dict) and (job.get("id_icims") or job.get("id"))
    }
    offset = len(jobs)
    for _ in range(49):
        page = await fetcher.fetch(_offset_url(url, offset))
        page_payload = json.loads(page.text)
        page_jobs = (
            page_payload.get("jobs") if isinstance(page_payload, dict) else None
        )
        page_hits = (
            page_payload.get("hits") if isinstance(page_payload, dict) else None
        )
        if not isinstance(page_jobs, list) or page_hits != hits:
            raise ValueError("Amazon Jobs listing changed while paging")
        if not page_jobs:
            raise ValueError("Amazon Jobs listing ended before all jobs were fetched")

        for job in page_jobs:
            if not isinstance(job, dict):
                raise ValueError("Amazon Jobs page contains an invalid job object")
            job_id = job.get("id_icims") or job.get("id")
            if job_id is None or str(job_id) in seen_ids:
                raise ValueError("Amazon Jobs listing repeated or omitted a job id")
            seen_ids.add(str(job_id))
            combined_jobs.append(job)
        offset += len(page_jobs)
        if len(combined_jobs) >= hits:
            break
    else:
        raise ValueError("Amazon Jobs listing exceeded the page limit")

    if len(combined_jobs) != hits:
        raise ValueError("Amazon Jobs listing response is incomplete")
    payload["jobs"] = combined_jobs
    return FetchedPage(
        url=first.url,
        text=json.dumps(payload, ensure_ascii=False),
        status_code=first.status_code,
        headers=first.headers,
    )


async def _fetch_all_lge_pages(
    url: str,
    fetcher: HttpFetcher,
) -> FetchedPage:
    first = await fetcher.fetch(url)
    payload = json.loads(first.text)
    data = payload.get("data") if isinstance(payload, dict) else None
    rows = data.get("list") if isinstance(data, dict) else None
    total = data.get("total") if isinstance(data, dict) else None
    size = data.get("size") if isinstance(data, dict) else None
    if (
        not isinstance(rows, list)
        or not isinstance(total, int)
        or not isinstance(size, int)
        or size <= 0
        or total <= len(rows)
    ):
        return first

    combined_rows = list(rows)
    total_pages = (total + size - 1) // size
    last_page_data = data
    for page_number in range(2, total_pages + 1):
        page = await fetcher.fetch(_page_url(url, page_number))
        page_payload = json.loads(page.text)
        page_data = (
            page_payload.get("data") if isinstance(page_payload, dict) else None
        )
        page_rows = page_data.get("list") if isinstance(page_data, dict) else None
        if not isinstance(page_rows, list):
            raise ValueError("LG Electronics jobs page is missing its list")
        combined_rows.extend(page_rows)
        last_page_data = page_data

    data.update(last_page_data)
    data["list"] = combined_rows
    data["total"] = total
    return FetchedPage(
        url=first.url,
        text=json.dumps(payload, ensure_ascii=False),
        status_code=first.status_code,
        headers=first.headers,
    )


async def preview_source(
    source: CareerSource,
    fetcher: HttpFetcher,
    sample_limit: int = 5,
    browser_renderer: BrowserRenderer | None = None,
) -> dict[str, Any]:
    if source.policy_status in {PolicyStatus.BLOCKED, PolicyStatus.STOPPED}:
        return _preview_payload(
            source,
            error={
                "code": "policy_not_allowed",
                "reason": f"source policy is {source.policy_status.value}",
            },
        )

    try:
        listing = await _fetch_listing_page(source, fetcher, browser_renderer)
    except BlockedSourceError as error:
        return _preview_payload(
            source,
            error={"code": "blocked", "reason": str(error)},
        )
    except (httpx.HTTPError, RetryableFetchError) as error:
        return _preview_payload(
            source,
            error={"code": "temporary_fetch_error", "reason": str(error)},
        )
    except ValueError as error:
        return _preview_payload(
            source,
            error={"code": "unsupported_connector", "reason": str(error)},
        )

    try:
        if source.source_type == SourceType.SITEMAP_DISCOVERY:
            refs = discover_sitemap_openings(listing.text, source.base_url)
            return _preview_payload(
                source,
                discovered=len(refs),
                sample_openings=[
                    {
                        "external_id": ref.external_id,
                        "title": ref.title or ref.external_id,
                        "url": ref.url,
                    }
                    for ref in refs[:sample_limit]
                ],
                complete=True,
            )
        if source.source_type == SourceType.PUBLIC_JSON_DETAIL:
            all_refs = discover_public_json_detail_refs(
                listing.text,
                source.base_url,
                source.connector_family,
            )
            complete = (
                True
                if public_detail_listing_is_self_validated(
                    source.connector_family
                )
                else validate_listing_response(
                    source.source_type,
                    listing.text,
                    listing.url,
                    len(all_refs),
                    source.request_body,
                )
            )
            refs = filter_public_detail_refs(
                all_refs,
                source.connector_family,
            )
            return _preview_payload(
                source,
                discovered=len(refs),
                sample_openings=[
                    {
                        "external_id": ref.external_id,
                        "title": ref.title,
                        "url": ref.public_url,
                    }
                    for ref in refs[:sample_limit]
                ],
                complete=complete,
                error=(
                    None
                    if complete
                    else {
                        "code": "incomplete_listing",
                        "reason": "listing response indicates additional pages",
                    }
                ),
            )
        if source.source_type == SourceType.GREETING:
            refs = _discover_greeting_source_refs(source, listing.text)
            return _preview_payload(
                source,
                discovered=len(refs),
                sample_openings=[
                    {
                        "external_id": ref.external_id,
                        "title": ref.title or ref.external_id,
                        "url": ref.url,
                    }
                    for ref in refs[:sample_limit]
                ],
                complete=True,
            )
        openings = _parse_listing_openings(
            source.source_type,
            listing.text,
            listing.url,
            source.connector_family,
        )
        complete = (
            True
            if _listing_is_self_validated(source.connector_family)
            else validate_listing_response(
                source.source_type,
                listing.text,
                listing.url,
                len(openings),
                source.request_body,
            )
        )
        openings = _apply_source_opening_filters(source, openings)
    except (KeyError, TypeError, ListingValidationError, ValueError) as error:
        return _preview_payload(
            source,
            error={
                "code": "listing_parse_error",
                "reason": str(error),
            },
        )

    samples = [
        {
            "external_id": opening.external_id,
            "title": opening.title,
            "url": opening.url,
        }
        for opening in openings[:sample_limit]
    ]
    return _preview_payload(
        source,
        discovered=len(openings),
        sample_openings=samples,
        complete=complete,
        error=(
            None
            if complete
            else {
                "code": "incomplete_listing",
                "reason": "listing response indicates additional pages",
            }
        ),
    )


async def crawl_source(
    session: Session,
    source: CareerSource,
    fetcher: HttpFetcher,
    store: SnapshotStore,
    now: datetime,
    request_delay_seconds: float = 1.0,
    posting_index: PostingIndex | None = None,
    browser_renderer: BrowserRenderer | None = None,
) -> CrawlResult:
    if not source.is_runnable:
        return CrawlResult()

    try:
        listing = await _fetch_listing_page(source, fetcher, browser_renderer)
    except BlockedSourceError as error:
        _mark_source_error(
            source,
            "blocked",
            str(error),
            status=SourceStatus.BLOCKED,
            policy_status=PolicyStatus.BLOCKED,
        )
        session.commit()
        return CrawlResult(failed=1)
    except ValueError as error:
        _mark_source_error(
            source,
            "unsupported_connector",
            str(error),
            status=_unsupported_connector_status(source.source_type),
        )
        session.commit()
        return CrawlResult(failed=1)
    except (httpx.HTTPError, RetryableFetchError) as error:
        _mark_source_error(
            source,
            "temporary_fetch_error",
            str(error),
        )
        session.commit()
        return CrawlResult(failed=1)

    discovered = 0
    ingested = 0
    failed = 0
    seen_external_ids: set[str] = set()

    if source.source_type == SourceType.SITEMAP_DISCOVERY:
        try:
            refs = discover_sitemap_openings(listing.text, source.base_url)
        except (TypeError, ValueError) as error:
            _mark_source_error(source, "listing_parse_error", str(error))
            session.commit()
            return CrawlResult(failed=1)

        technical_only = source.targets_technical_roles
        for index, ref in enumerate(refs):
            if index > 0 and request_delay_seconds > 0:
                await asyncio.sleep(request_delay_seconds)
            try:
                detail = await fetcher.fetch(ref.url)
                opening = parse_sitemap_detail_opening(
                    detail.text,
                    ref.url,
                    ref.external_id,
                    connector_family=source.connector_family,
                )
                if source.connector_family == "furiosa_webflow_korea_tech":
                    if not is_korea_technical_role(
                        opening.title,
                        opening.location,
                    ):
                        continue
                elif technical_only and not is_technical_role(opening.title):
                    continue
                seen_external_ids.add(ref.external_id)
                discovered += 1
                ingest_opening(
                    session,
                    source,
                    opening,
                    detail.text,
                    store,
                    now,
                    posting_index,
                )
                ingested += 1
            except BlockedSourceError as error:
                _mark_source_error(
                    source,
                    "blocked",
                    str(error),
                    status=SourceStatus.BLOCKED,
                    policy_status=PolicyStatus.BLOCKED,
                )
                session.commit()
                failed += 1
                return CrawlResult(
                    discovered=discovered,
                    ingested=ingested,
                    failed=failed,
                )
            except Exception as error:
                session.rollback()
                # Preserve the previous posting state when a detail page fails.
                # Successfully parsed non-technical roles remain absent so an
                # old technical posting can age out after changing role family.
                seen_external_ids.add(ref.external_id)
                logger.exception("Sitemap detail ingestion failed for %s", ref.url)
                failed += 1
                _mark_source_error(
                    source,
                    "partial_detail_failure",
                    f"{type(error).__name__}: {error}",
                )

        source.last_verified_at = now
        if discovered > 0:
            source.last_discovered_at = now
        if failed == 0:
            _mark_source_success(source, now)
        session.commit()
        closed = reconcile_missing(
            session,
            source.id,
            seen_external_ids,
            successful_listing=True,
            now=now,
        )
        return CrawlResult(
            discovered=discovered,
            ingested=ingested,
            failed=failed,
            closed=closed,
        )

    if source.source_type == SourceType.PUBLIC_JSON_DETAIL:
        try:
            all_refs = discover_public_json_detail_refs(
                listing.text,
                source.base_url,
                source.connector_family,
            )
            complete_listing = (
                True
                if public_detail_listing_is_self_validated(
                    source.connector_family
                )
                else validate_listing_response(
                    source.source_type,
                    listing.text,
                    listing.url,
                    len(all_refs),
                    source.request_body,
                )
            )
            refs = filter_public_detail_refs(
                all_refs,
                source.connector_family,
            )
        except (KeyError, TypeError, ListingValidationError, ValueError) as error:
            _mark_source_error(source, "listing_parse_error", str(error))
            session.commit()
            return CrawlResult(failed=1)

        discovered = len(refs)
        seen_external_ids = {ref.external_id for ref in refs}
        detail_error: Exception | None = None
        for index, ref in enumerate(refs):
            if index > 0 and request_delay_seconds > 0:
                await asyncio.sleep(request_delay_seconds)
            try:
                detail = await _fetch_public_json_detail(
                    ref,
                    source.connector_family,
                    listing,
                    fetcher,
                )
                opening = parse_public_json_detail(
                    detail.text,
                    ref,
                    source.connector_family,
                )
                ingest_opening(
                    session,
                    source,
                    opening,
                    detail.text,
                    store,
                    now,
                    posting_index,
                )
                ingested += 1
            except BlockedSourceError as error:
                _mark_source_error(
                    source,
                    "blocked",
                    str(error),
                    status=SourceStatus.BLOCKED,
                    policy_status=PolicyStatus.BLOCKED,
                )
                session.commit()
                return CrawlResult(
                    discovered=discovered,
                    ingested=ingested,
                    failed=failed + 1,
                )
            except Exception as error:
                session.rollback()
                logger.exception(
                    "Public JSON detail ingestion failed for %s",
                    ref.detail_url,
                )
                failed += 1
                detail_error = error

        source.last_verified_at = now
        if discovered > 0:
            source.last_discovered_at = now
        if not complete_listing:
            failed += 1
            _mark_source_error(
                source,
                "incomplete_listing",
                "listing response indicates additional pages; absences were not reconciled",
            )
            session.commit()
            return CrawlResult(
                discovered=discovered,
                ingested=ingested,
                failed=failed,
            )

        if detail_error is None:
            _mark_source_success(source, now)
        else:
            _mark_source_error(
                source,
                "partial_detail_failure",
                f"{type(detail_error).__name__}: {detail_error}",
            )
        session.commit()
        closed = reconcile_missing(
            session,
            source.id,
            seen_external_ids,
            successful_listing=True,
            now=now,
        )
        return CrawlResult(
            discovered=discovered,
            ingested=ingested,
            failed=failed,
            closed=closed,
        )

    if source.source_type == SourceType.GREETING:
        try:
            refs = _discover_greeting_source_refs(source, listing.text)
        except (KeyError, TypeError, ValueError) as error:
            _mark_source_error(source, "listing_parse_error", str(error))
            session.commit()
            return CrawlResult(failed=1)

        discovered = len(refs)
        seen_external_ids = {ref.external_id for ref in refs}

        for index, ref in enumerate(refs):
            if index > 0 and request_delay_seconds > 0:
                await asyncio.sleep(request_delay_seconds)
            try:
                detail = await fetcher.fetch(ref.url)
                opening = parse_opening(detail.text, ref.url)
                ingest_opening(
                    session,
                    source,
                    opening,
                    detail.text,
                    store,
                    now,
                    posting_index,
                )
                ingested += 1
            except BlockedSourceError as error:
                _mark_source_error(
                    source,
                    "blocked",
                    str(error),
                    status=SourceStatus.BLOCKED,
                    policy_status=PolicyStatus.BLOCKED,
                )
                session.commit()
                failed += 1
                return CrawlResult(
                    discovered=discovered,
                    ingested=ingested,
                    failed=failed,
                )
            except Exception as error:
                session.rollback()
                logger.exception("Greeting detail ingestion failed for %s", ref.url)
                failed += 1
                _mark_source_error(
                    source,
                    "partial_detail_failure",
                    f"{type(error).__name__}: {error}",
                )

        source.last_verified_at = now
        if discovered > 0:
            source.last_discovered_at = now
        if failed == 0:
            _mark_source_success(source, now)
        session.commit()
        closed = reconcile_missing(
            session,
            source.id,
            seen_external_ids,
            successful_listing=True,
            now=now,
        )
        return CrawlResult(
            discovered=discovered,
            ingested=ingested,
            failed=failed,
            closed=closed,
        )

    try:
        openings = _parse_listing_openings(
            source.source_type,
            listing.text,
            listing.url,
            source.connector_family,
        )
        complete_listing = (
            True
            if _listing_is_self_validated(source.connector_family)
            else validate_listing_response(
                source.source_type,
                listing.text,
                listing.url,
                len(openings),
                source.request_body,
            )
        )
        openings = _apply_source_opening_filters(source, openings)
    except Exception as error:
        session.rollback()
        logger.exception("Listing parse or validation failed for %s", listing.url)
        error_text = str(error)
        if error_text.startswith("connector is not implemented"):
            _mark_source_error(
                source,
                "unsupported_connector",
                error_text,
                status=_unsupported_connector_status(source.source_type),
            )
        else:
            _mark_source_error(source, "listing_parse_error", error_text)
        session.commit()
        return CrawlResult(failed=1)

    discovered = len(openings)
    ingestion_error: Exception | None = None
    for opening in openings:
        seen_external_ids.add(opening.external_id)
        try:
            ingest_opening(
                session,
                source,
                opening,
                listing.text,
                store,
                now,
                posting_index,
            )
            ingested += 1
        except Exception as error:
            session.rollback()
            logger.exception("Opening ingestion failed for %s", opening.url)
            failed += 1
            ingestion_error = error

    source.last_verified_at = now
    if discovered > 0:
        source.last_discovered_at = now

    if not complete_listing:
        failed += 1
        _mark_source_error(
            source,
            "incomplete_listing",
            "listing response indicates additional pages; absences were not reconciled",
        )
        session.commit()
        return CrawlResult(
            discovered=discovered,
            ingested=ingested,
            failed=failed,
        )

    if ingestion_error is not None:
        _mark_source_error(
            source,
            "partial_ingestion_failure",
            f"{type(ingestion_error).__name__}: {ingestion_error}",
        )
    else:
        _mark_source_success(source, now)
    session.commit()
    closed = reconcile_missing(
        session,
        source.id,
        seen_external_ids,
        successful_listing=True,
        now=now,
    )
    return CrawlResult(
        discovered=discovered,
        ingested=ingested,
        failed=failed,
        closed=closed,
    )


def run_source_by_id(source_id: str) -> dict[str, Any]:
    settings = get_settings()
    store = S3SnapshotStore(
        endpoint_url=settings.s3_endpoint_url,
        region=settings.s3_region,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        bucket=settings.s3_bucket,
    )
    posting_index = _posting_index(settings)

    with SessionLocal() as session:
        source = session.get(CareerSource, uuid.UUID(source_id))
        if source is None:
            raise ValueError(f"career source not found: {source_id}")
        result = asyncio.run(
            crawl_source(
                session=session,
                source=source,
                fetcher=HttpFetcher(settings.crawler_user_agent),
                store=store,
                now=datetime.now(timezone.utc),
                posting_index=posting_index,
                browser_renderer=PlaywrightBrowserRenderer(),
            )
        )
        report: dict[str, Any] = asdict(result)
        if result.failed:
            report["error"] = {
                "code": source.last_error_code or "crawl_failed",
                "reason": source.last_error_reason or "source collection failed",
            }
        return report


def preview_source_by_id(source_id: str) -> dict[str, Any]:
    settings = get_settings()

    with SessionLocal() as session:
        source = session.get(CareerSource, uuid.UUID(source_id))
        if source is None:
            raise ValueError(f"career source not found: {source_id}")
        return asyncio.run(
            preview_source(
                source=source,
                fetcher=HttpFetcher(settings.crawler_user_agent),
                browser_renderer=PlaywrightBrowserRenderer(),
            )
        )


def _posting_index(settings: Settings) -> PostingIndex | None:
    if settings.search_backend == "postgres":
        return None
    return MeiliPostingIndex(
        settings.meili_url,
        settings.meili_master_key,
    )


def _allowed_sources() -> list[SourceRunTarget]:
    with SessionLocal() as session:
        statement = (
            select(CareerSource)
            .options(joinedload(CareerSource.company))
            .where(
                CareerSource.status == SourceStatus.ALLOWED,
                CareerSource.policy_status == PolicyStatus.ALLOWED,
            )
            .order_by(CareerSource.base_url)
        )
        return [
            SourceRunTarget(
                str(source.id),
                f"{source.company.name} / {source.source_type.value}",
            )
            for source in session.scalars(statement)
        ]


def _allowed_source_ids() -> list[str]:
    return [target.source_id for target in _allowed_sources()]


def _capture_run_market_snapshot(
    results: list[dict[str, Any]],
    total_sources: int,
) -> dict[str, Any]:
    verified_sources = sum(item["failed"] == 0 for item in results)
    with SessionLocal() as session:
        snapshot = capture_skill_demand_snapshot(
            session,
            verified_sources=verified_sources,
            total_sources=total_sources,
        )
        session.commit()
        return {
            "observed_on": snapshot.observed_on.isoformat(),
            "open_postings": snapshot.open_postings,
            "verified_sources": snapshot.verified_sources,
            "total_sources": snapshot.total_sources,
            "skill_count": snapshot.skill_count,
        }


def run_all_sources() -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    targets = _allowed_sources()
    total_sources = len(targets)

    for index, target in enumerate(targets, start=1):
        print(
            f"crawl source {index}/{total_sources} started: {target.label}",
            flush=True,
        )
        started_at = time.monotonic()
        try:
            counts = run_source_by_id(target.source_id)
        except Exception as error:
            logger.exception("Source %s failed unexpectedly", target.source_id)
            counts = {
                "discovered": 0,
                "ingested": 0,
                "failed": 1,
                "closed": 0,
                "error": type(error).__name__,
            }
        elapsed_seconds = time.monotonic() - started_at
        print(
            f"crawl source {index}/{total_sources} finished: {target.label} "
            f"discovered={counts['discovered']} "
            f"ingested={counts['ingested']} "
            f"failed={counts['failed']} "
            f"closed={counts['closed']} "
            f"elapsed={elapsed_seconds:.1f}s",
            flush=True,
        )
        results.append(
            {
                "source_id": target.source_id,
                "source_label": target.label,
                "elapsed_seconds": elapsed_seconds,
                **counts,
            }
        )

    market_snapshot = _capture_run_market_snapshot(results, total_sources)
    print(
        "market snapshot captured: "
        f"date={market_snapshot['observed_on']} "
        f"open_postings={market_snapshot['open_postings']} "
        f"skills={market_snapshot['skill_count']} "
        f"verified_sources={market_snapshot['verified_sources']}/"
        f"{market_snapshot['total_sources']}",
        flush=True,
    )

    return {
        "sources": len(results),
        "discovered": sum(item["discovered"] for item in results),
        "ingested": sum(item["ingested"] for item in results),
        "failed": sum(item["failed"] for item in results),
        "closed": sum(item["closed"] for item in results),
        "market_snapshot": market_snapshot,
        "results": results,
    }


def render_crawl_summary(report: dict[str, Any]) -> str:
    lines = [
        "## 원격 수집 결과",
        "",
        "| 출처 | 발견 | 저장 | 실패 | 마감 |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for result in report["results"]:
        source_label = str(
            result.get("source_label") or result["source_id"]
        ).replace("|", "\\|")
        lines.append(
            f"| {source_label} | {result['discovered']} | "
            f"{result['ingested']} | {result['failed']} | "
            f"{result['closed']} |"
        )
    lines.append(
        f"| 합계 | {report['discovered']} | {report['ingested']} | "
        f"{report['failed']} | {report['closed']} |"
    )
    return "\n".join(lines) + "\n"
