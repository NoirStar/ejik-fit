import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ejikfit.connectors.types import ParsedOpening
from ejikfit.models import (
    CareerSource,
    JobPosting,
    JobRevision,
    PostingStatus,
    RawSnapshot,
)
from ejikfit.storage import SnapshotStore
from ejikfit.search import PostingIndex


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IngestionResult:
    posting: JobPosting
    created: bool
    revision_created: bool
    snapshot: RawSnapshot


def _normalized_payload(opening: ParsedOpening) -> dict[str, Any]:
    return {
        "external_id": opening.external_id,
        "url": opening.url,
        "title": opening.title,
        "status": opening.status,
        "description_html": opening.description_html,
        "description_text": opening.description_text,
        "employment_type": opening.employment_type,
        "career_type": opening.career_type,
        "career_min": opening.career_min,
        "career_max": opening.career_max,
        "location": opening.location,
        "opens_at": opening.opens_at.isoformat() if opening.opens_at else None,
        "closes_at": (
            opening.closes_at.isoformat() if opening.closes_at else None
        ),
    }


def _revision_hash(payload: dict[str, Any]) -> str:
    serialized = json.dumps(
        payload,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(serialized.encode()).hexdigest()


def _apply_opening(
    posting: JobPosting,
    opening: ParsedOpening,
    now: datetime,
) -> None:
    posting.url = opening.url
    posting.title = opening.title
    posting.status = PostingStatus(opening.status)
    posting.description_html = opening.description_html
    posting.description_text = opening.description_text
    posting.employment_type = opening.employment_type
    posting.career_type = opening.career_type
    posting.career_min = opening.career_min
    posting.career_max = opening.career_max
    posting.location = opening.location
    posting.opens_at = opening.opens_at
    posting.closes_at = opening.closes_at
    posting.last_seen_at = now
    posting.last_verified_at = now
    posting.missing_runs = 0


def ingest_opening(
    session: Session,
    source: CareerSource,
    opening: ParsedOpening,
    raw_html: str,
    store: SnapshotStore,
    now: datetime,
    posting_index: PostingIndex | None = None,
) -> IngestionResult:
    storage_key, raw_hash = store.put(
        raw_html.encode(),
        "text/html; charset=utf-8",
    )
    snapshot = RawSnapshot(
        source_id=source.id,
        url=opening.url,
        content_hash=raw_hash,
        storage_key=storage_key,
        fetched_at=now,
        http_status=200,
    )
    session.add(snapshot)
    session.flush()

    posting = session.scalar(
        select(JobPosting).where(
            JobPosting.source_id == source.id,
            JobPosting.external_id == opening.external_id,
        )
    )
    created = posting is None
    if posting is None:
        posting = JobPosting(
            company_id=source.company_id,
            source_id=source.id,
            external_id=opening.external_id,
            url=opening.url,
            title=opening.title,
            first_seen_at=now,
            last_seen_at=now,
            last_verified_at=now,
        )
        session.add(posting)

    _apply_opening(posting, opening, now)
    session.flush()

    payload = _normalized_payload(opening)
    content_hash = _revision_hash(payload)
    revision = session.scalar(
        select(JobRevision).where(
            JobRevision.posting_id == posting.id,
            JobRevision.content_hash == content_hash,
        )
    )
    revision_created = revision is None
    if revision is None:
        session.add(
            JobRevision(
                posting_id=posting.id,
                snapshot_id=snapshot.id,
                content_hash=content_hash,
                payload=payload,
                created_at=now,
            )
        )

    session.commit()
    if posting_index is not None:
        try:
            posting_index.upsert(posting)
        except Exception:
            logger.exception(
                "Posting %s was stored but search indexing failed",
                posting.id,
            )
    return IngestionResult(
        posting=posting,
        created=created,
        revision_created=revision_created,
        snapshot=snapshot,
    )
