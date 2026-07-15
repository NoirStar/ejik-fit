from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ejikfit.models import (
    CareerSource,
    JobPosting,
    JobRevision,
    PostingSkill,
    PolicyStatus,
    PostingStatus,
    SourceStatus,
)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _in_window(value: datetime | None, since: datetime) -> bool:
    comparable = _as_utc(value)
    return comparable is not None and comparable >= since


def _iso(value: datetime | None) -> str | None:
    comparable = _as_utc(value)
    return comparable.isoformat() if comparable is not None else None


def _ratio(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round(numerator / denominator, 2)


def _health_status(source: CareerSource, since: datetime) -> str:
    if (
        source.status == SourceStatus.BLOCKED
        or source.policy_status == PolicyStatus.BLOCKED
    ):
        return "blocked"
    if (
        source.status == SourceStatus.STOPPED
        or source.policy_status == PolicyStatus.STOPPED
    ):
        return "stopped"
    if source.policy_status != PolicyStatus.ALLOWED:
        return "pending"
    if source.last_error_code:
        return "failing"
    if source.is_runnable and _in_window(source.last_success_at, since):
        return "healthy"
    if source.is_runnable:
        return "stale"
    return "pending"


def _source_item(
    source: CareerSource,
    activity: Mapping[str, int],
    since: datetime,
) -> dict[str, Any]:
    open_postings = activity.get("open_postings", 0)
    tech_open_postings = activity.get("tech_open_postings", 0)

    return {
        "source_id": str(source.id),
        "company_name": source.company.name,
        "company_slug": source.company.slug,
        "source_type": source.source_type.value,
        "connector_family": source.connector_family,
        "status": source.status.value,
        "policy_status": source.policy_status.value,
        "runnable": source.is_runnable,
        "health_status": _health_status(source, since),
        "open_postings": open_postings,
        "new_postings": activity.get("new_postings", 0),
        "seen_postings": activity.get("seen_postings", 0),
        "changed_postings": activity.get("changed_postings", 0),
        "closed_postings": activity.get("closed_postings", 0),
        "tech_open_postings": tech_open_postings,
        "tech_job_ratio": _ratio(tech_open_postings, open_postings),
        "last_success_at": _iso(source.last_success_at),
        "last_error_code": source.last_error_code,
    }


def _posting_activity_by_source(
    session: Session,
    since: datetime,
) -> dict[Any, dict[str, int]]:
    has_skill = (
        select(PostingSkill.id)
        .where(PostingSkill.posting_id == JobPosting.id)
        .exists()
    )
    activity_rows = session.execute(
        select(
            JobPosting.source_id.label("source_id"),
            func.count(JobPosting.id)
            .filter(JobPosting.status == PostingStatus.OPEN)
            .label("open_postings"),
            func.count(JobPosting.id)
            .filter(JobPosting.first_seen_at >= since)
            .label("new_postings"),
            func.count(JobPosting.id)
            .filter(JobPosting.last_seen_at >= since)
            .label("seen_postings"),
            func.count(JobPosting.id)
            .filter(
                JobPosting.status == PostingStatus.CLOSED,
                JobPosting.last_verified_at >= since,
            )
            .label("closed_postings"),
            func.count(JobPosting.id)
            .filter(
                JobPosting.status == PostingStatus.OPEN,
                has_skill,
            )
            .label("tech_open_postings"),
        ).group_by(JobPosting.source_id)
    )
    activity = {
        row.source_id: {
            "open_postings": int(row.open_postings or 0),
            "new_postings": int(row.new_postings or 0),
            "seen_postings": int(row.seen_postings or 0),
            "closed_postings": int(row.closed_postings or 0),
            "tech_open_postings": int(row.tech_open_postings or 0),
            "changed_postings": 0,
        }
        for row in activity_rows
    }

    changed_rows = session.execute(
        select(
            JobPosting.source_id,
            func.count(func.distinct(JobRevision.posting_id)),
        )
        .join(JobRevision, JobRevision.posting_id == JobPosting.id)
        .where(JobRevision.created_at >= since)
        .group_by(JobPosting.source_id)
    )
    for source_id, changed_postings in changed_rows:
        activity.setdefault(source_id, {})["changed_postings"] = int(
            changed_postings or 0
        )

    return activity


def _connector_family_health(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        groups[item["connector_family"] or "unknown"].append(item)

    health: dict[str, dict[str, Any]] = {}
    for family, family_items in sorted(groups.items()):
        open_postings = sum(item["open_postings"] for item in family_items)
        tech_open_postings = sum(
            item["tech_open_postings"]
            for item in family_items
        )
        health[family] = {
            "sources": len(family_items),
            "allowed_sources": sum(
                1 for item in family_items if item["runnable"]
            ),
            "healthy_sources": sum(
                1 for item in family_items if item["health_status"] == "healthy"
            ),
            "failing_sources": sum(
                1
                for item in family_items
                if item["health_status"] in {"blocked", "failing"}
            ),
            "stale_allowed_sources": sum(
                1 for item in family_items if item["health_status"] == "stale"
            ),
            "open_postings": open_postings,
            "new_postings": sum(item["new_postings"] for item in family_items),
            "changed_postings": sum(
                item["changed_postings"] for item in family_items
            ),
            "tech_job_ratio": _ratio(tech_open_postings, open_postings),
        }
    return health


def build_source_monitor_report(
    session: Session,
    now: datetime | None = None,
    window_hours: int = 24,
) -> dict[str, Any]:
    generated_at = _as_utc(now) or datetime.now(timezone.utc)
    since = generated_at - timedelta(hours=window_hours)

    sources = list(
        session.scalars(
            select(CareerSource)
            .options(joinedload(CareerSource.company))
            .order_by(CareerSource.base_url)
        )
        .unique()
        .all()
    )
    activity_by_source = _posting_activity_by_source(session, since)

    items = [
        _source_item(
            source,
            activity_by_source.get(source.id, {}),
            since,
        )
        for source in sources
    ]

    open_postings = sum(item["open_postings"] for item in items)
    tech_open_postings = sum(
        item["tech_open_postings"] for item in items
    )
    top_stale_sources = sorted(
        [item for item in items if item["health_status"] == "stale"],
        key=lambda item: (
            item["last_success_at"] or "",
            item["company_name"],
        ),
    )[:10]
    top_failing_sources = sorted(
        [
            item
            for item in items
            if item["health_status"] in {"blocked", "failing"}
        ],
        key=lambda item: (
            item["last_error_code"] or "",
            item["company_name"],
        ),
    )[:10]

    return {
        "window_hours": window_hours,
        "generated_at": generated_at.isoformat(),
        "since": since.isoformat(),
        "totals": {
            "sources": len(items),
            "allowed_sources": sum(
                1 for item in items if item["runnable"]
            ),
            "healthy_sources": sum(
                1 for item in items if item["health_status"] == "healthy"
            ),
            "stale_allowed_sources": sum(
                1 for item in items if item["health_status"] == "stale"
            ),
            "failing_sources": sum(
                1
                for item in items
                if item["health_status"] in {"blocked", "failing"}
            ),
            "blocked_sources": sum(
                1 for item in items if item["health_status"] == "blocked"
            ),
            "open_postings": open_postings,
            "new_postings": sum(item["new_postings"] for item in items),
            "seen_postings": sum(item["seen_postings"] for item in items),
            "changed_postings": sum(item["changed_postings"] for item in items),
            "closed_postings": sum(item["closed_postings"] for item in items),
            "tech_job_ratio": _ratio(tech_open_postings, open_postings),
        },
        "connector_family_health": _connector_family_health(items),
        "top_stale_sources": top_stale_sources,
        "top_failing_sources": top_failing_sources,
        "sources": items,
    }


def _ratio_text(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")


def render_source_monitor_markdown(report: dict[str, Any]) -> str:
    totals = report["totals"]
    lines = [
        "## 공식 출처 모니터",
        "",
        f"최근 {report['window_hours']}시간 기준입니다.",
        "",
        "| 지표 | 값 |",
        "| --- | ---: |",
        f"| 전체 출처 | {totals['sources']} |",
        f"| 허용 출처 | {totals['allowed_sources']} |",
        f"| 건강한 출처 | {totals['healthy_sources']} |",
        f"| 오래된 허용 출처 | {totals['stale_allowed_sources']} |",
        f"| 실패/차단 출처 | {totals['failing_sources']} |",
        f"| 차단 출처 | {totals['blocked_sources']} |",
        f"| 오픈 공고 | {totals['open_postings']} |",
        f"| 신규 공고 | {totals['new_postings']} |",
        f"| 확인 공고 | {totals['seen_postings']} |",
        f"| 변경 공고 | {totals['changed_postings']} |",
        f"| 마감 공고 | {totals['closed_postings']} |",
        f"| 기술 공고 비율 | {_ratio_text(totals['tech_job_ratio'])} |",
        "",
        "### 커넥터 패밀리 건강도",
        "",
        "| 커넥터 | 건강 | 오래됨 | 실패 | 오픈 | 신규 | 변경 | 기술 비율 |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]

    for family, item in report["connector_family_health"].items():
        lines.append(
            f"| {family} | {item['healthy_sources']} | "
            f"{item['stale_allowed_sources']} | {item['failing_sources']} | "
            f"{item['open_postings']} | {item['new_postings']} | "
            f"{item['changed_postings']} | {_ratio_text(item['tech_job_ratio'])} |"
        )
    lines.append("")

    if report["top_stale_sources"]:
        lines.extend(
            [
                "### 오래된 허용 출처",
                "",
                "| 회사 | 타입 | 마지막 성공 |",
                "| --- | --- | --- |",
            ]
        )
        for item in report["top_stale_sources"]:
            lines.append(
                f"| {item['company_name']} | {item['source_type']} | "
                f"{item['last_success_at'] or ''} |"
            )
        lines.append("")

    if report["top_failing_sources"]:
        lines.extend(
            [
                "### 실패/차단 출처",
                "",
                "| 회사 | 타입 | 건강 | 오류 |",
                "| --- | --- | --- | --- |",
            ]
        )
        for item in report["top_failing_sources"]:
            lines.append(
                f"| {item['company_name']} | {item['source_type']} | "
                f"{item['health_status']} | {item['last_error_code'] or ''} |"
            )
        lines.append("")

    return "\n".join(lines)
