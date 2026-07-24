from __future__ import annotations

from typing import Protocol

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from ejikfit.db import SessionLocal
from ejikfit.models import JobPosting, PostingSkill, PostingStatus
from ejikfit.skill_catalog import SKILLS, skill_domains, skill_kind
from ejikfit.skill_extraction import CONFIRMED_CONFIDENCE

from .schemas import (
    SkillCatalogResponse,
    SkillStatsResponse,
    SkillTrendResponse,
)


MINIMUM_TREND_WEEKS = 4


class SkillStatsReader(Protocol):
    def stats(
        self,
        career_type: str | None = None,
        category: str | None = None,
        limit: int = 30,
    ) -> list[dict]: ...

    def total(
        self,
        career_type: str | None = None,
        category: str | None = None,
    ) -> int: ...


class SkillTrendReader(Protocol):
    def trends(
        self,
        skills: list[str],
        *,
        weeks: int = 12,
        minimum_weeks: int = MINIMUM_TREND_WEEKS,
    ) -> dict: ...


class DatabaseSkillStatsReader:
    def __init__(self, session_factory=SessionLocal) -> None:
        self.session_factory = session_factory

    def stats(
        self,
        career_type: str | None = None,
        category: str | None = None,
        limit: int = 30,
    ) -> list[dict]:
        count_expr = func.count(func.distinct(PostingSkill.posting_id))
        company_count = func.count(func.distinct(JobPosting.company_id))
        required_count = func.count(
            func.distinct(
                case(
                    (
                        PostingSkill.requirement_type == "required",
                        PostingSkill.posting_id,
                    ),
                )
            )
        )
        preferred_count = func.count(
            func.distinct(
                case(
                    (
                        PostingSkill.requirement_type == "preferred",
                        PostingSkill.posting_id,
                    ),
                )
            )
        )
        unspecified_count = func.count(
            func.distinct(
                case(
                    (
                        PostingSkill.requirement_type == "unspecified",
                        PostingSkill.posting_id,
                    ),
                )
            )
        )
        with self.session_factory() as session:
            statement = self._apply_scope(
                select(
                    PostingSkill.skill,
                    PostingSkill.category,
                    count_expr.label("count"),
                    company_count.label("company_count"),
                    required_count.label("required_count"),
                    preferred_count.label("preferred_count"),
                    unspecified_count.label("unspecified_count"),
                ),
                career_type=career_type,
                category=category,
            )
            statement = (
                statement.group_by(PostingSkill.skill, PostingSkill.category)
                .order_by(count_expr.desc(), PostingSkill.skill)
                .limit(limit)
            )
            return [
                {
                    "skill": skill,
                    "category": category,
                    "count": count,
                    "company_count": companies,
                    "required_count": required,
                    "preferred_count": preferred,
                    "unspecified_count": unspecified,
                }
                for (
                    skill,
                    category,
                    count,
                    companies,
                    required,
                    preferred,
                    unspecified,
                ) in session.execute(statement)
            ]

    def total(
        self,
        career_type: str | None = None,
        category: str | None = None,
    ) -> int:
        with self.session_factory() as session:
            grouped_skills = self._apply_scope(
                select(PostingSkill.skill, PostingSkill.category),
                career_type=career_type,
                category=category,
            ).group_by(PostingSkill.skill, PostingSkill.category)
            return int(
                session.scalar(
                    select(func.count()).select_from(grouped_skills.subquery())
                )
                or 0
            )

    @staticmethod
    def _apply_scope(statement, *, career_type: str | None, category: str | None):
        statement = statement.join(
            JobPosting,
            JobPosting.id == PostingSkill.posting_id,
        ).where(
            JobPosting.status == PostingStatus.OPEN,
            PostingSkill.confidence >= CONFIRMED_CONFIDENCE,
        )
        if career_type:
            statement = statement.where(JobPosting.career_type == career_type)
        if category:
            statement = statement.where(
                JobPosting.skills.any(
                    and_(
                        PostingSkill.category == category,
                        PostingSkill.confidence >= CONFIRMED_CONFIDENCE,
                    )
                )
            )
        return statement


def create_skills_router(
    reader: SkillStatsReader,
    trend_reader: SkillTrendReader,
) -> APIRouter:
    router = APIRouter(prefix="/api/skills", tags=["skills"])

    @router.get("/catalog", response_model=SkillCatalogResponse)
    def skill_catalog() -> dict:
        items = [
            {
                "name": skill.canonical,
                "category": skill.category,
                "kind": skill_kind(skill.canonical),
                "domains": list(skill_domains(skill.canonical)),
            }
            for skill in sorted(SKILLS, key=lambda item: item.canonical.casefold())
        ]
        return {"items": items, "total": len(items)}

    @router.get("/stats", response_model=SkillStatsResponse)
    def skill_stats(
        career_type: str | None = Query(default=None, max_length=100),
        category: str | None = Query(default=None, max_length=64),
        limit: int = Query(default=30, ge=1, le=100),
    ) -> dict:
        items = reader.stats(
            career_type=career_type,
            category=category,
            limit=limit,
        )
        total = reader.total(
            career_type=career_type,
            category=category,
        )
        return {"items": items, "total": total}

    @router.get("/trends", response_model=SkillTrendResponse)
    def skill_trends(
        skills: list[str] = Query(default=[]),
        weeks: int = Query(default=12, ge=4, le=12),
    ) -> dict:
        normalized = list(
            dict.fromkeys(skill.strip() for skill in skills if skill.strip())
        )
        if len(normalized) > 3:
            raise HTTPException(
                status_code=422,
                detail="기술은 최대 3개까지 비교할 수 있습니다.",
            )
        if any(len(skill) > 100 for skill in normalized):
            raise HTTPException(status_code=422, detail="기술명이 너무 깁니다.")
        return trend_reader.trends(
            normalized,
            weeks=weeks,
            minimum_weeks=MINIMUM_TREND_WEEKS,
        )

    return router
