import json
from datetime import datetime
from typing import Any
from urllib.parse import urljoin

from ejikfit.connectors.types import ParsedOpening


TECHNICAL_CATEGORIES = {"engineering"}


def _text(value: Any) -> str | None:
    if isinstance(value, str):
        normalized = " ".join(value.split())
        return normalized or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None


def _datetime(value: Any) -> datetime | None:
    raw = _text(value)
    if raw is None:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _job_data(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    data = value.get("data", value)
    return data if isinstance(data, dict) else None


def _category_names(value: Any) -> set[str]:
    if not isinstance(value, list):
        return set()
    return {
        name.casefold()
        for item in value
        if isinstance(item, dict)
        if (name := _text(item.get("name"))) is not None
    }


def _is_open_technical_korea_job(item: dict[str, Any]) -> bool:
    if item.get("searchable") is False or item.get("applyable") is False:
        return False
    if (_text(item.get("country_code")) or "").upper() != "KR":
        return False
    return bool(_category_names(item.get("categories")) & TECHNICAL_CATEGORIES)


def _public_url(item: dict[str, Any], listing_url: str) -> str | None:
    metadata = item.get("meta_data")
    canonical = (
        _text(metadata.get("canonical_url"))
        if isinstance(metadata, dict)
        else None
    )
    if canonical:
        return urljoin(listing_url, canonical)

    slug = _text(item.get("slug") or item.get("req_id"))
    if slug is None:
        return None
    language = (_text(item.get("language")) or "en-us").casefold()
    return urljoin(listing_url, f"/jobs/{slug}?lang={language}")


def _employment_type(value: Any) -> str | None:
    raw = _text(value)
    normalized = (raw or "").upper()
    return {
        "FULL_TIME": "정규직",
        "PART_TIME": "파트타임",
        "CONTRACT": "계약직",
        "TEMPORARY": "계약직",
        "INTERN": "인턴",
    }.get(normalized, raw)


def parse_jibe_korea_technical_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    payload = json.loads(raw_json)
    jobs = payload.get("jobs") if isinstance(payload, dict) else None
    total = payload.get("totalCount") if isinstance(payload, dict) else None
    if (
        not isinstance(jobs, list)
        or not isinstance(total, int)
        or total < len(jobs)
    ):
        raise ValueError("Jibe jobs response is invalid")

    openings: list[ParsedOpening] = []
    for value in jobs:
        item = _job_data(value)
        if item is None or not _is_open_technical_korea_job(item):
            continue
        external_id = _text(item.get("req_id") or item.get("slug"))
        title = _text(item.get("title"))
        url = _public_url(item, listing_url)
        if external_id is None or title is None or url is None:
            continue

        openings.append(
            ParsedOpening(
                external_id=external_id,
                url=url,
                title=title,
                status="open",
                description_html="",
                description_text=_text(item.get("description")) or "",
                employment_type=_employment_type(item.get("employment_type")),
                career_type="인턴" if "intern" in title.casefold() else None,
                career_min=None,
                career_max=None,
                location=_text(
                    item.get("full_location")
                    or item.get("short_location")
                    or item.get("location_name")
                ),
                opens_at=_datetime(item.get("posted_date")),
                closes_at=_datetime(item.get("posting_expiry_date")),
            )
        )
    return openings
