from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ejikfit.models import (
    CareerSource,
    JobPosting,
    JobRevision,
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
    if source.status == SourceStatus.BLOCKED:
        return "blocked"
    if source.last_error_code:
        return "failing"
    if source.status == SourceStatus.ALLOWED and _in_window(
        source.last_success_at,
        since,
    ):
        return "healthy"
    if source.status == SourceStatus.ALLOWED:
        return "stale"
    return "pending"


def _source_item(
    source: CareerSource,
    postings: list[JobPosting],
    changed_posting_ids: set[Any],
    since: datetime,
) -> dict[str, Any]:
    open_postings = [
        posting for posting in postings if posting.status == PostingStatus.OPEN
    ]
    new_postings = [
        posting for posting in postings if _in_window(posting.first_seen_at, since)
    ]
    seen_postings = [
        posting for posting in postings if _in_window(posting.last_seen_at, since)
    ]
    closed_postings = [
        posting
        for posting in postings
        if posting.status == PostingStatus.CLOSED
        and _in_window(posting.last_verified_at, since)
    ]
    tech_open_postings = [
        posting for posting in open_postings if len(posting.skills) > 0
    ]
    changed_postings = [
        posting for posting in postings if posting.id in changed_posting_ids
    ]

    return {
        "source_id": str(source.id),
        "company_name": source.company.name,
        "company_slug": source.company.slug,
        "source_type": source.source_type.value,
        "connector_family": source.connector_family,
        "status": source.status.value,
        "health_status": _health_status(source, since),
        "open_postings": len(open_postings),
        "new_postings": len(new_postings),
        "seen_postings": len(seen_postings),
        "changed_postings": len(changed_postings),
        "closed_postings": len(closed_postings),
        "tech_open_postings": len(tech_open_postings),
        "tech_job_ratio": _ratio(len(tech_open_postings), len(open_postings)),
        "last_success_at": _iso(source.last_success_at),
        "last_error_code": source.last_error_code,
    }


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
                1 for item in family_items if item["status"] == "allowed"
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
    postings = list(
        session.scalars(
            select(JobPosting)
            .options(joinedload(JobPosting.skills))
            .order_by(JobPosting.url)
        )
        .unique()
        .all()
    )
    recent_revision_posting_ids = {
        revision.posting_id
        for revision in session.scalars(select(JobRevision)).all()
        if _in_window(revision.created_at, since)
    }

    postings_by_source: dict[Any, list[JobPosting]] = defaultdict(list)
    for posting in postings:
        postings_by_source[posting.source_id].append(posting)

    items = [
        _source_item(
            source,
            postings_by_source.get(source.id, []),
            recent_revision_posting_ids,
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
                1 for item in items if item["status"] == "allowed"
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
