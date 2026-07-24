from __future__ import annotations

import json
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

import httpx
from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ejikfit.connectors.public_json_detail import (
    discover_public_json_detail_refs,
)
from ejikfit.db import SessionLocal
from ejikfit.models import (
    CareerSource,
    JobPosting,
    PolicyStatus,
    PostingStatus,
    SourceStatus,
)

from .schemas import SourceDirectoryResponse


class SourceDirectoryReader(Protocol):
    def list(self) -> list[dict]: ...


DUNAMU_OFFICIAL_JOBS_URL = (
    "https://careers.dunamu.com/api/job-boards/"
    "jd0wjv/job-notices?lang=ko"
)
SOURCE_ACTIVITY_FRESHNESS = timedelta(hours=48)


class DunamuJobsReader(Protocol):
    def read(self) -> dict[str, Any]: ...


class OfficialDunamuJobsReader:
    def __init__(
        self,
        *,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.transport = transport

    def read(self) -> dict[str, Any]:
        with httpx.Client(
            transport=self.transport,
            follow_redirects=True,
            timeout=10.0,
            headers={
                "User-Agent": (
                    "EjikFitAPI/0.1 "
                    "(+https://ejik-fit-web.vercel.app/data-policy)"
                )
            },
        ) as client:
            response = client.get(DUNAMU_OFFICIAL_JOBS_URL)
            response.raise_for_status()

        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("Dunamu jobs response must be an object")
        discover_public_json_detail_refs(
            json.dumps(payload, ensure_ascii=False),
            DUNAMU_OFFICIAL_JOBS_URL,
            "dunamu_official_api_proxy_tech",
        )
        return payload


def _preparation_reason(source: CareerSource) -> str | None:
    if source.is_runnable:
        return None
    if source.policy_status == PolicyStatus.REVIEW:
        return "policy_review"
    if source.status == SourceStatus.NEEDS_BROWSER:
        return "access_limited"
    if source.status == SourceStatus.NEEDS_CONNECTOR:
        return "connector_pending"
    return "policy_review"


def source_activity_status(
    *,
    collection_status: str,
    open_postings: int,
    last_success_at: datetime | None,
    now: datetime,
) -> str:
    if collection_status == "preparing":
        return "preparing"
    if last_success_at is None:
        return "attention"
    comparable = (
        last_success_at.replace(tzinfo=timezone.utc)
        if last_success_at.tzinfo is None
        else last_success_at.astimezone(timezone.utc)
    )
    comparable_now = (
        now.replace(tzinfo=timezone.utc)
        if now.tzinfo is None
        else now.astimezone(timezone.utc)
    )
    if comparable_now - comparable > SOURCE_ACTIVITY_FRESHNESS:
        return "attention"
    return "active" if open_postings > 0 else "quiet"


class DatabaseSourceDirectoryReader:
    def __init__(
        self,
        session_factory=SessionLocal,
        now_factory: Callable[[], datetime] | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.now_factory = now_factory or (
            lambda: datetime.now(timezone.utc)
        )

    def list(self) -> list[dict]:
        hidden_statuses = {SourceStatus.BLOCKED, SourceStatus.STOPPED}
        hidden_policy_statuses = {PolicyStatus.BLOCKED, PolicyStatus.STOPPED}

        with self.session_factory() as session:
            sources = list(
                session.scalars(
                    select(CareerSource)
                    .options(joinedload(CareerSource.company))
                    .where(
                        CareerSource.status.not_in(hidden_statuses),
                        CareerSource.policy_status.not_in(
                            hidden_policy_statuses
                        ),
                    )
                    .order_by(CareerSource.base_url)
                )
                .unique()
                .all()
            )
            open_counts = {
                source_id: int(count)
                for source_id, count in session.execute(
                    select(
                        JobPosting.source_id,
                        func.count(JobPosting.id),
                    )
                    .where(JobPosting.status == PostingStatus.OPEN)
                    .group_by(JobPosting.source_id)
                )
            }

        companies: dict[str, dict] = {}
        preferred_source_counts: dict[str, int] = {}
        for source in sources:
            company = source.company
            collecting = source.is_runnable
            source_count = open_counts.get(source.id, 0) if collecting else 0
            status = "collecting" if collecting else "preparing"
            preparation_reason = _preparation_reason(source)
            item = companies.get(company.slug)

            if item is None:
                companies[company.slug] = {
                    "company_name": company.name,
                    "company_slug": company.slug,
                    "homepage_url": company.homepage_url,
                    "careers_url": source.base_url,
                    "collection_status": status,
                    "preparation_reason": preparation_reason,
                    "open_postings": source_count,
                    "last_success_at": source.last_success_at,
                    "_runnable_success_at": (
                        source.last_success_at if collecting else None
                    ),
                }
                preferred_source_counts[company.slug] = source_count
                continue

            item["open_postings"] += source_count
            previous_success = item["last_success_at"]
            if source.last_success_at is not None and (
                previous_success is None
                or source.last_success_at > previous_success
            ):
                item["last_success_at"] = source.last_success_at

            runnable_success = item["_runnable_success_at"]
            if collecting and source.last_success_at is not None and (
                runnable_success is None
                or source.last_success_at > runnable_success
            ):
                item["_runnable_success_at"] = source.last_success_at

            should_prefer_source = (
                collecting and item["collection_status"] != "collecting"
            ) or (
                status == item["collection_status"]
                and source_count > preferred_source_counts[company.slug]
            )
            if should_prefer_source:
                item["careers_url"] = source.base_url
                item["preparation_reason"] = preparation_reason
                preferred_source_counts[company.slug] = source_count
            if collecting:
                item["collection_status"] = "collecting"
                item["preparation_reason"] = None

        now = self.now_factory()
        items = list(companies.values())
        for item in items:
            activity_success_at = (
                item["_runnable_success_at"]
                if item["collection_status"] == "collecting"
                else item["last_success_at"]
            )
            if item["collection_status"] == "collecting":
                item["last_success_at"] = activity_success_at
            item["activity_status"] = source_activity_status(
                collection_status=item["collection_status"],
                open_postings=item["open_postings"],
                last_success_at=activity_success_at,
                now=now,
            )
            item.pop("_runnable_success_at", None)

        return sorted(
            items,
            key=lambda item: (
                item["collection_status"] != "collecting",
                -item["open_postings"],
                item["company_name"].casefold(),
            ),
        )


def create_sources_router(
    reader: SourceDirectoryReader,
    dunamu_jobs_reader: DunamuJobsReader | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/api/sources", tags=["sources"])
    jobs_reader = dunamu_jobs_reader or OfficialDunamuJobsReader()

    @router.get("", response_model=SourceDirectoryResponse)
    def list_sources() -> dict:
        items = reader.list()
        return {
            "items": items,
            "total": len(items),
            "collecting_count": sum(
                item["collection_status"] == "collecting" for item in items
            ),
            "preparing_count": sum(
                item["collection_status"] == "preparing" for item in items
            ),
            "open_postings": sum(item["open_postings"] for item in items),
        }

    @router.get("/dunamu/current-jobs")
    def dunamu_current_jobs(response: Response) -> dict[str, Any]:
        try:
            payload = jobs_reader.read()
        except (httpx.HTTPError, ValueError) as error:
            raise HTTPException(
                status_code=502,
                detail="두나무 공식 채용 데이터를 불러오지 못했습니다.",
            ) from error
        response.headers["Cache-Control"] = (
            "public, s-maxage=300, stale-while-revalidate=900"
        )
        return payload

    return router
