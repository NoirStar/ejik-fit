from __future__ import annotations

from typing import Protocol

from fastapi import APIRouter, Query, Response
from sqlalchemy import case, func, select
from sqlalchemy.orm import joinedload, selectinload

from ejikfit.db import SessionLocal
from ejikfit.models import JobPosting, PostingSkill, PostingStatus
from ejikfit.skill_catalog import (
    canonicalize_skill_input,
    canonicalize_skill_inputs,
)
from ejikfit.skill_extraction import CONFIRMED_CONFIDENCE
from ejikfit.skill_graph import SkillGraph, build_skill_graph

from .schemas import SkillGraphEvidenceResponse, SkillGraphResponse


PUBLIC_GRAPH_CACHE = "public, s-maxage=300, stale-while-revalidate=900"


class SkillGraphReader(Protocol):
    def graph(
        self,
        seed: str | None = None,
        owned_skills: list[str] | None = None,
        career_type: str | None = None,
        limit: int = 30,
        include_evidence: bool = False,
    ) -> dict: ...

    def evidence(
        self,
        skill: str,
        career_type: str | None = None,
        limit: int = 6,
    ) -> dict: ...


def _graph_to_dict(graph: SkillGraph, *, limit: int) -> dict:
    return {
        "seed": graph.seed,
        "nodes": [
            {
                "id": node.id,
                "label": node.label,
                "category": node.category,
                "kind": node.kind,
                "domains": list(node.domains),
                "demand_count": node.demand_count,
                "required_count": node.required_count,
                "preferred_count": node.preferred_count,
                "unspecified_count": node.unspecified_count,
                "owned": node.owned,
                "seed": node.seed,
            }
            for node in graph.nodes
        ],
        "edges": [
            {
                "id": edge.id,
                "source": edge.source,
                "target": edge.target,
                "score": edge.score,
                "cooccurrence_count": edge.cooccurrence_count,
                "required_pair_count": edge.required_pair_count,
                "supporting_posting_ids": list(edge.supporting_posting_ids),
            }
            for edge in graph.edges
        ],
        "evidence": [
            {
                "posting_id": item.posting_id,
                "title": item.title,
                "company_name": item.company_name,
                "skills": list(item.skills),
                "required": list(item.required),
                "preferred": list(item.preferred),
                "unspecified": list(item.unspecified),
            }
            for item in graph.evidence
        ],
        "meta": {
            "limit": limit,
            "min_confidence": CONFIRMED_CONFIDENCE,
        },
    }


class DatabaseSkillGraphReader:
    def __init__(self, session_factory=SessionLocal) -> None:
        self.session_factory = session_factory

    def graph(
        self,
        seed: str | None = None,
        owned_skills: list[str] | None = None,
        career_type: str | None = None,
        limit: int = 30,
        include_evidence: bool = False,
    ) -> dict:
        with self.session_factory() as session:
            graph = build_skill_graph(
                session,
                seed=seed,
                owned_skills=owned_skills or (),
                career_type=career_type,
                limit=limit,
                include_evidence=include_evidence,
            )
        return _graph_to_dict(graph, limit=limit)

    def evidence(
        self,
        skill: str,
        career_type: str | None = None,
        limit: int = 6,
    ) -> dict:
        canonical_skill = canonicalize_skill_input(skill)
        bounded_limit = max(1, min(limit, 20))
        filters = [
            JobPosting.status == PostingStatus.OPEN,
            PostingSkill.skill == canonical_skill,
            PostingSkill.confidence >= CONFIRMED_CONFIDENCE,
        ]
        if career_type:
            filters.append(JobPosting.career_type == career_type)

        with self.session_factory() as session:
            total = session.scalar(
                select(func.count(func.distinct(JobPosting.id)))
                .join(PostingSkill, PostingSkill.posting_id == JobPosting.id)
                .where(*filters)
            ) or 0
            postings = (
                session.scalars(
                    select(JobPosting)
                    .join(PostingSkill, PostingSkill.posting_id == JobPosting.id)
                    .options(
                        joinedload(JobPosting.company),
                        selectinload(JobPosting.skills),
                    )
                    .where(*filters)
                    .order_by(
                        case(
                            (PostingSkill.requirement_type == "required", 0),
                            (PostingSkill.requirement_type == "preferred", 1),
                            else_=2,
                        ),
                        JobPosting.last_verified_at.desc(),
                        JobPosting.id,
                    )
                    .limit(bounded_limit)
                )
                .unique()
                .all()
            )

            items = []
            for posting in postings:
                confirmed = _confirmed_posting_skills(posting)
                items.append(
                    {
                        "posting_id": str(posting.id),
                        "title": posting.title,
                        "company_name": posting.company.name,
                        "skills": sorted(confirmed),
                        "required": sorted(
                            name
                            for name, requirement in confirmed.items()
                            if requirement == "required"
                        ),
                        "preferred": sorted(
                            name
                            for name, requirement in confirmed.items()
                            if requirement == "preferred"
                        ),
                        "unspecified": sorted(
                            name
                            for name, requirement in confirmed.items()
                            if requirement == "unspecified"
                        ),
                    }
                )
        return {"items": items, "total": total}


def _confirmed_posting_skills(posting: JobPosting) -> dict[str, str]:
    return {
        item.skill: item.requirement_type
        for item in posting.skills
        if item.confidence >= CONFIRMED_CONFIDENCE
    }


def create_graph_router(reader: SkillGraphReader) -> APIRouter:
    router = APIRouter(prefix="/api/graph", tags=["graph"])

    @router.get(
        "/skills/evidence",
        response_model=SkillGraphEvidenceResponse,
    )
    def skill_graph_evidence(
        response: Response,
        skill: str = Query(min_length=1, max_length=100),
        career_type: str | None = Query(default=None, max_length=100),
        limit: int = Query(default=6, ge=1, le=20),
    ) -> dict:
        response.headers["Cache-Control"] = PUBLIC_GRAPH_CACHE
        return reader.evidence(
            skill=canonicalize_skill_input(skill),
            career_type=career_type,
            limit=limit,
        )

    @router.get("/skills", response_model=SkillGraphResponse)
    def skill_graph(
        response: Response,
        seed: str | None = Query(default=None, max_length=100),
        owned_skills: list[str] | None = Query(default=None),
        career_type: str | None = Query(default=None, max_length=100),
        limit: int = Query(default=30, ge=5, le=60),
        include_evidence: bool = Query(default=False),
    ) -> dict:
        response.headers["Cache-Control"] = (
            "private, no-store" if owned_skills else PUBLIC_GRAPH_CACHE
        )
        return reader.graph(
            seed=canonicalize_skill_input(seed) if seed else None,
            owned_skills=canonicalize_skill_inputs(owned_skills or []),
            career_type=career_type,
            limit=limit,
            include_evidence=include_evidence,
        )

    return router
