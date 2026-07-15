import json
import re
from datetime import datetime
from typing import Any
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from ejikfit.connectors.types import ParsedOpening


KST = ZoneInfo("Asia/Seoul")
CLOSED_STATES = {"closed", "inactive", "archived", "deleted"}


def _text(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = " ".join(value.split())
        return stripped or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None


def _html_text(value: Any) -> str | None:
    raw = _text(value)
    if raw is None:
        return None
    return BeautifulSoup(raw, "lxml").get_text(" ", strip=True) or None


def _unique_join(values: list[str | None]) -> str:
    return " ".join(dict.fromkeys(value for value in values if value))


def _parse_epoch_millis(value: Any) -> datetime | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return datetime.fromtimestamp(value / 1000, tz=KST)


def _parse_iso_datetime(value: Any) -> datetime | None:
    raw = _text(value)
    if raw is None:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=KST)
    return parsed


def _is_open(item: dict[str, Any]) -> bool:
    if item.get("active") is False or item.get("public") is False:
        return False
    state = _text(item.get("state") or item.get("status"))
    return state is None or state.lower() not in CLOSED_STATES


def _lever_description(item: dict[str, Any]) -> str:
    values = [
        _text((item.get("categories") or {}).get("team"))
        if isinstance(item.get("categories"), dict)
        else None,
        _text((item.get("categories") or {}).get("department"))
        if isinstance(item.get("categories"), dict)
        else None,
        _text(item.get("descriptionPlain")),
        _text(item.get("additionalPlain")),
    ]
    for entry in item.get("lists") or []:
        if not isinstance(entry, dict):
            continue
        values.append(_text(entry.get("text")))
        values.append(_html_text(entry.get("content")))
    return _unique_join(values)


def _parse_lever_item(item: dict[str, Any]) -> ParsedOpening | None:
    if not _is_open(item):
        return None

    external_id = _text(item.get("id"))
    title = _text(item.get("text"))
    url = _text(item.get("hostedUrl") or item.get("applyUrl"))
    if external_id is None or title is None or url is None:
        return None

    categories = item.get("categories") if isinstance(item.get("categories"), dict) else {}
    return ParsedOpening(
        external_id=external_id,
        url=url,
        title=title,
        status="open",
        description_html="",
        description_text=_lever_description(item),
        employment_type=_text(categories.get("commitment")),
        career_type=None,
        career_min=None,
        career_max=None,
        location=_text(categories.get("location")),
        opens_at=_parse_epoch_millis(item.get("createdAt")),
        closes_at=None,
    )


def _name_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    names: list[str] = []
    for item in value:
        if isinstance(item, dict):
            name = _text(item.get("name"))
            if name:
                names.append(name)
    return list(dict.fromkeys(names))


def _greenhouse_metadata_value(
    item: dict[str, Any],
    names: set[str],
) -> str | None:
    metadata = item.get("metadata")
    if not isinstance(metadata, list):
        return None
    for entry in metadata:
        if not isinstance(entry, dict):
            continue
        name = _text(entry.get("name"))
        if name is None or name.lower() not in names:
            continue
        value = entry.get("value")
        if isinstance(value, list):
            return ", ".join(part for part in (_text(part) for part in value) if part)
        return _text(value)
    return None


def _greenhouse_description(item: dict[str, Any]) -> str:
    departments = _name_list(item.get("departments"))
    offices = _name_list(item.get("offices"))
    values = departments + offices
    tech_stack = _greenhouse_metadata_value(item, {"tech stack", "skills"})
    if tech_stack:
        values.extend(["Tech Stack", tech_stack])
    values.append(_html_text(item.get("content")))
    return _unique_join(values)


