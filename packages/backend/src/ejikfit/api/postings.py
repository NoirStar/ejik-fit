from __future__ import annotations

import logging
import uuid
from typing import Protocol

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ejikfit.db import SessionLocal
from ejikfit.models import Company, JobPosting, PostingStatus
from ejikfit.search import MeiliPostingIndex

from .schemas import PostingDetail, PostingListResponse


logger = logging.getLogger(__name__)


class PostingReader(Protocol):
    def list(
        self,
        q: str | None = None,
        company: str | None = None,
        career_type: str | None = None,
        limit: int = 20,
    ) -> list[dict]: ...


def _summary(posting: JobPosting) -> dict:
    return {
        "id": posting.id,
        "title": posting.title,
        "company_name": posting.company.name,
        "career_type": posting.career_type,
        "employment_type": posting.employment_type,
        "career_min": posting.career_min,
        "career_max": posting.career_max,
        "location": posting.location,
        "status": posting.status.value,
        "source_url": posting.url,
        "last_verified_at": posting.last_verified_at,
    }


def _detail(posting: JobPosting) -> dict:
    return {
        **_summary(posting),
        "description_html": posting.description_html,
        "description_text": posting.description_text,
        "opens_at": posting.opens_at,
        "closes_at": posting.closes_at,
    }


class DatabasePostingReader:
    def __init__(
        self,
        session_factory=SessionLocal,
        search_index: MeiliPostingIndex | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.search_index = search_index

    def list(
        self,
        q: str | None = None,
        company: str | None = None,
        career_type: str | None = None,
        limit: int = 20,
    ) -> list[dict]:
        if q and self.search_index is not None:
            try:
                return self.search_index.search(
                    q,
                    company=company,
                    career_type=career_type,
                    limit=limit,
                )
            except Exception:
                logger.exception(
                    "Meilisearch query failed; falling back to PostgreSQL"
                )

        with self.session_factory() as session:
            return self._list_from_database(
                session,
                q=q,
                company=company,
                career_type=career_type,
                limit=limit,
            )

    def _list_from_database(
        self,
        session: Session,
        *,
        q: str | None,
        company: str | None,
        career_type: str | None,
        limit: int,
    ) -> list[dict]:
        statement = (
            select(JobPosting)
            .options(joinedload(JobPosting.company))
            .where(JobPosting.status == PostingStatus.OPEN)
            .order_by(JobPosting.last_verified_at.desc())
            .limit(limit)
        )
        if q:
            pattern = f"%{q}%"
            statement = statement.where(
                or_(
                    JobPosting.title.ilike(pattern),
                    JobPosting.description_text.ilike(pattern),
                )
            )
        if company:
            statement = statement.join(JobPosting.company).where(
                Company.slug == company
            )
        if career_type:
            statement = statement.where(
                JobPosting.career_type == career_type
            )

        return [
            _summary(posting)
            for posting in session.scalars(statement).unique().all()
        ]

    def get(self, posting_id: str) -> dict | None:
        try:
            identifier = uuid.UUID(posting_id)
        except ValueError:
            return None

        with self.session_factory() as session:
            statement = (
                select(JobPosting)
                .options(joinedload(JobPosting.company))
                .where(JobPosting.id == identifier)
            )
            posting = session.scalar(statement)
            return _detail(posting) if posting is not None else None


def create_postings_router(reader: PostingReader) -> APIRouter:
    router = APIRouter(prefix="/api/postings", tags=["postings"])

    @router.get("", response_model=PostingListResponse)
    def list_postings(
        q: str | None = Query(default=None, max_length=200),
        company: str | None = Query(default=None, max_length=120),
        career_type: str | None = Query(default=None, max_length=100),
        limit: int = Query(default=20, ge=1, le=100),
    ) -> dict:
        items = reader.list(
            q=q,
            company=company,
            career_type=career_type,
            limit=limit,
        )
        return {"items": items, "total": len(items)}

    @router.get("/{posting_id}", response_model=PostingDetail)
    def get_posting(posting_id: str) -> dict:
        get = getattr(reader, "get", None)
        item = get(posting_id) if callable(get) else None
        if item is None:
            raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다.")
        return item

    return router
