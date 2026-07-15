from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from ejikfit.db import SessionLocal
from ejikfit.models import (
    JobPosting,
    MarketSnapshot,
    PostingSkill,
    PostingStatus,
    SkillDemandSnapshot,
)
from ejikfit.skill_extraction import CONFIRMED_CONFIDENCE


KST = ZoneInfo("Asia/Seoul")


def capture_skill_demand_snapshot(
    session: Session,
    *,
    now: datetime | None = None,
    verified_sources: int,
    total_sources: int,
) -> MarketSnapshot:
    observed_at = now or datetime.now(timezone.utc)
    observed_on = observed_at.astimezone(KST).date()
    count_expr = func.count(func.distinct(PostingSkill.posting_id))
    requirement_count = lambda value: func.count(  # noqa: E731
        func.distinct(
            case(
                (
                    PostingSkill.requirement_type == value,
                    PostingSkill.posting_id,
                ),
            )
        )
    )
    statement = (
        select(
            PostingSkill.skill,
            PostingSkill.category,
            count_expr.label("posting_count"),
            requirement_count("required").label("required_count"),
            requirement_count("preferred").label("preferred_count"),
            requirement_count("unspecified").label("unspecified_count"),
        )
        .join(JobPosting, JobPosting.id == PostingSkill.posting_id)
        .where(
            JobPosting.status == PostingStatus.OPEN,
            PostingSkill.confidence >= CONFIRMED_CONFIDENCE,
        )
        .group_by(PostingSkill.skill, PostingSkill.category)
        .order_by(PostingSkill.skill)
    )
    rows = list(session.execute(statement))
    open_postings = session.scalar(
        select(func.count(JobPosting.id)).where(
            JobPosting.status == PostingStatus.OPEN
        )
    ) or 0

    snapshot = session.scalar(
        select(MarketSnapshot).where(
            MarketSnapshot.observed_on == observed_on
        )
    )
    if snapshot is None:
        snapshot = MarketSnapshot(
            observed_on=observed_on,
            observed_at=observed_at,
            open_postings=open_postings,
            verified_sources=verified_sources,
            total_sources=total_sources,
            skill_count=len(rows),
        )
        session.add(snapshot)
        session.flush()
    else:
        snapshot.observed_at = observed_at
        snapshot.open_postings = open_postings
        snapshot.verified_sources = verified_sources
        snapshot.total_sources = total_sources
        snapshot.skill_count = len(rows)
        session.execute(
            delete(SkillDemandSnapshot).where(
                SkillDemandSnapshot.market_snapshot_id == snapshot.id
            )
        )

    session.add_all(
        [
            SkillDemandSnapshot(
                market_snapshot_id=snapshot.id,
                skill=skill,
                category=category,
                posting_count=posting_count,
                required_count=required_count,
                preferred_count=preferred_count,
                unspecified_count=unspecified_count,
            )
            for (
                skill,
                category,
                posting_count,
                required_count,
                preferred_count,
                unspecified_count,
            ) in rows
        ]
    )
    return snapshot


class DatabaseSkillTrendReader:
    def __init__(self, session_factory=SessionLocal) -> None:
        self.session_factory = session_factory

    def trends(
        self,
        skills: list[str],
        *,
        weeks: int = 12,
        minimum_weeks: int = 4,
    ) -> dict[str, Any]:
        with self.session_factory() as session:
            snapshots = list(
                session.scalars(
                    select(MarketSnapshot).order_by(
                        MarketSnapshot.observed_on,
                        MarketSnapshot.observed_at,
                    )
                )
            )
            if not snapshots:
                return {
                    "status": "collecting",
                    "collected_weeks": 0,
                    "minimum_weeks": minimum_weeks,
                    "latest_snapshot_at": None,
                    "series": [],
                }

            latest_by_week: dict[tuple[int, int], MarketSnapshot] = {}
            for snapshot in snapshots:
                iso_year, iso_week, _ = snapshot.observed_on.isocalendar()
                latest_by_week[(iso_year, iso_week)] = snapshot
            weekly_snapshots = list(latest_by_week.values())[-weeks:]
            collected_weeks = len(weekly_snapshots)
            latest_snapshot_at = weekly_snapshots[-1].observed_at
            if collected_weeks < minimum_weeks or not skills:
                return {
                    "status": "collecting" if collected_weeks < minimum_weeks else "ready",
                    "collected_weeks": collected_weeks,
                    "minimum_weeks": minimum_weeks,
                    "latest_snapshot_at": latest_snapshot_at,
                    "series": [],
                }

            snapshot_ids = [snapshot.id for snapshot in weekly_snapshots]
            rows = list(
                session.scalars(
                    select(SkillDemandSnapshot).where(
                        SkillDemandSnapshot.market_snapshot_id.in_(snapshot_ids),
                        SkillDemandSnapshot.skill.in_(skills),
                    )
                )
            )
            demand_by_key = {
                (row.market_snapshot_id, row.skill): row for row in rows
            }
            series = []
            for skill in skills:
                category = next(
                    (
                        row.category
                        for row in reversed(rows)
                        if row.skill == skill
                    ),
                    "other",
                )
                points = []
                for snapshot in weekly_snapshots:
                    demand = demand_by_key.get((snapshot.id, skill))
                    week_start = snapshot.observed_on - timedelta(
                        days=snapshot.observed_on.weekday()
                    )
                    points.append(
                        {
                            "week_start": week_start,
                            "count": demand.posting_count if demand else 0,
                            "required_count": demand.required_count if demand else 0,
                            "preferred_count": demand.preferred_count if demand else 0,
                            "unspecified_count": (
                                demand.unspecified_count if demand else 0
                            ),
                        }
                    )
                series.append(
                    {"skill": skill, "category": category, "points": points}
                )

            return {
                "status": "ready",
                "collected_weeks": collected_weeks,
                "minimum_weeks": minimum_weeks,
                "latest_snapshot_at": latest_snapshot_at,
                "series": series,
            }
