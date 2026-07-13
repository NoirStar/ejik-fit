from __future__ import annotations

from typing import Protocol

from fastapi import APIRouter, Query

from ejikfit.db import SessionLocal
from ejikfit.skill_catalog import (
    canonicalize_skill_input,
    canonicalize_skill_inputs,
)
from ejikfit.skill_extraction import CONFIRMED_CONFIDENCE
from ejikfit.skill_graph import SkillGraph, build_skill_graph

from .schemas import SkillGraphResponse


class SkillGraphReader(Protocol):
    def graph(
        self,
        seed: str | None = None,
        owned_skills: list[str] | None = None,
        career_type: str | None = None,
        limit: int = 30,
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
    ) -> dict:
        with self.session_factory() as session:
            graph = build_skill_graph(
                session,
                seed=seed,
                owned_skills=owned_skills or (),
                career_type=career_type,
                limit=limit,
            )
        return _graph_to_dict(graph, limit=limit)


def create_graph_router(reader: SkillGraphReader) -> APIRouter:
    router = APIRouter(prefix="/api/graph", tags=["graph"])

    @router.get("/skills", response_model=SkillGraphResponse)
    def skill_graph(
        seed: str | None = Query(default=None, max_length=100),
        owned_skills: list[str] | None = Query(default=None),
        career_type: str | None = Query(default=None, max_length=100),
        limit: int = Query(default=30, ge=5, le=60),
    ) -> dict:
        return reader.graph(
            seed=canonicalize_skill_input(seed) if seed else None,
            owned_skills=canonicalize_skill_inputs(owned_skills or []),
            career_type=career_type,
            limit=limit,
        )

    return router
