from __future__ import annotations

from datetime import datetime, timezone
from html import escape
from typing import Any
from urllib.parse import quote

from ejikfit.connectors.next_data import extract_next_data
from ejikfit.connectors.types import ParsedOpening
from ejikfit.html_text import structured_plain_text


def _required_text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Channel job is missing a {field}")
    return " ".join(value.split())


def _optional_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = " ".join(value.split())
    return normalized or None


def _employment_type(commitment: str | None) -> str | None:
    if commitment is None:
        return None
    for value in ("정규직", "계약직", "인턴"):
        if value in commitment:
            return value
    return None


def _career_type(title: str, commitment: str | None) -> str | None:
    searchable = f"{title} {commitment or ''}".casefold()
    if "신입" in searchable:
        return "new_comer"
    if "주니어" in searchable and "시니어" in searchable:
        return "mixed"
    if "시니어" in searchable or "senior" in searchable:
        return "experienced"
    return None


def _created_at(value: Any) -> datetime | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    timestamp = float(value)
    if timestamp > 10_000_000_000:
        timestamp /= 1000
    try:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return None


def _description_html(job: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("opening", "description"):
        value = job.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(value)

    lists = job.get("lists", [])
    if not isinstance(lists, list):
        raise ValueError("Channel job lists must be an array")
    for section in lists:
        if not isinstance(section, dict):
            raise ValueError("Channel job list section must be an object")
        heading = _optional_text(section.get("text"))
        content = section.get("content")
        if not isinstance(content, str) or not content.strip():
            continue
        heading_html = f"<h2>{escape(heading)}</h2>" if heading else ""
        parts.append(f"<section>{heading_html}<ul>{content}</ul></section>")
    return "\n".join(parts)


def parse_channel_openings(
    raw: str,
    listing_url: str,
) -> list[ParsedOpening]:
    data = extract_next_data(raw)
    page_props = data.get("props", {}).get("pageProps", {})
    jobs = page_props.get("jobs") if isinstance(page_props, dict) else None
    if not isinstance(jobs, list):
        raise ValueError("Channel __NEXT_DATA__ is missing the jobs array")

    openings: list[ParsedOpening] = []
    for job in jobs:
        if not isinstance(job, dict):
            raise ValueError("Channel jobs array contains a non-object record")
        external_id = _required_text(job.get("id"), "job id")
        title = _required_text(job.get("text"), "title")
        categories = job.get("categories")
        if not isinstance(categories, dict):
            raise ValueError(f"Channel job {external_id} is missing categories")

        commitment = _optional_text(categories.get("commitment"))
        description_html = _description_html(job)
        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=f"{listing_url.rstrip('/')}/{quote(external_id, safe='')}",
                title=title,
                status="open",
                description_html=description_html,
                description_text=structured_plain_text(description_html),
                employment_type=_employment_type(commitment),
                career_type=_career_type(title, commitment),
                career_min=None,
                career_max=None,
                location=_optional_text(categories.get("location")),
                opens_at=_created_at(job.get("createdAt")),
                closes_at=None,
            )
        )
    return openings
