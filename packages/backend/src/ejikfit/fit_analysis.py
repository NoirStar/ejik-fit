from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ejikfit.models import JobPosting, PostingStatus
from ejikfit.skill_catalog import skill_domains
from ejikfit.skill_extraction import CONFIRMED_CONFIDENCE


@dataclass(frozen=True)
class FitCoverage:
    matching_posting_count: int
    strong_fit_posting_count: int


@dataclass(frozen=True)
class DomainBranch:
    domain: str
    covered_skills: tuple[str, ...]
    missing_required_skills: tuple[str, ...]
    missing_preferred_skills: tuple[str, ...]
    supporting_posting_count: int


@dataclass(frozen=True)
class RecommendedSkill:
    skill: str
    reason: str
    required_count: int
    preferred_count: int
    supporting_posting_count: int


@dataclass(frozen=True)
class FitAnalysis:
    coverage: FitCoverage
    domain_branches: tuple[DomainBranch, ...]
    recommended_next_skills: tuple[RecommendedSkill, ...]

    def branch_by_domain(self, domain: str) -> DomainBranch:
        for branch in self.domain_branches:
            if branch.domain == domain:
                return branch
        raise KeyError(domain)


def _posting_skills(posting: JobPosting) -> dict[str, str]:
    result: dict[str, str] = {}
    for skill in posting.skills:
        if skill.confidence >= CONFIRMED_CONFIDENCE:
            result[skill.skill] = skill.requirement_type
    return result


def _posting_domains(skills: Sequence[str]) -> set[str]:
    domains: set[str] = set()
    for skill in skills:
        domains.update(skill_domains(skill))
    return domains


def analyze_fit(
    session: Session,
    *,
    owned_skills: Sequence[str],
    career_type: str | None = None,
    domains: Sequence[str] = (),
) -> FitAnalysis:
    owned = set(owned_skills)
    requested_domains = set(domains)
    statement = (
        select(JobPosting)
        .options(selectinload(JobPosting.skills))
        .where(JobPosting.status == PostingStatus.OPEN)
    )
    if career_type:
        statement = statement.where(JobPosting.career_type == career_type)

    postings = session.scalars(statement).unique().all()
    matching_postings = 0
    strong_fit_postings = 0
    branch_postings: Counter[str] = Counter()
    branch_covered: dict[str, set[str]] = defaultdict(set)
    branch_missing_required: dict[str, Counter[str]] = defaultdict(Counter)
    branch_missing_preferred: dict[str, Counter[str]] = defaultdict(Counter)
    missing_required: Counter[str] = Counter()
    missing_preferred: Counter[str] = Counter()
    supporting: Counter[str] = Counter()

    for posting in postings:
        skills = _posting_skills(posting)
        if not skills:
            continue
        posting_skill_names = set(skills)
        if owned.isdisjoint(posting_skill_names):
            continue

        posting_domains = _posting_domains(tuple(posting_skill_names))
        if requested_domains and posting_domains.isdisjoint(requested_domains):
            continue

        matching_postings += 1
        required = {skill for skill, value in skills.items() if value == "required"}
        preferred = {skill for skill, value in skills.items() if value == "preferred"}
        covered_required = required & owned
        required_total = len(required)
        if required_total > 0 and len(covered_required) / required_total >= 0.5:
            strong_fit_postings += 1

        missing_req = required - owned
        missing_pref = preferred - owned
        for skill in missing_req:
            missing_required[skill] += 1
            supporting[skill] += 1
        for skill in missing_pref:
            missing_preferred[skill] += 1
            supporting[skill] += 1

        for domain in posting_domains:
            branch_postings[domain] += 1
            branch_covered[domain].update(posting_skill_names & owned)
            branch_missing_required[domain].update(missing_req)
            branch_missing_preferred[domain].update(missing_pref)

    branches = []
    domain_names = requested_domains or set(branch_postings)
    for domain in sorted(domain_names):
        branches.append(
            DomainBranch(
                domain=domain,
                covered_skills=tuple(sorted(branch_covered[domain])),
                missing_required_skills=tuple(
                    skill
                    for skill, _count in branch_missing_required[domain].most_common(
                        10
                    )
                ),
                missing_preferred_skills=tuple(
                    skill
                    for skill, _count in branch_missing_preferred[domain].most_common(
                        10
                    )
                ),
                supporting_posting_count=branch_postings[domain],
            )
        )

    recommendations = []
    for skill, support_count in supporting.most_common(20):
        recommendations.append(
            RecommendedSkill(
                skill=skill,
                reason=f"보유 스킬과 함께 등장한 공고에서 {support_count}회 부족 요구사항으로 확인됨",
                required_count=missing_required[skill],
                preferred_count=missing_preferred[skill],
                supporting_posting_count=support_count,
            )
        )

    recommendations.sort(
        key=lambda item: (
            -item.required_count,
            -item.supporting_posting_count,
            item.skill,
        )
    )

    return FitAnalysis(
        coverage=FitCoverage(
            matching_posting_count=matching_postings,
            strong_fit_posting_count=strong_fit_postings,
        ),
        domain_branches=tuple(branches),
        recommended_next_skills=tuple(recommendations[:10]),
    )
