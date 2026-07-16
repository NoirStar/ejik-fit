from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


NEXON_HOME_URL = "https://careers.nexon.com/"
NEXON_RECRUIT_URL = "https://careers.nexon.com/recruit"
NEXON_LIST_API = (
    "https://career-gateway.nexon.com/career/v1/open/job-posts"
)
NEXON_CORPORATIONS_API = (
    "https://career-gateway.nexon.com/career/v1/open/corps"
)
NEXON_CONNECTOR_FAMILY = "nexon_group_browser_api_tech"
KST = ZoneInfo("Asia/Seoul")

CAREER_TYPES = {
    "신입": "new_comer",
    "경력": "experienced",
    "경력무관": "mixed",
    "경력 무관": "mixed",
    "신입/경력": "mixed",
    "신입·경력": "mixed",
}
EMPLOYMENT_TYPES = {
    "정규직": "regular",
    "계약직": "contract",
    "인턴": "intern",
}
DATE_ONLY = re.compile(r"^\d{4}\.\d{2}\.\d{2}$")


@dataclass(frozen=True)
class NexonPage:
    rows: tuple[dict[str, Any], ...]
    page: int
    size: int
    total: int


def nexon_request_body(page: int, size: int = 15) -> dict[str, object]:
    if page < 1:
        raise ValueError("Nexon page must be positive")
    if size < 1:
        raise ValueError("Nexon page size must be positive")
    return {
        "corpCodes": [],
        "jobCategories": [],
        "careerTypes": [],
        "employmentTypes": [],
        "workingAreas": [],
        "query": None,
        "page": page,
        "size": size,
    }


def _non_negative_int(value: Any, field: str) -> int:
    if isinstance(value, bool):
        raise ValueError(f"Nexon {field} must be an integer")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"Nexon {field} must be an integer") from error
    if parsed < 0:
        raise ValueError(f"Nexon {field} must not be negative")
    return parsed


