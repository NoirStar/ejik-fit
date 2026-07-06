from __future__ import annotations

from typing import Protocol

from fastapi import APIRouter, HTTPException

from ejikfit.db import SessionLocal
from ejikfit.fit_analysis import FitAnalysis, analyze_fit

from .schemas import FitAnalyzeRequest, FitAnalyzeResponse


class FitAnalysisReader(Protocol):
    def analyze(
        self,
        owned_skills: list[str],
        career_type: str | None = None,
        domains: list[str] | None = None,
    ) -> dict: ...


def _analysis_to_dict(result: FitAnalysis) -> dict:
    return {
        "coverage": {
            "matching_posting_count": result.coverage.matching_posting_count,
            "strong_fit_posting_count": result.coverage.strong_fit_posting_count,
        },
        "domain_branches": [
            {
                "domain": branch.domain,
                "covered_skills": list(branch.covered_skills),
                "missing_required_skills": list(branch.missing_required_skills),
                "missing_preferred_skills": list(branch.missing_preferred_skills),
                "supporting_posting_count": branch.supporting_posting_count,
            }
            for branch in result.domain_branches
        ],
        "recommended_next_skills": [
            {
                "skill": item.skill,
                "reason": item.reason,
                "required_count": item.required_count,
                "preferred_count": item.preferred_count,
                "supporting_posting_count": item.supporting_posting_count,
            }
            for item in result.recommended_next_skills
        ],
    }


class DatabaseFitAnalysisReader:
    def __init__(self, session_factory=SessionLocal) -> None:
        self.session_factory = session_factory

    def analyze(
        self,
        owned_skills: list[str],
        career_type: str | None = None,
        domains: list[str] | None = None,
    ) -> dict:
        with self.session_factory() as session:
            result = analyze_fit(
                session,
                owned_skills=owned_skills,
                career_type=career_type,
                domains=domains or [],
            )
        return _analysis_to_dict(result)


def create_fit_router(reader: FitAnalysisReader) -> APIRouter:
    router = APIRouter(prefix="/api/fit", tags=["fit"])

    @router.post("/analyze", response_model=FitAnalyzeResponse)
    def analyze(request: FitAnalyzeRequest) -> dict:
        owned = [skill.strip() for skill in request.owned_skills if skill.strip()]
        if not owned:
            raise HTTPException(status_code=422, detail="owned_skills must not be empty")
        return reader.analyze(
            owned_skills=owned,
            career_type=request.career_type,
            domains=request.domains,
        )

    return router
