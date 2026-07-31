from __future__ import annotations

import logging
import re
import uuid
from collections.abc import Sequence
from typing import Protocol

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import Float, and_, case, cast, func, or_, select
from sqlalchemy.orm import Session, contains_eager, joinedload, selectinload

from ejikfit.db import SessionLocal
from ejikfit.html_text import structured_plain_text
from ejikfit.models import Company, JobPosting, PostingSkill, PostingStatus
from ejikfit.posting_content import posting_description_images
from ejikfit.posting_recommendations import recommendation_window
from ejikfit.search import MeiliPostingIndex
from ejikfit.skill_catalog import canonicalize_skill_inputs
from ejikfit.skill_extraction import CONFIRMED_CONFIDENCE
from ejikfit.skills import confirmed_skill_groups

from .schemas import PostingDetail, PostingListResponse


logger = logging.getLogger(__name__)
COMPANY_SLUG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,119}$")
MAX_COMPANY_FILTERS = 20
COMPANY_DIVERSITY_BATCH_SIZE = 5
PERSONALIZED_COMPANY_BATCH_SIZE = 2
MAX_OWNED_SKILLS = 20
PUBLIC_POSTINGS_CACHE = "public, s-maxage=60, stale-while-revalidate=300"
POSTING_DESCRIPTION_EXCERPT_LENGTH = 1_200


def _company_slugs(value: str | None) -> list[str]:
    if not value:
        return []
    return list(
        dict.fromkeys(
            slug
            for part in value.split(",")
            if (slug := part.strip()) and COMPANY_SLUG_PATTERN.fullmatch(slug)
        )
    )[:MAX_COMPANY_FILTERS]


