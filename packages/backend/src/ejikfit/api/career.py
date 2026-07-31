from __future__ import annotations

from typing import Protocol

from fastapi import APIRouter, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload

from ejikfit.career_analysis import analyze_career, build_market_fields
from ejikfit.db import SessionLocal
from ejikfit.models import JobPosting, PostingStatus
from ejikfit.skill_catalog import canonicalize_skill_inputs

from .postings import _summary
from .schemas import (
    CareerAnalyzeRequest,
    CareerAnalyzeResponse,
    MarketCareerFieldsResponse,
)


class CareerAnalysisReader(Protocol):
    def snapshot(self) -> list[dict]: ...


class DatabaseCareerAnalysisReader:
    def __init__(self, session_factory=SessionLocal) -> None:
        self.session_factory = session_factory

    def snapshot(self) -> list[dict]:
        with self.session_factory() as session:
            postings = (
                session.scalars(
                    select(JobPosting)
                    .options(
                        joinedload(JobPosting.company),
                        selectinload(JobPosting.skills),
                    )
                    .where(JobPosting.status == PostingStatus.OPEN)
                    .order_by(
                        JobPosting.last_verified_at.desc(),
                        JobPosting.id.desc(),
                    )
                )
                .unique()
                .all()
            )
            return [_summary(posting) for posting in postings]


def _filter_postings(postings: list[dict], request: CareerAnalyzeRequest) -> list[dict]:
    query = (request.q or "").strip().casefold()
    career_type = (request.career_type or "").strip().casefold()
    category = (request.category or "").strip().casefold()
    filtered: list[dict] = []
    for posting in postings:
        if career_type and (posting.get("career_type") or "").casefold() != career_type:
            continue
        if category and category not in {
            str(value).casefold() for value in posting.get("skill_categories", [])
        }:
            continue
        if query:
            searchable = " ".join(
                [
                    str(posting.get("title") or ""),
                    str(posting.get("company_name") or ""),
                    str(posting.get("description_excerpt") or ""),
                    *posting.get("required_skills", []),
                    *posting.get("preferred_skills", []),
                    *posting.get("unspecified_skills", []),
                ]
            ).casefold()
            if query not in searchable:
                continue
        filtered.append(posting)
    return filtered


def create_career_router(reader: CareerAnalysisReader) -> APIRouter:
    router = APIRouter(prefix="/api/career", tags=["career"])

    @router.post("/analyze", response_model=CareerAnalyzeResponse)
    def analyze(request: CareerAnalyzeRequest, response: Response) -> dict:
        response.headers["Cache-Control"] = "private, no-store"
        profile = request.profile.model_dump()
        skills = canonicalize_skill_inputs(request.owned_skills)
        result = analyze_career(
            profile=profile,
            owned_skills=skills,
            postings=_filter_postings(reader.snapshot(), request),
            direction=request.direction,
            limit=request.limit,
            offset=request.offset,
        )
        returned_ids = set(request.connection_ids)
        returned_ids.update(
            str(item["posting"]["id"])
            for item in result["recommendations"]["items"]
        )
        result["connections"] = {
            posting_id: connection
            for posting_id, connection in result["connections"].items()
            if posting_id in returned_ids
        }
        return result

    @router.get("/market", response_model=MarketCareerFieldsResponse)
    def market(
        response: Response,
        career_type: str | None = Query(default=None, max_length=100),
        category: str | None = Query(default=None, max_length=64),
    ) -> dict:
        response.headers["Cache-Control"] = (
            "public, s-maxage=300, stale-while-revalidate=900"
        )
        request = CareerAnalyzeRequest(
            career_type=career_type,
            category=category,
        )
        return build_market_fields(_filter_postings(reader.snapshot(), request))

    return router
