from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from ejikfit.fit_analysis import analyze_fit
from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    PostingSkill,
    PostingStatus,
    SourceStatus,
    SourceType,
)


def _fixture(session: Session) -> tuple[Company, CareerSource]:
    company = Company(name="뉴빌리티", slug="neubility")
    source = CareerSource(
        company=company,
        base_url="https://example.com",
        source_type=SourceType.JSON_LD,
        status=SourceStatus.ALLOWED,
    )
    session.add(source)
    session.flush()
    return company, source


def _posting(
    session: Session,
    company: Company,
    source: CareerSource,
    external_id: str,
    *,
    title: str,
    career_type: str,
    skills: list[tuple[str, str, str, float]],
) -> None:
    now = datetime(2026, 7, 6, tzinfo=timezone.utc)
    posting = JobPosting(
        company_id=company.id,
        source_id=source.id,
        external_id=external_id,
        url=f"https://example.com/o/{external_id}",
        title=title,
        status=PostingStatus.OPEN,
        career_type=career_type,
        first_seen_at=now,
        last_seen_at=now,
        last_verified_at=now,
    )
    session.add(posting)
    session.flush()
    for skill, category, requirement_type, confidence in skills:
        session.add(
            PostingSkill(
                posting_id=posting.id,
                skill=skill,
                category=category,
                requirement_type=requirement_type,
                confidence=confidence,
                match_reason="test",
            )
        )


def test_analyze_fit_reports_missing_required_and_recommended_skills() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        company, source = _fixture(session)
        _posting(
            session,
            company,
            source,
            "1",
            title="Autonomy Engineer",
            career_type="experienced",
            skills=[
                ("C++", "language", "required", 1.0),
                ("ROS", "robotics", "required", 1.0),
                ("Linux", "infra", "required", 1.0),
                ("SLAM", "robotics", "preferred", 1.0),
            ],
        )
        _posting(
            session,
            company,
            source,
            "2",
            title="Physical AI Engineer",
            career_type="experienced",
            skills=[
                ("C++", "language", "required", 1.0),
                ("Python", "language", "required", 1.0),
                ("ROS", "robotics", "preferred", 1.0),
            ],
        )
        session.commit()

        result = analyze_fit(session, owned_skills=["C++"], domains=["robotics"])

    assert result.coverage.matching_posting_count == 2
    assert result.coverage.strong_fit_posting_count == 1
    robotics = result.branch_by_domain("robotics")
    assert robotics.covered_skills == ("C++",)
    assert "ROS" in robotics.missing_required_skills
    assert "Linux" in robotics.missing_required_skills
    assert result.recommended_next_skills[0].skill == "ROS"
    assert result.recommended_next_skills[0].supporting_posting_count == 2


def test_analyze_fit_filters_by_career_type() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        company, source = _fixture(session)
        _posting(
            session,
            company,
            source,
            "1",
            title="신입 백엔드",
            career_type="new_comer",
            skills=[
                ("Python", "language", "required", 1.0),
                ("Docker", "infra", "required", 1.0),
            ],
        )
        _posting(
            session,
            company,
            source,
            "2",
            title="경력 백엔드",
            career_type="experienced",
            skills=[
                ("Python", "language", "required", 1.0),
                ("Kubernetes", "infra", "required", 1.0),
            ],
        )
        session.commit()

        result = analyze_fit(session, owned_skills=["Python"], career_type="new_comer")

    assert result.coverage.matching_posting_count == 1
    assert result.recommended_next_skills[0].skill == "Docker"