class PostingReader(Protocol):
    def list(
        self,
        q: str | None = None,
        company: str | None = None,
        career_type: str | None = None,
        category: str | None = None,
        limit: int = 20,
        offset: int = 0,
        owned_skills: Sequence[str] = (),
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
    description_excerpt = structured_plain_text(
        posting.description_html,
        posting.description_text,
    )[:POSTING_DESCRIPTION_EXCERPT_LENGTH].strip()
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
        "skill_categories": sorted(
            {
                skill.category
                for skill in posting.skills
                if skill.confidence >= CONFIRMED_CONFIDENCE
            }
        ),
        "description_excerpt": description_excerpt or None,
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
    description_text = structured_plain_text(
        posting.description_html,
        posting.description_text,
    )
    return {
        **_summary(posting),
        "description_html": posting.description_html,
        "description_text": description_text,
        "description_images": posting_description_images(
            posting.description_html,
            description_text,
            posting.url,
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
        owned_skills: Sequence[str] = (),
    ) -> list[dict]:
        canonical_owned_skills = canonicalize_skill_inputs(owned_skills)[
            :MAX_OWNED_SKILLS
        ]
        company_slugs = _company_slugs(company)
        if (
            q
            and self.search_index is not None
            and not category
            and not canonical_owned_skills
            and len(company_slugs) <= 1
        ):
            try:
                return self.search_index.search(
                    q,
                    company=company_slugs[0] if company_slugs else None,
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
                owned_skills=canonical_owned_skills,
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
        owned_skills: Sequence[str] = (),
    ) -> list[dict]:
        if owned_skills:
            return self._list_personalized_from_database(
                session,
                q=q,
                company=company,
                career_type=career_type,
                category=category,
                limit=limit,
                offset=offset,
                owned_skills=owned_skills,
            )

        company_position = func.row_number().over(
            partition_by=JobPosting.company_id,
            order_by=(
                JobPosting.first_seen_at.desc(),
                JobPosting.last_verified_at.desc(),
                JobPosting.id.desc(),
            ),
        )
        company_round = (company_position - 1).self_group().op("/")(
            COMPANY_DIVERSITY_BATCH_SIZE
        )
        statement = (
            select(JobPosting)
            .join(JobPosting.company)
            .options(
                contains_eager(JobPosting.company),
                selectinload(JobPosting.skills),
            )
            .where(JobPosting.status == PostingStatus.OPEN)
            .order_by(
                company_round,
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
        company_slugs = _company_slugs(company)
        if company_slugs:
            statement = statement.where(Company.slug.in_(company_slugs))
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

    def _list_personalized_from_database(
        self,
        session: Session,
        *,
        q: str | None,
        company: str | None,
        career_type: str | None,
        category: str | None,
        limit: int,
        offset: int,
        owned_skills: Sequence[str],
    ) -> list[dict]:
        confirmed = PostingSkill.confidence >= CONFIRMED_CONFIDENCE
        owned = PostingSkill.skill.in_(owned_skills)
        required = PostingSkill.requirement_type == "required"
        preferred = PostingSkill.requirement_type == "preferred"
        unspecified = PostingSkill.requirement_type == "unspecified"
        skill_stats = (
            select(
                PostingSkill.posting_id.label("posting_id"),
                func.sum(case((and_(confirmed, required), 1), else_=0)).label(
                    "required_total"
                ),
                func.sum(
                    case((and_(confirmed, owned, required), 1), else_=0)
                ).label("matched_required"),
                func.sum(
                    case((and_(confirmed, owned, preferred), 1), else_=0)
                ).label("matched_preferred"),
                func.sum(
                    case((and_(confirmed, owned, unspecified), 1), else_=0)
                ).label("matched_unspecified"),
            )
            .group_by(PostingSkill.posting_id)
            .subquery()
        )
        required_total = func.coalesce(skill_stats.c.required_total, 0)
        matched_required = func.coalesce(skill_stats.c.matched_required, 0)
        matched_preferred = func.coalesce(skill_stats.c.matched_preferred, 0)
        matched_unspecified = func.coalesce(
            skill_stats.c.matched_unspecified,
            0,
        )
        matched_total = (
            matched_required + matched_preferred + matched_unspecified
        )
        required_coverage = case(
            (
                required_total > 0,
                cast(matched_required, Float) / cast(required_total, Float),
            ),
            else_=0.0,
        )
        base = (
            select(
                JobPosting.id.label("posting_id"),
                JobPosting.company_id.label("company_id"),
                JobPosting.first_seen_at.label("first_seen_at"),
                JobPosting.last_verified_at.label("last_verified_at"),
                matched_required.label("matched_required"),
                required_coverage.label("required_coverage"),
                matched_preferred.label("matched_preferred"),
                matched_unspecified.label("matched_unspecified"),
                matched_total.label("matched_total"),
            )
            .select_from(JobPosting)
            .join(JobPosting.company)
            .outerjoin(
                skill_stats,
                skill_stats.c.posting_id == JobPosting.id,
            )
            .where(JobPosting.status == PostingStatus.OPEN)
        )
        if q:
            base = base.where(_posting_search_clause(q, self.use_pgroonga))
        company_slugs = _company_slugs(company)
        if company_slugs:
            base = base.where(Company.slug.in_(company_slugs))
        if career_type:
            base = base.where(JobPosting.career_type == career_type)
        if category:
            base = base.where(
                JobPosting.skills.any(
                    and_(
                        PostingSkill.category == category,
                        PostingSkill.confidence >= CONFIRMED_CONFIDENCE,
                    )
                )
            )
        base = base.subquery()

        totals = session.execute(
            select(
                func.sum(case((base.c.matched_total > 0, 1), else_=0)),
                func.sum(case((base.c.matched_total == 0, 1), else_=0)),
            ).select_from(base)
        ).one()
        matched_total_count = int(totals[0] or 0)
        exploration_total_count = int(totals[1] or 0)
        window = recommendation_window(
            matched_total_count,
            exploration_total_count,
            offset=offset,
            limit=limit,
        )
        if not window.pattern:
            return []

        personalized_order = (
            base.c.matched_required.desc(),
            base.c.required_coverage.desc(),
            base.c.matched_preferred.desc(),
            base.c.matched_unspecified.desc(),
            base.c.matched_total.desc(),
            base.c.first_seen_at.desc(),
            base.c.last_verified_at.desc(),
            base.c.posting_id.desc(),
        )
        exploration_order = (
            base.c.first_seen_at.desc(),
            base.c.last_verified_at.desc(),
            base.c.posting_id.desc(),
        )

        matched_ids = self._personalized_stream_ids(
            session,
            base=base,
            match_stream=True,
            order_by=personalized_order,
            offset=window.matched_offset,
            limit=window.pattern.count("matched"),
        )
        exploration_ids = self._personalized_stream_ids(
            session,
            base=base,
            match_stream=False,
            order_by=exploration_order,
            offset=window.exploration_offset,
            limit=window.pattern.count("explore"),
        )
        posting_ids = matched_ids + exploration_ids
        postings = session.scalars(
            select(JobPosting)
            .options(
                joinedload(JobPosting.company),
                selectinload(JobPosting.skills),
            )
            .where(JobPosting.id.in_(posting_ids))
        ).unique().all()
        posting_by_id = {posting.id: posting for posting in postings}
        matched_iter = iter(matched_ids)
        exploration_iter = iter(exploration_ids)
        ordered_ids = [
            next(matched_iter) if stream == "matched" else next(exploration_iter)
            for stream in window.pattern
        ]
        return [_summary(posting_by_id[posting_id]) for posting_id in ordered_ids]

    @staticmethod
    def _personalized_stream_ids(
        session: Session,
        *,
        base,
        match_stream: bool,
        order_by: tuple,
        offset: int,
        limit: int,
    ) -> list[uuid.UUID]:
        if limit == 0:
            return []
        company_position = func.row_number().over(
            partition_by=base.c.company_id,
            order_by=order_by,
        ).label("company_position")
        ranked = (
            select(base, company_position)
            .where(
                base.c.matched_total > 0
                if match_stream
                else base.c.matched_total == 0
            )
            .subquery()
        )
        company_round = (ranked.c.company_position - 1).self_group().op("/")(
            PERSONALIZED_COMPANY_BATCH_SIZE
        )
        ranked_order = (
            (
                ranked.c.matched_required.desc(),
                ranked.c.required_coverage.desc(),
                ranked.c.matched_preferred.desc(),
                ranked.c.matched_unspecified.desc(),
                ranked.c.matched_total.desc(),
                ranked.c.first_seen_at.desc(),
                ranked.c.last_verified_at.desc(),
                ranked.c.posting_id.desc(),
            )
            if match_stream
            else (
                ranked.c.first_seen_at.desc(),
                ranked.c.last_verified_at.desc(),
                ranked.c.posting_id.desc(),
            )
        )
        statement = (
            select(ranked.c.posting_id)
            .order_by(company_round, *ranked_order)
            .offset(offset)
            .limit(limit)
        )
        return list(session.scalars(statement))

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
            company_slugs = _company_slugs(company)
            if company_slugs:
                statement = statement.where(Company.slug.in_(company_slugs))
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
        response: Response,
        q: str | None = Query(default=None, max_length=200),
        company: str | None = Query(default=None, max_length=120),
        companies: list[str] | None = Query(default=None),
        career_type: str | None = Query(default=None, max_length=100),
        category: str | None = Query(default=None, max_length=64),
        owned_skills: list[str] | None = Query(default=None, max_length=100),
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=100_000),
    ) -> dict:
        company_values = [company] if company else []
        company_values.extend(companies or [])
        if len(company_values) > MAX_COMPANY_FILTERS or any(
            not COMPANY_SLUG_PATTERN.fullmatch(value)
            for value in company_values
        ):
            raise HTTPException(status_code=422, detail="invalid company filter")
        company_filter = ",".join(dict.fromkeys(company_values)) or None
        canonical_owned_skills = canonicalize_skill_inputs(owned_skills or [])
        if len(canonical_owned_skills) > MAX_OWNED_SKILLS:
            raise HTTPException(
                status_code=422,
                detail=f"owned_skills supports at most {MAX_OWNED_SKILLS} values",
            )
        response.headers["Cache-Control"] = (
            "private, no-store"
            if canonical_owned_skills
            else PUBLIC_POSTINGS_CACHE
        )
        items = reader.list(
            q=q,
            company=company_filter,
            career_type=career_type,
            category=category,
            limit=limit,
            offset=offset,
            owned_skills=canonical_owned_skills,
        )
        total = reader.count(
            q=q,
            company=company_filter,
            career_type=career_type,
            category=category,
        )
        return {
            "items": items,
            "total": total,
            "canonical_owned_skills": canonical_owned_skills,
        }

    @router.get("/{posting_id}", response_model=PostingDetail)
    def get_posting(posting_id: str) -> dict:
        get = getattr(reader, "get", None)
        item = get(posting_id) if callable(get) else None
        if item is None:
            raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다.")
        return item

    return router
