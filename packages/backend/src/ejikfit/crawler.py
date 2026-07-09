import asyncio
import logging
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Mapping

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
from ejikfit.connectors.enterprise_json import parse_enterprise_json_openings
from ejikfit.connectors.greeting import discover_openings, parse_opening
from ejikfit.connectors.html_listing import parse_html_listing_openings
from ejikfit.connectors.jsonld import parse_jsonld_openings
from ejikfit.connectors.kakao import parse_kakao_openings
from ejikfit.connectors.lever_greenhouse import parse_lever_greenhouse_openings
from ejikfit.connectors.line_gatsby import parse_line_gatsby_openings
from ejikfit.connectors.naver import parse_naver_openings
from ejikfit.connectors.next_data import parse_static_next_data_openings
from ejikfit.db import SessionLocal
from ejikfit.ingestion import ingest_opening
from ejikfit.models import (
    CareerSource,
    JobPosting,
    PolicyStatus,
    PostingStatus,
    SourceStatus,
    SourceType,
)
from ejikfit.search import MeiliPostingIndex, PostingIndex
from ejikfit.storage import S3SnapshotStore, SnapshotStore


logger = logging.getLogger(__name__)


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

    async def fetch(self, url: str) -> FetchedPage:
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
                    headers={"User-Agent": self.user_agent},
                ) as client:
                    response = await client.get(url)

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
) -> int:
    postings = session.scalars(
        select(JobPosting).where(JobPosting.source_id == source_id)
    ).all()
    closed = 0

    for posting in postings:
        was_closed = posting.status == PostingStatus.CLOSED
        posting.missing_runs, posting.status = next_missing_state(
            posting.missing_runs,
            successful_listing=successful_listing,
            seen=posting.external_id in seen_external_ids,
        )
        if not was_closed and posting.status == PostingStatus.CLOSED:
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
        return parse_html_listing_openings(text, url)
    if source_type == SourceType.STATIC_NEXT_DATA:
        return parse_static_next_data_openings(text, url)
    if source_type == SourceType.ENTERPRISE_JSON:
        return parse_enterprise_json_openings(text, url)
    if source_type == SourceType.LEVER_GREENHOUSE:
        return parse_lever_greenhouse_openings(text, url)
    raise ValueError(f"connector is not implemented: {source_type.value}")


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
) -> dict[str, Any]:
    return {
        "source_id": str(source.id),
        "source_label": _source_label(source),
        "source_type": source.source_type.value,
        "discovered": discovered,
        "sample_openings": sample_openings or [],
        "error": error,
    }


async def preview_source(
    source: CareerSource,
    fetcher: HttpFetcher,
    sample_limit: int = 5,
) -> dict[str, Any]:
    try:
        listing = await fetcher.fetch(source.base_url)
        openings = _parse_listing_openings(
            source.source_type,
            listing.text,
            listing.url,
        )
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
    except (KeyError, TypeError, ValueError) as error:
        return _preview_payload(
            source,
            error={
                "code": "unsupported_connector",
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
    )


async def crawl_source(
    session: Session,
    source: CareerSource,
    fetcher: HttpFetcher,
    store: SnapshotStore,
    now: datetime,
    request_delay_seconds: float = 1.0,
    posting_index: PostingIndex | None = None,
) -> CrawlResult:
    if source.status != SourceStatus.ALLOWED:
        return CrawlResult()

    try:
        listing = await fetcher.fetch(source.base_url)
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

    if source.source_type == SourceType.GREETING:
        try:
            refs = discover_openings(listing.text, source.base_url)
        except (KeyError, TypeError, ValueError):
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
                break
            except (
                httpx.HTTPError,
                RetryableFetchError,
                KeyError,
                TypeError,
                ValueError,
            ):
                failed += 1
    elif source.source_type == SourceType.JSON_LD:
        openings = _parse_listing_openings(
            source.source_type,
            listing.text,
            listing.url,
        )
        discovered = len(openings)
        for opening in openings:
            seen_external_ids.add(opening.external_id)
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
    elif source.source_type in {
        SourceType.NAVER_JSON,
        SourceType.KAKAO_JSON,
        SourceType.LINE_GATSBY,
        SourceType.STATIC_NEXT_DATA,
        SourceType.ENTERPRISE_JSON,
        SourceType.LEVER_GREENHOUSE,
    }:
        openings = _parse_listing_openings(
            source.source_type,
            listing.text,
            listing.url,
        )
        discovered = len(openings)
        for opening in openings:
            seen_external_ids.add(opening.external_id)
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
    elif source.source_type == SourceType.HTML_LISTING_DETAIL:
        openings = _parse_listing_openings(
            source.source_type,
            listing.text,
            listing.url,
        )
        discovered = len(openings)
        for opening in openings:
            seen_external_ids.add(opening.external_id)
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
    else:
        _mark_source_error(
            source,
            "unsupported_connector",
            f"connector is not implemented: {source.source_type.value}",
            status=_unsupported_connector_status(source.source_type),
        )
        session.commit()
        return CrawlResult(failed=1)

    _mark_source_success(source, now)
    if discovered > 0:
        source.last_discovered_at = now
    session.commit()
    closed = reconcile_missing(
        session,
        source.id,
        seen_external_ids,
        successful_listing=True,
    )
    return CrawlResult(
        discovered=discovered,
        ingested=ingested,
        failed=failed,
        closed=closed,
    )


def run_source_by_id(source_id: str) -> dict[str, int]:
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
            )
        )
    return asdict(result)


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
            .where(CareerSource.status == SourceStatus.ALLOWED)
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

    return {
        "sources": len(results),
        "discovered": sum(item["discovered"] for item in results),
        "ingested": sum(item["ingested"] for item in results),
        "failed": sum(item["failed"] for item in results),
        "closed": sum(item["closed"] for item in results),
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
