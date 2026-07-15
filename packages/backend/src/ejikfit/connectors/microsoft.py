import json
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

from bs4 import BeautifulSoup

from ejikfit.connectors.types import ParsedOpening


CAREER_YEARS_PATTERN = re.compile(
    r"(?<!\d)(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+of)?",
    re.IGNORECASE,
)
MICROSOFT_TECHNICAL_DEPARTMENTS = {
    "applied sciences",
    "cloud solution architecture",
    "critical environment ops",
    "data center technicians",
    "data science",
    "electrical engineering",
    "hardware engineering",
    "quantum engineering",
    "research sciences",
    "security engineering",
    "security operations engineering",
    "service engineering",
    "silicon engineering",
    "site reliability engineering",
    "software engineering",
    "solution architecture",
    "solution engineering",
    "technical support engineering",
}


def is_microsoft_technical_role(
    _title: str | None,
    department: str | None,
) -> bool:
    return (department or "").strip().casefold() in MICROSOFT_TECHNICAL_DEPARTMENTS


def _text(value: Any) -> str | None:
    if isinstance(value, str):
        normalized = " ".join(value.split())
        return normalized or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None


def _response_data(raw_json: str) -> dict[str, Any]:
    payload = json.loads(raw_json)
    if not isinstance(payload, dict) or payload.get("status") != 200:
        raise ValueError("Microsoft Careers API returned an invalid status")
    error = payload.get("error")
    if isinstance(error, dict) and any(
        _text(error.get(key)) for key in ("message", "body")
    ):
        raise ValueError("Microsoft Careers API returned an error")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("Microsoft Careers API is missing data")
    return data


def parse_microsoft_search_page(
    raw_json: str,
) -> tuple[list[dict[str, Any]], int]:
    data = _response_data(raw_json)
    positions = data.get("positions")
    total = data.get("count")
    if (
        not isinstance(positions, list)
        or not isinstance(total, int)
        or total < 0
        or not all(isinstance(position, dict) for position in positions)
    ):
        raise ValueError("Microsoft Careers search envelope is invalid")
    return positions, total


def _timestamp(value: Any) -> datetime | None:
    if isinstance(value, bool):
        return None
    try:
        timestamp = int(str(value))
    except (TypeError, ValueError):
        return None
    try:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return None


def _first_text(value: Any) -> str | None:
    if isinstance(value, list):
        return next(
            (normalized for item in value if (normalized := _text(item))),
            None,
        )
    return _text(value)


def _external_id(item: dict[str, Any]) -> str | None:
    return _text(
        item.get("displayJobId")
        or item.get("atsJobId")
        or item.get("id")
    )


def _public_url(item: dict[str, Any], base_url: str) -> str | None:
    public_url = _text(item.get("publicUrl") or item.get("positionUrl"))
    if public_url is None:
        internal_id = _text(item.get("id"))
        if internal_id is None:
            return None
        public_url = f"/careers/job/{internal_id}"
    return urljoin(base_url, public_url)


def _listing_opening(
    item: dict[str, Any],
    listing_url: str,
) -> ParsedOpening | None:
    external_id = _external_id(item)
    title = _text(item.get("name"))
    url = _public_url(item, listing_url)
    if external_id is None or title is None or url is None:
        return None

    department = _text(item.get("department")) or ""
    return ParsedOpening(
        external_id=external_id,
        url=url,
        title=title,
        status="open",
        description_html="",
        description_text=department,
        employment_type=None,
        career_type=None,
        career_min=None,
        career_max=None,
        location=_first_text(item.get("locations") or item.get("location")),
        opens_at=_timestamp(item.get("postedTs")),
        closes_at=None,
    )


def parse_microsoft_listing_openings(
    raw_json: str,
    listing_url: str,
) -> list[ParsedOpening]:
    payload = json.loads(raw_json)
    jobs = payload.get("jobs") if isinstance(payload, dict) else None
    if not isinstance(jobs, list):
        raise ValueError("Microsoft merged listing is missing jobs")
    return [
        opening
        for item in jobs
        if isinstance(item, dict)
        for opening in [_listing_opening(item, listing_url)]
        if opening is not None
    ]


def microsoft_detail_api_url(listing_url: str, public_job_url: str) -> str:
    listing = urlparse(listing_url)
    public = urlparse(public_job_url)
    if public.netloc != listing.netloc:
        raise ValueError("Microsoft public job host does not match its listing")
    path_parts = public.path.rstrip("/").split("/")
    if len(path_parts) < 3 or path_parts[-2] != "job":
        raise ValueError("Microsoft public job URL is invalid")
    position_id = path_parts[-1]
    if not position_id.isdigit():
        raise ValueError("Microsoft public job id is invalid")

    listing_query = parse_qs(listing.query, keep_blank_values=True)
    domain = listing_query.get("domain", ["microsoft.com"])[0]
    location = listing_query.get("location", ["South Korea"])[0]
    query = urlencode(
        {
            "position_id": position_id,
            "domain": domain,
            "hl": "en",
            "queried_location": location,
        }
    )
    return f"{listing.scheme}://{listing.netloc}/api/pcsx/position_details?{query}"


def _required_qualifications(description_text: str) -> str:
    lowered = description_text.casefold()
    markers = ("required qualifications", "minimum qualifications")
    starts = [lowered.find(marker) for marker in markers]
    start = min(index for index in starts if index >= 0) if any(
        index >= 0 for index in starts
    ) else -1
    if start < 0:
        return ""
    end = lowered.find("preferred qualifications", start)
    return description_text[start : end if end >= 0 else None]


def _career_requirement(description_text: str) -> tuple[str | None, int | None]:
    required = _required_qualifications(description_text)
    years = [int(value) for value in CAREER_YEARS_PATTERN.findall(required)]
    if not years:
        return None, None
    exact_minimum = (
        None
        if "or equivalent experience" in required.casefold()
        else min(years)
    )
    return "경력", exact_minimum


def _employment_type(value: Any) -> str | None:
    raw = _first_text(value)
    normalized = (raw or "").casefold()
    return {
        "full-time": "정규직",
        "full time": "정규직",
        "part-time": "파트타임",
        "part time": "파트타임",
        "internship": "인턴",
        "temporary": "계약직",
    }.get(normalized, raw)


def parse_microsoft_detail_opening(
    raw_json: str,
    detail_url: str,
) -> ParsedOpening:
    item = _response_data(raw_json)
    external_id = _external_id(item)
    title = _text(item.get("name"))
    public_url = _public_url(item, detail_url)
    if external_id is None or title is None or public_url is None:
        raise ValueError("Microsoft detail is missing job identity")

    description_html = _text(item.get("jobDescription")) or ""
    description_text = (
        BeautifulSoup(description_html, "lxml").get_text(" ", strip=True)
        if description_html
        else ""
    )
    career_type, career_min = _career_requirement(description_text)
    return ParsedOpening(
        external_id=external_id,
        url=public_url,
        title=title,
        status="open",
        description_html=description_html,
        description_text=description_text,
        employment_type=_employment_type(
            item.get("efcustomTextEmploymentType")
        ),
        career_type=career_type,
        career_min=career_min,
        career_max=None,
        location=_first_text(item.get("location") or item.get("locations")),
        opens_at=_timestamp(item.get("postedTs")),
        closes_at=None,
    )
