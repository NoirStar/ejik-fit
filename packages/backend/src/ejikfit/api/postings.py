from __future__ import annotations

import logging
import uuid
from typing import Protocol

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, contains_eager, joinedload, selectinload

from ejikfit.db import SessionLocal
from ejikfit.html_text import structured_plain_text
from ejikfit.models import Company, JobPosting, PostingSkill, PostingStatus
from ejikfit.search import MeiliPostingIndex
from ejikfit.skill_extraction import CONFIRMED_CONFIDENCE
from ejikfit.skills import confirmed_skill_groups

from .schemas import PostingDetail, PostingListResponse


logger = logging.getLogger(__name__)


class PostingReader(Protocol):
    def list(
        self,
        q: str | None = None,
        company: str | None = None,
        career_type: str | None = None,
        category: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]: ...

    def count(
        self,
        q: str | None = None,
        company: str | None = None,
        career_type: str | None = None,
        category: str | None = None,
    ) -> int: ...


def _summary(posting: JobPosting) -> dict:
    skill_groups = confirmed_skill_groups(posting.skills)
    return {
        "id": posting.id,
        "title": posting.title,
        "company_name": posting.company.name,
        "company_slug": posting.company.slug,
        "career_type": posting.career_type,
        "employment_type": posting.employment_type,
        "career_min": posting.career_min,
        "career_max": posting.career_max,
        "location": posting.location,
        "status": posting.status.value,
        "source_url": posting.url,
        "first_seen_at": posting.first_seen_at,
        "last_verified_at": posting.last_verified_at,
        "opens_at": posting.opens_at,
        "closes_at": posting.closes_at,
        "required_skills": list(skill_groups.required),
        "preferred_skills": list(skill_groups.preferred),
        "unspecified_skills": list(skill_groups.unspecified),
    }


def _detail(posting: JobPosting) -> dict:
    requirement_order = {
        "required": 0,
        "preferred": 1,
        "unspecified": 2,
    }
    confirmed = sorted(
        (
            skill
            for skill in posting.skills
            if skill.confidence >= CONFIRMED_CONFIDENCE
        ),
        key=lambda skill: (
            requirement_order.get(skill.requirement_type, 3),
            skill.skill,
        ),
    )
    return {
        **_summary(posting),
        "description_html": posting.description_html,
        "description_text": structured_plain_text(
            posting.description_html,
            posting.description_text,
        ),
        "opens_at": posting.opens_at,
        "closes_at": posting.closes_at,
        "skills": sorted(skill.skill for skill in confirmed),
        "skill_details": [
            {
                "skill": skill.skill,
                "category": skill.category,
                "requirement_type": skill.requirement_type,
                "evidence_text": skill.evidence_text,
                "confidence": skill.confidence,
                "match_reason": skill.match_reason,
            }
            for skill in confirmed
        ],
    }


def _posting_search_clause(q: str, use_pgroonga: bool):
    confirmed_skill = JobPosting.skills.any(
        and_(
            PostingSkill.confidence >= CONFIRMED_CONFIDENCE,
            PostingSkill.skill.ilike(f"%{q}%"),
        )
    )
    if use_pgroonga:
        return or_(
            JobPosting.title.bool_op("&@~")(q),
            JobPosting.description_text.bool_op("&@~")(q),
            JobPosting.location.bool_op("&@~")(q),
            Company.name.ilike(f"%{q}%"),
            confirmed_skill,
        )

    pattern = f"%{q}%"
    return or_(
        JobPosting.title.ilike(pattern),
        JobPosting.description_text.ilike(pattern),
        JobPosting.location.ilike(pattern),
        Company.name.ilike(pattern),
        confirmed_skill,
    )


class DatabasePostingReader:
    def __init__(
        self,
        session_factory=SessionLocal,
        search_index: MeiliPostingIndex | None = None,
        use_pgroonga: bool = False,
    ) -> None:
        self.session_factory = session_factory
        self.search_index = search_index
        self.use_pgroonga = use_pgroonga

    def list(
        self,
        q: str | None = None,
        company: str | None = None,
        career_type: str | None = None,
        category: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        if q and self.search_index is not None and not category:
            try:
                return self.search_index.search(
                    q,
                    company=company,
                    career_type=career_type,
                    limit=limit,
                    offset=offset,
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
                category=category,
                limit=limit,
                offset=offset,
            )

    def _list_from_database(
        self,
        session: Session,
        *,
        q: str | None,
        company: str | None,
        career_type: str | None,
        category: str | None,
        limit: int,
        offset: int,
    ) -> list[dict]:
        statement = (
            select(JobPosting)
            .join(JobPosting.company)
            .options(
                contains_eager(JobPosting.company),
                selectinload(JobPosting.skills),
            )
            .where(JobPosting.status == PostingStatus.OPEN)
            .order_by(
                JobPosting.first_seen_at.desc(),
                JobPosting.last_verified_at.desc(),
                JobPosting.id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )
        if q:
            statement = statement.where(
                _posting_search_clause(q, self.use_pgroonga)
            )
        if company:
            statement = statement.where(Company.slug == company)
        if career_type:
            statement = statement.where(
                JobPosting.career_type == career_type
            )
        if category:
            statement = statement.where(
                JobPosting.skills.any(
                    and_(
                        PostingSkill.category == category,
                        PostingSkill.confidence >= CONFIRMED_CONFIDENCE,
                    )
                )
            )

        return [
            _summary(posting)
            for posting in session.scalars(statement).unique().all()
        ]

    def count(
        self,
        q: str | None = None,
        company: str | None = None,
        career_type: str | None = None,
        category: str | None = None,
    ) -> int:
        with self.session_factory() as session:
            statement = (
                select(func.count(JobPosting.id))
                .select_from(JobPosting)
                .join(JobPosting.company)
                .where(JobPosting.status == PostingStatus.OPEN)
            )
            if q:
                statement = statement.where(
                    _posting_search_clause(q, self.use_pgroonga)
                )
            if company:
                statement = statement.where(Company.slug == company)
            if career_type:
                statement = statement.where(
                    JobPosting.career_type == career_type
                )
            if category:
                statement = statement.where(
                    JobPosting.skills.any(
                        and_(
                            PostingSkill.category == category,
                            PostingSkill.confidence >= CONFIRMED_CONFIDENCE,
                        )
                    )
                )
            return int(session.scalar(statement) or 0)

    def get(self, posting_id: str) -> dict | None:
        try:
            identifier = uuid.UUID(posting_id)
        except ValueError:
            return None

        with self.session_factory() as session:
            statement = (
                select(JobPosting)
                .options(
                    joinedload(JobPosting.company),
                    selectinload(JobPosting.skills),
                )
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
        category: str | None = Query(default=None, max_length=64),
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=100_000),
    ) -> dict:
        items = reader.list(
            q=q,
            company=company,
            career_type=career_type,
            category=category,
            limit=limit,
            offset=offset,
        )
        total = reader.count(
            q=q,
            company=company,
            career_type=career_type,
            category=category,
        )
        return {"items": items, "total": total}

    @router.get("/{posting_id}", response_model=PostingDetail)
    def get_posting(posting_id: str) -> dict:
        get = getattr(reader, "get", None)
        item = get(posting_id) if callable(get) else None
        if item is None:
            raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다.")
        return item

    return router
