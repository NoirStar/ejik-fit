from __future__ import annotations

import itertools
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ejikfit.models import JobPosting, PostingStatus
from ejikfit.skill_catalog import (
    canonicalize_skill_input,
    canonicalize_skill_inputs,
    skill_category,
    skill_domains,
    skill_kind,
)
from ejikfit.skill_extraction import CONFIRMED_CONFIDENCE


REQUIREMENT_STRENGTH = {
    "required": 1.0,
    "preferred": 0.7,
    "unspecified": 0.4,
}


@dataclass(frozen=True)
class SkillGraphNode:
    id: str
    label: str
    category: str
    kind: str
    domains: tuple[str, ...]
    demand_count: int
    required_count: int
    preferred_count: int
    unspecified_count: int
    owned: bool = False
    seed: bool = False


@dataclass(frozen=True)
class SkillGraphEdge:
    id: str
    source: str
    target: str
    score: float
    cooccurrence_count: int
    required_pair_count: int
    supporting_posting_ids: tuple[str, ...]


@dataclass(frozen=True)
class SkillGraphEvidence:
    posting_id: str
    title: str
    company_name: str
    skills: tuple[str, ...]
    required: tuple[str, ...]
    preferred: tuple[str, ...]
    unspecified: tuple[str, ...]


@dataclass(frozen=True)
class SkillGraph:
    seed: str | None
    nodes: tuple[SkillGraphNode, ...]
    edges: tuple[SkillGraphEdge, ...]
    evidence: tuple[SkillGraphEvidence, ...]

    def node_by_id(self, node_id: str) -> SkillGraphNode:
        for node in self.nodes:
            if node.id == node_id:
                return node
        raise KeyError(node_id)

    def edge_between(self, left: str, right: str) -> SkillGraphEdge:
        wanted = {left, right}
        for edge in self.edges:
            if {edge.source, edge.target} == wanted:
                return edge
        raise KeyError(f"{left}::{right}")


def _confirmed_skills(posting: JobPosting) -> dict[str, str]:
    result: dict[str, str] = {}
    for skill in posting.skills:
        if skill.confidence >= CONFIRMED_CONFIDENCE:
            result[skill.skill] = skill.requirement_type
    return result


def _requirement_weight(left: str, right: str) -> float:
    return (REQUIREMENT_STRENGTH.get(left, 0.4) + REQUIREMENT_STRENGTH.get(right, 0.4)) / 2


def _edge_id(left: str, right: str) -> str:
    source, target = sorted((left, right))
    return f"{source}::{target}"


def _edge_score(
    *,
    left: str,
    right: str,
    support: int,
    requirement_weight: float,
    skill_counts: Counter[str],
    seed: str | None,
) -> float:
    if seed and seed in {left, right}:
        directional = support / max(1, skill_counts[seed])
    else:
        union = skill_counts[left] + skill_counts[right] - support
        directional = support / max(1, union)

    hub_size = max(skill_counts[left], skill_counts[right])
    hub_damping = 1 / math.sqrt(max(1, hub_size))
    raw = support * requirement_weight * directional * hub_damping
    return round(min(1.0, raw), 4)


def _node(
    skill: str,
    *,
    skill_counts: Counter[str],
    required_counts: Counter[str],
    preferred_counts: Counter[str],
    unspecified_counts: Counter[str],
    owned: set[str],
    seed: str | None,
) -> SkillGraphNode:
    return SkillGraphNode(
        id=skill,
        label=skill,
        category=skill_category(skill),
        kind=skill_kind(skill),
        domains=skill_domains(skill),
        demand_count=skill_counts[skill],
        required_count=required_counts[skill],
        preferred_count=preferred_counts[skill],
        unspecified_count=unspecified_counts[skill],
        owned=skill in owned,
        seed=skill == seed,
    )


