import asyncio
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Mapping

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ejikfit.config import get_settings
from ejikfit.connectors.greeting import discover_openings, parse_opening
from ejikfit.connectors.jsonld import parse_jsonld_openings
from ejikfit.db import SessionLocal
from ejikfit.ingestion import ingest_opening
from ejikfit.models import (
    CareerSource,
    JobPosting,
    PostingStatus,
    SourceStatus,
    SourceType,
)
from ejikfit.storage import S3SnapshotStore, SnapshotStore
from ejikfit.search import MeiliPostingIndex, PostingIndex


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

                lowered = response.text.lower()
                blocked_markers = (
                    "captcha",
                    "verify you are human",
                    "cloudflare challenge",
                    "캡차",
                )
                if any(marker in lowered for marker in blocked_markers):
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
    except BlockedSourceError:
        source.status = SourceStatus.REVIEW
        session.commit()
        return CrawlResult(failed=1)
    except (httpx.HTTPError, RetryableFetchError):
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
            except BlockedSourceError:
                source.status = SourceStatus.REVIEW
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
        openings = parse_jsonld_openings(listing.text, listing.url)
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

    source.last_verified_at = now
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
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        bucket=settings.s3_bucket,
    )
    posting_index = MeiliPostingIndex(
        settings.meili_url,
        settings.meili_master_key,
    )

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
