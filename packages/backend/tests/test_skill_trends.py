from datetime import date, datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from ejikfit.models import (
    Base,
    CareerSource,
    Company,
    JobPosting,
    MarketSnapshot,
    PostingSkill,
    PostingStatus,
    SkillDemandSnapshot,
    SourceStatus,
    SourceType,
)
from ejikfit.skill_trends import (
    DatabaseSkillTrendReader,
    capture_skill_demand_snapshot,
)


def _posting(
    session: Session,
    company: Company,
    source: CareerSource,
    external_id: str,
    *,
    status: PostingStatus = PostingStatus.OPEN,
) -> JobPosting:
    now = datetime(2026, 7, 1, tzinfo=timezone.utc)
    posting = JobPosting(
        company_id=company.id,
        source_id=source.id,
        external_id=external_id,
        url=f"https://example.com/jobs/{external_id}",
        title=f"공고 {external_id}",
        status=status,
        first_seen_at=now,
        last_seen_at=now,
        last_verified_at=now,
    )
    session.add(posting)
    session.flush()
    return posting


def test_capture_skill_demand_snapshot_counts_confirmed_open_postings() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="기업", slug="company")
        source = CareerSource(
            company=company,
            base_url="https://example.com/jobs",
            source_type=SourceType.JSON_LD,
            status=SourceStatus.ALLOWED,
        )
        session.add(source)
        session.flush()
        first = _posting(session, company, source, "1")
        second = _posting(session, company, source, "2")
        closed = _posting(
            session,
            company,
            source,
            "3",
            status=PostingStatus.CLOSED,
        )
        session.add_all(
            [
                PostingSkill(
                    posting_id=first.id,
                    skill="Python",
                    category="language",
                    requirement_type="required",
                    confidence=1.0,
                    match_reason="test",
                ),
                PostingSkill(
                    posting_id=second.id,
                    skill="Python",
                    category="language",
                    requirement_type="preferred",
                    confidence=1.0,
                    match_reason="test",
                ),
                PostingSkill(
                    posting_id=closed.id,
                    skill="Python",
                    category="language",
                    requirement_type="required",
                    confidence=1.0,
                    match_reason="test",
                ),
                PostingSkill(
                    posting_id=first.id,
                    skill="Go",
                    category="language",
                    requirement_type="required",
                    confidence=0.5,
                    match_reason="test",
                ),
            ]
        )
        session.commit()

        capture_skill_demand_snapshot(
            session,
            now=datetime(2026, 7, 1, 15, tzinfo=timezone.utc),
            verified_sources=7,
            total_sources=8,
        )
        session.commit()

        snapshot = session.scalar(select(MarketSnapshot))
        assert snapshot is not None
        assert snapshot.observed_on == date(2026, 7, 2)
        assert snapshot.open_postings == 2
        assert snapshot.verified_sources == 7
        assert snapshot.total_sources == 8
        assert snapshot.skill_count == 1

        demand = session.scalar(select(SkillDemandSnapshot))
        assert demand is not None
        assert demand.skill == "Python"
        assert demand.posting_count == 2
        assert demand.required_count == 1
        assert demand.preferred_count == 1
        assert demand.unspecified_count == 0


def test_skill_trend_reader_waits_four_weeks_then_returns_real_points() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    with factory() as session:
        for index, observed_on in enumerate(
            (
                date(2026, 6, 15),
                date(2026, 6, 22),
                date(2026, 6, 29),
                date(2026, 7, 6),
            ),
            start=1,
        ):
            snapshot = MarketSnapshot(
                observed_on=observed_on,
                observed_at=datetime.combine(
                    observed_on,
                    datetime.min.time(),
                    tzinfo=timezone.utc,
                ),
                open_postings=10 + index,
                verified_sources=8,
                total_sources=8,
                skill_count=1,
            )
            session.add(snapshot)
            session.flush()
            session.add(
                SkillDemandSnapshot(
                    market_snapshot_id=snapshot.id,
                    skill="Python",
                    category="language",
                    posting_count=10 + index,
                    required_count=5 + index,
                    preferred_count=2,
                    unspecified_count=3,
                )
            )
        session.commit()

    reader = DatabaseSkillTrendReader(session_factory=factory)
    result = reader.trends(["Python"], weeks=12, minimum_weeks=4)

    assert result["status"] == "ready"
    assert result["collected_weeks"] == 4
    assert result["minimum_weeks"] == 4
    assert result["series"][0]["skill"] == "Python"
    assert [point["count"] for point in result["series"][0]["points"]] == [
        11,
        12,
        13,
        14,
    ]

    collecting = reader.trends(
        ["Python"],
        weeks=12,
        minimum_weeks=5,
    )
    assert collecting["status"] == "collecting"
    assert collecting["series"] == []