def _required_text(value: Any, field: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise ValueError(f"Nexon job {field} must be text")
    normalized = value.strip()
    if not normalized and not allow_empty:
        raise ValueError(f"Nexon job {field} is missing")
    return value if allow_empty else normalized


def _job_id(row: dict[str, Any]) -> int:
    job_id = _non_negative_int(row.get("jobPostNo"), "jobPostNo")
    if job_id == 0:
        raise ValueError("Nexon jobPostNo must be positive")
    return job_id


def _validate_job(row: Any) -> dict[str, Any]:
    if not isinstance(row, dict):
        raise ValueError("Nexon job row must be an object")
    _job_id(row)
    _required_text(row.get("corpName"), "corpName")
    _required_text(row.get("title"), "title")
    _required_text(row.get("contents"), "contents", allow_empty=True)
    return dict(row)


def parse_nexon_page(payload: object) -> NexonPage:
    if not isinstance(payload, dict):
        raise ValueError("Nexon listing must be an object")
    rows = payload.get("list")
    pagination = payload.get("pagination")
    if not isinstance(rows, list):
        raise ValueError("Nexon listing list must be an array")
    if not isinstance(pagination, dict):
        raise ValueError("Nexon listing pagination must be an object")

    page = _non_negative_int(pagination.get("page"), "page")
    size = _non_negative_int(pagination.get("size"), "size")
    total = _non_negative_int(pagination.get("total"), "total")
    if page < 1:
        raise ValueError("Nexon page must be positive")
    if len(rows) > size and size != 0:
        raise ValueError("Nexon page contains more rows than its size")
    if size == 0 and rows:
        raise ValueError("Nexon zero-size page contains rows")
    if len(rows) > total:
        raise ValueError("Nexon page contains more rows than its total")

    return NexonPage(
        rows=tuple(_validate_job(row) for row in rows),
        page=page,
        size=size,
        total=total,
    )


def _corporation_directory(
    corporations: object,
) -> tuple[list[dict[str, Any]], set[str]]:
    if not isinstance(corporations, list):
        raise ValueError("Nexon corporation directory must be an array")

    normalized: list[dict[str, Any]] = []
    codes: set[str] = set()
    names: set[str] = set()
    for raw in corporations:
        if not isinstance(raw, dict):
            raise ValueError("Nexon corporation must be an object")
        code = _required_text(raw.get("corpCode"), "corpCode")
        name = _required_text(raw.get("corpName"), "corpName")
        if code in codes or name in names:
            raise ValueError("Nexon corporation directory contains a duplicate")
        codes.add(code)
        names.add(name)
        normalized.append(dict(raw))
    if not normalized:
        raise ValueError("Nexon corporation directory is empty")
    return normalized, names


def combine_nexon_pages(
    pages: list[NexonPage],
    corporations: object,
) -> dict[str, object]:
    if not pages:
        raise ValueError("Nexon listing pages are missing")
    if len(pages) > 50:
        raise ValueError("Nexon listing exceeded the page limit")

    directory, corporation_names = _corporation_directory(corporations)
    total = pages[0].total
    page_size = pages[0].size
    combined: list[dict[str, Any]] = []
    seen_ids: set[int] = set()

    for expected_page, page in enumerate(pages, start=1):
        if page.page != expected_page:
            raise ValueError("Nexon listing page sequence changed")
        if page.total != total:
            raise ValueError("Nexon listing total changed while paging")
        if page.size != page_size:
            raise ValueError("Nexon listing page size changed while paging")
        if expected_page > 1 and not page.rows:
            raise ValueError("Nexon listing ended before its declared total")
        for row in page.rows:
            job_id = _job_id(row)
            if job_id in seen_ids:
                raise ValueError("Nexon listing contains a duplicate job id")
            seen_ids.add(job_id)
            corporation_name = _required_text(row.get("corpName"), "corpName")
            if corporation_name not in corporation_names:
                raise ValueError(
                    f"Nexon job names an unknown corporation: {corporation_name}"
                )
            combined.append(dict(row))

    if len(combined) != total:
        raise ValueError("Nexon listing is incomplete")
    return {
        "list": combined,
        "pagination": {"page": 1, "size": total, "total": total},
        "corporations": directory,
    }


def filter_nexon_payload(payload: str, corporation_name: str) -> str:
    try:
        decoded = json.loads(payload)
    except json.JSONDecodeError as error:
        raise ValueError("Nexon combined listing is invalid JSON") from error
    if not isinstance(decoded, dict):
        raise ValueError("Nexon combined listing must be an object")

    page = parse_nexon_page(decoded)
    directory, corporation_names = _corporation_directory(
        decoded.get("corporations")
    )
    if corporation_name not in corporation_names:
        raise ValueError(f"Nexon source names an unknown corporation: {corporation_name}")

    filtered = [
        dict(row)
        for row in page.rows
        if row.get("corpName") == corporation_name
    ]
    return json.dumps(
        {
            "list": filtered,
            "pagination": {
                "page": 1,
                "size": len(filtered),
                "total": len(filtered),
            },
            "corporations": directory,
        },
        ensure_ascii=False,
    )


def _nested_description(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    description = value.get("description")
    if not isinstance(description, str):
        return None
    normalized = description.strip()
    return normalized or None


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    try:
        if DATE_ONLY.fullmatch(raw):
            return datetime.strptime(raw, "%Y.%m.%d").replace(tzinfo=KST)
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"Nexon job date is invalid: {raw}") from error
    return parsed.replace(tzinfo=KST) if parsed.tzinfo is None else parsed


def parse_nexon_openings(payload: str, page_url: str) -> list[ParsedOpening]:
    try:
        decoded = json.loads(payload)
    except json.JSONDecodeError as error:
        raise ValueError("Nexon listing is invalid JSON") from error
    page = parse_nexon_page(decoded)

    openings: list[ParsedOpening] = []
    for row in page.rows:
        external_id = str(_job_id(row))
        title = _required_text(row.get("title"), "title")
        description_html = _required_text(
            row.get("contents"),
            "contents",
            allow_empty=True,
        )
        career_label = _nested_description(row.get("careerType"))
        employment_label = _nested_description(row.get("employmentType"))
        location = row.get("workingArea")
        if location is not None and not isinstance(location, str):
            raise ValueError("Nexon job workingArea must be text")

        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=f"{page_url.rstrip('/')}/{external_id}",
                title=title,
                status="open",
                description_html=description_html,
                description_text=structured_plain_text(description_html),
                employment_type=EMPLOYMENT_TYPES.get(employment_label or ""),
                career_type=CAREER_TYPES.get(career_label or ""),
                career_min=None,
                career_max=None,
                location=location.strip() if isinstance(location, str) else None,
                opens_at=_parse_datetime(row.get("startDate")),
                closes_at=_parse_datetime(
                    row.get("recruitEndDate") or row.get("endDate")
                ),
            )
        )
    return openings
