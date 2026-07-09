from collections import Counter
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ejikfit.models import CareerSource, JobPosting, PostingStatus, SourceStatus


def _counter(values: list[str | None]) -> dict[str, int]:
    return dict(sorted(Counter(value or "unknown" for value in values).items()))


def _clip(value: str | None, limit: int = 120) -> str | None:
    if value is None:
        return None
    stripped = " ".join(value.split())
    if len(stripped) <= limit:
        return stripped
    return stripped[: limit - 1] + "…"


def _open_posting_counts(session: Session) -> dict[Any, int]:
    rows = session.execute(
        select(JobPosting.source_id, func.count(JobPosting.id))
        .where(JobPosting.status == PostingStatus.OPEN)
        .group_by(JobPosting.source_id)
    ).all()
    return {source_id: int(count) for source_id, count in rows}


def _source_item(source: CareerSource, open_count: int) -> dict[str, Any]:
    return {
        "source_id": str(source.id),
        "company_name": source.company.name,
        "company_slug": source.company.slug,
        "source_type": source.source_type.value,
        "connector_family": source.connector_family,
        "status": source.status.value,
        "policy_status": source.policy_status.value,
        "sector": source.sector,
        "priority_score": source.priority_score,
        "open_postings": open_count,
        "last_success_at": (
            source.last_success_at.isoformat() if source.last_success_at else None
        ),
        "last_error_code": source.last_error_code,
        "last_error_reason": _clip(source.last_error_reason),
    }


def build_source_report(session: Session) -> dict[str, Any]:
    sources = list(
        session.scalars(
            select(CareerSource)
            .options(joinedload(CareerSource.company))
            .order_by(CareerSource.base_url)
        )
        .unique()
        .all()
    )
    open_counts = _open_posting_counts(session)
    items = [
        _source_item(source, open_counts.get(source.id, 0))
        for source in sources
    ]
    error_items = [item for item in items if item["last_error_code"]]

    return {
        "totals": {
            "sources": len(items),
            "open_postings": sum(item["open_postings"] for item in items),
            "allowed_sources": sum(
                1 for item in items if item["status"] == SourceStatus.ALLOWED.value
            ),
            "blocked_sources": sum(
                1 for item in items if item["status"] == SourceStatus.BLOCKED.value
            ),
        },
        "status_counts": _counter([item["status"] for item in items]),
        "policy_status_counts": _counter(
            [item["policy_status"] for item in items]
        ),
        "connector_family_counts": _counter(
            [item["connector_family"] for item in items]
        ),
        "error_counts": _counter(
            [item["last_error_code"] for item in error_items]
        ),
        "top_priority_sources": sorted(
            items,
            key=lambda item: (
                item["priority_score"],
                item["open_postings"],
                item["company_name"],
            ),
            reverse=True,
        )[:10],
        "top_error_sources": sorted(
            error_items,
            key=lambda item: (
                item["last_error_code"] or "",
                item["company_name"],
            ),
        )[:10],
        "sources": items,
    }


def _table(title: str, rows: list[tuple[str, str | int]]) -> list[str]:
    lines = [
        f"### {title}",
        "",
        "| 항목 | 값 |",
        "| --- | ---: |",
    ]
    lines.extend(f"| {label} | {value} |" for label, value in rows)
    lines.append("")
    return lines


def render_source_report_markdown(report: dict[str, Any]) -> str:
    totals = report["totals"]
    lines = [
        "## 공식 출처 운영 리포트",
        "",
        "| 지표 | 값 |",
        "| --- | ---: |",
        f"| 전체 출처 | {totals['sources']} |",
        f"| 허용 출처 | {totals['allowed_sources']} |",
        f"| 차단 출처 | {totals['blocked_sources']} |",
        f"| 오픈 공고 | {totals['open_postings']} |",
        "",
    ]

    lines.extend(
        _table(
            "출처 상태",
            [(key, value) for key, value in report["status_counts"].items()],
        )
    )
    lines.extend(
        _table(
            "정책 상태",
            [
                (key, value)
                for key, value in report["policy_status_counts"].items()
            ],
        )
    )
    lines.extend(
        _table(
            "커넥터 패밀리",
            [
                (key, value)
                for key, value in report["connector_family_counts"].items()
            ],
        )
    )
    if report["error_counts"]:
        lines.extend(
            _table(
                "오류 코드",
                [(key, value) for key, value in report["error_counts"].items()],
            )
        )

    lines.extend(
        [
            "### 우선순위 상위 출처",
            "",
            "| 회사 | 타입 | 상태 | 우선순위 | 오픈 공고 |",
            "| --- | --- | --- | ---: | ---: |",
        ]
    )
    for item in report["top_priority_sources"]:
        lines.append(
            f"| {item['company_name']} | {item['source_type']} | "
            f"{item['status']} | {item['priority_score']} | "
            f"{item['open_postings']} |"
        )
    lines.append("")

    if report["top_error_sources"]:
        lines.extend(
            [
                "### 오류 출처",
                "",
                "| 회사 | 타입 | 상태 | 오류 | 이유 |",
                "| --- | --- | --- | --- | --- |",
            ]
        )
        for item in report["top_error_sources"]:
            reason = str(item.get("last_error_reason") or "").replace("|", "\\|")
            lines.append(
                f"| {item['company_name']} | {item['source_type']} | "
                f"{item['status']} | {item['last_error_code']} | {reason} |"
            )
        lines.append("")

    return "\n".join(lines)
