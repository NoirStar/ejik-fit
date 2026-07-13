from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

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
from ejikfit.skill_graph import build_skill_graph


def _source(session: Session) -> tuple[Company, CareerSource]:
    company = Company(name="테스트 기업", slug="test-company")
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
    status: PostingStatus = PostingStatus.OPEN,
    career_type: str = "experienced",
    skills: list[tuple[str, str, str, float]],
) -> None:
    now = datetime(2026, 7, 6, tzinfo=timezone.utc)
    posting = JobPosting(
        company_id=company.id,
        source_id=source.id,
        external_id=external_id,
        url=f"https://example.com/o/{external_id}",
        title=title,
        status=status,
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
                evidence_text=f"{skill} 근거",
                match_reason="test",
            )
        )


def test_build_skill_graph_uses_open_confirmed_skills_only() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        company, source = _source(session)
        _posting(
            session,
            company,
            source,
            "1",
            title="로보틱스 엔지니어",
            skills=[
                ("C++", "language", "required", 1.0),
                ("ROS", "robotics", "required", 1.0),
                ("Linux", "infra", "preferred", 1.0),
                ("Go", "language", "required", 0.5),
            ],
        )
        _posting(
            session,
            company,
            source,
            "2",
            title="닫힌 공고",
            status=PostingStatus.CLOSED,
            skills=[
                ("C++", "language", "required", 1.0),
                ("Unity", "game", "required", 1.0),
            ],
        )
        session.commit()

        graph = build_skill_graph(session, seed="C++", owned_skills=["C++"], limit=10)

    node_ids = {node.id for node in graph.nodes}
    assert node_ids == {"C++", "ROS", "Linux"}
    assert graph.node_by_id("C++").owned is True
    assert graph.node_by_id("C++").seed is True
    assert {edge.target for edge in graph.edges if edge.source == "C++"} == {"ROS", "Linux"}
    assert all("Go" not in edge.id for edge in graph.edges)
    assert all("Unity" not in edge.id for edge in graph.edges)


def test_required_required_edge_scores_above_required_preferred_edge() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        company, source = _source(session)
        _posting(
            session,
            company,
            source,
            "1",
            title="로보틱스 엔지니어",
            skills=[
                ("C++", "language", "required", 1.0),
                ("ROS", "robotics", "required", 1.0),
                ("Linux", "infra", "preferred", 1.0),
            ],
        )
        session.commit()

        graph = build_skill_graph(session, seed="C++", limit=10)

    ros_edge = graph.edge_between("C++", "ROS")
    linux_edge = graph.edge_between("C++", "Linux")
    assert ros_edge.required_pair_count == 1
    assert ros_edge.score > linux_edge.score


def test_seed_graph_limits_nodes_by_relevance_with_public_lower_bound() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        company, source = _source(session)
        for index, skill in enumerate(["ROS", "Python", "Linux", "SLAM", "OpenCV"], start=1):
            _posting(
                session,
                company,
                source,
                str(index),
                title=f"C++ 관계 {skill}",
                skills=[
                    ("C++", "language", "required", 1.0),
                    (skill, "robotics", "required", 1.0),
                ],
            )
        session.commit()

        graph = build_skill_graph(session, seed="C++", limit=3)

    assert len(graph.nodes) == 5
    assert graph.node_by_id("C++").seed is True
    assert len(graph.edges) == 4


def test_build_skill_graph_canonicalizes_seed_and_owned_skill_inputs() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        company, source = _source(session)
        _posting(
            session,
            company,
            source,
            "canonical-input",
            title="플랫폼 엔지니어",
            skills=[
                ("Python", "language", "required", 1.0),
                ("Kubernetes", "infra", "preferred", 1.0),
            ],
        )
        session.commit()

        graph = build_skill_graph(
            session,
            seed="python",
            owned_skills=["PYTHON", "k8s"],
            limit=10,
        )

    assert graph.seed == "Python"
    assert graph.node_by_id("Python").seed is True
    assert graph.node_by_id("Python").owned is True
    assert graph.node_by_id("Kubernetes").owned is True
