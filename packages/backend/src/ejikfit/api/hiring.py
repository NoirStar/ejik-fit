from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Protocol
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import contains_eager

from ejikfit.db import SessionLocal
from ejikfit.models import Company, JobPosting, PostingStatus

from .schemas import HiringOverviewResponse


KST = ZoneInfo("Asia/Seoul")
MAX_CALENDAR_RANGE_DAYS = 62
ACTIVITY_COMPANY_LIMIT = 12


class HiringOverviewReader(Protocol):
    def overview(
        self,
        *,
        start: date,
        end: date,
        activity_days: int,
        limit: int,
        now: datetime,
    ) -> dict: ...


def _calendar_boundary(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=KST).astimezone(timezone.utc)


def _deadline_summary(posting: JobPosting) -> dict:
    return {
        "id": posting.id,
        "title": posting.title,
        "company_name": posting.company.name,
        "company_slug": posting.company.slug,
        "career_type": posting.career_type,
        "employment_type": posting.employment_type,
        "career_min": posting.career_min,
        "career_max": posting.career_max,
        "location": posting.location,
        "status": posting.status.value,
        "source_url": posting.url,
        "first_seen_at": posting.first_seen_at,
        "last_verified_at": posting.last_verified_at,
        "opens_at": posting.opens_at,
        "closes_at": posting.closes_at,
        "required_skills": [],
        "preferred_skills": [],
        "unspecified_skills": [],
    }


class DatabaseHiringOverviewReader:
    def __init__(self, session_factory=SessionLocal) -> None:
        self.session_factory = session_factory

    def overview(
        self,
        *,
        start: date,
        end: date,
        activity_days: int,
        limit: int,
        now: datetime,
    ) -> dict:
        start_at = _calendar_boundary(start)
        end_at = _calendar_boundary(end)
        activity_since = now - timedelta(days=activity_days)

        with self.session_factory() as session:
            deadline_filters = (
                JobPosting.status == PostingStatus.OPEN,
                JobPosting.closes_at.is_not(None),
                JobPosting.closes_at >= start_at,
                JobPosting.closes_at < end_at,
            )
            deadline_total = int(
                session.scalar(
                    select(func.count(JobPosting.id)).where(
                        *deadline_filters
                    )
                )
                or 0
            )
            deadline_statement = (
                select(JobPosting)
                .join(JobPosting.company)
                .options(contains_eager(JobPosting.company))
                .where(*deadline_filters)
                .order_by(
                    JobPosting.closes_at.asc(),
                    JobPosting.first_seen_at.desc(),
                    JobPosting.id.asc(),
                )
                .limit(limit)
            )
            deadlines = [
                _deadline_summary(posting)
                for posting in session.scalars(deadline_statement)
                .unique()
                .all()
            ]

            undated_open_postings = int(
                session.scalar(
                    select(func.count(JobPosting.id)).where(
                        JobPosting.status == PostingStatus.OPEN,
                        JobPosting.closes_at.is_(None),
                    )
                )
                or 0
            )

            closing_next_7_days = int(
                session.scalar(
                    select(func.count(JobPosting.id)).where(
                        JobPosting.status == PostingStatus.OPEN,
                        JobPosting.closes_at >= now,
                        JobPosting.closes_at < now + timedelta(days=7),
                    )
                )
                or 0
            )

            recent_activity_filters = (
                JobPosting.status == PostingStatus.OPEN,
                JobPosting.first_seen_at >= activity_since,
            )
            activity_company_total = int(
                session.scalar(
                    select(
                        func.count(func.distinct(JobPosting.company_id))
                    ).where(*recent_activity_filters)
                )
                or 0
            )
            new_postings = func.count(JobPosting.id)
            latest_first_seen_at = func.max(JobPosting.first_seen_at)
            nearest_deadline_at = func.min(JobPosting.closes_at).filter(
                JobPosting.closes_at >= now
            )
            activity_statement = (
                select(
                    Company.name,
                    Company.slug,
                    new_postings.label("new_postings"),
                    latest_first_seen_at.label("latest_first_seen_at"),
                    nearest_deadline_at.label("nearest_deadline_at"),
                )
                .join(
                    JobPosting,
                    JobPosting.company_id == Company.id,
                )
                .where(*recent_activity_filters)
                .group_by(Company.id, Company.name, Company.slug)
                .order_by(
                    new_postings.desc(),
                    latest_first_seen_at.desc(),
                    Company.name.asc(),
                )
                .limit(ACTIVITY_COMPANY_LIMIT)
            )
            activities = [
                {
                    "company_name": row.name,
                    "company_slug": row.slug,
                    "new_postings": int(row.new_postings),
                    "latest_first_seen_at": row.latest_first_seen_at,
                    "nearest_deadline_at": row.nearest_deadline_at,
                }
                for row in session.execute(activity_statement)
            ]

        return {
            "range_start": start,
            "range_end": end,
            "activity_since": activity_since,
            "deadline_total": deadline_total,
            "closing_next_7_days": closing_next_7_days,
            "undated_open_postings": undated_open_postings,
            "activity_company_total": activity_company_total,
            "deadlines": deadlines,
            "activities": activities,
        }


def create_hiring_router(reader: HiringOverviewReader) -> APIRouter:
    router = APIRouter(prefix="/api/hiring", tags=["hiring"])

    @router.get("/overview", response_model=HiringOverviewResponse)
    def hiring_overview(
        response: Response,
        start: date,
        end: date,
        activity_days: int = Query(default=14, ge=7, le=30),
        limit: int = Query(default=300, ge=1, le=500),
    ) -> dict:
        range_days = (end - start).days
        if range_days < 1 or range_days > MAX_CALENDAR_RANGE_DAYS:
            raise HTTPException(
                status_code=422,
                detail=(
                    "calendar range must be between 1 and "
                    f"{MAX_CALENDAR_RANGE_DAYS} days"
                ),
            )
        response.headers["Cache-Control"] = (
            "public, s-maxage=300, stale-while-revalidate=900"
        )
        return reader.overview(
            start=start,
            end=end,
            activity_days=activity_days,
            limit=limit,
            now=datetime.now(timezone.utc),
        )

    return router