def build_skill_graph(
    session: Session,
    *,
    seed: str | None = None,
    owned_skills: Sequence[str] = (),
    career_type: str | None = None,
    limit: int = 30,
    include_evidence: bool = True,
) -> SkillGraph:
    bounded_limit = max(5, min(limit, 60))
    seed = canonicalize_skill_input(seed) if seed else None
    canonical_owned_skills = canonicalize_skill_inputs(owned_skills)
    statement = (
        select(JobPosting)
        .options(joinedload(JobPosting.company), selectinload(JobPosting.skills))
        .where(JobPosting.status == PostingStatus.OPEN)
    )
    if career_type:
        statement = statement.where(JobPosting.career_type == career_type)

    postings = session.scalars(statement).unique().all()
    owned = set(canonical_owned_skills)
    skill_counts: Counter[str] = Counter()
    required_counts: Counter[str] = Counter()
    preferred_counts: Counter[str] = Counter()
    unspecified_counts: Counter[str] = Counter()
    pair_counts: Counter[tuple[str, str]] = Counter()
    pair_weight_sum: Counter[tuple[str, str]] = Counter()
    required_pair_counts: Counter[tuple[str, str]] = Counter()
    pair_postings: dict[tuple[str, str], list[str]] = defaultdict(list)
    evidence_by_posting: dict[str, SkillGraphEvidence] = {}

    for posting in postings:
        skills = _confirmed_skills(posting)
        if not skills:
            continue

        for name, requirement in skills.items():
            skill_counts[name] += 1
            if requirement == "required":
                required_counts[name] += 1
            elif requirement == "preferred":
                preferred_counts[name] += 1
            else:
                unspecified_counts[name] += 1

        for left, right in itertools.combinations(sorted(skills), 2):
            pair = (left, right)
            pair_counts[pair] += 1
            pair_weight_sum[pair] += _requirement_weight(skills[left], skills[right])
            if skills[left] == "required" and skills[right] == "required":
                required_pair_counts[pair] += 1
            pair_postings[pair].append(str(posting.id))

        required = tuple(sorted(name for name, value in skills.items() if value == "required"))
        preferred = tuple(sorted(name for name, value in skills.items() if value == "preferred"))
        unspecified = tuple(sorted(name for name, value in skills.items() if value == "unspecified"))
        if include_evidence:
            evidence_by_posting[str(posting.id)] = SkillGraphEvidence(
                posting_id=str(posting.id),
                title=posting.title,
                company_name=posting.company.name,
                skills=tuple(sorted(skills)),
                required=required,
                preferred=preferred,
                unspecified=unspecified,
            )

    scored_edges: list[SkillGraphEdge] = []
    for pair, support in pair_counts.items():
        left, right = pair
        average_requirement = pair_weight_sum[pair] / support
        score = _edge_score(
            left=left,
            right=right,
            support=support,
            requirement_weight=average_requirement,
            skill_counts=skill_counts,
            seed=seed,
        )
        scored_edges.append(
            SkillGraphEdge(
                id=_edge_id(left, right),
                source=left,
                target=right,
                score=score,
                cooccurrence_count=support,
                required_pair_count=required_pair_counts[pair],
                supporting_posting_ids=tuple(pair_postings[pair][:5]),
            )
        )

    scored_edges.sort(key=lambda edge: (-edge.score, -edge.cooccurrence_count, edge.id))

    demand_ranked_skills = sorted(
        skill_counts,
        key=lambda skill: (-skill_counts[skill], skill.casefold()),
    )
    selected_skills: list[str] = []
    if not seed:
        selected_skills = demand_ranked_skills[:bounded_limit]
    elif skill_counts[seed] > 0:
        selected_skills.append(seed)
        for edge in scored_edges:
            if seed not in {edge.source, edge.target}:
                continue
            neighbor = edge.target if edge.source == seed else edge.source
            if neighbor not in selected_skills:
                selected_skills.append(neighbor)
            if len(selected_skills) >= bounded_limit:
                break
    if not selected_skills:
        selected_skills = demand_ranked_skills[:bounded_limit]

    selected = set(selected_skills[:bounded_limit])
    visible_edges = (
        ()
        if seed and skill_counts[seed] == 0
        else tuple(
            edge
            for edge in scored_edges
            if edge.source in selected and edge.target in selected
        )
    )
    visible_posting_ids = {
        posting_id for edge in visible_edges for posting_id in edge.supporting_posting_ids
    }
    evidence = (
        tuple(
            evidence_by_posting[posting_id]
            for posting_id in sorted(visible_posting_ids)
            if posting_id in evidence_by_posting
        )
        if include_evidence
        else ()
    )
    nodes = tuple(
        _node(
            skill,
            skill_counts=skill_counts,
            required_counts=required_counts,
            preferred_counts=preferred_counts,
            unspecified_counts=unspecified_counts,
            owned=owned,
            seed=seed,
        )
        for skill in selected_skills[:bounded_limit]
    )
    return SkillGraph(seed=seed, nodes=nodes, edges=visible_edges, evidence=evidence)