def _parse_greenhouse_item(item: dict[str, Any]) -> ParsedOpening | None:
    if not _is_open(item):
        return None

    external_id = _text(item.get("id") or item.get("internal_job_id"))
    title = _text(item.get("title"))
    url = _text(item.get("absolute_url"))
    if external_id is None or title is None or url is None:
        return None

    location = None
    raw_location = item.get("location")
    if isinstance(raw_location, dict):
        location = _text(raw_location.get("name"))
    elif isinstance(raw_location, str):
        location = _text(raw_location)

    return ParsedOpening(
        external_id=external_id,
        url=url,
        title=title,
        status="open",
        description_html=_text(item.get("content")) or "",
        description_text=_greenhouse_description(item),
        employment_type=_greenhouse_metadata_value(
            item,
            {"employment type", "commitment"},
        ),
        career_type=None,
        career_min=None,
        career_max=None,
        location=location,
        opens_at=_parse_iso_datetime(item.get("updated_at")),
        closes_at=None,
    )


def _ashby_account(listing_url: str) -> str:
    parsed = urlsplit(listing_url)
    segments = [segment for segment in parsed.path.split("/") if segment]
    if (
        parsed.scheme != "https"
        or parsed.hostname != "api.ashbyhq.com"
        or len(segments) != 3
        or segments[:2] != ["posting-api", "job-board"]
        or re.fullmatch(r"[a-z0-9][a-z0-9-]{1,62}", segments[2]) is None
    ):
        raise ValueError("Ashby feed must use an official public job board")
    return segments[2]


def _parse_ashby_item(
    item: dict[str, Any],
    account: str,
) -> ParsedOpening | None:
    if item.get("isListed") is not True:
        return None

    external_id = _text(item.get("id"))
    title = _text(item.get("title"))
    url = _text(item.get("jobUrl"))
    description_html = _text(item.get("descriptionHtml"))
    if (
        external_id is None
        or re.fullmatch(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            external_id,
            flags=re.IGNORECASE,
        )
        is None
        or title is None
        or url is None
        or description_html is None
    ):
        raise ValueError("Ashby listed job identity or content is missing")

    parsed_url = urlsplit(url)
    path_segments = [
        segment for segment in parsed_url.path.split("/") if segment
    ]
    if (
        parsed_url.scheme != "https"
        or parsed_url.hostname != "jobs.ashbyhq.com"
        or path_segments != [account, external_id]
    ):
        raise ValueError("Ashby job URL does not match its public board")

    lower_title = title.lower()
    career_type = None
    if "intern" in lower_title:
        career_type = "new_comer"
    elif any(
        marker in lower_title
        for marker in (
            "senior",
            "staff",
            "lead",
            "manager",
            "director",
            "head of",
        )
    ):
        career_type = "experienced"

    employment_type = {
        "FullTime": "regular",
        "PartTime": "part_time",
        "Contract": "contract",
        "Temporary": "temporary",
        "Intern": "intern",
    }.get(_text(item.get("employmentType")) or "")
    description_text = _text(item.get("descriptionPlain")) or (
        _html_text(description_html) or ""
    )
    return ParsedOpening(
        external_id=external_id,
        url=url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=description_text,
        employment_type=employment_type,
        career_type=career_type,
        career_min=None,
        career_max=None,
        location=_text(item.get("location")),
        opens_at=_parse_iso_datetime(item.get("publishedAt")),
        closes_at=None,
    )


def parse_lever_greenhouse_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    data = json.loads(raw_json)
    if isinstance(data, list):
        return [
            opening
            for item in data
            if isinstance(item, dict)
            for opening in [_parse_lever_item(item)]
            if opening is not None
        ]
    if (
        isinstance(data, dict)
        and data.get("apiVersion") == "1"
        and isinstance(data.get("jobs"), list)
    ):
        account = _ashby_account(listing_url)
        return [
            opening
            for item in data["jobs"]
            if isinstance(item, dict)
            for opening in [_parse_ashby_item(item, account)]
            if opening is not None
        ]
    if isinstance(data, dict) and isinstance(data.get("jobs"), list):
        return [
            opening
            for item in data["jobs"]
            if isinstance(item, dict)
            for opening in [_parse_greenhouse_item(item)]
            if opening is not None
        ]
    raise ValueError("Lever or Greenhouse job feed is missing")
