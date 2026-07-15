from __future__ import annotations

from typing import Protocol

from fastapi import APIRouter, Query
from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from ejikfit.db import SessionLocal
from ejikfit.models import JobPosting, PostingSkill, PostingStatus
from ejikfit.skill_extraction import CONFIRMED_CONFIDENCE

from .schemas import SkillStatsResponse


class SkillStatsReader(Protocol):
    def stats(
        self,
        career_type: str | None = None,
        category: str | None = None,
        limit: int = 30,
    ) -> list[dict]: ...


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
            statement = (
                select(
                    PostingSkill.skill,
                    PostingSkill.category,
                    count_expr.label("count"),
                    required_count.label("required_count"),
                    preferred_count.label("preferred_count"),
                    unspecified_count.label("unspecified_count"),
                )
                .join(JobPosting, JobPosting.id == PostingSkill.posting_id)
                .where(
                    JobPosting.status == PostingStatus.OPEN,
                    PostingSkill.confidence >= CONFIRMED_CONFIDENCE,
                )
            )
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
                    "required_count": required,
                    "preferred_count": preferred,
                    "unspecified_count": unspecified,
                }
                for (
                    skill,
                    category,
                    count,
                    required,
                    preferred,
                    unspecified,
                ) in session.execute(statement)
            ]


def create_skills_router(reader: SkillStatsReader) -> APIRouter:
    router = APIRouter(prefix="/api/skills", tags=["skills"])

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
        return {"items": items, "total": len(items)}

    return router
